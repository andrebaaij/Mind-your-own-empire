var neheTexture;
var shaderProgram;
var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;


function context2d(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
    
    this.initShaders();
    this.initBuffers();
    var img = common.resources.tilesets.get("block");
    this.initTexture(img);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    this.tick();
};

context2d.prototype.initShaders = function() {
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
    gl.uniform2f(shaderProgram.resolutionLocation, 500, 500);
    
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}



context2d.prototype.initTexture = function(img) {
//    neheTexture = gl.createTexture();
//    neheTexture.image = new Image();
//    neheTexture.image.onload = function () {
//        gl.activeTexture(gl.TEXTURE0);
//        gl.bindTexture(gl.TEXTURE_2D, neheTexture);
//       // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, neheTexture.image);
//        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
//        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
//        //gl.bindTexture(gl.TEXTURE_2D, null);
//        
//    }.bind(this);
//
//    neheTexture.image.src = "./assets/nehe.gif";
    
//    if (img.buffer) {
//        return;
//    }

    var n2size = Math.pow(2, Math.ceil(Math.log(Math.max(img.width, img.height)) / Math.log(2)));
    var n2img;

    n2canvas = document.createElement('canvas');
    n2canvas.width = n2canvas.height = n2size;
    n2canvas.context = n2canvas.getContext('2d');
    n2canvas.context.drawImage(img, 0, 0);

    var buffer = {};

    neheTexture = buffer.texture = gl.createTexture();
    buffer.texture.image = n2canvas;

    gl.bindTexture(gl.TEXTURE_2D, buffer.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    buffer.position = gl.createBuffer(); // imagePositionBuffer;

    //    buffer.position.height = 500;
    //    buffer.position.width = 500
    //    buffer.position.itemSize = 3;
    //    buffer.position.numItems = 500*500*3;
    //    buffer.position.vertices = [];

    //    for(var i = 0; i < buffer.position.numItems; i++) {
    //        // push x
    //        buffer.position.vertices.push(i%buffer.position.width)
    //        
    //        // push y
    //        buffer.position.vertices.push(Math.floor(i/buffer.position.width))
    //        
    //        // push z
    //        buffer.position.vertices.push(0);
    //    }
    //    
    //    gl.bindBuffer(gl.ARRAY_BUFFER, buffer.position);
    //    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(buffer.position.vertices), gl.STATIC_DRAW);
    //    gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, buffer.position.itemSize, gl.FLOAT, false, 0, 0);



    buffer.vertexTextureCoord = gl.createBuffer(); //imageVertexTextureCoordBuffer;
    buffer.vertexTextureCoord.itemSize = 2;
    buffer.vertexTextureCoord.numItems = 4;

    buffer.vertexIndex = gl.createBuffer();
    buffer.vertexIndex.itemSize = 1;
    buffer.vertexIndex.numItems = 6;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, buffer.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buffer.texture.image);

    return img.buffer = buffer;

//    this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS += 1;
//    if (this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS === this.MAX_COMBINED_TEXTURE_IMAGE_UNITS) {
//        this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0;
//    }
//
//    var glActiveTextureReference = 'TEXTURE' + this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS
//
//    gl.activeTexture(gl[glActiveTextureReference]);
//    gl.bindTexture(gl.TEXTURE_2D, texture);
//    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
//
//    return texture.glActiveTextureReference = glActiveTextureReference;
    
    
    
    
    
}

