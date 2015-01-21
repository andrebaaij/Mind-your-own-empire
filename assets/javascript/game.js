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
        },
        shiftMultiplier : 3
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
        size : 10 // Half the biggest communicationRadius
    },
    resources : {
        iron: 100000,
        energy: 0,
        storage : {
            iron : 0,
            energy : 0
        }
    },
    mouse : {
        selection : {
            objects : [],
            lx : {
                x : 0,
                y : 0
            },
            rx : {
                x : 0,
                y : 0
            },
            ty : {
                x : 0,
                y : 0
            },
            by : {
                x : 0,
                y : 0
            },
        }
    },
    keyboard : {},
    objects : [],
    repository : {
        objects : {
        }
    },
    player : {
        color : {
            r : 200,
            g : 200,
            b : 200,
            a : 1
        }
    }
};

common.parseQueryString();

data.seed = data.url.seed;
data.player.color = common.colors.player[data.url.color];
data.player.name = data.url.name;

game.initialise = function() {
    game.gameLoop();

    objects.create(data.repository.objects, "block", 0, 1, data.player, data.objects);
    objects.create(data.repository.objects, "block", 1, 1, data.player, data.objects);
    objects.create(data.repository.objects, "block", 2, 1, data.player, data.objects);

    objects.create(data.repository.objects, "mind", 5, 5, data.player, data.objects);

    objects.create(data.repository.objects, "tower", 10, 10, data.player, data.objects);

    objects.create(data.repository.objects, "solar", 11, 4, data.player, data.objects);
    objects.create(data.repository.objects, "solar", 11, 5, data.player, data.objects);
    objects.create(data.repository.objects, "solar", 11, 6, data.player, data.objects);
    objects.create(data.repository.objects, "solar", 10, 4, data.player, data.objects);
    objects.create(data.repository.objects, "solar", 10, 5, data.player, data.objects);
    objects.create(data.repository.objects, "solar", 10, 6, data.player, data.objects);

    objects.create(data.repository.objects, "scout", 0, 0, data.player, data.objects);

    ui.showMessage("Welcome " + data.player.name + ", good luck!!!", 20000);
};

common.require('contextGL', 'objects','resources', 'perlin', 'level', 'ui', 'draw', 'particle', game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);

    contextGL.clearScene(data.DOM.canvas.context);

    if (!data.pause) {
        data.scroll = ui.scrollLoop(data.DOM.canvas.context, data.scroll, data.mouse, data.keyboard);

        data.objects.forEach(function(object) {
            objects.loop(object, data);
        });

        draw.draw(data.DOM.canvas, level, data.objects, data.craftObject, data.selectGrid);
    }

    contextGL.drawScene(data.DOM.canvas.context);
};
