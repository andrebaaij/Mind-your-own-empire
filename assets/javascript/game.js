var game = {};

game.initialise = function() {
    common.require('draw.js');
    common.require('level.js');
    common.require('objects.js');
    common.require('userInterface.js');
    
    window.requestAnimFrame(game.drawLoop());
};

game.drawLoop = function() {
    requestAnimationFrame(game.drawLoop);
    draw(userInterface.elements.canvas, level.get(), 0, 0);
};