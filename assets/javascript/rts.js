/*
    

    Styleguide: https://github.com/airbnb/javascript
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest */

/* jshint loopfunc: true */

var game = {
	processes : {
		pause : {
			state : 'inactive'
		},
		scroll : {
			state : "inactive"
		},
        draw : {
            state : "active"
        }
	},
	level : {
        layers : []
	},
	common : {},
	objects : {
        tile : {
            width : 64,
            height : 32,
            /**
             * game.objects.tile.draw() draws a tile
             * from a tileset on the given position
             *
             * @param <game.resources.tileset> tileset
             *      This is the tileset from which to draw a tile
             * @param <integer> tile
             *      This integer is used to calcualte the to be drawn tile,
             *      The first tile is 1, the second is 2 etc... (from left to right, top to bottom)
             * @param <integer> x
             *      The x defines at which grid position the tile should be drawn.
             * @param <integer> y
             *      The y defines at which grid position the tile should be drawn.
             */
            draw : function (tileset, tile, x, y) {
                var sx,
                    sy;
                x = x + tileset.tileOffsetX;
                y = y + tileset.tileOffsetY;
                
                // perform a special calculation when the tile is the last in a tileset row
                // [TODO] probably can be optimized.
                if (tile  % (tileset.width / tileset.tileWidth) === 0) {
                    sx = ((tileset.width / tileset.tileWidth) * tileset.tileWidth)-tileset.tileWidth;
                    sy = (Math.floor(tile / (tileset.width / tileset.tileWidth))-1) * tileset.tileHeight;
                } else {
                    sx = ((tile  % (tileset.width / tileset.tileWidth)) * tileset.tileWidth)-tileset.tileWidth;
                    sy = Math.floor(tile / (tileset.width / tileset.tileWidth)) * tileset.tileHeight;
                }
                game.elements.canvas.context.drawImage(tileset,
                                                       sx,
                                                       sy,
                                                       tileset.tileWidth,
                                                       tileset.tileHeight,
                                                       Math.round(game.level.xOffset) + ((parseInt(x,10) - parseInt(y,10)) * (game.objects.tile.width / 2)),
                                                       Math.round(game.level.yOffset) + ((parseInt(x,10) + parseInt(y,10)) * (game.objects.tile.height / 2)),
                                                       tileset.tileWidth,
                                                       tileset.tileHeight
                                                      );
            }
        },
		window : {},
        mouse : {}
	},
    menu : {
        width : 70
    },
	resources : {
        nbLoaded : 0,
        nbErrors : 0,
        onLoad : function() {
            game.resources.nbLoaded += 1;
        },
        onError : function() {
            game.resources.nbErrors += 1;
        },
		images : {},
        /**
         * game.resources.load() loads all the needed resources (images and tilesets)
         * It is nice to keep this in one place as it will simplify a loading screen in the future.
         *
         */
        load : function() {
            
            /*
                Start
            */
                //[TODO] Draw Loading page
                
            /*
                Define/Load Resources
            */
            game.resources.nbTotal = 7;
            
            game.resources.loadImage("imgHexagon","./assets/images/hexagon.png");
            game.resources.loadImage("imgHoverHexagon","./assets/images/hoverHexagon.png");
            game.resources.loadImage("imgHoverHexagon_error","./assets/images/hoverHexagon_error.png");
            game.resources.loadImage("imgSelectedHexagon","./assets/images/selectedHexagon.png");
            game.resources.loadImage("transport","./assets/images/transport.bmp");
            game.resources.loadImage("tileHover","./assets/images/tileHover.png");
            game.resources.loadImage("house","./assets/images/emptyPlot.png");
            
            game.resources.loadTileset("house","./assets/images/emptyPlot.png",128,144,-4,-3);
            game.resources.loadTileset("immigrant","./assets/images/immigrant.png",64,64,-1,-1);
            
            var definition = game.level.definition;
            
            var tileset;
            
            for (tileset in game.level.definition.tilesets) {
                game.resources.loadTileset(definition.tilesets[tileset].name,definition.tilesets[tileset].image, definition.tilesets[tileset].tilewidth, definition.tilesets[tileset].tileheight, 0, 0);
            }
            
            /*
                End
            */
            
            
        },
        /**
         * game.resources.loadImage() loads an image 
         * based on the passed source parameter
         *
         * @param <String> name
         *      This is the name which will be used to refer to the image, accessible through:
         *          game.resources.images[name]
         * @param <String> source
         *      This is the source of the image, always make it a relative link.
         */
		loadImage : function (name, source) {
            "use strict";
            
			game.resources.images[name] = new Image();
            game.resources.images[name].src = source;
            game.resources.images[name].errors = 0;
            
            if (game.resources.images[name].complete) {
                game.resources.onLoad();
            }
            else {
                game.resources.images[name].addEventListener('load', game.resources.onLoad);
            }
            
            game.resources.images[name].addEventListener('error', function() {
                if (game.resources.images[name].errors < 3) {
                    game.resources.images[name].errors += 1;
                    game.resources.images[name].src = game.resources.images[name].src;
                } else {
                    game.resources.onError();
                }
            });
		},
        tilesets : {},
        /**
         * game.resources.loadTileset() loads a tileset 
         * based on the passed source parameter
         *
         * @param <String> name
         *      This is the name which will be used to refer to the tileset, accessible through:
         *          game.resources.tilesets[name]
         * @param <String> source
         *      This is the source of the image, always make it a relative link.
         * @param <String> tileWidth
         *      This is the width of the tile, ex. 64
         * @param <String> tileHeight
         *      This is the width of the tile, ex. 32
         * @param <String> tileOffsetX
         *      This is the x offset of the tile base defined as in "x" number of tiles.
         * @param <String> tileOffsetY
         *      This is the y offset of the tile base defined as in "y" number of tiles.
         */
        loadTileset : function(name, source, tileWidth, tileHeight, tileOffsetX, tileOffsetY ) {
            game.resources.tilesets[name] = new Image();
            game.resources.tilesets[name].src = source;
            game.resources.tilesets[name].errors = 0;
            game.resources.tilesets[name].tileWidth = tileWidth;
            game.resources.tilesets[name].tileHeight = tileHeight;
            game.resources.tilesets[name].tileOffsetX = tileOffsetX;
            game.resources.tilesets[name].tileOffsetY = tileOffsetY;
            if (game.resources.tilesets[name].complete) {
                game.resources.onLoad();
            }
            else {
                game.resources.tilesets[name].addEventListener('load', game.resources.onLoad);
            }
            
            game.resources.tilesets[name].addEventListener('error', function() {
                if (game.resources.tilesets[name].errors < 3) {
                    game.resources.tilesets[name].errors += 1;
                    game.resources.tilesets[name].src = game.resources.tilesets[name].src;
                } else {
                    game.resources.onError();
                }
            });
        }

	},
    elements : {
        /**
         * game.elements.load() loads all the needed html elements
         */
        load : function() {
            game.elements.add("canvas","canvas");
            game.elements.add("pause","pause");
            game.elements.add("pause_continue","pause_continue");
            game.elements.add("pause_fullscreen","pause_fullscreen");
            game.elements.add("menu_pause","menu_pause");
            game.elements.add("menu_build_road","menu_build_road");
            game.elements.add("menu_build_house","menu_build_house");
            game.elements.add("menu_destroy","menu_destroy");
            game.elements.add("mainMenu_newGame","mainMenu_newGame");
            game.elements.add("game","game");
            game.elements.add("mainMenu","mainMenu");
        },
        /**
         * game.elements.add() adds a new element based on its id
         * @param <String> name
         *      This is the name which will be used to refer to the element, accessible through:
         *          game.elements[name]
         * @param <String> id
         *      This is the id of the html element, remember that an id should always be unique on a html page.
         */
        add : function(name, id) {
            game.elements[name] = document.getElementById(id);
        }
    },
    variables : {
        scroll : {
            speed: 2, //pixels
            margin: 100, //pixels
            interval: 10 //milliseconds
        },
        selection : {
            objects : [],
            build_object : null
        },
        hover : {},
        draw : {
            interval: 16.666
        },
        events : {
            mousedown : false
        },
        population : {
            total : 0,
            housing : 0,
            immigrants : 0,
            emigrants : 0
        },
        lastObjectId : 0
    }
};

