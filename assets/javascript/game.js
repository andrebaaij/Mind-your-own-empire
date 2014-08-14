

var game = {
   variables : {
       pause : false
   }
};

game.initialise = function() {
    // load all objects

    objects.create("block",1,1);
    objects.create("mind",5,5);
    objects.create("tower",10,10);
    
        //Level
    game.calculatefog = level.calculatefog;
    game.getChunk = level.chunks.get;
   // game.getObjects = objects.list;
    
    level.calculatefog();
    
    game.settings = {
        chunkSize: 10    
    };
    
    game.gameLoop();
    

};

common.require('level','objects','userInterface','draw','particle',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    if (!game.variables.pause) {
        draw.draw(userInterface.elements.canvas, level.get(), objects.list(), userInterface.variables.craftObject, userInterface.variables.selectGrid);
    }
};

//Interfaces

//Objects
game.getObjects = function() {
    return objects.list();
};

