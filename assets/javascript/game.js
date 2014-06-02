

var game = {};

game.initialise = function() {
    // load all objects
    objects.repository.get("indianMale");
    objects.repository.get("tree");
    objects.repository.get("log");
    objects.repository.get("totemPole");
    
    //objects.create("indianMale",110,110);
    //objects.create("tree",150,150);
    //objects.create("tree",200,150);
    //objects.create("tree",200,200);
    //objects.create("tree",250,150);
    //objects.create("tree",250,200);
    //objects.create("tree",250,250);
    
    objects.create("block",250,250);
    objects.create("tower",500,1000);
    game.gameLoop();
};

common.require('draw','level','objects','userInterface',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    draw(userInterface.elements.canvas, level.get(), objects.list(), userInterface.variables.craftObject);
};