/**
 * game.common.calculateWindowSize() calculates the current window size
 */
game.common.calculateWindowSize = function () {
    "use strict";
	game.objects.window.width = 630;
	game.objects.window.height = 460;
	if (document.body && document.body.offsetWidth) {
		game.objects.window.width = document.body.offsetWidth;
		game.objects.window.height = document.body.offsetHeight;
	}
	if (document.compatMode === 'CSS1Compat' && document.documentElement && document.documentElement.offsetWidth) {
		game.objects.window.width = document.documentElement.offsetWidth;
		game.objects.window.height = document.documentElement.offsetHeight;
	}
	if (window.innerWidth && window.innerHeight) {
		game.objects.window.width = window.innerWidth;
		game.objects.window.height = window.innerHeight;
	}
};

/**
 * game.common.getMousePosition() returns the current mouse position
 * based on a mouse event
 *
 * @param <Event> event
 *    This must be a mouse event.
 * @return <Object> {x : x, y : y}
 */
game.common.getMousePosition = function (event) {
    "use strict";
	var rect = game.elements.canvas.getBoundingClientRect();

	return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
	};
};

/**
 * game.common.pause() pauses the game, pauses all active processes and shows the pause menu
 */
game.common.pause = function() {
	if (game.processes.pause.state === 'inactive') {
        var oProcess;
        
		for (var process in game.processes) {
			oProcess = game.processes[process].state;

			if (oProcess === "active") {
				oProcess = "pause";
			}
		}
		game.elements.pause.style.display = "block";
		game.processes.pause.state = 'active';
	}
};

