/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game, Alea, SimplexNoise */

/* jshint loopfunc: true */

var level = {},
    firstNode = {},
    currentNode = {};

level.initialise = function() {
    var _self = this;

    game.getChunk = level.getChunk;
    game.getLevel = level.get;
    game.getPath = level.getPath;

    data.tile = {
        width : 64,
        height : 32
    };

    var random = new Alea(data.seed);
    level.simplex = new SimplexNoise(random);

    level.chunks = []; //2d Array

    // Layers
    level.layers = {};

    level.layers.background = {
        name : "background",
        type : "tile",
        visible : true,
        tileset : common.resources.tilesets.get("tiles"),
        size : data.chunk.size,
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
    level.layers.iron = {
        name : "iron",
        type : "resources",
        visible : true,
        tileset : common.resources.tilesets.get("iron"),
        size : data.chunk.size,
        data : [],
        generate : function(x, y) {
            return Math.round((Math.sin(_self.simplex.noise2D(x/50,y/250))-0.40)*15000);
        }
    };
    level.layers.selection = {
        name : "selection",
        type : "selection",
        visible : true,
        size : data.chunk.size
    };
    level.layers.objects = {
        name : "objects",
        type : "objects",
        visible : true,
        size : data.chunk.size
    };
    level.layers.fog = {
        name : "fog",
        type : "tile",
        visible : true,
        tileset : common.resources.tilesets.get("tiles"),
        size : data.chunk.size,
        data : [],
        generate : function(x, y) {
            return 49;
        }
    };
};

level.chunk = function(x, y){
    var _self = this;

    _self.x = x;
    _self.y = y;

    _self.size = data.chunk.size;

    _self.layers = {};
    _self.objects = [];
    _self.resources = [];

    for(var i = 0; i < data.chunk.size * data.chunk.size; i++) {
        _self.objects[i] = {
            counter : 0
        };

        _self.resources[i] = {

        };
    }
};

level.chunk.prototype.initialise = function() {
    var _self = this;

    for (var l in level.layers) {
        var layer = level.layers[l];
        _self.createLayer(layer);
    }
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
        data : Array.apply(null, new Array(data.chunk.size*data.chunk.size)).map(Boolean.prototype.valueOf,false),
        tileset : layer.tileset,
        definition : layer,
        resources : [],
        tiles : []
    };

    for (var y = 0; y < data.chunk.size; y++) {
        for (var x = 0; x < data.chunk.size; x++) {
            var i = y * data.chunk.size + x;

            if (layer.name === "fog") {
                data[i] = false;
            }

            if (layer.type === "tile") {
                var tile_index = level.layers[layer.name].generate(
                    _self.x * data.chunk.size + x,
                    _self.y * data.chunk.size + y);

                var tile = level.createTile(
                    _self.x * data.chunk.size + x,
                    _self.y * data.chunk.size + y,
                    tile_index);

                level.addTileToChunkLayer(_self.layers[layer.name], tile);
            } else if (layer.type === "resources") {
                var amount = layer.generate(_self.x * data.chunk.size + x, _self.y * data.chunk.size + y);
                resources.createResource(layer.name, amount, _self.x * data.chunk.size + x, _self.y * data.chunk.size + y);

            }
        }
    }

    return _self.layers[layer.name];
};

level.getChunk = function(x, y) {
    if(level.chunks[x] && level.chunks[x][y]) {
        return level.chunks[x][y];
    } else {
        console.log(x, y);
        if (!level.chunks[x]) {
            level.chunks[x] = [];
        }
        level.chunks[x][y] = new level.chunk(x, y);
        level.chunks[x][y].initialise();
        return level.chunks[x][y];
    }
};

level.get = function() {
    return level.definition;
};

level.getPath = function(object, destination) {
    return [destination];
};

/**
 * Add resource reference(s) to the level
 * @param   {Object}   resource
 * @returns {Array} Array containing reference objects containing the array and corresponding index to where the resource is added to the resource array
 */
level.addResource = function(resource) {
    level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).resources[resource.grid.i][resource.id] = resource;
    level.getChunk(resource.grid.chunk.x, resource.grid.chunk.y).layers[resource.name].resources[resource.grid.i] = resource;
};

/**
 * Finds resources by grid coordinates
 * @param   {Object} grid common grid coordinates as returned by getGridFrom* functions
 * @returns {Array}  contains all resources which are on the exact same grid position as
 */
level.findResource = function(grid) {
    var resources = [];
    var resource_ids = Object.getOwnPropertySymbols(level.getChunk(grid.chunk.x, grid.chunk.y).resources[grid.i]);

    resource_ids.forEach(function(id) {
        resources.push(level.getChunk(grid.chunk.x, grid.chunk.y).resources[grid.i][id]);
    });

    return resources;
};

/**
 * Add resource reference(s) to the level
 * @param   {Object}   resource
 * @returns {Array} Array containing reference objects containing the array and corresponding index to where the resource is added to the resource array
 */
level.addObject = function(object) {
//    var grid = common.getGridFromCoordinates(object.x, object.y);
//
//    var references = [];
//
//    var referenceChunk = {};
//
//    referenceChunk.array = level.getChunk(grid.chunk.x, grid.chunk.y).resources;
//    referenceChunk.index = referenceChunk.array.push(object);
//
//    references.push(referenceChunk);
//
//    return references;
};

/**
 * Finds resources by grid coordinates
 * @param   {Object} grid common grid coordinates as returned by getGridFrom* functions
 * @returns {Array}  contains all resources which are on the exact same grid position as
 */
level.findObjectByGrid = function(grid) {
    var resources = [];

    level.getChunk(grid.chunk.x, grid.chunk.y).resources.forEach(function(resource) {
        if (resource.grid.x === grid.x && resource.grid.y === grid.y) {
            resources.push(resource);
        }
    });

    return resources;
};

/**
 * Finds resources by grid coordinates
 * @param   {Object} grid common grid coordinates as returned by getGridFrom* functions
 * @returns {Array}  contains all resources which are on the exact same grid position as
 */
level.findObjectByGridRange = function(fromGrid, toGrid) {
    var objects = [];

    for(var x = fromGrid.chunk.x; x < toGrid.chunk.x; x++) {
        for(var y = fromGrid.chunk.y; y < toGrid.chunk.y; y++) {
            level.getChunk(x, y).objects.forEach(function(object) {
                objects.push(object);
            });
        }
    }
    return objects;
};

level.createTile = function(x, y, tileIndex) {
    var coordinates = common.getCoordinatesFromGrid(x, y);

    var tile = {
        tile : tileIndex,
        grid : common.getGridFromCoordinates(coordinates.x, coordinates.y),
        x : coordinates.x,
        y : coordinates.y
    };

    return tile;
};

level.addTileToChunkLayer = function(chunkLayer, tile) {
    chunkLayer.tiles[tile.grid.i] = tile;
};

level.getLayer = function(layername) {
    return level.layers[layername];
};
