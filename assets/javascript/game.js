

var game = {};

game.initialise = function() {
    // load all objects

    objects.create("block",250,250);
    objects.create("mind",500,500);
    objects.create("tower",500,1000);
    game.gameLoop();
};

common.require('draw','level','objects','userInterface',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw.draw(userInterface.elements.canvas, level.get(), objects.list(), userInterface.variables.craftObject);
};