/**
 * game.common.unpause() unpauses the game, reactivates paused processes and hides the pause menu
 */
game.common.unpause = function() {
    var oProcess;
    
	if (game.processes.pause.state === 'active') {
		for (var process in game.processes) {
			oProcess = game.processes[process].state;

			if (oProcess === "pause") {
				oProcess = "active";
			}
		}
		game.elements.pause.style.display = "none";
		game.processes.pause.state = 'inactive';
        
        if(game.processes.draw.state === "inactive") {
            game.processes.draw.state = "active";
            game.level.draw();
        }
	}
};

/**
 * game.common.isPaused() returns the current "pause" state of the game
 * @return <Boolean> isPaused
 */
game.common.isPaused = function() {
	if (game.processes.pause.state === 'active') {
		return true;
	} else {
		return false;
	}
};

/**
 * game.common.getJSONFromURI() returns the result of the passedURI parsed to JSON
 * based on a mouse event
 *
 * @param <String> URI
 * @return <Object> response
 */
game.common.getJSONFromURI = function(URI) {
    var request = new XMLHttpRequest();
    request.open('GET', URI, false);
    request.send(null);
    if (request.status == 200) {
        return JSON.parse(request.responseText);
    }
};

/**
 * game.common.initialiseObjects() In this function most game.objects are initialised, just to keep them easily in one place.
 */
