/* global data,$,level,document,window,console,common,game,contextGL */

var ui = {};

ui.initialise = function () {

    /* DOM elements */
    data.DOM = {
        $document : $(document),
        canvas : document.getElementById("canvas"),
        $canvas : $("#canvas"),
        pause : document.getElementById("pause"),
        craft : document.getElementById("craft"),
        pauseContinue : document.getElementById("pauseContinue"),
        pauseFullscreen : document.getElementById("pauseFullscreen"),
        menu_pause : document.getElementById("menu_pause"),
        menu_craft : document.getElementById("menu_craft")
    };

    /* EventListeners assignment*/
    data.DOM.$canvas.mousemove(ui.eventCanvasMousemove);
    data.DOM.$canvas.mousedown(ui.eventCanvasMousedown);
    data.DOM.$canvas.mouseup(ui.eventCanvasMouseup);
    data.DOM.pauseContinue.addEventListener('click',    function () {ui.showPause(false); });
    data.DOM.pauseFullscreen.addEventListener('click',  function () {ui.showFullscreen(); });
    data.DOM.menu_pause.addEventListener('click',       function () {ui.showPause(true); });
    $(window).blur(function() {
        data.mouseDown = false;
        ui.showPause(true);
    });
    data.DOM.$document.keydown(function(e) {ui.eventDocumentKeydown(e, data.scroll);});
    data.DOM.$document.keyup(function(e) {ui.eventDocumentKeyup(e, data.scroll);});

    /* initialise */
    data.DOM.canvas.context = contextGL.get(data.DOM.canvas);
    contextGL.dimensions(data.DOM.canvas.context, window.innerWidth, window.innerHeight);
    data.DOM.canvas.xOffset = 0;
    data.DOM.canvas.yOffset = 0;
    window.onresize = ui.eventWindowResize;
    ui.updateEnergy(data.resources.energy);
    ui.updateIron(data.resources.iron);
    ui.showFullscreen(true);
};

/* Window */

ui.eventWindowResize = function() {
    data.DOM.canvas.width = window.innerWidth;
    data.DOM.canvas.height = window.innerHeight;

    var scale = common.scaleNumber(1);

    contextGL.dimensions(data.DOM.canvas.context, window.innerWidth, window.innerHeight);
    contextGL.scale(data.DOM.canvas.context, scale);
};

/* Pause */

ui.showPause = function(show) {
    if (show) {
        data.DOM.pause.style.display = "block";
    } else {
        data.DOM.pause.style.display = "none";
    }

    return data.DOM.pause.style.display === "block";
};

/* Canvas */

ui.eventCanvasMousemove = function(event) {
    console.log(event);

    var mouseX = data.mouseX = event.pageX;
    var mouseY = data.mouseY = event.pageY;

    var grid = common.getGridFromScreen(data.DOM.canvas, mouseX, mouseY);

    if (data.mouseDown) {
        if (data.selectGrid.y < grid.y) {
            data.selectGrid.ty = data.selectGrid.y;
            data.selectGrid.by = grid.y;
        } else {
            data.selectGrid.by = data.selectGrid.y;
            data.selectGrid.ty = grid.y;
        }

        if (data.selectGrid.x < grid.x) {
            data.selectGrid.rx = grid.x;
            data.selectGrid.ly = data.selectGrid.x;
        } else {
            data.selectGrid.lx = grid.x;
            data.selectGrid.rx = data.selectGrid.x;
        }

    } else {
        data.selectGrid.ty = grid.y;
        data.selectGrid.by = grid.y;
        data.selectGrid.lx = grid.x;
        data.selectGrid.rx = grid.x;
    }
};

ui.eventCanvasMousedown = function(event) {
    if (!data.mouseDown) {
        var mouseX = data.mouseX = event.pageX;
        var mouseY = data.mouseY = event.pageY;

        var grid = common.getGridFromScreen(data.DOM.canvas, mouseX, mouseY);

        data.selectGrid.x = grid.x;
        data.selectGrid.y = grid.y;

        data.mouseDown = true;
    }
};

