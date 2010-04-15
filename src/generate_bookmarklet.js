if (!arguments[0]) {
    print('usage:\njsc generate_bookmarklet.js -- "`cat gmap_to_static.js`" > ../index.html');
    quit();
}

load('lib/fulljsmin.js');

minified = jsmin('', arguments[0], 3);
print('<a href="javascript:(function(){' + minified + '})()">make static map!</a>');
