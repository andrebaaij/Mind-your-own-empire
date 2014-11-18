/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

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
    canvas.context.scale(scale,scale);
    canvas.context.translate(canvas.xOffset,canvas.yOffset);

    // Get tileset from level
    //var tileset_tiles = common.resources.tilesets.get(level.tilesets[0].name);

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

        if (layer.type === 'tile' || layer.type === "resources") {
            tilewidth = game.variables.tile.width;
            tileheight = game.variables.tile.height;

            for (y = chunkYOffset; y <= maxChunkYOffset; y++) {
                for (x = chunkXOffset; x <= maxChunkXOffset; x++) {
                    //level.getChunk(x,y).drawLayer(layer);

                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    if(chunkLayer.data.equals([])) {
                        var chunkSize = layer.size;

                        // GENERATE
                        if (layer.generate) {
                            for (var dataY = 0; dataY < chunkSize; dataY++) {
                                for (var dataX = 0; dataX < chunkSize; dataX++) {
                                    var i = (dataY * chunkSize + dataX);

                                    chunkLayer.data[i] = layer.generate(x * chunkSize + dataX, y * chunkSize + dataY);
                                }
                            }
                        }
                    }

                    for (var i = 0; i < layer.size * layer.size; i++) {
                        //x = i % layer.size;
                        //y = Math.floor(i / layer.size);

                        var sx = chunkLayer.data[i] % layer.tileset.tilesPerRow;
                        var sy = (chunkLayer.data[i] - sx) / layer.tileset.tilesPerRow;
                        var cx = i % layer.size;
                        var cy = (i - cx) / layer.size;

//                        canvas.context.drawImage(layer.tileset,
//                                               sx * tilewidth,
//                                               sy * tileheight,
//                                               tilewidth,
//                                               tileheight,
//                                               (_self.size * tilewidth / 2) + Math.round(0.5*(x-y)*tilewidth) - (tilewidth / 2),
//                                               Math.round(0.5*(x+y)*tileheight),
//                                               tilewidth,
//                                               tileheight
//                                            );

                        canvas.context.drawImage(layer.tileset,
                                sx * tilewidth,
                                sy * tileheight,
                                tilewidth,
                                tileheight,
                                Math.round(((cx+(x*chunkSize))-(cy+(y*chunkSize)))*0.5*tilewidth),
                                Math.round(((cx+(x*chunkSize))+(cy+(y*chunkSize)))*0.5*tileheight),
                                tilewidth,
                                tileheight
                                );
                    }
                }
            }
        } else if (layer.type === 'objects') {
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

                        sx = tileIndex % tileset.tilesPerRow;
                        sy = (tileIndex - sx) / tileset.tilesPerRow;

//                        canvas.context.beginPath();
//                        canvas.context.moveTo(prevX, prevY);
//                        canvas.context.lineTo(action.x, action.y);
//                        canvas.context.strokeStyle="rgba(0,0,0,0.5)";
//                        canvas.context.stroke();

                        canvas.context.drawImage(_self.actionTiles,
                                           sx * tilewidth,
                                           sy * tileheight,
                                           tilewidth,
                                           tileheight,
                                           Math.round(action.x-tilewidth/2),
                                           Math.round(action.y-tileheight/2),
                                           tilewidth,
                                           tileheight
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
                    var tilewidth = tileset.grid.width;
                    var tileheight = tileset.grid.height;

                    tileIndex = object.tile;

                    sx = tileIndex % tileset.tilesPerRow;
                    sy = (tileIndex - sx) / tileset.tilesPerRow;

//                    if (object.emitter && object.crafted === 1) {
//                        object.emitter.update(canvas, Math.round(object.x), Math.round(object.y));
//                    }

                    canvas.context.drawImage(object.image,
                                           sx * tilewidth,
                                           sy * tileheight + tileheight * (1-object.crafted),
                                           tilewidth,
                                           Math.round(tileheight*object.crafted),
                                           Math.round(object.x - object.center.x),
                                           Math.round(object.y - object.center.y) + tileheight * (1-object.crafted),
                                           tilewidth,
                                           Math.round(tileheight*object.crafted)
                                        );
            });

            if (craftObject) {
                tileset = craftObject.prototype.tileset;

                var tilewidth = tileset.grid.width;
                var tileheight = tileset.grid.height;

                tileIndex = 0;

                sx = tileIndex % tileset.tilesPerRow;
                sy = (tileIndex - sx) / tileset.tilesPerRow;

                canvas.context.save();
                canvas.context.globalAlpha = 0.7;

                canvas.context.drawImage(craftObject.prototype.image,
                                       sx * tilewidth,
                                       sy * tileheight,
                                       tilewidth,
                                       tileheight,
                                       game.variables.mouseX - craftObject.prototype.center.x,
                                       game.variables.mouseY - craftObject.prototype.center.y,
                                       tilewidth,
                                       tileheight
                                    );

                canvas.context.restore();
            }
        } else if (layer.type === 'selection') {
        // Draw selection box:

            tileset = this.gameTiles;

            tilewidth = tileset.grid.width;
            tileheight = tileset.grid.height;

            tilesPerRow = tileset.tilesPerRow;

            x = game.variables.mouseX;
            y = game.variables.mouseY;

            tileIndex = 0;
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;

            for (x = selectGrid.lx; x <= selectGrid.rx; x++) {
                for (y = selectGrid.ty; y <= selectGrid.by; y++) {
                    canvas.context.drawImage(tileset,
                                       sx * tilewidth,
                                       sy * tileheight,
                                       tilewidth,
                                       tileheight,
                                       Math.round(0.5*(x-y)*tilewidth),
                                       Math.round(0.5*(x+y)*tileheight),
                                       tilewidth,
                                       tileheight
                                    );
                }
            }
        }
    }
};