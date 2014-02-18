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
    
    var tileXOffset = Math.floor(canvas.xOffset/32);
    var tileYOffset = Math.floor(canvas.yOffset/32);
    
    var numberOfTilesForHeight = Math.ceil(canvas.height/tileheight);
    var numberOfTilesForWidth = Math.ceil(canvas.width/tilewidth) * 2;
    
    var layer = level.layers[0];
    for (var k = tileYOffset - Math.floor(tileXOffset/2) - numberOfTilesForHeight ; k < tileYOffset - Math.floor(tileXOffset/2) + numberOfTilesForHeight  ; k++) {
        for (var j = k-1+tileXOffset ; j < numberOfTilesForWidth + k + tileXOffset + 1 ; j++) {
    //for (var k = 0; k < 200  ; k++) {
    //    for (var j = 0 ; j < 200 ; j++) {
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
                                   0.5*(cx-cy)*tilewidth-0.5*(canvas.xOffset/32)*tilewidth,
                                   0.5*(cx+cy)*tileheight-(canvas.yOffset/32)*tileheight,
                                   tilewidth,
                                   tileheight
                                );
        }
    }
};