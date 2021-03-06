/*global data, $, level, document, window, console, common, contextGL, objects*/

var ui = {};

/**
 * Initialise the ui object
 */
ui.initialise = function () {
    "use strict";

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
        menu_craft : document.getElementById("menu_craft"),
        $message : $("#message"),
        $message_text : $("#message_text")
    };

    /* EventListeners assignment*/
    data.DOM.$canvas.mousemove(function (e) { ui.eventCanvasMousemove(e, data.mouse); });
    data.DOM.$canvas.mousedown(function (e) { ui.eventCanvasMousedown(e, data.mouse, data.scroll); });
    data.DOM.$canvas.mouseup(function (e) { ui.eventCanvasMouseup(e, data.mouse, data.keyboard, data.scroll, data.resources, data.craftObject, data.player, data.repository.objects, data.objects); });
    data.DOM.pauseContinue.addEventListener('click',    function () {ui.showPause(false); });
    data.DOM.pauseFullscreen.addEventListener('click',  function () {ui.showFullscreen(); });
    data.DOM.menu_pause.addEventListener('click',       function () {ui.showPause(true); });
    $(window).blur(function () {
        data.mouseDown = false;
        ui.showPause(true);
    });
    data.DOM.$document.keydown(function (e) {ui.eventDocumentKeydown(e, data.keyboard, data.mouse); });
    data.DOM.$document.keyup(function (e) {ui.eventDocumentKeyup(e, data.keyboard); });

    /* initialise */
    data.DOM.canvas.context = contextGL.get(data.DOM.canvas);
    contextGL.dimensions(data.DOM.canvas.context, window.innerWidth, window.innerHeight);
    data.DOM.canvas.xOffset = 0;
    data.DOM.canvas.yOffset = 0;
    window.onresize = ui.eventWindowResize;
    ui.updateResources(data.resources);
    ui.showFullscreen(true);
};

/**
 * When the window resizes, resize the wrapper object with it.
 */
ui.eventWindowResize = function () {
    "use strict";

    data.DOM.canvas.width = window.innerWidth;
    data.DOM.canvas.height = window.innerHeight;

    var scale = common.scaleNumber(1);

    contextGL.dimensions(data.DOM.canvas.context, window.innerWidth, window.innerHeight);
    contextGL.scale(data.DOM.canvas.context, scale);
};

/**
 * Display, hide or toggle the pause overlay
 * @param   {Boolean} show true: show, false: hide, undefined = toggle
 * @returns {Boolean} display state of the pause overlay
 */
