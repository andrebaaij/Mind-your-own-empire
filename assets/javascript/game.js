/* global Image,document,window,setTimeout,console,XMLHttpRequest,requestAnimationFrame,common,draw,level,objects,userInterface */



var game = {
   variables : {
       pause : false,
       chunk : {
          size : 10  
       }
   }
};

common.parseQueryString();
game.variables.seed = game.variables.url.seed;

game.initialise = function() {
    objects.create("block",0,1);
    //objects.create("block",1,1);
    //objects.create("block",2,1);
    
    objects.create("mind",5,5);
    //objects.create("tower",10,10);
    
    game.variables.counter= 0;
    game.gameLoop();
    //setInterval(function () {game.gameLoop();}, 2000);
    
};

common.require('objects','perlin','level','userInterface','draw','particle',game.initialise);

game.gameLoop = function() {
    requestAnimationFrame(game.gameLoop);
    
    userInterface.elements.canvas.context.clearScene();
    if (!game.variables.pause) {
        game.draw();
    }
    
    common.background.process();
    userInterface.elements.canvas.context.drawScene();
};

game.draw = function() {
    draw.draw(userInterface.elements.canvas, level, objects.list(), game.variables.craftObject, game.variables.selectGrid);    
};