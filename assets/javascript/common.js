/*
    Styleguide: https://github.com/airbnb/javascript
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest,game */


/*

    Technical functions

*/

var common = {};

common.getJSONFromURI = function(URI) {
    var request = new XMLHttpRequest();
    
    request.addEventListener("error", function() {console.error("common.getJSONFromURI could not get " + URI);}, false);
    request.addEventListener("abort", function() {console.error("common.getJSONFromURI could not get " + URI);}, false);
    
    request.open('GET', URI, false);
    request.send(null);
    if (request.status == 200) {
        try {
            return JSON.parse(request.responseText);
        } catch (err) {
            console.error(URI + " could not be parsed (invalid JSON)");        
        }
    } else {
        console.error("common.getJSONFromURI could not get " + URI);
        return null;
    }

};

common.require = function (){
    var scriptsToLoad = [],
        nScriptsLoaded = 0;
    
    // required files
    for (var i = 0; i < arguments.length-1; ++i) {
        scriptsToLoad.push(arguments[i]);
    }
    
    var callback = arguments[arguments.length-1];
    
    this.loadNext = function() {
        
        nScriptsLoaded += 1;
        
        if (nScriptsLoaded === scriptsToLoad.length) {
            callback();
            return;  
        }
        
        common.resources.scripts.add(scriptsToLoad[nScriptsLoaded], this.loadNext.bind(this));
    };
    
    common.resources.scripts.add(scriptsToLoad[0], this.loadNext.bind(this));
};

common.checkLineIntersection = function(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    var denominator, a, b, numerator1, numerator2, result = {
        x: null,
        y: null,
        onLine1: false,
        onLine2: false
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator === 0) {
        return result;
    }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));
/*
        // it is worth noting that this should be the same as:
        x = line2StartX + (b * (line2EndX - line2StartX));
        y = line2StartX + (b * (line2EndY - line2StartY));
        */
    // if line1 is a segment and line2 is infinite, they intersect if:
    if (a > 0 && a < 1) {
        result.onLine1 = true;
    }
    // if line2 is a segment and line1 is infinite, they intersect if:
    if (b > 0 && b < 1) {
        result.onLine2 = true;
    }
    // if line1 and line2 are segments, they intersect if both of the above are true
    return result;
};

// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array)
        return false;

    // compare lengths - can save a lot of time 
    if (this.length != array.length)
        return false;

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i]))
                return false;       
        }           
        else if (this[i] != array[i]) { 
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;   
        }           
    }       
    return true;
};

common.parseQueryString = function() {
    var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            query  = window.location.search.substring(1);

        var urlParams = {};
        while (match = search.exec(query))
           urlParams[decode(match[1])] = decode(match[2]);
    
        game.variables.url = urlParams;
}
/*

    Resources

*/

function resources(){}
common.resources = new resources();

// Tilesets

function tilesets(){}
common.resources.tilesets = new tilesets();

var tileset = Image;
tileset.prototype.grid = {
    width : null,
    height : null
};
tileset.prototype.tilesPerRow = 0;
tileset.prototype.nbErrors = 0;
tileset.prototype.animations = null;
tileset.prototype.image_selected = null;
tileset.prototype.isLoaded = false;

tilesets.prototype.add = function(name) {
    if (typeof common.resources.tilesets[name] !== 'undefined') {
        console.log("Tileset " + name + " has already been loaded");
        return null;
    }
    
    var URI = './assets/images/tilesets/' + name + '.json';
    
    var tilesetObject = common.getJSONFromURI(URI);
    
    if (tileset === null) {
        console.log("tilesets.add() could not load " + URI);
        return null;    
    }
    
    var imageURI = './assets/images/tilesets/' + name + '.png';
    
    common.resources.tilesets[name] = new tileset();
    common.resources.tilesets[name].addEventListener('load',function(){
        this.isLoaded = true;
        this.nbErrors = 0;
        this.tilesPerRow = this.width / this.grid.width;
        this.stored_width = this.width;
        this.stored_height = this.height;
    });
    
    common.resources.tilesets[name].addEventListener('error',function(){
        if(this.nbErrors <= 3) {
            this.nbErrors += 1;
            this.src = this.src;
        } else {
            console.error("tilesets.add could not load image " + imageURI);
        }
    });
    
    if (tilesetObject.imageSelected) {
        var image_selectedURI = './assets/images/tilesets/' +name + 'Selected.png';
        common.resources.tilesets[name].image_selected = new Image();
        
        common.resources.tilesets[name].image_selected.addEventListener('load',function(){
            this.isLoaded = true;
            this.nbErrors = 0;
            this.tilesPerRow = this.width / this.grid.width;
            this.stored_width = this.width;
            this.stored_height = this.height;
            
        });
        
        common.resources.tilesets[name].image_selected.addEventListener('error',function(){
            if(this.nbErrors <= 3) {
                this.nbErrors += 1;
                this.src = this.src;
            } else {
                console.error("tilesets.add could not load image " + image_selectedURI);
            }
        });
        
        common.resources.tilesets[name].image_selected.src = image_selectedURI;
    }
    
    common.resources.tilesets[name].grid = tilesetObject.grid;
    common.resources.tilesets[name].collisionBox = tilesetObject.collisionBox;
    common.resources.tilesets[name].animations = tilesetObject.animations;
    common.resources.tilesets[name].defaultAnimation = tilesetObject.defaultAnimation;
    common.resources.tilesets[name].src = imageURI;
    return common.resources.tilesets[name];
};