game.common.initialiseObjects = function() {
    //Example object
    
    /* 
      game.objects.objectName = {
        tile : 1, // <integer> Which tile to draw
        tileset : game.resources.tilesets.house, // <game.resources.tileset> From which tileset to draw
        width : 2, // <integer> the base width of the object in n tiles
        height : 2, // <integer> the base width of the object in n tiles
        index : 0, // <integer>
        drawGrid : true, // When this object is the buildObject, should the grid be drawn?
        //**
         * game.common.getJSONFromURI() returns the result of the passedURI parsed to JSON
         * based on a mouse event
         *
         * @param <String> URI
         * @return <Object> response
         //
        create : function(x, y) {
            var object = {
                name : "house",
                tile : 1,
                tileset : game.resources.tilesets.house,
                isSelectable : true,
                isSelected : false,
                isMovable : false,
                isMoving : false,
                zIndex : 1,
                id : game.common.assignObjectId(),
                x : x,
                y : y,
                baseLeft : -1,
                baseRight : 1,
                baseTop : -1,
                width : 2,
                height : 2,
                population : 0,
                housing : 5,
                destroy : function() {
                    game.level.layers[this.zIndex][this.x][this.y].destroyObject(this);
                    game.level.layers[this.zIndex][this.x-1][this.y].destroyObject(this);
                    game.level.layers[this.zIndex][this.x][this.y-1].destroyObject(this);
                    game.level.layers[this.zIndex][this.x-1][this.y-1].destroyObject(this);
                }
            };
            
            object.index = object.id;
            
            if (game.level.layers[object.zIndex][x][y].objects.length === 0 && 
                    game.level.layers[object.zIndex][x-1][y].objects.length === 0 &&
                    game.level.layers[object.zIndex][x][y-1].objects.length === 0 &&
                    game.level.layers[object.zIndex][x-1][y-1].objects.length === 0) {
                
                game.variables.population.housing += 5;
                game.variables.immigrantSpawner.spawn(1);
                game.level.layers[object.zIndex][x][y].addObject(object);
                game.level.layers[object.zIndex][x-1][y].addObject(object);
                game.level.layers[object.zIndex][x][y-1].addObject(object);
                game.level.layers[object.zIndex][x-1][y-1].addObject(object);
                return object;         
            } else {
                return null;
            }
        }
    };
      
        
        
        }
    
    */ 
    
    
    game.objects.road = {
        tile : 11,
        tileset : game.resources.tilesets.tiles,
        width : 1,
        height : 1,
        index : 0,
        drawGrid : true,
        create : function(x, y) {
            
            var object = {
                name : "road",
                tile : 11,
                tileset : game.resources.tilesets.tiles,
                isSelectable : false,
                isSelected : false,
                isMovable : false,
                isMoving : false,
                zIndex : 1,
                id : game.common.assignObjectId(),
                x : x,
                y : y,
                baseLeft : 0,
                baseRight : 0,
                baseTop : 0,
                width : 1,
                height : 1,
                destroy : function() {
                    game.level.layers[this.zIndex][this.x][this.y].destroyObject(this);
                }
            };
            
            object.index = -1 * object.id;
            
            if (game.level.layers[object.zIndex][x][y].objects.length === 0) {
                game.level.layers[object.zIndex][x][y].addObject(object);
                return object;         
            } else {
                return null;
            }
        }
    };

    game.objects.defaultRoad = {
        tile : 11,
        tileset : game.resources.tilesets.tiles,
        width : 1,
        height : 1,
        index : 0,
        drawGrid : false,
        create : function(x, y) {
            var object = {
                name : "defaultRoad",
                tile : 11,
                tileset : game.resources.tilesets.tiles,
                isSelectable : false,
                isSelected : false,
                isMovable : false,
                isMoving : false,
                zIndex : 1,
                id : game.common.assignObjectId(),
                x : x,
                y : y,
                baseLeft : 0,
                baseRight : 0,
                baseTop : 0,
                width : 1,
                height : 1
            };
            
            object.index = -1*object.id;
            
            if (game.level.layers[object.zIndex][x][y].objects.length === 0) {
                game.level.layers[object.zIndex][x][y].addObject(object);
                return object;         
            } else {
                return null;
            }
        }
    };
    
    game.objects.house = {
        tile : 1,
        tileset : game.resources.tilesets.house,
        width : 2,
        height : 2,
        index : 0,
        drawGrid : true,
        create : function(x, y) {
            var object = {
                name : "house",
                tile : 1,
                tileset : game.resources.tilesets.house,
                isSelectable : true,
                isSelected : false,
                isMovable : false,
                isMoving : false,
                zIndex : 1,
                id : game.common.assignObjectId(),
                x : x,
                y : y,
                baseLeft : -1,
                baseRight : 1,
                baseTop : -1,
                width : 2,
                height : 2,
                population : 0,
                housing : 5,
                destroy : function() {
                    game.level.layers[this.zIndex][this.x][this.y].destroyObject(this);
                    game.level.layers[this.zIndex][this.x-1][this.y].destroyObject(this);
                    game.level.layers[this.zIndex][this.x][this.y-1].destroyObject(this);
                    game.level.layers[this.zIndex][this.x-1][this.y-1].destroyObject(this);
                }
            };
            
            object.index = object.id;
            
            if (game.level.layers[object.zIndex][x][y].objects.length === 0 && 
                    game.level.layers[object.zIndex][x-1][y].objects.length === 0 &&
                    game.level.layers[object.zIndex][x][y-1].objects.length === 0 &&
                    game.level.layers[object.zIndex][x-1][y-1].objects.length === 0) {
                
                game.variables.population.housing += 5;
                game.variables.immigrantSpawner.spawn(1);
                game.level.layers[object.zIndex][x][y].addObject(object);
                game.level.layers[object.zIndex][x-1][y].addObject(object);
                game.level.layers[object.zIndex][x][y-1].addObject(object);
                game.level.layers[object.zIndex][x-1][y-1].addObject(object);
                return object;         
            } else {
                return null;
            }
        }
    };

    game.objects.destroy = {
        tile : 94,
        tileset : game.resources.tilesets.tiles,
        width : 1,
        height : 1,
        index : 0,
        drawGrid : true,
        isCreateable : true,
        isDestroyable : false,
        create : function(x, y) {
            var destroy = {
                name : "destroy",
                tile : 94,
                tileset : game.resources.tilesets.tiles,
                isSelectable : false,
                isSelected : false,
                isMovable : false,
                isMoving : false,
                zIndex : 1,
                x : x,
                y : y
            };
            
            var oLen = game.level.layers[destroy.zIndex][x][y].objects.length;
            for (var o = 0; o < oLen; ++o) {
                var object = game.level.layers[destroy.zIndex][x][y].objects[o];
                if (object.destroy) {
                    object.destroy();
                }    
            } 
            
            return null;
        }
    };
    
    game.objects.immigrantSpawner = {
        create : function(x,y) {
            var object = {
                x : x,
                y : y,
                name : "immigrantSpawner",
                spawn : function(n) {
                    if (typeof n === 'undefined') {
                        n = 1;
                    }
                    
                    for(var i = 0; i < n; ++i) {
                        game.objects.immigrant.create(this.x,this.y);
                    }
                }
            };
            
            game.variables.immigrantSpawner = object;
            //game.level.layers[1][x][y].addObject(object);
        }
    };
    
    game.objects.immigrant = {
        create : function(x,y) {            
            var object = {
                name : "immigrant",
                x : x,
                y : y,
                zIndex : 2,
                tile : 1,
                width : 1,
                height : 1,
                tileset : game.resources.tilesets.immigrant,
                id : game.common.assignObjectId(),
                isSelectable : true,
                isSelected : false,
                isMovable : false,
                isMoving : false
            };
            
            
            object.index = object.id;
            
            game.variables.population.immigrants += 3;
            
            game.level.layers[object.zIndex][x][y].addObject(object);
            return object;
        }
    };
    
    game.objects.select = {
        tile : 91,
        tileset : game.resources.tilesets.tiles,
        width : 1,
        height : 1,
        index : 0,
        drawGrid : false
    };
};

/**
 * game.common.arraySort() This function can be passed to an array.sort(game.common.arraySort), it sorts based on the passed property.
  * @param <String> property
  *     The property which will be used to sort the array.
 */
game.common.arraySort = function(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    };
};

/**
 * game.common.assignObjectId() It returns a new unique object id
 */
game.common.assignObjectId = function() {
    var id = game.variables.lastObjectId += 1;
    return id;
};

/**
 * game.level.draw() All the drawing is done in this function
 */
