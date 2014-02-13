var userInterface = {};

userInterface.elements = {};

userInterface.initialise = function() {
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.canvas.context = canvas.getContext("2d");
    window.onresize();
};

window.onresize = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};