/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

/* jshint loopfunc: true */

var level = {};

var firstNode = {};
var currentNode = {};

level.initialise = function() {
    this.load("west.json");
    
    //Interfaces 
    game.calculatefog = level.calculatefog;
    game.getChunk = level.chunks.get;
    game.getLevel = level.get;
    game.getPath = level.getPath;
};

level.load = function (jsonFilename) {
    var URI = "./assets/maps/" + jsonFilename;
    this.definition = common.getJSONFromURI(URI);
    
    //Add a layer with history of walked tiles.
    
    var historyLayer = {
         data:Array.apply(null, new Array(level.definition.width * level.definition.height)).map(Number.prototype.valueOf,2),
         height:level.definition.height,
         name:"history",
         type:"historylayer",
         visible:true,
         width:level.definition.width,
         x:0,
         y:0
        };
    
    this.definition.layers.push(historyLayer);
    
    level.layers = {};
    level.layers.history = historyLayer;
    
    game.variables.tile = {
        width : this.definition.tilewidth,
        height : this.definition.tileheight
    };
    
    level.calculatefog();
};

level.get = function() {
    var self = level.definition;
    return level.definition;
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
        }
    }
    return array.reverse;
};

level.getPath = function(object, destination) {
    var self = level;
    
    var tileset = self.definition.tilesets[0];
    
    var tilewidth = tileset.tilewidth;
    var tileheight = tileset.tileheight;
    
    var left = Math.floor((object.y*tilewidth - object.x*tileheight)/(tilewidth*tileheight));
    var right = Math.floor((object.y*tilewidth + object.x*tileheight)/(tilewidth*tileheight));
    var index = level.definition.width * left + right;
    
    var coordinates = common.getGridFromCoordinates(destination.x, destination.y);
    
    left = Math.floor((destination.y*tilewidth - destination.x*tileheight)/(tilewidth*tileheight));
    right = Math.floor((destination.y*tilewidth + destination.x*tileheight)/(tilewidth*tileheight));
    var destinationIndex = self.definition.width * left + right;
    
    destinationIndex = coordinates.index;
    
    var layer = self.get().layers[0];
    var visitedNotes = [];
    
    var currentPosition = self.makeNode(index,null,0);
    visitedNotes[index] = 1;
    firstNode = currentPosition;
    currentNode = currentPosition;
    
    while (visitedNotes[destinationIndex] === undefined) {
        var neighbours = self.getNeighbours(firstNode.index, firstNode.distance);
        while (neighbours.length > 0) {
            var neighbour = neighbours.pop();
            if (neighbour.index >= 0 && visitedNotes[neighbour.index] === undefined) {
                if (layer.data[neighbour.index] < 15) {
                visitedNotes[neighbour.index] = 1;
                if (neighbour.index == destinationIndex) {
                    return self.printPath(self.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
                self.addNode(self.makeNode(neighbour.index, firstNode, neighbour.distance));
                }
            }
        }
        firstNode.next.previous = null;
        firstNode = firstNode.next;
    }
};

level.calculatefog = function() {
    
    
    console.log(this);
    var objects = game.getObjects();
    var fogOfWar = level.definition.layers[1];
    data = Array.apply(null, new Array(fogOfWar.width * fogOfWar.height)).map(Number.prototype.valueOf,2);
    objects.forEach(function(object, index) {
        if (typeof object.communicationRadius !== 'undefined') {
            for(var x = object.grid.x - object.communicationRadius; x <= object.grid.x + object.communicationRadius; x++) {
                for(var y = object.grid.y - object.communicationRadius; y <= object.grid.y + object.communicationRadius; y++) {
                    if (x < 0 || x > fogOfWar.width || y < 0 || y > fogOfWar.height) 
                        continue;
                    
                    data[y*fogOfWar.width+x] = -1;
                    level.layers.history.data[y*fogOfWar.width+x] = 3;
                }
            }
            
        }
    });
    
    alteredChunks = [];
    
    data.forEach(function(tile,index) {
        
        
        if(tile == 2) {
            tile = level.layers.history.data[index];
            data[index] = level.layers.history.data[index];
        }
        
        if(fogOfWar.data[index] !== tile) {
            y = Math.floor(index / fogOfWar.width);
            x = index - fogOfWar.height * y;
            
            chunkX = Math.floor(x/game.variables.chunk.size);
            chunkY = Math.floor(y/game.variables.chunk.size);
            
            if (!alteredChunks[chunkX]) {
               alteredChunks[chunkX] = [];
            }
            
            alteredChunks[chunkX][chunkY] = true;
        }
    });
    
    fogOfWar.data = data;

    alteredChunks.forEach(function(x, xIndex) {
        x.forEach(function(y,yIndex) {
            level.chunks.render(fogOfWar,xIndex,yIndex);
        });
    });
    
    
};

level.chunks = [];

level.chunks.render = function(layer, chunkX, chunkY) {
    /*
        For performance reasons, we are splitting the level into chunks, the chunksize is set by game.variables.chunkSize
    
    */
    
    var chunkSize = game.variables.chunk.size;
    
    var chunk = document.createElement('canvas'); // Create a new canvas, with a render chunk we can just dispose of any pre-existing chunk and create a new canvas element
    chunk.context = chunk.getContext("2d");
    
    chunk.width = chunkSize * game.variables.tile.width; 
    chunk.height = chunkSize * game.variables.tile.height;
    
    // Get tileset from level
    var tileset_tiles = common.resources.tilesets.get(layer.properties.tileset);
    
    // Sometimes the tileset is not loaded yet, then we don't have any images to draw the chunk,
    // so we can safely return and retry it later.
    if (!tileset_tiles.isLoaded) {
        return null;
    }
    
    
    // Assign tileset data to variables for easy use.
    var tileWidth = game.variables.tile.width;
    var tileHeight = game.variables.tile.height;
    var tilesPerRow = tileset_tiles.tilesPerRow;
    
    var numberOfTilesForHeight = Math.ceil(chunk.height/tileHeight);
    var numberOfTilesForWidth = Math.ceil(chunk.width/tileWidth) * 2;

    for (var y = chunkY*chunkSize; y < (chunkY*chunkSize) + chunkSize; y++) {
        for (var x = chunkX*chunkSize; x < (chunkX*chunkSize) + chunkSize; x++) { 
            var i = (y*layer.width + x);
            if (i < 0) {
                continue;
            }
            
            var tileIndex = layer.data[i] - 1;
            if (tileIndex < 0) {
                continue;    
            }
            
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;
            
            var cy = i - (chunkY * chunkSize * layer.width);
            var cx = (cy - (Math.floor(cy / layer.width) * layer.width + chunkX * chunkSize));
            cy = Math.floor(cy / layer.width);           
            
            chunk.context.drawImage(tileset_tiles,
                                   sx * tileWidth,
                                   sy * tileHeight,
                                   tileWidth,
                                   tileHeight,
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
    
    return chunk;
};

level.chunks.get = function(layer, chunkX, chunkY) {
    if (level.chunks[chunkX] && level.chunks[chunkX][chunkY] && level.chunks[chunkX][chunkY][layer.name]) {
        return level.chunks[chunkX][chunkY][layer.name];
    } else {
        return level.chunks.render(layer, chunkX, chunkY);
    }
};