var userInterface = {};

userInterface.elements = {};

userInterface.initialise = function() {
    userInterface.elements.canvas = document.getElementById("canvas");
    userInterface.elements.canvas.context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

//window.onresize