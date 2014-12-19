/* global requestAnimationFrame, common, draw, level, objects, contextGL, game:true, ui */

game = {};

var data = {
    scroll : {
        speed : 5,
        x : 0,
        y : 0,
        offset : {
            x : 0,
            y : 0
        }
    },
    craftObject : null,
    mouseDown : false,
    scale : {
        level: 1,
        speed: 2,
        minLevel : 1,
        maxLevel : 4
    },
    pause : false,
    chunk : {
        size : 10
    },
    resources : {
        iron: 1000,
        energy: 0
    },
    mouse : {
        selection : {
            objects : []
        }
    },
    keyboard : {},
    selection : {}
};

common.parseQueryString();

data.seed = data.url.seed;

game.initialise = function() {
    game.gameLoop();

    objects.create("block",0,1);
    objects.create("block",1,1);
    objects.create("block",2,1);

    objects.create("mind",5,5);

    objects.create("tower",10,10);

    objects.create("solar",11,4);
    objects.create("solar",11,5);
    objects.create("solar",11,6);
    objects.create("solar",10,4);
    objects.create("solar",10,5);
    objects.create("solar",10,6);
};

common.require('contextGL', 'objects','resources', 'perlin', 'level', 'ui', 'draw', 'particle', game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);

    contextGL.clearScene(data.DOM.canvas.context);

    if (!data.pause) {
        data.scroll = ui.scrollLoop(data.DOM.canvas.context, data.scroll, data.keyboard);
        game.draw();

        objects.list().forEach(function(object) {
            object.loop();
        });
    }

    contextGL.drawScene(data.DOM.canvas.context);
};

game.draw = function() {
    draw.draw(data.DOM.canvas, level, objects.list(), data.craftObject, data.selectGrid);
};
