/*
    Styleguide: https://github.com/airbnb/javascript
*/


/* global common:true, Image,document,window,console,XMLHttpRequest,game,$,data */


/* Technical functions */

common = {};

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

// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function (array) {
    // if the other array is a falsy value, return
    if (!array) {
        return false;
    }

    // compare lengths - can save a lot of time
    if (this.length != array.length) {
        return false;
    }

    for (var i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (this[i] instanceof Array && array[i] instanceof Array) {
            // recurse into the nested arrays
            if (!this[i].equals(array[i])) {
                return false;
            }
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
        while (match = search.exec(query)) {
           urlParams[decode(match[1])] = decode(match[2]);
        }

        data.url = urlParams;
};

/* Resources */

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

tileset.prototype.initialise = function(img) {

    img.nbErrors = 0;

    img.nbTilesPerColumn = Math.floor(this.height / this.grid.height);
    img.nbTilesPerRow = Math.floor(this.width / this.grid.width);
    img.nbTiles = img.nbTilesPerColumn * img.nbTilesPerRow;

    img.stored_width = img.width;
    img.stored_height = img.height;

    img.tile = [];

    for(var i = 0; i < img.nbTiles; i++) {
        //console.log(i);

        var tileX = i % img.nbTilesPerRow,
            tileY = Math.floor(i / img.nbTilesPerRow);

        var lx = tileX * this.grid.width,
            ty = tileY * this.grid.height,
            rx = lx + this.grid.width,
            by = ty + this.grid.height;

        img.tile[i] = {
            lx : lx,
            ty : ty,
            rx : rx,
            by : by
        };
    }

    img.isLoaded = true;
};

tilesets.prototype.add = function(name) {
    var _self = this;

    _self.name = name;

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
    common.resources.tilesets[name].grid = tilesetObject.grid;
    common.resources.tilesets[name].collisionBox = tilesetObject.collisionBox;
    common.resources.tilesets[name].animations = tilesetObject.animations;
    common.resources.tilesets[name].defaultAnimation = tilesetObject.defaultAnimation;

    common.resources.tilesets[name].addEventListener('load',function(){
        this.initialise(common.resources.tilesets[name]);
    });

    common.resources.tilesets[name].addEventListener('error',function(){
        if(this.nbErrors <= 3) {
            this.nbErrors += 1;
            this.src = this.src;
        } else {
            console.error("tilesets.add could not load image " + imageURI);
        }
    });

    common.resources.tilesets[name].src = imageURI;

    if (tilesetObject.imageSelected) {
        var image_selectedURI = './assets/images/tilesets/' +name + 'Selected.png';
        common.resources.tilesets[name].image_selected = new Image();
        common.resources.tilesets[name].image_selected.grid = tilesetObject.grid;

        common.resources.tilesets[name].image_selected.addEventListener('load',function(){
            this.initialise(common.resources.tilesets[name].image_selected);
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
                if (window[name] && window[name].initialise) {
                    window[name].initialise();
                }
                if (callback) {
                    callback();
                }
            }
        };
    } else {  //Others
        script.DOM.onload = function(){
            if (window[name] && window[name].initialise) {
                window[name].initialise();
            }
            if (callback) {
                callback();
            }
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

    for (var i = data.scale.minLevel; i < data.scale.level; i++) {
        if(invert) {
            number *= data.scale.speed;
        } else {
            number /= data.scale.speed;
        }
    }

    return number;
};

common.getGridFromScreen = function(scroll, x, y) {
    var coordinates = common.getCoordinatesFromScreen(scroll, x, y);
    return common.getGridFromCoordinates(coordinates.x, coordinates.y);
};

common.getGridFromCoordinates = function(x, y) {
    var tileWidth = data.tile.width;
    var tileHeight = data.tile.height;

    x = x - tileWidth/2;

    var gx = Math.floor(x / tileWidth + y / tileHeight);
    var gy = Math.floor(y / tileHeight - x / tileWidth);

    gx = parseInt(gx,10);
    gy = parseInt(gy,10);

    var chunkX = Math.floor(gx/data.chunk.size);
    var chunkY = Math.floor(gy/data.chunk.size);

    var i = (gx - chunkX * data.chunk.size) + ((gy - chunkY * data.chunk.size) * data.chunk.size);
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

common.getCoordinatesFromScreen = function(scroll, x, y) {
    x = common.scaleNumber(x, true) - scroll.offset.x;
    y = common.scaleNumber(y, true ) - scroll.offset.y;

    return {x : x, y : y};
};

common.getCoordinatesFromGrid = function(x, y) {
    var tileWidth = data.tile.width;
    var tileHeight = data.tile.height;

    var sx = ((parseInt(x,10) - parseInt(y,10)) * (tileWidth / 2)) + tileWidth/2;
    var sy = ((parseInt(x,10) + parseInt(y,10)) * (tileHeight / 2)) + tileHeight/2;
    return { x : sx, y : sy};
};

common.getTileCoordinatesFromGrid = function(x, y) {
    var tileWidth = data.tile.width;
    var tileHeight = data.tile.height;

    var coordinates = common.getCoordinatesFromGrid(x, y);

    coordinates.x -= tileWidth/2;
    coordinates.y -= tileHeight/2;
    return coordinates;
};

/* Window */

common.window = function(header, x, y) {
    var $game = $('#game');

    var $window = $('<div/>').addClass('table')
                .addClass('window')
                .attr('style','left:' + x + '; top:' + y + '; position: absolute;');

    var $header = common.windowRow('100%','15px')
        .addClass('header');
    var $title = common.windowRowCell('100%','15px')
            .addClass('title')
            .text(header);
    var $close = common.windowRowCell('15px','15px')
            .addClass('close')
            .text('X');

    $header.append($title);
    $header.append($close);

    $window.append($header);

    $close.bind('click',function() {
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
                data.scrollX = 0;
                data.scrollY = 0;
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
    var $row = $('<div/>')
        .addClass('row')
        .attr('style','width: ' + width + '; height: ' + height);
    return $row;
};

common.windowRowCell = function(width, height) {
    var $cell = $('<div/>').addClass('cell')
        .attr('style','width: ' + width + '; height: ' + height);

    return $cell;
};

common.RunPrefixMethod = function(obj, method) {
    var pfx = ["webkit", "moz", "ms", "o", ""];

    var p = 0, m, t;
    while (p < pfx.length && !obj[m]) {
        m = method;
        if (pfx[p] === "") {
            m = m.substr(0,1).toLowerCase() + m.substr(1);
        }
        m = pfx[p] + m;
        t = typeof obj[m];
        if (t != "undefined") {
            pfx = [pfx[p]];
            return (t == "function" ? obj[m]() : obj[m]);
        }
        p++;
    }
};