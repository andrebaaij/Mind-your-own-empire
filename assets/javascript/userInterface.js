var userInterface = {};
userInterface.elements = {};

userInterface.variables = {
    scrollSpeed : 10,
    scrollX : 0,
    scrollY : 0,
    selectedObjects : [],
    resourcesFromSelectedObjects : {},
    craftObject : null
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
    userInterface.elements.menu_craft.addEventListener('click',function() {
        // Turn the crafting ui on when the class of the menu_craft button is not off
        if(userInterface.elements.menu_craft.getAttribute("class") === "item off") return;
        userInterface.craft("on");
    });
    
    userInterface.elements.craft.addEventListener('click',function() {
        userInterface.craft("off");
    });
    
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
    
    userInterface.recalculateResources();
    
    var object,
        objectName;
    
    var node = document.createElement('div');
            node.setAttribute("class","window");
    
    //Loop through all objects in the repository
    for(objectName in objects.repository) {
        object = objects.repository[objectName];
        
        // Check if the object can be crafted
        if (typeof object.prototype.craftInformation !== 'undefined') {
            // The object can be crafted now add it to the DOM, so that a user can select to craft it.
            
            var n = objectName;
            
            var item = document.createElement('div');
                //If there are not enough resources, turn the item "off"
                var enoughResources = true;
            
                var craftResource;
                for(craftResource in object.prototype.craftInformation) {
                    if(!userInterface.variables.resourcesFromSelectedObjects[craftResource] || userInterface.variables.resourcesFromSelectedObjects[craftResource] < object.prototype.craftInformation[craftResource]) {
                        enoughResources = false;
                    }
                }
                
                if (enoughResources)  {
                    item.setAttribute("class","item");
                } else {
                    item.setAttribute("class","item off");
                }
            
                item.addEventListener('click',function(Event) {
                    // If the item is "off", not enough resources are available, thus return;
                    if (item.getAttribute("class") === 'item off') return;
                    
                    userInterface.variables.craftObject = objects.repository.get(n);
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
                        for(objectResource in object.prototype.craftInformation) {
                            var resource = document.createElement('div');
                                resource.setAttribute("class","resource");
                                
                                resource.appendChild(objects.repository[objectResource].icon);
                                resource.appendChild(document.createTextNode(" x " + object.prototype.craftInformation[objectResource]));
                        
                            resources.appendChild(resource);
                        }
            
                     div.appendChild(resources);   
                        
                        
                item.appendChild(div);
                    
            
            node.appendChild(item);
            
        }
        
    }
    
    // Clear previous craft
    while (userInterface.elements.craft.firstChild) {
        userInterface.elements.craft.removeChild(userInterface.elements.craft.firstChild);
    }

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
    
    userInterface.variables.mouseX = mouseX;
    userInterface.variables.mouseY = mouseY;
    
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
    mouseX = userInterface.variables.mouseX;
    mouseY = userInterface.variables.mouseY;
    
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
        // Reset all flags that will be evaluated later
        var aSelectedObjectCanCraft = false,
            resourcesFromSelectedObjects = {};
        
        // If we have one craft object selected it means we are in build mode.
        if (userInterface.variables.craftObject !== null) {
            // Build the object
            craftedObject = userInterface.variables.craftObject.prototype.initialise(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
            userInterface.variables.craftObject = null;
            
            var resources = {};
            
            for(var resource in craftedObject.craftInformation) {
                resources[resource] = craftedObject.craftInformation[resource];
            }

            userInterface.variables.selectedObjects.forEach(function(object, index) {
                if (object.craft) {
                    object.craft(craftedObject);
                    resources = object.removeResources(resources);
                }
            });
            
            return;
        }

        objects.list().forEach(function(object, index) {
            object.deselect();
        });

        userInterface.variables.selectedObjects = objects.find(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);

        userInterface.variables.selectedObjects.forEach(function(object, index) {
            object.select();
            
            // If one of the objects can craft, turn the flag aSelectedObjectCanCraft to true;
            if (object.skills && object.skills.indexOf("craft") !== -1) {
                aSelectedObjectCanCraft = true;
                
                if (object.resources) {
                    var resource;
                    for (resource in object.resources) {
                        if (resourcesFromSelectedObjects[resource]) resourcesFromSelectedObjects[resource] += object.resources[resource];
                        else resourcesFromSelectedObjects[resource] = object.resources[resource];
                    }
                }
            }
            
            userInterface.variables.resourcesFromSelectedObjects = resourcesFromSelectedObjects;
        });
        
        // if aSelectedObjectCanCraft equals true, make the 
        if (aSelectedObjectCanCraft) {
            userInterface.elements.menu_craft.setAttribute("class","item");
        } else {
            userInterface.elements.menu_craft.setAttribute("class","item off");
        }
    } else if (button === "RIGHT") {
   
        // If we have one object selected which can be initialised, it means we are in build mode.
        if (userInterface.variables.selectedObjects.length === 1 && typeof userInterface.variables.selectedObjects[0].initialise !== 'undefined') {
            // Do nothing on right click
            userInterface.variables.craftObject = null;
        }
        
        if (userInterface.variables.selectedObjects.length > 0) {
            var targetActions = [];
            
            array = objects.find(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
            
            //Loop through target objects
            array.forEach(function(targetObject, targetObjectIndex) {
                if (!targetObject.targetActions) return;
                
                userInterface.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {
                    if (!selectedObject.skills) return;
                    
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
                userInterface.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {   
                    if(!selectedObject[targetActions[0].skill]) return;         
                    selectedObject[targetActions[0].skill](targetActions[0].object);
                });
            } else {
                userInterface.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {
                    if (selectedObject.walk) {
                        selectedObject.walk(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
                    }
                });
            }
            
            
        }
    }
};



userInterface.recalculateResources = function() {
    var resourcesFromSelectedObjects = {};
    
    userInterface.variables.selectedObjects.forEach(function(object, index) {
        object.select();

        // If one of the objects can craft, turn the flag aSelectedObjectCanCraft to true;
        if (object.skills && object.skills.indexOf("craft") !== -1) {
            if (object.resources) {
                var resource;
                for (resource in object.resources) {
                    if (resourcesFromSelectedObjects[resource]) resourcesFromSelectedObjects[resource] += object.resources[resource];
                    else resourcesFromSelectedObjects[resource] = object.resources[resource];
                }
            }
        }

        userInterface.variables.resourcesFromSelectedObjects = resourcesFromSelectedObjects;
    });
};




















//
//single_double_click = function(element, single_click_callback, double_click_callback, timeout) {   
//  return function(){
//    var clicks = 0, self = this;
//    element.addEventListener('click',function(event){
//      clicks++;
//      if (clicks == 1) {
//        setTimeout(function(){
//          if(clicks == 1) {
//            single_click_callback.call(self, event);
//          } else {
//            double_click_callback.call(self, event);
//          }
//          clicks = 0;
//        }, timeout || 300);
//      }
//    });
//  };
//}
//
//
//var button = document.getElementById('button');
//   
//single_double_click(button,
//                    function () { alert("Try double-clicking me!")},
//                    function () { alert("Double click detected, I'm hiding") //$(this).hide()
//})()
