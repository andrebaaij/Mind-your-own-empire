/*
    

    Styleguide: https://github.com/airbnb/javascript
*/

/*

    Interface to objects:
    
    objects.create(objectName, x, y);
    returns the newly created object;
    
    objects.list(orderArguments);
    returns a list of all the objects sorted by arguments
    
    objects.find(x, y);
    find an object based on a x and y position.
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

function objects() {
    this.array = [];
}

objects.prototype.list = function() {
    return this.array;
};

objects.prototype.functions = {};

objects.prototype.functions.move = function(x,y) {
    this.x += x;
    this.y += y;
};

objects.prototype.functions.select = function(){
    if (this.tileset.image_selected) {
        this.image = this.tileset.image_selected;
    }
};

objects.prototype.functions.deselect = function(){
    if (this.tileset.image_selected) {
        this.image = this.tileset;
    }
};

objects.prototype.functions.addResources = function(resources) {
    for(var resource in resources) {
        if (typeof this.resources[resource] !== 'undefined') {
            this.resources[resource] += parseInt(resources[resource]);
        } else {
            this.resources[resource] = parseInt(resources[resource]);
        }
    }
};

objects.prototype.functions.removeResources = function(resources) {
    for(var resource in resources) {
        if (typeof this.resources[resource] !== 'undefined') {
            this.resources[resource] -= resources[resource];
            
            if (this.resources[resource] < 0) {
                resources[resource] = this.resources[resource] * -1;
                this.resources[resource] = 0;
            } else {
                resources[resource] = 0;
            }
        }
    }
    
    return resources;
};

objects.prototype.functions.animationLoop = function() {
    setTimeout(this.animationLoop.bind(this),100);

    this.tile = this.animation.array[this.animation.index];

    if (this.animation.index < this.animation.array.length-1) {
        this.animation.index += 1;
    } else {
        this.animation.index = 0;
    }
};

objects.prototype.functions.setDirection = function(direction) {
    this.animation.array = this.tileset.animations[this.animation.name][direction];
    this.direction = direction;
};

objects.prototype.functions.setAnimation = function(animation) {
    if (this.animation.name !== animation) {
        this.animation.name = animation;
        this.animation.array = this.tileset.animations[animation][this.direction];
        this.animation.index = 0;
    }
};

objects.prototype.functions.walk = function(x,y) {
    self = this;

    if (this.actions.length > 0) {
        origin = {x : self.actions[self.actions.length-1].x, y : self.actions[self.actions.length-1].y};
    } else {
        origin = {x : self.x, y : self.y};
    }



    path = level.getPath(origin,{x:x, y:y});

    console.log(path);

    if (typeof path === 'undefined') return;

    path.forEach(function(leg, index, array) {
        leg.action = "walk";

        x = leg.x - origin.x;
        y = leg.y - origin.y;

        var NS,
            WE;

        if (x < 0) {
            WE = 'W';
        } else if (x > 0) {
            WE = 'E';
        } else {
            WE = '';
        }

        if (y > 0) {
            NS = 'S';
        } else if (y < 0) {
            NS = 'N';
        } else {
            NS = '';   
        }

        origin.x = leg.x;
        origin.y = leg.y;

        leg.direction = NS+WE;

        self.actions.push(leg);
    });
};

objects.prototype.functions.walkLoop = function(action) {
    this.setDirection(action.direction);

    var destination = action;
    var x,
        y;

    x = destination.x - this.x;
    y = destination.y - this.y;

    if(x >= 2) {
        x = 2;
    } else if (x <= -2){
        x = -2;
    } else {
        x = 0;
    }

    if(y >= 1) {
        y = 1;
    } else if (y <= -1){
        y = -1;
    } else {
        y = 0;    
    }

    if (x === 0 && y !== 0) {
        y = y * 2;
    }


    this.move(x,y);

    if (-3 < this.x-destination.x && this.x-destination.x < 3 && -2 < this.y-destination.y && this.y-destination.y < 2) {
        this.actions.shift();
    }

};

objects.prototype.functions.chop = function(object) {
    this.walk(object.x, object.y);

    action = {action:"chop", x : object.x, y : object.y, object: object};

    this.actions.push(action);
};

objects.prototype.functions.chopLoop = function(action) {
    if (!action.object.isDestroyed) {
        action.object.targetChop(this, 1);
    } else {
        this.actions.shift();
    }
};

objects.prototype.functions.craft = function(object) {
    this.walk(object.x, object.y);

    action = {action:"craft", x : object.x, y : object.y, object: object};

    this.actions.push(action);
};

objects.prototype.functions.craftLoop = function(action) {
    if (action.object.crafted >= 1) {
        action.object.crafted = 1;
        this.actions.shift();
        return;
    }

    action.object.crafted += 0.001;
};

// Target Actions
objects.prototype.functions.targetChop = function(object, amount) {
    this.health = this.health-amount;

    if (this.health <= 0) {
        object.addResources(this.resources); 
        this.resources = {};
        this.destroy();
    }


};

// Miscellaneous functions
objects.prototype.functions.restLoop = function() {
    this.setAnimation("rest");
};

objects.prototype.functions.loop = function() {
    setTimeout(this.loop.bind(this),this.loopSpeed);

    if (this.actions.length > 0) {
        if (this[this.actions[0].action + "Loop"]) {
            this.setAnimation(this.actions[0].action);
            this[this.actions[0].action + "Loop"](this.actions[0]);
        } else {
            console.log("Unknow active skill: " + this.activeSkill);
            this.actions.shift();
        }
    } else {
        this.restLoop();    
    }
};

objects.prototype.functions.initialise = function(x,y) {
    var object = new objects.repository[this.name]();

    //Remove the initialise function.
    object.initialise = undefined;


    //Initialize the variables:            
    object.x = x;
    object.y = y;
    object.path = []; 
    object.animation = {array: []};
    object.actions = [];
    object.resources = {};

    object.setAnimation(object.tileset.defaultAnimation);
    object.setDirection('NE');
    setTimeout(object.animationLoop.bind(object),100);
    object.loopSpeed = 10; //milliseconds

    for (var variable in object.defaults) {
        object[variable] = object.defaults[variable];
    }

    // breathe
    object.loop();

    objects.add(object);

    return object;
};

objects.prototype.functions.destroy = function() {
    this.isDestroyed = true;
    objects.array.splice([objects.array.indexOf(this)],1);
};

function repository() {}

repository.prototype.get = function(name) {
    if (typeof objects.repository[name] !== 'undefined') {
        console.log("Object " + name + " is already available!");
        return objects.repository[name];
    }
    var URI = './assets/objects/' + name + '.json';
    
    var object = common.getJSONFromURI(URI);
    
    if (object === null) {
        console.error("objects.loadObject could not load " + URI);
        return null;
    }
        
    objects.repository[name] = function(){};// = object;

    if (object.images) {
        if (object.images.indexOf("tileset") !== -1) {
            objects.repository[name].prototype.tileset = common.resources.tilesets.get(name);
            objects.repository[name].prototype.width = common.resources.tilesets.get(name).grid.width;
            objects.repository[name].prototype.height = common.resources.tilesets.get(name).grid.height;
            objects.repository[name].prototype.image = common.resources.tilesets.get(name);
            objects.repository[name].prototype.collisionBox = common.resources.tilesets.get(name).collisionBox;
            console.log(objects.repository[name].prototype.collisionBox);
            objects.repository[name].prototype.center = {x: (objects.repository[name].prototype.collisionBox.lx + objects.repository[name].prototype.collisionBox.rx ) /2,
                                                         y: (objects.repository[name].prototype.collisionBox.ty + objects.repository[name].prototype.collisionBox.by ) /2};
        }

        if (object.images.indexOf("icon") !== -1) {
            objects.repository[name].prototype.icon = common.resources.icons.get(name);
        }
    }

    objects.repository[name].prototype.defaults = {};
    objects.repository[name].prototype.name = name;
    
    if (object.skills) {
        objects.repository[name].prototype.skills = object.skills;
    }

    if (object.targetActions) {
        objects.repository[name].prototype.targetActions = object.targetActions;
    }

    if (typeof object.craft !== 'undefined') {
        objects.repository[name].prototype.craftInformation = object.craft;
        objects.repository[name].prototype.icon = common.resources.icons.get(name);
        objects.repository[name].prototype.defaults.crafted = 0.00;

        // Loop through resources and make sure that they are available and have icons.
        var resource;
        for(resource in object.craft) {
            objects.repository.get(resource).icon = common.resources.icons.get(resource);

        }
    }    

    if (typeof object.health !== 'undefined') {
        objects.repository[name].prototype.defaults.health = object.health;
    }

    if (typeof object.resources !== 'undefined') {
        objects.repository[name].prototype.defaults.resources = object.resources;
    }

    objects.repository[name].prototype.move = objects.functions.move;

    objects.repository[name].prototype.select = objects.functions.select;

    objects.repository[name].prototype.deselect = objects.functions.deselect;

    objects.repository[name].prototype.addResources = objects.functions.addResources;

    objects.repository[name].prototype.removeResources = objects.functions.removeResources;
    
    objects.repository[name].prototype.animationLoop = objects.functions.animationLoop;

    objects.repository[name].prototype.setDirection = objects.functions.setDirection;

    objects.repository[name].prototype.setAnimation = objects.functions.setAnimation;

    if(object.skills) {
        if(object.skills.indexOf("walk") !== -1) {        
            objects.repository[name].prototype.walk = objects.functions.walk;
            objects.repository[name].prototype.walkLoop = objects.functions.walkLoop;
        }

        if(object.skills.indexOf("chop") !== -1) {
            objects.repository[name].prototype.chop = objects.functions.chop;
            objects.repository[name].prototype.chopLoop = objects.functions.chopLoop;
        }

        if(object.skills.indexOf("craft") !== -1) {
            objects.repository[name].prototype.craft = objects.functions.craft;
            objects.repository[name].prototype.craftLoop = objects.functions.craftLoop;
        }
    }


    // TargetActions

    if(object.targetActions) {
        if(object.targetActions.indexOf("chop") !== -1) {
            objects.repository[name].prototype.targetChop = objects.functions.targetChop;
        }
    }

    // Miscellaneous

    objects.repository[name].prototype.restLoop = objects.functions.restLoop;

    objects.repository[name].prototype.loop = objects.functions.loop;

    // Initialise

    objects.repository[name].prototype.initialise = objects.functions.initialise;

    objects.repository[name].prototype.destroy = objects.functions.destroy;
    
    return objects.repository[name];
};

objects.prototype.create = function(name, x, y) {
    var prototype = objects.repository.get(name);
    var object = new prototype();
    object.initialise(x,y);
    return object;
};

objects.prototype.add = function(object) {
    this.array.push(object);
};

objects.prototype.find = function(x, y) {
    var array = [];
    
    this.array.forEach(function(object, index) {
        if (object.x - object.center.x <= x && object.x+object.width - object.center.x >= x && object.y - object.center.y <= y && object.y+object.height - object.center.y >= y) {
            array.push(object);
        }
    });
    
    return array;
};

// Initialise the Object objects.prototype.repository
objects.prototype.repository = new repository();

// Initialise the Object objects
objects = new objects();