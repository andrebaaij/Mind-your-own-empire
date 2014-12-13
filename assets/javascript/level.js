/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game, Alea, SimplexNoise */

/* jshint loopfunc: true */

var level = {},
    firstNode = {},
    currentNode = {};

level.initialise = function() {
    var _self = this;

    //Interfaces
    game.calculatefog = level.calculatefog;
    game.getChunk = level.getChunk;
    game.getLevel = level.get;
    game.getPath = level.getPath;

    game.variables.tile = {
        width : 64,
        height : 32
    };

    var random = new Alea(game.variables.seed);
    level.simplex = new SimplexNoise(random);

    level.chunks = []; //2d Array

    // Layers
    level.layers = {};

    level.layers.background = {
        name : "background",
        type : "tile",
        visible : true,
        tileset : common.resources.tilesets.get("tiles"),
        size : game.variables.chunk.size,
        data : [],
        generate : function(x, y) {
            function getType(x, y) {
                var n = Math.round(_self.simplex.noise2D(x/150,y/150) * 20)-15;
                n = n > 5 || n < 0 ? 0 : n;

                var result;

                switch(n) {
                    case 0:
                        result = 0;
                        break;
                    case 1:
                        result = 0;
                        break;
                    case 2:
                        result = 5;
                        break;
                    case 3:
                        result = 14;
                        break;
//                    case 4:
//                        result = 5;
//                        break;
//                    case 5:
//                        result = 5;
//                        break;
                    default:
                        result = 14;
                }
                return result;
            }

            /* |TL|TM|TR|
               |ML|MM|MR|
               |BL|BM|BR| */

            var TL = getType(x-1, y-1);
            var TM = getType(x,   y-1);
            var TR = getType(x+1, y-1);
            var ML = getType(x-1, y);
            var MM = getType(x,   y);
            var MR = getType(x+1, y);
            var BL = getType(x-1, y+1);
            var BM = getType(x,   y+1);
            var BR = getType(x+1, y+1);

            //DIRT
            if (MM === 0) {return 0;}

            //SAND TO DIRT
            //outside corners
            if (MM === 5 && ML === 5 && TM === 5 && TL === 0) {return 6;}
            if (MM === 5 && MR === 5 && BM === 5 && BR === 0) {return 7;}
            if (MM === 5 && ML === 5 && BM === 5 && BL === 0) {return 8;}
            if (MM === 5 && MR === 5 && TM === 5 && TR === 0) {return 9;}

            //inside corners
            if (MM === 5 && ML === 0 && TL === 0 && TM === 0) {return 10;}
            if (MM === 5 && MR === 0 && BM === 0 && BR === 0) {return 11;}
            if (MM === 5 && ML === 0 && BM === 0 && BL === 0) {return 12;}
            if (MM === 5 && TM === 0 && TR === 0 && MR === 0) {return 13;}

            //borders
            if (MM === 5 && ML === 0) {return 1;}
            if (MM === 5 && TM === 0) {return 2;}
            if (MM === 5 && BM === 0) {return 3;}
            if (MM === 5 && MR === 0) {return 4;}

            //SAND TO ACID
            //outside corners
            if (MM === 5 && ML === 5 && TM === 5 && TL === 14) {return 29;}
            if (MM === 5 && MR === 5 && BM === 5 && BR === 14) {return 28;}
            if (MM === 5 && ML === 5 && BM === 5 && BL === 14) {return 31;}
            if (MM === 5 && MR === 5 && TM === 5 && TR === 14) {return 30;}

            //inside corners
            if (MM === 5 && ML === 14 && TL === 14 && TM === 14) {return 35;}
            if (MM === 5 && MR === 14 && BM === 14 && BR === 14) {return 34;}
            if (MM === 5 && ML === 14 && BM === 14 && BL === 14) {return 33;}
            if (MM === 5 && TM === 14 && TR === 14 && MR === 14) {return 32;}

            //borders
            if (MM === 5 && ML === 14) {return 39;}
            if (MM === 5 && TM === 14) {return 37;}
            if (MM === 5 && BM === 14) {return 38;}
            if (MM === 5 && MR === 14) {return 36;}
            return MM;
        }
    };
    level.layers.history = {
        name : "history",
        type : "data",
        visible : false,
        tileset : common.resources.tilesets.get("gameTiles"),
        size : game.variables.chunk.size,
        data : [],
        generate : function(x, y) {
            return 1;
        }
    };
    level.layers.calculateFog = {
        name : "calculateFog",
        type : "data",
        visible : false,
        tileset : common.resources.tilesets.get("gameTiles"),
        size : game.variables.chunk.size,
        data : [],
        generate : function(x, y) {
            return 1;
        }
    };
    level.layers.iron = {
        name : "iron",
        type : "resources",
        visible : true,
        tileset : common.resources.tilesets.get("iron"),
        size : game.variables.chunk.size,
        data : [],
        generate : function(x, y) {
            return Math.round((Math.sin(_self.simplex.noise2D(x/50,y/250))-0.40)*15000);
        }
    };
    level.layers.selection = {
        name : "selection",
        type : "selection",
        visible : true,
        size : game.variables.chunk.size
    };
    level.layers.objects = {
        name : "objects",
        type : "objects",
        visible : true,
        size : game.variables.chunk.size
    };
    level.layers.fog = {
        name : "fog",
        type : "tile",
        visible : false,
        tileset : common.resources.tilesets.get("gameTiles"),
        size : game.variables.chunk.size,
        data : [],
        generate : function(x, y) {
            return 1;
        }
    };
};

