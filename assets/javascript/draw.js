/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

/* jshint loopfunc: true */

var draw = {};


draw.initialise = function () {
    this.gameTiles = common.resources.tilesets.get('gameTiles');
};

draw.drawTile = function(tileset, index, x, y) {
    
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
    // Clear canvas
    canvas.context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get tileset from level
    var tileset_tiles = common.resources.tilesets.get(level.tilesets[0].name);
       
    // Assign tileset data to variables for easy use.
    var chunkSize = game.settings.chunkSize;
    
    var tilewidth = tileset_tiles.grid.width;
    var tileheight = tileset_tiles.grid.height;
    var tilesPerRow = tileset_tiles.tilesPerRow;
    
    var tileXOffset = Math.floor(canvas.xOffset/tilewidth)*2;
    var tileYOffset = Math.floor(canvas.yOffset/tileheight);
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileheight);
    var numberOfTilesForWidth = Math.ceil(canvas.width/tilewidth) * 2;
 
    var numberOfChunksForHeight = Math.ceil(numberOfTilesForHeight/chunkSize);
    var numberOfChunksForWidth = Math.ceil(numberOfTilesForWidth/chunkSize);
    
    var layer = level.layers[0];
    
//    for (var y = Math.floor(tileYOffset/chunkSize); y <= Math.floor(tileYOffset/chunkSize) + numberOfChunksForHeight; y++) {
//        for (var x = Math.floor(tileXOffset/chunkSize); x <= Math.floor(tileXOffset/chunkSize) + numberOfChunksForWidth; x++) {
    for (var y = 0; y <= 2; y++) {
        for (var x = 0; x <= 2; x++) {
//            if (y < 0 || x < 0 || x > layer.width/chunkSize || y > layer.height/chunkSize) {
//                return;    
//            }
            
            //console.log('x:'+ x + 'y:' + y);
            chunk = game.getChunk(layer, x, y);
            
            
            
            canvas.context.drawImage(chunk,
                     ((x-y)*chunkSize*tilewidth/2) - (chunkSize*tilewidth/2) + (tilewidth / 2) - canvas.xOffset,
                     ((y+x)*chunkSize*tileheight/2) - canvas.yOffset);
        }
    }
    
//    for (var k = tileYOffset - 0.5*tileXOffset - Math.max(numberOfTilesForHeight, numberOfTilesForWidth) ; 
//         k < tileYOffset - 0.5*tileXOffset + Math.max(numberOfTilesForHeight, numberOfTilesForWidth); 
//         k++) {
//        for (var j = k + tileXOffset - 1; j < numberOfTilesForWidth + k + tileXOffset + 2; j++) {
//            var i = k*level.width + j;
//            if (i < 0) {
//                continue;
//            }
//            var tileIndex = layer.data[i] - 1;
//            var sx = tileIndex % tilesPerRow;
//            var sy = (tileIndex - sx) / tilesPerRow;
//            var cx = i % layer.width;
//            var cy = (i - cx) / layer.height;
//            
//            canvas.context.drawImage(tileset_tiles,
//                                   sx * tilewidth,
//                                   sy * tileheight,
//                                   tilewidth,
//                                   tileheight,
//                                   Math.round(0.5*(cx-cy)*tilewidth-canvas.xOffset),
//                                   Math.round(0.5*(cx+cy)*tileheight-canvas.yOffset),
//                                   tilewidth,
//                                   tileheight
//                                );
            
//            var tileIndex = level.layers[1].data[i];
//            var sx = tileIndex % tilesPerRow;
//            var sy = (tileIndex - sx) / tilesPerRow;
//            var cx = i % layer.width;
//            var cy = (i - cx) / layer.height;
//            
//            canvas.context.drawImage(this.gameTiles,
//                       sx * tilewidth,
//                       sy * tileheight,
//                       tilewidth,
//                       tileheight,
//                       Math.round(0.5*(cx-cy)*tilewidth-canvas.xOffset),
//                       Math.round(0.5*(cx+cy)*tileheight-canvas.yOffset),
//                       tilewidth,
//                       tileheight
//                    );
//        }
//    }
    
    // Draw selection box:
    
    tileset = this.gameTiles;
    
    tilewidth = tileset.grid.width;
    tileheight = tileset.grid.height;
    imagewidth = tileset.width;
    imageheight = tileset.height;
    tilesPerRow = imagewidth / tilewidth;

    var x = userInterface.variables.mouseX + canvas.xOffset;
    var y = userInterface.variables.mouseY + canvas.yOffset;
    
    var tileIndex = 0;
    var sx = tileIndex % tilesPerRow;
    var sy = (tileIndex - sx) / tilesPerRow;
    
    for (x = selectGrid.lx; x <= selectGrid.rx; x++) {
        for (y = selectGrid.ty; y <= selectGrid.by; y++) {
            var i = y*level.width + x;
            
            var cx = i % layer.width;
            var cy = (i - cx) / layer.height;

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
                var tileset = object.tileset;

                var tilewidth = tileset.grid.width;
                var tileheight = tileset.grid.height;
                var imagewidth = tileset.width;

                var tilesPerRow = imagewidth / tilewidth;
                var tileIndex = object.tile;

                var sx = tileIndex % tilesPerRow;
                var sy = (tileIndex - sx) / tilesPerRow;

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
        
                var tileset = object.tileset;

                var tilewidth = tileset.grid.width;
                var tileheight = tileset.grid.height;
                var imagewidth = tileset.width;

                var tilesPerRow = imagewidth / tilewidth;
                var tileIndex = object.tile;

                var sx = tileIndex % tilesPerRow;
                var sy = (tileIndex - sx) / tilesPerRow;

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
        var tileset = craftObject.prototype.tileset;

        var tilewidth = tileset.grid.width;
        var tileheight = tileset.grid.height;
        var imagewidth = tileset.width;
        var imageheight = tileset.width;

        var tilesPerRow = imagewidth / tilewidth;
        var tileIndex = 0;//craftObject.tile;

        var sx = tileIndex % tilesPerRow;
        var sy = (tileIndex - sx) / tilesPerRow;
        
        canvas.context.save();
        canvas.context.globalAlpha = 0.7;
        
        canvas.context.drawImage(craftObject.prototype.image,
                               sx * tilewidth,
                               sy * tileheight,
                               tilewidth,
                               tileheight,
                               //Math.round(craftObject.x-canvas.xOffset),
                               //Math.round(craftObject.y-canvas.yOffset),
                               userInterface.variables.mouseX - craftObject.prototype.center.x,
                               userInterface.variables.mouseY - craftObject.prototype.center.y,
                               tilewidth,
                               tileheight
                            );
        
        canvas.context.restore();
    }
};