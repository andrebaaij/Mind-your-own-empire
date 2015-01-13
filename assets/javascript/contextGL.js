/* global contextGL:true, Float32Array, Uint16Array, document, common */

// REMARK: Only one canvas per page is supported!
// TODO: Implement scale



contextGL = {};

/**
 * Initialises a new webgl context for the defined canvas.
 * @param   {Object} canvas HTML canvas element for which the context should be defined.
 * @returns {Object} webgl context.
 */
contextGL.get = function(canvas) {
    var context = {};

    try {
        context = canvas.getContext("experimental-webgl");
        context.viewportWidth = canvas.width;
        context.viewportHeight = canvas.height;
        context.clearColor(1.0, 1.0, 1.0, 1.0);
        context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
    } catch (e) {

    }
    if (!context) {
        alert("Could not initialise WebGL, sorry :-(");
    }

    context.vertexPositionBuffer = [];
    context.textureCoordinationBuffer = [];
    context.vertexIndexBuffer = [];
    context.textures = [];

    context = contextGL.initialiseShaders(context);
    context = contextGL.initialiseBuffers(context);

    context.activeTexture(context.TEXTURE0);
    context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, context.buffers.cubeVertexIndexBuffer);
    contextGL.dimensions(context, canvas.width, canvas.height);
    contextGL.translate(context, 0, 0);

    return context;
};

/**
 * TODO: scaling/zooming.
 * @param   {Object} context Webgl context on which the scale should be applied.
 * @param   {Number} scale   Scale factor.
 * @returns {Object} Webgl context.
 */
contextGL.scale = function(context, scale) {
    return context;
};

/**
 * This function applies a translation on the x, y coordinates of the camera.
 * @param   {Object} context Webgl context on which the translate should be applied.
 * @param   {Number} x       Number of pixels to move the camera on the x axis.
 * @param   {Number} y       Number of pixels to move the camera on the y axis.
 * @returns {Object} Webgl context.
 */
contextGL.translate = function(context, x, y) {
    context.uniform2f(context.shaderProgram.translate, x, y);

    return context;
};

/**
 * Set the resolution for the supplied context
 * @param   {Object} context Webgl context on which the dimensions should be applied.
 * @param   {Number} width   Width dimension in pixels.
 * @param   {Number} height  Height dimension in pixels.
 * @returns {Object} Webgl context.
 */
contextGL.dimensions = function(context, width, height) {
    context.viewport(0, 0, width, height);
    context.shaderProgram.resolutionLocation = context.getUniformLocation(context.shaderProgram, "u_resolution");
    context.uniform2f(context.shaderProgram.resolutionLocation, width, height);

    return context;
};

/**
 * Initialise the shader program.
 * @param   {Object} context Webgl context for which the shaders should be initialised
 * @returns {Object} Webgl context
 */
contextGL.initialiseShaders = function(context) {
    var fragmentShader = contextGL.getShader(context, "shader-fs");
    var vertexShader = contextGL.getShader(context, "shader-vs");

    context.shaderProgram = context.createProgram();
    context.attachShader(context.shaderProgram, vertexShader);
    context.attachShader(context.shaderProgram, fragmentShader);
    context.linkProgram(context.shaderProgram);

    if (!context.getProgramParameter(context.shaderProgram, context.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    context.useProgram(context.shaderProgram);

    context.shaderProgram.vertexPositionAttribute = context.getAttribLocation(context.shaderProgram, "a_position");
    context.enableVertexAttribArray(context.shaderProgram.vertexPositionAttribute);

    context.shaderProgram.textureCoordAttribute = context.getAttribLocation(context.shaderProgram, "aTextureCoord");
    context.enableVertexAttribArray(context.shaderProgram.textureCoordAttribute);

    // set the resolution
    context.shaderProgram.textureresolution = context.getUniformLocation(context.shaderProgram, "u_textureresolution");
    context.shaderProgram.translate = context.getUniformLocation(context.shaderProgram, "u_translate");
    context.shaderProgram.color = context.getUniformLocation(context.shaderProgram, "u_color");

    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA);
    context.enable(context.BLEND);

    context.shaderProgram.samplerUniform = context.getUniformLocation(context.shaderProgram, "uSampler");

    return context;
};

/**
 * Initialise a texture so that it can be drawn on the specified context
 * @param   {Object} context [[Description]]
 * @param   {Object} texture Tileset from [common]
 * @returns {Object} texture prepared for drawing on the context.
 */
contextGL.initialiseTexture = function(context, texture) {
    var n2size = Math.pow(2, Math.ceil(Math.log(Math.max(texture.width, texture.height)) / Math.log(2)));

    var n2canvas = document.createElement('canvas');
    n2canvas.width = n2canvas.height = n2size;
    n2canvas.context = n2canvas.getContext('2d');
    n2canvas.context.drawImage(texture, 0, 0);

    texture.gl = {};

    texture.gl.texture = context.createTexture();
    texture.gl.texture.image = n2canvas;

    context.bindTexture(context.TEXTURE_2D, texture.gl.texture);
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, true);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
    context.bindTexture(context.TEXTURE_2D, null);

    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, texture.gl.texture);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, texture.gl.texture.image);

    texture.colors = {};

    return texture;
};

