/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,draw */

/* jshint loopfunc: true */

var level = {};
var firstNode = {};
var currentNode = {};

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

level.makeNode = function (index, previousNodeOnShortestPath, distance) {
    return {previous:null, index:index, previousNodeOnShortestPath: previousNodeOnShortestPath, distance:distance, next:null};
};

level.addNode = function (node) {
    while (true) {
        if (currentNode.distance == node.distance) {
            if (currentNode.next !== null) {
                currentNode.next.previous = node;
                node.next = currentNode.next;
            }
            currentNode.next = node;
            node.previous = currentNode;
            return;
        } else if (currentNode.distance < node.distance) {
            if (currentNode.next !== null) {
                if (currentNode.next.distance >= node.distance) {
                    currentNode.next.previous = node;
                    node.next = currentNode.next;
                    currentNode.next = node;
                    node.previous = currentNode;
                    return;
                } else {
                    currentNode = currentNode.next;
                    continue;
                }
            } else {
                currentNode.next = node;
                node.previous = currentNode;
                return;
            }
        } else if (currentNode.distance > node.distance) {
            if (currentNode.previous !== null) {
                if (currentNode.previous.distance <= node.distance) {
                    currentNode.previous.next = node;
                    node.previous = currentNode.previous;
                    currentNode.previous = node;
                    node.next = currentNode;
                    return;
                } else {
                    currentNode = currentNode.previous;
                    continue;
                }
            } else {
                currentNode.previous = node;
                node.next = currentNode;
                firstNode = node;
                return;
            }
        }
    }
};

level.getNeighbours = function (index, distance) {
    var array = [];
    array.push({index:index + this.definition.width - 1, distance:2 + distance});
    array.push({index:index - this.definition.width + 1, distance:2 + distance});
    array.push({index:index + this.definition.width + 1, distance:1 + distance});
    array.push({index:index - this.definition.width - 1, distance:1 + distance});
    array.push({index:index + this.definition.width, distance:0.999 + distance});
    array.push({index:index + 1, distance:0.999 + distance});
    array.push({index:index - this.definition.width, distance:0.999 + distance});
    array.push({index:index - 1, distance:0.999 + distance});
    return array;
};

level.printPath = function (node) {
    var tileset = this.definition.tilesets[0];
    
    var tilewidth = tileset.tilewidth;
    var tileheight = tileset.tileheight;
    
    var array = [];
    
    while (true) {
        var right = node.index % this.definition.width;
        var left = (node.index - right) / this.definition.width;
        var x = 0.5*tilewidth*(right - left);
        var y = 0.5*tileheight*(1+left+right);
        array.push({x:x, y:y});
        //console.log("(" + left + "," + right + ") -> (" + x + "," + y + ")");
        node = node.previousNodeOnShortestPath;
        if (node === null) {
            array.pop();
            return array.reverse();
            //break;
        }
    }
    return array.reverse;
};

level.getPath2 = function(object, destination) {
    var tileset = this.definition.tilesets[0];
    
    var tilewidth = tileset.tilewidth;
    var tileheight = tileset.tileheight;
    
    var left = Math.floor((object.y*tilewidth - object.x*tileheight)/(tilewidth*tileheight));
    var right = Math.floor((object.y*tilewidth + object.x*tileheight)/(tilewidth*tileheight));
    var index = this.definition.width * left + right;
    
    left = Math.floor((destination.y*tilewidth - destination.x*tileheight)/(tilewidth*tileheight));
    right = Math.floor((destination.y*tilewidth + destination.x*tileheight)/(tilewidth*tileheight));
    var destionationIndex = this.definition.width * left + right;
    
    var layer = this.get().layers[0];
    var visitedNotes = [];
    
    var currentPosition = this.makeNode(index,null,0);
    visitedNotes[index] = 1;
    firstNode = currentPosition;
    currentNode = currentPosition;
    
    while (visitedNotes[destionationIndex] === undefined) {
        var neighbours = this.getNeighbours(firstNode.index, firstNode.distance);
        while (neighbours.length > 0) {
            var neighbour = neighbours.pop();
            if (neighbour.index >= 0 && visitedNotes[neighbour.index] === undefined) {
                if (layer.data[neighbour.index] < 15) {
                visitedNotes[neighbour.index] = 1;
                if (neighbour.index == destionationIndex) {
                    //console.log(neighbour.distance);
                    console.log("klaar");
                    return this.printPath(this.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
                this.addNode(this.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
            }
        }
        firstNode.next.previous = null;
        firstNode = firstNode.next;
    }
    
    
    
//    var i = 0;
//    while (i<10000) {
//        this.addNode(this.makeNode(1+i,12+i%10));
//        i = i + 1;
//    }
    //this.addNode(this.makeNode(2,18));
    //this.addNode(this.makeNode(4,15));
    
    //console.log(firstNode.next.next.next.distance);
    
    // linked list met ontdekte maar nog niet bezochte paden. Eerste en laatstgebruikte onthouden.
    // array list met bezochte paden
    // listitem bevat vorige nog niet bezochte pad, vorige in het pad, afstand tot startpunt, index mbt veld.
    
    //{x:x, y:y}
};

level.getPath = function(object, destination) {
    var paths = this.getPath2(object, destination);

//    var array = [];
//    
//    var lineObject = {},
//        lineDestination = {};
//    
//    //console.log(object);
//    
//    lineObject.startX = object.x;
//    lineObject.endX = object.x + 2;
//    lineDestination.startX = destination.x;
//    lineDestination.endX = destination.x - 2;
//    
//    lineObject.startY = object.y;
//    lineDestination.startY = destination.y;
//    
//    if (destination.y < object.y) {
//        lineObject.endY = object.y - 1;
//        lineDestination.endY = destination.y - 1;
//    } else {
//        lineObject.endY = object.y + 1;
//        lineDestination.endY = destination.y + 1;
//    }
//    
//    //console.log(lineObject);
//    //console.log(lineDestination);
//    
//    var intersect = common.checkLineIntersection(lineObject.startX, lineObject.startY, lineObject.endX, lineObject.endY, lineDestination.startX, lineDestination.startY, lineDestination.endX, lineDestination.endY);
//    
//    paths.push(intersect);
//    paths.push(destination);
    
    //console.log(paths);
    
    return paths;
};