level.chunk = function(x, y){
    var _self = this;

    _self.x = x;
    _self.y = y;

    _self.size = game.variables.chunk.size;

    _self.layers = {};
    _self.objects = [];
    _self.resources = [];
};

level.chunk.prototype.getLayer = function(layer) {
    var _self = this;

    if (_self.layers[layer.name]) {
        return _self.layers[layer.name];
    } else {
        return _self.createLayer(layer);
    }
};

level.chunk.prototype.createLayer = function(layer) {
    var _self = this;

    _self.layers[layer.name] = {
        data : [],
        tileset : layer.tileset,
        definition : layer,
        resources : [],
        tiles : []
    };

    return _self.layers[layer.name];
};

level.getChunk = function(x, y) {
    if(level.chunks[x] && level.chunks[x][y]) {
        return level.chunks[x][y];
    } else {
        if (!level.chunks[x]) {
            level.chunks[x] = [];
        }
        level.chunks[x][y] = new level.chunk(x, y);
        return level.chunks[x][y];
    }
};

level.get = function() {
    return level.definition;
};

level.getPath = function(object, destination) {
    return [destination];
};

level.calculatefog = function() {
    return;

//    var arrObjects = game.getObjects();
//    var handledObjects = [];
//    var objectsBeingHandled = [];
//
//    arrObjects.forEach(function(object) {
//        if (object.name === 'mind') {
//            objectsBeingHandled.push(object);
//        }
//    });
//
//    var thereAreNewObjectsToBeHandled = true;
//
//    while(thereAreNewObjectsToBeHandled) {
//        thereAreNewObjectsToBeHandled = false;
//
//        objectsBeingHandled.forEach(function(object, index) {
//
//            for(var x = object.grid.x - object.communicationRadius; x <= object.grid.x + object.communicationRadius; x++) {
//                for(var y = object.grid.y - object.communicationRadius; y <= object.grid.y + object.communicationRadius; y++) {
//                    var chunkX = Math.floor(x / game.variables.chunk.size);
//                    var chunkY = Math.floor(y / game.variables.chunk.size);
//
//                    var dx = x % game.variables.chunk.size;
//                    var dy = y % game.variables.chunk.size;
//
//                    if (dx < 0) {
//                        dx = game.variables.chunk.size + dx;
//                    }
//                    if (dy < 0) {
//                        dy = game.variables.chunk.size + dy;
//                    }
//
//                    level.getChunk(chunkX, chunkY).getLayer(level.layers.calculateFog).data[dy * game.variables.chunk.size + dx] = -1;
//                    level.getChunk(chunkX, chunkY).getLayer(level.layers.history).data[dy * game.variables.chunk.size + dx] = 3;
//                }
//            }
//
//            var objectsWithinCommunicationRadius = game.findObject(object.grid.x - object.communicationRadius,
//                                          object.grid.y - object.communicationRadius,
//                                          object.grid.x + object.communicationRadius,
//                                          object.grid.y + object.communicationRadius);
//
//            objectsWithinCommunicationRadius.forEach(function(objectWithinCommunicationRadius) {
//                if (handledObjects.indexOf(objectWithinCommunicationRadius) === -1 && objectsBeingHandled.indexOf(objectWithinCommunicationRadius) === -1 ) {
//                    objectsBeingHandled.push(objectWithinCommunicationRadius);
//                    thereAreNewObjectsToBeHandled = true;
//
//                }
//            });
//
//            handledObjects.push(object);
//            delete objectsBeingHandled[index];
//        });
//    }
//
//
//    for(var x in level.chunks) {
//        if ((!isNaN(parseFloat(x)) && isFinite(x))) {
//            for (var y in level.chunks[x]) {
//                if ((!isNaN(parseFloat(y)) && isFinite(y))) {
//                    var chunk = level.chunks[x][y];
//                    if (!chunk.getLayer(level.layers.calculateFog).data.equals(chunk.getLayer(level.layers.fog).data)) {
//                        chunk.getLayer(level.layers.fog).data.forEach(function(n, i, array) {
//                            array[i] = chunk.getLayer(level.layers.calculateFog).data[i];
//                        });
//                        chunk.drawLayer(chunk.getLayer(level.layers.fog));
//                    }
//                }
//            }
//        }
//    }
};

