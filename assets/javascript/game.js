

var game = {};

game.initialise = function() {
    // load all objects

    objects.create("block",1,1);
    objects.create("mind",5,5);
    objects.create("tower",10,10);
    game.gameLoop();
};

common.require('draw','level','objects','userInterface','particle',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw.draw(userInterface.elements.canvas, level.get(), objects.list(), userInterface.variables.craftObject);
};

