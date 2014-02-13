/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,draw */

/* jshint loopfunc: true */

var level = {};

level.initialise = function() {
    this.load("west.json");
};

level.load = function (jsonFilename) {
    var URI = "./assets/maps/" + jsonFilename;
    this.definition = common.getJSONFromURI(URI);
};

level.get = function() {
    return this.definition;
};