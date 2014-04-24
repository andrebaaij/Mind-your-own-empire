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

level.getPath = function(object, destination) {
    var paths = [];
    
    var lineObject = {},
        lineDestination = {};
    
    //console.log(object);
    
    lineObject.startX = object.x;
    lineObject.endX = object.x + 2;
    lineDestination.startX = destination.x;
    lineDestination.endX = destination.x - 2;
    
    lineObject.startY = object.y;
    lineDestination.startY = destination.y;
    
    if (destination.y < object.y) {
        lineObject.endY = object.y - 1;
        lineDestination.endY = destination.y - 1;
    } else {
        lineObject.endY = object.y + 1;
        lineDestination.endY = destination.y + 1;
    }
    
    //console.log(lineObject);
    //console.log(lineDestination);
    
    var intersect = common.checkLineIntersection(lineObject.startX, lineObject.startY, lineObject.endX, lineObject.endY, lineDestination.startX, lineDestination.startY, lineDestination.endX, lineDestination.endY);
    
    paths.push(intersect);
    paths.push(destination);
    
    //console.log(paths);
    
    return paths;
};