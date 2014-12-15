/* global contextGL,resources,Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

/* jshint loopfunc: true */

var draw = {};

draw.initialise = function () {
    var _self = this;

    _self.gameTiles = common.resources.tilesets.get('gameTiles');
    _self.actionTiles = common.resources.tilesets.get('actions');
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
    var _self = this;

    var x,
        y,
        tileset,
        tilewidth,
        tileheight,
        tilesPerRow,
        tileIndex;

    // Clear canvas

    var canvasWidth = common.scaleNumber(canvas.width, true);
    var canvasHeight = common.scaleNumber(canvas.height, true);

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var scale = common.scaleNumber(1);
    contextGL.scale(canvas.context, scale);
    contextGL.translate(canvas.context, canvas.xOffset, canvas.yOffset);

    // Assign tileset data to variables for easy use.
    var chunkSize = game.variables.chunk.size;
    var offsetsLT = common.getGridFromScreen(canvas, 0, 0);
    var offsetsRT = common.getGridFromScreen(canvas, canvasWidth, 0);
    var offsetsLB = common.getGridFromScreen(canvas, 0, canvasHeight);
    var offsetsRB = common.getGridFromScreen(canvas, canvasWidth, canvasHeight);

    var chunkXOffset = Math.min(offsetsLT.chunk.x, offsetsRT.chunk.x, offsetsLB.chunk.x, offsetsRB.chunk.x);
    var chunkYOffset = Math.min(offsetsLT.chunk.y, offsetsRT.chunk.y, offsetsLB.chunk.y, offsetsRB.chunk.y);
    var maxChunkXOffset = Math.max(offsetsLT.chunk.x, offsetsRT.chunk.x, offsetsLB.chunk.x, offsetsRB.chunk.x);
    var maxChunkYOffset = Math.max(offsetsLT.chunk.y, offsetsRT.chunk.y, offsetsLB.chunk.y, offsetsRB.chunk.y);
    tilewidth = game.variables.tile.width;
    tileheight = game.variables.tile.height;


    for (var l in level.layers) {
        var layer = level.layers[l];
        if (layer.visible === false) {
            continue;
        }

        if (layer.type === 'tile') {
            tilewidth = game.variables.tile.width;
            tileheight = game.variables.tile.height;

            for (y = chunkYOffset; y <= maxChunkYOffset; y++) {
                for (x = chunkXOffset; x <= maxChunkXOffset; x++) {
                    //level.getChunk(x,y).drawLayer(layer);

                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    if(chunkLayer.data.equals([])) {
                        // GENERATE
                        if (layer.generate) {
                            for (var dataY = 0; dataY < chunkSize; dataY++) {
                                for (var dataX = 0; dataX < chunkSize; dataX++) {
                                    var i = (dataY * chunkSize + dataX);
                                    tileIndex = layer.generate(x * chunkSize + dataX, y * chunkSize + dataY);
                                    var tile = level.createTile(x * chunkSize + dataX, y * chunkSize + dataY, tileIndex)
                                    level.addTileToChunkLayer(chunkLayer, tile);
                                }
                            }
                        }
                        chunkLayer.data = [1];
                    }

                    chunkLayer.tiles.forEach( function(tile) {
                        contextGL.drawTile(canvas.context,
                            layer.tileset,
                            tile.x - tilewidth/2,
                            tile.y - tileheight/2,
                            tile.tile,
                            tile
                        );
                    });

//                    for (var i = 0; i < layer.size * layer.size; i++) {
//                        if (0 <= chunkLayer.data[i] && chunkLayer.data[i] < layer.tileset.nbTiles) {
//                            var cx = i % layer.size;
//                            var cy = (i - cx) / layer.size;
//
//                            canvas.context.drawImage(layer.tileset,
//                                Math.round(((cx+(x*chunkSize))-(cy+(y*chunkSize)))*0.5*tilewidth),
//                                Math.round(((cx+(x*chunkSize))+(cy+(y*chunkSize)))*0.5*tileheight),
//                                chunkLayer.data[i]
//                            );
//                        }
//                    }
                }
            }
        } else if (layer.type === "resources") {
            tilewidth = game.variables.tile.width;
            tileheight = game.variables.tile.height;

            for (y = chunkYOffset; y <= maxChunkYOffset; y++) {
                for (x = chunkXOffset; x <= maxChunkXOffset; x++) {
                    //level.getChunk(x,y).drawLayer(layer);

                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    if(chunkLayer.data.equals([])) {
                        // GENERATE
                        if (layer.generate) {
                            for (var dataY = 0; dataY < chunkSize; dataY++) {
                                for (var dataX = 0; dataX < chunkSize; dataX++) {
                                    var i = (dataY * chunkSize + dataX);

                                    var amount = layer.generate(x * chunkSize + dataX, y * chunkSize + dataY);
                                    resources.createResource(layer.name, amount, x * chunkSize + dataX, y * chunkSize + dataY);
                                }
                            }
                        }
                        //quick hack to stop regeneration every time.
                        chunkLayer.data = [1];
                    }
                    chunkLayer.resources.forEach( function(resource) {
                        contextGL.drawTile(canvas.context,
                            layer.tileset,
                            resource.x - tilewidth/2,
                            resource.y - tileheight/2,
                            resource.level,
                            resource
                        );
                    });
                }
            }
        } else if (layer.type === 'objects') {
            var chunks = [];
            for (var x = offsetsLT.chunk.x; x <= offsetsRB.chunk.x; x++) {
                for (var y = offsetsRT.chunk.y; y <= offsetsLB.chunk.y; y++) {
                    chunks.push({x: x, y: y});
                }
            }
            //objects = game.findObject(offsetsLT.chunk.x * chunkSize, offsetsRT.chunk.y * chunkSize, (offsetsRB.chunk.x + 1) * chunkSize, (offsetsLB.chunk.y + 1) * chunkSize);
            objects = game.findObjectByChunks(chunks);

            // Sort objects by y position
            objects.sort(function (a,b) {
                var result = (a.y < b.y) ? -1 : (a.y > b.y) ? 1 : 0;
                return result;
            });

            //Draw actions for selected objects
            objects.forEach(function(object) {
                var prevX = Math.round(object.x);
                var prevY = Math.round(object.y);

                if(object.isSelected) {
                    object.actions.forEach(function(action) {
                        tileset = _self.actionTiles;
                        tileIndex = _self.actionTiles.animations[action.action].N;

                        var tilewidth = tileset.grid.width;
                        var tileheight = tileset.grid.height;



//                        canvas.context.beginPath();
//                        canvas.context.moveTo(prevX, prevY);
//                        canvas.context.lineTo(action.x, action.y);
//                        canvas.context.strokeStyle="rgba(0,0,0,0.5)";
//                        canvas.context.stroke();

                        contextGL.drawTile(canvas.context,
                                           _self.actionTiles,
                                           Math.round(action.x-tilewidth/2),
                                           Math.round(action.y-tileheight/2),
                                           tileIndex,
                                           action
                                        );


                        prevX = action.x;
                        prevY = action.y;
                    });
                }
            });

            //Draw objects
            objects.forEach(function(object) {
                    object.crafted = typeof object.crafted !== 'undefined' && object.crafted < 1 ? object.crafted : 1;

                    tileset = object.tileset;
                    var tileheight = tileset.grid.height;

                    tileIndex = object.tile;

//                    if (object.emitter && object.crafted === 1) {
//                        object.emitter.update(canvas, Math.round(object.x), Math.round(object.y));
//                    }

                    contextGL.drawObject(canvas.context,
                                            object.image,
                                            Math.round(object.x - object.center.x),
                                            Math.round(object.y - object.center.y) + tileheight * (1-object.crafted),
                                            tileIndex,
                                            object
                                        );
            });

//            if (craftObject) {
//                tileset = craftObject.prototype.tileset;
//
//                var tilewidth = tileset.grid.width;
//                var tileheight = tileset.grid.height;
//
//                tileIndex = 0;
//
//                sx = tileIndex % tileset.tilesPerRow;
//                sy = (tileIndex - sx) / tileset.tilesPerRow;
//
//                canvas.context.save();
//                canvas.context.globalAlpha = 0.7;
//
//                canvas.context.drawImage(craftObject.prototype.image,
//                                       sx * tilewidth,
//                                       sy * tileheight,
//                                       tilewidth,
//                                       tileheight,
//                                       game.variables.mouseX - craftObject.prototype.center.x,
//                                       game.variables.mouseY - craftObject.prototype.center.y,
//                                       tilewidth,
//                                       tileheight
//                                    );
//
//                canvas.context.restore();
//            }
        } else if (layer.type === 'selection') {
        // Draw selection box:

            tileset = this.gameTiles;

            tilewidth = tileset.grid.width;
            tileheight = tileset.grid.height;

            tilesPerRow = tileset.tilesPerRow;

            x = game.variables.mouseX;
            y = game.variables.mouseY;

            tileIndex = 0;

            for (x = selectGrid.lx; x <= selectGrid.rx; x++) {
                for (y = selectGrid.ty; y <= selectGrid.by; y++) {
                    contextGL.drawObject(canvas.context,
                                        tileset,
                                        Math.round(0.5*(x-y)*tilewidth),
                                        Math.round(0.5*(x+y)*tileheight),
                                        tileIndex,
                                        {}
                                    );
                }
            }
        }
    }
};
