var game = {};

game.initialise = function() {
    common.require('draw');
    common.require('level');
    common.require('objects');
    common.require('userInterface');
    
    //userInterface.setVariable("levelWidth", level.get().width);
    //userInterface.setVariable("levelHeight", level.get().height);
    game.gameLoop();
};

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw(userInterface.elements.canvas, level.get(), objects.list());
};