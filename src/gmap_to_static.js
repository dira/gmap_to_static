// Hypothesis:
// - in the DOM, the map is in #map
// - the markers have the properties "infoWindow" and "latlng", and they are 
// no more than 3 levels deep compared to window.gApplication.getMap()

function is_object(elem) {
  return (elem != null) && (typeof(elem) == 'object');
}

function has_property(container, property) {
  return typeof(container[property]) != 'undefined';
}

function is_marker(container) {
  return has_property(container, 'infoWindow') && has_property(container, 'latlng');
}

function is_path(container) {
  return has_property(container, "getVertex");
}

// Recursively explore the entire object space, looking for markers
function explore(container, history) {
  if (find(container) && history.toString().indexOf(',0') > -1) { // the marker should be in an array
    throw(history);
  }
  if (history.length < max_level) {
    for (var property in container) {
      if (!is_object(container[property])) continue;
      if (has_property(container[property], 'parentNode')) continue; // don't look into DOM elements

      explore(container[property], history.concat([property]));
    }
  }
}

function get_color(marker) {
  for (var property in marker) {
    if (marker[property].indexOf && marker[property].indexOf('.png') > -1) {
      var color = marker[property];
      if (color.match(/^http/)) {
        color = color.match('/[^/.]*.png')[0];
        color = color.substring(1, color.length - 4); // get the color name from the image
        color = color.replace('-dot', '');
        if (color == 'pink') color = '0xCE579A';
        if (color == 'ltblue') color = '0x67DDDD';
        return color;
      }
    }
  }
  return '';
}

function get_zoom() {
  /* Hic sunt magiks! :D
     r (map_width/longitude_span) is constant within a zoom level and diminuates exponentially as we zoom in,
     with powers of 2, hence the mighty log2()
     For level 3, 1/r = 0.175. I like level 3 because, for not extravagant resolutions, there is no map part shown twice,
     so longitude_span is actually meaningful */
  var r = document.getElementById('map').offsetWidth / map.getBounds().toSpan().x;
  return 3 + Math.round(Math.LOG2E * Math.log(0.175 * r));
}

map = window.gApplication.getMap();
markers = [];
paths = [];

console.log('here');
try {
  max_level = 3;
  find = is_marker;
  explore(map, []);
} catch(stack) {
console.log('found markers: ', stack);
  // yuppie, found markers
  // stack has the form: [property, property, "0", property, property]
  container = map;
  for (var i = 0; i < stack.length; i++) {
    if (stack[i] == '0') break;
    container = container[stack[i]];
  }
  for (var m in container) {
    var marker = container[m];
    for (var j = i+1; j < stack.length; j++) {
      marker = marker[stack[j]];
    }
    markers.push(marker);
  }
}
console.log("markers", markers);
try {
  max_level = 4;
  find = is_path;
  explore(map, []);
} catch(stack) {
console.log('found paths: ', stack);
  // yuppie, found path
  // stack has the form: [property, property, "0", property, property]
  container = map;
  for (var i = 0; i < stack.length; i++) {
    if (stack[i] == '0') break;
    container = container[stack[i]];
  }
  for (var m in container) {
    var marker = container[m];
    for (var j = i+1; j < stack.length; j++) {
      marker = marker[stack[j]];
    }
    paths.push(marker);
  }
}
console.log('paths', paths);

size = '350x450';
// todo: maptype {roadmap,sattelite,hybrid,terrain}
url = 'http://maps.google.com/maps/api/staticmap?zoom=' + get_zoom() + '&size=' + size + '&center=' + map.getCenter().toUrlValue() + '&maptype=roadmap&sensor=false';
url += '&';
console.log('url', url);
url += markers.map(function(marker) {
  var latLng = marker['latlng'];
  return 'markers=color:' + get_color(marker) + '|' + latLng.lat.toFixed(2) + ',' + latLng.lng.toFixed(2);
}).join('&');
url += '&'
console.log('url2', url);
url += paths.map(function(path){
  points = []
  for (var i  =0; i < path.getVertexCount(); i++) {
    var v = path.getVertex(i);
    points.push(v.lat().toFixed(2) + "," + v.lng().toFixed(2));
  }
  return 'path=' + points.join("|");
}).join("&");
console.log('url3', url);
window.open(url, '_blank');
