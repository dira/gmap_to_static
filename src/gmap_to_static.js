size = '350x450';

map = window.gApplication.getMap();
markers = map.$;

center = map.getCenter().toUrlValue();
zoom = map.Wd;
url = 'http://maps.google.com/maps/api/staticmap?center=' + center + '&zoom=' + zoom + '&size=' + size + '&maptype=roadmap&sensor=false';

for (i=0; i < markers.length; i++) {
  marker = markers[i];
  try {
    latLng = marker.Kc;
    //texts = marker.Pb; texts.name; texts.description;

    image = marker.T;
    color = image.match('/[^/.]*.png')[0];
    color = color.substring(1, color.length - 4); // get the color name from the image
    color = color.replace('-dot', '');
    if (color == 'pink') color = '0xCE579A';
    if (color == 'ltblue') color = '0x67DDDD';

    url += '&markers=color:' + color + '|' + latLng.lat().toFixed(2) + ',' + latLng.lng().toFixed(2);
  }catch(err){ console.log(err);}
}
window.open(url, '_blank');
