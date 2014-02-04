/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

/* jshint loopfunc: true */

var draw = function(canvas, level, objects, xOffset, yOffset) {
    
    var tileset = level.tilesets[0];
    var plaatje = common.resources.tilesets.get(tileset.name);
    var sx = 128;
    var sy = 0;
    
    canvas.context = canvas.getContext("2d");
    canvas.width = canvas.width + 20;
    canvas.height = canvas.height + 10;
    
    
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               -64,
                               -32,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx+128,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               0,
                               0,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               64,
                               -32,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               128,
                               0,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               64,
                               32,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               192,
                               32,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               128,
                               64,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               0,
                               64,
                               tileset.tilewidth,
                               tileset.tileheight
                            );
    canvas.context.drawImage(  plaatje,
                               sx,
                               sy,
                               tileset.tilewidth,
                               tileset.tileheight,
                               64,
                               96,
                               tileset.tilewidth,
                               tileset.tileheight
                            );


};

