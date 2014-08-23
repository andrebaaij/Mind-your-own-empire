/* global Image,document,window,setTimeout,console,XMLHttpRequest,common,game */

/* jshint loopfunc: true */

var draw = {};

draw.initialise = function () {
    this.gameTiles = common.resources.tilesets.get('gameTiles');
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
    
    var x, y, tileset, tilewidth, tileheight, imagewidth,tilesPerRow,tileIndex,tileXOffset,tileYOffset;
    
    // Clear canvas
    canvas.context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get tileset from level
    var tileset_tiles = common.resources.tilesets.get(level.tilesets[0].name);
       
    // Assign tileset data to variables for easy use.
    var chunkSize = game.variables.chunk.size;
    
    tilewidth = tileset_tiles.grid.width;
    tileheight = tileset_tiles.grid.height;
    tilesPerRow = tileset_tiles.tilesPerRow;
    
    tileXOffset = Math.floor(canvas.xOffset/tilewidth)*2;
    tileYOffset = Math.floor(canvas.yOffset/tileheight);
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileheight);
    var numberOfTilesForWidth = Math.ceil(canvas.width/tilewidth) * 2;
 
    var numberOfChunksForHeight = Math.ceil(numberOfTilesForHeight/chunkSize) + 1;
    var numberOfChunksForWidth = Math.ceil(numberOfTilesForWidth/chunkSize) + 1;
    
    for (var l in level.layers) {
        var layer = level.layers[l];
        
        if (layer.type !== 'tilelayer') {
            continue;    
        }
        
        for (y = 0; y <= numberOfChunksForWidth; y++) {
            for (x = 0; x <= numberOfChunksForWidth; x++) {
                var chunk = game.getChunk(layer, x, y);

                if (chunk === null) {
                    return;
                }

                canvas.context.drawImage(chunk,
                         ((x-y)*chunkSize*tilewidth/2) - (chunkSize*tilewidth/2) + (tilewidth / 2) - canvas.xOffset,
                         ((y+x)*chunkSize*tileheight/2) - canvas.yOffset);
            }
        }
    }
    
    // Draw selection box:
    
    tileset = this.gameTiles;
    
    tilewidth = tileset.grid.width;
    tileheight = tileset.grid.height;
    imagewidth = tileset.width;
    var imageheight = tileset.height;
    tilesPerRow = imagewidth / tilewidth;

    x = game.variables.mouseX + canvas.xOffset;
    y = game.variables.mouseY + canvas.yOffset;
    
    tileIndex = 0;
    var sx = tileIndex % tilesPerRow;
    var sy = (tileIndex - sx) / tilesPerRow;
    
    for (x = selectGrid.lx; x <= selectGrid.rx; x++) {
        for (y = selectGrid.ty; y <= selectGrid.by; y++) {
            var i = y*level.width + x;
            
            var cx = i % level.width;
            var cy = (i - cx) / level.height;

            canvas.context.drawImage(tileset,
                               sx * tilewidth,
                               sy * tileheight,
                               tilewidth,
                               tileheight,
                               Math.round(0.5*(cx-cy)*tilewidth-canvas.xOffset),
                               Math.round(0.5*(cx+cy)*tileheight-canvas.yOffset),
                               tilewidth,
                               tileheight
                            );
        }
    }
    

    
    objects.sort(function (a,b) {
        var result = (a.y < b.y) ? -1 : (a.y > b.y) ? 1 : 0;
        return result;
    });
    
    objects.forEach(function(object, index, array) {
            if (typeof object.crafted !== 'undefined' && object.crafted < 1) {
                tileset = object.tileset;

                tilewidth = tileset.grid.width;
                tileheight = tileset.grid.height;
                imagewidth = tileset.width;

                tilesPerRow = imagewidth / tilewidth;
                tileIndex = object.tile;

                sx = tileIndex % tilesPerRow;
                sy = (tileIndex - sx) / tilesPerRow;

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
                
                
            } else {
        
                tileset = object.tileset;

                tilewidth = tileset.grid.width;
                tileheight = tileset.grid.height;
                imagewidth = tileset.width;

                tilesPerRow = imagewidth / tilewidth;
                tileIndex = object.tile;

                sx = tileIndex % tilesPerRow;
                sy = (tileIndex - sx) / tilesPerRow;

                if (object.emitter) {
                    object.emitter.update(canvas, Math.round(object.x-canvas.xOffset), Math.round(object.y-canvas.yOffset));
                }
                
                canvas.context.drawImage(object.image,
                                       sx * tilewidth,
                                       sy * tileheight,
                                       tilewidth,
                                       tileheight,
                                       Math.round(object.x-canvas.xOffset - object.center.x),
                                       Math.round(object.y-canvas.yOffset - object.center.y),
                                       tilewidth,
                                       tileheight
                                    );
            }
    });

    
    if (craftObject) {
        tileset = craftObject.prototype.tileset;

        tilewidth = tileset.grid.width;
        tileheight = tileset.grid.height;
        imagewidth = tileset.width;
        imageheight = tileset.width;

        tilesPerRow = imagewidth / tilewidth;
        tileIndex = 0;//craftObject.tile;

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
};