var userInterface = {};
userInterface.elements = {};

userInterface.variables = {
    scrollSpeed : 0.5,
    scrollX : 0,
    scrollY : 0
};

userInterface.initialise = function() {
    /* Elements */
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.pause = document.getElementById("pause");
    userInterface.elements.pauseContinue = document.getElementById("pauseContinue");
    userInterface.elements.pauseFullscreen = document.getElementById("pauseFullscreen");
    
    /* EventListeners assignment*/
    userInterface.elements.canvas.addEventListener('mousemove',userInterface.canvasMoveMouseListener);
    userInterface.elements.pauseContinue.addEventListener('click',userInterface.unpause);
    userInterface.elements.pauseFullscreen.addEventListener('click',userInterface.fullscreen());
    
    window.onblur = userInterface.pause;
    
    /* Loops */
    userInterface.scrollLoop();
    
    /* initialise */
    userInterface.elements.canvas.context = canvas.getContext("2d");
    userInterface.elements.canvas.xOffset = 0;
    userInterface.elements.canvas.yOffset = 0;
    window.onresize();
};

userInterface.setVariable = function(name, value) {
    userInterface.variables[name] = value;
};

/* Pause */
userInterface.pause = function(command) {
    if (command !== "on" && command !== "off") {
        if (userInterface.elements.pause.style.display === "none") {
            userInterface.elements.pause.style.display = "block";
        } else {
            userInterface.elements.pause.style.display = "none";
        }
    } else if (command !== "on" ) {
        userInterface.elements.pause.style.display = "block";
    } else if ( command !== "off") {
        userInterface.elements.pause.style.display = "none";
    }
};

userInterface.fullscreen = function(command) {
    if (command !== "on" && command !== "off") {
        if (userInterface.elements.pause.style.display === "none") {
            userInterface.elements.pause.style.display = "block";
        } else {
            userInterface.elements.pause.style.display = "none";
        }
    } else if (command !== "on" ) {
        userInterface.elements.pause.style.display = "block";
    } else if ( command !== "off") {
        userInterface.elements.pause.style.display = "none";
    }
};

/* Scroll */
userInterface.scrollLoop = function() {
    requestAnimationFrame(userInterface.scrollLoop);
    
    if (!userInterface.variables.scrollX && !userInterface.variables.scrollY) {
        return;    
    }
    
    userInterface.elements.canvas.xOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollX);
    userInterface.elements.canvas.yOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollY);
    
//    if (userInterface.elements.canvas.yOffset < -100) {
//        userInterface.elements.canvas.yOffset = -100;
//    } else if (userInterface.elements.canvas.yOffset > userInterface.variables.levelWidth + 100) {
//        userInterface.elements.canvas.yOffset = userInterface.variables.levelWidth + 100;
//    } 
//    
//    if (userInterface.elements.canvas.xOffset < -100) {
//        userInterface.elements.canvas.xOffset = -100;
//    } else if (userInterface.elements.canvas.xOffset < -100) {
//        userInterface.elements.canvas.xOffset = -100;
//    } 
    
};

/* EventListeners */

window.onresize = function() {
    userInterface.elements.canvas.width = window.innerWidth;
    userInterface.elements.canvas.height = window.innerHeight;
};

userInterface.canvasMoveMouseListener = function(e) {
    var rect = userInterface.elements.canvas.getBoundingClientRect();

    var posx = 0;
	var posy = 0;
	if (!e) e = window.event;
	if (e.pageX || e.pageY) {
		posx = e.pageX;
		posy = e.pageY;
	}
	else if (e.clientX || e.clientY) {
		posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
		posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
	}
	// posx and posy contain the mouse position relative to the document
	// Do something with this information
    
    mouseX = posx - rect.left;
    mouseY = posy - rect.top;
    
    if(mouseX < 100) {
        userInterface.variables.scrollX = -1;
    } else if (mouseX > userInterface.elements.canvas.width - 100) {
        userInterface.variables.scrollX = 1;
    } else {
        userInterface.variables.scrollX = 0;
    }
    
    if (mouseY < 100) {
        userInterface.variables.scrollY = -1;
    } else if (mouseY > userInterface.elements.canvas.height - 100) {
        userInterface.variables.scrollY = 1;
    } else {
        userInterface.variables.scrollY = 0;
    }
};