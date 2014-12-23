/* global objects:true, resources,console,common,game, ui, data, Emitter */

objects = {};

objects.create = function(repository, name, x, y, objectsReference) {
    var object = {
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

    var coordinates = common.getCoordinatesFromGrid(x, y);
    object.grid = common.getGridFromCoordinates(coordinates.x, coordinates.y);
    objects.move(object, coordinates.x, coordinates.y);

    //object.images
    object.skills = definition.skills;
    object.communicationRadius = definition.communicationRadius;
    object.hasWindow = definition.hasWindow;
    object.energy = definition.energy;
    object.cost = definition.cost;
    object.targetActions = definition.targetActions;

    data.resources.energy += object.energy;
    ui.updateEnergy(data.resources.energy);

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

objects.updateChunk = function(object, newChunk) {
    if (object.chunk.x !== newChunk.x || object.chunk.y !== newChunk.y) {
        if (object.chunk !== 'undefined') {
            //Remove from the old chunk
            game.getChunk(object.chunk.x,object.chunk.y).objects.splice(object.chunk.position-1,1);

            //Renumber all positions for object later on in the chunk.
            game.getChunk(object.chunk.x,object.chunk.y).objects.forEach(function(object, index) {
                object.chunk.position = index + 1;
            });
        }

        object.chunk = newChunk;
        object.chunk.position = game.getChunk(object.chunk.x,object.chunk.y).objects.push(object);
    }

    return object;
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
        game.calculatefog();
    }

    object.grid = grid;
    objects.chunk = objects.updateChunk(object, grid.chunk);
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

objects.walkLoop = function(object, action) {
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

    objects.move(object, x,y);

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
        resources.gatherResource(action.object, 1);
    }
};

objects.restLoop = function(object) {
    object = objects.setAnimation(object, "rest");
};

objects.loop = function(object) {
    object = objects.animationLoop(object);

    var action = object.actions[0];

    if (typeof action !== 'undefined') {
        if (action.action === "walk") {
            object = objects.setAnimation(object, "walk");
            object = objects.walkLoop(object, object.actions[0]);
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