contextGL.initialiseTextureColor = function(context, texture, color) {
    var hex = common.rgba2hex(color.r, color.g, color.b, color.a);

    texture.colors[hex] = {
        gl : {
            texture : texture.gl.texture,
            totalNumberOfDrawCalls : 0,
            previousTotalNumberOfDrawCalls : 0,
            currentNumberOfDrawCalls : 0,
            vertexPositionBuffer : [],
            textureCoordinationBuffer : [],
            vertexIndexBuffer : [],
            objects : [],
            cubeVertexPositionBuffer : context.createBuffer(),
            cubeVertexTextureCoordBuffer : context.createBuffer()
        },
        color : color
    };

    return texture;
};

/**
 * Initialise global Webgl context buffers
 * @param   {Object} context Webgl for which the buffers will be initialised.
 * @returns {Object} Webgl context
 */
contextGL.initialiseBuffers = function(context) {
    context.buffers = {
        cubeVertexIndexBuffer : context.createBuffer()
    };

    return context;
};

/**
 * Read and initialises the shader from the current DOM
 * @param   {Object} context  Webgl context to which the shader should be applied.
 * @param   {String} shaderId Id of the shader script which wil will be loaded from the DOM
 * @returns {Object} Webgl context
 */
contextGL.getShader = function(context, shaderId) {
    var scriptElement = document.getElementById(shaderId);
    if (!scriptElement) {
        return null;
    }

    var definition = "";
    var k = scriptElement.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            definition += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (scriptElement.type == "x-shader/x-fragment") {
        shader = context.createShader(context.FRAGMENT_SHADER);
    } else if (scriptElement.type == "x-shader/x-vertex") {
        shader = context.createShader(context.VERTEX_SHADER);
    } else {
        return null;
    }

    context.shaderSource(shader, definition);
    context.compileShader(shader);

    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        alert(context.getShaderInfoLog(shader));
        return null;
    }

    return shader;
};

/**
 * Draw a tile on the supplied Webgl context
 * @param {Object} context   Webgl context
 * @param {Object} texture   Tileset from [common]
 * @param {Number} x         x position in pixels where to draw the texture in the scene
 * @param {Number} y         y position in pixels where to draw the texture in the scene
 * @param {Number} tileIndex Which tile to draw?
 * @param {Object} object    What is the object being drawn, it is used to keep track of draw calls for efficiency
 */
contextGL.drawTile = function (context, texture, x, y, tileIndex, object, color) {

    //default color to regulare if it is undefined
    if(typeof color === 'undefined') {
        color = common.colors.original;
    }

    // If the texture is not loaded yet, we don't have anything to draw, so let's quit the execution of this function.
    if (!texture.isLoaded) {
        return;
    }

    // If the texture is not initialised yet, buffer it now.
    if (!texture.gl) {
        texture = contextGL.initialiseTexture(context, texture);
    }

    var hex = common.rgba2hex(color.r, color.g, color.b, color.a);

    if (!texture.colors[hex]) {
        texture = contextGL.initialiseTextureColor(context, texture, color);
    }

    // For this scene, this is the nth drawcall:
    var i = texture.colors[hex].gl.totalNumberOfDrawCalls;

    // Add this texture to the scene if this is its first drawcall.
    if (typeof texture.colors[hex].gl.currentNumberOfDrawCalls === 'undefined' || texture.colors[hex].gl.currentNumberOfDrawCalls === 0) {
        context.textures.push(texture);
    }

    if(typeof object.gl === 'undefined' || object.gl.tile !== tileIndex) {
        texture.colors[hex].gl.objects.push(object);

        object.gl = {
            index : i,
            tile : tileIndex
        };

        var buffers = {
            vertex : texture.colors[hex].gl.vertexPositionBuffer,
            texture : texture.colors[hex].gl.textureCoordinationBuffer,
            vertexIndex : texture.colors[hex].gl.vertexIndexBuffer
        };

        var tile = texture.tile[tileIndex];
        this.bufferDraw(buffers, i, x, y, texture, tile);

        texture.colors[hex].gl.totalNumberOfDrawCalls += 1;
    }

    i = texture.colors[hex].gl.currentNumberOfDrawCalls;

    //Vertices index
    var i4 = object.gl.index*4, //object.gl.index
        i6 = i*6;

    texture.colors[hex].gl.vertexIndexBuffer[i6] = i4;
    texture.colors[hex].gl.vertexIndexBuffer[i6+1] = i4+1;
    texture.colors[hex].gl.vertexIndexBuffer[i6+2] = i4+2;

    texture.colors[hex].gl.vertexIndexBuffer[i6+3] = i4;
    texture.colors[hex].gl.vertexIndexBuffer[i6+4] = i4+2;
    texture.colors[hex].gl.vertexIndexBuffer[i6+5] = i4+3;

    texture.colors[hex].gl.currentNumberOfDrawCalls += 1;
};

