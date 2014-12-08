var shaderProgram;
var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;


function context2d(canvas) {
    var _self = this;
    _self.gl = {};

    try {
        _self.gl = canvas.getContext("experimental-webgl");
        _self.gl.viewportWidth = canvas.width;
        _self.gl.viewportHeight = canvas.height;
        _self.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        _self.gl.clear(_self.gl.COLOR_BUFFER_BIT | _self.gl.DEPTH_BUFFER_BIT);
    } catch (e) {
    }
    if (!_self.gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }

    _self.variables = {
        offset : {
            x : 0,
            y : 0
        }
    };

    _self.width = canvas.width;
    _self.height = canvas.height;
    _self.initShaders();
    _self.initBuffers();
    _self.vertexPositionBuffer = [];
    _self.textureCoordinationBuffer = [];
    _self.vertexIndexBuffer = [];
    _self.textures = [];

    _self.gl.activeTexture(_self.gl.TEXTURE0);
    _self.gl.bindBuffer(_self.gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
}

/* Placeholders */
context2d.prototype.scale = function(scaleX,scaleY) {};

context2d.prototype.translate = function(xOffset,yOffset) {
    var _self = this;
    _self.xOffset = _self.variables.offset.x = xOffset;
    _self.yOffset = _self.variables.offset.y = yOffset;
};

context2d.prototype.dimensions = function(width, height) {
    var _self = this;
    var gl = _self.gl;

    _self.width = width;
    _self.height = height;

    gl.viewport(0, 0, width, height);
    shaderProgram.resolutionLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
    gl.uniform2f(shaderProgram.resolutionLocation, _self.width, _self.height);
};

context2d.prototype.initShaders = function() {

    var _self = this;

    var gl = _self.gl;

    var fragmentShader = _self.getShader(gl, "shader-fs");
    var vertexShader = _self.getShader(gl, "shader-vs");

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
    shaderProgram.textureresolution = gl.getUniformLocation(shaderProgram, "u_textureresolution");
    gl.uniform2f(shaderProgram.resolutionLocation, _self.height,_self.width);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
};



context2d.prototype.initTexture = function(image) {
   // console.log('initTexture:start', image);

    var _self = this;

    var gl = _self.gl;

    var n2size = Math.pow(2, Math.ceil(Math.log(Math.max(image.width, image.height)) / Math.log(2)));

    var n2canvas = document.createElement('canvas');
    n2canvas.width = n2canvas.height = n2size;
    n2canvas.context = n2canvas.getContext('2d');
    n2canvas.context.drawImage(image, 0, 0);

    image.gl = {};

    image.gl.texture = gl.createTexture();
    image.gl.texture.image = n2canvas;

    gl.bindTexture(gl.TEXTURE_2D, image.gl.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
//    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
//    gl.enable(gl.BLEND);

    image.gl.numberOfDrawCalls = -1;
    image.gl.vertexPositionBuffer = [];
    image.gl.textureCoordinationBuffer = [];
    image.gl.vertexIndexBuffer = [];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, image.gl.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image.gl.texture.image);

    return image.gl;
};

context2d.prototype.initBuffers = function() {
    var _self = this;
    var gl = _self.gl;

    cubeVertexPositionBuffer = gl.createBuffer();
    cubeVertexPositionBuffer.itemSize = 3;
    cubeVertexPositionBuffer.numItems = 4;

    cubeVertexIndexBuffer = gl.createBuffer();
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 6;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 4;

};

context2d.prototype.getShader = function(gl, id) {
    var _self = this;

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
};

/*

    Extra

*/


context2d.prototype.drawImage = function (image, x, y, tileIndex) {
    //console.log('drawImage:start');

    var _self = this;

    // If the image is not loaded yet, we don't have anything to draw, so let's quit the execution of this function.
    if (!image.isLoaded) {
        return;
    }

    //TODO: Migrate this to the gl camera.
    //Draw the images with an offset because of scrolling throug the field.
    x += _self.variables.offset.x;
    y += _self.variables.offset.y;

    // If the image is not initialised yet, buffer it now.
    if (!image.gl) {
        _self.initTexture(image);
    }

    // For this scene, this is the nth drawcall:
    var i = image.gl.numberOfDrawCalls += 1;

    // Add this texture to the scene if this is its first drawcall.
    if (typeof i === 'undefined' || i === 0) {
        _self.textures.push(image);
    }

    //Vertices px positions

    var xwidth = x + image.grid.width,
        yheight = y + image.grid.height;


    var i12 = i * 12;
    image.gl.vertexPositionBuffer[i12] = x;
    image.gl.vertexPositionBuffer[i12+1] = y;
    image.gl.vertexPositionBuffer[i12+2] = i;

    image.gl.vertexPositionBuffer[i12+3] = xwidth;
    image.gl.vertexPositionBuffer[i12+4] = y;
    image.gl.vertexPositionBuffer[i12+5] = i;

    image.gl.vertexPositionBuffer[i12+6] = xwidth;
    image.gl.vertexPositionBuffer[i12+7] = yheight;
    image.gl.vertexPositionBuffer[i12+8] = i;

    image.gl.vertexPositionBuffer[i12+9] = x;
    image.gl.vertexPositionBuffer[i12+10] = yheight;
    image.gl.vertexPositionBuffer[i12+11] = i;

    //Texture px positions

    var tile = image.tile[tileIndex],
        i8 = i * 8;
    try {
        image.gl.textureCoordinationBuffer[i8] = tile.lx;
        image.gl.textureCoordinationBuffer[i8+1] = tile.ty;

        image.gl.textureCoordinationBuffer[i8+2] = tile.rx;
        image.gl.textureCoordinationBuffer[i8+3] = tile.ty;

        image.gl.textureCoordinationBuffer[i8+4] = tile.rx;
        image.gl.textureCoordinationBuffer[i8+5] = tile.by;

        image.gl.textureCoordinationBuffer[i8+6] = tile.lx;
        image.gl.textureCoordinationBuffer[i8+7] = tile.by;
    } catch (e) {
        console.log(image, tileIndex);
    };
    //Vertices index

    var i4 = i*4,
        i6 = i*6;

    image.gl.vertexIndexBuffer[i6] = i4;
    image.gl.vertexIndexBuffer[i6+1] = i4+1;
    image.gl.vertexIndexBuffer[i6+2] = i4+2;

    image.gl.vertexIndexBuffer[i6+3] = i4;
    image.gl.vertexIndexBuffer[i6+4] = i4+2;
    image.gl.vertexIndexBuffer[i6+5] = i4+3;
};


context2d.prototype.drawScene = function() {
    var _self = this;

    _self.drawTextures(_self.gl, _self.textures);
};

context2d.prototype.drawTextures = function(gl, textures) {
    //console.log('drawTextures:start', gl, textures);

    var _self = this;

    textures.forEach(function(texture) {
        _self.drawTexture(gl, texture);
    });

    //console.log('drawTextures:end');
};

context2d.prototype.drawTexture = function(gl, texture) {
    //console.log('drawTexture:start');



    //gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture.gl.texture);
    gl.uniform2f(shaderProgram.textureresolution, texture.gl.texture.image.width, texture.gl.texture.image.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture.gl.vertexPositionBuffer), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture.gl.textureCoordinationBuffer), gl.STATIC_DRAW);

    //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(texture.gl.vertexIndexBuffer), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

    //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    gl.drawElements(gl.TRIANGLES, (texture.gl.numberOfDrawCalls + 1) * 6, gl.UNSIGNED_SHORT, 0);

    //console.log('drawTexture:end');
};

// Resets all data.
context2d.prototype.clearScene = function() {
    var _self = this;

    _self.textures = _self.clearTextures(_self.textures);
};

// Resets all current drawcalls for the supplied textures
context2d.prototype.clearTextures = function(textures) {
    //console.log('clearTextures:start', textures);

    var _self = this;

    textures.forEach(function(texture) {
        texture = _self.clearTexture(texture);
    });

    return [];
};

// Resets all current drawcalls for the supplied texture
context2d.prototype.clearTexture = function(texture) {
    //console.log('clearTexture:start', texture);

    //Set the current drawcalls to 0
    texture.gl.numberOfDrawCalls = -1;
    texture.gl.vertexPositionBuffer = new Array(texture.gl.vertexPositionBuffer.length);
    texture.gl.textureCoordinationBuffer = new Array(texture.gl.textureCoordinationBuffer.length);
    texture.gl.vertexIndexBuffer = new Array(texture.gl.vertexIndexBuffer.length);

    return texture;
};
