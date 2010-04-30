function is_object(elem) {
  return (elem != null) && (typeof(elem) == 'object');
}

function has_property(container, property) {
  return (typeof(container[property]) != 'undefined');
}

function is_marker(container) {
  return has_property(container, 'infoWindow');
}

map = window['gApplication'].getMap();
signature = 'dira-was-here';
max_level = 4;

function explore(container, history) {
  if (is_marker(container)) {
    throw(history);
  }
  level = history.length;
  if (level > max_level) return;

  try { 
    container[signature] = 1;
  }catch(e) { return; }

  for (property in container) {
    if (property == signature) continue;
    if (!is_object(container[property])) continue;
    if (has_property(container[property], signature)) continue;

    explore(container[property], history.concat([property]));
  }
}

markers = [];
try {
  explore(map, []);
} catch(stack) {
  // stack has the form property property 0 property property
  // before the index is the markers' container, after the index the properties to access inside the marker
  container = map;
  for (i = 0; i < stack.length; i++) {
    if (stack[i] == '0') break;
    container = container[stack[i]];
  }
  for (m in container) {
    if (property == signature) continue;
    
    marker = container[m];
    for (j = i+1; j < stack.length; j++) {
      marker = marker[stack[j]];
    }
    markers.push(marker);
  }
}
markers;

function get_color(marker) {
  for (property in marker) {
    if (marker[property].indexOf && marker[property].indexOf('.png') > -1) {
      candidate = marker[property];
      if (candidate.match(/^http/)) {
        color = candidate.match('/[^/.]*.png')[0];
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


size = '350x450';

center = map.getCenter().toUrlValue();
zoom = 3;
url = 'http://maps.google.com/maps/api/staticmap?zoom=' + zoom + '&size=' + size + '&center=' + center + '&maptype=roadmap&sensor=false';

for (i=0; i < markers.length; i++) {
  marker = markers[i];
  try {
    latLng = marker['latlng'];
    color = get_color(marker);

    url += '&markers=color:' + color + '|' + latLng.lat.toFixed(2) + ',' + latLng.lng.toFixed(2);
  }catch(err){}
}
window.open(url, '_blank');
