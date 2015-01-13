/* global objects:true, level, resources, common, game, ui, data, Emitter */
/* esnext */

objects = {};

objects.create = function(repository, name, x, y, player, objectsReference) {
    var object = {
        id : Symbol(),
        name : name,
        x : x,
        y : y,
        exists : true,
        references : [],
        actions : [],
        animation : {array: []},
        chunk : {}
    };

    var definition = objects.getDefinition(repository, name);

    //object.images
    object.skills = definition.skills;
    object.communicationRadius = definition.communicationRadius;
    object.hasWindow = definition.hasWindow;
    object.energy = definition.energy;
    object.cost = definition.cost;
    object.targetActions = definition.targetActions;
    object.capacity = definition.capacity;
    object.resources = {
        iron : 0,
        energy : 0
    };

    var coordinates = common.getCoordinatesFromGrid(x, y);
    objects.updateGrid(object,common.getGridFromCoordinates(coordinates.x, coordinates.y));
    objects.move(object, coordinates.x, coordinates.y);

    object.x = coordinates.x;
    object.y = coordinates.y;


    data.resources.energy += object.energy;
    data.resources.storage.energy += definition.storage.energy;
    data.resources.storage.iron += definition.storage.iron;

    ui.updateResources(data.resources);

    var tileset = common.resources.tilesets.get(name);

    object.tileset = tileset;
    object.width = tileset.grid.width;
    object.height = tileset.grid.height;
    object.image = tileset;
    object.collisionBox = tileset.collisionBox;
    object.center = {
        x: (object.collisionBox.lx + object.collisionBox.rx ) /2,
        y: (object.collisionBox.ty + object.collisionBox.by ) /2
    };

    object = objects.setAnimation(object, object.tileset.defaultAnimation);
    object = objects.setDirection(object, 'NE');
    object = objects.animationLoop(object);
    object = objects.addReference(object, "objects", objectsReference);

    object.color = player.color;

    return object;
};

objects.setActions = function(object, actions) {
    object.actions = actions;

    return object;
};

objects.getObjectURI = function(name) {
    return './assets/objects/' + name + '.json';
};

objects.getDefinition = function(repository, name) {

    var definition = repository[name];

    if (typeof definition === 'undefined') {
        var URI = objects.getObjectURI(name);
        definition = common.getJSONFromURI(URI);

        repository[name] = definition;
    }

    var tileset = common.resources.tilesets.get(name);

    definition.tileset = tileset;
    definition.width = tileset.grid.width;
    definition.height = tileset.grid.height;
    definition.image = tileset;
    definition.collisionBox = tileset.collisionBox;
    definition.center = {
        x: (definition.collisionBox.lx + definition.collisionBox.rx ) /2,
        y: (definition.collisionBox.ty + definition.collisionBox.by ) /2
    };

    return definition;
};

objects.hasSkill = function(object, skill) {
    var hasSkill = object.skills[skill];

    if (hasSkill !== true) {
        return false;
    }

    return true;
};

objects.move = function(object,x,y) {
    object.x += x;
    object.y += y;

    var grid = common.getGridFromCoordinates(object.x, object.y);

    if (object.grid.x !== grid.x || object.grid.y !== grid.y) {
        //Update all tiles;
        objects.updateGrid(object, grid);
    }

    object.grid = grid;
};

objects.updateGrid = function(object, grid) {
    if (typeof object.grid !== 'undefined') {
        var chunk = level.getChunk(object.grid.chunk.x, object.grid.chunk.y);

        delete chunk.objects[object.grid.i][object.id];

        for (var x = object.grid.x - object.communicationRadius; x <= object.grid.x + object.communicationRadius; x++) {
            for (var y = object.grid.y - object.communicationRadius; y <= object.grid.y + object.communicationRadius; y++) {
                var c_grid = common.getGridFromGrid(x, y);
                var chunk = level.getChunk(c_grid.chunk.x, c_grid.chunk.y);

                delete chunk.objects[c_grid.i][object.id];
                chunk.objects[c_grid.i].counter -= 1;
                if(chunk.objects[c_grid.i].counter === 0) {
                    chunk.layers.fog.tiles[c_grid.i].tile = 48;
                }
            }
        }
    }

    object.grid = grid;

    var chunk = level.getChunk(object.grid.chunk.x, object.grid.chunk.y);
    chunk.objects[object.grid.i][object.id] = object;

    for (var x = object.grid.x - object.communicationRadius; x <= object.grid.x + object.communicationRadius; x++) {
        for (var y = object.grid.y - object.communicationRadius; y <= object.grid.y + object.communicationRadius; y++) {
            var c_grid = common.getGridFromGrid(x, y);
            var chunk = level.getChunk(c_grid.chunk.x, c_grid.chunk.y);
            chunk.objects[c_grid.i][object.id] = object;
            chunk.objects[c_grid.i].counter += 1;
            chunk.layers.fog.tiles[c_grid.i].tile = -1;
            chunk.layers.fog.data[c_grid.i] = true;
        }
    }
};