tilesets.prototype.get = function(name) {
    if(common.resources.tilesets[name] === undefined) {
        return common.resources.tilesets.add(name);
    }
    
    return common.resources.tilesets[name];
};

// Icons

function icons() {}
common.resources.icons = new icons();

var icon = Image;

icons.prototype.add = function(name) {
    if (typeof common.resources.icons[name] !== 'undefined') {
        console.log("Icon " + name + " has already been loaded");
        return null;
    }
    
    var imageURI = './assets/images/icons/' + name + '.png';
    
    common.resources.icons[name] = new icon();
    common.resources.icons[name].addEventListener('load',function(){
        this.nbErrors = 0;
    });
    
    common.resources.icons[name].addEventListener('error',function(){
        if(this.nbErrors <= 3) {
            this.nbErrors += 1;
            this.src = this.src;
        } else {
            console.error("tilesets.add could not load image " + imageURI);
        }
    });
    
    common.resources.icons[name].setAttribute("class","icon");
    common.resources.icons[name].src = imageURI;
    
    return common.resources.icons[name];
};

icons.prototype.get = function(name) {
    if(common.resources.icons[name] === undefined) {
        return common.resources.icons.add(name);
    }
    
    return common.resources.icons[name];
};

// Scripts
function Scripts() {}
common.resources.scripts = new Scripts();

function Script() {}

Scripts.prototype.add = function(name, callback) {
    var script = new Script();
    
    script.DOM = document.createElement("script");
    script.DOM.type = "text/javascript";
    
    if (script.DOM.readyState){  //IE
        script.DOM.onreadystatechange = function() {
            if (script.DOM.readyState == "loaded" ||
                    script.DOM.readyState == "complete"){
                script.DOM.onreadystatechange = null;
                if (window[name] && window[name].initialise) window[name].initialise();
                if (callback) callback();
            }
        };
    } else {  //Others
        script.DOM.onload = function(){
            if (window[name] && window[name].initialise) window[name].initialise();
            if (callback) callback();
        };
    }

    script.DOM.src = './assets/javascript/' + name + '.js';
    
    document.getElementsByTagName("head")[0].appendChild(script.DOM);
};

/*

    Game engine specific functions

*/

common.scaleNumber = function(number, invert) {
    invert = typeof invert !== 'undefined' ? invert : false;
    
    for (var i = game.variables.scale.minLevel; i < game.variables.scale.level; i++) {
        if(invert) {
            number *= game.variables.scale.speed;
        } else {
            number /= game.variables.scale.speed;
        }
    }
    
    return number;
}

common.getGridFromScreen = function(canvas, x, y) {
    var coordinates = common.getCoordinatesFromScreen(canvas, x, y)

    return common.getGridFromCoordinates(coordinates.x, coordinates.y);
    
};

common.getGridFromCoordinates = function(x, y) {
    var tileWidth = game.variables.tile.width;
    var tileHeight = game.variables.tile.height;
    
    x = x - tileWidth/2;
   
    var gx = Math.floor(x / tileWidth + y / tileHeight);
    var gy = Math.floor(y / tileHeight - x / tileWidth);
    
    gx = parseInt(gx,10);
    gy = parseInt(gy,10);
    
    var chunkX = Math.floor(gx/game.variables.chunk.size);
    var chunkY = Math.floor(gy/game.variables.chunk.size);
    
    var i = (gx - chunkX * game.variables.chunk.size) + ((gy - chunkY * game.variables.chunk.size) * game.variables.chunk.size);
    return {
        chunk : {
            x : chunkX,
            y : chunkY
        },
        x : gx,
        y : gy,
        i : i
    };
};

