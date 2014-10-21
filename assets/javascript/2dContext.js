var neheTexture;
var shaderProgram;
var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;


function context2d(canvas) {
    var gl;
    
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
    
    this.helper.variables.texture.max_units = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
    this.helper.gl = gl;
    
    this.initShaders();
    this.initBuffers();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    
    this.tick();
};

context2d.prototype.helper = {
    variables : {
        texture : {
            current_unit : -1,
            array : []
        }
    }
};



context2d.prototype.initShaders = function() {
    var gl = this.helper.gl;
    
    var fragmentShader = this.getShader(gl, "shader-fs");
    var vertexShader = this.getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    
    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    // set the resolution
    shaderProgram.resolutionLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
    shaderProgram.textureresolution = gl.getUniformLocation(shaderProgram, "u_textureresolution");
    gl.uniform2f(shaderProgram.resolutionLocation, 500, 500);
    
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}



context2d.prototype.initTexture = function(img) {
    var gl = this.helper.gl;
    
    var n2size = Math.pow(2, Math.ceil(Math.log(Math.max(img.width, img.height)) / Math.log(2)));
    var n2img;

    n2canvas = document.createElement('canvas');
    n2canvas.width = n2canvas.height = n2size;
    n2canvas.context = n2canvas.getContext('2d');
    n2canvas.context.drawImage(img, 0, 0);

    var buffer = {};

    buffer.texture = gl.createTexture();
    buffer.texture.image = n2canvas;

    gl.bindTexture(gl.TEXTURE_2D, buffer.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    
    buffer.position = gl.createBuffer(); // imagePositionBuffer;

    buffer.vertexTextureCoord = gl.createBuffer(); //imageVertexTextureCoordBuffer;
    buffer.vertexTextureCoord.itemSize = 2;
    buffer.vertexTextureCoord.numItems = 4;

    buffer.vertexIndex = gl.createBuffer();
    buffer.vertexIndex.itemSize = 1;
    buffer.vertexIndex.numItems = 6;

    this.helper.variables.texture.current_unit += 1;
    if (this.helper.variables.texture.current_unit === this.helper.variables.texture.max_units) {
        this.helper.variables.texture.current_unit = 0;
    }
    
    if (this.helper.variables.texture.array[this.helper.variables.texture.current_unit]) {
        this.helper.variables.texture.array[this.helper.variables.texture.current_unit].buffer.texture.unit_number = null;
        this.helper.variables.texture.array[this.helper.variables.texture.current_unit].buffer.texture.unit_identifier = null;
    }

    buffer.texture.unit_number = this.helper.variables.texture.current_unit;
    buffer.texture.unit_identifier = 'TEXTURE' + this.helper.variables.texture.current_unit;
    this.helper.variables.texture.array[this.helper.variables.texture.current_unit] = img;
    
    console.log(gl[buffer.texture.unit_identifier]);
    
    gl.activeTexture(gl[buffer.texture.unit_identifier]);
    gl.bindTexture(gl.TEXTURE_2D, buffer.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buffer.texture.image);
    
    return img.buffer = buffer;    
}

context2d.prototype.initBuffers = function() {
    var gl = this.helper.gl;
    
    cubeVertexPositionBuffer = gl.createBuffer();
    cubeVertexPositionBuffer.itemSize = 3;
    cubeVertexPositionBuffer.numItems = 4;
    
    cubeVertexIndexBuffer = gl.createBuffer();
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 6;
    
    cubeVertexTextureCoordBuffer = gl.createBuffer();
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 4;

}

context2d.prototype.tick = function() {
    var gl = this.helper.gl;
    
    requestAnimationFrame(this.tick.bind(this));

    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    for (var i = 0; i < 100; i++) {
        var img = common.resources.tilesets.get("block");
        this.drawImage(img, 50, 50);
    }
    
    var img = common.resources.tilesets.get("mind");
    this.drawImage(img, 150, 150);
    
    var img = common.resources.tilesets.get("tower");
    this.drawImage(img, 50, 50);
}

context2d.prototype.getShader = function(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

/*

    Extra

*/


context2d.prototype.drawImage = function () {
    var gl = this.helper.gl;
    
    var params = {};

    // Default settings
    params.img = arguments[0];
    
    // If the image is not loaded yet, we can stop this.
    if (!params.img || !params.img.complete) {
        return;
    }

    params.width = params.img.width;
    params.height = params.img.height;
    params.sx = 0;
    params.sy = 0;
    params.swidth = params.img.width;
    params.sheight = params.img.height;

    if (arguments.length === 3) {
        // context.drawImage(img,x,y);
        params.x = arguments[1];
        params.y = arguments[2];
    } else if (arguments.length === 5) {
        // context.drawImage(img,x,y,width,height);
        params.x = arguments[1];
        params.y = arguments[2];
        params.width = arguments[3];
        params.height = arguments[4];
    } else if (arguments.length === 9) {
        // context.drawImage(img,sx,sy,swidth,sheight,x,y,width,height);
        params.sx = arguments[1];
        params.sy = arguments[2];
        params.swidth = arguments[3];
        params.sheight = arguments[4];
        params.x = arguments[5];
        params.y = arguments[6];
        params.width = arguments[7];
        params.height = arguments[8];
    } else {
        // incorrect number of arguments.
        return;
    }

    // If the image is not buffered yet, buffer it now.
    if (!params.img.buffer) {
        //params.img.buffer = this.bufferImage(params.img);
        this.initTexture(params.img);
    }
//
//    // If the texture is not activate anymore, activate it.
//    if (!params.img.buffer.texture.glActiveTextureReference) {
//        params.img.buffer.texture.glActiveTextureReference = this.activateTexture(params.img.buffer.texture);
//    }
    
    //gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    
    gl.activeTexture(gl[params.img.buffer.texture.unit_identifier]);
    gl.bindTexture(gl.TEXTURE_2D, params.img.buffer.texture);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    var x = params.x,
        y = params.y,
        width = params.width,
        height = params.height;
    
    var vertices = [
        x,y,1,
        x+width,y,1,
        x+width,y+height,1,
        x,y+height,1
    ]
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);


    gl.uniform2f(shaderProgram.textureresolution, params.img.buffer.texture.image.width, params.img.buffer.texture.image.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    
    var x = params.sx,
        y = params.sy,
        width = params.swidth,
        height = params.sheight;
    
    var textureCoords = [
        x,y,
        x+width,y,
        x+width,y+height,
        x,y+height
    ]
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);


    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [
        0, 1, 2,
        0, 2, 3
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);

    
    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl[params.img.buffer.texture.unit_identifier]);
    gl.uniform1i(shaderProgram.samplerUniform, params.img.buffer.texture.unit_number);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    //gl.activeTexture(gl[params.img.buffer.texture.unit_number]);
    gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    
};