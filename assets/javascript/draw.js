/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

/* jshint loopfunc: true */

var draw = {};


draw.initialise = function () {
    this.gameTiles = common.resources.tilesets.get('gameTiles');
};

draw.drawTile = function(tileset, index, x, y) {
    
};

draw.draw = function (canvas, level, objects, craftObject, selectGrid) {
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

    for (var k = tileYOffset - 0.5*tileXOffset - Math.max(numberOfTilesForHeight, numberOfTilesForWidth) ; 
         k < tileYOffset - 0.5*tileXOffset + Math.max(numberOfTilesForHeight, numberOfTilesForWidth); 
         k++) {
        for (var j = k + tileXOffset - 1; j < numberOfTilesForWidth + k + tileXOffset + 2; j++) {
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
    
    // Draw selection box:
    
    tileset = this.gameTiles;
    
    tilewidth = tileset.grid.width;
    tileheight = tileset.grid.height;
    imagewidth = tileset.width;
    imageheight = tileset.height;
    tilesPerRow = imagewidth / tilewidth;
    
    plaatje = tileset;

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