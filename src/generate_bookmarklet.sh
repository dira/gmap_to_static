#!/bin/bash
compressed=`java -jar lib/yuicompressor-2.4.2.jar gmap_to_static.js`
echo "<a href='javascript:(function(){"  $compressed  "})()'>make static map!</a>" > ../index.html
