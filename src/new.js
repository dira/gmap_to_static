function is_function(elem) {
  return (typeof(elem) == 'function');
}

function is_object(elem) {
  return (elem != null) && (typeof(elem) == 'object');
}

function is_array(elem) {
  return !(typeof(elem.length) == 'undefined');
}

map = window['gApplication'].getMap();
signature = "dira-was-here";

function has_property(container, property) {
  //console.log(container, property);
  return (typeof(container[property]) != 'undefined');
}

function is_marker(container) {
  return has_property(container, 'infoWindow');
}

function explore(container, level) {
  //console.log(container);
  if (is_marker(container)) {
    console.log("found it!!!!!!!", container);
    throw("found it");
  }
  if (level > 4) return;

  try { 
    container[signature] = 1;
  }catch(e) { return; }

  for (property in container) {
    if (property == signature) continue;
    if (!is_object(container[property])) continue;
    if (has_property(container[property], signature)) continue;

    //s = property;
    //for (i = 0; i < level; i++) s = "\t" + s;
    //console.log(s);
    explore(container[property], level + 1);
  }
}

explore(map, 1);




