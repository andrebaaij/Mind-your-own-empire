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
        objects.repository[name] = object;
        objects.repository[name].tileset = common.resources.tilesets.get(object.tileset);
        objects.repository[name].width = objects.repository[name].tileset.grid.width;
        objects.repository[name].height = objects.repository[name].tileset.grid.height;
        objects.repository[name].activeAnimation = {};
        objects.repository[name].image = objects.repository[name].tileset;
        
        objects.repository[name].clone = function() {
            function GameObject() { }
            function clone(obj) {
                GameObject.prototype = obj;
                return new GameObject();
            }
            
            return clone(this);
        };
        
        objects.repository[name].move = function(x,y) {
            this.x += x;
            this.y += y;
        };
        
        
        objects.repository[name].select = function(){
            if (this.tileset.image_selected) {
                this.image = this.tileset.image_selected;
            }
        };

        objects.repository[name].deselect = function(){
            if (this.tileset.image_selected) {
                this.image = this.tileset;
            }
        };
        
        /* 
            Animation
        */

        
        objects.repository[name].animationLoop = function() {
            object = objects.repository[name];
            setTimeout(object.animationLoop,100);
            
            object.tile = object.activeAnimation.array[object.activeAnimation.index];
            
            if (object.activeAnimation.index < object.activeAnimation.array.length-1) {
                object.activeAnimation.index += 1;
            } else {
                object.activeAnimation.index = 0;
            }
        };
        
        objects.repository[name].setActiveAnimation = function(animation, direction) {
            if (this.activeAnimation.name !== animation) {
                this.activeAnimation.name = animation;
                this.activeAnimation.array = this.tileset.animations[animation][direction];
                this.activeAnimation.index = 0;
            }
        };
        
        objects.repository[name].setActiveAnimationDirection = function(direction) {
            this.activeAnimation.array = this.tileset.animations[this.activeAnimation.name][direction];
        };
        
        /*
            Skills
        */
        
        if(object.skills.indexOf("walk") !== -1) {
            objects.repository[name].walk = function(x,y) {
                this.path = level.getPath(this,{x:x, y:y});
                   
                var destination = this.path[0];
                x = destination.x - this.x;
                y = destination.y - this.y;

                var NS,
                    WE;

                if (x < 0) {
                    WE = 'W';
                } else {
                    WE = 'E';
                }

                if (y > 0) {
                    NS = 'S';
                } else {
                    NS = 'N';
                }

                this.setActiveAnimationDirection(NS+WE);
                
            };
            
            objects.repository[name].walkLoop = function() {
                //self = objects.repository[name];
                setTimeout(this.walkLoop.bind(this),15);
                
                if (this.path.length === 0) {
                    return;
                }
                
                var destination = this.path[0];
                var x = destination.x - this.x;
                var y = destination.y - this.y;
                
                // 2:1
                
                if(x >= 2) {
                    x = 2;
                } else if (x <= -2){
                    x = -2;
                }
                
                if(y >= 1) {
                    y = 1;
                } else if (y <= -1){
                    y = -1;
                }
                
                this.move(x,y);
                
                if (-3 < this.x-destination.x && this.x-destination.x < 3 && -2 < this.y-destination.y && this.y-destination.y < 2) {
                    this.path.shift();
                    
                    destination = this.path[0];
                    x = destination.x - this.x;
                    y = destination.y - this.y;
                    
                    var NS,
                        WE;
                    
                    if (x < 0) {
                        WE = 'W';
                    } else {
                        WE = 'E';
                    }

                    if (y > 0) {
                        NS = 'S';
                    } else {
                        NS = 'N';
                    }
                    
                    this.setActiveAnimationDirection(NS+WE);
                    
                }
                
                
                
                
            };
        }
        
        /*
            Create
        */
        
        objects.repository[name].create = function(x,y) {
            var object = this.clone();
            
            // remove pure repository functions
            object.clone = undefined;
            object.create = undefined;
            
            object.x = x;
            object.y = y;
            object.path = []; 
            object.setActiveAnimation(object.tileset.defaultAnimation, 'NE');
            object.animationLoop();
            object.walkLoop();
            objects.add(object);
            
            object.self = object;
        };
    } else {
        console.error("objects.loadObject could not load " + URI);
        return null;
    }
    
    return objects.repository[name];
};

objects.prototype.create = function(name, x, y) {
    var object = repository.prototype.get(name);
    object.create(x,y);
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