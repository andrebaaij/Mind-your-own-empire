/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

/* jshint loopfunc: true */

var draw = function(canvas, level, objects) {
    canvas.context.clearRect(0, 0, canvas.width, canvas.height);
    
    var tileset = level.tilesets[0];
    
    var tilewidth = tileset.tilewidth;
    var tileheight = tileset.tileheight;
    var imagewidth = tileset.imagewidth;
    var imageheight = tileset.imageheight;
    
    var tilesPerRow = imagewidth / tilewidth;
    
    var plaatje = common.resources.tilesets.get(tileset.name);
    
    var tileXOffset = Math.floor(canvas.xOffset/tilewidth)*2;
    var tileYOffset = Math.floor(canvas.yOffset/tileheight);
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileheight);
    var numberOfTilesForWidth = Math.ceil(canvas.width/tilewidth) * 2;
    
    var layer = level.layers[0];
//    for (var k = tileYOffset - Math.floor(tileXOffset/2) - numberOfTilesForHeight ; k < tileYOffset - Math.floor(tileXOffset/2) + numberOfTilesForHeight  ; k++) {
//        for (var j = k-1+tileXOffset ; j < numberOfTilesForWidth + k + tileXOffset + 1 ; j++) {
//            var i = k*level.width + j;
//            if (i < 0) {
//                continue;
//            }
//            var tileIndex = layer.data[i] - 1;
//            var sx = tileIndex % tilesPerRow;
//            var sy = (tileIndex - sx) / tilesPerRow;
//            var cx = i % layer.width;
//            var cy = (i - cx) / layer.height;
//            canvas.context.drawImage(plaatje,
//                                   sx * tilewidth,
//                                   sy * tileheight,
//                                   tilewidth,
//                                   tileheight,
//                                   Math.round(0.5*(cx-cy)*tilewidth-0.5*(canvas.xOffset)*tilewidth),
//                                   Math.round(0.5*(cx+cy)*tileheight-(canvas.yOffset)*tileheight),
//                                   tilewidth,
//                                   tileheight
//                                );
//        }
//    }
//    
    for (var k = tileYOffset - tileXOffset - numberOfTilesForHeight ; k < tileYOffset - tileXOffset + numberOfTilesForHeight; k++) {
        for (var j = k + tileXOffset ; j < numberOfTilesForWidth + k + tileXOffset; j++) {
            var i = k*level.width + j;
            if (i < 0) {
                continue;
            }
            var tileIndex = layer.data[i] - 1;
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;
            var cx = i % layer.width;
            var cy = (i - cx) / layer.height;
            canvas.context.drawImage(plaatje,
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
    
    objects.forEach(function(object, index, array) {
            var tileset = object.tileset;
            
            var tilewidth = tileset.grid.width;
            var tileheight = tileset.grid.height;
            var imagewidth = tileset.width;
            var imageheight = tileset.width;

            var tilesPerRow = imagewidth / tilewidth;
            var tileIndex = object.tile;
            
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;
        
            canvas.context.drawImage(object.image,
                                   sx * tilewidth,
                                   sy * tileheight,
                                   tilewidth,
                                   tileheight,
                                   Math.round(object.x-canvas.xOffset),
                                   Math.round(object.y-canvas.yOffset),
                                   tilewidth,
                                   tileheight
                                );
    });
};