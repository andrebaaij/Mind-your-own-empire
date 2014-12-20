/* global data,$,level,document,window,console,common,contextGL, objects */

var ui = {};

/**
 * Initialise the ui object
 */
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
    data.DOM.$canvas.mouseup(   function(e) { ui.eventCanvasMouseup(e, data.mouse, data.keyboard, data.scroll, data.resources, data.craftObject);});
    data.DOM.pauseContinue.addEventListener('click',    function () {ui.showPause(false); });
    data.DOM.pauseFullscreen.addEventListener('click',  function () {ui.showFullscreen(); });
    data.DOM.menu_pause.addEventListener('click',       function () {ui.showPause(true); });
    $(window).blur(function() {
        data.mouseDown = false;
        ui.showPause(true);
    });
    data.DOM.$document.keydown(function(e) {ui.eventDocumentKeydown(e, data.keyboard, data.mouse);});
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

/**
 * When the window resizes, resize the wrapper object with it.
 */
ui.eventWindowResize = function() {
    data.DOM.canvas.width = window.innerWidth;
    data.DOM.canvas.height = window.innerHeight;

    var scale = common.scaleNumber(1);

    contextGL.dimensions(data.DOM.canvas.context, window.innerWidth, window.innerHeight);
    contextGL.scale(data.DOM.canvas.context, scale);
};

/* Pause */

/**
 * Display, hide or toggle the pause overlay
 * @param   {Boolean} show true: show, false: hide, undefined = toggle
 * @returns {Boolean} display state of the pause overlay
 */
ui.showPause = function(show) {
    if (show === true) {
        data.DOM.pause.style.display = "block";
    } else if (show === false) {
        data.DOM.pause.style.display = "none";
    } else {
        if (data.DOM.pause.style.display === "none") {
            ui.showPause(true);
        } else {
            ui.showPause(false);
        }
    }

    return data.DOM.pause.style.display === "block";
};

/* Canvas */

/**
 * Event listener for mouse movement on the canvas object.
 * @param {Object} event mouse movement event
 * @param {Object} mouse data.mouse
 */
ui.eventCanvasMousemove = function(event, mouse) {
    mouse.x = event.pageX;
    mouse.y = event.pageY;

    var grid = common.getGridFromScreen(data.scroll, mouse.x, mouse.y);

    if (mouse.left || mouse.right) {
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

/**
 * Event listener for mouse down on the canvas object.
 * @param {Object} event  mouse down event
 * @param {Object} mouse  data.mouse
 * @param {Object} scroll data.scroll
 */
ui.eventCanvasMousedown = function(event, mouse, scroll) {
    if (event.which === 1) {
        mouse.left = true;
    } else if (event.which === 2) {
        mouse.middle = true;
    } else if (event.which === 3) {
        mouse.right = true;
    }

    if (mouse.left || mouse.right) {
        mouse.x = event.pageX;
        mouse.y = event.pageY;

        mouse.selection.grid = common.getGridFromScreen(scroll, mouse.x, mouse.y);
    }
};

/**
 * Event listener for mouse up on the canvas object
 * @param {Object} event       mouse up event
 * @param {Object} mouse       data.mouse
 * @param {Object} keyboard    data.keyboard
 * @param {Object} scroll      data.scroll
 * @param {Object} resources   data.resources
 * @param {Object} craftObject data.craftObject
 */
ui.eventCanvasMouseup = function(event, mouse, keyboard, scroll, resources, craftObject) {
    mouse.x = event.pageX;
    mouse.y = event.pageY;

    if (mouse.left) {
        ui.eventCanvasMouseup_left(mouse, keyboard, scroll, resources, craftObject);
    } else if (mouse.right) {
        ui.eventCanvasMouseup_right(mouse, scroll);
    }

    if (event.which === 1) {
        mouse.left = false;
    } else if (event.which === 2) {
        mouse.middle = false;
    } else if (event.which === 3) {
        mouse.right = false;
    }
};

/**
 * Execute when the left mouse button goes up
 * @param {Object} mouse       data.mouse
 * @param {Object} keyboard    data.keyboard
 * @param {Object} scroll      data.scroll
 * @param {Object} resources   data.resources
 * @param {Object} craftObject data.craftObject
 */
ui.eventCanvasMouseup_left = function (mouse, keyboard, scroll, resources, craftObject) {
    // If we have a craft object selected it means we are in build mode.
    if (craftObject) {
        // Build the object
        for (var x = data.mouse.selection.lx; x <= data.mouse.selection.rx; x++) {
            for (var y = data.mouse.selection.ty; y <= data.mouse.selection.by; y++) {
                // Are there enough resources available?
                if (resources.iron >= craftObject.prototype.defaults.cost.iron) {
                    // Subract the resources
                    resources.iron -= craftObject.prototype.defaults.cost.iron;

                    // Update the resources ui
                    ui.updateIron(resources.iron);

                    craftObject.prototype.initialise(x, y);

                } else {
                    console.log("Not enough resources", resources.iron, craftObject.prototype.defaults.cost.iron);
                }
            }
        }

        if(keyboard.shift !== true) {
            data.craftObject = null;
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

/**
 * Execute when the right mouse button goes up
 * @param {Object} mouse       data.mouse
 * @param {Object} scroll      data.scroll
 */
ui.eventCanvasMouseup_right = function (mouse, scroll) {
    if (mouse.selection.objects.length > 0) {
        var resources = [];

        for (var x = mouse.selection.lx; x <= mouse.selection.rx; x++) {
            for (var y = mouse.selection.ty; y <= mouse.selection.by; y++) {
                var grid = common.getGridFromGrid(x, y);

                level.findResource(grid).forEach(function(resource) {
                    resources.push(resource);
                });
            }
        }

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
                    var coordinates = common.getCoordinatesFromScreen(scroll,mouse.x,mouse.y);
                    selectedObject.walk(coordinates.x,coordinates.y);
                }
            });
        }
    }
};

/* Energy */

/**
 * update amount of energy DOM element
 * @param {Number} amount energy
 */
ui.updateEnergy = function(amount) {
    $('#energy').text(amount);
};

/* Iron */

/**
 * update amount of iron DOM element
 * @param {Number} amount iron
 */
ui.updateIron = function(amount) {
    $('#iron').text(amount);
};

ui.eventDocumentKeydown = function(e, keyboard, mouse) {
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

        case 67: // c
        keyboard.c = true;

        // shift + c; Remove all actions from selected objects
        if (keyboard.shift === true) {
            mouse.selection.objects.forEach(function(object) {
                object.actions = [];
            });
        } else { // c; Remove the first action from selected objects
            mouse.selection.objects.forEach(function(object) {
                // Remove action if it is walking to a non walking action, we should remove both.
                if (object.actions.length > 1 && object.actions[0].action === "walk" && object.actions[1].action !== "walk") {
                    object.actions.splice(0,2);
                } else if (object.actions.length > 0) {
                    object.actions.splice(0,1);
                }
            });
        }
        break;

        case 16: // shift
        keyboard.shift = true;


        //if keyboard.
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

ui.scrollLoop = function(context, scroll, mouse, keyboard) {
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
        if (keyboard.shift === true) {
            scroll.x *= scroll.shiftMultiplier;
            scroll.y *= scroll.shiftMultiplier;
        }

        scroll.offset.x += scroll.x;
        scroll.offset.y += scroll.y;

        // Fake mouse move event;
        var event = {
            pageX : mouse.x,
            pageY : mouse.y
        };

        ui.eventCanvasMousemove(event, mouse);

        contextGL.translate(context, scroll.offset.x, scroll.offset.y);
    }

    return scroll;
};
