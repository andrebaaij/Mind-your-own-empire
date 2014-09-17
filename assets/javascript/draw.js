/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

/* jshint loopfunc: true */

var draw = {};

draw.initialise = function () {
    this.gameTiles = common.resources.tilesets.get('gameTiles');
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
    
    var x, y, tileset, tilewidth, tileheight, imagewidth,tilesPerRow,tileIndex,tileXOffset,tileYOffset;
    
    // Clear canvas
    
    var canvasWidth = canvas.width * game.variables.scale;
    var canvasHeight = canvas.height * game.variables.scale;
    
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
    
    var numberOfTilesForHeight = Math.ceil(canvasHeight/tileheight);
    var numberOfTilesForWidth = Math.ceil(canvasWidth/tilewidth);
 
    var numberOfChunksForHeight = Math.ceil(numberOfTilesForHeight/chunkSize) * 2 + 1;
    var numberOfChunksForWidth = Math.ceil(numberOfTilesForWidth/chunkSize) * 2 + 1;
    
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
                    var chunkLayer = level.getChunk(x, y).getLayer(layer);

                    if (!chunkLayer || !chunkLayer.canvas) {
                        return;   
                    }

                    canvas.context.drawImage(chunkLayer.canvas,
                             ((x-y)*chunkSize*tilewidth/2) - (chunkSize*tilewidth/2) + (tilewidth / 2) - canvas.xOffset,
                             ((y+x)*chunkSize*tileheight/2) - canvas.yOffset);
                }
            }
        } else if (layer.type === 'objects') {
            objects.sort(function (a,b) {
                var result = (a.y < b.y) ? -1 : (a.y > b.y) ? 1 : 0;
                return result;
            });

            objects.forEach(function(object, index, array) {
                    object.crafted = typeof object.crafted !== 'undefined' && object.crafted < 1 ? object.crafted : 1;

                    tileset = object.tileset;
                    tilewidth = tileset.grid.width;
                    tileheight = tileset.grid.height;
                
                    imagewidth = tileset.width;
                    tilesPerRow = tileset.tilesPerRow;
                    tileIndex = object.tile;

                    sx = tileIndex % tilesPerRow;
                    sy = (tileIndex - sx) / tilesPerRow;

                    if (object.emitter && object.crafted === 1) {
                        object.emitter.update(canvas, Math.round(object.x-canvas.xOffset), Math.round(object.y-canvas.yOffset));
                    }

                    canvas.context.drawImage(object.image,
                                           sx * tilewidth,
                                           sy * tileheight + tileheight * (1-object.crafted),
                                           tilewidth,
                                           Math.round(tileheight*object.crafted),
                                           Math.round(object.x-canvas.xOffset - object.center.x),
                                           Math.round(object.y-canvas.yOffset - object.center.y) + tileheight * (1-object.crafted),
                                           tilewidth,
                                           Math.round(tileheight*object.crafted)
                                        );

            });


            if (craftObject) {
                tileset = craftObject.prototype.tileset;

                imagewidth = tileset.width;
                imageheight = tileset.width;
                tilesPerRow = tileset.tilesPerRow;
                
                tileIndex = 0;

                sx = tileIndex % tilesPerRow;
                sy = (tileIndex - sx) / tilesPerRow;

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
            imagewidth = tileset.width;
            var imageheight = tileset.height;
            tilesPerRow = tileset.tilesPerRow;

            x = game.variables.mouseX + canvas.xOffset;
            y = game.variables.mouseY + canvas.yOffset;

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
                                       Math.round(0.5*(x-y)*tilewidth-canvas.xOffset),
                                       Math.round(0.5*(x+y)*tileheight-canvas.yOffset),
                                       tilewidth,
                                       tileheight
                                    );
                }
            }
        }
    }
    
    
    

    
    
};