/**
 * Draw an object on the supplied Webgl context
 * @param {Object} context   Webgl context
 * @param {Object} texture   Tileset from [common]
 * @param {Number} x         x position in pixels where to draw the texture in the scene
 * @param {Number} y         y position in pixels where to draw the texture in the scene
 * @param {Number} tileIndex Which tile to draw?
 * @param {Object} object    What is the object being drawn, it is used to keep track of draw calls for efficiency
 */
contextGL.drawObject = function (context, texture, x, y, tileIndex, object, color) {
    //default color to regulare if it is undefined
    if(typeof color === 'undefined') {
        color = common.colors.original;
    }

    // If the texture is not loaded yet, we don't have anything to draw, so let's quit the execution of this function.
    if (!texture.isLoaded) {
        return;
    }

    // If the texture is not initialised yet, buffer it now.
    if (!texture.gl) {
        contextGL.initialiseTexture(context, texture);
    }

    var hex = common.rgba2hex(color.r, color.g, color.b, color.a);

    if (!texture.colors[hex]) {
        texture = contextGL.initialiseTextureColor(context, texture, color);
    }

    // For this scene, this is the nth drawcall:
    var i = texture.colors[hex].gl.totalNumberOfDrawCalls;

    // Add this texture to the scene if this is its first drawcall.
    if (typeof texture.colors[hex].gl.currentNumberOfDrawCalls === 'undefined' || texture.colors[hex].gl.currentNumberOfDrawCalls === 0) {
        context.textures.push(texture);
        texture.colors[hex].gl.previousTotalNumberOfDrawCalls = 0;
        texture.colors[hex].gl.totalNumberOfDrawCalls = 0;
        texture.colors[hex].gl.objects = [];
    }

    texture.colors[hex].gl.objects.push(object);

    object.gl = {
        index : i
    };

    var buffers = {
        vertex : texture.colors[hex].gl.vertexPositionBuffer,
        texture : texture.colors[hex].gl.textureCoordinationBuffer,
        vertexIndex : texture.colors[hex].gl.vertexIndexBuffer
    };

    var tile = texture.tile[tileIndex];
    this.bufferDraw(buffers, i, x, y, texture, tile);

    texture.colors[hex].gl.totalNumberOfDrawCalls += 1;

    i = texture.colors[hex].gl.currentNumberOfDrawCalls;

    //Vertices index
    var i4 = object.gl.index*4, //object.gl.index
        i6 = i*6;

    texture.colors[hex].gl.vertexIndexBuffer[i6] = i4;
    texture.colors[hex].gl.vertexIndexBuffer[i6+1] = i4+1;
    texture.colors[hex].gl.vertexIndexBuffer[i6+2] = i4+2;

    texture.colors[hex].gl.vertexIndexBuffer[i6+3] = i4;
    texture.colors[hex].gl.vertexIndexBuffer[i6+4] = i4+2;
    texture.colors[hex].gl.vertexIndexBuffer[i6+5] = i4+3;

    texture.colors[hex].gl.currentNumberOfDrawCalls += 1;
};

/**
 * Buffer a draw call;
 * @param   {Object} buffers object containing 2 buffers; vertex and texture
 * @param   {Number} i       index for the buffer, current draw call number.
 * @param   {Number} x       x position in pixels where to draw the texture in the scene
 * @param   {Number} y       y position in pixels where to draw the texture in the scene
 * @param   {Object} texture Tileset from [common]
 * @param   {Object} tile    tile containing x, y positions where it is located on the texture
 * @returns {Object} Containing the altered buffers.
 */