objects.select = function(object){
    if (object.tileset.image_selected) {
        object.image = object.tileset.image_selected;
    }

    object.isSelected = true;
};

objects.deselect = function(object){
    if (object.tileset.image_selected) {
        object.image = object.tileset;
    }

    object.isSelected = false;
};

objects.animationLoop = function(object) {
    object.tile = object.animation.array[object.animation.index];

    if (object.animation.index < object.animation.array.length-1) {
        object.animation.index += 1;
    } else {
        object.animation.index = 0;
    }

    return object;
};

objects.setDirection = function(object, direction) {
    if(!direction) {
        direction = 'NE';
    }

    object.animation.array = object.tileset.animations[object.animation.name][direction];
    object.direction = direction;

    return object;
};

objects.setAnimation = function(object, animation) {
    if (object.animation.name !== animation) {
        object.animation.name = animation;
        object.animation.array = object.tileset.animations[animation][object.direction];
        object.animation.index = 0;

        if (object.tileset.animations[animation].emitter) {
            object.emitter = new Emitter(0,0, object.tileset.animations[animation].emitter);
        } else {
            object.emitter = null;
        }
    }

    return object;
};

objects.calculateWalkSteps = function(origin, target) {
    var x = target.x - origin.x;
    var y = target.y - origin.y;

    var nbSteps = Math.sqrt(x*x + y*y)/2;

    target.step = {
        x : x / nbSteps,
        y : y / nbSteps
    };

    return target;
};

objects.walk = function(object, x,y) {
    var self = object,
        origin;

    if (object.actions.length > 0) {
        origin = {x : self.actions[self.actions.length-1].x, y : self.actions[self.actions.length-1].y};
    } else {
        origin = {x : self.x, y : self.y};
    }

    var path = game.getPath(origin,{x:x, y:y});

    if (typeof path === 'undefined') return;

    path.forEach(function(leg) {
        leg.action = "walk";
        leg.direction = 'N';

        leg = objects.calculateWalkSteps(origin, leg);

        self.actions.push(leg);

        origin = leg;
    });
};

objects.walkLoop = function(object, action, data) {
    objects.setDirection(object, action.direction);

    var destination = action;
    var x,
        y;

    x = destination.x - object.x;
    y = destination.y - object.y;

    if(Math.abs(x) > Math.abs(action.step.x)) {
        x = action.step.x;
    }

    if(Math.abs(y) > Math.abs(action.step.y)) {
        y = action.step.y;
    }

    var flag  = false;

    data.objects.forEach(function(obj) {
        for (var i = 1 ; i <= 50; i++) {
        if (obj === object || flag === true) {
                return;
            }
            if (obj.x - (obj.collisionBox.rx - obj.collisionBox.lx)/2 <= x*i + object.x &&
                obj.x + (obj.collisionBox.rx - obj.collisionBox.lx)/2 >= x*i + object.x &&
                obj.y - (obj.collisionBox.by - obj.collisionBox.ty)/2 <= y*i + object.y &&
                obj.y + (obj.collisionBox.by - obj.collisionBox.ty)/2 >= y*i + object.y) {
                flag = true;
            }
        }
    });

    if (!flag) {
        objects.move(object, x,y);
    } else {
        var lengte = Math.sqrt(x*x + y*y);
        var graden = Math.asin(y/lengte)*(180/Math.PI);
        if (x < 0) {
            graden = 180 - graden;
        }
        var flag2 = false;
        var y2 = y;
        var x2 = x;

        for (var j = 1; j < 180; j++) {
            flag2 = false;
            graden = graden + j*(2*(j%2)-1);
            y2 = Math.sin(graden*Math.PI/180)*lengte;
            x2 = Math.cos(graden*Math.PI/180)*lengte;
            data.objects.forEach(function(obj) {
                for (var k = 1 ; k <= 50; k++) {
                    if (obj === object || flag2 === true) {
                        return;
                    }
                    if (obj.x - (obj.collisionBox.rx - obj.collisionBox.lx)/2 <= x2*k + object.x &&
                        obj.x + (obj.collisionBox.rx - obj.collisionBox.lx)/2 >= x2*k + object.x &&
                        obj.y - (obj.collisionBox.by - obj.collisionBox.ty)/2 <= y2*k + object.y &&
                        obj.y + (obj.collisionBox.by - obj.collisionBox.ty)/2 >= y2*k + object.y) {
                        flag2 = true;
                        return;
                    }
                }
            });
            if (flag2 === false) {
                break;
            }
        }

        if (flag2 === false) {
            objects.move(object, x2,y2);
            object.actions[0] = objects.calculateWalkSteps({x : object.x, y : object.y}, object.actions[0]);
        } else {
            // wachten :-)
        }
    }


    if (object.x === destination.x && object.y === destination.y) {
        object.actions.shift();
    }

};

