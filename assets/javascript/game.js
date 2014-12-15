/* global requestAnimationFrame, common, draw, level, objects, userInterface, contextGL */



var game = {
    variables : {
        pause : false,
        chunk : {
            size : 10
        }
    },
    resources : {
        iron: 1000,
        energy: 0
    }
};

common.parseQueryString();
game.variables.seed = game.variables.url.seed;

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

    game.variables.counter= 0;

    //setInterval(function () {game.gameLoop();}, 2000);

};

common.require('objects','resources', 'perlin','level','userInterface','draw','particle',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);

    contextGL.clearScene(userInterface.elements.canvas.context);
    if (!game.variables.pause) {
        game.draw();
    }

    contextGL.drawScene(userInterface.elements.canvas.context);

    objects.list().forEach(function(object) {
        object.loop();
    });
};

game.draw = function() {
    draw.draw(userInterface.elements.canvas, level, objects.list(), game.variables.craftObject, game.variables.selectGrid);
};