ui.showPause = function (show) {
    "use strict";

    if (show === true) {
        data.DOM.pause.style.display = "block";
        data.pause = true;
    } else if (show === false) {
        data.DOM.pause.style.display = "none";
        data.pause = false;
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
ui.eventCanvasMousemove = function (event, mouse) {
    "use strict";

    mouse.x = event.pageX;
    mouse.y = event.pageY;

    var grid = common.getGridFromScreen(data.scroll, mouse.x, mouse.y),
        coordinates = common.getCoordinatesFromScreen(data.scroll, mouse.x, mouse.y);

    if (mouse.left || mouse.right) {
        if (mouse.selection.y.c_y < coordinates.y) {
            mouse.selection.ty = mouse.selection.y;
            mouse.selection.by = grid;
            mouse.selection.by.c_y = coordinates.y;
            mouse.selection.by.c_x = coordinates.x;
        } else {
            mouse.selection.by = mouse.selection.y;
            mouse.selection.ty = grid;
            mouse.selection.ty.c_y = coordinates.y;
            mouse.selection.ty.c_x = coordinates.x;
        }

        if (mouse.selection.x.c_x < coordinates.x) {
            mouse.selection.rx = grid;
            mouse.selection.rx.c_x = coordinates.x;
            mouse.selection.lx = mouse.selection.x;
        } else {
            mouse.selection.lx = grid;
            mouse.selection.lx.c_x = coordinates.x;
            mouse.selection.rx = mouse.selection.x;
        }

    } else {
        mouse.selection.ty = grid;
        mouse.selection.ty.c_y = coordinates.y;
        mouse.selection.by = grid;
        mouse.selection.by.c_y = coordinates.y;
        mouse.selection.lx = grid;
        mouse.selection.lx.c_x = coordinates.x;
        mouse.selection.rx = grid;
        mouse.selection.rx.c_x = coordinates.x;
    }
};

/**
 * Event listener for mouse down on the canvas object.
 * @param {Object} event  mouse down event
 * @param {Object} mouse  data.mouse
 * @param {Object} scroll data.scroll
 */
ui.eventCanvasMousedown = function (event, mouse, scroll) {
    "use strict";

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

        var grid = common.getGridFromScreen(data.scroll, mouse.x, mouse.y),
            coordinates = common.getCoordinatesFromScreen(data.scroll, mouse.x, mouse.y);
        mouse.selection.y = grid;
        mouse.selection.y.c_y = coordinates.y;
        mouse.selection.x = grid;
        mouse.selection.x.c_x = coordinates.x;
    }
};

/**
 * Event listener for mouse up on the canvas object
 * @param {Object} event            mouse up event
 * @param {Object} mouse            data.mouse
 * @param {Object} keyboard         data.keyboard
 * @param {Object} scroll           data.scroll
 * @param {Object} resources        data.resources
 * @param {Object} craftObject      data.craftObject
 * @param {Object} player           for which player is the object to be created? Default to the playing player (non ai).
 * @param {Array}  objectRepository repository where the objects are kept.
 * @param {Array}  objectsReference [[Description]]
 */
ui.eventCanvasMouseup = function (event, mouse, keyboard, scroll, resources, craftObject, player, objectRepository, objectsReference) {
    "use strict";

    mouse.x = event.pageX;
    mouse.y = event.pageY;

    if (mouse.left) {
        ui.eventCanvasMouseup_left(mouse, keyboard, scroll, resources, craftObject, player, objectRepository, objectsReference);
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
 * @param {Object} mouse            data.mouse
 * @param {Object} keyboard         data.keyboard
 * @param {Object} scroll           data.scroll
 * @param {Object} resources        data.resources
 * @param {Object} craftObject      data.craftObject
 * @param {Object} objectRepository [[Description]]
 * @param {Object} objectsReference [[Description]]
 */
ui.eventCanvasMouseup_left = function (mouse, keyboard, scroll, resources, craftObject, player, objectRepository, objectsReference) {
    "use strict";
    var x,
        y,
        definition;

    // If we have a craft object selected it means we are in build mode.
    if (craftObject) {
        definition = objects.getDefinition(objectRepository, craftObject);
        // Build the object
        for (x = data.mouse.selection.lx.x; x <= data.mouse.selection.rx.x; x += 1) {
            for (y = data.mouse.selection.ty.y; y <= data.mouse.selection.by.y; y += 1) {
                // Are there enough resources available?
                if (resources.iron >= definition.cost.iron) {
                    // Subract the resources
                    resources.iron -= definition.cost.iron;

                    // Update the resources ui
                    ui.updateResources(resources);

                    objects.create(objectRepository, craftObject, x, y, player, objectsReference);

                } else {
                    ui.showMessage("Not enough resources to create a " + craftObject, 10000);
                    return;
                }
            }
        }

        if (keyboard.shift !== true) {
            data.craftObject = null;
        }

        return;
    }

    // Deselect all currently selected objects
    mouse.selection.objects.forEach(function (object) {
        objects.deselect(object);
    });

    // Select objects based on the selection grid.
    mouse.selection.objects = objects.find(mouse.selection.lx, mouse.selection.ty, mouse.selection.rx, mouse.selection.by);

    // Select the found objects.
    mouse.selection.objects.forEach(function (object) {
        objects.select(object);
    });
};

/**
 * Execute when the right mouse button goes up
 * @param {Object} mouse       data.mouse
 * @param {Object} scroll      data.scroll
 */
ui.eventCanvasMouseup_right = function (mouse, scroll) {
    "use strict";
    if (mouse.selection.objects.length > 0) {
        var resources = [],
            row = 0,
            x,
            cx,
            y,
            grid,
            skillAssigned = false,
            pushResource = function (resource) {
                resources.push(resource);
            };

        for (y = mouse.selection.ty.c_y; y <= mouse.selection.by.c_y; y += data.tile.height / 2) {
            cx = 0;
            if (row % 2) {
                cx = data.tile.width / 2;
            }
            for (x = mouse.selection.lx.c_x + cx; x <= mouse.selection.rx.c_x; x += data.tile.width) {
                grid = common.getGridFromCoordinates(x, y);
                if (level.getChunk(grid.chunk.x, grid.chunk.y).layers.fog.data[grid.i]) {
                    level.findResource(grid).forEach(pushResource);
                }
            }

            row += 1;
        }

        if (resources.length > 0) {
            mouse.selection.objects.forEach(function (object) {
                if (objects.hasSkill(object, "gather")) {
                    resources.forEach(function (resource) {
                        objects.gather(object, resource);
                    });
                    skillAssigned = true;
                }
            });
        }

        if (!skillAssigned) {
            mouse.selection.objects.forEach(function (object) {
                if (objects.hasSkill(object, "walk")) {
                    var coordinates = common.getCoordinatesFromScreen(scroll, mouse.x, mouse.y);
                    objects.walk(object, coordinates.x, coordinates.y);
                }
                skillAssigned = true;
            });
        }
    }
};

/* Resources */

/**
 * update amount of energy DOM element
 * @param {Number} resources data.resources
 */
ui.updateResources = function (resources) {
    "use strict";

    $('#energy').text(resources.energy);
    $('#iron').text(resources.iron);

    $('#storage_energy').text(resources.storage.energy);
    $('#storage_iron').text(resources.storage.iron);
};

ui.eventDocumentKeydown = function (e, keyboard, mouse) {
    "use strict";

    switch (e.which) {
    case 27: // esc
        data.craftObject = undefined;
        mouse.selection.objects.forEach(function (object) {
            objects.deselect(object);
        });
        mouse.selection.objects = [];
        break;

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
            mouse.selection.objects.forEach(function (object) {
                objects.setActions(object, []);
            });
        } else { // c; Remove the first action from selected objects
            mouse.selection.objects.forEach(function (object) {
                // Remove action if it is walking to a non walking action, we should remove both.
                if (object.actions.length > 1 && object.actions[0].action === "walk" && object.actions[1].action !== "walk") {
                    object.actions.splice(0, 2);
                } else if (object.actions.length > 0) {
                    object.actions.splice(0, 1);
                }

                // Recalcualte the walking steps for the next action
                if (object.actions.length > 0) {
                    object.actions[0] = objects.calculateWalkSteps({x : object.x, y : object.y}, object.actions[0]);
                }
            });
        }
        break;

    case 16: // shift
        keyboard.shift = true;


        //if keyboard.
        break;

    default:
        return; // exit this handler for other keys


    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
};

ui.eventDocumentKeyup = function (e, keyboard) {
    "use strict";
    switch (e.which) {
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

    default:
        return; // exit this handler for other keys
    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
};

/* Miscellaneous */

/**
 * [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
ui.isFullscreen = function () {
    "use strict";
    return common.RunPrefixMethod(document, "FullScreen") || common.RunPrefixMethod(document, "IsFullScreen");
};

/**
 * [[Description]]
 * @param   {[[Type]]} showFullscreen [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
ui.showFullscreen = function (showFullscreen) {
    "use strict";

    if (showFullscreen === true) {
        common.RunPrefixMethod(document.getElementById("wrapper"), "RequestFullScreen");
    } else if (showFullscreen === false) {
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

/**
 * [[Description]]
 * @param   {[[Type]]} context  [[Description]]
 * @param   {Object}   scroll   [[Description]]
 * @param   {Object}   mouse    [[Description]]
 * @param   {Object}   keyboard [[Description]]
 * @returns {[[Type]]} [[Description]]
 */
ui.scrollLoop = function (context, scroll, mouse, keyboard) {
    "use strict";

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




/**
 * [[Description]]
 * @param {[[Type]]} text     [[Description]]
 * @param {[[Type]]} showTime [[Description]]
 */
ui.showMessage = function (text, showTime) {
    "use strict";

    data.DOM.$message.stop(true);
    data.DOM.$message.show();
    data.DOM.$message_text.text(text);
    data.DOM.$message.delay(showTime);
    data.DOM.$message.fadeOut(0);
};
