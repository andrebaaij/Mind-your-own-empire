

var gl;
var shaderProgram;
var neheTexture;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();
var imagePositionBuffer;
var imageVertexTextureCoordBuffer;
var imageVertexIndexBuffer;


function tick(context) {
    requestAnimationFrame(context.tick.bind(context));
    drawScene(context);
}

function context2d(canvas) {
    this.gl = this.initGL(canvas);    
    
    this.initShaders(this.gl);
    this.initBuffers(this.gl);
    this.initTexture(this.gl);

    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.enable(this.gl.DEPTH_TEST);
    
    this.tick(this);
};

context2d.prototype.drawImage = function(img, x, y) {
    var gl = this.gl
    
    var texture = this.gl.createTexture();
    //neheTexture.image = img;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, imagePositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, imageVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, imageVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, neheTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, imageVertexIndexBuffer);
    this.setMatrixUniforms(gl);
    gl.drawElements(gl.TRIANGLES, imageVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
};
    
context2d.prototype.tick = function () {
    requestAnimationFrame(this.tick.bind(this));
    this.drawScene();
}
context2d.prototype.drawScene = function () {
    gl = this.gl
    
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

    mat4.identity(mvMatrix);

    mat4.translate(mvMatrix, [0.0, 0.0, -5.0]);

    this.drawImage(neheTexture.image, 0, 0);
}
context2d.prototype.initBuffers = function () {
    var gl = this.gl;
    
    imagePositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, imagePositionBuffer);
    vertices = [
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    imagePositionBuffer.itemSize = 3;
    imagePositionBuffer.numItems = 4;

    imageVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, imageVertexTextureCoordBuffer);
    var textureCoords = [
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    imageVertexTextureCoordBuffer.itemSize = 2;
    imageVertexTextureCoordBuffer.numItems = 4;

    imageVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, imageVertexIndexBuffer);
    var cubeVertexIndices = [
      0,1,2,    0,2,3
    ];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    imageVertexIndexBuffer.itemSize = 1;
    imageVertexIndexBuffer.numItems = 6;
}
context2d.prototype.initGL = function (canvas) {
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
    
    return gl;
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
context2d.prototype.handleLoadedTexture = function (texture) {
    var gl = this.gl;
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
}
context2d.prototype.initTexture = function (image) {
    var _self = this;
    var gl = this.gl;
    
    neheTexture = gl.createTexture();
    neheTexture.image = new Image();
    neheTexture.image.onload = function () {
        _self.handleLoadedTexture(neheTexture, gl)
    }

    neheTexture.image.src = "./assets/nehe.gif";
}

context2d.prototype.initShaders = function() {
    var gl = this.gl;
    
    var fragmentShader = this.getShader("shader-fs");
    var vertexShader = this.getShader("shader-vs");

    shaderProgram = gl.createProgram();

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    //shaderProgram.resolutionLocation = gl.getUniformLocation(shaderProgram, "u_resolution");
    //this.gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}
context2d.prototype.mvPushMatrix = function() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}
context2d.prototype.mvPopMatrix = function() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}
context2d.prototype.setMatrixUniforms = function() {
    var gl = this.gl;
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}