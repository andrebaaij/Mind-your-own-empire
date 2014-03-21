/*
    

    Styleguide: https://github.com/airbnb/javascript
*/

/*

    Interface to objects:
    
    objects.create(objectName, x, y);
    returns the newly created object;
    
    objects.list(orderArguments);
    returns a list of all the objects sorted by arguments
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
        objects.repository[name].activeAnimation = {};
        
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
        
        objects.repository[name].setActiveAnimation = function(animation) {
            if (this.activeAnimation.name !== animation) {
                this.activeAnimation.name = animation;
                this.activeAnimation.array = this.tileset.animations[animation].NE;
                this.activeAnimation.index = 0;
            }
        };
        
        /*
            Skills
        */
        
        if(object.skills.indexOf("walk") !== -1) {
            objects.repository[name].walk = function(x,y) {
                this.path = []; //level.getPath(object,{ x = x, y  = y},);
            };
            
            objects.repository[name].walkLoop = function() {
                var destination = this.path[0];
                var x = destination.x - this.x;
                var y = destination.y - this.y;
                
                if(x > 5) x = 5;
                if(y > 5) y = 5;
                
                if (x < 5 && y < 5) {
                    this.path.splice();
                } else {
                    setTimeout(this.walkLoop,100);
                }
                
                this.move(x,y);
            };
        }
        
        /*
            Create
        */
        
        objects.repository[name].create = function(x,y) {
            var object = objects.repository[name].clone();
            
            // remove pure repository functions
            object.clone = undefined;
            object.create = undefined;
            
            object.x = x;
            object.y = y;
            object.setActiveAnimation(object.tileset.defaultAnimation);
            object.animationLoop(); 
            objects.add(object);
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

// Initialise the Object objects.prototype.repository
objects.prototype.repository = new repository();


// Initialise the Object objects
objects = new objects();