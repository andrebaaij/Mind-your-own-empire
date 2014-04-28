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
    userInterface.elements.craft = document.getElementById("craft");
    
    userInterface.elements.pauseContinue = document.getElementById("pauseContinue");
    userInterface.elements.pauseFullscreen = document.getElementById("pauseFullscreen");
    userInterface.elements.menu_pause = document.getElementById("menu_pause");
    userInterface.elements.menu_craft = document.getElementById("menu_craft");
    
    /* EventListeners assignment*/
    userInterface.elements.canvas.addEventListener('mousemove',userInterface.canvasMoveMouseListener);
    userInterface.elements.canvas.addEventListener('mouseup',userInterface.canvasClickListener);
    userInterface.elements.pauseContinue.addEventListener('click',function() {userInterface.pause("off");});
    userInterface.elements.pauseFullscreen.addEventListener('click',function() {userInterface.fullscreen("toggle");});
    userInterface.elements.menu_pause.addEventListener('mouseover',function() {userInterface.variables.scrollX = 0;userInterface.variables.scrollY = 0;});
    userInterface.elements.menu_craft.addEventListener('mouseover',function() {userInterface.variables.scrollX = 0;userInterface.variables.scrollY = 0;});
    
    userInterface.elements.menu_pause.addEventListener('click',function() {userInterface.pause("on");});
    userInterface.elements.menu_craft.addEventListener('click',function() {userInterface.craft("on");});
    
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

userInterface.craft = function(command) {
    // Fill the DOM with craftable objects as :
    
    /*
    <div class="item">
        <img class="icon" src="assets/images/icons/totemPole.png"/>
        <div>
            <h1>Totem Pole</h1>
            <div class="resources">
                <div class="resource">
                    <img class="icon" src="assets/images/icons/log.png"> x 35
                </div>
            </div>
        </div>
    </div>
    */
    var object;
    var node = document.createElement('div');
            node.setAttribute("class","window");
    
    //Loop through all objects in the repository
    for(objectName in objects.repository) {
        object = objects.repository[objectName];
        
        console.log(object.prototype.craft);
        
        // Check if the object can be crafted
        if (typeof object.prototype.craft !== 'undefined') {
            // The object can be crafted now add it to the DOM, so that a user can select to craft it.
            
            var n = objectName;
            
            var item = document.createElement('div');
                item.setAttribute("class","item");
                item.addEventListener('click',function(Event) {
                    // Clear the selected Object list;
                    userInterface.variables.objects_selected.length = 0;
                    // Go into build mode by setting the first selected Object as a repository object which has a initialise function.
                    userInterface.variables.objects_selected.push(objects.repository.get(n));
                    // Hide the craft menu
                    userInterface.craft("off");
                });
            
                item.appendChild(object.prototype.icon);

                var div = document.createElement('div');
                    var name = document.createElement('h1');
                        name.appendChild(document.createTextNode(objectName));
                    
                    div.appendChild(name);
            
                    var resources = document.createElement('div');
                        resources.setAttribute("class","resources");
            
                        var objectResource;
                        for(objectResource in object.prototype.craft) {
                            var resource = document.createElement('div')
                                resource.setAttribute("class","resource");
                                
                                resource.appendChild(objects.repository[objectResource].icon);
                                resource.appendChild(document.createTextNode(" x " + object.prototype.craft[objectResource]));
                        
                            resources.appendChild(resource);
                        }
            
                     div.appendChild(resources);   
                        
                        
                item.appendChild(div);
                    
            
            node.appendChild(item)
            
        }
        
    }
    
    // Clear previous craft
    while (userInterface.elements.craft.firstChild) {
        userInterface.elements.craft.removeChild(userInterface.elements.craft.firstChild);
    }
    console.log(node);
    userInterface.elements.craft.appendChild(node);
    
    
    if (command === "on" ) {
        userInterface.elements.craft.style.display = "block";
    } else if (command === "off" ){
        userInterface.elements.craft.style.display = "none";
    }
    
    return userInterface.elements.craft.style.display === "block";
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
    
        // If we have one object selected which can be initialised, it means we are in build mode.
        if (userInterface.variables.objects_selected.length === 1 && typeof userInterface.variables.objects_selected[0].prototype !== 'undefined') {
            // Build the object
            console.log('BUILD');
            userInterface.variables.objects_selected[0].prototype.initialise(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
        }
        
        objects.list().forEach(function(object, index) {
            object.deselect();
        });

        userInterface.variables.objects_selected = objects.find(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);

        userInterface.variables.objects_selected.forEach(function(object, index) {
            object.select();
        });

    } else if (button === "RIGHT") {
        // If we have one object selected which can be initialised, it means we are in build mode.
        if (userInterface.variables.objects_selected.length === 1 && typeof userInterface.variables.objects_selected[0].initialise !== 'undefined') {
            // Do nothing on right click
        }
        
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
                    if (selectedObject.walk) {
                        selectedObject.walk(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
                    }
                });
            }
            
            
        }
    }
};