/**
 * Add resource reference(s) to the level
 * @param   {Object}   resource
 * @returns {Array} Array containing reference objects containing the array and corresponding index to where the resource is added to the resource array
 */
level.addResource = function(resource) {
    var grid = common.getGridFromCoordinates(resource.x, resource.y);

    var references = [];

    var referenceChunk = {},
        referenceChunkLayer = {};

    referenceChunk.array = level.getChunk(grid.chunk.x, grid.chunk.y).resources;
    referenceChunk.index = referenceChunk.array.push(resource);

    referenceChunkLayer.array = level.getChunk(grid.chunk.x, grid.chunk.y).getLayer(level.layers[resource.name]).resources;
    referenceChunkLayer.index = referenceChunkLayer.array.push(resource);

    references.push(referenceChunk);
    references.push(referenceChunkLayer);

    return references;
};

/**
 * Finds resources by grid coordinates
 * @param   {Object} grid common grid coordinates as returned by getGridFrom* functions
 * @returns {Array}  contains all resources which are on the exact same grid position as
 */
level.findResource = function(grid) {
    var resources = [];

    level.getChunk(grid.chunk.x, grid.chunk.y).resources.forEach(function(resource) {
        if (resource.grid.x === grid.x && resource.grid.y === grid.y) {
            resources.push(resource);
        }
    });

    return resources;
};

level.createTile = function(x, y, tileIndex) {
    var coordinates = common.getCoordinatesFromGrid(x, y);

    var tile = {
        tile : tileIndex,
        x : coordinates.x,
        y : coordinates.y
    };

    return tile;
};

level.addTileToChunkLayer = function(chunkLayer, tile) {
    chunkLayer.tiles.push(tile);
};

level.getLayer = function(layername) {
    return level.layers[layername];
};