game.level.draw = function() {
	game.elements.canvas.context.clearRect(0, 0, game.elements.canvas.width, game.elements.canvas.height);
	game.elements.canvas.context.fillStyle = "#143c2f";
	game.elements.canvas.context.fillRect(0,0,game.elements.canvas.width, game.elements.canvas.height);
    
    var layer,
        x,
        lenX,
        y,
        lenY,
        tile,
        object,
        xStart,
        xEnd,
        yStart,
        yEnd;
    
    /*
        When a player clicks and drags multiple build objects should be drawn, in order to do this easily the correct start and end are calculated
    */
    if (typeof game.variables.selection.xStart === 'undefined' || game.variables.selection.xStart === null) {
        xStart = Math.floor(game.variables.hover.x);
        xEnd = Math.floor(game.variables.hover.x);
    }
    else if (game.variables.selection.xStart < game.variables.hover.x) {
        xStart = game.variables.selection.xStart;
        xEnd = Math.floor(game.variables.hover.x);
    } else {
        xStart = Math.floor(game.variables.hover.x);
        xEnd = game.variables.selection.xStart;
    }
    
    if (typeof game.variables.selection.yStart === 'undefined' || game.variables.selection.yStart === null) {
        yStart = Math.floor(game.variables.hover.y);
        yEnd = Math.floor(game.variables.hover.y);
    }
    else if (game.variables.selection.yStart < game.variables.hover.y) {
        yStart = game.variables.selection.yStart;
        yEnd = Math.floor(game.variables.hover.y);
    } else {
        yStart = Math.floor(game.variables.hover.y);
        yEnd = game.variables.selection.yStart;
    }

    
    
    // loop through all layers, and draw all objects and tiles
    var lenLayer = game.level.layers.length;

    for (layer = 0; layer < lenLayer; ++layer) {
        lenX = game.level.layers[layer].length;
        for (x=0;x<lenX; ++x) { 
            lenY = game.level.layers[layer][x].length;
            for (y=0;y<lenY; ++y) {
                
                // Which tile to draw?
                if(game.level.layers[layer].name === "grid" && game.variables.selection.build_object.drawGrid) {  
                    if (x == game.level.layers[layer].length-1 || y == game.level.layers[layer][x].length-1) {
                        tile = 92;
                    } else {
                        tile = 93;
                    }
                } else {
                    tile = game.level.layers[layer][x][y].tile;
                }
                
                
                //draw tile
                if (tile !== 0) {
                    game.objects.tile.draw(game.resources.tilesets.tiles,tile,x,y);
                }
                
                // draw all objects with an index below 0
                var oLen = game.level.layers[layer][x][y].lowDrawStack.length;
                for(var o = 0; o< oLen; ++o) {
                    object = game.level.layers[layer][x][y].lowDrawStack[o];
                    
                    if (typeof object.tileset !== 'undefined' || typeof object.tile !== 'undefined' || object.tile !== 0) {
                        game.objects.tile.draw(object.tileset,object.tile,x,y);
                    }
                }
                
                
                // draw build object on index 0
                if (layer === 1 && game.variables.selection.build_object && xStart <= x && x <= xEnd && yStart <= y && y <= yEnd && (x-xStart) % game.variables.selection.build_object.width === 0 && (y-yStart) % game.variables.selection.build_object.height === 0) {
                    
                    game.elements.canvas.context.save();
                    game.elements.canvas.context.globalAlpha = 0.7;
                    object = game.variables.selection.build_object;
                    
                    game.objects.tile.draw(object.tileset,object.tile,x,y);
                    
                    game.elements.canvas.context.restore();
                    
                }
                
                // draw all objects with an index above 0
                oLen = game.level.layers[layer][x][y].highDrawStack.length;
                for(o = 0; o< oLen; ++o) {
                    object = game.level.layers[layer][x][y].highDrawStack[o];
                    
                    
                    if (typeof object.tileset !== 'undefined' || typeof object.tile !== 'undefined' || object.tile !== 0) {
                        game.objects.tile.draw(object.tileset,object.tile,x,y);
                    }
                }
                
            }
        }
    }
    
    
    //selection
    
    
     //else {
    //   game.objects.tile.draw(img,91,game.variables.hover.x,game.variables.hover.y);
    //}

    
    if(game.processes.draw.state === "active") {
        setTimeout(game.level.draw, game.variables.draw.interval);
    }
};

/**
 * game.level.draw() All the drawing is done in this function
 */