contextGL.bufferDraw = function (buffers, i, x, y, texture, tile) {
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

/**
 * Draw the scene stored in the buffers/textures
 * @param {Object} context Webgl context
 */
contextGL.drawScene = function(context) {
    contextGL.drawTextures(context, context.textures);
};

/**
 * Draw all supplied textures on the Webgl context
 * @param {Object} context  Webgl context
 * @param {Array}  textures List of textures to be drawn on the context
 */
contextGL.drawTextures = function(context, textures) {
    textures.forEach(function(texture) {
        for(var hex in texture.colors){
            var color = texture.colors[hex];
            contextGL.drawTexture(context, texture, color.color, color.gl);
        }
    });
};

/**
 * Draw the texture on the Webgl context
 * @param {Object} context Webgl context
 * @param {Object} texture Texture to be drawn on the context
 */
contextGL.drawTexture = function(context, texture, color, gl) {
    if (gl.currentNumberOfDrawCalls > 0) {
        context.bindTexture(context.TEXTURE_2D, gl.texture);
        context.uniform2f(context.shaderProgram.textureresolution, gl.texture.image.width, gl.texture.image.height);
        context.uniform4f(context.shaderProgram.color, color.r/255, color.g/255, color.b/255, color.a);

        if (gl.totalNumberOfDrawCalls > gl.previousTotalNumberOfDrawCalls) {
            context.bindBuffer(context.ARRAY_BUFFER, gl.cubeVertexPositionBuffer);
            context.bufferData(context.ARRAY_BUFFER, new Float32Array(gl.vertexPositionBuffer), context.STATIC_DRAW);

            context.bindBuffer(context.ARRAY_BUFFER, gl.cubeVertexTextureCoordBuffer);
            context.bufferData(context.ARRAY_BUFFER, new Float32Array(gl.textureCoordinationBuffer), context.STATIC_DRAW);
        }

        context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, context.buffers.cubeVertexIndexBuffer);
        context.bufferData(context.ELEMENT_ARRAY_BUFFER, new Uint16Array(gl.vertexIndexBuffer), context.STATIC_DRAW);

        context.bindBuffer(context.ARRAY_BUFFER, gl.cubeVertexPositionBuffer);
        context.vertexAttribPointer(context.shaderProgram.vertexPositionAttribute, 3, context.FLOAT, false, 0, 0);

        context.bindBuffer(context.ARRAY_BUFFER, gl.cubeVertexTextureCoordBuffer);
        context.vertexAttribPointer(context.shaderProgram.textureCoordAttribute, 2, context.FLOAT, false, 0, 0);

        context.drawElements(context.TRIANGLES, (gl.currentNumberOfDrawCalls) * 6, context.UNSIGNED_SHORT, 0);
    }
};

/**
 * Clear all drawcalls for the current scene
 * @param {Object} context Webgl context
 */
contextGL.clearScene = function(context) {
    context.clearColor(1.0, 1.0, 1.0, 1.0);
    context.textures = contextGL.clearTextures(context.textures);
};

/**
 * Clear all calls for this scenes textures
 * @param   {Array} textures Which textures to clear
 * @returns {Array} empty textures array
 */
contextGL.clearTextures = function(textures) {
    textures.forEach(function(texture) {
        texture = contextGL.clearTexture(texture);
    });

    return [];
};

/**
 * Clear the texture of draw calls
 * @param   {Object} texture
 * @returns {Object} texture
 */
contextGL.clearTexture = function(texture) {
    for(var hex in texture.colors){
        var color = texture.colors[hex];
        color.gl.previousTotalNumberOfDrawCalls = color.gl.totalNumberOfDrawCalls;
        color.gl.currentNumberOfDrawCalls = 0;
        color.gl.vertexIndexBuffer = [];//new Array(texture.gl.vertexIndexBuffer.length);

        if (color.gl.totalNumberOfDrawCalls > 10000) {
            color.gl.totalNumberOfDrawCalls = 0;
            color.gl.previousTotalNumberOfDrawCalls = 0;
            color.gl.currentNumberOfDrawCalls = 0;
            color.gl.vertexPositionBuffer = [];
            color.gl.textureCoordinationBuffer = [];
            color.gl.vertexIndexBuffer = [];

            color.gl.objects.forEach(function(object) {
                object.gl = undefined;
            });

            color.gl.objects = [];
        }
    }

    return texture;
};
