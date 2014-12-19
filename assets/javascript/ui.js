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
    data.DOM.$canvas.mousemove( function(e) { ui.eventCanvasMousemove(e, data.mouse);});
    data.DOM.$canvas.mousedown( function(e) { ui.eventCanvasMousedown(e, data.mouse, data.scroll); });
    data.DOM.$canvas.mouseup(   function(e) { ui.eventCanvasMouseup(e, data.mouse);});
    data.DOM.pauseContinue.addEventListener('click',    function () {ui.showPause(false); });
    data.DOM.pauseFullscreen.addEventListener('click',  function () {ui.showFullscreen(); });
    data.DOM.menu_pause.addEventListener('click',       function () {ui.showPause(true); });
    $(window).blur(function() {
        data.mouseDown = false;
        ui.showPause(true);
    });
    data.DOM.$document.keydown(function(e) {ui.eventDocumentKeydown(e, data.keyboard);});
    data.DOM.$document.keyup(function(e) {ui.eventDocumentKeyup(e, data.keyboard);});

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

ui.eventCanvasMousemove = function(event, mouse) {
    mouse.x = event.pageX;
    mouse.y = event.pageY;

    var grid = common.getGridFromScreen(data.scroll, mouse.x, mouse.y);

    if (mouse.left) {
        if (mouse.selection.grid.y < grid.y) {
            mouse.selection.ty = mouse.selection.grid.y;
            mouse.selection.by = grid.y;
        } else {
            mouse.selection.by = mouse.selection.grid.y;
            mouse.selection.ty = grid.y;
        }

        if (mouse.selection.grid.x < grid.x) {
            mouse.selection.rx = grid.x;
            mouse.selection.ly = mouse.selection.grid.x;
        } else {
            mouse.selection.lx = grid.x;
            mouse.selection.rx = mouse.selection.grid.x;
        }

    } else {
        mouse.selection.ty = grid.y;
        mouse.selection.by = grid.y;
        mouse.selection.lx = grid.x;
        mouse.selection.rx = grid.x;
    }
};

ui.eventCanvasMousedown = function(event, mouse, scroll) {
    if (event.which === 1) {
        mouse.left = true;
    } else if (event.which === 2) {
        mouse.middle = true;
    } else if (event.which === 3) {
        mouse.right = true;
    }
        
    if (mouse.left) {
        mouse.x = event.pageX;
        mouse.y = event.pageY;

        mouse.selection.grid = common.getGridFromScreen(scroll, mouse.x, mouse.y);
    }
};

ui.eventCanvasMouseup = function(event, mouse) {
    if (event.which === 1) {
        mouse.left = false;
    } else if (event.which === 2) {
        mouse.middle = false;
    } else if (event.which === 3) {
        mouse.right = false;
    }

    mouse.x = event.pageX;
    mouse.y = event.pageY;
    
    if (mouse.left) {
        ui.eventCanvasMouseup_left(mouse);
    } else if (mouse.right) {
        ui.eventCanvasMouseup_right(mouse);
    }
};

ui.eventCanvasMouseup_left = function (mouse) {
    // If we have a craft object selected it means we are in build mode.
    if (data.craftObject !== null) {
        // Build the object

        // Are there enough resources available?
        if (data.resources.iron >= data.craftObject.prototype.defaults.cost.iron) {
            // Subract the resources
            data.resources.iron -= data.craftObject.prototype.defaults.cost.iron;

            // Update the resources ui
            ui.updateIron(data.resources.iron);

            data.craftObject.prototype.initialise(grid.x, grid.y);
            
            if(!keyboard.shift) {
                data.craftObject = null;
            }
        } else {
            console.log("Not enough resources", data.resources.iron, data.craftObject.prototype.defaults.cost.iron);
        }
        return;
    }
    
    // Deselect all currently selected objects
    mouse.selection.objects.forEach(function(object) {
        object.deselect();
    });

    // Select objects based on the selection grid.
    mouse.selection.objects = objects.find(mouse.selection.lx, mouse.selection.ty, mouse.selection.rx, mouse.selection.by);
    
    // Select the found objects.
    mouse.selection.objects.forEach(function(object) {
        object.select();
    });

};

ui.eventCanvasMouseup_right = function (mouse, craftObject, selectedObjects) {
    var grid = common.getGridFromScreen(data.scroll, mouse.x, mouse.y);
    
    if (mouse.selection.objects.length > 0) {
        var resources = [];

        resources = level.findResource(grid);

        if (resources.length > 0) {
            mouse.selection.objects.forEach(function(object) {
                if(typeof object.gather === 'undefined') {
                    return;
                }

                resources.forEach(function(resource) {
                    object.gather(resource); 
                });
            });
        } else {
            mouse.selection.objects.forEach(function(selectedObject) {
                if (selectedObject.walk) {
                    var coordinates = common.getCoordinatesFromScreen(data.scroll,mouseX,mouseY);
                    selectedObject.walk(coordinates.x,coordinates.y);
                }
            });
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

ui.eventDocumentKeydown = function(e, keyboard) {
    switch(e.which) {
        case 65: // left
        keyboard.a = true;
        break;

        case 87: // up
        keyboard.w = true;
        break;

        case 68: // right
        keyboard.d = true;
        break;

        case 83: // down
        keyboard.s = true;
        break;

        case 16: // shift
        keyboard.shift = true;
        break;

        default: return; // exit this handler for other keys


    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
};

ui.eventDocumentKeyup = function(e, keyboard) {
    switch(e.which) {
        case 65: // left
        keyboard.a = false;
        break;

        case 87: // up
        keyboard.w = false;
        break;

        case 68: // right
        keyboard.d = false;
        break;

        case 83: // down
        keyboard.s = false;
        break;

        case 16: // shift
        keyboard.shift = false;
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

ui.scrollLoop = function(context, scroll, keyboard) {
    scroll.x = 0;
    scroll.y = 0;
    
    if (keyboard.w) {
        scroll.y += scroll.speed;    // UP
    }
    if (keyboard.s) {
        scroll.y -= scroll.speed;    // DOWN
    }
    if (keyboard.a) {
        scroll.x += scroll.speed;    //LEFT
    }
    if (keyboard.d) {
        scroll.x -= scroll.speed;    //RIGHT
    }
    
    // Is the player actuaylly scrolling through the level?
    if (scroll.x !== 0 || scroll.y !== 0) {
        // Speed up 
        if (keyboard.shift) {
            scroll.x *= scroll.shiftMultiplier;
            scroll.y *= scroll.shiftMultiplier;
        }
        
        scroll.offset.x += scroll.x;
        scroll.offset.y += scroll.y;
        
        contextGL.translate(context, scroll.offset.x, scroll.offset.y);
    }
    
    return scroll;
};
