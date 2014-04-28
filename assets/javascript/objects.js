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

function repository() {}

repository.prototype.get = function(name) {
    if (typeof objects.repository[name] !== 'undefined') {
        console.log("Object " + name + " is already available!");
        return objects.repository[name];
    }
    var URI = './assets/objects/' + name + '.json';
    
    var object = common.getJSONFromURI(URI);
    
    if (object !== null) {
        objects.repository[name] = function(){};// = object;
        
        if (object.images) {
            if (object.images.indexOf("tileset") !== -1) {
                objects.repository[name].prototype.tileset = common.resources.tilesets.get(name);
                objects.repository[name].prototype.width = common.resources.tilesets.get(name).grid.width;
                objects.repository[name].prototype.height = common.resources.tilesets.get(name).grid.height;
                objects.repository[name].prototype.image = common.resources.tilesets.get(name);
            }
            
            if (object.images.indexOf("icon") !== -1) {
                objects.repository[name].prototype.icon = common.resources.icons.get(name);
            }
        }
        
        if (object.skills) {
            objects.repository[name].prototype.skills = object.skills;
        }
        
        if (object.targetActions) {
            objects.repository[name].prototype.targetActions = object.targetActions;
        }
        
        if (typeof object.craft !== 'undefined') {
            objects.repository[name].prototype.craft = object.craft;
            objects.repository[name].prototype.icon = common.resources.icons.get(name);
            
            // Loop through resources and make sure that they are available and have icons.
            var resource;
            for(resource in object.craft) {
                objects.repository.get(resource).icon = common.resources.icons.get(resource);
                
            }
        }
        
        objects.repository[name].prototype.defaults = {};
        
        if (typeof object.health !== 'undefined') {
            objects.repository[name].prototype.defaults.health = object.health;
        }
        
        if (typeof object.resources !== 'undefined') {
            objects.repository[name].prototype.defaults.resources = object.resources;
        }
        
        objects.repository[name].prototype.move = function(x,y) {
            this.x += x;
            this.y += y;
        };
        
        
        objects.repository[name].prototype.select = function(){
            if (this.tileset.image_selected) {
                this.image = this.tileset.image_selected;
            }
        };

        objects.repository[name].prototype.deselect = function(){
            if (this.tileset.image_selected) {
                this.image = this.tileset;
            }
        };
        
        objects.repository[name].prototype.addResources = function(resources) {
            for(var resource in resources) {
                if (typeof this.resources[resource] !== 'undefined') {
                    this.resources[resource] += resources[resource];
                } else {
                    this.resources[resource] = resources[resource];
                }
            }
        };
        
        /* 
            Animation
        */    
        objects.repository[name].prototype.animationLoop = function() {
            //console.log(this.animation);
            
            setTimeout(this.animationLoop.bind(this),100);
            
            this.tile = this.animation.array[this.animation.index];
            
            if (this.animation.index < this.animation.array.length-1) {
                this.animation.index += 1;
            } else {
                this.animation.index = 0;
            }
        };
        
        
        objects.repository[name].prototype.setDirection = function(direction) {
            this.animation.array = this.tileset.animations[this.animation.name][direction];
            this.direction = direction;
        };
        
        objects.repository[name].prototype.setAnimation = function(animation) {
            if (this.animation.name !== animation) {
                this.animation.name = animation;
                this.animation.array = this.tileset.animations[animation][this.direction];
                this.animation.index = 0;
            }
        };
        
        /*
            Skills
        */
        
        if(object.skills) {
            if(object.skills.indexOf("walk") !== -1) {        
                objects.repository[name].prototype.walk = function(x,y) {
                    self = this;

                    if (this.actions.length > 0) {
                        origin = {x : self.actions[self.actions.length-1].x, y : self.actions[self.actions.length-1].y};
                    } else {
                        origin = {x : self.x, y : self.y};
                    }



                    path = level.getPath(this,{x:x, y:y});

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

                objects.repository[name].prototype.walkLoop = function(action) {
                    this.setDirection(action.direction);

                    var destination = action;
                    var x,
                        y

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

                    this.move(x,y);

                    if (-3 < this.x-destination.x && this.x-destination.x < 3 && -2 < this.y-destination.y && this.y-destination.y < 2) {
                        this.actions.shift();
                    }

                };
            }

            if(object.skills.indexOf("chop") !== -1) {
                objects.repository[name].prototype.chop = function(object) {
                    this.walk(object.x, object.y);

                    action = {action:"chop", x : object.x, y : object.y, object: object};

                    this.actions.push(action);
                };

                objects.repository[name].prototype.chopLoop = function(action) {

                    if (!action.object.isDestroyed) {
                        action.object.target_chop(this, 1);
                    } else {
                        this.actions.shift();
                    }
                };
            }
        }
        
        
        /*
            TargetActions
        */
        
        if(object.targetActions) {
            if(object.targetActions.indexOf("chop") !== -1) {
                objects.repository[name].prototype.target_chop = function(object, amount) {
                    this.health = this.health-amount;

                    if (this.health <= 0) {
                        object.addResources(this.resources); 
                        this.resources = {};
                        this.destroy();
                    }


                };
            }
        }
        
        objects.repository[name].prototype.restLoop = function() {
            this.setAnimation("rest");
        };
        
        objects.repository[name].prototype.loop = function() {
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
        
        /*
            Create
        */
        
        objects.repository[name].prototype.initialise = function(x,y) {
            var object = new objects.repository[name]();
            
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
        
        objects.repository[name].prototype.destroy = function() {
            this.isDestroyed = true;
            objects.array.splice([objects.array.indexOf(this)],1);
        };
        
    } else {
        console.error("objects.loadObject could not load " + URI);
        return null;
    }
    
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
        if (object.x <= x && object.x+object.width >= x && object.y <= y && object.y+object.height >= y) {
            array.push(object);
        }
    });
    
    return array;
};

// Initialise the Object objects.prototype.repository
objects.prototype.repository = new repository();

// Initialise the Object objects
objects = new objects();