ui.eventCanvasMouseup = function(event) {
    var button;

    data.mouseDown = false;

    var mouseX = data.mouseX = event.pageX;
    var mouseY = data.mouseY = event.pageY;
    var grid = common.getGridFromScreen(data.DOM.canvas, data.mouseX, data.mouseY);
    var coordinates = common.getCoordinatesFromGrid(grid.x, grid.y);

    /* IE case */
    if (event.which === null) {
        button = (event.button < 2) ? "LEFT" : ((event.button == 4) ? "MIDDLE" : "RIGHT");
    } else { /* All others */
        button = (event.which < 2) ? "LEFT" : ((event.which == 2) ? "MIDDLE" : "RIGHT");
    }

    if (button === "LEFT") {
        // Reset all flags that will be evaluated later
        var aSelectedObjectCanCraft = false,
            resourcesFromSelectedObjects = {};

        // If we have one craft object selected it means we are in build mode.
        if (data.craftObject !== null) {
            // Build the object
            if (data.resources.iron > data.craftObject.defaults.cost.iron) {
                data.resources.iron -= data.craftObject.defaults.cost.iron;
                ui.updateIron(data.resources.iron);

                data.craftObject.prototype.initialise(grid.x, grid.y);
                data.craftObject = null;
            } else {
                //ui.log()
                console.log("Not enough resources");
            }
            return;
        }

        game.getObjects().forEach(function(object, index) {
            object.deselect();
        });

        data.selectedObjects = game.findObject(data.selectGrid.lx,data.selectGrid.ty, data.selectGrid.rx, data.selectGrid.by);

        data.selectedObjects.forEach(function(object, index) {
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

            data.resourcesFromSelectedObjects = resourcesFromSelectedObjects;
        });

        // if aSelectedObjectCanCraft equals true, make the
        if (aSelectedObjectCanCraft) {
            data.DOM.menu_craft.setAttribute("class","item");
        } else {
            data.DOM.menu_craft.setAttribute("class","item off");
        }
    } else if (button === "RIGHT") {

        // If we have one object selected which can be initialised, it means we are in build mode.
        if (data.selectedObjects.length === 1 && typeof data.selectedObjects[0].initialise !== 'undefined') {
            // Do nothing on right click
            data.craftObject = null;
        }

        if (data.selectedObjects.length > 0) {
            var targetActions = [];

            var array = game.findObject(mouseX+data.DOM.canvas.xOffset,mouseY+data.DOM.canvas.yOffset);

            //Loop through target objects
            array.forEach(function(targetObject) {
                if (!targetObject.targetActions) return;

                data.selectedObjects.forEach(function(selectedObject) {
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

            var targetedResources = [];

            // check for available resources
            if (targetActions.length === 0) {
                var grid = common.getGridFromScreen(data.DOM.canvas, mouseX, mouseY);
                targetedResources = level.findResource(grid);
//                console.log(grid);
//                console.log(targetedResources);
//
//                console.log(common.getCoordinatesFromScreen(data.DOM.canvas, mouseX, mouseY));
//                console.log(data.DOM.canvas.xOffset, data.DOM.canvas.yOffset);
//                console.log(mouseX, mouseY);
            }



            // First check for actions on objects
            if (targetActions.length > 1) {
                console.log(targetActions);
            } else if (targetActions.length === 1) {
                data.selectedObjects.forEach(function(selectedObject) {
                    if(!selectedObject[targetActions[0].skill]) {
                        return;
                    }

                    selectedObject[targetActions[0].skill](targetActions[0].object);
                });
            } else if (targetedResources.length > 0) {
                data.selectedObjects.forEach(function(selectedObject) {
                    if(typeof selectedObject.gather === 'undefined') {
                        return;
                    }

                    selectedObject.gather(targetedResources[0]);
                });
            } else {
                data.selectedObjects.forEach(function(selectedObject) {
                    if (selectedObject.walk) {
                        var coordinates = common.getCoordinatesFromScreen(data.DOM.canvas,mouseX,mouseY);
                        selectedObject.walk(coordinates.x,coordinates.y);
                    }
                });
            }


        }
    }
};

/* Energy */

ui.updateEnergy = function(amount) {
    $('#energy').text(amount);
};

/* Iron */

ui.updateIron = function(amount) {
    $('#iron').text(amount);
};

/* Keyboard */

ui.eventDocumentKeydown = function(e, scroll) {
    switch(e.which) {
        case 65: // left
        scroll.x = 1;
        break;

        case 87: // up
        scroll.y = 1;
        break;

        case 68: // right
        scroll.x = -1;
        break;

        case 83: // down
        scroll.y = -1;
        break;

        case 16: // shift
        scroll.speed = 15;
        break;

        default: return; // exit this handler for other keys


    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
};

ui.eventDocumentKeyup = function(e, scroll) {
    switch(e.which) {
        case 65: // left
        scroll.x = 0;
        break;

        case 87: // up
        scroll.y = 0;
        break;

        case 68: // right
        scroll.x = 0;
        break;

        case 83: // down
        scroll.y = 0;
        break;

        case 16: // shift
        scroll.speed = 5;
        break;

        default: return; // exit this handler for other keys


    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
};

/* Miscellaneous */

ui.isFullscreen = function() {
    return common.RunPrefixMethod(document, "FullScreen") || common.RunPrefixMethod(document, "IsFullScreen");
};

ui.showFullscreen = function(showFullscreen) {
    if (showFullscreen === true) {
        common.RunPrefixMethod(document.getElementById("wrapper"), "RequestFullScreen");
    } else if (showFullscreen === false){
        common.RunPrefixMethod(document, "CancelFullScreen");
    } else {
        if (ui.isFullscreen()) {
            ui.showFullscreen(false);
        } else {
            ui.showFullscreen(true);
        }
    }

    return ui.isFullscreen();
};

ui.scrollLoop = function(canvas, scroll) {
    if (!scroll.x && !scroll.y) {
        return;
    }

    canvas.xOffset += (scroll.speed * scroll.x);
    canvas.yOffset += (scroll.speed * scroll.y);
};
