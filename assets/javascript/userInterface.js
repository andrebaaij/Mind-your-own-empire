var userInterface = {};
userInterface.elements = {};

userInterface.variables = {
    scrollSpeed : 10,
    scrollX : 0,
    scrollY : 0,
    objects_selected : []
};

userInterface.initialise = function() {
    /* Elements */
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.pause = document.getElementById("pause");
    userInterface.elements.pauseContinue = document.getElementById("pauseContinue");
    userInterface.elements.pauseFullscreen = document.getElementById("pauseFullscreen");
    userInterface.elements.menu_pause = document.getElementById("menu_pause");
    
    /* EventListeners assignment*/
    userInterface.elements.canvas.addEventListener('mousemove',userInterface.canvasMoveMouseListener);
    userInterface.elements.canvas.addEventListener('mouseup',userInterface.canvasClickListener);
    userInterface.elements.pauseContinue.addEventListener('click',function() {userInterface.pause("off");});
    userInterface.elements.pauseFullscreen.addEventListener('click',function() {userInterface.fullscreen("toggle");});
    userInterface.elements.menu_pause.addEventListener('mouseover',function() {userInterface.variables.scrollX = 0;userInterface.variables.scrollY = 0;});
    userInterface.elements.menu_pause.addEventListener('click',function() {userInterface.pause("on");});
    
    window.onblur = function() {userInterface.pause("on");};
    
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

userInterface.pause = function(command) {
    if (command === "on" ) {
        userInterface.elements.pause.style.display = "block";
    } else if (command === "off" ){
        userInterface.elements.pause.style.display = "none";
    }
    
    return userInterface.elements.pause.style.display === "block";
};

userInterface.fullscreen = function(command) {
    var pfx = ["webkit", "moz", "ms", "o", ""];
    function RunPrefixMethod(obj, method) {

        var p = 0, m, t;
        while (p < pfx.length && !obj[m]) {
            m = method;
            if (pfx[p] == "") {
                m = m.substr(0,1).toLowerCase() + m.substr(1);
            }
            m = pfx[p] + m;
            t = typeof obj[m];
            if (t != "undefined") {
                pfx = [pfx[p]];
                return (t == "function" ? obj[m]() : obj[m]);
            }
            p++;
        }

    }

    if (command === "on" ) {
        RunPrefixMethod(document.getElementById("wrapper"), "RequestFullScreen");
    } else if (command === "off" ){
        RunPrefixMethod(document, "CancelFullScreen");
    } else if (command === "toggle" ) {
        if (userInterface.fullscreen()) {
            userInterface.fullscreen("off");
        } else {
            userInterface.fullscreen("on");
        }
    }
    
    return RunPrefixMethod(document, "FullScreen") || RunPrefixMethod(document, "IsFullScreen");
};

userInterface.scrollLoop = function() {
    requestAnimationFrame(userInterface.scrollLoop);
    
    if ((!userInterface.variables.scrollX && !userInterface.variables.scrollY) || userInterface.pause()) {
        return;    
    }
    
    userInterface.elements.canvas.xOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollX);
    userInterface.elements.canvas.yOffset += (userInterface.variables.scrollSpeed * userInterface.variables.scrollY);
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

userInterface.canvasClickListener = function(e) {
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
    
    if (e.which === null) {
        /* IE case */
        button = (e.button < 2) ? "LEFT" :
                 ((e.button == 4) ? "MIDDLE" : "RIGHT");
    } else {
        /* All others */
        button = (e.which < 2) ? "LEFT" :
                 ((e.which == 2) ? "MIDDLE" : "RIGHT");
    }
    
    if (button === "LEFT") {
        objects.list().forEach(function(object, index) {
            object.deselect();
        });
        
        userInterface.variables.objects_selected = objects.find(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
        
        userInterface.variables.objects_selected.forEach(function(object, index) {
            object.select();
        });
        
    } 
    if (button === "RIGHT") {
        
        if (userInterface.variables.objects_selected.length > 0) {
            var targetActions = [];
            
            array = objects.find(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
            
            //Loop through target objects
            array.forEach(function(targetObject, targetObjectIndex) {
                userInterface.variables.objects_selected.forEach(function(selectedObject, selectedObjectIndex) {
                    selectedObject.skills.forEach(function(skill) {
                        if (targetObject.targetActions.indexOf(skill) !== -1 && targetActions.indexOf(skill) === -1) {
                            targetActionAlreadyExists = false;
                            targetActions.forEach(function(action) {
                                if (action.skill === skill) {
                                    targetActionAlreadyExists = true;
                                }
                            });
                            if (!targetActionAlreadyExists) {                       
                                targetActions.push({skill : skill, object : targetObject});
                            }
                        }
                    });
                });
            });            
            
            if (targetActions.length > 1) {
                console.log(targetActions);
            } else if (targetActions.length === 1) {
                 userInterface.variables.objects_selected.forEach(function(selectedObject, selectedObjectIndex) {
                    selectedObject[targetActions[0].skill](targetActions[0].object);
                });
            } else {
                userInterface.variables.objects_selected.forEach(function(selectedObject, selectedObjectIndex) {
                    console.log(selectedObject);
                    selectedObject.walk(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
                });
            }
            
            
        }
    }
};