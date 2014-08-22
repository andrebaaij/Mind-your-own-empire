/* global Image,document,window,setTimeout,console,XMLHttpRequest,requestAnimationFrame,common,game */

var userInterface = {};
userInterface.elements = {};

game.variables.scrollSpeed = 10;
game.variables.scrollX = 0;
game.variables.scrollY = 0;
game.variables.selectedObjects = [];
game.variables.resourcesFromSelectedObjects = {};
game.variables.craftObject = null;
game.variables.selectGrid = {
        ty : null,
        by : null,
        lx : null,
        rx : null
    };
game.variables.mouseDown = false;

userInterface.initialise = function () {
    /* Elements */
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.pause = document.getElementById("pause");
    userInterface.elements.craft = document.getElementById("craft");
    
    userInterface.elements.pauseContinue = document.getElementById("pauseContinue");
    userInterface.elements.pauseFullscreen = document.getElementById("pauseFullscreen");
    userInterface.elements.menu_pause = document.getElementById("menu_pause");
    userInterface.elements.menu_craft = document.getElementById("menu_craft");
    
    /* EventListeners assignment*/
    userInterface.elements.canvas.addEventListener('mousemove', userInterface.canvasMoveMouseListener);
    userInterface.elements.canvas.addEventListener('mousedown', userInterface.canvasMouseDownListener);
    userInterface.elements.canvas.addEventListener('mouseup', userInterface.canvasClickListener);
    userInterface.elements.pauseContinue.addEventListener('click', function () {userInterface.pause("off"); });
    userInterface.elements.pauseFullscreen.addEventListener('click', function () {userInterface.fullscreen("toggle"); });
    userInterface.elements.menu_pause.addEventListener('mouseover', function () {game.variables.scrollX = 0; game.variables.scrollY = 0; });
    userInterface.elements.menu_craft.addEventListener('mouseover', function () {game.variables.scrollX = 0; game.variables.scrollY = 0; });
    
    userInterface.elements.menu_pause.addEventListener('click', function () {userInterface.pause("on"); });
    userInterface.elements.menu_craft.addEventListener('click', function () {
        // Turn the crafting ui on when the class of the menu_craft button is not off
        if (userInterface.elements.menu_craft.getAttribute("class") === "item off") { return; }
        userInterface.craft("on");
    });
    
    userInterface.elements.craft.addEventListener('click', function () {
        userInterface.craft("off");
    });
    
    window.onblur = function () {game.variables.mouseDown = false; userInterface.pause("on"); };
    
    /* Loops */
    userInterface.scrollLoop();
    
    /* initialise */
    userInterface.elements.canvas.context = userInterface.elements.canvas.getContext("2d");
    userInterface.elements.canvas.xOffset = 0;
    userInterface.elements.canvas.yOffset = 0;
    window.onresize();
};

userInterface.setVariable = function(name, value) {
    game.variables[name] = value;
};