context2d.prototype.initBuffers = function() {
    cubeVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    var x = 50,
        y = 150,
        width = 1250,
        height = 250;
    
    
    vertices = [
        x,y,1,
        x+width,y,1,
        x+width,y+height,1,
        x,y+height,1
    ]
    
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeVertexPositionBuffer.itemSize = 3;
    cubeVertexPositionBuffer.numItems = 4;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    var textureCoords = [
      // Front face
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 4;

    cubeVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [
        0, 1, 2,
        0, 2, 3
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 6;
}

context2d.prototype.tick = function() {
    requestAnimationFrame(this.tick.bind(this));
    this.drawScene();
}

context2d.prototype.drawScene = function() {
    var img = common.resources.tilesets.get("block");
    this.drawImage(img);
    this.initTexture(img);
    
    
    
    
    
    
    
    //gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, neheTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
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
    var params = {};

    // Default settings
    params.img = arguments[0];
    // If the image is not loaded yet, we can stop this.
    if (!params.img || !params.img.complete) {
        return;
    }

//    params.width = params.img.width;
//    params.height = params.img.height;
//    params.sx = 0;
//    params.sy = 0;
//    params.swidth = params.img.width;
//    params.sheight = params.img.height;
//
//    if (arguments.length === 3) {
//        // context.drawImage(img,x,y);
//        params.x = arguments[1];
//        params.y = arguments[2];
//    } else if (arguments.length === 5) {
//        // context.drawImage(img,x,y,width,height);
//        params.x = arguments[1];
//        params.y = arguments[2];
//        params.width = arguments[3];
//        params.height = arguments[4];
//    } else if (arguments.length === 9) {
//        // context.drawImage(img,sx,sy,swidth,sheight,x,y,width,height);
//        params.sx = arguments[1];
//        params.sy = arguments[2];
//        params.swidth = arguments[3];
//        params.sheight = arguments[4];
//        params.x = arguments[5];
//        params.y = arguments[6];
//        params.width = arguments[7];
//        params.height = arguments[8];
//    } else {
//        // incorrect number of arguments.
//        return;
//    }
//
    // If the image is not buffered yet, buffer it now.
    if (!params.img.buffer) {
        params.img.buffer = this.bufferImage(params.img);
    }
//
//    // If the texture is not activate anymore, activate it.
//    if (!params.img.buffer.texture.glActiveTextureReference) {
//        params.img.buffer.texture.glActiveTextureReference = this.activateTexture(params.img.buffer.texture);
//    }
//
//    params.img.buffer.position.vertices = [
//    50, 50, 1.0,
//     0, 50, 1.0,
//    50,  0, 1.0,
//     0,  0, 1.0
//    ];
//
//    params.img.buffer.textureCoords = [
//        50, 50,
//         0, 50,
//         0, 0,
//        50, 0
//    ];
//
//    params.img.buffer.cubeVertexIndices = [
//        0, 1, 2,
//        0, 2, 3
//    ];
//
//    // If the texturesize has changed, assign it again.
//    if (params.img.buffer.texture.image.width !== this.resolutionSize) {
//        gl.uniform2f(this.shaderProgram.textureresolutionLocation,
//            params.img.buffer.texture.image.width,
//            params.img.buffer.texture.image.height);
//
//        this.resolutionSize = params.img.buffer.texture.image.width;
//    }
//
//    gl.bindBuffer(gl.ARRAY_BUFFER, params.img.buffer.position);
//    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(params.img.buffer.position.vertices), gl.STATIC_DRAW);
//    gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, params.img.buffer.position.itemSize, gl.FLOAT, false, 0, 0);
//
//    // look up where the vertex data needs to go.
//    var positionLocation = gl.getAttribLocation(this.shaderProgram, "a_position");
//    gl.enableVertexAttribArray(positionLocation);
//    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
//
//    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.img.buffer.vertexIndex);
//    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(params.img.buffer.cubeVertexIndices), gl.STATIC_DRAW);
//
//    gl.bindBuffer(gl.ARRAY_BUFFER, params.img.buffer.vertexTextureCoord);
//    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(params.img.buffer.textureCoords), gl.STREAM_DRAW);
//    gl.vertexAttribPointer(this.shaderProgram.textureCoordAttribute, params.img.buffer.vertexTextureCoord.itemSize, gl.FLOAT, false, 0, 0);
//
//
//    //gl.activeTexture(gl[params.img.buffer.texture.glActiveTextureReference]);
//
//    //gl.uniform1i(this.shaderProgram.samplerUniform, 0);
//
//    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.img.buffer.vertexIndex);
//    this.setMatrixUniforms(gl);
//    gl.drawElements(gl.TRIANGLES, params.img.buffer.vertexIndex.numItems, gl.UNSIGNED_SHORT, 0);
};