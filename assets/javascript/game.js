var game = {};

game.initialise = function() {
    common.require('draw');
    common.require('level');
    common.require('objects');
    common.require('userInterface');
    
    window.requestAnimFrame(game.drawLoop());
};

game.drawLoop = function() {
    requestAnimationFrame(game.drawLoop);
    draw(userInterface.elements.canvas, level.get(), 0, 0);
};