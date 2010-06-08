(function() {
  // Hypothesis:
  // - in the DOM, the map is in #map
  // - markers, paths and shapes can be identified by their "quack"
  // - arrays have goodie functions: map, filter

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
    return has_property(container, "getVertex") && has_property(container, 'name');
  }

  function is_shape(container) {
    return has_property(container, "getVertex") && !has_property(container, 'name');
  }

  // Recursively explore the entire object space, looking for markers
  function explore(container, found, max_level, path) {
    if (found(container) && path.toString().indexOf(',0') > -1) { // the marker should be in an array
      throw({ type: 'GMap-to-static', path: path });
    }
    if (path.length < max_level) {
      for (var property in container) {
        if (!is_object(container[property])) continue;
        if (has_property(container[property], 'parentNode')) continue; // don't look into DOM elements

        explore(container[property], found, max_level, path.concat([property]));
      }
    }
  }

  function down(containers, property) {
    var result = [];
    for (var c in containers) {
      if (Number(property) == property) {
        result = result.concat(containers[c]); // push the entire array
      } else {
        try {
          result.push(containers[c][property]);
        } catch(e){}
      }
    }
    return result.filter(function(e){return e != null;});
  }

  function search_for(what, max_level) {
    var results = [];
    try {
      explore(map, what, max_level, []);
    } catch(e) {
      if (e.type && e.type == 'GMap-to-static') {
        var results = [map];
        for (var i = 0; i < e.path.length; i++) {
          results = down(results, e.path[i]);
        }
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
          color = color.replace('marker_', '');
          if (color == 'pink') color = '0xCE579A';
          if (color == 'ltblue') color = '0x67DDDD';
          var has_label = color.match(/(.*)([0-9A-Z])/);
          if (has_label != null) {
            return 'color:' + has_label[1] + '|label:' + has_label[2];
          } else {
            return 'color:' + color;
          }
        }
      }
    }
    return '';
  }

  function between(top_left, bottom_right, point) {
    return  point.lat <= top_left.lat() &&      point.lng >= top_left.lng() &&
            point.lat >= bottom_right.lat() &&  point.lng <= bottom_right.lng();
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
    var shapes = search_for(is_shape, 4);
    paths = paths.concat(shapes); // no shape rendering in static maps, for the moment

    var size = [Math.min(640, Math.round(map_element.offsetWidth)),
                Math.min(640, Math.round(map_element.offsetHeight))];
    var zoom = get_zoom();
    var url = 'http://maps.google.com/maps/api/staticmap?maptype=roadmap' +
              '&zoom=' + zoom + '&size=' + size.join('x') +
              '&center=' + map.getCenter().toUrlValue() + '&sensor=false';

    var top_left = map.fromLatLngToDivPixel(map.getCenter());
    top_left.x -= Math.round(size[0] / 2); top_left.y -= Math.round(size[1] / 2);
    top_left = map.fromDivPixelToLatLng(top_left);
    var bottom_right = map.fromLatLngToDivPixel(map.getCenter());
    bottom_right.x += Math.round(size[0] / 2); bottom_right.y += Math.round(size[1] / 2);
    bottom_right = map.fromDivPixelToLatLng(bottom_right);

    url += '&' + markers.map(function(marker) {
      var latLng = marker['latlng'];
      if (!between(top_left, bottom_right, latLng)) return null;
      return 'markers=' + get_color(marker) + '|' + latLng.lat.toFixed(precision) + ',' + latLng.lng.toFixed(precision);
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
    return url;
  }

  var map = window.gApplication.getMap();
  var map_element = document.getElementById('map');
  var precision = 3;
  var url = get_url();

  var opened = window.open(url);
  if (opened == null) prompt("The address of the static map is:", url);
})();