game.level.scroll = function() {
    "use strict";
	if (game.common.isPaused()) return;
    
	game.level.xOffset += game.variables.scroll.x * game.variables.scroll.speed;
	game.level.yOffset -= game.variables.scroll.y * game.variables.scroll.speed;

    if (game.level.xOffset <= 0) {
        if ((game.level.width*game.objects.tile.width/2) - (game.level.xOffset * -1 + game.objects.window.width) < -1* game.level.margin.right) {
            game.level.xOffset = -1 * ((game.level.width*game.objects.tile.width/2) - game.objects.window.width) - game.level.margin.right;
        }
    } else {
        if (game.objects.window.width - (game.level.xOffset + (game.level.width*game.objects.tile.width/2)) > game.level.margin.right) {
            game.level.xOffset = game.objects.window.width - (game.level.width*game.objects.tile.width/2) -  game.level.margin.right;
        }
    }
    
    if (game.level.xOffset - (game.level.width*game.objects.tile.width/2) > game.level.margin.left) {
		game.level.xOffset = (game.level.width*game.objects.tile.width/2) + game.level.margin.left;
	}
    
	if ((game.level.height*game.objects.tile.height)-(game.level.yOffset*-1 + game.objects.window.height) < -1 * game.level.margin.bottom) {
		game.level.yOffset = -1 * ((game.level.height*game.objects.tile.height) - game.objects.window.height) - game.level.margin.bottom;
	}

    if (game.level.yOffset > game.level.margin.top) {
		game.level.yOffset = game.level.margin.top;
	}
    
	if(game.processes.scroll.state === "active") {
		setTimeout(game.level.scroll, game.variables.scroll.interval);
	}
};

/**
 * game.level.load() loads the level based on the level definition from a .json file saved from the tool tiled (http://www.mapeditor.org/)
 */
game.level.load = function() {
    var definition = game.level.definition;
    
    game.level.xOffset = (game.elements.canvas.width / 2);
    game.level.yOffset = (game.elements.canvas.height / 2);
    
    var layer,
        x = 0,
        y = 0,
        tileset,
        layerLen = definition.layers.length,
        addObject = function(layer, x, y, object) {
            game.level.layers[layer][x][y].objects.push(object);
            //game.level.layers[layer][x][y].objects.sort(game.common.arraySort("index"));
        };
    
    
    
    for(var iLayer = 0; iLayer < layerLen; ++iLayer) {
        
        
        if (typeof definition.layers[iLayer].data !== 'undefined') {
            
            var arrayX = [];
            arrayX.length = definition.width;
            layer = game.level.layers.push(arrayX) -1;
            game.level.layers[layer].name = definition.layers[iLayer].name;
            for (x = 0; x < definition.width; x++) {
                game.level.layers[layer][x] = [definition.height];
                
                for (y = 0; y < definition.height; y++) {
                    game.level.layers[layer][x][y] = {
                        tile : definition.layers[iLayer].data[y*definition.width + x],
                        x : x,
                        y : y,
                        addObject : addObject = function(object) {
                            this.objects.push(object);
                            
                            if (this.x === object.x && this.y === object.y) {
                                
                                if(object.index < 0) {
                                    this.lowDrawStack.push(object);
                                    this.lowDrawStack.sort(game.common.arraySort("index"));
                                } else  {
                                    this.highDrawStack.push(object);
                                    this.highDrawStack.sort(game.common.arraySort("index"));
                                }
                            }
                        },
                        objects : [],
                        lowDrawStack : [],
                        highDrawStack : [],
                        destroyObject : function(object) {
                            var oLen = this.objects.length,
                                hdLen = this.highDrawStack.length,
                                ldLen = this.lowDrawStack.length,
                                i;
                            
                            for (i = 0; i < oLen; ++i) {
                                if (this.objects[i].id === object.id) {
                                    this.objects.splice(i,1);
                                }
                            }
                            
                            for (i = 0; i < hdLen; ++i) {
                                if (this.highDrawStack[i].id === object.id) {
                                    this.highDrawStack.splice(i,1);
                                }
                            }
                            
                            for (i = 0; i < ldLen; ++i) {
                                if (this.lowDrawStack[i].id === object.id) {
                                    this.lowDrawStack.splice(i,1);
                                }
                            }
                        }
                    };
                }
            }
        } else if (typeof definition.layers[iLayer].objects !== 'undefined') {
            var oLen = definition.layers[iLayer].objects.length;
            for (var o = 0; o < oLen; ++o) {
                var object = definition.layers[iLayer].objects[o];
                if (game.objects[object.type].create) {
                    game.objects[object.type].create(object.x/object.width,object.y/object.height);
                }
            }
        }
        
    }
    
    
    game.level.width = definition.width;
    game.level.height = definition.height;
    
    for (tileset in definition.tilesets) {
        game.resources.loadTileset(definition.tilesets[tileset].name,definition.tilesets[tileset].image, definition.tilesets[tileset].tilewidth, definition.tilesets[tileset].tileheight, 0, 0);
    }
    
    //game.level.tilesets = definition.tilesets;
    

};

/**
 * game.level.initialise() initialises all assets of the game.
 */
