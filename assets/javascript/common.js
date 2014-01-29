/*
    

    Styleguide: https://github.com/airbnb/javascript
*/


/* global Image,document,window,setTimeout,console,XMLHttpRequest */

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