/**
 * Tell the object to add the gather actions to its action list
 * @param {Object} resource object is the target resource which it will have to gather
 */
objects.gather = function(object, resource) {
    objects.walk(object, resource.x, resource.y);

    var action = {action:"gather", x : resource.x, y : resource.y, object: resource};

    object.actions.push(action);
};

/**
 * While the action 'gather' exists for an object object loop is run
 * @param {Object} action The action to execute
 */
objects.gatherLoop = function(object, action) {
    if (typeof action.object === 'undefined' || !resources.resourceExists(action.object)) {
        object.actions.shift();
    } else {
        var amount = resources.gatherResource(action.object, 1);
        object.resources.iron += amount;

        if (object.resources.iron >= object.capacity.iron) {
            //TODO: bring back resources to closest iron storage
            ui.updateResources(data.resources);
        }
    }
};

objects.restLoop = function(object) {
    object = objects.setAnimation(object, "rest");
};

objects.loop = function(object, data) {
    object = objects.animationLoop(object);

    var action = object.actions[0];

    if (typeof action !== 'undefined') {
        if (action.action === "walk") {
            object = objects.setAnimation(object, "walk");
            object = objects.walkLoop(object, object.actions[0], data);
        } else if (action.action === "gather") {
            object = objects.setAnimation(object, "walk");
            object = objects.gatherLoop(object, object.actions[0]);
        }
    } else {
        objects.restLoop(object);
    }

    return object;
};

objects.destroy = function(object) {
    object.exists = false;
    object = object.removeReferences(object);
};

objects.find = function(lx, ty, rx, by) {
    var results = [];

    data.objects.forEach(function(object) {
        if (lx <= object.grid.x && object.grid.x <= rx && ty <= object.grid.y && object.grid.y <= by) {
            results.push(object);
        }
    });

    return results;
};

objects.findByChunks = function(object, chunks) {
    var array = [];

//    chunks.forEach(function(object, chunk) {
//        game.getChunk(chunk.x, chunk.y).objects.forEach(function(object) {
//            array.push(object);
//        });
//    });

    return data.objects;
};

objects.addReference = function(object, name, array) {
    var index = array.push(object);

    array.name = name;

    var reference = {
        name : name,
        array : array,
        index : index
    };

    object.references.push(reference);

    return object;
};

objects.recalculateReferenceIndexes = function(array) {
    array.forEach(function(object, index) {
        object.references.forEach(function(reference) {
            if (reference.name === array.name) {
                reference.index = index;
            }
        });
    });

    return array;
};

objects.removeReferences = function(object) {
    object.references.forEach(function(reference) {
        objects.removeReference(reference);
    });

    object.references = [];

    return object;
};

objects.removeReference = function(object, name) {
    var reference;

    object.references.forEach(function(reference) {
        if (reference.name === name) {
            reference = reference;
        }
    });

    //Remove this reference
    reference.array.splice(reference.index-1,1);

    //Recalculate all indexes for object in the reference.
    objects.recalculateReferenceIndexes(reference.array);

    return object;
};

