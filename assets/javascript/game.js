

var game = {};

game.initialise = function() {
    // load all objects
    objects.repository.get("indianMale")
    objects.repository.get("tree")
    objects.repository.get("log")
    objects.repository.get("totemPole")
    
    objects.create("indianMale",10,10);
    objects.create("tree",50,50);
    objects.create("tree",100,50);
    objects.create("tree",100,100);
    objects.create("tree",150,50);
    objects.create("tree",150,100);
    objects.create("tree",150,150);
    
    
    
    
    game.gameLoop();
};

common.require('draw','level','objects','userInterface',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw(userInterface.elements.canvas, level.get(), objects.list());
};

