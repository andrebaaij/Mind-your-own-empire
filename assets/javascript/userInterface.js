var userInterface = {};
userInterface.elements = {};
userInterface.variables = {
    scrollSpeed : 1,
    scrollX : 0,
    scrollY : 0
};


userInterface.initialise = function() {
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.canvas.context = canvas.getContext("2d");
    
    userInterface.elements.canvas.addEventListener('mousemove',userInterface.canvasMoveMouseListener);
    
    userInterface.scrollLoop();

    userInterface.elements.canvas.xOffset = 0;
    userInterface.elements.canvas.yOffset = 0;
    window.onresize();
};

window.onresize = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

userInterface.canvasMoveMouseListener = function(e) {
    var rect = userInterface.elements.canvas.getBoundingClientRect();

    var posx = 0;
	var posy = 0;
	if (!e) var e = window.event;
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
        userInterface.variables.scrollY = 1;
    } else if (mouseY > userInterface.elements.canvas.height - 100) {
        userInterface.variables.scrollY = -1;
    } else {
        userInterface.variables.scrollY = 0;
    }
};

userInterface.scrollLoop = function() {
    //console.log("scrollLoop");
    //console.log(userInterface.variables.scrollX);
    //console.log(userInterface.elements.canvas.xOffset);
    
    
    requestAnimationFrame(userInterface.scrollLoop);
    
    if (!userInterface.variables.scrollX && !userInterface.variables.scrollY) {
        return;    
    }
    
    userInterface.elements.canvas.xOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollX);
    userInterface.elements.canvas.yOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollY);
    
};