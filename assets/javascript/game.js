var game = {};

game.initialise = function() {
    common.require('draw');
    common.require('level');
    common.require('objects');
    common.require('userInterface');
    
    game.gameLoop();
};

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw(userInterface.elements.canvas, level.get(), objects.list());
};

