/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,draw */

/* jshint loopfunc: true */

var level = {
};

level.initialise = function (jsonFilename) {
    var URI = "./assets/maps/" + jsonFilename;
    level = common.getJSONFromURI(URI);
    
    draw(document.getElementById("canvas"),level,0,0,0);
};

level.get = function() {
    return level;
};

level.initialise("west.json");
