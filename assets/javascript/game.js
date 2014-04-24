

var game = {};

game.initialise = function() {
    objects.create("indianMale1",10,10);
    objects.create("firTree1",50,50);
    objects.create("firTree1",100,50);
    objects.create("firTree1",100,100);
    objects.create("firTree1",150,50);
    objects.create("firTree1",150,100);
    objects.create("firTree1",150,150);
    
    
    
    
    game.gameLoop();
};

common.require('draw','level','objects','userInterface',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw(userInterface.elements.canvas, level.get(), objects.list());
};

