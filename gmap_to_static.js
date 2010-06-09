Dira = {1:1
  // Hypothesis:
  // - in the DOM, the map is in #map
  // - markers, paths and shapes can be identified by their "quack"
  // - arrays have goodie functions: map, filter

  //
  // Exploration
  //
  ,is_object: function(elem) {
    return (elem != null) && (typeof(elem) == 'object');
  }

  ,has_property: function(container, property) {
    return typeof(container[property]) != 'undefined';
  }

  ,is_marker: function(container) {
    return this.has_property(container, 'infoWindow') && this.has_property(container, 'latlng');
  }

  ,is_path: function(container) {
    return this.has_property(container, "getVertex") && this.has_property(container, 'name');
  }

  ,is_shape: function(container) {
    return this.has_property(container, "getVertex") && !this.has_property(container, 'name');
  }

  ,is_shape_bgrd: function(container) {
    return this.has_property(container, 'color') && this.has_property(container, 'fill');
  }

  ,result_must_be_array: function(quack) {
    return quack != this.is_shape_bgrd;
  }

  // Recursively explore the entire object space, until finding the needed object
  ,search_by_quack: function(container, quack, max_level, path) {
    if (quack.apply(Dira, [container])) {
      if ( !this.result_must_be_array(quack) || path.toString().indexOf(',0') > -1) {
        throw({ type: 'GMap-to-static', path: path });
      }
    }
    if (path.length < max_level) {
      for (var property in container) {
        if (!this.is_object(container[property])) continue;
        if (this.has_property(container[property], 'parentNode')) continue; // don't look into DOM elements

        this.search_by_quack(container[property], quack, max_level, path.concat([property]));
      }
    }
  }

  ,down: function(containers, property) {
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

  ,search_for: function(quack, max_level) {
    var results = [];
    try {
      this.search_by_quack(this.map, quack, max_level, []);
    } catch(e) {
      if (e.type && e.type == 'GMap-to-static') {
        var results = [this.map];
        for (var i = 0; i < e.path.length; i++) {
          results = this.down(results, e.path[i]);
        }
      } else {
        throw(e);
      }
    }
    return results;
  }

  //
  // Data extraction
  //
  ,extract_info: function() {
    var markers = this.search_for(this.is_marker, 3);
    var paths = this.search_for(this.is_path, 4);
    var shapes = this.search_for(this.is_shape, 4);

    var size = [Math.min(640, Math.round(this.map_element.offsetWidth)),
                Math.min(640, Math.round(this.map_element.offsetHeight))];
    var zoom = this.get_zoom();
              '&zoom=' + zoom + '&size=' + size.join('x') +
              '&center=' + this.map.getCenter().toUrlValue() + '&sensor=false';

    var bounds = this.get_actual_bounds(size);
    var _this = this;
    markers = markers.filter(function(marker){ return _this.between(bounds, marker['latlng']); }).
      map(function(marker) { return _this.extract_marker(marker) } );

    paths = paths.map(function(path){ return _this.extract_path(path, bounds, false); }).
      filter(function(e){return e != null;});

    shapes = shapes.map(function(path){ return _this.extract_path(path, bounds, true); }).
      filter(function(e){return e != null;});

    return {
      size: size,
      zoom: zoom,
      markers: markers,
      paths: paths,
      shapes: shapes
    };
  }

  ,get_zoom: function() {
    /* Hic sunt magiks! :D
       r (map_width/longitude_span) is constant within a zoom level and diminuates exponentially as we zoom in,
       with powers of 2, hence the mighty log2()
       For level 3, 1/r = 0.175. I like level 3 because, for not extravagant resolutions, there is no map part shown twice,
       so longitude_span is actually meaningful */
    var r = this.map_element.offsetWidth / this.map.getBounds().toSpan().x;
    return 3 + Math.round(Math.LOG2E * Math.log(0.175 * r));
  }

  ,get_actual_bounds: function(size) {
    var top_left = this.map.fromLatLngToDivPixel(this.map.getCenter());
    top_left.x -= Math.round(size[0] / 2); top_left.y -= Math.round(size[1] / 2);
    top_left = this.map.fromDivPixelToLatLng(top_left);
    var bottom_right = this.map.fromLatLngToDivPixel(this.map.getCenter());
    bottom_right.x += Math.round(size[0] / 2); bottom_right.y += Math.round(size[1] / 2);
    bottom_right = this.map.fromDivPixelToLatLng(bottom_right);
    return { nw: top_left, se: bottom_right };
  }

  ,extract_marker: function(marker) {
    var info = this.get_color(marker);
    info.latlng = marker['latlng'];
    return info;
  }

  ,extract_path: function(path, bounds, is_shape) {
    var points = [];
    var n = path.getVertexCount();
    // for each node that is in the map area, add the predecesor and the succesor
    // will not work for a segment that crosses the map but has ends outside the map area. good enough
    var to_add = [];
    for (var i = 0; i < n; i++) {
      var v = path.getVertex(i);
      if (this.between(bounds, {lat: v.lat(), lng: v.lng()})) {
        to_add.push(i, i+1, i-1);
      }
    }
    for (var i = 0; i < n; i++) {
      if (to_add.indexOf(i) == -1) continue;
      var v = path.getVertex(i);
      points.push({ lat: v.lat(), lng: v.lng() });
    }
    if (points.length < 2) return null;
    var info = { color: this.encode_hex(path.color), weight: path.weight, opacity: path.opacity };
    if (is_shape) {
      try {
        this.search_by_quack(path, this.is_shape_bgrd, 3, []);
      } catch(e) {
        var fill = path;
        for (var i in e.path) fill = fill[e.path[i]]; // TODO why not down
        info.fillcolor = this.encode_hex(fill.fill) + this.encode_opacity(fill.opacity);
      }
    }
    info.points = points;
    return info;
  }

  ,get_color: function(marker) {
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
    return { color: 'blue' };
  }

  ,between: function(bounds, point) {
    return  point.lat <= bounds.nw.lat() && point.lng >= bounds.nw.lng() &&
            point.lat >= bounds.se.lat() && point.lng <= bounds.se.lng();
  }

  ,encode_hex: function(hex) {
    return hex.replace('#', '0x');
  }

  ,encode_opacity: function(opacity) {
    return Math.round(opacity * 255).toString(16);
  }

  //
  // URL construction
  //
  ,get_url: function(info) {
    var url = 'http://maps.google.com/maps/api/staticmap?maptype=roadmap' +
              '&zoom=' + info.zoom + '&size=' + info.size.join('x') +
              '&center=' + this.map.getCenter().toUrlValue() + '&sensor=false';

    var _this = this;
    if (info.markers.length > 0) {
      var by_color = this.group_by_color(info.markers);
      for (var color in by_color) {
        url += '&markers=color:' + color + '|' + by_color[color].map(function(marker) {
          return _this.encode_latlng(marker.latlng);
        }).join('|');
      }
    }

    if (info.shapes.length > 0) {
      url += '&' + info.shapes.map(function(shape){
        return _this.encode_path(shape, true);
      }).join("&");
    }

    if (info.paths.length > 0) {
      url += '&' + info.paths.map(function(path){
        return _this.encode_path(path, false);
      }).join("&");
    }

    return url;
  }

  ,group_by_color: function(markers) {
    var result = {};
    for (i in markers) {
      var marker = markers[i];
      if (result[marker.color] == null) {
        result[marker.color] = [];
      }
      result[marker.color].push(marker);
    }
    return result;
  }

  ,encode_path: function(path, is_shape) {
    url = 'path=';
    if (is_shape) {
      url += 'fillcolor:' + path.fillcolor + '|';
    }
    url += 'color:' + this.encode_hex(path.color) + this.encode_opacity(path.opacity) + '|';
    if (path.weight != 5) {
      url += 'weight:' + path.weight + '|';
    }
    var _this = this;
    return url + path.points.map(function(point) { return _this.encode_latlng(point) }).join("|");
  }

  ,encode_latlng: function(latlng) {
    return latlng.lat.toFixed(this.precision) + ',' + latlng.lng.toFixed(this.precision);
  }


  ,map : function() { return window.gApplication.getMap()}()
  ,map_element : document.getElementById('map')
  ,precision : 3

  ,main: function() {
    var url = this.get_url(this.extract_info());
    var opened = window.open(url);
    if (opened == null) prompt("The address of the static map is:", url);
  }
}
Dira.main();
