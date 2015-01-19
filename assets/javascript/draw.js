/* global contextGL,resources,Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

/* jshint loopfunc: true */

var draw = {};

draw.initialise = function () {
    var _self = this;

    _self.gameTiles = common.resources.tilesets.get('gameTiles');
    _self.pixelTiles = common.resources.tilesets.get('pixel');
    _self.actionTiles = common.resources.tilesets.get('actions');
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
    var _self = this;

    var x,
        y,
        z = 0,
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

    // Assign tileset data to variables for easy use.
    var chunkSize = data.chunk.size;
    var offsetsLT = common.getGridFromScreen(data.scroll, 0, 0);
    var offsetsRT = common.getGridFromScreen(data.scroll, canvasWidth, 0);
    var offsetsLB = common.getGridFromScreen(data.scroll, 0, canvasHeight);
    var offsetsRB = common.getGridFromScreen(data.scroll, canvasWidth, canvasHeight);

    var chunkXOffset = Math.min(offsetsLT.chunk.x, offsetsRT.chunk.x, offsetsLB.chunk.x, offsetsRB.chunk.x);
    var chunkYOffset = Math.min(offsetsLT.chunk.y, offsetsRT.chunk.y, offsetsLB.chunk.y, offsetsRB.chunk.y);
    var maxChunkXOffset = Math.max(offsetsLT.chunk.x, offsetsRT.chunk.x, offsetsLB.chunk.x, offsetsRB.chunk.x);
    var maxChunkYOffset = Math.max(offsetsLT.chunk.y, offsetsRT.chunk.y, offsetsLB.chunk.y, offsetsRB.chunk.y);
    tilewidth = data.tile.width;
    tileheight = data.tile.height;

    for (var l in level.layers) {
        var layer = level.layers[l];

        if (layer.visible === false) {
            continue;
        }

        if (layer.type === 'tile') {
            tilewidth = data.tile.width;
            tileheight = data.tile.height;

            for (y = chunkYOffset; y <= maxChunkYOffset; y++) {
                for (x = chunkXOffset; x <= maxChunkXOffset; x++) {
                    var fogLayer = level.getChunk(x, y).layers.fog;
                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    chunkLayer.tiles.forEach( function(tile, index) {
                        if (tile.tile === -1 || !fogLayer.data[index]) {
                            return;
                        }

                        contextGL.drawTile(canvas.context,
                            layer.tileset,
                            tile.x - tilewidth/2,
                            tile.y - tileheight/2,
                            z += 1,
                            tile.tile,
                            tile
                        );
                    });
                }
            }
        } else if (layer.type === "resources") {
            tilewidth = data.tile.width;
            tileheight = data.tile.height;

            for (y = chunkYOffset; y <= maxChunkYOffset; y++) {
                for (x = chunkXOffset; x <= maxChunkXOffset; x++) {

                    var fogLayer = level.getChunk(x, y).layers.fog;
                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    chunkLayer.resources.forEach( function(resource, index) {
                        if (!fogLayer.data[index]) {
                            return;
                        }

                        contextGL.drawTile(canvas.context,
                            layer.tileset,
                            resource.x - tilewidth/2,
                            resource.y - tileheight/2,
                            z += 1,
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
            objects = data.objects;//game.findObjectByChunks(chunks);

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
                                           z += 1,
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
                    tileset = object.tileset;
                    var tileheight = tileset.grid.height;

                    tileIndex = object.tile;

                    contextGL.drawObject(canvas.context,
                            object.image,
                            Math.round(object.x - object.center.x),
                            Math.round(object.y - object.center.y),
                            z += 1,
                            tileIndex,
                            object,
                            object.color
                        );
            });

            if (craftObject) {
                var object = data.repository.objects[craftObject];

                tileset = object.tileset;

                var w = data.tile.width;
                var h = data.tile.height;

                tileIndex = 0;

                for (x = data.mouse.selection.lx; x <= data.mouse.selection.rx; x++) {
                    for (y = data.mouse.selection.ty; y <= data.mouse.selection.by; y++) {
                        var coordinates = common.getCoordinatesFromGrid(x, y);

                        contextGL.drawObject(canvas.context,
                                object.image,
                                coordinates.x - object.center.x,
                                coordinates.y - object.center.y,
                                z += 1,
                                tileIndex,
                                {},
                                object.color
                            );
                    }
                }


            }
        } else if (layer.type === 'selection' && !craftObject) {
            tileIndex = 0;

            contextGL.drawSquare(canvas.context,
                                this.pixelTiles,
                                data.mouse.selection.lx,
                                data.mouse.selection.ty,
                                z += 1,
                                data.mouse.selection.rx - data.mouse.selection.lx,
                                data.mouse.selection.by - data.mouse.selection.ty,
                                0,
                                {},
                                {
                                    r:255 ,
                                    g:255 ,
                                    b:255 ,
                                    a:0.6
                                }
                            );
        }
    }
};
