var shaderProgram;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function tick(context) {
    requestAnimationFrame(context.tick.bind(context));
    drawScene(context);
}

function context2d(canvas) {
    var gl;

    try {
        gl = canvas.getContext("webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {

    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }

    this.gl = gl;

    this.initShaders(this.gl);

    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);

    this.MAX_COMBINED_TEXTURE_IMAGE_UNITS = gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS;
    this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS = -1;

    this.gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

    //Already declare variables
    this.variables = {
        drawImage: {
            x: null,
            img: null,
            sx: null,
            sy: null,
            swidth: null,
            sheight: null,
            x: null,
            y: null,
            width: null,
            height: null
        }
    }

    this.tick(this);
};

context2d.prototype.drawImage = function () {
    var params = this.variables.drawImage;

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
        params.img.buffer = this.bufferImage(params.img);
    }

    // If the texture is not activate anymore, activate it.
    if (!params.img.buffer.texture.glActiveTextureReference) {
        params.img.buffer.texture.glActiveTextureReference = this.activateTexture(params.img.buffer.texture);
    }

    params.img.buffer.position.vertices = [
    50, 50, 1.0,
     0, 50, 1.0,
    50,  0, 1.0,
     0,  0, 1.0
    ];

    params.img.buffer.textureCoords = [
        50, 50,
         0, 50,
         0, 0,
        50, 0
    ];

    params.img.buffer.cubeVertexIndices = [
        0, 1, 2,
        0, 2, 3
    ];

    // If the texturesize has changed, assign it again.
    if (params.img.buffer.texture.image.width !== this.resolutionSize) {
        gl.uniform2f(this.shaderProgram.textureresolutionLocation,
            params.img.buffer.texture.image.width,
            params.img.buffer.texture.image.height);

        this.resolutionSize = params.img.buffer.texture.image.width;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, params.img.buffer.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(params.img.buffer.position.vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.shaderProgram.vertexPositionAttribute, params.img.buffer.position.itemSize, gl.FLOAT, false, 0, 0);

    // look up where the vertex data needs to go.
    var positionLocation = gl.getAttribLocation(this.shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.img.buffer.vertexIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(params.img.buffer.cubeVertexIndices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, params.img.buffer.vertexTextureCoord);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(params.img.buffer.textureCoords), gl.STREAM_DRAW);
    gl.vertexAttribPointer(this.shaderProgram.textureCoordAttribute, params.img.buffer.vertexTextureCoord.itemSize, gl.FLOAT, false, 0, 0);


    //gl.activeTexture(gl[params.img.buffer.texture.glActiveTextureReference]);

    //gl.uniform1i(this.shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.img.buffer.vertexIndex);
    this.setMatrixUniforms(gl);
    gl.drawElements(gl.TRIANGLES, params.img.buffer.vertexIndex.numItems, gl.UNSIGNED_SHORT, 0);
};

context2d.prototype.bufferImage = function (img) {
    var gl = this.gl;

    if (img.buffer) {
        return;
    }

    var n2size = Math.pow(2, Math.ceil(Math.log(Math.max(img.width, img.height)) / Math.log(2)));
    var n2img;

    n2canvas = document.createElement('canvas');
    n2canvas.width = n2canvas.height = n2size;
    n2canvas.context = n2canvas.getContext('2d');
    n2canvas.context.drawImage(img, 0, 0);

    var buffer = {};

    buffer.texture = this.gl.createTexture();
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
};
context2d.prototype.activateTexture = function (texture) {
    var gl = this.gl;

    this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS += 1;
    if (this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS === this.MAX_COMBINED_TEXTURE_IMAGE_UNITS) {
        this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0;
    }

    var glActiveTextureReference = 'TEXTURE' + this.ACTIVE_MAX_COMBINED_TEXTURE_IMAGE_UNITS

    gl.activeTexture(gl[glActiveTextureReference]);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);

    return texture.glActiveTextureReference = glActiveTextureReference;
};


context2d.prototype.tick = function () {
    requestAnimationFrame(this.tick.bind(this));
    this.drawScene();
}
context2d.prototype.drawScene = function () {
    gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    mat4.identity(mvMatrix);

    for (var i = 0; i < 2; i++) {
        var img = common.resources.tilesets.get("block");
        this.drawImage(img, 0, 0, 50, 50, 0, 0, 50, 50);
        //img,sx,sy,swidth,sheight,x,y,width,height
    }
}

context2d.prototype.getShader = function (id) {
    var gl = this.gl;

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

context2d.prototype.initShaders = function () {
    var gl = this.gl;

    var fragmentShader = this.getShader("shader-fs"),
        vertexShader = this.getShader("shader-vs");

    var shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    // set the resolution
    shaderProgram.resolutionLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
    gl.uniform2f(shaderProgram.resolutionLocation, 500, 500);

    shaderProgram.textureresolutionLocation = gl.getUniformLocation(shaderProgram, "u_textureresolution");
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");

    this.shaderProgram = shaderProgram;
}

context2d.prototype.mvPushMatrix = function () {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}
context2d.prototype.mvPopMatrix = function () {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}
context2d.prototype.setMatrixUniforms = function () {
    var gl = this.gl;
    gl.uniformMatrix4fv(this.shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(this.shaderProgram.mvMatrixUniform, false, mvMatrix);
}