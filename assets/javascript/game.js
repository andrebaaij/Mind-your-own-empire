/* global Image,document,window,setTimeout,console,XMLHttpRequest,requestAnimationFrame,common,draw,level,objects,userInterface */

var game = {
   variables : {
       pause : false,
       chunk : {
          size : 10  
       },
       seed : 15646984163
   }
};

game.initialise = function() {    
    objects.create("block",0,1);
    objects.create("block",1,1);
    objects.create("block",2,1);
    
    objects.create("mind",5,5);
    objects.create("tower",10,10);
    
    game.gameLoop();
};

common.require('objects','perlin','level','userInterface','draw','particle',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    if (!game.variables.pause) {
        game.draw();
    }
};

game.draw = function() {
    draw.draw(userInterface.elements.canvas, level.get(), objects.list(), game.variables.craftObject, game.variables.selectGrid);    
};