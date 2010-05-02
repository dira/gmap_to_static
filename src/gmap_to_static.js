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
function explore(container, found, max_level, history) {
  if (found(container) && history.toString().indexOf(',0') > -1) { // the marker should be in an array
    throw(history);
  }
  if (history.length < max_level) {
    for (var property in container) {
      if (!is_object(container[property])) continue;
      if (has_property(container[property], 'parentNode')) continue; // don't look into DOM elements

      explore(container[property], found, max_level, history.concat([property]));
    }
  }
}

function search_for(what, max_level) {
  results = [];
  try {
    explore(map, what, max_level, []);
  } catch(stack) {
    // yuppie, found markers
    // stack has the form: [property, property, "0", property, property]
    container = map;
    var pivot = 0;
    var n = stack.length;
    for (var i = n; i >= 0; i--) {
      if (stack[i] == '0') {
        pivot = i;
        break;
      }
    }
    for (var i = 0; i < pivot; i++) {
      container = container[stack[i]];
    }
    for (var e in container) {
      var element = container[e];
      for (var i = pivot + 1; i < n; i++) {
        element = element[stack[i]];
      }
      results.push(element);
    }
  }
  return results;
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

function between(top_left, bottom_right, point) {
  return point.lat <= top_left.lat() && point.lng >= top_left.lng() &&
    point.lat >= bottom_right.lat() && point.lng <= bottom_right.lng();
}

function get_zoom() {
  /* Hic sunt magiks! :D
     r (map_width/longitude_span) is constant within a zoom level and diminuates exponentially as we zoom in,
     with powers of 2, hence the mighty log2()
     For level 3, 1/r = 0.175. I like level 3 because, for not extravagant resolutions, there is no map part shown twice,
     so longitude_span is actually meaningful */
  var r = map_element.offsetWidth / map.getBounds().toSpan().x;
  return 3 + Math.round(Math.LOG2E * Math.log(0.175 * r));
}


function get_url() {
  var markers = search_for(is_marker, 3);
  var paths = search_for(is_path, 4);


  var size = [Math.min(640, Math.round(map_element.offsetWidth  / 10) * 10),
              Math.min(640, Math.round(map_element.offsetHeight / 10) * 10)];
  try {
    var new_size = prompt("Size", size.join('x')).split("x");
    if (Number(new_size[0]) && Number(new_size[1])) size = [Number(new_size[0]), Number(new_size[1])];
  }catch(e){}
  var zoom = get_zoom();
  // todo: alert size
  // todo: maptype {roadmap,sattelite,hybrid,terrain}
  var url = 'http://maps.google.com/maps/api/staticmap?zoom=' + zoom + '&size=' + size.join('x') + '&center=' + map.getCenter().toUrlValue() + '&maptype=roadmap&sensor=false';

  var top_left = map.fromLatLngToDivPixel(map.getCenter());
  top_left.x -= Math.round(size[0] / 2); top_left.y -= Math.round(size[1] / 2);
  top_left = map.fromDivPixelToLatLng(top_left);
  var bottom_right = map.fromLatLngToDivPixel(map.getCenter());
  bottom_right.x += Math.round(size[0] / 2); bottom_right.y += Math.round(size[1] / 2);
  bottom_right = map.fromDivPixelToLatLng(bottom_right);

  url += '&' + markers.map(function(marker) {
    var latLng = marker['latlng'];
    if (!between(top_left, bottom_right, latLng)) return null;
    return 'markers=color:' + get_color(marker) + '|' + latLng.lat.toFixed(precision) + ',' + latLng.lng.toFixed(precision);
  }).filter(function(e){return e != null;}).join('&');

  url += '&' + paths.map(function(path){
    var points = [];
    var n = path.getVertexCount();
    // for each node that is in the map area, add the predecesor and the succesor
    // will not work for a segment that crosses the map but has ends outside the map area. good enough
    var to_add = [];
    for (var i = 0; i < n; i++) {
      var v = path.getVertex(i);
      if (between(top_left, bottom_right, {lat: v.lat(), lng: v.lng()})) {
        to_add.push(i, i+1, i-1);
      }
    }
    for (var i = 0; i < n; i++) {
      if (to_add.indexOf(i) == -1) continue;
      var v = path.getVertex(i);
      points.push(v.lat().toFixed(precision) + "," + v.lng().toFixed(precision));
    }
    if (points.length < 2) return null;
    var color = path.color == '#0000ff' ? '' : ('color:' + path.color.replace('#', '0x') + '|');
    return 'path=' + color + points.join("|");
  }).filter(function(e){return e != null;}).join("&");
  //console.log(url);
  return url;
}

map = window.gApplication.getMap();
map_element = document.getElementById('map');
precision = 3;
window.open(get_url(), '_blank');
