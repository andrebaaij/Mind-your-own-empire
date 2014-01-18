/* global document */

var initilise = {
    nbFilesLoaded : 0,
    nbFilesToLoad : 1
};


var common = {
    loadJavascript : function (url, callback){

        var script = document.createElement("script");
        script.type = "text/javascript";
    
        if (script.readyState){  //IE
            script.onreadystatechange = function(){
                if (script.readyState == "loaded" ||
                        script.readyState == "complete"){
                    script.onreadystatechange = null;
                    callback();
                }
            };
        } else {  //Others
            script.onload = function(){
                callback();
            };
        }
    
        script.src = url;
        document.getElementsByTagName("head")[0].appendChild(script);
    },
    updateProgress : function(percentage) {
        document.getElementById("progressBarProgress").style.width = percentage + "%";
        
        // Hide the load bar when finished.
        if (percentage >= 100) {
            document.getElementById("progressBarProgress").style.display = "none";
        }
    }
};

common.loadJavascript('./assets/javascript/rts.js', function() {
        initilise.nbFilesLoaded += 1;
        common.updateProgress(((initilise.nbFilesLoaded/initilise.nbFilesToLoad) * 100));
    }
);