/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,draw */

/* jshint loopfunc: true */

var level = {
    settings : {}
};
var firstNode = {};
var currentNode = {};

level.initialise = function() {
    this.load("west.json");
};

level.load = function (jsonFilename) {
    var URI = "./assets/maps/" + jsonFilename;
    this.definition = common.getJSONFromURI(URI);
    
    this.settings.tile = {
        width : this.definition.tilewidth,
        height : this.definition.tileheight
    };
    
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

level.calculatefog = function(log) {
    var objects = game.getObjects();
    var fogOfWar = level.definition.layers[1];
    fogOfWar.data = Array.apply(null, new Array(fogOfWar.width * fogOfWar.height)).map(Number.prototype.valueOf,2);
    objects.forEach(function(object, index) {
        if (typeof object.communicationRadius !== 'undefined') {
            for(var x = object.grid.x - object.communicationRadius; x <= object.grid.x + object.communicationRadius; x++) {
                for(y = object.grid.y - object.communicationRadius; y <= object.grid.y + object.communicationRadius; y++) {
                    if (x < 0 || x > fogOfWar.width || y < 0 || y > fogOfWar.height)
                        return;
                    
                    fogOfWar.data[y*fogOfWar.width+x] = 3;
                    
                    if (log === 1) {
                        console.log(y) 
                        console.log(y*fogOfWar.width) 
                        console.log(y*fogOfWar.width+x)   
                    }
                }
            }
            
        }
    });
};

level.chunks = [];

level.chunks.render = function(layer, chunkX, chunkY) {
    //console.log(chunkX);
    //console.log(chunkY);
    
    
    /*
        For performance reasons, we are splitting the level into chunks, the chunksize is set by game.settings.chunkSize
    
    */
    
    var chunkSize = game.settings.chunkSize;
    
    chunk = document.createElement('canvas'); // Create a new canvas, with a render chunk we can just dispose of any pre-existing chunk and create a new canvas element
    chunk.context = chunk.getContext("2d");
    
    chunk.width = chunkSize * level.settings.tile.width; 
    chunk.height = chunkSize * level.settings.tile.height;
    
    // Get tileset from level
    var tileset_tiles = common.resources.tilesets.get(level.definition.tilesets[0].name);
       
    // Assign tileset data to variables for easy use.
    var tileWidth = level.settings.tile.width;
    var tileHeight = level.settings.tile.height;
    var tilesPerRow = tileset_tiles.tilesPerRow;
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileHeight);
    var numberOfTilesForWidth = Math.ceil(canvas.width/tileWidth) * 2;

    for (var y = chunkY*chunkSize; y < (chunkY*chunkSize) + chunkSize; y++) {
        for (var x = chunkX*chunkSize; x < (chunkX*chunkSize) + chunkSize; x++) { 
            var i = (y*layer.width + x);
            if (i < 0) {
                continue;
            }
            
            
            
            var tileIndex = layer.data[i] - 1;
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;
            
            var cy = i - (chunkY * chunkSize * layer.width);
            var cx = (cy - (Math.floor(cy / layer.width) * layer.width + chunkX * chunkSize));
            cy = Math.floor(cy / layer.width);
            //var cx = chunkI % chunkSize;
            console.log(i+":"+cy);
            //cy = (cy - cx) / chunkSize;
            
//          //  var cx = i % layer.width;
//          //  var cy = (i - cx) / layer.height;
            
            
            
            chunk.context.drawImage(tileset_tiles,
                                   sx * tileWidth,
                                   sy * tileHeight,
                                   tileWidth,
                                   tileHeight,
                                   //((chunkX+chunkY+1) * chunkSize * tileWidth / 2) + Math.round(0.5*(cx-cy)*tileWidth) - (tileWidth / 2),
                                   //((((chunkX-chunkY) * chunkSize) * tileHeight) / 2) + Math.round(0.5*(cx+cy)*tileHeight),
                                   (chunkSize * tileWidth / 2) + Math.round(0.5*(cx-cy)*tileWidth) - (tileWidth / 2),
                                   Math.round(0.5*(cx+cy)*tileHeight),
                                   tileWidth,
                                   tileHeight
                                );
        }
    }
    
    if (!level.chunks[chunkX]) level.chunks[chunkX] = [];
    if (!level.chunks[chunkX][chunkY]) level.chunks[chunkX][chunkY] = {};

    level.chunks[chunkX][chunkY][layer.name] = chunk;
    
    //console.log(chunk.toDataURL());
    
    return chunk;
};

level.chunks.get = function(layer, chunkX, chunkY) {
    //console.log(level.chunks[chunkX]);
    
    if (level.chunks[chunkX] && level.chunks[chunkX][chunkY] && level.chunks[chunkX][chunkY][layer.name]) {
        return level.chunks.render(layer, chunkX, chunkY);
        //return level.chunks[chunkX][chunkY][layer.name];
    } else {
        return level.chunks.render(layer, chunkX, chunkY);
    }
};