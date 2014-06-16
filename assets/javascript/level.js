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
        var x = 0.5*tilewidth*(right - left)+ tilewidth*0.5;
        var y = 0.5*tileheight*(1+left+right);
        array.push({x:x, y:y});

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
    
    var coordinates = common.getGridFromCoordinates(destination.x, destination.y);
    
    left = Math.floor((destination.y*tilewidth - destination.x*tileheight)/(tilewidth*tileheight));
    right = Math.floor((destination.y*tilewidth + destination.x*tileheight)/(tilewidth*tileheight));
    var destinationIndex = this.definition.width * left + right;
    
    destinationIndex = coordinates.index;
    
    var layer = this.get().layers[0];
    var visitedNotes = [];
    
    var currentPosition = this.makeNode(index,null,0);
    visitedNotes[index] = 1;
    firstNode = currentPosition;
    currentNode = currentPosition;
    
    while (visitedNotes[destinationIndex] === undefined) {
        var neighbours = this.getNeighbours(firstNode.index, firstNode.distance);
        while (neighbours.length > 0) {
            var neighbour = neighbours.pop();
            if (neighbour.index >= 0 && visitedNotes[neighbour.index] === undefined) {
                if (layer.data[neighbour.index] < 15) {
                visitedNotes[neighbour.index] = 1;
                if (neighbour.index == destinationIndex) {
                    return this.printPath(this.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
                this.addNode(this.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
            }
        }
        firstNode.next.previous = null;
        firstNode = firstNode.next;
    }
};

level.getPath = function(object, destination) {
    var paths = this.getPath2(object, destination);
    
    return paths;
};