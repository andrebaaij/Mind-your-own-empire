/*
    

    Styleguide: https://github.com/airbnb/javascript
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest */


/*

    Technical functions

*/

var common = {};

common.getJSONFromURI = function(URI) {

    var request = new XMLHttpRequest();
    
    //request.addEventListener("progress", updateProgress, false);
    //request.addEventListener("load", transferComplete, false);
    request.addEventListener("error", function() {console.error("common.getJSONFromURI could not get " + URI);}, false);
    request.addEventListener("abort", function() {console.error("common.getJSONFromURI could not get " + URI);}, false);
    
    request.open('GET', URI, false);
    request.send(null);
    if (request.status == 200) {
        return JSON.parse(request.responseText);
    } else {
        console.error("common.getJSONFromURI could not get " + URI);
        return null;
    }

};

common.require = function (name){
    var url = './assets/javascript/' + name + '.js';
    
    var script = document.createElement("script");
    script.type = "text/javascript";

    if (script.readyState){  //IE
        script.onreadystatechange = function(){
            if (script.readyState == "loaded" ||
                    script.readyState == "complete"){
                script.onreadystatechange = null;
                if (window[name].initialise) window[name].initialise();
            }
        };
    } else {  //Others
        script.onload = function(){
            if (window[name].initialise) window[name].initialise();
        };
    }

    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
};

/*

    Resources

*/

function resources(){}
common.resources = new resources();

function tilesets(){}
common.resources.tilesets = new tilesets();

var tileset = Image;
tileset.prototype.grid = {
    width : null,
    height : null
};
tileset.prototype.nbErrors = 0;
tileset.prototype.animations = null;

tilesets.prototype.add = function(name) {
    if (typeof common.resources.tilesets[name] !== 'undefined') {
        console.log("Tileset " + name + " has already been loaded");
        return null;
    }
    
    var URI = './assets/images/tilesets/' + name + '.json';
    
    var tilesetObject = common.getJSONFromURI(URI);
    
    if (tileset === null) {
        console.log("tilesets.add could not load " + URI);
        return null;    
    }
    
    var imageURI = './assets/images/tilesets/' + tilesetObject.image;
    common.resources.tilesets[name] = new tileset();
    common.resources.tilesets[name].addEventListener('load',function(){
        this.nbErrors = 0;
    });
    
    common.resources.tilesets[name].addEventListener('error',function(){
        if(this.nbErrors <= 3) {
            this.nbErrors += 1;
            this.src = this.src;
        } else {
            console.error("tilesets.add could not load image " + imageURI);
        }
    });
    
    common.resources.tilesets[name].grid = tilesetObject.grid;
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