userInterface.pause = function(command) {
    if (command === "on" ) {
        userInterface.elements.pause.style.display = "block";
        game.variables.pause = true;
    } else if (command === "off" ){
        userInterface.elements.pause.style.display = "none";
        game.variables.pause = false;
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
    for(objectName in game.objectsRepository) {
        object = game.objectsRepository[objectName];
        
        // Check if the object can be crafted
        if (typeof object.prototype.craftInformation !== 'undefined') {
            // The object can be crafted now add it to the DOM, so that a user can select to craft it.
            
            var n = objectName;
            
            var item = document.createElement('div');
                //If there are not enough resources, turn the item "off"
                var enoughResources = true;
            
                var craftResource;
                for(craftResource in object.prototype.craftInformation) {
                    if(!game.variables.resourcesFromSelectedObjects[craftResource] || game.variables.resourcesFromSelectedObjects[craftResource] < object.prototype.craftInformation[craftResource]) {
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
                    
                    game.variables.craftObject = game.objectsRepository.get(n);
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
                                
                                resource.appendChild(game.objectsRepository[objectResource].icon);
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
            if (pfx[p] === "") {
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
    
    if ((!game.variables.scrollX && !game.variables.scrollY) || userInterface.pause()) {
        return;    
    }
    
    userInterface.elements.canvas.xOffset += (game.variables.scrollSpeed * game.variables.scrollX);
    userInterface.elements.canvas.yOffset += (game.variables.scrollSpeed * game.variables.scrollY);
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
    
    var mouseX = posx - rect.left;
    var mouseY = posy - rect.top;
    
    game.variables.mouseX = mouseX;
    game.variables.mouseY = mouseY;
    
    
    var x = mouseX + userInterface.elements.canvas.xOffset,
        y = mouseY + userInterface.elements.canvas.yOffset;
    
    var grid = common.getGridFromCoordinates(x, y);      
    
    if (game.variables.mouseDown) {
        
        if (game.variables.selectGrid.ty > grid.y) {
            game.variables.selectGrid.by = game.variables.selectGrid.y;
            game.variables.selectGrid.ty = grid.y;
        } else {
            game.variables.selectGrid.by = grid.y;
            //game.variables.selectGrid.ty = Math.min(game.variables.selectGrid.ty,game.variables.selectGrid.by,grid.y);
        }
        
        game.variables.selectGrid.lx = Math.min(game.variables.selectGrid.lx,game.variables.selectGrid.rx,grid.x);
        game.variables.selectGrid.rx = Math.max(game.variables.selectGrid.lx,game.variables.selectGrid.rx,grid.x);
    } else {
        game.variables.selectGrid.ty = grid.y;
        game.variables.selectGrid.by = grid.y;
        game.variables.selectGrid.lx = grid.x;
        game.variables.selectGrid.rx = grid.x;
    }
    
    if(mouseX < 100) {
        game.variables.scrollX = -1;
    } else if (mouseX > userInterface.elements.canvas.width - 100) {
        game.variables.scrollX = 1;
    } else {
        game.variables.scrollX = 0;
    }
    
    if (mouseY < 100) {
        game.variables.scrollY = -1;
    } else if (mouseY > userInterface.elements.canvas.height - 100) {
        game.variables.scrollY = 1;
    } else {
        game.variables.scrollY = 0;
    }
};

userInterface.canvasMouseDownListener = function(e) {
    if (!game.variables.mouseDown) {
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

        var mouseX = posx - rect.left;
        var mouseY = posy - rect.top;
        
        var grid = common.getGridFromCoordinates(mouseX, mouseY);   
        
        game.variables.selectGrid.x = grid.x;
        game.variables.selectGrid.y = grid.y;

        game.variables.mouseDown = true;
    }
};

userInterface.canvasClickListener = function(e) {
    var button;
    
    game.variables.mouseDown = false;
    
    var mouseX = game.variables.mouseX;
    var mouseY = game.variables.mouseY;
    
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
        if (game.variables.craftObject !== null) {
            // Build the object
            var craftedObject = game.variables.craftObject.prototype.initialise(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
            game.variables.craftObject = null;
            
            var resources = {};
            
            for(var resource in craftedObject.craftInformation) {
                resources[resource] = craftedObject.craftInformation[resource];
            }

            game.variables.selectedObjects.forEach(function(object, index) {
                if (object.craft) {
                    object.craft(craftedObject);
                    resources = object.removeResources(resources);
                }
            });
            
            return;
        }

        game.getObjects().forEach(function(object, index) {
            object.deselect();
        });
        
        //console.log("lx:" + game.variables.selectGrid.lx + ",ty:" + game.variables.selectGrid.ty + ",rx:" + game.variables.selectGrid.rx + ",by:"+ game.variables.selectGrid.by)
  
        game.variables.selectedObjects = game.findObject(game.variables.selectGrid.lx,game.variables.selectGrid.ty, game.variables.selectGrid.rx, game.variables.selectGrid.by);

        game.variables.selectedObjects.forEach(function(object, index) {
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
            
            game.variables.resourcesFromSelectedObjects = resourcesFromSelectedObjects;
        });
        
        // if aSelectedObjectCanCraft equals true, make the 
        if (aSelectedObjectCanCraft) {
            userInterface.elements.menu_craft.setAttribute("class","item");
        } else {
            userInterface.elements.menu_craft.setAttribute("class","item off");
        }
    } else if (button === "RIGHT") {
   
        // If we have one object selected which can be initialised, it means we are in build mode.
        if (game.variables.selectedObjects.length === 1 && typeof game.variables.selectedObjects[0].initialise !== 'undefined') {
            // Do nothing on right click
            game.variables.craftObject = null;
        }
        
        if (game.variables.selectedObjects.length > 0) {
            var targetActions = [];
            
            var array = game.findObject(mouseX+userInterface.elements.canvas.xOffset,mouseY+userInterface.elements.canvas.yOffset);
            
            //Loop through target objects
            array.forEach(function(targetObject, targetObjectIndex) {
                if (!targetObject.targetActions) return;
                
                game.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {
                    if (!selectedObject.skills) return;
                    
                    selectedObject.skills.forEach(function(skill) {
                        if (targetObject.targetActions.indexOf(skill) !== -1 && targetActions.indexOf(skill) === -1) {
                            var targetActionAlreadyExists = false;
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
                game.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {   
                    if(!selectedObject[targetActions[0].skill]) return;         
                    selectedObject[targetActions[0].skill](targetActions[0].object);
                });
            } else {
                game.variables.selectedObjects.forEach(function(selectedObject, selectedObjectIndex) {
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
    
    game.variables.selectedObjects.forEach(function(object, index) {
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

        game.variables.resourcesFromSelectedObjects = resourcesFromSelectedObjects;
    });
};
