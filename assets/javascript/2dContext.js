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

    _self.translate(0,0);
}

/* Placeholders */
context2d.prototype.scale = function(scaleX,scaleY) {};

context2d.prototype.translate = function(xOffset,yOffset) {
    var _self = this;
    this.gl.uniform2f(shaderProgram.translate, xOffset, yOffset);
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
    shaderProgram.translate = gl.getUniformLocation(shaderProgram, "u_translate");

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

    image.gl.totalNumberOfDrawCalls = 0;
    image.gl.previousTotalNumberOfDrawCalls = 0;
    image.gl.currentNumberOfDrawCalls = 0;
    image.gl.vertexPositionBuffer = [];
    image.gl.textureCoordinationBuffer = [];
    image.gl.vertexIndexBuffer = [];
    image.gl.objects = [];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, image.gl.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image.gl.texture.image);

    image.gl.cubeVertexPositionBuffer = gl.createBuffer();
    image.gl.cubeVertexTextureCoordBuffer = gl.createBuffer();

    return image.gl;
};

context2d.prototype.initBuffers = function() {
    var _self = this;
    var gl = _self.gl;

    cubeVertexIndexBuffer = gl.createBuffer();
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

context2d.prototype.drawTile = function (texture, x, y, tileIndex, object) {
    var _self = this;

    // If the texture is not loaded yet, we don't have anything to draw, so let's quit the execution of this function.
    if (!texture.isLoaded) {
        return;
    }

    // If the texture is not initialised yet, buffer it now.
    if (!texture.gl) {
        _self.initTexture(texture);
    }

    // For this scene, this is the nth drawcall:
    var i = texture.gl.totalNumberOfDrawCalls;

    // Add this texture to the scene if this is its first drawcall.
    if (typeof texture.gl.currentNumberOfDrawCalls === 'undefined' || texture.gl.currentNumberOfDrawCalls === 0) {
        _self.textures.push(texture);
    }

    if(typeof object.gl === 'undefined') {
        texture.gl.objects.push(object);

        object.gl = {
            index : i
        };

        var buffers = {
            vertex : texture.gl.vertexPositionBuffer,
            texture : texture.gl.textureCoordinationBuffer,
            vertexIndex : texture.gl.vertexIndexBuffer
        };

        var tile = texture.tile[tileIndex];
        this.bufferDraw(buffers, i, x, y, texture, tile);

        texture.gl.totalNumberOfDrawCalls += 1;
    }

    i = texture.gl.currentNumberOfDrawCalls;

    //Vertices index
    var i4 = object.gl.index*4, //object.gl.index
        i6 = i*6;

    texture.gl.vertexIndexBuffer[i6] = i4;
    texture.gl.vertexIndexBuffer[i6+1] = i4+1;
    texture.gl.vertexIndexBuffer[i6+2] = i4+2;

    texture.gl.vertexIndexBuffer[i6+3] = i4;
    texture.gl.vertexIndexBuffer[i6+4] = i4+2;
    texture.gl.vertexIndexBuffer[i6+5] = i4+3;

    texture.gl.currentNumberOfDrawCalls += 1;
};

context2d.prototype.drawObject = function (texture, x, y, tileIndex, object) {
     var _self = this;

    // If the texture is not loaded yet, we don't have anything to draw, so let's quit the execution of this function.
    if (!texture.isLoaded) {
        return;
    }

    // If the texture is not initialised yet, buffer it now.
    if (!texture.gl) {
        _self.initTexture(texture);
    }

    // For this scene, this is the nth drawcall:
    var i = texture.gl.totalNumberOfDrawCalls;

    // Add this texture to the scene if this is its first drawcall.
    if (typeof texture.gl.currentNumberOfDrawCalls === 'undefined' || texture.gl.currentNumberOfDrawCalls === 0) {
        _self.textures.push(texture);
        texture.gl.previousTotalNumberOfDrawCalls = 0;
        texture.gl.totalNumberOfDrawCalls = 0;
        texture.gl.objects = [];
    }

    texture.gl.objects.push(object);

    object.gl = {
        index : i
    };

    var buffers = {
        vertex : texture.gl.vertexPositionBuffer,
        texture : texture.gl.textureCoordinationBuffer,
        vertexIndex : texture.gl.vertexIndexBuffer
    };

    var tile = texture.tile[tileIndex];
    this.bufferDraw(buffers, i, x, y, texture, tile);

    texture.gl.totalNumberOfDrawCalls += 1;

    i = texture.gl.currentNumberOfDrawCalls;

    //Vertices index
    var i4 = object.gl.index*4, //object.gl.index
        i6 = i*6;

    texture.gl.vertexIndexBuffer[i6] = i4;
    texture.gl.vertexIndexBuffer[i6+1] = i4+1;
    texture.gl.vertexIndexBuffer[i6+2] = i4+2;

    texture.gl.vertexIndexBuffer[i6+3] = i4;
    texture.gl.vertexIndexBuffer[i6+4] = i4+2;
    texture.gl.vertexIndexBuffer[i6+5] = i4+3;

    texture.gl.currentNumberOfDrawCalls += 1;
};

context2d.prototype.bufferDraw = function (buffers, i, x, y, texture, tile) {
    var xwidth = x + texture.grid.width,
        yheight = y + texture.grid.height;

    var i12 = i * 12,
        i8 = i * 8;
    buffers.vertex[i12] = x;
    buffers.vertex[i12+1] = y;
    buffers.vertex[i12+2] = i;

    buffers.vertex[i12+3] = xwidth;
    buffers.vertex[i12+4] = y;
    buffers.vertex[i12+5] = i;

    buffers.vertex[i12+6] = xwidth;
    buffers.vertex[i12+7] = yheight;
    buffers.vertex[i12+8] = i;

    buffers.vertex[i12+9] = x;
    buffers.vertex[i12+10] = yheight;
    buffers.vertex[i12+11] = i;



    buffers.texture[i8] = tile.lx;
    buffers.texture[i8+1] = tile.ty;

    buffers.texture[i8+2] = tile.rx;
    buffers.texture[i8+3] = tile.ty;

    buffers.texture[i8+4] = tile.rx;
    buffers.texture[i8+5] = tile.by;

    buffers.texture[i8+6] = tile.lx;
    buffers.texture[i8+7] = tile.by;

    return buffers;
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
    if (texture.gl.currentNumberOfDrawCalls > 0) {
        //gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.gl.texture);
        gl.uniform2f(shaderProgram.textureresolution, texture.gl.texture.image.width, texture.gl.texture.image.height);

        if (texture.gl.totalNumberOfDrawCalls > texture.gl.previousTotalNumberOfDrawCalls) {
            gl.bindBuffer(gl.ARRAY_BUFFER, texture.gl.cubeVertexPositionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture.gl.vertexPositionBuffer), gl.STATIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, texture.gl.cubeVertexTextureCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture.gl.textureCoordinationBuffer), gl.STATIC_DRAW);
        }

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(texture.gl.vertexIndexBuffer), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, texture.gl.cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, texture.gl.cubeVertexTextureCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        gl.drawElements(gl.TRIANGLES, (texture.gl.currentNumberOfDrawCalls) * 6, gl.UNSIGNED_SHORT, 0);
    }
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
    texture.gl.previousTotalNumberOfDrawCalls = texture.gl.totalNumberOfDrawCalls;
    texture.gl.currentNumberOfDrawCalls = 0;
    texture.gl.vertexIndexBuffer = [];//new Array(texture.gl.vertexIndexBuffer.length);

    if (texture.gl.totalNumberOfDrawCalls > 10000) {
        texture.gl.totalNumberOfDrawCalls = 0;
        texture.gl.previousTotalNumberOfDrawCalls = 0;
        texture.gl.currentNumberOfDrawCalls = 0;
        texture.gl.vertexPositionBuffer = [];
        texture.gl.textureCoordinationBuffer = [];
        texture.gl.vertexIndexBuffer = [];

        texture.gl.objects.forEach(function(object) {
            object.gl = undefined;
        });
    }
    return texture;
};