common.getCoordinatesFromScreen = function(canvas, x, y) {
    x = common.scaleNumber(x, true) - canvas.xOffset;
    y = common.scaleNumber(y, true ) - canvas.yOffset;
    
    return {x : x, y : y};
};

common.getCoordinatesFromGrid = function(x, y) {
    var tileWidth = game.variables.tile.width;
    var tileHeight = game.variables.tile.height;
    
    var sx = ((parseInt(x,10) - parseInt(y,10)) * (tileWidth / 2)) + tileWidth/2;
    var sy = ((parseInt(x,10) + parseInt(y,10)) * (tileHeight / 2)) + tileHeight/2;
    return { x : sx, y : sy};
};

/*
    Window
*/

common.window = function(header, x, y) {
    var $game = $('#game');
    
    var $window = $('<div/>').addClass('table')
                .addClass('window')
                .attr('style','left:' + x + '; top:' + y + '; position: absolute;');
    
    var $header = common.windowRow('100%','15px')
        .addClass('header');
        $title = common.windowRowCell('100%','15px')
            .addClass('title')
            .text(header);
        $close = common.windowRowCell('15px','15px')
            .addClass('close')
            .text('X');
    
    $header.append($title);
    $header.append($close);
        
    $window.append($header);                                   

    $close.bind('click',function(e) {
                $window.hide();
    });
    
    $window.draggable({
                stack: "#game > .window",
                containment: "#game",
                snap: true,
                handle: ".header"
            })
            .resizable({
                containment: "parent",
                minHeight: 150,
                minWidth: 300,
                handles: "se" 
            })
            .hover(function () {
                game.variables.scrollX = 0;
                game.variables.scrollY = 0;
            });
    
    $game.append($window);
    
    return $window;
    
//        <div class="table window" style="top: 50; left 0;">
//            <div class="row">
//                <div class="cell header">
//                    MIND
//                </div>
//            </div>
//            <div class="row" style="height: 100%;">
//                <div class="inside">
//                </div>
//            </div>
//        </div>
};

common.windowRow = function(width, height) {
    $row = $('<div/>')
        .addClass('row')
        .attr('style','width: ' + width + '; height: ' + height);
    return $row;
};

common.windowRowCell = function(width, height) {
    $cell = $('<div/>').addClass('cell')
        .attr('style','width: ' + width + '; height: ' + height);
    
    return $cell;
};

/*
    Background worker thread
*/

common.background = {
    queues : []
}
common.background.process = function() {
    var _self = this;
    
    var i;
    for (i = 0; i < _self.queues.length; i++) {
        _self.queues[i].process(1);
    }
};
common.background.find = function(name) {
    for (i = 0; i < _self.jobs.length(); i++) {
        if (_self.queues[i].name === name) {
            return _self.queues[i];    
        }
    }
};
common.background.queue = function(name) {
    var _self = this;
    
    var name = name,
        jobs = [];
    
    common.background.queues.push(_self);
};
common.background.queue.prototype.jobs = [];
common.background.queue.prototype.process = function(nJobs) {
    var _self = this;
    
    var i,
        job;
    
    for (i = 0; i < nJobs; i++) {
        if(_self.jobs.length === 0)
            return;
        
        var job = _self.jobs.shift();
        job.process();
    }
};
common.background.queue.prototype.clean = function(filter) {
    var _self = this;
    
    var i;
    
    for (i = 0; i < _self.jobs.length(); i++) {
        if(_self.jobs[i].clear(filter)) {
            _self.jobs[i].clean();   
        }
    }
};

common.background.queue.prototype.push = function(job) {
    var _self = this;
    
    _self.jobs.push(job);
    job.queue = _self;
};

common.background.job = function() {};
common.background.job.prototype.process = function() {};
/*
    Description:Checks if this job should be removed from the queue according to the filter.
    Paramaters: filter; any object type
    Return:     Boolean, true = clean, false is keep.
*/
common.background.job.prototype.clear = function(filter) {
    var _self = this;
    
    if (1 === 0) {
        return true;
    }
    
    return false;
};

/*
    Description:Removes the current job from its queue, as it should not be processed anymore
    Paramaters: NA
    Return:     NA
*/
common.background.job.prototype.clean = function() {
    var i = _self.queue.indexOf(_self);
    if (i !== -1) {
        _self.queue.splice(i,1);
    }
}