game.initialise = function () {
    "use strict";
    var levelURI = "./maps/test.json";
    game.level.definition = game.common.getJSONFromURI(levelURI);
    
    game.resources.load();
    game.elements.load();
	game.common.calculateWindowSize();
    game.common.initialiseObjects();
    game.level.load();
    game.variables.selection.build_object = game.objects.select;
    
    game.elements.canvas.context = game.elements.canvas.getContext("2d");
	game.elements.canvas.width=game.objects.window.width;
	game.elements.canvas.height=game.objects.window.height;

	game.level.margin = {
		left: 100,
		right: 100,
		top: 100,
		bottom: 100
	};
    
    game.level.draw();
	
};


// Initialise Game
game.initialise();


// Bind all events
game.elements.canvas.addEventListener('mousemove', function(evt) {
    "use strict";
    
    var canvas = game.elements.canvas,
        mouse = game.common.getMousePosition(evt),
        speed;

    game.objects.mouse.x = mouse.x;
    game.objects.mouse.y = mouse.y;
	if (mouse.x < game.variables.scroll.margin + game.menu.width) {
		if (mouse.x - game.menu.width === 0) game.variables.scroll.x = 1; //infinity
		else game.variables.scroll.x = 1 / (mouse.x - game.menu.width);
	} else if (mouse.x >= canvas.width - game.variables.scroll.margin) {
		speed = (canvas.width-mouse.x);
		if (speed === 0) game.variables.scroll.x = -1; //infinity
		else game.variables.scroll.x = -1 / speed;
	} else {
		game.variables.scroll.x = 0;
	}

	if (mouse.y < game.variables.scroll.margin) {
		if (mouse.y === 0) game.variables.scroll.y = -1; //infinity
		else game.variables.scroll.y = -1 / mouse.y;
		if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
	} else if (mouse.y >= canvas.height - game.variables.scroll.margin) {
		speed =  (canvas.height-mouse.y);
        
		if (speed === 0) {
            game.variables.scroll.y = 1; //infinity
        } else {
            game.variables.scroll.y = 1 / speed;
        }

		if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
	} else {
		game.variables.scroll.y = 0;
		if (game.variables.scroll.x === 0) {
			game.processes.scroll.state = "inactive";
		} else if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
	}
    
    mouse.x = mouse.x - game.level.xOffset - (game.objects.tile.width/2);
    mouse.y = mouse.y - game.level.yOffset;
    
    game.variables.hover.x = ((mouse.x) / (game.objects.tile.width/2) + (mouse.y) / (game.objects.tile.height/2)) /2;
    game.variables.hover.y = ((mouse.y) / (game.objects.tile.height/2) - (mouse.x) / (game.objects.tile.width/2) ) /2;
    
    if (game.variables.selection.build_object) {
        if (game.variables.hover.x < 0 + game.variables.selection.build_object.width) {
            game.variables.hover.x = game.variables.selection.build_object.width - 1;
        } else if (game.variables.hover.x >= game.level.width - game.variables.selection.build_object.width+1) {
            game.variables.hover.x = game.level.width-1;
        }
        
        if (game.variables.hover.y < 0 + game.variables.selection.build_object.height) {
            game.variables.hover.y = 0 + game.variables.selection.build_object.height-1;
        } else if (game.variables.hover.y >= game.level.height - game.variables.selection.build_object.height+1) {
            game.variables.hover.y = game.level.height-1;
        }
        
    } else {
        if (game.variables.hover.x< 0) {
            game.variables.hover.x = 0;
        } else if (game.variables.hover.x >= game.level.width) {
            game.variables.hover.x = game.level.width-1;
        }
        
        if (game.variables.hover.y< 0) {
            game.variables.hover.y = 0;
        } else if (game.variables.hover.y >= game.level.height) {
            game.variables.hover.y = game.level.height-1;
        }
    }
}, false);

game.elements.canvas.addEventListener("mouseup", function () {
    game.variables.events.mousedown = false;
    
    var xStart,
        xEnd,
        yStart,
        yEnd;
    
    /*
        When a player clicks and drags multiple build objects should be drawn, in order to do this easily the correct start and end are calculated
    */
    if (typeof game.variables.selection.xStart === 'undefined') {
        xStart = Math.floor(game.variables.hover.x);
        xEnd = Math.floor(game.variables.hover.x);
    }
    else if (game.variables.selection.xStart < game.variables.hover.x) {
        xStart = game.variables.selection.xStart;
        xEnd = Math.floor(game.variables.hover.x);
    } else {
        xStart = Math.floor(game.variables.hover.x);
        xEnd = game.variables.selection.xStart;
    }
    
    if (typeof game.variables.selection.yStart === 'undefined') {
        yStart = Math.floor(game.variables.hover.y);
        yEnd = Math.floor(game.variables.hover.y);
    }
    else if (game.variables.selection.yStart < game.variables.hover.y) {
        yStart = game.variables.selection.yStart;
        yEnd = Math.floor(game.variables.hover.y);
    } else {
        yStart = Math.floor(game.variables.hover.y);
        yEnd = game.variables.selection.yStart;
    }
    
    for (var x = xStart; x <= xEnd; ++x) {
        for (var y = yStart; y <= yEnd; ++y) {
            if (game.variables.selection.build_object && (x-xStart) % game.variables.selection.build_object.width === 0 && (y-yStart) % game.variables.selection.build_object.height === 0) {
                    
                // build all objects
                if (game.variables.selection.build_object !== null && game.variables.selection.build_object.create) {
                    var buildObject = game.variables.selection.build_object;
                    buildObject.create(x,y);
                }
                    
            }
        }
    }
    
    game.variables.selection.xStart = null;
    game.variables.selection.yStart = null;
});

