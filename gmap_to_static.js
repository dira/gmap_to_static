(function() {
  // Hypothesis:
  // - in the DOM, the map is in #map
  // - markers, paths and shapes can be identified by their "quack"
  // - arrays have goodie functions: map, filter

  //
  // Exploration
  //
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

  function is_shape_bgrd(container) {
    return has_property(container, 'color') && has_property(container, 'fill');
  }

  function result_must_be_array(quack) {
    return quack != is_shape_bgrd;
  }

  // Recursively explore the entire object space, until finding the needed object
  function search_by_quack(container, quack, max_level, path) {
    if (quack(container)) {
      if ( !result_must_be_array(quack) || path.toString().indexOf(',0') > -1) {
        throw({ type: 'GMap-to-static', path: path });
      }
    }
    if (path.length < max_level) {
      for (var property in container) {
        if (!is_object(container[property])) continue;
        if (has_property(container[property], 'parentNode')) continue; // don't look into DOM elements

        search_by_quack(container[property], quack, max_level, path.concat([property]));
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

  function search_for(quack, max_level) {
    var results = [];
    try {
      search_by_quack(map, quack, max_level, []);
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

  //
  // Data extraction
  //
  function extract_info() {
    var markers = search_for(is_marker, 3);
    var paths = search_for(is_path, 4);
    var shapes = search_for(is_shape, 4);

    var size = [Math.min(640, Math.round(map_element.offsetWidth)),
                Math.min(640, Math.round(map_element.offsetHeight))];
    var zoom = get_zoom();
              '&zoom=' + zoom + '&size=' + size.join('x') +
              '&center=' + map.getCenter().toUrlValue() + '&sensor=false';

    var bounds = get_actual_bounds(size);
    markers = markers.filter(function(marker){ return between(bounds, marker['latlng']); }).map(extract_marker);

    paths = paths.map(function(path){ return extract_path(path, bounds, false); }).
      filter(function(e){return e != null;});

    shapes = shapes.map(function(path){ return extract_path(path, bounds, true); }).
      filter(function(e){return e != null;});


    return {
      size: size,
      zoom: zoom,
      markers: markers,
      paths: paths,
      shapes: shapes
    };
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

  function get_actual_bounds(size) {
    var top_left = map.fromLatLngToDivPixel(map.getCenter());
    top_left.x -= Math.round(size[0] / 2); top_left.y -= Math.round(size[1] / 2);
    top_left = map.fromDivPixelToLatLng(top_left);
    var bottom_right = map.fromLatLngToDivPixel(map.getCenter());
    bottom_right.x += Math.round(size[0] / 2); bottom_right.y += Math.round(size[1] / 2);
    bottom_right = map.fromDivPixelToLatLng(bottom_right);
    return { nw: top_left, se: bottom_right };
  }

  function extract_marker(marker) {
    var info = get_color(marker);
    info.latlng = marker['latlng'];
    return info;
  }

  function extract_path(path, bounds, is_shape) {
    var points = [];
    var n = path.getVertexCount();
    // for each node that is in the map area, add the predecesor and the succesor
    // will not work for a segment that crosses the map but has ends outside the map area. good enough
    var to_add = [];
    for (var i = 0; i < n; i++) {
      var v = path.getVertex(i);
      if (between(bounds, {lat: v.lat(), lng: v.lng()})) {
        to_add.push(i, i+1, i-1);
      }
    }
    for (var i = 0; i < n; i++) {
      if (to_add.indexOf(i) == -1) continue;
      var v = path.getVertex(i);
      points.push({ lat: v.lat(), lng: v.lng() });
    }
    if (points.length < 2) return null;
    var info = { color: encode_hex(path.color) };
    if (is_shape) {
      try {
        search_by_quack(path, is_shape_bgrd, 3, []);
      } catch(e) {
        var fill = path;
        for (var i in e.path) fill = fill[e.path[i]]; // TODO why not down
        info.fillcolor = encode_hex(fill.fill) + Math.round(fill.opacity * 255).toString(16);
      }
    }
    info.points = points;
    return info;
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
          var has_label = color.match(/(.*)([0-9A-Z])/);
          if (has_label != null) {
            return {color: has_label[1], label: + has_label[2] };
          } else {
            if (color == 'pink') color = '0xce579a';
            if (color == 'ltblue' || color == 'lightblue') color = '0x67dddd';
            if (color == 'green') color = '0x00e64d';
            return { color: color };
          }
        }
      }
    }
    return '';
  }

  function between(bounds, point) {
    return  point.lat <= bounds.nw.lat() && point.lng >= bounds.nw.lng() &&
            point.lat >= bounds.se.lat() && point.lng <= bounds.se.lng();
  }

  function encode_hex(hex) {
    return hex.replace('#', '0x');
  }

  //
  // URL construction
  //
  function get_url(info) {
    var url = 'http://maps.google.com/maps/api/staticmap?maptype=roadmap' +
              '&zoom=' + info.zoom + '&size=' + info.size.join('x') +
              '&center=' + map.getCenter().toUrlValue() + '&sensor=false';

    if (info.markers.length > 0) {
      url += '&' + info.markers.map(function(marker) {
        return 'markers=color:' + marker.color + '|' + encode_latlng(marker.latlng);
      }).join('&');
    }

    if (info.shapes.length > 0) {
      url += '&' + info.shapes.map(function(shape){
        return encode_path(shape, true);
      }).join("&");
    }

    if (info.paths.length > 0) {
      url += '&' + info.paths.map(function(path){
        return encode_path(path, false);
      }).join("&");
    }

    return url;
  }

  function encode_path(path, is_shape) {
    url = 'path=';
    if (is_shape) {
      url += 'fillcolor:' + path.fillcolor + '|';
    }
    url += 'color:' + path.color + '|';
    return url + path.points.map(encode_latlng).join("|");
  }

  function encode_latlng(latlng) {
    return latlng.lat.toFixed(precision) + ',' + latlng.lng.toFixed(precision);
  }

  //
  // Let's roll!
  //
  var map = window.gApplication.getMap();
  var map_element = document.getElementById('map');
  var precision = 3;
  var info = extract_info();
  var url = get_url(info);

  var opened = window.open(url);
  if (opened == null) prompt("The address of the static map is:", url);
})();
