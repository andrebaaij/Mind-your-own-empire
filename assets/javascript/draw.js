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

    canvas.context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    var layer = level.layers[0];
    for (var i = 0 ; i < imagewidth*imageheight ; i++) {
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
                               0.5*(cx-cy-1)*tilewidth+0.5*window.innerWidth,
                               0.5*(cx+cy)*tileheight,
                               tilewidth,
                               tileheight
                            );
    }
    
    
    


};