game.elements.canvas.addEventListener("mousedown", function() {
    game.variables.events.mousedown = true;
    
    game.variables.selection.xStart = Math.floor(game.variables.hover.x);
    game.variables.selection.yStart = Math.floor(game.variables.hover.y);
});

game.elements.canvas.addEventListener ("mouseout", function() {
		if (game.variables.scroll.x > 0) {
			game.variables.scroll.x = 1;
		} else if (game.variables.scroll.x < 0) {
			game.variables.scroll.x = -1;
		}

		if (game.variables.scroll.y > 0) {
			game.variables.scroll.y = 1;
		} else if (game.variables.scroll.y < 0) {
			game.variables.scroll.y = -1;
		}
		game.processes.scroll.state = "active";
		game.variables.hover.q = null;
		game.level.scroll();
    }, false);

game.elements.pause_continue.addEventListener("click", function() {
	game.common.unpause();
}, false);

game.elements.menu_pause.addEventListener("click", function() {
    game.common.pause();
});

game.elements.pause_fullscreen.onclick = function() {
    var pfx = ["webkit", "moz", "ms", "o", ""];
    function RunPrefixMethod(obj, method) {
        
        var p = 0, m, t;
        while (p < pfx.length && !obj[m]) {
            m = method;
            if (pfx[p] === "") {
                m = m.substr(0,1).toLowerCase() + m.substr(1);
            }
            m = pfx[p] + m;
            t = typeof obj[m];
            if (t != "undefined") {
                pfx = [pfx[p]];
                return (t == "function" ? obj[m]() : obj[m]);
            }
            p++;
        }
    
    }
        
	if (RunPrefixMethod(document, "FullScreen") || RunPrefixMethod(document, "IsFullScreen")) {
		RunPrefixMethod(document, "CancelFullScreen");
	}
	else {
		RunPrefixMethod(document.getElementById("wrapper"), "RequestFullScreen");
	}
};

document.onkeydown = function(evt) {
    evt = evt || window.event;
    
    switch(evt.keyCode){
    case 27: // Escape
        game.variables.selection.objects = [];
        game.variables.selection.build_object = game.objects.select;
            
        if (game.common.isPaused()) {
            game.common.unpause();
        }
        break;
    case 80: // P = Pause
        if (game.common.isPaused()) {
            game.common.unpause();
        } else {
            game.common.pause();
        }
        break;
    case 68:  //d
        game.variables.scroll.x = -1;
        if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
        break;
    case 83:  //s
        game.variables.scroll.y = 1;
        if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
        break;
    case 65: //a
        game.variables.scroll.x = 1;
        if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
        break;
    case 87: //w
        game.variables.scroll.y = -1;
        if (game.processes.scroll.state !== "active") {
			game.processes.scroll.state = "active";
			game.level.scroll();
		}
        break;
    }
    
};

document.onkeyup = function(evt) {
    evt = evt || window.event;
    
    switch(evt.keyCode){
    case 68:  //d
        if (game.processes.scroll.state === "active") {
			game.variables.scroll.x = 0;
		}
        break;
    case 83:  //s
        if (game.processes.scroll.state === "active") {
			game.variables.scroll.y = 0;
		}
        break;
    case 65: //a
        if (game.processes.scroll.state === "active") {
			game.variables.scroll.x = 0;
		}
        break;
    case 87: //w
        if (game.processes.scroll.state === "active") {
			game.variables.scroll.y = 0;
		}
        break;
    }
    
};

window.addEventListener("resize", function() {
	game.common.calculateWindowSize();
	game.elements.canvas.width=game.objects.window.width;
	game.elements.canvas.height=game.objects.window.height;
});

game.elements.menu_build_road.addEventListener("click", function() {
    if (game.variables.selection.build_object === game.objects.road) {
        game.variables.selection.build_object = game.objects.select;
    } else {
        game.variables.selection.build_object = game.objects.road;
    }
});

game.elements.menu_build_house.addEventListener("click", function() {
    if (game.variables.selection.build_object === game.objects.house) {
        game.variables.selection.build_object = game.objects.select;
    } else {
        game.variables.selection.build_object = game.objects.house;
    }
});

game.elements.menu_destroy.addEventListener("click", function() {
    if (game.variables.selection.build_object === game.objects.destroy) {
        game.variables.selection.build_object = game.objects.select;
    } else {
        game.variables.selection.build_object = game.objects.destroy;
    }
});

game.elements.mainMenu_newGame.addEventListener("click", function() {
    game.elements.mainMenu.style.display = "none";
    game.elements.game.style.display = "block"; 
});