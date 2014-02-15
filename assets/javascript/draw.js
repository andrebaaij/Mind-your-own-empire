/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

/* jshint loopfunc: true */

var draw = function(canvas, level, objects, xOffset, yOffset) {
    
    var tileset = level.tilesets[0];
    
    var tilewidth = tileset.tilewidth;
    var tileheight = tileset.tileheight;
    var imagewidth = tileset.imagewidth;
    var imageheight = tileset.imageheight;
    
    var tilesPerRow = imagewidth / tilewidth;
    
    var plaatje = common.resources.tilesets.get(tileset.name);
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileheight) * 2;
    var numberOfTilesForWidth = Math.ceil(canvas.width/tilewidth) * 2 + 2;
    
    var layer = level.layers[0];
    for (var k = 0 ; k < numberOfTilesForHeight ; k++) {
        for (var j = k-1 ; j < numberOfTilesForWidth + 5 ; j++) {
            var i = k*level.width + j - 5;
            if (i < 0) {
                continue;
            }
            var tileIndex = layer.data[i] - 1;
            var sx = tileIndex % tilesPerRow;
            var sy = (tileIndex - sx) / tilesPerRow;
            var cx = i % layer.width;
            var cy = (i - cx) / layer.width;
            canvas.context.drawImage(plaatje,
                                   sx * tilewidth,
                                   sy * tileheight,
                                   tilewidth,
                                   tileheight,
                                   0.5*(cx-cy+5)*tilewidth,
                                   0.5*(cx+cy)*tileheight,
                                   tilewidth,
                                   tileheight
                                );
        }
    }
};