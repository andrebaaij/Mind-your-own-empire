/*
    

    Styleguide: https://github.com/airbnb/javascript
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest,common */

var objects = {};

function repository() {}

repository.prototype.add = function(name) {
    var URI = './assets/objects/' + name + '.json';
    
    var object = common.getJSONFromURI(URI);
    
    if (object !== null) {
        objects[name] = object;
    } else {
        console.error("objects.loadObject could not load " + URI);
    }
};


objects.repository = new repository();