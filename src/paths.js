function is_object(elem) {
  return (elem != null) && (typeof(elem) == 'object');
}

function has_property(container, property) {
  return typeof(container[property]) != 'undefined';
}

function is_path(container) {
  return has_property(container, "getVertex");
}

// Recursively explore the entire object space, looking for markers
function explore(container, history) {
  if (is_path(container) && history.toString().indexOf(',0') > -1) { // the marker should be in an array
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


max_level = 4;
map = window.gApplication.getMap();
explore(map, []);
