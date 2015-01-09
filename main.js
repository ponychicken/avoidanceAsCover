/* jshint node:false, browser:true, undef:true, unused:true, esnext: true */
/* global PIXI, Vector, console  */

"use strict";

var size = 5;

var width = Math.floor(window.innerWidth / size);
var height = Math.floor(window.innerHeight / size);

var mousePointer = {};

var grid = [],
	squares = [];

var stage, renderer;

var borderPoint = {
	isWall: true,
	outside: true
};

var outsidePoint = {
	outside: true
};

var amountOfSquares = 0;

var maxSpeed = 5;

var log = console.log.bind(console);
		log = function () {};

var centerPoint = new Vector(width * size / 2, height * size / 2);

// Frame rate limiting
var fps = 20;
var now;
var then = Date.now();
var interval = 1000/fps;
var delta;

function Square(x, y) {
	this.pos = new Vector(x, y);
	this.bigPos = this.pos * size;
	this.velocity = new Vector(0, 0);

	var shape = createActor(this.bigPos);

	this.screenElement = shape;
	this.debugElement = {};

	squares.push(this);
}


function getGridSection(x, y) {
	//
	if (x > (centerPoint.x - 2) && x < (centerPoint.x + 2) && y > (centerPoint.y - 2) && y < (centerPoint.y + 2)) {
		return borderPoint;
	}

	// There an invisible border around the canvas
	if (x < -1 || x > width + 1 || y < -1 || y > height + 1) {
		return borderPoint;
	}
	// There an invisible border around the canvas
	if (x < 0 || x >= width || y < 0 || y >= height) {
		return outsidePoint;
	}
	var index = y * width + x;
	return grid[index] || {};
}


function getForceOfSurrounding(x, y) {
	var a = 2;
	var count = 0;
	var force = new Vector(0, 0);
	var centerPoint = new Vector(x, y);

	// Loop through a 5x5 grid around the selected point
	for (var i = (x - a); i < (x + a + 1); i++) {
		for (var j = (y - a); j < (y + a + 1); j++) {

			var grid = getGridSection(i, j);


			// Add to force if occupied:
			if (grid.square || grid.isWall) {
				var point = new Vector(i, j);
				var vectorFromCenter = centerPoint.subtract(point);
				count++;
				force = force.add(vectorFromCenter);
			}
		}
	}
	// Scale it a bit
	// return force.divide(Math.pow(count, 0.5) + 3);
	return force.divide(Math.pow(count, 1 / 2.4));
}

function calculateVelocity(square) {
	var force = square.force;
	// Slow down
	square.velocity = square.velocity.multiply(0.3);

	// Add new acceleration
	square.velocity = square.velocity.add(force);

	var length = square.velocity.length();

	if (length < 0.05) {
		square.velocity = square.velocity.multiply(0);
		return;
	}
	
	// Max speed
	if (length > maxSpeed) square.velocity = square.velocity.multiply(maxSpeed / length);

}

function applyMove(oldLoc, newLoc, square) {
	newLoc.square = oldLoc.square;
	oldLoc.square = false;
	square.curIndex = newLoc.index;
	square.curGrid = newLoc;

	updateGridElement(newLoc);
	updateGridElement(oldLoc);
}

function moveSquare(square, recalculateForceNow) {
	var oldLoc = square.curGrid;
	var x = oldLoc.x;
	var y = oldLoc.y;
	
	// Calculate the new force only every second step
	// This allows us to slow down the movement without changing the algorithm
	if (recalculateForceNow) {
		square.force = getForceOfSurrounding(x, y);
		
		if (square.force.isNullVector()) return;
		
		calculateVelocity(square);
	}
	
	if (square.force.isNullVector()) return;


	// Apply only half velocity
	var newLoc = getAffectedGridElement(square.pos, square.velocity.divide(2));
	square.pos = square.pos.add(square.velocity.divide(2));

	if (!newLoc.square && !newLoc.isWall) {
		applyMove(oldLoc, newLoc, square);
		square.screenElement.x = square.pos.x * size;
		square.screenElement.y = square.pos.y * size;
	}
}



function getAffectedGridElement(p, f) {
	var dest = p.add(f);
	dest = dest.round();

	var gridElement = getGridSection(dest.x, dest.y);
	if (gridElement.isWall || gridElement.square) {
		// Try to half the force
		f = f.divide(2);
		dest = p.add(f);
		dest = dest.round();
		gridElement = getGridSection(dest.x, dest.y);
	}
	return gridElement;
}

function updateGridElement(gridElement) {
	var square = gridElement.square;
	if (square) {
		square.screenElement.x = gridElement.x * size;
		square.screenElement.y = gridElement.y * size;
		square.debugElement.x = square.pos.x * size;
		square.debugElement.y = square.pos.y * size;
	}
}


function mouseMove(e) {
	centerPoint = new Vector(e.global.x / size, e.global.y / size).round();
	mousePointer.x = e.global.x - 5;
	mousePointer.y = e.global.y - 5;
}

function cleanup () {
	grid = [];
	squares = [];
	stage.children.forEach(function (child) {
		stage.removeChild(child);
	});
}

function setupPixi() {

	
	// Setup Pixi
	stage = new PIXI.Stage(0x000, false);
	//stage.interactive = true;

	width = Math.floor(window.innerWidth / size);
	height = Math.floor(window.innerHeight / size);

	renderer = PIXI.autoDetectRenderer(width * size, height * size);

	document.body.appendChild(renderer.view);

	stage.mousemove = stage.touchmove = mouseMove;

	renderer.render(stage);
	requestAnimationFrame(draw);


	// First we fill the grid
	for (var i = 0; i < width; i++) {
		for (var j = 0; j < height; j++) {
			var index = j * width + i;
			grid[index] = {
				x: i,
				y: j,
				index: index
			};

			if (Math.random() < 0.064) {
				grid[index].square = new Square(i, j);
				grid[index].square.curIndex = index;
				grid[index].square.curGrid = grid[index];
			}

			updateGridElement(grid[index]);
		}
	}

	amountOfSquares = squares.length;

}

var recalculateForceNow = true;

// Standard draw loop
function draw() {
	requestAnimationFrame(draw);

	now = Date.now();
	delta = now - then;
	
	if (delta > interval) {
		then = now - (delta % interval);
		var l = amountOfSquares;
		while(l--) {
			moveSquare(squares[l], recalculateForceNow);
		}
		renderer.render(stage);
		recalculateForceNow = !recalculateForceNow;
	}

}


function createActor(point, fill) {
	var graphics = new PIXI.Graphics();
	graphics.beginFill(fill || 0xFFFFFF || Math.random() * 16777215, 1);
	graphics.drawRect(0, 0, 2, 2);

	var actor = new PIXI.Sprite(graphics.generateTexture());
	actor.interactive = true;
	actor.x = point.x;
	actor.y = point.y;
	return stage.addChild(actor);
}

var texture;

function generateTexture() {
	var graphics = new PIXI.Graphics();
	//graphics.beginFill(0xFF0000 || Math.random() * 16777215, 1);
	graphics.lineStyle(2, 0xFF0000, 2);
	graphics.drawCircle(0, 0, 10);
	texture = graphics.generateTexture();
}


// From underscore
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

generateTexture();
setupPixi();

window.addEventListener('resize', debounce(function () {
	cleanup();
	var canvas = renderer.view;
	canvas.parentElement.removeChild(canvas);
	setupPixi();
}, 250));
