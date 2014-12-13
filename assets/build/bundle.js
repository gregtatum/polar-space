(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./js/Main.js":[function(require,module,exports){
var LevelLoader = require('./LevelLoader');

$(function() {
	LevelLoader("titles");
	// LevelLoader("intro");
});
},{"./LevelLoader":"/Users/gregtatum/Dropbox/greg-sites/polar/js/LevelLoader.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js":[function(require,module,exports){
var EventDispatcher = require('../utils/EventDispatcher');

window.HIDtype = "keys";

var HID = function( poem ) {

	this.poem = poem;
	
	var states = {
		up: false,
		down: false,
		left: false,
		right: false,
		spacebar: false
	};
	
	this.keyCodes = {
		"k38" : "up",
		"k40" : "down",
		"k37" : "left",
		"k39" : "right",
		"k32" : "spacebar"
	};
	
	this.tilt = {
		x: 0,
		y: 0
	};
	this.pressed = _.clone(states);
	this.down = _.clone(states);
	this.up = _.clone(states);
	
	if( window.HIDtype === "keys" ) {
		this.setKeyHandlers();
	} else {
		this.setTiltHandlers();
	}
	
};

HID.prototype = {
	
	setKeyHandlers : function() {
		
		$(window).on( 'keydown.HID', this.keydown.bind(this) );
		$(window).on( 'keyup.HID', this.keyup.bind(this) );
	
		this.poem.on( "destroy", function() {
			$(window).off( 'keydown.HID' );
			$(window).off( 'keyup.HID' );
		});
		
	},
	
	setTiltHandlers : function() {


		$(window).on( 'deviceorientation.HID', this.handleTilt.bind(this) );
		// window.addEventListener('deviceorientation', this.handleTilt.bind(this), false);
		
		$("canvas").on( 'touchstart.HID', this.handleTouchStart.bind(this) );
		$("canvas").on( 'touchend.HID', this.handleTouchEnd.bind(this) );

		this.poem.on( "destroy", function() {
			$(window).off( 'deviceorientation.HID' );
			$("canvas").off( 'touchstart.HID' );
			$("canvas").off( 'touchend.HID' );
		});
		
	},
	
	type : function() {
		return window.HIDtype;
	},
	
	setKeys : function() {
		window.HIDtype = "keys";
	},
	
	setTilt : function() {
		window.HIDtype = "tilt";		
	},
	
	keydown : function( e ) {
		var code = this.keyCodes[ "k" + e.keyCode ];
		
		if(code) {
			this.down[code] = true;
			this.pressed[code] = true;
		}
	},
	
	keyup : function( e ) {
		var code = this.keyCodes[ "k" + e.keyCode ];
		
		if(code) {
			this.pressed[code] = false;
			this.up[code] = true;
		}
	},
	
	handleTilt : function(e) {
		
		var event, orientation, angle;
		
		event = e.originalEvent;
		orientation = window.orientation || screen.orientation;
		
		if(_.isObject( screen.orientation ) ) {
			angle = screen.orientation.angle;
		} else if ( _.isNumber( window.orientation ) ) {
			angle = window.orientation;
		} else {
			angle = 0;
		}
		
		if(angle === 0) {
			this.tilt = {
				x: event.gamma,
				y: event.beta * -1
			};
		} else if (angle > 0) {
			this.tilt = {
				x: event.beta,
				y: event.gamma
			};
		} else {
			this.tilt = {
				x: event.beta * -1,
				y: event.gamma * -1
			};
		}
		
	},
	
	handleTouchStart : function(e) {
		e.preventDefault();
		this.pressed.spacebar = true;
	},
	
	handleTouchEnd : function(e) {
		var touches = e.originalEvent.touches;
		this.pressed.spacebar = (touches.length !== 0);
		
	},
	
	update : function() {
		
		var falsify = function (value, key, list) {
			list[key] = false;
		};
		
		return function() {
			_.each( this.down, falsify );
			_.each( this.up, falsify );
		};
		
	}()
	
};

EventDispatcher.prototype.apply( HID.prototype );

module.exports = HID;

},{"../utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/LevelLoader.js":[function(require,module,exports){
var Poem = require('./Poem');
var levels = require('./levels');

var currentLevel = null;
var currentPoem = null;

window.LevelLoader = function( name ) {
	
	//Track this, but exclude first load
	if( currentLevel ) {
		_gaq.push(['_trackPageview', '/polar/'+name]);
	}
	
	if(currentPoem) currentPoem.destroy();
	
	currentLevel = levels[name];
	currentPoem = new Poem( currentLevel );
	window.poem = currentPoem;
	
};
	
module.exports = LevelLoader;
},{"./Poem":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js","./levels":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/index.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js":[function(require,module,exports){
var Coordinates = require('./utils/Coordinates');
var Camera = require('./components/Camera');
var Gun = require('./managers/Gun');
var Ship = require('./Ship');
var Stars = require('./components/Stars');
var AsteroidField = require('./managers/AsteroidField');
var Stats = require('./utils/Stats');
var EventDispatcher = require('./utils/EventDispatcher');
var JellyShip = require('./entities/JellyShip');
var EntityManager = require('./managers/EntityManager');
var ScoringAndWinning = require('./components/ScoringAndWinning');
var Clock = require('./utils/Clock');

var renderer;

var Poem = function( level ) {

	this.circumference = level.config.circumference || 750;
	this.height = level.config.height || 120;
	this.r = level.config.r || 240;
	this.circumferenceRatio = (2 * Math.PI) / this.circumference; //Map 2d X coordinates to polar coordinates
	this.ratio = window.devicePixelRatio >= 1 ? window.devicePixelRatio : 1;
	
	this.controls = undefined;
	this.div = document.getElementById( 'container' );
	this.scene = new THREE.Scene();
	this.requestedFrame = undefined;

	this.clock = new Clock();
	this.coordinates = new Coordinates( this );
	this.camera = new Camera( this, level.config );
	this.scene.fog = new THREE.Fog( 0x222222, this.camera.object.position.z / 2, this.camera.object.position.z * 2 );
	
	this.gun = new Gun( this );
	this.ship = new Ship( this );
	this.stars = new Stars( this, level.config.stars );
	this.scoringAndWinning = new ScoringAndWinning( this, level.config.scoringAndWinning );
	
	this.parseLevel( level );
	
	this.dispatch({
		type: 'levelParsed'
	});
	
	if(!renderer) {
		this.addRenderer();
	}
//	this.addStats();
	this.addEventListeners();
	
	this.loop();
	
};

module.exports = Poem;

Poem.prototype = {
	
	parseLevel : function( level ) {
		_.each( level.objects, function( value, key ) {
			if(_.isObject( value )) {
				this[ key ] = new value.object( this, value.properties );
			} else {
				this[ key ] = value;
			}
			
		}, this);
	},
	
	addRenderer : function() {
		renderer = new THREE.WebGLRenderer({
			alpha : true
		});
		renderer.setSize( window.innerWidth, window.innerHeight );
		this.div.appendChild( renderer.domElement );
	},
	
	addStats : function() {
		this.stats = new Stats();
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.top = '0px';
		$("#container").append( this.stats.domElement );
	},
		
	addEventListeners : function() {
		$(window).on('resize', this.resizeHandler.bind(this));
	},
	
	resizeHandler : function() {
		
		this.camera.resize();
		renderer.setSize( window.innerWidth, window.innerHeight );

	},
			
	loop : function() {

		this.requestedFrame = requestAnimationFrame( this.loop.bind(this) );
		this.update();

	},
			
	update : function() {
		
		// this.stats.update();
		
		this.dispatch({
			type: "update",
			dt: this.clock.getDelta(),
			time: this.clock.time
		});
		
		renderer.render( this.scene, this.camera.object );

	},
	
	destroy : function() {
		
		window.cancelAnimationFrame( this.requestedFrame );
		
		this.dispatch({
			type: "destroy"
		});
	}
};

EventDispatcher.prototype.apply( Poem.prototype );
},{"./Ship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js","./components/Camera":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Camera.js","./components/ScoringAndWinning":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/ScoringAndWinning.js","./components/Stars":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Stars.js","./entities/JellyShip":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js","./managers/AsteroidField":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js","./managers/EntityManager":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js","./managers/Gun":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/Gun.js","./utils/Clock":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Clock.js","./utils/Coordinates":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Coordinates.js","./utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js","./utils/Stats":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Stats.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js":[function(require,module,exports){
var HID = require('./components/Hid');
var Damage = require('./components/Damage');

var Ship = function( poem ) {
	
	this.poem = poem;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;
	this.hid = new HID( this.poem );
	this.color = 0x4A9DE7;
	this.linewidth = 2 * this.poem.ratio;
	this.radius = 3;
	
	this.position = new THREE.Vector2();
	
	this.dead = false;
	this.lives = 3;
	this.invulnerable = true;
	this.invulnerableLength = 3000;
	this.invulnerableTime = 0 + this.invulnerableLength;
	this.invulnerableflipFlop = false;
	this.invulnerableflipFlopLength = 100;
	this.invulnerableflipFlopTime = 0;
	
	this.speed = 0;
	
	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;
	
	this.thrustSpeed = 0.001;
	this.thrust = 0;
	
	this.bankSpeed = 0.06;
	this.bank = 0;
	this.maxSpeed = 500;

	this.addObject();
	this.damage = new Damage(this.poem, this);
	
	this.poem.on('update', this.update.bind(this) );
	
};

module.exports = Ship;

Ship.prototype = {
	
	createGeometry : function() {
		
		var geometry, verts, manhattanLength, center;
		
		geometry = new THREE.Geometry(),
		
		verts = [[50,36.9], [39.8,59.6], [47.1,53.9], [50,57.5], [53,53.9], [60.2,59.6], [50,36.9]];

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
			
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
			
		}, [0,0]);
		
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.vertices = _.map( verts, function( vec2 ) {
			var scale = 1 / 4;
			return new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
		});
		
		return geometry;
		
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.createGeometry();
				
		lineMaterial = new THREE.LineBasicMaterial({
			color: this.color,
			linewidth : this.linewidth
		});
		
		this.object = new THREE.Line(
			geometry,
			lineMaterial,
			THREE.LineStrip
		);
		this.object.position.z += this.poem.r;
		
		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
	},
	
	disable : function() {
		this.dead = true;
		this.object.visible = false;
	},
	
	kill : function( force ) {

		if( !force && !this.dead && !this.invulnerable ) {
			this.dead = true;
			this.object.visible = false;
			
			this.damage.explode();
			
			var lostPoints = Math.ceil( this.poem.scoringAndWinning.score / -2 );
			
			this.poem.scoringAndWinning.adjustScore(
				lostPoints,
				lostPoints + " points",
				{
					"font-size" : "2em",
					"color": "red"
				}
			);
		
			setTimeout(function() {
		
				this.dead = false;
				this.invulnerable = true;
				this.invulnerableTime = this.poem.clock.time + this.invulnerableLength;
				this.object.visible = true;
				this.reset();
		
			}.bind(this), 2000);
		}
	},
	
	reset : function() {
		this.position.x = 0;
		this.position.y = 0;
		this.speed = 0.2;
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},
	
	update : function( e ) {
		
		if( this.dead ) {
			
			
		} else {
			
			this.updateThrustAndBank( e );
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
			this.updateFiring( e );
			this.updateInvulnerability( e );
			
		}
		this.damage.update( e );
		this.hid.update( e );

	},
	
	updateInvulnerability : function( e ) {
		
		if( this.invulnerable ) {
			
			if( e.time < this.invulnerableTime ) {
				
				
				if( e.time > this.invulnerableflipFlopTime ) {

					this.invulnerableflipFlopTime = e.time + this.invulnerableflipFlopLength;
					this.invulnerableflipFlop = !this.invulnerableflipFlop;	
					this.object.visible = this.invulnerableflipFlop;
					
				}
					
			} else {
				
				this.object.visible = true;
				this.invulnerable = false;
			}
			
		}
		
	},
	
	updateThrustAndBank : function( e ) {
		
		var pressed, tilt, theta, thetaDiff;
		
		this.bank *= 0.9;
		this.thrust = 0;
		
		if( this.hid.type() === "keys" ) {
			
			pressed = this.hid.pressed;
		
			if( pressed.up ) {
				this.thrust += this.thrustSpeed * e.dt;
			}
		
			if( pressed.down ) {
				this.thrust -= this.thrustSpeed * e.dt;	
			}
		
			if( pressed.left ) {
				this.bank = this.bankSpeed;
			}
		
			if( pressed.right ) {
				this.bank = this.bankSpeed * -1;
			}
			
		} else {
			tilt = this.hid.tilt;
			
			var distance = Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y);
		
			this.thrust = Math.min( 0.0011, distance / 10000 );
			
			this.thrust *= e.dt;
			
			theta = Math.atan2( tilt.y, tilt.x );
			thetaDiff = (theta - this.object.rotation.z) % (2 * Math.PI);
			
			if( thetaDiff > Math.PI ) {
				thetaDiff -= 2 * Math.PI;
			} else if ( thetaDiff < -Math.PI ) {
				thetaDiff += 2 * Math.PI;
			}
			
			this.bank = thetaDiff * distance / 2500 * e.dt;
			
			
		}
	},
	
	updateEdgeAvoidance : function( e ) {
		
		var nearEdge, farEdge, position, normalizedEdgePosition, bankDirection, absPosition;
		
		farEdge = this.poem.height / 2;
		nearEdge = 4 / 5 * farEdge;
		position = this.object.position.y;
		absPosition = Math.abs( position );

		var rotation = this.object.rotation.z / Math.PI;

		this.object.rotation.z %= 2 * Math.PI;
		
		if( this.object.rotation.z < 0 ) {
			this.object.rotation.z += 2 * Math.PI;
		}
		
		if( Math.abs( position ) > nearEdge ) {
			
			var isPointingLeft = this.object.rotation.z >= Math.PI * 0.5 && this.object.rotation.z < Math.PI * 1.5;
			
			if( position > 0 ) {
				
				if( isPointingLeft ) {
					bankDirection = 1;
				} else {
					bankDirection = -1;
				}
			} else {
				if( isPointingLeft ) {
					bankDirection = -1;
				} else {
					bankDirection = 1;
				}
			}
			
			normalizedEdgePosition = (absPosition - nearEdge) / (farEdge - nearEdge);
			this.thrust += normalizedEdgePosition * this.edgeAvoidanceThrustSpeed;
			this.object.rotation.z += bankDirection * normalizedEdgePosition * this.edgeAvoidanceBankSpeed;
			
		}
		
	},
	
	updateFiring : function( e ) {
		if( this.hid.pressed.spacebar ) {
			this.poem.gun.fire( this.position.x, this.position.y, 2, this.object.rotation.z );
		}
	},
	
	updatePosition : function() {
		
		var movement = new THREE.Vector3();
		
		return function( e ) {
		
			var theta, x, y;
			
			this.object.rotation.z += this.bank;
			
			theta = this.object.rotation.z;
			
			this.speed *= 0.98;
			this.speed += this.thrust;
			this.speed = Math.min( this.maxSpeed, this.speed );
			this.speed = Math.max( 0, this.speed );
						
			this.position.x += this.speed * Math.cos( theta );
			this.position.y += this.speed * Math.sin( theta );
			
			this.object.position.y = this.position.y;
			
			//Polar coordinates
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
			
		};
		
	}()
	
	
};
},{"./components/Damage":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js","./components/Hid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Hid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Camera.js":[function(require,module,exports){
var Camera = function( poem, properties ) {
	
	this.poem = poem;
	
	this.polarObj = new THREE.Object3D();
	
	this.speed = 0.032;
	
	this.object = new THREE.PerspectiveCamera(
		50,										// fov
		window.innerWidth / window.innerHeight,	// aspect ratio
		3,										// near frustum
		1000									// far frustum
	);
	
	var multiplier = properties.cameraMultiplier ? properties.cameraMultiplier : 1.5;
	this.object.position.z = this.poem.r * multiplier;
	
	this.polarObj.add( this.object );
	this.poem.scene.add( this.polarObj );
	
	this.poem.on('update', this.update.bind(this) );
};

module.exports = Camera;

Camera.prototype = {
	
	resize : function() {
		this.object.aspect = window.innerWidth / window.innerHeight;
		this.object.updateProjectionMatrix();
	},
	
	update : function( e ) {
		
		var thisTheta = this.polarObj.rotation.y;
		var thatTheta = this.poem.ship.polarObj.rotation.y;
		var thetaDiff = Math.abs(thisTheta - thatTheta);
		
		// if( thetaDiff > 0.2 ) {
		
			this.polarObj.rotation.y =
				thatTheta * (this.speed) +
				thisTheta * (1 - this.speed);
				
		// }
	}
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/CameraIntro.js":[function(require,module,exports){
var CameraIntro = function( poem, properties ) {
	
	this.poem = poem;
	
	this.poem.camera.object.position.y = this.poem.height * 5;
	this.origin = properties.origin ? properties.origin : new THREE.Vector3();
	this.speed = properties.speed ? properties.speed : 0.98;
	
	this.boundUpdate = this.update.bind(this);
	
	this.poem.on('update', this.boundUpdate );
	
};


CameraIntro.prototype = {
	
	update: function( e ) {
		
		this.poem.camera.object.position.y *= this.speed;
		this.poem.camera.object.lookAt( this.origin );
		
		if( this.poem.camera.object.position.y < 0.1 ) {
			this.poem.off('update', this.boundUpdate );
		}
		
	}
	
};

module.exports = CameraIntro;
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/CylinderLines.js":[function(require,module,exports){
var twoπ = Math.PI * 2;
var cos = Math.cos;
var sin = Math.sin;
var random = require('../utils/random.js');


var CylinderLines = function( poem, properties ) {
	
	// console.warn("remove title hiding hack");
	// $('#title').hide();
	// $('.score').css('opacity', 1);
	
	
	this.poem = poem;
	
	var h = 0.5;
	var l = 0.5;
	var s = 0.5;
	
	var geometry		= new THREE.Geometry();
	var height			= poem.r * (_.isNumber( properties.heightPercentage ) ? properties.radiusPercentage : 0.8);
	var radius			= poem.r * (_.isNumber( properties.radiusPercentage ) ? properties.radiusPercentage : 0.8);
	var sides			= _.isNumber( properties.sides ) ? properties.sides : 15;
	var eccentricity	= _.isNumber( properties.eccentricity ) ? properties.eccentricity : 0.05;
	var iterations		= _.isNumber( properties.iterations ) ? properties.iterations : 10;
	
	_multipleCylinderWaveVertices(
		iterations,
		geometry.vertices,
		sides,
		radius,
		poem.height,
		eccentricity
	);

	var material = new THREE.LineBasicMaterial({
		color: this.color,
		linewidth : this.linewidth,
		fog: true
	});

	this.object = new THREE.Line(
		geometry,
		material,
		THREE.LinePieces
	);
	
	this.poem.scene.add( this.object );
	
	this.poem.on('update', function( e ) {

		h = (h + 0.0002 * e.dt) % 1;
		material.color.setHSL( h, s, l );

	}.bind(this));
	
};

function _multipleCylinderWaveVertices( iterations, vertices, sides, radius, height, eccentricity ) {
	
	var ratio1, ratio2;
	
	for( var i=0; i < iterations; i++ ) {
		
		ratio1 = i / iterations;
		ratio2 = 1 - ratio1;
		
		_cylinderWaveVertices(
			vertices,
			Math.floor( (sides - 3) * ratio2 ) + 3,
			radius * ratio2,
			height * ratio2 * ratio2,
			eccentricity
		);
		
	}
}

function _cylinderWaveVertices( vertices, sides, radius, height, eccentricity ) {

	var x1,z1,x2,z2,h1,h2,xPrime,zPrime,hPrime;
	var ecc1 = 1 - eccentricity;
	var ecc2 = 1 + eccentricity;
	var radiansPerSide = twoπ / sides;
	var waves = 3;
	var waveHeight;

	for( var i=0; i <= sides; i++ ) {

		waveHeight = height * Math.sin( radiansPerSide * i * waves ) * 0.4;

		x1 = cos( radiansPerSide * i ) * radius * random.range( ecc1, ecc2 );
		z1 = sin( radiansPerSide * i ) * radius * random.range( ecc1, ecc2 );
		h1 = height								* random.range( ecc1, ecc2 ) + waveHeight;
		
		if( i > 0 ) {
			
			if( i === sides ) {
				x1 = xPrime;
				z1 = zPrime;
				h1 = hPrime;
			}

			//Vertical line
			vertices.push( new THREE.Vector3( x1, h1 *  0.5, z1 ) );
			vertices.push( new THREE.Vector3( x1, h1 * -0.5, z1 ) );

			//Top horiz line
			vertices.push( new THREE.Vector3( x1, h1 * 0.5, z1 ) );
			vertices.push( new THREE.Vector3( x2, h2 * 0.5, z2 ) );

			//Bottom horiz line
			vertices.push( new THREE.Vector3( x1, h1 * -0.5, z1 ) );
			vertices.push( new THREE.Vector3( x2, h2 * -0.5, z2 ) );
			
		} else {
			
			xPrime = x1;
			zPrime = z1;
			hPrime = h1;
			
		}

		x2 = x1;
		z2 = z1;
		h2 = h1;

	}
	
	return geometry;

};

module.exports = CylinderLines;
},{"../utils/random.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js":[function(require,module,exports){
var _ = require('underscore');
var random = require('../utils/random.js');
var Bullet = require('../entities/Bullet');
var SoundGenerator = require('../sound/SoundGenerator');

var Damage = function( poem, ship, settings ) {
	
	this.poem = poem;
	this.ship = ship;
	this.perExplosion = 100;
	this.retainExplosionsCount = 3;
	this.bullets = [];
	this.explodeSpeed = 3;
	this.transparent = false;
	this.opacity = 1;
	
	this.explosionCount = 0;
	this.explosionSound = null;
	
	if( _.isObject( settings ) ) {
		_.extend( this, settings );
	}
	
	this.count = this.perExplosion * this.retainExplosionsCount;
	
	this.addObject();
	this.addSound();
};
	
Damage.prototype = {
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			vertex = new THREE.Vector3();
			bullet = new Bullet( this.poem, this, vertex );
			
			geometry.vertices.push( vertex );
			this.bullets.push( bullet );
			
			bullet.kill();
			bullet.position.y = 1000;
					
		}
		
		return geometry;
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.generateGeometry();
		
		this.object = new THREE.PointCloud(
			geometry,
			new THREE.PointCloudMaterial({
				 size: 1 * this.poem.ratio,
				 color: this.ship.color,
				 transparent: this.transparent,
				 opacity: this.opacity
			}
		));
		this.object.frustumCulled = false;
		this.poem.scene.add( this.object ) ;
		
	},
	
	addSound : function() {
		
		var sound = this.explosionSound = new SoundGenerator();
		
		sound.connectNodes([
			sound.makeOscillator( "sawtooth" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
	},
	
	reset : function() {
		
		_.each( this.bullets, function( bullet ) {
			bullet.kill();
		});
		
	},
	
	explode : function() {
		
		this.playExplosionSound();
		
		_.each( _.sample( this.bullets, this.perExplosion ), function( bullet) {

			var theta = random.range(0, 2 * Math.PI);
			var r = random.rangeLow( 0, this.explodeSpeed );
			
			bullet.alive = true;
			bullet.position.copy( this.ship.position );
			
			bullet.speed.x = r * Math.cos( theta );
			bullet.speed.y = r * Math.sin( theta );
						
		}.bind(this));
		
	},
	
	playExplosionSound : function() {
		
		var freq = 500;
		var sound = this.explosionSound;

		//Start sound
		sound.setGain(0.5, 0, 0.001);
		sound.setFrequency(freq, 0, 0);
		
		var step = 0.02;
		var times = 6;
		var i=1;
		
		for(i=1; i < times; i++) {
			sound.setFrequency(freq * Math.random(), step * i, step);
		}

		//End sound
		sound.setGain(0, step * times, 0.2);
		sound.setFrequency(freq * 0.21, step * times, 0.05);
	},
	
	update : function( e )  {
		
		_.each( this.bullets, function( bullet ) {
			bullet.update( e );
			bullet.speed.multiplyScalar(0.999);
		});
		
		this.object.geometry.verticesNeedUpdate = true;
		
	},
	
};

module.exports = Damage;
},{"../entities/Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js","../utils/random.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js","underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Hid.js":[function(require,module,exports){
module.exports=require("/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js")
},{"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/ScoringAndWinning.js":[function(require,module,exports){
/*
	Set the win conditions in the level manifest as below

		properties: {
			conditions: [
				{
					component: "jellyManager",
					properties: null
				}
			]
		}

	Psuedo-code gets called:

		jellyManager.watchForCompletion( winCheck, properties );

	Then in the jellyManager component, call the following when condition is completed:

		scoringAndWinning.reportConditionCompleted();

*/

var ScoringAndWinning = function( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	
	this.poem = poem;
	this.$score = $('#score');
	this.$enemiesCount = $('#enemies-count');
	this.$win = $('.win');
	this.$winScore = $('#win-score');
	this.$winText = this.$win.find('h1:first');
	this.$scoreMessage = $('#score-message');
	this.$nextLevel = $('#next-level');
	this.score = 0;
	this.enemiesCount = 0;
	this.scoreMessageId = 0;
	this.message = _.isString( properties.message ) ? properties.message : "You Win";
	this.nextLevel = properties.nextLevel ? properties.nextLevel : null;
	this.won = false;
	
	this.conditionsCount = _.isArray( properties.conditions ) ? properties.conditions.length : 0;
	this.conditionsRemaining = this.conditionsCount;
	
	this.poem.on('levelParsed', function() {
		this.setConditions( properties.conditions )
	}.bind(this));
	
	
};

module.exports = ScoringAndWinning;

ScoringAndWinning.prototype = {
	
	setConditions : function( conditions ) {
		
		// Start watching for completion for all components
		
		_.each( conditions, function( condition ) {
		
			var component = this.poem[condition.component];
			var arguments = _.union( this, condition.properties );
		
			component.watchForCompletion.apply( component, arguments );
		
		}.bind(this));
		
	},
	
	reportConditionCompleted : function() {
		
		this.conditionsRemaining--;
		
		if( this.conditionsRemaining === 0 ) {
			
			this.poem.ship.disable();
			this.won = true;
			this.showWinScreen();
			
		}
		
	},
	
	adjustEnemies : function( count ) {
		
		// if(this.won) return;
		
		this.enemiesCount += count;
		this.$enemiesCount.text( this.enemiesCount );
		
		return this.enemiesCount;
	},
	
	adjustScore : function( count, message, style ) {
		
		if(this.won) return;
		
		this.score += count;
		this.$score.text( this.score );
		
		if( message ) {
			this.showMessage( message, style );
		}
		
		return this.score;
	},
	
	showMessage : function( message, style ) {
		
		var $span = $('<span></span>').text( message );
		
		if( style ) $span.css( style );
		
		this.$scoreMessage.hide();
		this.$scoreMessage.empty().append( $span );
		this.$scoreMessage.removeClass('fadeout');
		this.$scoreMessage.addClass('fadein');
		this.$scoreMessage.show();
		this.$scoreMessage.removeClass('fadein');
		
		var id = ++this.scoreMessageId;
		
		setTimeout(function() {
			
			if( id === this.scoreMessageId ) {
				this.$scoreMessage.addClass('fadeout');
			}
			
		}.bind(this), 2000);
		
	},
	
	showWinScreen : function() {
				
		this.$winScore.text( this.score );
		this.$win.show();
		this.$win.css({
			opacity: 1
		});
		this.$winText.html( this.message );
		this.$nextLevel.one( 'click', function() {
			
			LevelLoader( this.nextLevel );
			this.$win.hide();
			
		}.bind(this));
	}
	
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Stars.js":[function(require,module,exports){
var Stars = function( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	
	this.poem = poem;
	this.object = null;
	
	this.count = _.isNumber( properties.count ) ? properties.count : 40000;
	this.depth = 7.5;
	this.color = 0xaaaaaa;
	
	this.addObject();
};

module.exports = Stars;

Stars.prototype = {
	
	generateGeometry : function() {
		var r, theta, x, y, z, geometry;
		
		geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			r = Math.random() * this.depth * this.poem.r;
			if( r < this.poem.r ) {
				r = Math.random() * this.depth * this.poem.r;
			}
			theta = Math.random() * 2 * Math.PI;
			
			x = Math.cos( theta ) * r;
			z = Math.sin( theta ) * r;
			y = (0.5 - Math.random()) * this.depth * this.poem.r;
			
			geometry.vertices.push( new THREE.Vector3(x,y,z) );
					
		}
		
		return geometry;
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.generateGeometry();
		
		
		this.object = new THREE.PointCloud(
			geometry,
			new THREE.PointCloudMaterial({
				 size: 0.5 * this.poem.ratio,
				 color: this.color,
				 fog: false
			}
		) );
		
		this.poem.scene.add( this.object ) ;
		
	}
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Titles.js":[function(require,module,exports){
var HID = require('../Components/Hid');

var Titles = function( poem, properties ) {
	this.poem = poem;
	
	this.poem.ship.disable();
	this.rotateStars();
	
	$('a[href=#keys]').click(this.handleKeysClick.bind(this));
	$('a[href=#tilt]').click(this.handleTiltClick.bind(this));
	
	$('#title').removeClass('hide').show();
	$('.score').css('opacity', 0);
	
	
	this.webglCheck();
};

module.exports = Titles;

Titles.prototype = {
	
	webglEnabled : ( function () { try { var canvas = document.createElement( 'canvas' ); return !! window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ); } catch( e ) { return false; } } )(),
	
	webglCheck : function() {
		
		if( !this.webglEnabled ) {
			$('a[href=#keys]').hide();
			$('a[href=#tilt]').hide();
			$('.title-webgl-error').show();
		}
		
	},
	
	handleKeysClick : function(e) {
		e.preventDefault();
		HID.prototype.setKeys();
		this.nextLevel();
	},
	
	handleTiltClick : function(e) {
		e.preventDefault();
		HID.prototype.setTilt();
		this.nextLevel();
	},
	
	nextLevel : function() {
		$('#title').addClass('hide');
		$('.score').css('opacity', 1);

		LevelLoader("intro");
		
		setTimeout(function() {
			
			$('#title').hide();
			
		}.bind(this), 1000);
	},
	
	rotateStars : function() {
		
		this.poem.on('update', function(e) {
			
			this.poem.stars.object.rotation.y -= 0.0001 * e.dt;
		
		}.bind(this) );
		
	}
	
};
},{"../Components/Hid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Asteroid.js":[function(require,module,exports){
var _ = require('underscore');

var Asteroid = function( poem, x, y, radius ) {
	
	this.poem = poem;
	this.object = null;
	
	this.position = new THREE.Vector2();
	this.position.x = x || 0;
	this.position.y = y || 0;
	this.oscillation = 0;
	this.radius = radius || 5;
	this.speed = new THREE.Vector2();
	this.rotationSpeed = new THREE.Vector3();
	this.maxSpeed = 0.5;
	this.maxRotationSpeed = 0.1;
	this.oscillationSpeed = 50;
	this.strokeColor = 0xdddddd;
	this.fillColor = 0xffffff;
	this.addObject(x, y);
	this.update();
	
};

module.exports = Asteroid;

Asteroid.prototype = {

	addObject : function() {
		
		var geometry = new THREE.OctahedronGeometry(this.radius, 1);
		
		//Disform
		_.each(geometry.vertices, function( vertex ) {
			vertex.x += (this.radius / 2) * (Math.random() - 0.5);
			vertex.y += (this.radius / 2) * (Math.random() - 0.5);
			vertex.z += (this.radius / 2) * (Math.random() - 0.5);
		}, this);
		
		var material = new THREE.MeshBasicMaterial({color:this.strokeColor});
		this.object = new THREE.Mesh( geometry, material );
		
		var outlineMat = new THREE.MeshBasicMaterial({color:this.fillColor, side: THREE.BackSide});
		var outlineObj = new THREE.Mesh( geometry, outlineMat );
		outlineObj.scale.multiplyScalar( 1.05);
		
		this.object.add( outlineObj );
		
		this.poem.scene.add( this.object );
		
		this.speed.x = (0.5 - Math.random()) * this.maxSpeed;
		this.speed.y = (0.5 - Math.random()) * this.maxSpeed;
		
		this.rotationSpeed.x = (0.5 - Math.random()) * this.maxRotationSpeed;
		this.rotationSpeed.y = (0.5 - Math.random()) * this.maxRotationSpeed;
		this.rotationSpeed.z = (0.5 - Math.random()) * this.maxRotationSpeed;
		
		this.oscillation = Math.random() * Math.PI * 2 * this.oscillationSpeed;
	},
	
	update : function( e ) {
		
		this.oscillation += this.speed.y;
		this.position.x += this.speed.x;
		this.position.y = Math.sin( this.oscillation / this.oscillationSpeed ) * this.poem.height;
		
		this.object.rotation.x += this.rotationSpeed.x;	
		this.object.rotation.y += this.rotationSpeed.y;	
		this.object.rotation.z += this.rotationSpeed.z;	
		
		this.poem.coordinates.setVector( this.object.position, this.position );
	}
	
};
},{"underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js":[function(require,module,exports){
var Bullet = function( poem, gun, vertex ) {
	this.poem = poem;
	this.gun = gun;
	this.vertex = vertex;
	
	this.speed = new THREE.Vector2(0,0);
	this.position = new THREE.Vector2(0,0);
	this.radius = 1;
	
	this.bornAt = 0;
	this.alive = false;
};

module.exports = Bullet;

Bullet.prototype = {
	
	kill : function() {
		this.vertex.set(0, 0 ,1000);
		this.alive = false;
	},
	
	update : function( e ) {
		var x,y,z;
		
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
		
		this.poem.coordinates.setVector( this.vertex, this.position );
		
	},
	
	fire : function(x, y, speed, theta) {
				
		this.poem.coordinates.setVector( this.vertex, x, y );
		
		this.position.set(x,y);
		
		this.speed.x = Math.cos( theta ) * speed;
		this.speed.y = Math.sin( theta ) * speed;
		
		this.bornAt = this.poem.clock.time;
		this.alive = true;
	}
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js":[function(require,module,exports){
var Damage = require('../components/Damage');
var random = require('../utils/random');

var Jellyship = function( poem, manager, x, y ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Jellyship";
	this.color = 0xcb36ea;
	this.cssColor = "#CB36EA";
	this.linewidth = 2 * this.poem.ratio;
	this.scoreValue = 13;

	this.spawnPoint = new THREE.Vector2(x,y);
	this.position = new THREE.Vector2(x,y);
	
	this.dead = false;

	this.speed = 0;

	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;

	this.thrustSpeed = 1;
	this.thrust = 0;

	this.bankSpeed = 0.06;
	this.bank = 0;
	this.maxSpeed = 1000;
	
	this.radius = 3;

	this.addObject();
	this.damage = new Damage(this.poem, this, {
		transparent: true,
		opacity: 0.5,
		retainExplosionsCount: 3,
		perExplosion: 50
	});
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
};

module.exports = Jellyship;

Jellyship.prototype = {
	
	initSharedAssets : function( manager ) {
		
		var geometry = this.createGeometry();
		
		manager.shared.geometry = geometry;
		
		manager.on('update', Jellyship.prototype.updateWaveyVerts( geometry ) );
	},
	
	updateWaveyVerts : function( geometry ) {

		return function( e ) {
			
			_.each( geometry.waveyVerts, function( vec ) {
				vec.y = 0.8 * Math.sin( e.time / 100 + vec.x ) + vec.original.y;
			});
			
		};
	},

	createGeometry : function() {

		var geometry, verts, manhattanLength, center;
	
		geometry = new THREE.Geometry(),
	
		//verts = [[355.7,211.7], [375.8,195.9], [368.5,155.4], [361.4,190.8], [341.3,205.9], [320.4,201.8], [298.9,206], [278.6,190.8], [271.5,155.4], [264.2,195.9], [284.7,212], [258.3,239.2], [242.3,228.5], [238.3,168.9], [226.1,237.1], [246.7,266.2], [233.7,316.4], [259.2,321.2], [237.4,429.6], [253.1,432.7], [274.9,324.2], [293,327.6], [286.6,484], [302.6,484.6], [308.9,330.6], [320.4,332.8], [331.1,330.8], [337.4,484.6], [353.4,484], [347,327.8], [365.1,324.3], [386.9,432.7], [402.6,429.6], [380.9,321.4], [407,316.4], [393.8,265.5], [413.9,237.1], [401.7,168.9], [397.7,228.5], [382.1,238.9], [355.9,211.8] ];
		
		verts = [ [355.7,211.7], [375.8,195.9], [368.5,155.4], [361.4,190.8], [341.3,205.9], [320.4,201.8], [298.9,206], [278.6,190.8], 
			[271.5,155.4], [264.2,195.9], [284.7,212], [258.3,239.2], [242.3,228.5], [238.3,168.9], [226.1,237.1], [246.7,266.2], [233.7,316.4], [259.2,321.2], 
			[257.1,331.3], [254.9,342.3], [252.8,352.9], [250.5,364.5], [248.2,375.7], [246.1,386.2], [243.8,397.7], [241.3,410.3], [239.5,419.3], [237.4,429.6], 
			[253.1,432.7], [254.9,423.7], [256.9,414.1], [259.3,401.8], [261.6,390.2], [263.7,380.1], [266.1,367.8], [268.3,356.9], [270.6,345.6], [272.7,335.1], 
			[274.9,324.2], [293,327.6], [292.6,336.5], [292.2,348], [291.7,359.6], [291.2,371.5], [290.7,382.5], [290.3,393.6], [289.8,405.1], [289.5,414.1], [289,425.6], 
			[288.5,437], [288.1,448.5], [287.6,459.5], [287.1,471.5], [286.6,484], [302.6,484.6], [303.1,473.5], [303.6,461.5], [304.1,448.5], [304.5,438.5], [305,425.1], 
			[305.4,416.1], [305.9,405], [306.2,395.5], [306.6,386], [307.1,373], [307.6,361], [308.2,347.5], [308.5,338.5], [308.9,330.6], [331.1,330.8], [331.4,336.5], 
			[331.7,344], [332,353], [332.5,364.5], [333,376], [333.4,387.5], [333.9,398.5], [334.4,410.5], [334.9,422.4], [335.4,437], [336,450], [336.4,460], [336.8,471], 
			[337.4,484.6], [353.4,484], [352.8,471], [352.3,457.5], [351.9,448], [351.5,437.5], [350.9,423], [350.4,410.5], [349.8,396.5], [349.4,385.5], [348.9,374.4], 
			[348.5,363.4], [348,352], [347.6,343], [347.3,334], [347,327.8], [365.1,324.3], [366.6,331.7], [368.2,339.6], [370.2,349.5], [371.9,357.8], [373.6,366.8], 
			[375.4,375.4], [377.1,384], [379,393.5], [381.2,404.6], [383.1,414], [384.9,422.8], [386.9,432.7], [402.6,429.6], [400.6,419.6], [399.1,412.5], [397.1,402.5], 
			[394.7,390.2], [393.1,382.6], [391.4,374], [389.6,365], [387.6,355.1], [386,347.2], [384.1,337.7], [382.7,330.6], [380.9,321.4], [407,316.4], [393.8,265.5], 
			[413.9,237.1], [401.7,168.9], [397.7,228.5], [382.1,238.9], [355.9,211.8] ];
		

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [0,0]);
	
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2 ) {
			
			var scale = 1 / 32;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( vec2[1] > 330.8 ) {
				geometry.waveyVerts.push( vec3 )
			}
			
			return vec3;
			
		}, this);
	
		return geometry;
	
	},

	addObject : function() {
	
		var geometry, lineMaterial;
	
		geometry = this.manager.shared.geometry;
			
		lineMaterial = new THREE.LineBasicMaterial({
			color: this.color,
			linewidth : this.linewidth
		});
	
		this.object = new THREE.Line(
			geometry,
			lineMaterial,
			THREE.LineStrip
		);
		this.object.position.z += this.poem.r;
	
		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode();
	},

	reset : function() {
		this.position.copy( this.spawnPoint );
		this.speed = 0.2;
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			
			this.bank *= 0.9;
			this.thrust = 0.01;
			this.bank += random.range(-0.01, 0.01);
		
			this.object.geometry.verticesNeedUpdate = true;
		
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
		
		}

	},

	updateEdgeAvoidance : function( e ) {
	
		var nearEdge, farEdge, position, normalizedEdgePosition, bankDirection, absPosition;
	
		farEdge = this.poem.height / 2;
		nearEdge = 4 / 5 * farEdge;
		position = this.object.position.y;
		absPosition = Math.abs( position );

		var rotation = this.object.rotation.z / Math.PI;

		this.object.rotation.z %= 2 * Math.PI;
	
		if( this.object.rotation.z < 0 ) {
			this.object.rotation.z += 2 * Math.PI;
		}
	
		if( Math.abs( position ) > nearEdge ) {
		
			var isPointingLeft = this.object.rotation.z >= Math.PI * 0.5 && this.object.rotation.z < Math.PI * 1.5;
		
			if( position > 0 ) {
			
				if( isPointingLeft ) {
					bankDirection = 1;
				} else {
					bankDirection = -1;
				}
			} else {
				if( isPointingLeft ) {
					bankDirection = -1;
				} else {
					bankDirection = 1;
				}
			}
		
			normalizedEdgePosition = (absPosition - nearEdge) / (farEdge - nearEdge);
			this.thrust += normalizedEdgePosition * this.edgeAvoidanceThrustSpeed;
			this.object.rotation.z += bankDirection * normalizedEdgePosition * this.edgeAvoidanceBankSpeed;
		
		}
	
		this.object.rotation.z;
	
	
	},

	updatePosition : function( e ) {
	
		var movement = new THREE.Vector3();
	
		return function() {
	
			var theta, x, y;
		
			this.object.rotation.z += this.bank;
		
			theta = this.object.rotation.z;
		
			this.speed *= 0.98;
			this.speed += this.thrust;
			this.speed = Math.min( this.maxSpeed, this.speed );
			this.speed = Math.max( 0, this.speed );
					
			this.position.x += this.speed * Math.cos( theta );
			this.position.y += this.speed * Math.sin( theta );
		
			this.object.position.y = this.position.y;
		
			//Polar coordinates
			// this.object.position.x = Math.cos( this.position.x * this.poem.circumferenceRatio ) * this.poem.r;
			// this.object.position.z = Math.sin( this.position.x * this.poem.circumferenceRatio ) * this.poem.r;
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
		
		};
	
	}()	


};
},{"../components/Damage":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js","../utils/random":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Jellyship.js":[function(require,module,exports){
module.exports=require("/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js")
},{"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/asteroidsJellies.js":[function(require,module,exports){
module.exports = {
	config : {
		scoringAndWinning: {
			message: "No jellies detected within 5 parsecs.<br/> Follow me on <a href='https://twitter.com/tatumcreative'>Twitter</a> for updates on new levels.",
			nextLevel: "titles",
			conditions: [
				{
					//Jelly manager has 0 live ships
					component: "jellyManager",
					properties: null
				}		
			]
		}
	},
	objects : {
		asteroidField : {
			object: require("../managers/AsteroidField"),
			properties: {
				count : 20
			} 
		},
		jellyManager : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Jellyship'),
				count: 25
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/the-end-of-our-journey"
			}
		}
	}
};
},{"../entities/Jellyship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Jellyship.js","../managers/AsteroidField":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js","../managers/EntityManager":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js","../sound/Music":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/index.js":[function(require,module,exports){
module.exports = {
	asteroidsJellies : require("./asteroidsJellies"),
	titles : require("./titles"),
	intro : require("./intro")
};
},{"./asteroidsJellies":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/asteroidsJellies.js","./intro":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/intro.js","./titles":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/titles.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/intro.js":[function(require,module,exports){
module.exports = {
	config : {
		r : 120,
		height : 60,
		circumference : 900,
		cameraMultiplier : 2,
		scoringAndWinning: {
			message: "You saved this sector<br/>on to the next level.",
			nextLevel: "asteroidsJellies",
			conditions: [
				{
					//Jelly manager has 0 live ships
					component: "jellyManager",
					properties: null
				}
			]
		},
		stars: {
			count: 3000
		}
	},
	objects : {
		cylinderLines : {
			object: require("../components/CylinderLines"),
			properties: {}
		},
		cameraIntro : {
			object: require("../components/CameraIntro"),
			properties: {
				speed : 0.985
			}
		},
		jellyManager : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Jellyship'),
				count: 5
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/the-sun-is-rising-chip-music"
			}
		}
	}
};
},{"../components/CameraIntro":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/CameraIntro.js","../components/CylinderLines":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/CylinderLines.js","../entities/Jellyship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Jellyship.js","../managers/EntityManager":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js","../sound/Music":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/titles.js":[function(require,module,exports){
module.exports = {
	config : {
		
	},
	objects : {
		titles : {
			object: require("../components/Titles"),
			properties: {}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/chiptune-space",
				startTime: 12,
				volume: 1
			}
		}
	}
};
},{"../components/Titles":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Titles.js","../sound/Music":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js":[function(require,module,exports){
var Asteroid = require('../entities/Asteroid');

var AsteroidField = function( poem, properties ) {
	
	this.poem = poem;
	this.asteroids = [];
	this.maxRadius = 50;
	this.originClearance = 30;
	this.count = 20;
	
	_.extend( this, properties ) ;
	
	this.generate( this.count );
	
	this.poem.on('update', this.update.bind(this) );
	this.poem.gun.setBarrierCollider( this.asteroids );
};

module.exports = AsteroidField;

AsteroidField.prototype = {
	
	generate : function( count ) {
		
		var i, x, y, height, width, radius;
		
		height = this.poem.height * 4;
		width = this.poem.circumference;
		
		for( i=0; i < count; i++ ) {
			
			do {
				
				x = Math.random() * width;
				y = Math.random() * height - (height / 2);
			
				radius = Math.random() * this.maxRadius;
				
			} while(
				this.checkCollision( x, y, radius ) &&
				this.checkFreeOfOrigin( x, y, radius )
			);
			
			this.asteroids.push(
				new Asteroid( this.poem, x, y, radius )
			);
		
		}
		
	},
	
	update : function( e ) {
		
		_.each( this.asteroids, function(asteroid) {
			
			asteroid.update( e );
			
		}, this);
		
		if( !this.poem.ship.dead && !this.poem.ship.invulnerable ) {
			var shipCollision = this.checkCollision(
				this.poem.ship.position.x,
				this.poem.ship.position.y,
				2
			);
		
			if( shipCollision ) {
				this.poem.ship.kill();
			}
		}
		
	},
	
	checkFreeOfOrigin : function( x, y, radius ) {
		return Math.sqrt(x*x + y*y) > radius + this.originClearance;
	},
	
	checkCollision : function( x, y, radius ) {
		
		var collision = _.find( this.asteroids, function( asteroid ) {
			
			var dx, dy, distance;
			
			dx = this.poem.coordinates.circumferenceDistance( x, asteroid.position.x );
			dy = y - asteroid.position.y;
			
			distance = Math.sqrt(dx * dx + dy * dy);

			return distance < radius + asteroid.radius;
			
		}, this);
		
		return !!collision;
	}
};
},{"../entities/Asteroid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Asteroid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js":[function(require,module,exports){
var Collider = require('../utils/Collider');
var DefaultJellyShip = require('../entities/JellyShip');
var EventDispatcher = require('../utils/EventDispatcher');

var EntityManager = function( poem, properties ) {
	
	this.poem = poem;
	this.entityType = DefaultJellyShip;
	this.count = 20;
	this.entities = [];
	this.liveEntities = [];
	this.originClearance = 300;
	this.shared = {};
	this.winCheck = null;
		
	_.extend( this, properties );
	
	if( _.isFunction( this.entityType.prototype.initSharedAssets ) ) {
		this.entityType.prototype.initSharedAssets( this );
	}
	this.generate( this.count );
	this.configureCollider();

	this.boundUpdate = this.update.bind(this);
	
	this.poem.on('update', this.boundUpdate );
};

module.exports = EntityManager;

EntityManager.prototype = {
	
	generate : function( count ) {
		
		var i, x, y, height, width, entity;
		
		height = this.poem.height * 4;
		width = this.poem.circumference;
		
		for( i=0; i < count; i++ ) {
			
			x = Math.random() * width;
			y = Math.random() * height - (height / 2);
			
			entity = new this.entityType( this.poem, this, x, y );
			
			this.entities.push( entity );
			this.liveEntities.push( entity );
		
		}
		
		this.poem.scoringAndWinning.adjustEnemies( count );
		
	},
	
	update : function( e ) {
		
		this.dispatch( e );
		
		
	},
	
	killEntity : function( entity ) {
		
		var i = this.liveEntities.indexOf( entity );
		
		if( i >= 0 ) {
			this.liveEntities.splice( i, 1 );
		}
		
		entity.kill();
		
		if( this.winCheck && this.liveEntities.length === 0 ) {
			this.winCheck.reportConditionCompleted();
			this.winCheck = null;
		}
	},
	
	configureCollider : function() {
		new Collider(
			
			this.poem,
			
			function() {
				return this.liveEntities;
			}.bind(this),
			
			function() {
				return this.poem.gun.liveBullets;
			}.bind(this),
			
			function(entity, bullet) {
				
				this.killEntity( entity );
				this.poem.gun.killBullet( bullet );
				
				this.poem.scoringAndWinning.adjustScore(
					entity.scoreValue,
					"+" + entity.scoreValue + " " + entity.name, 
					{
						"color" : entity.cssColor
					}
				);
				this.poem.scoringAndWinning.adjustEnemies( -1 );
				
			}.bind(this)
			
		);
		
		new Collider(
			
			this.poem,
			
			function() {
				return this.liveEntities;
			}.bind(this),
			
			function() {
				return [this.poem.ship];
			}.bind(this),
			
			function(entity, bullet) {
				
				if( !this.poem.ship.dead && !this.poem.ship.invulnerable ) {
					
					this.killEntity( entity );
					this.poem.ship.kill();
					
					this.poem.scoringAndWinning.adjustEnemies( -1 );
					
				}
				
				
			}.bind(this)
			
		);
		
	},
	
	watchForCompletion : function( winCheck, properties ) {
		this.winCheck = winCheck;
	}
};

EventDispatcher.prototype.apply( EntityManager.prototype );
},{"../entities/JellyShip":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js","../utils/Collider":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js","../utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/Gun.js":[function(require,module,exports){
var Bullet = require('../entities/Bullet');
var Collider = require('../utils/Collider');
var SoundGenerator = require('../sound/SoundGenerator');

var Gun = function( poem ) {
	this.poem = poem;
	this.object = null;
	this.sound = null;
	
	this.count = 350;
	this.bulletAge = 5000;
	this.fireDelayMilliseconds = 100;
	this.lastFireTimestamp = this.poem.clock.time;
	this.liveBullets = [];
	this.bullets = [];
	this.bornAt = 0;

	this.addObject();
	this.addSound();
	
	this.poem.on('update', this.update.bind(this) );
};

module.exports = Gun;

Gun.prototype = {
	
	fire : function() {
		
		var isDead = function( bullet ) {
			return !bullet.alive;
		};
		
		return function(x, y, speed, theta) {
			
			var now = this.poem.clock.time;
			
			if( now - this.lastFireTimestamp < this.fireDelayMilliseconds ) {
				return;
			}
			
			this.lastFireTimestamp = now;
		
			var bullet = _.find( this.bullets, isDead );
		
			if( !bullet ) return;
		
			this.liveBullets.push( bullet );
		
			bullet.fire(x, y, speed, theta);


			var freq = 1900;
			
			//Start sound
			this.sound.setGain(0.1, 0, 0.001);
			this.sound.setFrequency(freq, 0, 0);
			

			//End sound
			this.sound.setGain(0, 0.01, 0.05);
			this.sound.setFrequency(freq * 0.1, 0.01, 0.05);
			
		};
	}(),
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		var geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			vertex = new THREE.Vector3();
			bullet = new Bullet( this.poem, this, vertex );
			
			geometry.vertices.push( vertex );
			this.bullets.push( bullet );
			
			bullet.kill();
					
		}
		
		return geometry;
	},
	
	killBullet : function( bullet ) {
		
		var i = this.liveBullets.indexOf( bullet );
		
		if( i >= 0 ) {
			this.liveBullets.splice( i, 1 );
		}
		
		bullet.kill();
		
		if( this.object ) this.object.geometry.verticesNeedUpdate = true;
		
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.generateGeometry();
		
		this.object = new THREE.PointCloud(
			geometry,
			new THREE.PointCloudMaterial({
				 size: 1 * this.poem.ratio,
				 color: 0xff0000
			}
		));
		this.object.frustumCulled = false;
		this.poem.scene.add( this.object ) ;
		
	},
	
	update : function( e )  {
		var bullet, time;
		
		for(var i=0; i<this.liveBullets.length; i++) {
			bullet = this.liveBullets[i];
			
			if(bullet.bornAt + this.bulletAge < e.time) {
				this.killBullet( bullet );
				i--;
			} else {
				bullet.update( e.dt );
			}
		}
		if(this.liveBullets.length > 0) {
			this.object.geometry.verticesNeedUpdate = true;
		}
		
	},
	
	setBarrierCollider : function( collection ) {
		
		//Collide bullets with asteroids
		new Collider(
			
			this.poem,
			
			function() {
				return collection;
			}.bind(this),
			
			function() {
				return this.liveBullets;
			}.bind(this),
			
			function(barrier, bullet) {
				this.killBullet( bullet );
			}.bind(this)
			
		);
	},
	
	addSound : function() {
		
		var sound = this.sound = new SoundGenerator();
		
		sound.connectNodes([
			sound.makeOscillator( "square" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
	}
};
},{"../entities/Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js","../utils/Collider":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/Music.js":[function(require,module,exports){
var soundcloud = require('soundcloud-badge');

var Music = function( poem, properties ) {

	if(window.location.hash === "#musicoff") return;

	var audio;
	var alive = true;

	soundcloud({
		client_id: '6057c9af862bf245d4c402179e317f52',
		song: properties.url,
		dark: false,
		getFonts: false
	}, function(err, src, data, div) {

		if( !alive ) return;
		if( err ) throw err;

		audio = new Audio();
		audio.src = src;
		audio.play();
		audio.loop = true;
		audio.volume = properties.volume || 0.6;
		
		$(audio).on('loadedmetadata', function() {
			audio.currentTime = properties.startTime || 0;
		});
		
		var playing = true;
		
		$(window).on('keydown.Music', function(e) {
			if( e.keyCode !== 83 ) return;
			if( playing ) {
				audio.pause();
				playing = false;
			} else {
				audio.play();
				playing = true;
			}
		});
	});
	
	poem.on('destroy', function() {
		if(audio) {
			audio.pause();
			audio = null;
		}
		$(window).off('keydown.Music');
		$('.npm-scb-white').remove();
	});
	
};

module.exports = Music;
},{"soundcloud-badge":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/index.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js":[function(require,module,exports){
var _ = require('underscore');
var context = window.AudioContext || window.webkitAudioContext || null;

var SoundGenerator = function() {
	
	this.enabled = context !== undefined;
	
	if(!this.enabled) return;
	
	this.totalCreated++;
	this.totalCreatedSq = this.totalCreated * this.totalCreated;
};

module.exports = SoundGenerator;

SoundGenerator.prototype = {
	
	context : context ? new context() : undefined,
	
	makePinkNoise : function( bufferSize ) {
	
		var b0, b1, b2, b3, b4, b5, b6, node; 
		
		b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
		node = this.pinkNoise = this.context.createScriptProcessor(bufferSize, 1, 1);
		
		node.onaudioprocess = function(e) {
			
			// http://noisehack.com/generate-noise-web-audio-api/
			var output = e.outputBuffer.getChannelData(0);
			
			for (var i = 0; i < bufferSize; i++) {
				var white = Math.random() * 2 - 1;
				b0 = 0.99886 * b0 + white * 0.0555179;
				b1 = 0.99332 * b1 + white * 0.0750759;
				b2 = 0.96900 * b2 + white * 0.1538520;
				b3 = 0.86650 * b3 + white * 0.3104856;
				b4 = 0.55000 * b4 + white * 0.5329522;
				b5 = -0.7616 * b5 - white * 0.0168980;
				output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
				output[i] *= 0.11; // (roughly) compensate for gain
				b6 = white * 0.115926;
			}
		};
		
		return node;
	
	},
	
	makeOscillator : function( type, frequency ) {
		/*
			enum OscillatorType {
			  "sine",
			  "square",
			  "sawtooth",
			  "triangle",
			  "custom"
			}
		*/
		
		var node = this.oscillator = this.context.createOscillator();
		
		node.type = type || "sawtooth";
		node.frequency.value = frequency || 2000;
		
		return node;
	},
	
	makeGain : function() {
		var node = this.gain = this.context.createGain();
		
		node.gain.value = 1;
		
		return node;
	},
	
	makePanner : function() {
		
		this.context.listener.setPosition(0, 0, 0);
		
		var node = this.panner = this.context.createPanner();
		
		node.panningModel = 'equalpower';
		node.coneOuterGain = 0.1;
		node.coneOuterAngle = 180;
		node.coneInnerAngle = 0;
		
		return node;
	},
	
	makeBandpass : function() {

		var node = this.bandpass = this.context.createBiquadFilter();
		
		node.type = "bandpass";
		node.frequency.value = 440;
		node.Q.value = 0.5;
		
		return node;

	},
	
	getDestination : function() {
		return this.context.destination;
	},
	
	connectNodes : function( nodes ) {
		_.each( _.rest( nodes ), function(node, i, list) {
			var prevNode = nodes[i];
			
			prevNode.connect( node );
		});
	},
	
	start : function() {
		this.oscillator.start(0);
	},
	
	totalCreated : 0,
	
	setFrequency : function ( frequency, delay, speed ) {
		if(!this.enabled) return;
		
		this.oscillator.frequency.setTargetAtTime(frequency, this.context.currentTime + delay, speed);
	},
	
	setPosition : function ( x, y, z ) {
		if(!this.enabled) return;
		this.panner.setPosition( x, y, z );
	},
	
	setGain : function ( gain, delay, speed ) {
		
		if(!this.enabled) return;
		
		// Math.max( Math.abs( gain ), 1);
		// gain / this.totalCreatedSq;
				
		this.gain.gain.setTargetAtTime(
			gain,
			this.context.currentTime + delay,
			speed
		);
	},
	
	setBandpassQ : function ( Q ) {
		if(!this.enabled) return;
		this.bandpass.Q.setTargetAtTime(Q, this.context.currentTime, 0.1);
	},
	
	setBandpassFrequency : function ( frequency ) {
		if(!this.enabled) return;
		this.bandpass.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.1);
	}
};
},{"underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Clock.js":[function(require,module,exports){
var Clock = function( autostart ) {

	this.maxDt = 60;
	this.minDt = 16;
	this.pTime = 0;
	this.time = 0;
	
	if(autostart !== false) {
		this.start();
	}
	
};

module.exports = Clock;

Clock.prototype = {

	start : function() {
		this.pTime = Date.now();
	},
	
	getDelta : function() {
		var now, dt;
		
		now = Date.now();
		dt = now - this.pTime;
		
		dt = Math.min( dt, this.maxDt );
		dt = Math.max( dt, this.minDt );
		
		this.time += dt;
		this.pTime = now;
		
		return dt;
	}
	
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js":[function(require,module,exports){
var _ = require('underscore');

var Collider = function( poem, getCollectionA, getCollectionB, onCollision ) {
	
	this.poem = poem;
	
	this.getCollectionA = getCollectionA;
	this.getCollectionB = getCollectionB;
	this.onCollision = onCollision;
	
	this.poem.on('update', this.update.bind(this) );
};

module.exports = Collider;

Collider.prototype = {
	
	update : function( e ) {

		var collisions = [];

		_.each( this.getCollectionA(), function( itemFromA ) {
			
			var collidedItemFromB = _.find( this.getCollectionB(), function( itemFromB ) {
				
				
				var dx, dy, distance;
			
				dx = this.poem.coordinates.circumferenceDistance( itemFromA.position.x, itemFromB.position.x );
				dy = itemFromA.position.y - itemFromB.position.y;
			
				distance = Math.sqrt(dx * dx + dy * dy);
				
			
				return distance < itemFromA.radius + itemFromB.radius;
				
			}, this);
			
			
			if( collidedItemFromB ) {
				collisions.push([itemFromA, collidedItemFromB]);
			}
			
		}, this);
		
		_.each( collisions, function( items ) {
			this.onCollision( items[0], items[1] );
		}, this);
	}
	
};
},{"underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Coordinates.js":[function(require,module,exports){
// Translates 2d points into 3d polar space

var Coordinates = function( poem ) {
	this.poem = poem;
	this.twoRSquared = 2 * (this.poem.r * this.poem.r);
};

module.exports = Coordinates;

Coordinates.prototype = {
	
	x : function( x ) {
		return Math.sin( x * this.poem.circumferenceRatio ) * this.poem.r;
	},
	
	y : function( y ) {
		return y;
	},
	
	z : function( x ) {
		return Math.cos( x * this.poem.circumferenceRatio ) * this.poem.r;
	},
	
	r : function(x, z) {
		return Math.sqrt(x*x + z*z);
	},
	
	theta : function(x, z) {
		return Math.atan( z / x );
	},
	
	setVector : function( vector ) {
		
		var x, y, vector2;
		
		if( typeof arguments[1] === "number" ) {
			
			x = arguments[1];
			y = arguments[2];
			
			return vector.set(
				this.x(x),
				y,
				this.z(x)
			);
			
		} else {
			
			vector2 = arguments[1];
			
			return vector.set(
				this.x(vector2.x),
				vector2.y,
				this.z(vector2.x)
			);
		}
		
	},
	
	getVector : function( x, y ) {
		
		var vector = new THREE.Vector3();
		return this.setVector( vector, x, y );
		
	},
	
	keepInRangeX : function( x ) {
		if( x >= 0 ) {
			return x % this.poem.circumference;
		} else {
			return x + (x % this.poem.circumference);
		}
	},
	
	keepInRangeY : function( y ) {
		if( y >= 0 ) {
			return y % this.poem.height;
		} else {
			return y + (y % this.poem.height);
		}
	},
	
	keepInRange : function( vector ) {
		vector.x = this.keepInRangeX( vector.x );
		vector.y = this.keepInRangeX( vector.y );
		return vector;
	},
	
	twoXToTheta : function( x ) {
		return x * this.poem.circumferenceRatio;
	},
	
	circumferenceDistance : function (x1, x2) {
		
		var ratio = this.poem.circumferenceRatio;
		
		return this.twoRSquared - this.twoRSquared * Math.cos( x1 * ratio - x2 * ratio );
		
	}
	
};

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js":[function(require,module,exports){
/**
 * @author mrdoob / http://mrdoob.com/
 *
 * Modifications: Greg Tatum
 *
 * usage:
 * 
 * 		EventDispatcher.prototype.apply( MyObject.prototype );
 * 
 * 		MyObject.dispatch({
 * 			type: "click",
 * 			datum1: "foo",
 * 			datum2: "bar"
 * 		});
 * 
 * 		MyObject.on( "click", function( event ) {
 * 			event.datum1; //Foo
 * 			event.target; //MyObject
 * 		});
 * 
 *
 */

var EventDispatcher = function () {};

EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.on					= EventDispatcher.prototype.on;
		object.hasEventListener		= EventDispatcher.prototype.hasEventListener;
		object.off					= EventDispatcher.prototype.off;
		object.dispatch				= EventDispatcher.prototype.dispatch;

	},

	on: function ( type, listener ) {

		if ( this._listeners === undefined ) this._listeners = {};

		var listeners = this._listeners;

		if ( listeners[ type ] === undefined ) {

			listeners[ type ] = [];

		}

		if ( listeners[ type ].indexOf( listener ) === - 1 ) {

			listeners[ type ].push( listener );

		}

	},

	hasEventListener: function ( type, listener ) {

		if ( this._listeners === undefined ) return false;

		var listeners = this._listeners;

		if ( listeners[ type ] !== undefined && listeners[ type ].indexOf( listener ) !== - 1 ) {

			return true;

		}

		return false;

	},

	off: function ( type, listener ) {

		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ type ];

		if ( listenerArray !== undefined ) {

			var index = listenerArray.indexOf( listener );

			if ( index !== - 1 ) {

				listenerArray.splice( index, 1 );

			}

		}

	},

	dispatch: function ( event ) {
			
		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [];
			var length = listenerArray.length;
			var i;

			for ( i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}

};

if ( typeof module === 'object' ) {

	module.exports = EventDispatcher;

}
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Stats.js":[function(require,module,exports){
/**
 * @author mrdoob / http://mrdoob.com/
 */

var Stats = function () {

	var startTime = Date.now(), prevTime = startTime;
	var ms = 0, msMin = Infinity, msMax = 0;
	var fps = 0, fpsMin = Infinity, fpsMax = 0;
	var frames = 0, mode = 0;

	var container = document.createElement( 'div' );
	container.id = 'stats';
	container.addEventListener( 'mousedown', function ( event ) { event.preventDefault(); setMode( ++ mode % 2 ); }, false );
	container.style.cssText = 'width:80px;opacity:0.9;cursor:pointer';

	var fpsDiv = document.createElement( 'div' );
	fpsDiv.id = 'fps';
	fpsDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#002';
	container.appendChild( fpsDiv );

	var fpsText = document.createElement( 'div' );
	fpsText.id = 'fpsText';
	fpsText.style.cssText = 'color:#0ff;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
	fpsText.innerHTML = 'FPS';
	fpsDiv.appendChild( fpsText );

	var fpsGraph = document.createElement( 'div' );
	fpsGraph.id = 'fpsGraph';
	fpsGraph.style.cssText = 'position:relative;width:74px;height:30px;background-color:#0ff';
	fpsDiv.appendChild( fpsGraph );

	while ( fpsGraph.children.length < 74 ) {

		var bar = document.createElement( 'span' );
		bar.style.cssText = 'width:1px;height:30px;float:left;background-color:#113';
		fpsGraph.appendChild( bar );

	}

	var msDiv = document.createElement( 'div' );
	msDiv.id = 'ms';
	msDiv.style.cssText = 'padding:0 0 3px 3px;text-align:left;background-color:#020;display:none';
	container.appendChild( msDiv );

	var msText = document.createElement( 'div' );
	msText.id = 'msText';
	msText.style.cssText = 'color:#0f0;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
	msText.innerHTML = 'MS';
	msDiv.appendChild( msText );

	var msGraph = document.createElement( 'div' );
	msGraph.id = 'msGraph';
	msGraph.style.cssText = 'position:relative;width:74px;height:30px;background-color:#0f0';
	msDiv.appendChild( msGraph );

	while ( msGraph.children.length < 74 ) {

		var bar2 = document.createElement( 'span' );
		bar2.style.cssText = 'width:1px;height:30px;float:left;background-color:#131';
		msGraph.appendChild( bar2 );

	}

	var setMode = function ( value ) {

		mode = value;

		switch ( mode ) {

			case 0:
				fpsDiv.style.display = 'block';
				msDiv.style.display = 'none';
				break;
			case 1:
				fpsDiv.style.display = 'none';
				msDiv.style.display = 'block';
				break;
		}

	};

	var updateGraph = function ( dom, value ) {

		var child = dom.appendChild( dom.firstChild );
		child.style.height = value + 'px';

	};

	return {

		REVISION: 12,

		domElement: container,

		setMode: setMode,

		begin: function () {

			startTime = Date.now();

		},

		end: function () {

			var time = Date.now();

			ms = time - startTime;
			msMin = Math.min( msMin, ms );
			msMax = Math.max( msMax, ms );

			msText.textContent = ms + ' MS (' + msMin + '-' + msMax + ')';
			updateGraph( msGraph, Math.min( 30, 30 - ( ms / 200 ) * 30 ) );

			frames ++;

			if ( time > prevTime + 1000 ) {

				fps = Math.round( ( frames * 1000 ) / ( time - prevTime ) );
				fpsMin = Math.min( fpsMin, fps );
				fpsMax = Math.max( fpsMax, fps );

				fpsText.textContent = fps + ' FPS (' + fpsMin + '-' + fpsMax + ')';
				updateGraph( fpsGraph, Math.min( 30, 30 - ( fps / 100 ) * 30 ) );

				prevTime = time;
				frames = 0;

			}

			return time;

		},

		update: function () {

			startTime = this.end();

		}

	};

};

if ( typeof module === 'object' ) {

	module.exports = Stats;

}
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js":[function(require,module,exports){
var random = {
	
	flip : function() {
		return Math.random() > 0.5 ? true: false;
	},
	
	range : function(min, max) {
		return Math.random() * (max - min) + min;
	},
	
	rangeInt : function(min, max) {
		return Math.floor( this.range(min, max + 1) );
	},
	
	rangeLow : function(min, max) {
		//More likely to return a low value
	  return Math.random() * Math.random() * (max - min) + min;
	},
	
	rangeHigh : function(min, max) {
		//More likely to return a high value
		return (1 - Math.random() * Math.random()) * (max - min) + min;
	}
	 
};

module.exports = random;

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/lib/_empty.js":[function(require,module,exports){

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/decode.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/encode.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/index.js":[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/decode.js","./encode":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/encode.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/index.js":[function(require,module,exports){
var resolve = require('soundcloud-resolve')
var fonts = require('google-fonts')
var minstache = require('minstache')
var insert = require('insert-css')
var fs = require('fs')

var icons = {
    black: 'http://developers.soundcloud.com/assets/logo_black.png'
  , white: 'http://developers.soundcloud.com/assets/logo_white.png'
}

module.exports = badge
function noop(err){ if (err) throw err }

var inserted = false
var gwfadded = false
var template = null

function badge(options, callback) {
  if (!inserted) insert(".npm-scb-wrap {\n  font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;\n  font-weight: 200;\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 999;\n}\n\n.npm-scb-wrap a {\n  text-decoration: none;\n  color: #000;\n}\n.npm-scb-white\n.npm-scb-wrap a {\n  color: #fff;\n}\n\n.npm-scb-inner {\n  position: absolute;\n  top: -120px; left: 0;\n  padding: 8px;\n  width: 100%;\n  height: 150px;\n  z-index: 2;\n  -webkit-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n     -moz-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n      -ms-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n       -o-transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n          transition: width 0.5s cubic-bezier(1, 0, 0, 1), top 0.5s;\n}\n.npm-scb-wrap:hover\n.npm-scb-inner {\n  top: 0;\n}\n\n.npm-scb-artwork {\n  position: absolute;\n  top: 16px; left: 16px;\n  width: 104px; height: 104px;\n  box-shadow: 0 0 8px -3px #000;\n  outline: 1px solid rgba(0,0,0,0.1);\n  z-index: 2;\n}\n.npm-scb-white\n.npm-scb-artwork {\n  outline: 1px solid rgba(255,255,255,0.1);\n  box-shadow: 0 0 10px -2px rgba(255,255,255,0.9);\n}\n\n.npm-scb-info {\n  position: absolute;\n  top: 16px;\n  left: 120px;\n  width: 300px;\n  z-index: 1;\n}\n\n.npm-scb-info > a {\n  display: block;\n}\n\n.npm-scb-now-playing {\n  font-size: 12px;\n  line-height: 12px;\n  position: absolute;\n  width: 500px;\n  z-index: 1;\n  padding: 15px 0;\n  top: 0; left: 138px;\n  opacity: 1;\n  -webkit-transition: opacity 0.25s;\n     -moz-transition: opacity 0.25s;\n      -ms-transition: opacity 0.25s;\n       -o-transition: opacity 0.25s;\n          transition: opacity 0.25s;\n}\n\n.npm-scb-wrap:hover\n.npm-scb-now-playing {\n  opacity: 0;\n}\n\n.npm-scb-white\n.npm-scb-now-playing {\n  color: #fff;\n}\n.npm-scb-now-playing > a {\n  font-weight: bold;\n}\n\n.npm-scb-info > a > p {\n  margin: 0;\n  padding-bottom: 0.25em;\n  line-height: 1.35em;\n  margin-left: 1em;\n  font-size: 1em;\n}\n\n.npm-scb-title {\n  font-weight: bold;\n}\n\n.npm-scb-icon {\n  position: absolute;\n  top: 120px;\n  padding-top: 0.75em;\n  left: 16px;\n}\n"), inserted = true
  if (!template) template = minstache.compile("<div class=\"npm-scb-wrap\">\n  <div class=\"npm-scb-inner\">\n    <a target=\"_blank\" href=\"{{urls.song}}\">\n      <img class=\"npm-scb-icon\" src=\"{{icon}}\">\n      <img class=\"npm-scb-artwork\" src=\"{{artwork}}\">\n    </a>\n    <div class=\"npm-scb-info\">\n      <a target=\"_blank\" href=\"{{urls.song}}\">\n        <p class=\"npm-scb-title\">{{title}}</p>\n      </a>\n      <a target=\"_blank\" href=\"{{urls.artist}}\">\n        <p class=\"npm-scb-artist\">{{artist}}</p>\n      </a>\n    </div>\n  </div>\n  <div class=\"npm-scb-now-playing\">\n    Now Playing:\n    <a href=\"{{urls.song}}\">{{title}}</a>\n    by\n    <a href=\"{{urls.artist}}\">{{artist}}</a>\n  </div>\n</div>\n")

  if (!gwfadded && options.getFonts) {
    fonts.add({ 'Open Sans': [300, 600] })
    gwfadded = true
  }

  options = options || {}
  callback = callback || noop

  var div   = options.el || document.createElement('div')
  var icon  = !('dark' in options) || options.dark ? 'black' : 'white'
  var id    = options.client_id
  var song  = options.song

  resolve(id, song, function(err, json) {
    if (err) return callback(err)
    if (json.kind !== 'track') throw new Error(
      'soundcloud-badge only supports individual tracks at the moment'
    )

    div.classList[
      icon === 'black' ? 'remove' : 'add'
    ]('npm-scb-white')

    div.innerHTML = template({
        artwork: json.artwork_url || json.user.avatar_url
      , artist: json.user.username
      , title: json.title
      , icon: icons[icon]
      , urls: {
          song: json.permalink_url
        , artist: json.user.permalink_url
      }
    })

    document.body.appendChild(div)

    callback(null, json.stream_url + '?client_id=' + id, json, div)
  })

  return div
}

},{"fs":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/lib/_empty.js","google-fonts":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/google-fonts/index.js","insert-css":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/insert-css/index.js","minstache":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/minstache/index.js","soundcloud-resolve":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/google-fonts/index.js":[function(require,module,exports){
module.exports = asString
module.exports.add = append

function asString(fonts) {
  var href = getHref(fonts)
  return '<link href="' + href + '" rel="stylesheet" type="text/css">'
}

function asElement(fonts) {
  var href = getHref(fonts)
  var link = document.createElement('link')
  link.setAttribute('href', href)
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('type', 'text/css')
  return link
}

function getHref(fonts) {
  var family = Object.keys(fonts).map(function(name) {
    var details = fonts[name]
    name = name.replace(/\s+/, '+')
    return typeof details === 'boolean'
      ? name
      : name + ':' + makeArray(details).join(',')
  }).join('|')

  return 'http://fonts.googleapis.com/css?family=' + family
}

function append(fonts) {
  var link = asElement(fonts)
  document.head.appendChild(link)
  return link
}

function makeArray(arr) {
  return Array.isArray(arr) ? arr : [arr]
}

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/insert-css/index.js":[function(require,module,exports){
var inserted = [];

module.exports = function (css) {
    if (inserted.indexOf(css) >= 0) return;
    inserted.push(css);
    
    var elem = document.createElement('style');
    var text = document.createTextNode(css);
    elem.appendChild(text);
    
    if (document.head.childNodes.length) {
        document.head.insertBefore(elem, document.head.childNodes[0]);
    }
    else {
        document.head.appendChild(elem);
    }
};

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/minstache/index.js":[function(require,module,exports){

/**
 * Expose `render()`.`
 */

exports = module.exports = render;

/**
 * Expose `compile()`.
 */

exports.compile = compile;

/**
 * Render the given mustache `str` with `obj`.
 *
 * @param {String} str
 * @param {Object} obj
 * @return {String}
 * @api public
 */

function render(str, obj) {
  obj = obj || {};
  var fn = compile(str);
  return fn(obj);
}

/**
 * Compile the given `str` to a `Function`.
 *
 * @param {String} str
 * @return {Function}
 * @api public
 */

function compile(str) {
  var js = [];
  var toks = parse(str);
  var tok;

  for (var i = 0; i < toks.length; ++i) {
    tok = toks[i];
    if (i % 2 == 0) {
      js.push('"' + tok.replace(/"/g, '\\"') + '"');
    } else {
      switch (tok[0]) {
        case '/':
          tok = tok.slice(1);
          js.push(') + ');
          break;
        case '^':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + section(obj, "' + tok + '", true, ');
          break;
        case '#':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + section(obj, "' + tok + '", false, ');
          break;
        case '!':
          tok = tok.slice(1);
          assertProperty(tok);
          js.push(' + obj.' + tok + ' + ');
          break;
        default:
          assertProperty(tok);
          js.push(' + escape(obj.' + tok + ') + ');
      }
    }
  }

  js = '\n'
    + indent(escape.toString()) + ';\n\n'
    + indent(section.toString()) + ';\n\n'
    + '  return ' + js.join('').replace(/\n/g, '\\n');

  return new Function('obj', js);
}

/**
 * Assert that `prop` is a valid property.
 *
 * @param {String} prop
 * @api private
 */

function assertProperty(prop) {
  if (!prop.match(/^[\w.]+$/)) throw new Error('invalid property "' + prop + '"');
}

/**
 * Parse `str`.
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */

function parse(str) {
  return str.split(/\{\{|\}\}/);
}

/**
 * Indent `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function indent(str) {
  return str.replace(/^/gm, '  ');
}

/**
 * Section handler.
 *
 * @param {Object} context obj
 * @param {String} prop
 * @param {String} str
 * @param {Boolean} negate
 * @api private
 */

function section(obj, prop, negate, str) {
  var val = obj[prop];
  if ('function' == typeof val) return val.call(obj, str);
  if (negate) val = !val;
  if (val) return str;
  return '';
}

/**
 * Escape the given `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js":[function(require,module,exports){
var qs  = require('querystring')
var xhr = require('xhr')

module.exports = resolve

function resolve(id, goal, callback) {
  var uri = 'http://api.soundcloud.com/resolve.json?' + qs.stringify({
      url: goal
    , client_id: id
  })

  xhr({
      uri: uri
    , method: 'GET'
  }, function(err, res, body) {
    if (err) return callback(err)
    try {
      body = JSON.parse(body)
    } catch(e) {
      return callback(e)
    }
    if (body.errors) return callback(new Error(
      body.errors[0].error_message
    ))
    return callback(null, body)
  })
}

},{"querystring":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/index.js","xhr":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js":[function(require,module,exports){
var window = require("global/window")
var once = require("once")

var messages = {
    "0": "Internal XMLHttpRequest Error",
    "4": "4xx Client Error",
    "5": "5xx Server Error"
}

var XHR = window.XMLHttpRequest || noop
var XDR = "withCredentials" in (new XHR()) ?
        window.XMLHttpRequest : window.XDomainRequest

module.exports = createXHR

function createXHR(options, callback) {
    if (typeof options === "string") {
        options = { uri: options }
    }

    options = options || {}
    callback = once(callback)

    var xhr

    if (options.cors) {
        xhr = new XDR()
    } else {
        xhr = new XHR()
    }

    var uri = xhr.url = options.uri
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var isJson = false

    if ("json" in options) {
        isJson = true
        headers["Content-Type"] = "application/json"
        body = JSON.stringify(options.json)
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = load
    xhr.onerror = error
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    // hate IE
    xhr.ontimeout = noop
    xhr.open(method, uri)
    if (options.cors) {
        xhr.withCredentials = true
    }
    xhr.timeout = "timeout" in options ? options.timeout : 5000

    if ( xhr.setRequestHeader) {
        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key])
        })
    }

    xhr.send(body)

    return xhr

    function readystatechange() {
        if (xhr.readyState === 4) {
            load()
        }
    }

    function load() {
        var error = null
        var status = xhr.statusCode = xhr.status
        var body = xhr.body = xhr.response ||
            xhr.responseText || xhr.responseXML

        if (status === 0 || (status >= 400 && status < 600)) {
            var message = xhr.responseText ||
                messages[String(xhr.status).charAt(0)]
            error = new Error(message)

            error.statusCode = xhr.status
        }

        if (isJson) {
            try {
                body = xhr.body = JSON.parse(body)
            } catch (e) {}
        }

        callback(error, xhr, body)
    }

    function error(evt) {
        callback(evt, xhr)
    }
}


function noop() {}

},{"global/window":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js","once":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js":[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window
} else if (typeof global !== "undefined") {
    module.exports = global
} else {
    module.exports = {}
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js":[function(require,module,exports){
module.exports = once

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js":[function(require,module,exports){
//     Underscore.js 1.7.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.7.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var createCallback = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  _.iteratee = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return createCallback(value, context, argCount);
    if (_.isObject(value)) return _.matches(value);
    return _.property(value);
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    if (obj == null) return obj;
    iteratee = createCallback(iteratee, context);
    var i, length = obj.length;
    if (length === +length) {
      for (i = 0; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    if (obj == null) return [];
    iteratee = _.iteratee(iteratee, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length),
        currentKey;
    for (var index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index = 0, currentKey;
    if (arguments.length < 3) {
      if (!length) throw new TypeError(reduceError);
      memo = obj[keys ? keys[index++] : index++];
    }
    for (; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = function(obj, iteratee, memo, context) {
    if (obj == null) obj = [];
    iteratee = createCallback(iteratee, context, 4);
    var keys = obj.length !== + obj.length && _.keys(obj),
        index = (keys || obj).length,
        currentKey;
    if (arguments.length < 3) {
      if (!index) throw new TypeError(reduceError);
      memo = obj[keys ? keys[--index] : --index];
    }
    while (index--) {
      currentKey = keys ? keys[index] : index;
      memo = iteratee(memo, obj[currentKey], currentKey, obj);
    }
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    predicate = _.iteratee(predicate, context);
    _.some(obj, function(value, index, list) {
      if (predicate(value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    predicate = _.iteratee(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(_.iteratee(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    if (obj == null) return true;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    if (obj == null) return false;
    predicate = _.iteratee(predicate, context);
    var keys = obj.length !== +obj.length && _.keys(obj),
        length = (keys || obj).length,
        index, currentKey;
    for (index = 0; index < length; index++) {
      currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (obj.length !== +obj.length) obj = _.values(obj);
    return _.indexOf(obj, target) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = obj.length === +obj.length ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = obj && obj.length === +obj.length ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = _.iteratee(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = _.iteratee(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = low + high >>> 1;
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return obj.length === +obj.length ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = _.iteratee(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    for (var i = 0, length = input.length; i < length; i++) {
      var value = input[i];
      if (!_.isArray(value) && !_.isArguments(value)) {
        if (!strict) output.push(value);
      } else if (shallow) {
        push.apply(output, value);
      } else {
        flatten(value, shallow, strict, output);
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = _.iteratee(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i];
      if (isSorted) {
        if (!i || seen !== value) result.push(value);
        seen = value;
      } else if (iteratee) {
        var computed = iteratee(value, i, array);
        if (_.indexOf(seen, computed) < 0) {
          seen.push(computed);
          result.push(value);
        }
      } else if (_.indexOf(result, value) < 0) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true, []));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(slice.call(arguments, 1), true, true, []);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function(array) {
    if (array == null) return [];
    var length = _.max(arguments, 'length').length;
    var results = Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var idx = array.length;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var Ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    args = slice.call(arguments, 2);
    bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      Ctor.prototype = func.prototype;
      var self = new Ctor;
      Ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (_.isObject(result)) return result;
      return self;
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = hasher ? hasher.apply(this, arguments) : key;
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last > 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed before being called N times.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      } else {
        func = null;
      }
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    if (!_.isObject(obj)) return obj;
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj, iteratee, context) {
    var result = {}, key;
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      iteratee = createCallback(iteratee, context);
      for (key in obj) {
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
    } else {
      var keys = concat.apply([], slice.call(arguments, 1));
      obj = new Object(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];
        if (key in obj) result[key] = obj[key];
      }
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(concat.apply([], slice.call(arguments, 1)), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    if (!_.isObject(obj)) return obj;
    for (var i = 1, length = arguments.length; i < length; i++) {
      var source = arguments[i];
      for (var prop in source) {
        if (obj[prop] === void 0) obj[prop] = source[prop];
      }
    }
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (
      aCtor !== bCtor &&
      // Handle Object.create(x) cases
      'constructor' in a && 'constructor' in b &&
      !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
        _.isFunction(bCtor) && bCtor instanceof bCtor)
    ) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size, result;
    // Recursively compare objects and arrays.
    if (className === '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size === b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      size = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      result = _.keys(b).length === size;
      if (result) {
        while (size--) {
          // Deep compare each member
          key = keys[size];
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj) || _.isArguments(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around an IE 11 bug.
  if (typeof /./ !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    var pairs = _.pairs(attrs), length = pairs.length;
    return function(obj) {
      if (obj == null) return !length;
      obj = new Object(obj);
      for (var i = 0; i < length; i++) {
        var pair = pairs[i], key = pair[0];
        if (pair[1] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = createCallback(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? object[property]() : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}]},{},["./js/Main.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2pzL01haW4uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9Db21wb25lbnRzL0hpZC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL0xldmVsTG9hZGVyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvUG9lbS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL1NoaXAuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL0NhbWVyYS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvQ2FtZXJhSW50cm8uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL0N5bGluZGVyTGluZXMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL0RhbWFnZS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvU2NvcmluZ0FuZFdpbm5pbmcuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL1N0YXJzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvY29tcG9uZW50cy9UaXRsZXMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9Bc3Rlcm9pZC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2VudGl0aWVzL0J1bGxldC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2VudGl0aWVzL0plbGx5U2hpcC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2xldmVscy9hc3Rlcm9pZHNKZWxsaWVzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL2ludHJvLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL3RpdGxlcy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL21hbmFnZXJzL0FzdGVyb2lkRmllbGQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbWFuYWdlcnMvR3VuLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvc291bmQvTXVzaWMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9zb3VuZC9Tb3VuZEdlbmVyYXRvci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL0Nsb2NrLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvQ29sbGlkZXIuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9Db29yZGluYXRlcy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL1N0YXRzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvcmFuZG9tLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbGliL19lbXB0eS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvZGVjb2RlLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9lbmNvZGUuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2UvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvZ29vZ2xlLWZvbnRzL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL2luc2VydC1jc3MvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvbWluc3RhY2hlL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9icm93c2VyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9vbmNlL29uY2UuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvdW5kZXJzY29yZS91bmRlcnNjb3JlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgTGV2ZWxMb2FkZXIgPSByZXF1aXJlKCcuL0xldmVsTG9hZGVyJyk7XG5cbiQoZnVuY3Rpb24oKSB7XG5cdExldmVsTG9hZGVyKFwidGl0bGVzXCIpO1xuXHQvLyBMZXZlbExvYWRlcihcImludHJvXCIpO1xufSk7IiwidmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xuXG53aW5kb3cuSElEdHlwZSA9IFwia2V5c1wiO1xuXG52YXIgSElEID0gZnVuY3Rpb24oIHBvZW0gKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHZhciBzdGF0ZXMgPSB7XG5cdFx0dXA6IGZhbHNlLFxuXHRcdGRvd246IGZhbHNlLFxuXHRcdGxlZnQ6IGZhbHNlLFxuXHRcdHJpZ2h0OiBmYWxzZSxcblx0XHRzcGFjZWJhcjogZmFsc2Vcblx0fTtcblx0XG5cdHRoaXMua2V5Q29kZXMgPSB7XG5cdFx0XCJrMzhcIiA6IFwidXBcIixcblx0XHRcIms0MFwiIDogXCJkb3duXCIsXG5cdFx0XCJrMzdcIiA6IFwibGVmdFwiLFxuXHRcdFwiazM5XCIgOiBcInJpZ2h0XCIsXG5cdFx0XCJrMzJcIiA6IFwic3BhY2ViYXJcIlxuXHR9O1xuXHRcblx0dGhpcy50aWx0ID0ge1xuXHRcdHg6IDAsXG5cdFx0eTogMFxuXHR9O1xuXHR0aGlzLnByZXNzZWQgPSBfLmNsb25lKHN0YXRlcyk7XG5cdHRoaXMuZG93biA9IF8uY2xvbmUoc3RhdGVzKTtcblx0dGhpcy51cCA9IF8uY2xvbmUoc3RhdGVzKTtcblx0XG5cdGlmKCB3aW5kb3cuSElEdHlwZSA9PT0gXCJrZXlzXCIgKSB7XG5cdFx0dGhpcy5zZXRLZXlIYW5kbGVycygpO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuc2V0VGlsdEhhbmRsZXJzKCk7XG5cdH1cblx0XG59O1xuXG5ISUQucHJvdG90eXBlID0ge1xuXHRcblx0c2V0S2V5SGFuZGxlcnMgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHQkKHdpbmRvdykub24oICdrZXlkb3duLkhJRCcsIHRoaXMua2V5ZG93bi5iaW5kKHRoaXMpICk7XG5cdFx0JCh3aW5kb3cpLm9uKCAna2V5dXAuSElEJywgdGhpcy5rZXl1cC5iaW5kKHRoaXMpICk7XG5cdFxuXHRcdHRoaXMucG9lbS5vbiggXCJkZXN0cm95XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JCh3aW5kb3cpLm9mZiggJ2tleWRvd24uSElEJyApO1xuXHRcdFx0JCh3aW5kb3cpLm9mZiggJ2tleXVwLkhJRCcgKTtcblx0XHR9KTtcblx0XHRcblx0fSxcblx0XG5cdHNldFRpbHRIYW5kbGVycyA6IGZ1bmN0aW9uKCkge1xuXG5cblx0XHQkKHdpbmRvdykub24oICdkZXZpY2VvcmllbnRhdGlvbi5ISUQnLCB0aGlzLmhhbmRsZVRpbHQuYmluZCh0aGlzKSApO1xuXHRcdC8vIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VvcmllbnRhdGlvbicsIHRoaXMuaGFuZGxlVGlsdC5iaW5kKHRoaXMpLCBmYWxzZSk7XG5cdFx0XG5cdFx0JChcImNhbnZhc1wiKS5vbiggJ3RvdWNoc3RhcnQuSElEJywgdGhpcy5oYW5kbGVUb3VjaFN0YXJ0LmJpbmQodGhpcykgKTtcblx0XHQkKFwiY2FudmFzXCIpLm9uKCAndG91Y2hlbmQuSElEJywgdGhpcy5oYW5kbGVUb3VjaEVuZC5iaW5kKHRoaXMpICk7XG5cblx0XHR0aGlzLnBvZW0ub24oIFwiZGVzdHJveVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdCQod2luZG93KS5vZmYoICdkZXZpY2VvcmllbnRhdGlvbi5ISUQnICk7XG5cdFx0XHQkKFwiY2FudmFzXCIpLm9mZiggJ3RvdWNoc3RhcnQuSElEJyApO1xuXHRcdFx0JChcImNhbnZhc1wiKS5vZmYoICd0b3VjaGVuZC5ISUQnICk7XG5cdFx0fSk7XG5cdFx0XG5cdH0sXG5cdFxuXHR0eXBlIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5ISUR0eXBlO1xuXHR9LFxuXHRcblx0c2V0S2V5cyA6IGZ1bmN0aW9uKCkge1xuXHRcdHdpbmRvdy5ISUR0eXBlID0gXCJrZXlzXCI7XG5cdH0sXG5cdFxuXHRzZXRUaWx0IDogZnVuY3Rpb24oKSB7XG5cdFx0d2luZG93LkhJRHR5cGUgPSBcInRpbHRcIjtcdFx0XG5cdH0sXG5cdFxuXHRrZXlkb3duIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMuZG93bltjb2RlXSA9IHRydWU7XG5cdFx0XHR0aGlzLnByZXNzZWRbY29kZV0gPSB0cnVlO1xuXHRcdH1cblx0fSxcblx0XG5cdGtleXVwIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMucHJlc3NlZFtjb2RlXSA9IGZhbHNlO1xuXHRcdFx0dGhpcy51cFtjb2RlXSA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0aGFuZGxlVGlsdCA6IGZ1bmN0aW9uKGUpIHtcblx0XHRcblx0XHR2YXIgZXZlbnQsIG9yaWVudGF0aW9uLCBhbmdsZTtcblx0XHRcblx0XHRldmVudCA9IGUub3JpZ2luYWxFdmVudDtcblx0XHRvcmllbnRhdGlvbiA9IHdpbmRvdy5vcmllbnRhdGlvbiB8fCBzY3JlZW4ub3JpZW50YXRpb247XG5cdFx0XG5cdFx0aWYoXy5pc09iamVjdCggc2NyZWVuLm9yaWVudGF0aW9uICkgKSB7XG5cdFx0XHRhbmdsZSA9IHNjcmVlbi5vcmllbnRhdGlvbi5hbmdsZTtcblx0XHR9IGVsc2UgaWYgKCBfLmlzTnVtYmVyKCB3aW5kb3cub3JpZW50YXRpb24gKSApIHtcblx0XHRcdGFuZ2xlID0gd2luZG93Lm9yaWVudGF0aW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbmdsZSA9IDA7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKGFuZ2xlID09PSAwKSB7XG5cdFx0XHR0aGlzLnRpbHQgPSB7XG5cdFx0XHRcdHg6IGV2ZW50LmdhbW1hLFxuXHRcdFx0XHR5OiBldmVudC5iZXRhICogLTFcblx0XHRcdH07XG5cdFx0fSBlbHNlIGlmIChhbmdsZSA+IDApIHtcblx0XHRcdHRoaXMudGlsdCA9IHtcblx0XHRcdFx0eDogZXZlbnQuYmV0YSxcblx0XHRcdFx0eTogZXZlbnQuZ2FtbWFcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudGlsdCA9IHtcblx0XHRcdFx0eDogZXZlbnQuYmV0YSAqIC0xLFxuXHRcdFx0XHR5OiBldmVudC5nYW1tYSAqIC0xXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGhhbmRsZVRvdWNoU3RhcnQgOiBmdW5jdGlvbihlKSB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHRoaXMucHJlc3NlZC5zcGFjZWJhciA9IHRydWU7XG5cdH0sXG5cdFxuXHRoYW5kbGVUb3VjaEVuZCA6IGZ1bmN0aW9uKGUpIHtcblx0XHR2YXIgdG91Y2hlcyA9IGUub3JpZ2luYWxFdmVudC50b3VjaGVzO1xuXHRcdHRoaXMucHJlc3NlZC5zcGFjZWJhciA9ICh0b3VjaGVzLmxlbmd0aCAhPT0gMCk7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZmFsc2lmeSA9IGZ1bmN0aW9uICh2YWx1ZSwga2V5LCBsaXN0KSB7XG5cdFx0XHRsaXN0W2tleV0gPSBmYWxzZTtcblx0XHR9O1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdF8uZWFjaCggdGhpcy5kb3duLCBmYWxzaWZ5ICk7XG5cdFx0XHRfLmVhY2goIHRoaXMudXAsIGZhbHNpZnkgKTtcblx0XHR9O1xuXHRcdFxuXHR9KClcblx0XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBISUQucHJvdG90eXBlICk7XG5cbm1vZHVsZS5leHBvcnRzID0gSElEO1xuIiwidmFyIFBvZW0gPSByZXF1aXJlKCcuL1BvZW0nKTtcbnZhciBsZXZlbHMgPSByZXF1aXJlKCcuL2xldmVscycpO1xuXG52YXIgY3VycmVudExldmVsID0gbnVsbDtcbnZhciBjdXJyZW50UG9lbSA9IG51bGw7XG5cbndpbmRvdy5MZXZlbExvYWRlciA9IGZ1bmN0aW9uKCBuYW1lICkge1xuXHRcblx0Ly9UcmFjayB0aGlzLCBidXQgZXhjbHVkZSBmaXJzdCBsb2FkXG5cdGlmKCBjdXJyZW50TGV2ZWwgKSB7XG5cdFx0X2dhcS5wdXNoKFsnX3RyYWNrUGFnZXZpZXcnLCAnL3BvbGFyLycrbmFtZV0pO1xuXHR9XG5cdFxuXHRpZihjdXJyZW50UG9lbSkgY3VycmVudFBvZW0uZGVzdHJveSgpO1xuXHRcblx0Y3VycmVudExldmVsID0gbGV2ZWxzW25hbWVdO1xuXHRjdXJyZW50UG9lbSA9IG5ldyBQb2VtKCBjdXJyZW50TGV2ZWwgKTtcblx0d2luZG93LnBvZW0gPSBjdXJyZW50UG9lbTtcblx0XG59O1xuXHRcbm1vZHVsZS5leHBvcnRzID0gTGV2ZWxMb2FkZXI7IiwidmFyIENvb3JkaW5hdGVzID0gcmVxdWlyZSgnLi91dGlscy9Db29yZGluYXRlcycpO1xudmFyIENhbWVyYSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9DYW1lcmEnKTtcbnZhciBHdW4gPSByZXF1aXJlKCcuL21hbmFnZXJzL0d1bicpO1xudmFyIFNoaXAgPSByZXF1aXJlKCcuL1NoaXAnKTtcbnZhciBTdGFycyA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9TdGFycycpO1xudmFyIEFzdGVyb2lkRmllbGQgPSByZXF1aXJlKCcuL21hbmFnZXJzL0FzdGVyb2lkRmllbGQnKTtcbnZhciBTdGF0cyA9IHJlcXVpcmUoJy4vdXRpbHMvU3RhdHMnKTtcbnZhciBFdmVudERpc3BhdGNoZXIgPSByZXF1aXJlKCcuL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xudmFyIEplbGx5U2hpcCA9IHJlcXVpcmUoJy4vZW50aXRpZXMvSmVsbHlTaGlwJyk7XG52YXIgRW50aXR5TWFuYWdlciA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvRW50aXR5TWFuYWdlcicpO1xudmFyIFNjb3JpbmdBbmRXaW5uaW5nID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL1Njb3JpbmdBbmRXaW5uaW5nJyk7XG52YXIgQ2xvY2sgPSByZXF1aXJlKCcuL3V0aWxzL0Nsb2NrJyk7XG5cbnZhciByZW5kZXJlcjtcblxudmFyIFBvZW0gPSBmdW5jdGlvbiggbGV2ZWwgKSB7XG5cblx0dGhpcy5jaXJjdW1mZXJlbmNlID0gbGV2ZWwuY29uZmlnLmNpcmN1bWZlcmVuY2UgfHwgNzUwO1xuXHR0aGlzLmhlaWdodCA9IGxldmVsLmNvbmZpZy5oZWlnaHQgfHwgMTIwO1xuXHR0aGlzLnIgPSBsZXZlbC5jb25maWcuciB8fCAyNDA7XG5cdHRoaXMuY2lyY3VtZmVyZW5jZVJhdGlvID0gKDIgKiBNYXRoLlBJKSAvIHRoaXMuY2lyY3VtZmVyZW5jZTsgLy9NYXAgMmQgWCBjb29yZGluYXRlcyB0byBwb2xhciBjb29yZGluYXRlc1xuXHR0aGlzLnJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gPj0gMSA/IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIDogMTtcblx0XG5cdHRoaXMuY29udHJvbHMgPSB1bmRlZmluZWQ7XG5cdHRoaXMuZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjb250YWluZXInICk7XG5cdHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcblx0dGhpcy5yZXF1ZXN0ZWRGcmFtZSA9IHVuZGVmaW5lZDtcblxuXHR0aGlzLmNsb2NrID0gbmV3IENsb2NrKCk7XG5cdHRoaXMuY29vcmRpbmF0ZXMgPSBuZXcgQ29vcmRpbmF0ZXMoIHRoaXMgKTtcblx0dGhpcy5jYW1lcmEgPSBuZXcgQ2FtZXJhKCB0aGlzLCBsZXZlbC5jb25maWcgKTtcblx0dGhpcy5zY2VuZS5mb2cgPSBuZXcgVEhSRUUuRm9nKCAweDIyMjIyMiwgdGhpcy5jYW1lcmEub2JqZWN0LnBvc2l0aW9uLnogLyAyLCB0aGlzLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueiAqIDIgKTtcblx0XG5cdHRoaXMuZ3VuID0gbmV3IEd1biggdGhpcyApO1xuXHR0aGlzLnNoaXAgPSBuZXcgU2hpcCggdGhpcyApO1xuXHR0aGlzLnN0YXJzID0gbmV3IFN0YXJzKCB0aGlzLCBsZXZlbC5jb25maWcuc3RhcnMgKTtcblx0dGhpcy5zY29yaW5nQW5kV2lubmluZyA9IG5ldyBTY29yaW5nQW5kV2lubmluZyggdGhpcywgbGV2ZWwuY29uZmlnLnNjb3JpbmdBbmRXaW5uaW5nICk7XG5cdFxuXHR0aGlzLnBhcnNlTGV2ZWwoIGxldmVsICk7XG5cdFxuXHR0aGlzLmRpc3BhdGNoKHtcblx0XHR0eXBlOiAnbGV2ZWxQYXJzZWQnXG5cdH0pO1xuXHRcblx0aWYoIXJlbmRlcmVyKSB7XG5cdFx0dGhpcy5hZGRSZW5kZXJlcigpO1xuXHR9XG4vL1x0dGhpcy5hZGRTdGF0cygpO1xuXHR0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG5cdFxuXHR0aGlzLmxvb3AoKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvZW07XG5cblBvZW0ucHJvdG90eXBlID0ge1xuXHRcblx0cGFyc2VMZXZlbCA6IGZ1bmN0aW9uKCBsZXZlbCApIHtcblx0XHRfLmVhY2goIGxldmVsLm9iamVjdHMsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5ICkge1xuXHRcdFx0aWYoXy5pc09iamVjdCggdmFsdWUgKSkge1xuXHRcdFx0XHR0aGlzWyBrZXkgXSA9IG5ldyB2YWx1ZS5vYmplY3QoIHRoaXMsIHZhbHVlLnByb3BlcnRpZXMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXNbIGtleSBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0fSxcblx0XG5cdGFkZFJlbmRlcmVyIDogZnVuY3Rpb24oKSB7XG5cdFx0cmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7XG5cdFx0XHRhbHBoYSA6IHRydWVcblx0XHR9KTtcblx0XHRyZW5kZXJlci5zZXRTaXplKCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XG5cdFx0dGhpcy5kaXYuYXBwZW5kQ2hpbGQoIHJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblx0fSxcblx0XG5cdGFkZFN0YXRzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zdGF0cyA9IG5ldyBTdGF0cygpO1xuXHRcdHRoaXMuc3RhdHMuZG9tRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnRvcCA9ICcwcHgnO1xuXHRcdCQoXCIjY29udGFpbmVyXCIpLmFwcGVuZCggdGhpcy5zdGF0cy5kb21FbGVtZW50ICk7XG5cdH0sXG5cdFx0XG5cdGFkZEV2ZW50TGlzdGVuZXJzIDogZnVuY3Rpb24oKSB7XG5cdFx0JCh3aW5kb3cpLm9uKCdyZXNpemUnLCB0aGlzLnJlc2l6ZUhhbmRsZXIuYmluZCh0aGlzKSk7XG5cdH0sXG5cdFxuXHRyZXNpemVIYW5kbGVyIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jYW1lcmEucmVzaXplKCk7XG5cdFx0cmVuZGVyZXIuc2V0U2l6ZSggd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCApO1xuXG5cdH0sXG5cdFx0XHRcblx0bG9vcCA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dGhpcy5yZXF1ZXN0ZWRGcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSggdGhpcy5sb29wLmJpbmQodGhpcykgKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdH0sXG5cdFx0XHRcblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Ly8gdGhpcy5zdGF0cy51cGRhdGUoKTtcblx0XHRcblx0XHR0aGlzLmRpc3BhdGNoKHtcblx0XHRcdHR5cGU6IFwidXBkYXRlXCIsXG5cdFx0XHRkdDogdGhpcy5jbG9jay5nZXREZWx0YSgpLFxuXHRcdFx0dGltZTogdGhpcy5jbG9jay50aW1lXG5cdFx0fSk7XG5cdFx0XG5cdFx0cmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYS5vYmplY3QgKTtcblxuXHR9LFxuXHRcblx0ZGVzdHJveSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggdGhpcy5yZXF1ZXN0ZWRGcmFtZSApO1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2goe1xuXHRcdFx0dHlwZTogXCJkZXN0cm95XCJcblx0XHR9KTtcblx0fVxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggUG9lbS5wcm90b3R5cGUgKTsiLCJ2YXIgSElEID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0hpZCcpO1xudmFyIERhbWFnZSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9EYW1hZ2UnKTtcblxudmFyIFNoaXAgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuc2NlbmUgPSBwb2VtLnNjZW5lO1xuXHR0aGlzLnBvbGFyT2JqID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdHRoaXMub2JqZWN0ID0gbnVsbDtcblx0dGhpcy5oaWQgPSBuZXcgSElEKCB0aGlzLnBvZW0gKTtcblx0dGhpcy5jb2xvciA9IDB4NEE5REU3O1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMucmFkaXVzID0gMztcblx0XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHRcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cdHRoaXMubGl2ZXMgPSAzO1xuXHR0aGlzLmludnVsbmVyYWJsZSA9IHRydWU7XG5cdHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoID0gMzAwMDtcblx0dGhpcy5pbnZ1bG5lcmFibGVUaW1lID0gMCArIHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoO1xuXHR0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wID0gZmFsc2U7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BMZW5ndGggPSAxMDA7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BUaW1lID0gMDtcblx0XG5cdHRoaXMuc3BlZWQgPSAwO1xuXHRcblx0dGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkID0gMC4wNDtcblx0dGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQgPSAwLjAwMTtcblx0XG5cdHRoaXMudGhydXN0U3BlZWQgPSAwLjAwMTtcblx0dGhpcy50aHJ1c3QgPSAwO1xuXHRcblx0dGhpcy5iYW5rU3BlZWQgPSAwLjA2O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gNTAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuZGFtYWdlID0gbmV3IERhbWFnZSh0aGlzLnBvZW0sIHRoaXMpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpICk7XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaGlwO1xuXG5TaGlwLnByb3RvdHlwZSA9IHtcblx0XG5cdGNyZWF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKSxcblx0XHRcblx0XHR2ZXJ0cyA9IFtbNTAsMzYuOV0sIFszOS44LDU5LjZdLCBbNDcuMSw1My45XSwgWzUwLDU3LjVdLCBbNTMsNTMuOV0sIFs2MC4yLDU5LjZdLCBbNTAsMzYuOV1dO1xuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFx0XG5cdFx0XHRyZXR1cm4gW21lbW9bMF0gKyB2ZXJ0MmRbMF0sIG1lbW9bMV0gKyB2ZXJ0MmRbMV1dO1xuXHRcdFx0XG5cdFx0fSwgWzAsMF0pO1xuXHRcdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0Z2VvbWV0cnkudmVydGljZXMgPSBfLm1hcCggdmVydHMsIGZ1bmN0aW9uKCB2ZWMyICkge1xuXHRcdFx0dmFyIHNjYWxlID0gMSAvIDQ7XG5cdFx0XHRyZXR1cm4gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0XHRcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeSgpO1xuXHRcdFx0XHRcblx0XHRsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aFxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLkxpbmUoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdGxpbmVNYXRlcmlhbCxcblx0XHRcdFRIUkVFLkxpbmVTdHJpcFxuXHRcdCk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueiArPSB0aGlzLnBvZW0ucjtcblx0XHRcblx0XHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0dGhpcy5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0fSxcblx0XG5cdGRpc2FibGUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmRlYWQgPSB0cnVlO1xuXHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSBmYWxzZTtcblx0fSxcblx0XG5cdGtpbGwgOiBmdW5jdGlvbiggZm9yY2UgKSB7XG5cblx0XHRpZiggIWZvcmNlICYmICF0aGlzLmRlYWQgJiYgIXRoaXMuaW52dWxuZXJhYmxlICkge1xuXHRcdFx0dGhpcy5kZWFkID0gdHJ1ZTtcblx0XHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSBmYWxzZTtcblx0XHRcdFxuXHRcdFx0dGhpcy5kYW1hZ2UuZXhwbG9kZSgpO1xuXHRcdFx0XG5cdFx0XHR2YXIgbG9zdFBvaW50cyA9IE1hdGguY2VpbCggdGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLnNjb3JlIC8gLTIgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdFNjb3JlKFxuXHRcdFx0XHRsb3N0UG9pbnRzLFxuXHRcdFx0XHRsb3N0UG9pbnRzICsgXCIgcG9pbnRzXCIsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRcImZvbnQtc2l6ZVwiIDogXCIyZW1cIixcblx0XHRcdFx0XHRcImNvbG9yXCI6IFwicmVkXCJcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcblx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0XHRcdHRoaXMuZGVhZCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlVGltZSA9IHRoaXMucG9lbS5jbG9jay50aW1lICsgdGhpcy5pbnZ1bG5lcmFibGVMZW5ndGg7XG5cdFx0XHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0XG5cdFx0XHR9LmJpbmQodGhpcyksIDIwMDApO1xuXHRcdH1cblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi54ID0gMDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgPSAwO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFx0XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZVRocnVzdEFuZEJhbmsoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlRWRnZUF2b2lkYW5jZSggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVGaXJpbmcoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlSW52dWxuZXJhYmlsaXR5KCBlICk7XG5cdFx0XHRcblx0XHR9XG5cdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cdFx0dGhpcy5oaWQudXBkYXRlKCBlICk7XG5cblx0fSxcblx0XG5cdHVwZGF0ZUludnVsbmVyYWJpbGl0eSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdGlmKCB0aGlzLmludnVsbmVyYWJsZSApIHtcblx0XHRcdFxuXHRcdFx0aWYoIGUudGltZSA8IHRoaXMuaW52dWxuZXJhYmxlVGltZSApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggZS50aW1lID4gdGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcFRpbWUgKSB7XG5cblx0XHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wVGltZSA9IGUudGltZSArIHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BMZW5ndGg7XG5cdFx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcCA9ICF0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wO1x0XG5cdFx0XHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3A7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGUgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZVRocnVzdEFuZEJhbmsgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR2YXIgcHJlc3NlZCwgdGlsdCwgdGhldGEsIHRoZXRhRGlmZjtcblx0XHRcblx0XHR0aGlzLmJhbmsgKj0gMC45O1xuXHRcdHRoaXMudGhydXN0ID0gMDtcblx0XHRcblx0XHRpZiggdGhpcy5oaWQudHlwZSgpID09PSBcImtleXNcIiApIHtcblx0XHRcdFxuXHRcdFx0cHJlc3NlZCA9IHRoaXMuaGlkLnByZXNzZWQ7XG5cdFx0XG5cdFx0XHRpZiggcHJlc3NlZC51cCApIHtcblx0XHRcdFx0dGhpcy50aHJ1c3QgKz0gdGhpcy50aHJ1c3RTcGVlZCAqIGUuZHQ7XG5cdFx0XHR9XG5cdFx0XG5cdFx0XHRpZiggcHJlc3NlZC5kb3duICkge1xuXHRcdFx0XHR0aGlzLnRocnVzdCAtPSB0aGlzLnRocnVzdFNwZWVkICogZS5kdDtcdFxuXHRcdFx0fVxuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQubGVmdCApIHtcblx0XHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQ7XG5cdFx0XHR9XG5cdFx0XG5cdFx0XHRpZiggcHJlc3NlZC5yaWdodCApIHtcblx0XHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQgKiAtMTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aWx0ID0gdGhpcy5oaWQudGlsdDtcblx0XHRcdFxuXHRcdFx0dmFyIGRpc3RhbmNlID0gTWF0aC5zcXJ0KHRpbHQueCAqIHRpbHQueCArIHRpbHQueSAqIHRpbHQueSk7XG5cdFx0XG5cdFx0XHR0aGlzLnRocnVzdCA9IE1hdGgubWluKCAwLjAwMTEsIGRpc3RhbmNlIC8gMTAwMDAgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy50aHJ1c3QgKj0gZS5kdDtcblx0XHRcdFxuXHRcdFx0dGhldGEgPSBNYXRoLmF0YW4yKCB0aWx0LnksIHRpbHQueCApO1xuXHRcdFx0dGhldGFEaWZmID0gKHRoZXRhIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueikgJSAoMiAqIE1hdGguUEkpO1xuXHRcdFx0XG5cdFx0XHRpZiggdGhldGFEaWZmID4gTWF0aC5QSSApIHtcblx0XHRcdFx0dGhldGFEaWZmIC09IDIgKiBNYXRoLlBJO1xuXHRcdFx0fSBlbHNlIGlmICggdGhldGFEaWZmIDwgLU1hdGguUEkgKSB7XG5cdFx0XHRcdHRoZXRhRGlmZiArPSAyICogTWF0aC5QSTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dGhpcy5iYW5rID0gdGhldGFEaWZmICogZGlzdGFuY2UgLyAyNTAwICogZS5kdDtcblx0XHRcdFxuXHRcdFx0XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlRWRnZUF2b2lkYW5jZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHZhciBuZWFyRWRnZSwgZmFyRWRnZSwgcG9zaXRpb24sIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24sIGJhbmtEaXJlY3Rpb24sIGFic1Bvc2l0aW9uO1xuXHRcdFxuXHRcdGZhckVkZ2UgPSB0aGlzLnBvZW0uaGVpZ2h0IC8gMjtcblx0XHRuZWFyRWRnZSA9IDQgLyA1ICogZmFyRWRnZTtcblx0XHRwb3NpdGlvbiA9IHRoaXMub2JqZWN0LnBvc2l0aW9uLnk7XG5cdFx0YWJzUG9zaXRpb24gPSBNYXRoLmFicyggcG9zaXRpb24gKTtcblxuXHRcdHZhciByb3RhdGlvbiA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogLyBNYXRoLlBJO1xuXG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiAlPSAyICogTWF0aC5QSTtcblx0XHRcblx0XHRpZiggdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IDAgKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IDIgKiBNYXRoLlBJO1xuXHRcdH1cblx0XHRcblx0XHRpZiggTWF0aC5hYnMoIHBvc2l0aW9uICkgPiBuZWFyRWRnZSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGlzUG9pbnRpbmdMZWZ0ID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiA+PSBNYXRoLlBJICogMC41ICYmIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCBNYXRoLlBJICogMS41O1xuXHRcdFx0XG5cdFx0XHRpZiggcG9zaXRpb24gPiAwICkge1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRub3JtYWxpemVkRWRnZVBvc2l0aW9uID0gKGFic1Bvc2l0aW9uIC0gbmVhckVkZ2UpIC8gKGZhckVkZ2UgLSBuZWFyRWRnZSk7XG5cdFx0XHR0aGlzLnRocnVzdCArPSBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQ7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IGJhbmtEaXJlY3Rpb24gKiBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkO1xuXHRcdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlRmlyaW5nIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0aWYoIHRoaXMuaGlkLnByZXNzZWQuc3BhY2ViYXIgKSB7XG5cdFx0XHR0aGlzLnBvZW0uZ3VuLmZpcmUoIHRoaXMucG9zaXRpb24ueCwgdGhpcy5wb3NpdGlvbi55LCAyLCB0aGlzLm9iamVjdC5yb3RhdGlvbi56ICk7XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgbW92ZW1lbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRcdHZhciB0aGV0YSwgeCwgeTtcblx0XHRcdFxuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLmJhbms7XG5cdFx0XHRcblx0XHRcdHRoZXRhID0gdGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XHRcdFxuXHRcdFx0dGhpcy5zcGVlZCAqPSAwLjk4O1xuXHRcdFx0dGhpcy5zcGVlZCArPSB0aGlzLnRocnVzdDtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1pbiggdGhpcy5tYXhTcGVlZCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWF4KCAwLCB0aGlzLnNwZWVkICk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnkgKz0gdGhpcy5zcGVlZCAqIE1hdGguc2luKCB0aGV0YSApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb3NpdGlvbi55O1xuXHRcdFx0XG5cdFx0XHQvL1BvbGFyIGNvb3JkaW5hdGVzXG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFx0XG5cdFx0fTtcblx0XHRcblx0fSgpXG5cdFxuXHRcbn07IiwidmFyIENhbWVyYSA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XG5cdHRoaXMuc3BlZWQgPSAwLjAzMjtcblx0XG5cdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLlBlcnNwZWN0aXZlQ2FtZXJhKFxuXHRcdDUwLFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZm92XG5cdFx0d2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsXHQvLyBhc3BlY3QgcmF0aW9cblx0XHQzLFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gbmVhciBmcnVzdHVtXG5cdFx0MTAwMFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZhciBmcnVzdHVtXG5cdCk7XG5cdFxuXHR2YXIgbXVsdGlwbGllciA9IHByb3BlcnRpZXMuY2FtZXJhTXVsdGlwbGllciA/IHByb3BlcnRpZXMuY2FtZXJhTXVsdGlwbGllciA6IDEuNTtcblx0dGhpcy5vYmplY3QucG9zaXRpb24ueiA9IHRoaXMucG9lbS5yICogbXVsdGlwbGllcjtcblx0XG5cdHRoaXMucG9sYXJPYmouYWRkKCB0aGlzLm9iamVjdCApO1xuXHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLnBvbGFyT2JqICk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FtZXJhO1xuXG5DYW1lcmEucHJvdG90eXBlID0ge1xuXHRcblx0cmVzaXplIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5vYmplY3QuYXNwZWN0ID0gd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cdFx0dGhpcy5vYmplY3QudXBkYXRlUHJvamVjdGlvbk1hdHJpeCgpO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dmFyIHRoaXNUaGV0YSA9IHRoaXMucG9sYXJPYmoucm90YXRpb24ueTtcblx0XHR2YXIgdGhhdFRoZXRhID0gdGhpcy5wb2VtLnNoaXAucG9sYXJPYmoucm90YXRpb24ueTtcblx0XHR2YXIgdGhldGFEaWZmID0gTWF0aC5hYnModGhpc1RoZXRhIC0gdGhhdFRoZXRhKTtcblx0XHRcblx0XHQvLyBpZiggdGhldGFEaWZmID4gMC4yICkge1xuXHRcdFxuXHRcdFx0dGhpcy5wb2xhck9iai5yb3RhdGlvbi55ID1cblx0XHRcdFx0dGhhdFRoZXRhICogKHRoaXMuc3BlZWQpICtcblx0XHRcdFx0dGhpc1RoZXRhICogKDEgLSB0aGlzLnNwZWVkKTtcblx0XHRcdFx0XG5cdFx0Ly8gfVxuXHR9XG59OyIsInZhciBDYW1lcmFJbnRybyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHRoaXMucG9lbS5jYW1lcmEub2JqZWN0LnBvc2l0aW9uLnkgPSB0aGlzLnBvZW0uaGVpZ2h0ICogNTtcblx0dGhpcy5vcmlnaW4gPSBwcm9wZXJ0aWVzLm9yaWdpbiA/IHByb3BlcnRpZXMub3JpZ2luIDogbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0dGhpcy5zcGVlZCA9IHByb3BlcnRpZXMuc3BlZWQgPyBwcm9wZXJ0aWVzLnNwZWVkIDogMC45ODtcblx0XG5cdHRoaXMuYm91bmRVcGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLmJvdW5kVXBkYXRlICk7XG5cdFxufTtcblxuXG5DYW1lcmFJbnRyby5wcm90b3R5cGUgPSB7XG5cdFxuXHR1cGRhdGU6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHRoaXMucG9lbS5jYW1lcmEub2JqZWN0LnBvc2l0aW9uLnkgKj0gdGhpcy5zcGVlZDtcblx0XHR0aGlzLnBvZW0uY2FtZXJhLm9iamVjdC5sb29rQXQoIHRoaXMub3JpZ2luICk7XG5cdFx0XG5cdFx0aWYoIHRoaXMucG9lbS5jYW1lcmEub2JqZWN0LnBvc2l0aW9uLnkgPCAwLjEgKSB7XG5cdFx0XHR0aGlzLnBvZW0ub2ZmKCd1cGRhdGUnLCB0aGlzLmJvdW5kVXBkYXRlICk7XG5cdFx0fVxuXHRcdFxuXHR9XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW1lcmFJbnRybzsiLCJ2YXIgdHdvz4AgPSBNYXRoLlBJICogMjtcbnZhciBjb3MgPSBNYXRoLmNvcztcbnZhciBzaW4gPSBNYXRoLnNpbjtcbnZhciByYW5kb20gPSByZXF1aXJlKCcuLi91dGlscy9yYW5kb20uanMnKTtcblxuXG52YXIgQ3lsaW5kZXJMaW5lcyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0Ly8gY29uc29sZS53YXJuKFwicmVtb3ZlIHRpdGxlIGhpZGluZyBoYWNrXCIpO1xuXHQvLyAkKCcjdGl0bGUnKS5oaWRlKCk7XG5cdC8vICQoJy5zY29yZScpLmNzcygnb3BhY2l0eScsIDEpO1xuXHRcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR2YXIgaCA9IDAuNTtcblx0dmFyIGwgPSAwLjU7XG5cdHZhciBzID0gMC41O1xuXHRcblx0dmFyIGdlb21ldHJ5XHRcdD0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdHZhciBoZWlnaHRcdFx0XHQ9IHBvZW0uciAqIChfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLmhlaWdodFBlcmNlbnRhZ2UgKSA/IHByb3BlcnRpZXMucmFkaXVzUGVyY2VudGFnZSA6IDAuOCk7XG5cdHZhciByYWRpdXNcdFx0XHQ9IHBvZW0uciAqIChfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLnJhZGl1c1BlcmNlbnRhZ2UgKSA/IHByb3BlcnRpZXMucmFkaXVzUGVyY2VudGFnZSA6IDAuOCk7XG5cdHZhciBzaWRlc1x0XHRcdD0gXy5pc051bWJlciggcHJvcGVydGllcy5zaWRlcyApID8gcHJvcGVydGllcy5zaWRlcyA6IDE1O1xuXHR2YXIgZWNjZW50cmljaXR5XHQ9IF8uaXNOdW1iZXIoIHByb3BlcnRpZXMuZWNjZW50cmljaXR5ICkgPyBwcm9wZXJ0aWVzLmVjY2VudHJpY2l0eSA6IDAuMDU7XG5cdHZhciBpdGVyYXRpb25zXHRcdD0gXy5pc051bWJlciggcHJvcGVydGllcy5pdGVyYXRpb25zICkgPyBwcm9wZXJ0aWVzLml0ZXJhdGlvbnMgOiAxMDtcblx0XG5cdF9tdWx0aXBsZUN5bGluZGVyV2F2ZVZlcnRpY2VzKFxuXHRcdGl0ZXJhdGlvbnMsXG5cdFx0Z2VvbWV0cnkudmVydGljZXMsXG5cdFx0c2lkZXMsXG5cdFx0cmFkaXVzLFxuXHRcdHBvZW0uaGVpZ2h0LFxuXHRcdGVjY2VudHJpY2l0eVxuXHQpO1xuXG5cdHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7XG5cdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGgsXG5cdFx0Zm9nOiB0cnVlXG5cdH0pO1xuXG5cdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLkxpbmUoXG5cdFx0Z2VvbWV0cnksXG5cdFx0bWF0ZXJpYWwsXG5cdFx0VEhSRUUuTGluZVBpZWNlc1xuXHQpO1xuXHRcblx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgZnVuY3Rpb24oIGUgKSB7XG5cblx0XHRoID0gKGggKyAwLjAwMDIgKiBlLmR0KSAlIDE7XG5cdFx0bWF0ZXJpYWwuY29sb3Iuc2V0SFNMKCBoLCBzLCBsICk7XG5cblx0fS5iaW5kKHRoaXMpKTtcblx0XG59O1xuXG5mdW5jdGlvbiBfbXVsdGlwbGVDeWxpbmRlcldhdmVWZXJ0aWNlcyggaXRlcmF0aW9ucywgdmVydGljZXMsIHNpZGVzLCByYWRpdXMsIGhlaWdodCwgZWNjZW50cmljaXR5ICkge1xuXHRcblx0dmFyIHJhdGlvMSwgcmF0aW8yO1xuXHRcblx0Zm9yKCB2YXIgaT0wOyBpIDwgaXRlcmF0aW9uczsgaSsrICkge1xuXHRcdFxuXHRcdHJhdGlvMSA9IGkgLyBpdGVyYXRpb25zO1xuXHRcdHJhdGlvMiA9IDEgLSByYXRpbzE7XG5cdFx0XG5cdFx0X2N5bGluZGVyV2F2ZVZlcnRpY2VzKFxuXHRcdFx0dmVydGljZXMsXG5cdFx0XHRNYXRoLmZsb29yKCAoc2lkZXMgLSAzKSAqIHJhdGlvMiApICsgMyxcblx0XHRcdHJhZGl1cyAqIHJhdGlvMixcblx0XHRcdGhlaWdodCAqIHJhdGlvMiAqIHJhdGlvMixcblx0XHRcdGVjY2VudHJpY2l0eVxuXHRcdCk7XG5cdFx0XG5cdH1cbn1cblxuZnVuY3Rpb24gX2N5bGluZGVyV2F2ZVZlcnRpY2VzKCB2ZXJ0aWNlcywgc2lkZXMsIHJhZGl1cywgaGVpZ2h0LCBlY2NlbnRyaWNpdHkgKSB7XG5cblx0dmFyIHgxLHoxLHgyLHoyLGgxLGgyLHhQcmltZSx6UHJpbWUsaFByaW1lO1xuXHR2YXIgZWNjMSA9IDEgLSBlY2NlbnRyaWNpdHk7XG5cdHZhciBlY2MyID0gMSArIGVjY2VudHJpY2l0eTtcblx0dmFyIHJhZGlhbnNQZXJTaWRlID0gdHdvz4AgLyBzaWRlcztcblx0dmFyIHdhdmVzID0gMztcblx0dmFyIHdhdmVIZWlnaHQ7XG5cblx0Zm9yKCB2YXIgaT0wOyBpIDw9IHNpZGVzOyBpKysgKSB7XG5cblx0XHR3YXZlSGVpZ2h0ID0gaGVpZ2h0ICogTWF0aC5zaW4oIHJhZGlhbnNQZXJTaWRlICogaSAqIHdhdmVzICkgKiAwLjQ7XG5cblx0XHR4MSA9IGNvcyggcmFkaWFuc1BlclNpZGUgKiBpICkgKiByYWRpdXMgKiByYW5kb20ucmFuZ2UoIGVjYzEsIGVjYzIgKTtcblx0XHR6MSA9IHNpbiggcmFkaWFuc1BlclNpZGUgKiBpICkgKiByYWRpdXMgKiByYW5kb20ucmFuZ2UoIGVjYzEsIGVjYzIgKTtcblx0XHRoMSA9IGhlaWdodFx0XHRcdFx0XHRcdFx0XHQqIHJhbmRvbS5yYW5nZSggZWNjMSwgZWNjMiApICsgd2F2ZUhlaWdodDtcblx0XHRcblx0XHRpZiggaSA+IDAgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBpID09PSBzaWRlcyApIHtcblx0XHRcdFx0eDEgPSB4UHJpbWU7XG5cdFx0XHRcdHoxID0gelByaW1lO1xuXHRcdFx0XHRoMSA9IGhQcmltZTtcblx0XHRcdH1cblxuXHRcdFx0Ly9WZXJ0aWNhbCBsaW5lXG5cdFx0XHR2ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyggeDEsIGgxICogIDAuNSwgejEgKSApO1xuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqIC0wLjUsIHoxICkgKTtcblxuXHRcdFx0Ly9Ub3AgaG9yaXogbGluZVxuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqIDAuNSwgejEgKSApO1xuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgyLCBoMiAqIDAuNSwgejIgKSApO1xuXG5cdFx0XHQvL0JvdHRvbSBob3JpeiBsaW5lXG5cdFx0XHR2ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyggeDEsIGgxICogLTAuNSwgejEgKSApO1xuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgyLCBoMiAqIC0wLjUsIHoyICkgKTtcblx0XHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRcblx0XHRcdHhQcmltZSA9IHgxO1xuXHRcdFx0elByaW1lID0gejE7XG5cdFx0XHRoUHJpbWUgPSBoMTtcblx0XHRcdFxuXHRcdH1cblxuXHRcdHgyID0geDE7XG5cdFx0ejIgPSB6MTtcblx0XHRoMiA9IGgxO1xuXG5cdH1cblx0XG5cdHJldHVybiBnZW9tZXRyeTtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDeWxpbmRlckxpbmVzOyIsInZhciBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xudmFyIHJhbmRvbSA9IHJlcXVpcmUoJy4uL3V0aWxzL3JhbmRvbS5qcycpO1xudmFyIEJ1bGxldCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0J1bGxldCcpO1xudmFyIFNvdW5kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi4vc291bmQvU291bmRHZW5lcmF0b3InKTtcblxudmFyIERhbWFnZSA9IGZ1bmN0aW9uKCBwb2VtLCBzaGlwLCBzZXR0aW5ncyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuc2hpcCA9IHNoaXA7XG5cdHRoaXMucGVyRXhwbG9zaW9uID0gMTAwO1xuXHR0aGlzLnJldGFpbkV4cGxvc2lvbnNDb3VudCA9IDM7XG5cdHRoaXMuYnVsbGV0cyA9IFtdO1xuXHR0aGlzLmV4cGxvZGVTcGVlZCA9IDM7XG5cdHRoaXMudHJhbnNwYXJlbnQgPSBmYWxzZTtcblx0dGhpcy5vcGFjaXR5ID0gMTtcblx0XG5cdHRoaXMuZXhwbG9zaW9uQ291bnQgPSAwO1xuXHR0aGlzLmV4cGxvc2lvblNvdW5kID0gbnVsbDtcblx0XG5cdGlmKCBfLmlzT2JqZWN0KCBzZXR0aW5ncyApICkge1xuXHRcdF8uZXh0ZW5kKCB0aGlzLCBzZXR0aW5ncyApO1xuXHR9XG5cdFxuXHR0aGlzLmNvdW50ID0gdGhpcy5wZXJFeHBsb3Npb24gKiB0aGlzLnJldGFpbkV4cGxvc2lvbnNDb3VudDtcblx0XG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuYWRkU291bmQoKTtcbn07XG5cdFxuRGFtYWdlLnByb3RvdHlwZSA9IHtcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgdmVydGV4LCBidWxsZXQ7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHR2ZXJ0ZXggPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFx0YnVsbGV0ID0gbmV3IEJ1bGxldCggdGhpcy5wb2VtLCB0aGlzLCB2ZXJ0ZXggKTtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggdmVydGV4ICk7XG5cdFx0XHR0aGlzLmJ1bGxldHMucHVzaCggYnVsbGV0ICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XHRidWxsZXQucG9zaXRpb24ueSA9IDEwMDA7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAxICogdGhpcy5wb2VtLnJhdGlvLFxuXHRcdFx0XHQgY29sb3I6IHRoaXMuc2hpcC5jb2xvcixcblx0XHRcdFx0IHRyYW5zcGFyZW50OiB0aGlzLnRyYW5zcGFyZW50LFxuXHRcdFx0XHQgb3BhY2l0eTogdGhpcy5vcGFjaXR5XG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5vYmplY3QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdFxuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNhd3Rvb3RoXCIgKSxcblx0XHRcdHNvdW5kLm1ha2VHYWluKCksXG5cdFx0XHRzb3VuZC5nZXREZXN0aW5hdGlvbigpXG5cdFx0XSk7XG5cdFx0XG5cdFx0c291bmQuc2V0R2FpbigwLDAsMCk7XG5cdFx0c291bmQuc3RhcnQoKTtcblx0XHRcblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmJ1bGxldHMsIGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdH0pO1xuXHRcdFxuXHR9LFxuXHRcblx0ZXhwbG9kZSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHRoaXMucGxheUV4cGxvc2lvblNvdW5kKCk7XG5cdFx0XG5cdFx0Xy5lYWNoKCBfLnNhbXBsZSggdGhpcy5idWxsZXRzLCB0aGlzLnBlckV4cGxvc2lvbiApLCBmdW5jdGlvbiggYnVsbGV0KSB7XG5cblx0XHRcdHZhciB0aGV0YSA9IHJhbmRvbS5yYW5nZSgwLCAyICogTWF0aC5QSSk7XG5cdFx0XHR2YXIgciA9IHJhbmRvbS5yYW5nZUxvdyggMCwgdGhpcy5leHBsb2RlU3BlZWQgKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LmFsaXZlID0gdHJ1ZTtcblx0XHRcdGJ1bGxldC5wb3NpdGlvbi5jb3B5KCB0aGlzLnNoaXAucG9zaXRpb24gKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LnNwZWVkLnggPSByICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHRidWxsZXQuc3BlZWQueSA9IHIgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcdFx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0XG5cdH0sXG5cdFxuXHRwbGF5RXhwbG9zaW9uU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZnJlcSA9IDUwMDtcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kO1xuXG5cdFx0Ly9TdGFydCBzb3VuZFxuXHRcdHNvdW5kLnNldEdhaW4oMC41LCAwLCAwLjAwMSk7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBzdGVwID0gMC4wMjtcblx0XHR2YXIgdGltZXMgPSA2O1xuXHRcdHZhciBpPTE7XG5cdFx0XG5cdFx0Zm9yKGk9MTsgaSA8IHRpbWVzOyBpKyspIHtcblx0XHRcdHNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogTWF0aC5yYW5kb20oKSwgc3RlcCAqIGksIHN0ZXApO1xuXHRcdH1cblxuXHRcdC8vRW5kIHNvdW5kXG5cdFx0c291bmQuc2V0R2FpbigwLCBzdGVwICogdGltZXMsIDAuMik7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEgKiAwLjIxLCBzdGVwICogdGltZXMsIDAuMDUpO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSAge1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy5idWxsZXRzLCBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0YnVsbGV0LnVwZGF0ZSggZSApO1xuXHRcdFx0YnVsbGV0LnNwZWVkLm11bHRpcGx5U2NhbGFyKDAuOTk5KTtcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGFtYWdlOyIsIi8qXG5cdFNldCB0aGUgd2luIGNvbmRpdGlvbnMgaW4gdGhlIGxldmVsIG1hbmlmZXN0IGFzIGJlbG93XG5cblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb21wb25lbnQ6IFwiamVsbHlNYW5hZ2VyXCIsXG5cdFx0XHRcdFx0cHJvcGVydGllczogbnVsbFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fVxuXG5cdFBzdWVkby1jb2RlIGdldHMgY2FsbGVkOlxuXG5cdFx0amVsbHlNYW5hZ2VyLndhdGNoRm9yQ29tcGxldGlvbiggd2luQ2hlY2ssIHByb3BlcnRpZXMgKTtcblxuXHRUaGVuIGluIHRoZSBqZWxseU1hbmFnZXIgY29tcG9uZW50LCBjYWxsIHRoZSBmb2xsb3dpbmcgd2hlbiBjb25kaXRpb24gaXMgY29tcGxldGVkOlxuXG5cdFx0c2NvcmluZ0FuZFdpbm5pbmcucmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkKCk7XG5cbiovXG5cbnZhciBTY29yaW5nQW5kV2lubmluZyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0cHJvcGVydGllcyA9IF8uaXNPYmplY3QoIHByb3BlcnRpZXMgKSA/IHByb3BlcnRpZXMgOiB7fTtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuJHNjb3JlID0gJCgnI3Njb3JlJyk7XG5cdHRoaXMuJGVuZW1pZXNDb3VudCA9ICQoJyNlbmVtaWVzLWNvdW50Jyk7XG5cdHRoaXMuJHdpbiA9ICQoJy53aW4nKTtcblx0dGhpcy4kd2luU2NvcmUgPSAkKCcjd2luLXNjb3JlJyk7XG5cdHRoaXMuJHdpblRleHQgPSB0aGlzLiR3aW4uZmluZCgnaDE6Zmlyc3QnKTtcblx0dGhpcy4kc2NvcmVNZXNzYWdlID0gJCgnI3Njb3JlLW1lc3NhZ2UnKTtcblx0dGhpcy4kbmV4dExldmVsID0gJCgnI25leHQtbGV2ZWwnKTtcblx0dGhpcy5zY29yZSA9IDA7XG5cdHRoaXMuZW5lbWllc0NvdW50ID0gMDtcblx0dGhpcy5zY29yZU1lc3NhZ2VJZCA9IDA7XG5cdHRoaXMubWVzc2FnZSA9IF8uaXNTdHJpbmcoIHByb3BlcnRpZXMubWVzc2FnZSApID8gcHJvcGVydGllcy5tZXNzYWdlIDogXCJZb3UgV2luXCI7XG5cdHRoaXMubmV4dExldmVsID0gcHJvcGVydGllcy5uZXh0TGV2ZWwgPyBwcm9wZXJ0aWVzLm5leHRMZXZlbCA6IG51bGw7XG5cdHRoaXMud29uID0gZmFsc2U7XG5cdFxuXHR0aGlzLmNvbmRpdGlvbnNDb3VudCA9IF8uaXNBcnJheSggcHJvcGVydGllcy5jb25kaXRpb25zICkgPyBwcm9wZXJ0aWVzLmNvbmRpdGlvbnMubGVuZ3RoIDogMDtcblx0dGhpcy5jb25kaXRpb25zUmVtYWluaW5nID0gdGhpcy5jb25kaXRpb25zQ291bnQ7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ2xldmVsUGFyc2VkJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zZXRDb25kaXRpb25zKCBwcm9wZXJ0aWVzLmNvbmRpdGlvbnMgKVxuXHR9LmJpbmQodGhpcykpO1xuXHRcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNjb3JpbmdBbmRXaW5uaW5nO1xuXG5TY29yaW5nQW5kV2lubmluZy5wcm90b3R5cGUgPSB7XG5cdFxuXHRzZXRDb25kaXRpb25zIDogZnVuY3Rpb24oIGNvbmRpdGlvbnMgKSB7XG5cdFx0XG5cdFx0Ly8gU3RhcnQgd2F0Y2hpbmcgZm9yIGNvbXBsZXRpb24gZm9yIGFsbCBjb21wb25lbnRzXG5cdFx0XG5cdFx0Xy5lYWNoKCBjb25kaXRpb25zLCBmdW5jdGlvbiggY29uZGl0aW9uICkge1xuXHRcdFxuXHRcdFx0dmFyIGNvbXBvbmVudCA9IHRoaXMucG9lbVtjb25kaXRpb24uY29tcG9uZW50XTtcblx0XHRcdHZhciBhcmd1bWVudHMgPSBfLnVuaW9uKCB0aGlzLCBjb25kaXRpb24ucHJvcGVydGllcyApO1xuXHRcdFxuXHRcdFx0Y29tcG9uZW50LndhdGNoRm9yQ29tcGxldGlvbi5hcHBseSggY29tcG9uZW50LCBhcmd1bWVudHMgKTtcblx0XHRcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdFxuXHR9LFxuXHRcblx0cmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jb25kaXRpb25zUmVtYWluaW5nLS07XG5cdFx0XG5cdFx0aWYoIHRoaXMuY29uZGl0aW9uc1JlbWFpbmluZyA9PT0gMCApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLnNoaXAuZGlzYWJsZSgpO1xuXHRcdFx0dGhpcy53b24gPSB0cnVlO1xuXHRcdFx0dGhpcy5zaG93V2luU2NyZWVuKCk7XG5cdFx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGp1c3RFbmVtaWVzIDogZnVuY3Rpb24oIGNvdW50ICkge1xuXHRcdFxuXHRcdC8vIGlmKHRoaXMud29uKSByZXR1cm47XG5cdFx0XG5cdFx0dGhpcy5lbmVtaWVzQ291bnQgKz0gY291bnQ7XG5cdFx0dGhpcy4kZW5lbWllc0NvdW50LnRleHQoIHRoaXMuZW5lbWllc0NvdW50ICk7XG5cdFx0XG5cdFx0cmV0dXJuIHRoaXMuZW5lbWllc0NvdW50O1xuXHR9LFxuXHRcblx0YWRqdXN0U2NvcmUgOiBmdW5jdGlvbiggY291bnQsIG1lc3NhZ2UsIHN0eWxlICkge1xuXHRcdFxuXHRcdGlmKHRoaXMud29uKSByZXR1cm47XG5cdFx0XG5cdFx0dGhpcy5zY29yZSArPSBjb3VudDtcblx0XHR0aGlzLiRzY29yZS50ZXh0KCB0aGlzLnNjb3JlICk7XG5cdFx0XG5cdFx0aWYoIG1lc3NhZ2UgKSB7XG5cdFx0XHR0aGlzLnNob3dNZXNzYWdlKCBtZXNzYWdlLCBzdHlsZSApO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdGhpcy5zY29yZTtcblx0fSxcblx0XG5cdHNob3dNZXNzYWdlIDogZnVuY3Rpb24oIG1lc3NhZ2UsIHN0eWxlICkge1xuXHRcdFxuXHRcdHZhciAkc3BhbiA9ICQoJzxzcGFuPjwvc3Bhbj4nKS50ZXh0KCBtZXNzYWdlICk7XG5cdFx0XG5cdFx0aWYoIHN0eWxlICkgJHNwYW4uY3NzKCBzdHlsZSApO1xuXHRcdFxuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5oaWRlKCk7XG5cdFx0dGhpcy4kc2NvcmVNZXNzYWdlLmVtcHR5KCkuYXBwZW5kKCAkc3BhbiApO1xuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5yZW1vdmVDbGFzcygnZmFkZW91dCcpO1xuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5hZGRDbGFzcygnZmFkZWluJyk7XG5cdFx0dGhpcy4kc2NvcmVNZXNzYWdlLnNob3coKTtcblx0XHR0aGlzLiRzY29yZU1lc3NhZ2UucmVtb3ZlQ2xhc3MoJ2ZhZGVpbicpO1xuXHRcdFxuXHRcdHZhciBpZCA9ICsrdGhpcy5zY29yZU1lc3NhZ2VJZDtcblx0XHRcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHRpZiggaWQgPT09IHRoaXMuc2NvcmVNZXNzYWdlSWQgKSB7XG5cdFx0XHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5hZGRDbGFzcygnZmFkZW91dCcpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpLCAyMDAwKTtcblx0XHRcblx0fSxcblx0XG5cdHNob3dXaW5TY3JlZW4gOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0XG5cdFx0dGhpcy4kd2luU2NvcmUudGV4dCggdGhpcy5zY29yZSApO1xuXHRcdHRoaXMuJHdpbi5zaG93KCk7XG5cdFx0dGhpcy4kd2luLmNzcyh7XG5cdFx0XHRvcGFjaXR5OiAxXG5cdFx0fSk7XG5cdFx0dGhpcy4kd2luVGV4dC5odG1sKCB0aGlzLm1lc3NhZ2UgKTtcblx0XHR0aGlzLiRuZXh0TGV2ZWwub25lKCAnY2xpY2snLCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0TGV2ZWxMb2FkZXIoIHRoaXMubmV4dExldmVsICk7XG5cdFx0XHR0aGlzLiR3aW4uaGlkZSgpO1xuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0fVxuXHRcbn07IiwidmFyIFN0YXJzID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHRwcm9wZXJ0aWVzID0gXy5pc09iamVjdCggcHJvcGVydGllcyApID8gcHJvcGVydGllcyA6IHt9O1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHRcblx0dGhpcy5jb3VudCA9IF8uaXNOdW1iZXIoIHByb3BlcnRpZXMuY291bnQgKSA/IHByb3BlcnRpZXMuY291bnQgOiA0MDAwMDtcblx0dGhpcy5kZXB0aCA9IDcuNTtcblx0dGhpcy5jb2xvciA9IDB4YWFhYWFhO1xuXHRcblx0dGhpcy5hZGRPYmplY3QoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhcnM7XG5cblN0YXJzLnByb3RvdHlwZSA9IHtcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgciwgdGhldGEsIHgsIHksIHosIGdlb21ldHJ5O1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0Zm9yKHZhciBpPTA7IGkgPCB0aGlzLmNvdW50OyBpKyspIHtcblx0XHRcdFxuXHRcdFx0ciA9IE1hdGgucmFuZG9tKCkgKiB0aGlzLmRlcHRoICogdGhpcy5wb2VtLnI7XG5cdFx0XHRpZiggciA8IHRoaXMucG9lbS5yICkge1xuXHRcdFx0XHRyID0gTWF0aC5yYW5kb20oKSAqIHRoaXMuZGVwdGggKiB0aGlzLnBvZW0ucjtcblx0XHRcdH1cblx0XHRcdHRoZXRhID0gTWF0aC5yYW5kb20oKSAqIDIgKiBNYXRoLlBJO1xuXHRcdFx0XG5cdFx0XHR4ID0gTWF0aC5jb3MoIHRoZXRhICkgKiByO1xuXHRcdFx0eiA9IE1hdGguc2luKCB0aGV0YSApICogcjtcblx0XHRcdHkgPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLmRlcHRoICogdGhpcy5wb2VtLnI7XG5cdFx0XHRcblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKHgseSx6KSApO1xuXHRcdFx0XHRcdFxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuZ2VuZXJhdGVHZW9tZXRyeSgpO1xuXHRcdFxuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLlBvaW50Q2xvdWQoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdG5ldyBUSFJFRS5Qb2ludENsb3VkTWF0ZXJpYWwoe1xuXHRcdFx0XHQgc2l6ZTogMC41ICogdGhpcy5wb2VtLnJhdGlvLFxuXHRcdFx0XHQgY29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRcdCBmb2c6IGZhbHNlXG5cdFx0XHR9XG5cdFx0KSApO1xuXHRcdFxuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdFxuXHR9XG59OyIsInZhciBISUQgPSByZXF1aXJlKCcuLi9Db21wb25lbnRzL0hpZCcpO1xuXG52YXIgVGl0bGVzID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLnBvZW0uc2hpcC5kaXNhYmxlKCk7XG5cdHRoaXMucm90YXRlU3RhcnMoKTtcblx0XG5cdCQoJ2FbaHJlZj0ja2V5c10nKS5jbGljayh0aGlzLmhhbmRsZUtleXNDbGljay5iaW5kKHRoaXMpKTtcblx0JCgnYVtocmVmPSN0aWx0XScpLmNsaWNrKHRoaXMuaGFuZGxlVGlsdENsaWNrLmJpbmQodGhpcykpO1xuXHRcblx0JCgnI3RpdGxlJykucmVtb3ZlQ2xhc3MoJ2hpZGUnKS5zaG93KCk7XG5cdCQoJy5zY29yZScpLmNzcygnb3BhY2l0eScsIDApO1xuXHRcblx0XG5cdHRoaXMud2ViZ2xDaGVjaygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaXRsZXM7XG5cblRpdGxlcy5wcm90b3R5cGUgPSB7XG5cdFxuXHR3ZWJnbEVuYWJsZWQgOiAoIGZ1bmN0aW9uICgpIHsgdHJ5IHsgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7IHJldHVybiAhISB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmICggY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKSB8fCBjYW52YXMuZ2V0Q29udGV4dCggJ2V4cGVyaW1lbnRhbC13ZWJnbCcgKSApOyB9IGNhdGNoKCBlICkgeyByZXR1cm4gZmFsc2U7IH0gfSApKCksXG5cdFxuXHR3ZWJnbENoZWNrIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0aWYoICF0aGlzLndlYmdsRW5hYmxlZCApIHtcblx0XHRcdCQoJ2FbaHJlZj0ja2V5c10nKS5oaWRlKCk7XG5cdFx0XHQkKCdhW2hyZWY9I3RpbHRdJykuaGlkZSgpO1xuXHRcdFx0JCgnLnRpdGxlLXdlYmdsLWVycm9yJykuc2hvdygpO1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGhhbmRsZUtleXNDbGljayA6IGZ1bmN0aW9uKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0SElELnByb3RvdHlwZS5zZXRLZXlzKCk7XG5cdFx0dGhpcy5uZXh0TGV2ZWwoKTtcblx0fSxcblx0XG5cdGhhbmRsZVRpbHRDbGljayA6IGZ1bmN0aW9uKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0SElELnByb3RvdHlwZS5zZXRUaWx0KCk7XG5cdFx0dGhpcy5uZXh0TGV2ZWwoKTtcblx0fSxcblx0XG5cdG5leHRMZXZlbCA6IGZ1bmN0aW9uKCkge1xuXHRcdCQoJyN0aXRsZScpLmFkZENsYXNzKCdoaWRlJyk7XG5cdFx0JCgnLnNjb3JlJykuY3NzKCdvcGFjaXR5JywgMSk7XG5cblx0XHRMZXZlbExvYWRlcihcImludHJvXCIpO1xuXHRcdFxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdCQoJyN0aXRsZScpLmhpZGUoKTtcblx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSwgMTAwMCk7XG5cdH0sXG5cdFxuXHRyb3RhdGVTdGFycyA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHRoaXMucG9lbS5vbigndXBkYXRlJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLnBvZW0uc3RhcnMub2JqZWN0LnJvdGF0aW9uLnkgLT0gMC4wMDAxICogZS5kdDtcblx0XHRcblx0XHR9LmJpbmQodGhpcykgKTtcblx0XHRcblx0fVxuXHRcbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG5cbnZhciBBc3Rlcm9pZCA9IGZ1bmN0aW9uKCBwb2VtLCB4LCB5LCByYWRpdXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdFxuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5wb3NpdGlvbi54ID0geCB8fCAwO1xuXHR0aGlzLnBvc2l0aW9uLnkgPSB5IHx8IDA7XG5cdHRoaXMub3NjaWxsYXRpb24gPSAwO1xuXHR0aGlzLnJhZGl1cyA9IHJhZGl1cyB8fCA1O1xuXHR0aGlzLnNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5yb3RhdGlvblNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0dGhpcy5tYXhTcGVlZCA9IDAuNTtcblx0dGhpcy5tYXhSb3RhdGlvblNwZWVkID0gMC4xO1xuXHR0aGlzLm9zY2lsbGF0aW9uU3BlZWQgPSA1MDtcblx0dGhpcy5zdHJva2VDb2xvciA9IDB4ZGRkZGRkO1xuXHR0aGlzLmZpbGxDb2xvciA9IDB4ZmZmZmZmO1xuXHR0aGlzLmFkZE9iamVjdCh4LCB5KTtcblx0dGhpcy51cGRhdGUoKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzdGVyb2lkO1xuXG5Bc3Rlcm9pZC5wcm90b3R5cGUgPSB7XG5cblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gbmV3IFRIUkVFLk9jdGFoZWRyb25HZW9tZXRyeSh0aGlzLnJhZGl1cywgMSk7XG5cdFx0XG5cdFx0Ly9EaXNmb3JtXG5cdFx0Xy5lYWNoKGdlb21ldHJ5LnZlcnRpY2VzLCBmdW5jdGlvbiggdmVydGV4ICkge1xuXHRcdFx0dmVydGV4LnggKz0gKHRoaXMucmFkaXVzIC8gMikgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cdFx0XHR2ZXJ0ZXgueSArPSAodGhpcy5yYWRpdXMgLyAyKSAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcblx0XHRcdHZlcnRleC56ICs9ICh0aGlzLnJhZGl1cyAvIDIpICogKE1hdGgucmFuZG9tKCkgLSAwLjUpO1xuXHRcdH0sIHRoaXMpO1xuXHRcdFxuXHRcdHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6dGhpcy5zdHJva2VDb2xvcn0pO1xuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBtYXRlcmlhbCApO1xuXHRcdFxuXHRcdHZhciBvdXRsaW5lTWF0ID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjp0aGlzLmZpbGxDb2xvciwgc2lkZTogVEhSRUUuQmFja1NpZGV9KTtcblx0XHR2YXIgb3V0bGluZU9iaiA9IG5ldyBUSFJFRS5NZXNoKCBnZW9tZXRyeSwgb3V0bGluZU1hdCApO1xuXHRcdG91dGxpbmVPYmouc2NhbGUubXVsdGlwbHlTY2FsYXIoIDEuMDUpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0LmFkZCggb3V0bGluZU9iaiApO1xuXHRcdFxuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0XG5cdFx0dGhpcy5zcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhTcGVlZDtcblx0XHR0aGlzLnNwZWVkLnkgPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFNwZWVkO1xuXHRcdFxuXHRcdHRoaXMucm90YXRpb25TcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC55ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC56ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdFxuXHRcdHRoaXMub3NjaWxsYXRpb24gPSBNYXRoLnJhbmRvbSgpICogTWF0aC5QSSAqIDIgKiB0aGlzLm9zY2lsbGF0aW9uU3BlZWQ7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0aW9uICs9IHRoaXMuc3BlZWQueTtcblx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZC54O1xuXHRcdHRoaXMucG9zaXRpb24ueSA9IE1hdGguc2luKCB0aGlzLm9zY2lsbGF0aW9uIC8gdGhpcy5vc2NpbGxhdGlvblNwZWVkICkgKiB0aGlzLnBvZW0uaGVpZ2h0O1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnggKz0gdGhpcy5yb3RhdGlvblNwZWVkLng7XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi55ICs9IHRoaXMucm90YXRpb25TcGVlZC55O1x0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLnJvdGF0aW9uU3BlZWQuejtcdFxuXHRcdFxuXHRcdHRoaXMucG9lbS5jb29yZGluYXRlcy5zZXRWZWN0b3IoIHRoaXMub2JqZWN0LnBvc2l0aW9uLCB0aGlzLnBvc2l0aW9uICk7XG5cdH1cblx0XG59OyIsInZhciBCdWxsZXQgPSBmdW5jdGlvbiggcG9lbSwgZ3VuLCB2ZXJ0ZXggKSB7XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuZ3VuID0gZ3VuO1xuXHR0aGlzLnZlcnRleCA9IHZlcnRleDtcblx0XG5cdHRoaXMuc3BlZWQgPSBuZXcgVEhSRUUuVmVjdG9yMigwLDApO1xuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoMCwwKTtcblx0dGhpcy5yYWRpdXMgPSAxO1xuXHRcblx0dGhpcy5ib3JuQXQgPSAwO1xuXHR0aGlzLmFsaXZlID0gZmFsc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJ1bGxldDtcblxuQnVsbGV0LnByb3RvdHlwZSA9IHtcblx0XG5cdGtpbGwgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRleC5zZXQoMCwgMCAsMTAwMCk7XG5cdFx0dGhpcy5hbGl2ZSA9IGZhbHNlO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIHgseSx6O1xuXHRcdFxuXHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkLng7XG5cdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQueTtcblx0XHRcblx0XHR0aGlzLnBvZW0uY29vcmRpbmF0ZXMuc2V0VmVjdG9yKCB0aGlzLnZlcnRleCwgdGhpcy5wb3NpdGlvbiApO1xuXHRcdFxuXHR9LFxuXHRcblx0ZmlyZSA6IGZ1bmN0aW9uKHgsIHksIHNwZWVkLCB0aGV0YSkge1xuXHRcdFx0XHRcblx0XHR0aGlzLnBvZW0uY29vcmRpbmF0ZXMuc2V0VmVjdG9yKCB0aGlzLnZlcnRleCwgeCwgeSApO1xuXHRcdFxuXHRcdHRoaXMucG9zaXRpb24uc2V0KHgseSk7XG5cdFx0XG5cdFx0dGhpcy5zcGVlZC54ID0gTWF0aC5jb3MoIHRoZXRhICkgKiBzcGVlZDtcblx0XHR0aGlzLnNwZWVkLnkgPSBNYXRoLnNpbiggdGhldGEgKSAqIHNwZWVkO1xuXHRcdFxuXHRcdHRoaXMuYm9ybkF0ID0gdGhpcy5wb2VtLmNsb2NrLnRpbWU7XG5cdFx0dGhpcy5hbGl2ZSA9IHRydWU7XG5cdH1cbn07IiwidmFyIERhbWFnZSA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvRGFtYWdlJyk7XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tJyk7XG5cbnZhciBKZWxseXNoaXAgPSBmdW5jdGlvbiggcG9lbSwgbWFuYWdlciwgeCwgeSApIHtcblxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuXHR0aGlzLnNjZW5lID0gcG9lbS5zY2VuZTtcblx0dGhpcy5wb2xhck9iaiA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cblx0dGhpcy5uYW1lID0gXCJKZWxseXNoaXBcIjtcblx0dGhpcy5jb2xvciA9IDB4Y2IzNmVhO1xuXHR0aGlzLmNzc0NvbG9yID0gXCIjQ0IzNkVBXCI7XG5cdHRoaXMubGluZXdpZHRoID0gMiAqIHRoaXMucG9lbS5yYXRpbztcblx0dGhpcy5zY29yZVZhbHVlID0gMTM7XG5cblx0dGhpcy5zcGF3blBvaW50ID0gbmV3IFRIUkVFLlZlY3RvcjIoeCx5KTtcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdFxuXHR0aGlzLmRlYWQgPSBmYWxzZTtcblxuXHR0aGlzLnNwZWVkID0gMDtcblxuXHR0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQgPSAwLjA0O1xuXHR0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZCA9IDAuMDAxO1xuXG5cdHRoaXMudGhydXN0U3BlZWQgPSAxO1xuXHR0aGlzLnRocnVzdCA9IDA7XG5cblx0dGhpcy5iYW5rU3BlZWQgPSAwLjA2O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gMTAwMDtcblx0XG5cdHRoaXMucmFkaXVzID0gMztcblxuXHR0aGlzLmFkZE9iamVjdCgpO1xuXHR0aGlzLmRhbWFnZSA9IG5ldyBEYW1hZ2UodGhpcy5wb2VtLCB0aGlzLCB7XG5cdFx0dHJhbnNwYXJlbnQ6IHRydWUsXG5cdFx0b3BhY2l0eTogMC41LFxuXHRcdHJldGFpbkV4cGxvc2lvbnNDb3VudDogMyxcblx0XHRwZXJFeHBsb3Npb246IDUwXG5cdH0pO1xuXHRcblx0dGhpcy5oYW5kbGVVcGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuXHR0aGlzLm1hbmFnZXIub24oJ3VwZGF0ZScsIHRoaXMuaGFuZGxlVXBkYXRlICk7XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBKZWxseXNoaXA7XG5cbkplbGx5c2hpcC5wcm90b3R5cGUgPSB7XG5cdFxuXHRpbml0U2hhcmVkQXNzZXRzIDogZnVuY3Rpb24oIG1hbmFnZXIgKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeSgpO1xuXHRcdFxuXHRcdG1hbmFnZXIuc2hhcmVkLmdlb21ldHJ5ID0gZ2VvbWV0cnk7XG5cdFx0XG5cdFx0bWFuYWdlci5vbigndXBkYXRlJywgSmVsbHlzaGlwLnByb3RvdHlwZS51cGRhdGVXYXZleVZlcnRzKCBnZW9tZXRyeSApICk7XG5cdH0sXG5cdFxuXHR1cGRhdGVXYXZleVZlcnRzIDogZnVuY3Rpb24oIGdlb21ldHJ5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlICkge1xuXHRcdFx0XG5cdFx0XHRfLmVhY2goIGdlb21ldHJ5LndhdmV5VmVydHMsIGZ1bmN0aW9uKCB2ZWMgKSB7XG5cdFx0XHRcdHZlYy55ID0gMC44ICogTWF0aC5zaW4oIGUudGltZSAvIDEwMCArIHZlYy54ICkgKyB2ZWMub3JpZ2luYWwueTtcblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0fTtcblx0fSxcblxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCksXG5cdFxuXHRcdC8vdmVydHMgPSBbWzM1NS43LDIxMS43XSwgWzM3NS44LDE5NS45XSwgWzM2OC41LDE1NS40XSwgWzM2MS40LDE5MC44XSwgWzM0MS4zLDIwNS45XSwgWzMyMC40LDIwMS44XSwgWzI5OC45LDIwNl0sIFsyNzguNiwxOTAuOF0sIFsyNzEuNSwxNTUuNF0sIFsyNjQuMiwxOTUuOV0sIFsyODQuNywyMTJdLCBbMjU4LjMsMjM5LjJdLCBbMjQyLjMsMjI4LjVdLCBbMjM4LjMsMTY4LjldLCBbMjI2LjEsMjM3LjFdLCBbMjQ2LjcsMjY2LjJdLCBbMjMzLjcsMzE2LjRdLCBbMjU5LjIsMzIxLjJdLCBbMjM3LjQsNDI5LjZdLCBbMjUzLjEsNDMyLjddLCBbMjc0LjksMzI0LjJdLCBbMjkzLDMyNy42XSwgWzI4Ni42LDQ4NF0sIFszMDIuNiw0ODQuNl0sIFszMDguOSwzMzAuNl0sIFszMjAuNCwzMzIuOF0sIFszMzEuMSwzMzAuOF0sIFszMzcuNCw0ODQuNl0sIFszNTMuNCw0ODRdLCBbMzQ3LDMyNy44XSwgWzM2NS4xLDMyNC4zXSwgWzM4Ni45LDQzMi43XSwgWzQwMi42LDQyOS42XSwgWzM4MC45LDMyMS40XSwgWzQwNywzMTYuNF0sIFszOTMuOCwyNjUuNV0sIFs0MTMuOSwyMzcuMV0sIFs0MDEuNywxNjguOV0sIFszOTcuNywyMjguNV0sIFszODIuMSwyMzguOV0sIFszNTUuOSwyMTEuOF0gXTtcblx0XHRcblx0XHR2ZXJ0cyA9IFsgWzM1NS43LDIxMS43XSwgWzM3NS44LDE5NS45XSwgWzM2OC41LDE1NS40XSwgWzM2MS40LDE5MC44XSwgWzM0MS4zLDIwNS45XSwgWzMyMC40LDIwMS44XSwgWzI5OC45LDIwNl0sIFsyNzguNiwxOTAuOF0sIFxuXHRcdFx0WzI3MS41LDE1NS40XSwgWzI2NC4yLDE5NS45XSwgWzI4NC43LDIxMl0sIFsyNTguMywyMzkuMl0sIFsyNDIuMywyMjguNV0sIFsyMzguMywxNjguOV0sIFsyMjYuMSwyMzcuMV0sIFsyNDYuNywyNjYuMl0sIFsyMzMuNywzMTYuNF0sIFsyNTkuMiwzMjEuMl0sIFxuXHRcdFx0WzI1Ny4xLDMzMS4zXSwgWzI1NC45LDM0Mi4zXSwgWzI1Mi44LDM1Mi45XSwgWzI1MC41LDM2NC41XSwgWzI0OC4yLDM3NS43XSwgWzI0Ni4xLDM4Ni4yXSwgWzI0My44LDM5Ny43XSwgWzI0MS4zLDQxMC4zXSwgWzIzOS41LDQxOS4zXSwgWzIzNy40LDQyOS42XSwgXG5cdFx0XHRbMjUzLjEsNDMyLjddLCBbMjU0LjksNDIzLjddLCBbMjU2LjksNDE0LjFdLCBbMjU5LjMsNDAxLjhdLCBbMjYxLjYsMzkwLjJdLCBbMjYzLjcsMzgwLjFdLCBbMjY2LjEsMzY3LjhdLCBbMjY4LjMsMzU2LjldLCBbMjcwLjYsMzQ1LjZdLCBbMjcyLjcsMzM1LjFdLCBcblx0XHRcdFsyNzQuOSwzMjQuMl0sIFsyOTMsMzI3LjZdLCBbMjkyLjYsMzM2LjVdLCBbMjkyLjIsMzQ4XSwgWzI5MS43LDM1OS42XSwgWzI5MS4yLDM3MS41XSwgWzI5MC43LDM4Mi41XSwgWzI5MC4zLDM5My42XSwgWzI4OS44LDQwNS4xXSwgWzI4OS41LDQxNC4xXSwgWzI4OSw0MjUuNl0sIFxuXHRcdFx0WzI4OC41LDQzN10sIFsyODguMSw0NDguNV0sIFsyODcuNiw0NTkuNV0sIFsyODcuMSw0NzEuNV0sIFsyODYuNiw0ODRdLCBbMzAyLjYsNDg0LjZdLCBbMzAzLjEsNDczLjVdLCBbMzAzLjYsNDYxLjVdLCBbMzA0LjEsNDQ4LjVdLCBbMzA0LjUsNDM4LjVdLCBbMzA1LDQyNS4xXSwgXG5cdFx0XHRbMzA1LjQsNDE2LjFdLCBbMzA1LjksNDA1XSwgWzMwNi4yLDM5NS41XSwgWzMwNi42LDM4Nl0sIFszMDcuMSwzNzNdLCBbMzA3LjYsMzYxXSwgWzMwOC4yLDM0Ny41XSwgWzMwOC41LDMzOC41XSwgWzMwOC45LDMzMC42XSwgWzMzMS4xLDMzMC44XSwgWzMzMS40LDMzNi41XSwgXG5cdFx0XHRbMzMxLjcsMzQ0XSwgWzMzMiwzNTNdLCBbMzMyLjUsMzY0LjVdLCBbMzMzLDM3Nl0sIFszMzMuNCwzODcuNV0sIFszMzMuOSwzOTguNV0sIFszMzQuNCw0MTAuNV0sIFszMzQuOSw0MjIuNF0sIFszMzUuNCw0MzddLCBbMzM2LDQ1MF0sIFszMzYuNCw0NjBdLCBbMzM2LjgsNDcxXSwgXG5cdFx0XHRbMzM3LjQsNDg0LjZdLCBbMzUzLjQsNDg0XSwgWzM1Mi44LDQ3MV0sIFszNTIuMyw0NTcuNV0sIFszNTEuOSw0NDhdLCBbMzUxLjUsNDM3LjVdLCBbMzUwLjksNDIzXSwgWzM1MC40LDQxMC41XSwgWzM0OS44LDM5Ni41XSwgWzM0OS40LDM4NS41XSwgWzM0OC45LDM3NC40XSwgXG5cdFx0XHRbMzQ4LjUsMzYzLjRdLCBbMzQ4LDM1Ml0sIFszNDcuNiwzNDNdLCBbMzQ3LjMsMzM0XSwgWzM0NywzMjcuOF0sIFszNjUuMSwzMjQuM10sIFszNjYuNiwzMzEuN10sIFszNjguMiwzMzkuNl0sIFszNzAuMiwzNDkuNV0sIFszNzEuOSwzNTcuOF0sIFszNzMuNiwzNjYuOF0sIFxuXHRcdFx0WzM3NS40LDM3NS40XSwgWzM3Ny4xLDM4NF0sIFszNzksMzkzLjVdLCBbMzgxLjIsNDA0LjZdLCBbMzgzLjEsNDE0XSwgWzM4NC45LDQyMi44XSwgWzM4Ni45LDQzMi43XSwgWzQwMi42LDQyOS42XSwgWzQwMC42LDQxOS42XSwgWzM5OS4xLDQxMi41XSwgWzM5Ny4xLDQwMi41XSwgXG5cdFx0XHRbMzk0LjcsMzkwLjJdLCBbMzkzLjEsMzgyLjZdLCBbMzkxLjQsMzc0XSwgWzM4OS42LDM2NV0sIFszODcuNiwzNTUuMV0sIFszODYsMzQ3LjJdLCBbMzg0LjEsMzM3LjddLCBbMzgyLjcsMzMwLjZdLCBbMzgwLjksMzIxLjRdLCBbNDA3LDMxNi40XSwgWzM5My44LDI2NS41XSwgXG5cdFx0XHRbNDEzLjksMjM3LjFdLCBbNDAxLjcsMTY4LjldLCBbMzk3LjcsMjI4LjVdLCBbMzgyLjEsMjM4LjldLCBbMzU1LjksMjExLjhdIF07XG5cdFx0XG5cblx0XHRtYW5oYXR0YW5MZW5ndGggPSBfLnJlZHVjZSggdmVydHMsIGZ1bmN0aW9uKCBtZW1vLCB2ZXJ0MmQgKSB7XG5cdFx0XG5cdFx0XHRyZXR1cm4gW21lbW9bMF0gKyB2ZXJ0MmRbMF0sIG1lbW9bMV0gKyB2ZXJ0MmRbMV1dO1xuXHRcdFxuXHRcdH0sIFswLDBdKTtcblx0XG5cdFx0Y2VudGVyID0gW1xuXHRcdFx0bWFuaGF0dGFuTGVuZ3RoWzBdIC8gdmVydHMubGVuZ3RoLFxuXHRcdFx0bWFuaGF0dGFuTGVuZ3RoWzFdIC8gdmVydHMubGVuZ3RoXG5cdFx0XTtcblx0XHRcblx0XHRnZW9tZXRyeS53YXZleVZlcnRzID0gW107XG5cdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHNjYWxlID0gMSAvIDMyO1xuXHRcdFx0dmFyIHZlYzMgPSBuZXcgVEhSRUUuVmVjdG9yMyhcblx0XHRcdFx0KHZlYzJbMV0gLSBjZW50ZXJbMV0pICogc2NhbGUgKiAtMSxcblx0XHRcdFx0KHZlYzJbMF0gLSBjZW50ZXJbMF0pICogc2NhbGUsXG5cdFx0XHRcdDBcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdHZlYzMub3JpZ2luYWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkoIHZlYzMgKTtcblx0XHRcdFxuXHRcdFx0aWYoIHZlYzJbMV0gPiAzMzAuOCApIHtcblx0XHRcdFx0Z2VvbWV0cnkud2F2ZXlWZXJ0cy5wdXNoKCB2ZWMzIClcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlYzM7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHRcblx0fSxcblxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5tYW5hZ2VyLnNoYXJlZC5nZW9tZXRyeTtcblx0XHRcdFxuXHRcdGxpbmVNYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7XG5cdFx0XHRjb2xvcjogdGhpcy5jb2xvcixcblx0XHRcdGxpbmV3aWR0aCA6IHRoaXMubGluZXdpZHRoXG5cdFx0fSk7XG5cdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLkxpbmUoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdGxpbmVNYXRlcmlhbCxcblx0XHRcdFRIUkVFLkxpbmVTdHJpcFxuXHRcdCk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueiArPSB0aGlzLnBvZW0ucjtcblx0XG5cdFx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0dGhpcy5yZXNldCgpO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLnBvbGFyT2JqICk7XG5cdH0sXG5cblx0a2lsbCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZGVhZCA9IHRydWU7XG5cdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuZGFtYWdlLmV4cGxvZGUoKTtcblx0fSxcblxuXHRyZXNldCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucG9zaXRpb24uY29weSggdGhpcy5zcGF3blBvaW50ICk7XG5cdFx0dGhpcy5zcGVlZCA9IDAuMjtcblx0XHR0aGlzLmJhbmsgPSAwO1xuXHRcdC8vdGhpcy5vYmplY3Qucm90YXRpb24ueiA9IE1hdGguUEkgKiAwLjI1O1x0XHRcblx0fSxcblxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFxuXHRcdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmJhbmsgKj0gMC45O1xuXHRcdFx0dGhpcy50aHJ1c3QgPSAwLjAxO1xuXHRcdFx0dGhpcy5iYW5rICs9IHJhbmRvbS5yYW5nZSgtMC4wMSwgMC4wMSk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHRcdFx0dGhpcy51cGRhdGVFZGdlQXZvaWRhbmNlKCBlICk7XG5cdFx0XHR0aGlzLnVwZGF0ZVBvc2l0aW9uKCBlICk7XG5cdFx0XG5cdFx0fVxuXG5cdH0sXG5cblx0dXBkYXRlRWRnZUF2b2lkYW5jZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgbmVhckVkZ2UsIGZhckVkZ2UsIHBvc2l0aW9uLCBub3JtYWxpemVkRWRnZVBvc2l0aW9uLCBiYW5rRGlyZWN0aW9uLCBhYnNQb3NpdGlvbjtcblx0XG5cdFx0ZmFyRWRnZSA9IHRoaXMucG9lbS5oZWlnaHQgLyAyO1xuXHRcdG5lYXJFZGdlID0gNCAvIDUgKiBmYXJFZGdlO1xuXHRcdHBvc2l0aW9uID0gdGhpcy5vYmplY3QucG9zaXRpb24ueTtcblx0XHRhYnNQb3NpdGlvbiA9IE1hdGguYWJzKCBwb3NpdGlvbiApO1xuXG5cdFx0dmFyIHJvdGF0aW9uID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiAvIE1hdGguUEk7XG5cblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICU9IDIgKiBNYXRoLlBJO1xuXHRcblx0XHRpZiggdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IDAgKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IDIgKiBNYXRoLlBJO1xuXHRcdH1cblx0XG5cdFx0aWYoIE1hdGguYWJzKCBwb3NpdGlvbiApID4gbmVhckVkZ2UgKSB7XG5cdFx0XG5cdFx0XHR2YXIgaXNQb2ludGluZ0xlZnQgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56ID49IE1hdGguUEkgKiAwLjUgJiYgdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IE1hdGguUEkgKiAxLjU7XG5cdFx0XG5cdFx0XHRpZiggcG9zaXRpb24gPiAwICkge1xuXHRcdFx0XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcblx0XHRcdG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gPSAoYWJzUG9zaXRpb24gLSBuZWFyRWRnZSkgLyAoZmFyRWRnZSAtIG5lYXJFZGdlKTtcblx0XHRcdHRoaXMudGhydXN0ICs9IG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZDtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gYmFua0RpcmVjdGlvbiAqIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQ7XG5cdFx0XG5cdFx0fVxuXHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcblx0XG5cdH0sXG5cblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbiggZSApIHtcblx0XG5cdFx0dmFyIG1vdmVtZW50ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcblx0XHRcdHZhciB0aGV0YSwgeCwgeTtcblx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gdGhpcy5iYW5rO1xuXHRcdFxuXHRcdFx0dGhldGEgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcdFxuXHRcdFx0dGhpcy5zcGVlZCAqPSAwLjk4O1xuXHRcdFx0dGhpcy5zcGVlZCArPSB0aGlzLnRocnVzdDtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1pbiggdGhpcy5tYXhTcGVlZCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWF4KCAwLCB0aGlzLnNwZWVkICk7XG5cdFx0XHRcdFx0XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZCAqIE1hdGguY29zKCB0aGV0YSApO1xuXHRcdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnk7XG5cdFx0XG5cdFx0XHQvL1BvbGFyIGNvb3JkaW5hdGVzXG5cdFx0XHQvLyB0aGlzLm9iamVjdC5wb3NpdGlvbi54ID0gTWF0aC5jb3MoIHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW8gKSAqIHRoaXMucG9lbS5yO1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueiA9IE1hdGguc2luKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdHRoaXMucG9sYXJPYmoucm90YXRpb24ueSA9IHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdFx0XG5cdFx0fTtcblx0XG5cdH0oKVx0XG5cblxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0Y29uZmlnIDoge1xuXHRcdHNjb3JpbmdBbmRXaW5uaW5nOiB7XG5cdFx0XHRtZXNzYWdlOiBcIk5vIGplbGxpZXMgZGV0ZWN0ZWQgd2l0aGluIDUgcGFyc2Vjcy48YnIvPiBGb2xsb3cgbWUgb24gPGEgaHJlZj0naHR0cHM6Ly90d2l0dGVyLmNvbS90YXR1bWNyZWF0aXZlJz5Ud2l0dGVyPC9hPiBmb3IgdXBkYXRlcyBvbiBuZXcgbGV2ZWxzLlwiLFxuXHRcdFx0bmV4dExldmVsOiBcInRpdGxlc1wiLFxuXHRcdFx0Y29uZGl0aW9uczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Ly9KZWxseSBtYW5hZ2VyIGhhcyAwIGxpdmUgc2hpcHNcblx0XHRcdFx0XHRjb21wb25lbnQ6IFwiamVsbHlNYW5hZ2VyXCIsXG5cdFx0XHRcdFx0cHJvcGVydGllczogbnVsbFxuXHRcdFx0XHR9XHRcdFxuXHRcdFx0XVxuXHRcdH1cblx0fSxcblx0b2JqZWN0cyA6IHtcblx0XHRhc3Rlcm9pZEZpZWxkIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vbWFuYWdlcnMvQXN0ZXJvaWRGaWVsZFwiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0Y291bnQgOiAyMFxuXHRcdFx0fSBcblx0XHR9LFxuXHRcdGplbGx5TWFuYWdlciA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0VudGl0eU1hbmFnZXJcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGVudGl0eVR5cGU6IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5c2hpcCcpLFxuXHRcdFx0XHRjb3VudDogMjVcblx0XHRcdH1cblx0XHR9LFxuXHRcdG11c2ljIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vc291bmQvTXVzaWNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHVybDogXCJodHRwczovL3NvdW5kY2xvdWQuY29tL3RoZWVsZWN0cm9jaGlwcGVycy90aGUtZW5kLW9mLW91ci1qb3VybmV5XCJcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdGFzdGVyb2lkc0plbGxpZXMgOiByZXF1aXJlKFwiLi9hc3Rlcm9pZHNKZWxsaWVzXCIpLFxuXHR0aXRsZXMgOiByZXF1aXJlKFwiLi90aXRsZXNcIiksXG5cdGludHJvIDogcmVxdWlyZShcIi4vaW50cm9cIilcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdGNvbmZpZyA6IHtcblx0XHRyIDogMTIwLFxuXHRcdGhlaWdodCA6IDYwLFxuXHRcdGNpcmN1bWZlcmVuY2UgOiA5MDAsXG5cdFx0Y2FtZXJhTXVsdGlwbGllciA6IDIsXG5cdFx0c2NvcmluZ0FuZFdpbm5pbmc6IHtcblx0XHRcdG1lc3NhZ2U6IFwiWW91IHNhdmVkIHRoaXMgc2VjdG9yPGJyLz5vbiB0byB0aGUgbmV4dCBsZXZlbC5cIixcblx0XHRcdG5leHRMZXZlbDogXCJhc3Rlcm9pZHNKZWxsaWVzXCIsXG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQvL0plbGx5IG1hbmFnZXIgaGFzIDAgbGl2ZSBzaGlwc1xuXHRcdFx0XHRcdGNvbXBvbmVudDogXCJqZWxseU1hbmFnZXJcIixcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiBudWxsXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHN0YXJzOiB7XG5cdFx0XHRjb3VudDogMzAwMFxuXHRcdH1cblx0fSxcblx0b2JqZWN0cyA6IHtcblx0XHRjeWxpbmRlckxpbmVzIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vY29tcG9uZW50cy9DeWxpbmRlckxpbmVzXCIpLFxuXHRcdFx0cHJvcGVydGllczoge31cblx0XHR9LFxuXHRcdGNhbWVyYUludHJvIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vY29tcG9uZW50cy9DYW1lcmFJbnRyb1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0c3BlZWQgOiAwLjk4NVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0amVsbHlNYW5hZ2VyIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vbWFuYWdlcnMvRW50aXR5TWFuYWdlclwiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0ZW50aXR5VHlwZTogcmVxdWlyZSgnLi4vZW50aXRpZXMvSmVsbHlzaGlwJyksXG5cdFx0XHRcdGNvdW50OiA1XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRtdXNpYyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL3NvdW5kL011c2ljXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR1cmw6IFwiaHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS90aGVlbGVjdHJvY2hpcHBlcnMvdGhlLXN1bi1pcy1yaXNpbmctY2hpcC1tdXNpY1wiXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xuXHRjb25maWcgOiB7XG5cdFx0XG5cdH0sXG5cdG9iamVjdHMgOiB7XG5cdFx0dGl0bGVzIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vY29tcG9uZW50cy9UaXRsZXNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fVxuXHRcdH0sXG5cdFx0bXVzaWMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9zb3VuZC9NdXNpY1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0dXJsOiBcImh0dHBzOi8vc291bmRjbG91ZC5jb20vdGhlZWxlY3Ryb2NoaXBwZXJzL2NoaXB0dW5lLXNwYWNlXCIsXG5cdFx0XHRcdHN0YXJ0VGltZTogMTIsXG5cdFx0XHRcdHZvbHVtZTogMVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTsiLCJ2YXIgQXN0ZXJvaWQgPSByZXF1aXJlKCcuLi9lbnRpdGllcy9Bc3Rlcm9pZCcpO1xuXG52YXIgQXN0ZXJvaWRGaWVsZCA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5hc3Rlcm9pZHMgPSBbXTtcblx0dGhpcy5tYXhSYWRpdXMgPSA1MDtcblx0dGhpcy5vcmlnaW5DbGVhcmFuY2UgPSAzMDtcblx0dGhpcy5jb3VudCA9IDIwO1xuXHRcblx0Xy5leHRlbmQoIHRoaXMsIHByb3BlcnRpZXMgKSA7XG5cdFxuXHR0aGlzLmdlbmVyYXRlKCB0aGlzLmNvdW50ICk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcblx0dGhpcy5wb2VtLmd1bi5zZXRCYXJyaWVyQ29sbGlkZXIoIHRoaXMuYXN0ZXJvaWRzICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzdGVyb2lkRmllbGQ7XG5cbkFzdGVyb2lkRmllbGQucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0XG5cdFx0dmFyIGksIHgsIHksIGhlaWdodCwgd2lkdGgsIHJhZGl1cztcblx0XHRcblx0XHRoZWlnaHQgPSB0aGlzLnBvZW0uaGVpZ2h0ICogNDtcblx0XHR3aWR0aCA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdFxuXHRcdGZvciggaT0wOyBpIDwgY291bnQ7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0ZG8ge1xuXHRcdFx0XHRcblx0XHRcdFx0eCA9IE1hdGgucmFuZG9tKCkgKiB3aWR0aDtcblx0XHRcdFx0eSA9IE1hdGgucmFuZG9tKCkgKiBoZWlnaHQgLSAoaGVpZ2h0IC8gMik7XG5cdFx0XHRcblx0XHRcdFx0cmFkaXVzID0gTWF0aC5yYW5kb20oKSAqIHRoaXMubWF4UmFkaXVzO1xuXHRcdFx0XHRcblx0XHRcdH0gd2hpbGUoXG5cdFx0XHRcdHRoaXMuY2hlY2tDb2xsaXNpb24oIHgsIHksIHJhZGl1cyApICYmXG5cdFx0XHRcdHRoaXMuY2hlY2tGcmVlT2ZPcmlnaW4oIHgsIHksIHJhZGl1cyApXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmFzdGVyb2lkcy5wdXNoKFxuXHRcdFx0XHRuZXcgQXN0ZXJvaWQoIHRoaXMucG9lbSwgeCwgeSwgcmFkaXVzIClcblx0XHRcdCk7XG5cdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmFzdGVyb2lkcywgZnVuY3Rpb24oYXN0ZXJvaWQpIHtcblx0XHRcdFxuXHRcdFx0YXN0ZXJvaWQudXBkYXRlKCBlICk7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHRpZiggIXRoaXMucG9lbS5zaGlwLmRlYWQgJiYgIXRoaXMucG9lbS5zaGlwLmludnVsbmVyYWJsZSApIHtcblx0XHRcdHZhciBzaGlwQ29sbGlzaW9uID0gdGhpcy5jaGVja0NvbGxpc2lvbihcblx0XHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueCxcblx0XHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueSxcblx0XHRcdFx0MlxuXHRcdFx0KTtcblx0XHRcblx0XHRcdGlmKCBzaGlwQ29sbGlzaW9uICkge1xuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5raWxsKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0Y2hlY2tGcmVlT2ZPcmlnaW4gOiBmdW5jdGlvbiggeCwgeSwgcmFkaXVzICkge1xuXHRcdHJldHVybiBNYXRoLnNxcnQoeCp4ICsgeSp5KSA+IHJhZGl1cyArIHRoaXMub3JpZ2luQ2xlYXJhbmNlO1xuXHR9LFxuXHRcblx0Y2hlY2tDb2xsaXNpb24gOiBmdW5jdGlvbiggeCwgeSwgcmFkaXVzICkge1xuXHRcdFxuXHRcdHZhciBjb2xsaXNpb24gPSBfLmZpbmQoIHRoaXMuYXN0ZXJvaWRzLCBmdW5jdGlvbiggYXN0ZXJvaWQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkeCwgZHksIGRpc3RhbmNlO1xuXHRcdFx0XG5cdFx0XHRkeCA9IHRoaXMucG9lbS5jb29yZGluYXRlcy5jaXJjdW1mZXJlbmNlRGlzdGFuY2UoIHgsIGFzdGVyb2lkLnBvc2l0aW9uLnggKTtcblx0XHRcdGR5ID0geSAtIGFzdGVyb2lkLnBvc2l0aW9uLnk7XG5cdFx0XHRcblx0XHRcdGRpc3RhbmNlID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcblxuXHRcdFx0cmV0dXJuIGRpc3RhbmNlIDwgcmFkaXVzICsgYXN0ZXJvaWQucmFkaXVzO1xuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0cmV0dXJuICEhY29sbGlzaW9uO1xuXHR9XG59OyIsInZhciBDb2xsaWRlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0NvbGxpZGVyJyk7XG52YXIgRGVmYXVsdEplbGx5U2hpcCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5U2hpcCcpO1xudmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xuXG52YXIgRW50aXR5TWFuYWdlciA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5lbnRpdHlUeXBlID0gRGVmYXVsdEplbGx5U2hpcDtcblx0dGhpcy5jb3VudCA9IDIwO1xuXHR0aGlzLmVudGl0aWVzID0gW107XG5cdHRoaXMubGl2ZUVudGl0aWVzID0gW107XG5cdHRoaXMub3JpZ2luQ2xlYXJhbmNlID0gMzAwO1xuXHR0aGlzLnNoYXJlZCA9IHt9O1xuXHR0aGlzLndpbkNoZWNrID0gbnVsbDtcblx0XHRcblx0Xy5leHRlbmQoIHRoaXMsIHByb3BlcnRpZXMgKTtcblx0XG5cdGlmKCBfLmlzRnVuY3Rpb24oIHRoaXMuZW50aXR5VHlwZS5wcm90b3R5cGUuaW5pdFNoYXJlZEFzc2V0cyApICkge1xuXHRcdHRoaXMuZW50aXR5VHlwZS5wcm90b3R5cGUuaW5pdFNoYXJlZEFzc2V0cyggdGhpcyApO1xuXHR9XG5cdHRoaXMuZ2VuZXJhdGUoIHRoaXMuY291bnQgKTtcblx0dGhpcy5jb25maWd1cmVDb2xsaWRlcigpO1xuXG5cdHRoaXMuYm91bmRVcGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLmJvdW5kVXBkYXRlICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVudGl0eU1hbmFnZXI7XG5cbkVudGl0eU1hbmFnZXIucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0XG5cdFx0dmFyIGksIHgsIHksIGhlaWdodCwgd2lkdGgsIGVudGl0eTtcblx0XHRcblx0XHRoZWlnaHQgPSB0aGlzLnBvZW0uaGVpZ2h0ICogNDtcblx0XHR3aWR0aCA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdFxuXHRcdGZvciggaT0wOyBpIDwgY291bnQ7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0eCA9IE1hdGgucmFuZG9tKCkgKiB3aWR0aDtcblx0XHRcdHkgPSBNYXRoLnJhbmRvbSgpICogaGVpZ2h0IC0gKGhlaWdodCAvIDIpO1xuXHRcdFx0XG5cdFx0XHRlbnRpdHkgPSBuZXcgdGhpcy5lbnRpdHlUeXBlKCB0aGlzLnBvZW0sIHRoaXMsIHgsIHkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5lbnRpdGllcy5wdXNoKCBlbnRpdHkgKTtcblx0XHRcdHRoaXMubGl2ZUVudGl0aWVzLnB1c2goIGVudGl0eSApO1xuXHRcdFxuXHRcdH1cblx0XHRcblx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0RW5lbWllcyggY291bnQgKTtcblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2goIGUgKTtcblx0XHRcblx0XHRcblx0fSxcblx0XG5cdGtpbGxFbnRpdHkgOiBmdW5jdGlvbiggZW50aXR5ICkge1xuXHRcdFxuXHRcdHZhciBpID0gdGhpcy5saXZlRW50aXRpZXMuaW5kZXhPZiggZW50aXR5ICk7XG5cdFx0XG5cdFx0aWYoIGkgPj0gMCApIHtcblx0XHRcdHRoaXMubGl2ZUVudGl0aWVzLnNwbGljZSggaSwgMSApO1xuXHRcdH1cblx0XHRcblx0XHRlbnRpdHkua2lsbCgpO1xuXHRcdFxuXHRcdGlmKCB0aGlzLndpbkNoZWNrICYmIHRoaXMubGl2ZUVudGl0aWVzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdHRoaXMud2luQ2hlY2sucmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkKCk7XG5cdFx0XHR0aGlzLndpbkNoZWNrID0gbnVsbDtcblx0XHR9XG5cdH0sXG5cdFxuXHRjb25maWd1cmVDb2xsaWRlciA6IGZ1bmN0aW9uKCkge1xuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUVudGl0aWVzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucG9lbS5ndW4ubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGVudGl0eSwgYnVsbGV0KSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLmtpbGxFbnRpdHkoIGVudGl0eSApO1xuXHRcdFx0XHR0aGlzLnBvZW0uZ3VuLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdFNjb3JlKFxuXHRcdFx0XHRcdGVudGl0eS5zY29yZVZhbHVlLFxuXHRcdFx0XHRcdFwiK1wiICsgZW50aXR5LnNjb3JlVmFsdWUgKyBcIiBcIiArIGVudGl0eS5uYW1lLCBcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcImNvbG9yXCIgOiBlbnRpdHkuY3NzQ29sb3Jcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMucG9lbS5zY29yaW5nQW5kV2lubmluZy5hZGp1c3RFbmVtaWVzKCAtMSApO1xuXHRcdFx0XHRcblx0XHRcdH0uYmluZCh0aGlzKVxuXHRcdFx0XG5cdFx0KTtcblx0XHRcblx0XHRuZXcgQ29sbGlkZXIoXG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmxpdmVFbnRpdGllcztcblx0XHRcdH0uYmluZCh0aGlzKSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBbdGhpcy5wb2VtLnNoaXBdO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbihlbnRpdHksIGJ1bGxldCkge1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoICF0aGlzLnBvZW0uc2hpcC5kZWFkICYmICF0aGlzLnBvZW0uc2hpcC5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhpcy5raWxsRW50aXR5KCBlbnRpdHkgKTtcblx0XHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5raWxsKCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdEVuZW1pZXMoIC0xICk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0XG5cdFx0XHRcdFxuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHRcdFxuXHR9LFxuXHRcblx0d2F0Y2hGb3JDb21wbGV0aW9uIDogZnVuY3Rpb24oIHdpbkNoZWNrLCBwcm9wZXJ0aWVzICkge1xuXHRcdHRoaXMud2luQ2hlY2sgPSB3aW5DaGVjaztcblx0fVxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggRW50aXR5TWFuYWdlci5wcm90b3R5cGUgKTsiLCJ2YXIgQnVsbGV0ID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvQnVsbGV0Jyk7XG52YXIgQ29sbGlkZXIgPSByZXF1aXJlKCcuLi91dGlscy9Db2xsaWRlcicpO1xudmFyIFNvdW5kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi4vc291bmQvU291bmRHZW5lcmF0b3InKTtcblxudmFyIEd1biA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdHRoaXMuc291bmQgPSBudWxsO1xuXHRcblx0dGhpcy5jb3VudCA9IDM1MDtcblx0dGhpcy5idWxsZXRBZ2UgPSA1MDAwO1xuXHR0aGlzLmZpcmVEZWxheU1pbGxpc2Vjb25kcyA9IDEwMDtcblx0dGhpcy5sYXN0RmlyZVRpbWVzdGFtcCA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHR0aGlzLmxpdmVCdWxsZXRzID0gW107XG5cdHRoaXMuYnVsbGV0cyA9IFtdO1xuXHR0aGlzLmJvcm5BdCA9IDA7XG5cblx0dGhpcy5hZGRPYmplY3QoKTtcblx0dGhpcy5hZGRTb3VuZCgpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEd1bjtcblxuR3VuLnByb3RvdHlwZSA9IHtcblx0XG5cdGZpcmUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgaXNEZWFkID0gZnVuY3Rpb24oIGJ1bGxldCApIHtcblx0XHRcdHJldHVybiAhYnVsbGV0LmFsaXZlO1xuXHRcdH07XG5cdFx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKHgsIHksIHNwZWVkLCB0aGV0YSkge1xuXHRcdFx0XG5cdFx0XHR2YXIgbm93ID0gdGhpcy5wb2VtLmNsb2NrLnRpbWU7XG5cdFx0XHRcblx0XHRcdGlmKCBub3cgLSB0aGlzLmxhc3RGaXJlVGltZXN0YW1wIDwgdGhpcy5maXJlRGVsYXlNaWxsaXNlY29uZHMgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dGhpcy5sYXN0RmlyZVRpbWVzdGFtcCA9IG5vdztcblx0XHRcblx0XHRcdHZhciBidWxsZXQgPSBfLmZpbmQoIHRoaXMuYnVsbGV0cywgaXNEZWFkICk7XG5cdFx0XG5cdFx0XHRpZiggIWJ1bGxldCApIHJldHVybjtcblx0XHRcblx0XHRcdHRoaXMubGl2ZUJ1bGxldHMucHVzaCggYnVsbGV0ICk7XG5cdFx0XG5cdFx0XHRidWxsZXQuZmlyZSh4LCB5LCBzcGVlZCwgdGhldGEpO1xuXG5cblx0XHRcdHZhciBmcmVxID0gMTkwMDtcblx0XHRcdFxuXHRcdFx0Ly9TdGFydCBzb3VuZFxuXHRcdFx0dGhpcy5zb3VuZC5zZXRHYWluKDAuMSwgMCwgMC4wMDEpO1xuXHRcdFx0dGhpcy5zb3VuZC5zZXRGcmVxdWVuY3koZnJlcSwgMCwgMCk7XG5cdFx0XHRcblxuXHRcdFx0Ly9FbmQgc291bmRcblx0XHRcdHRoaXMuc291bmQuc2V0R2FpbigwLCAwLjAxLCAwLjA1KTtcblx0XHRcdHRoaXMuc291bmQuc2V0RnJlcXVlbmN5KGZyZXEgKiAwLjEsIDAuMDEsIDAuMDUpO1xuXHRcdFx0XG5cdFx0fTtcblx0fSgpLFxuXHRcblx0Z2VuZXJhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciB2ZXJ0ZXgsIGJ1bGxldDtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHR2ZXJ0ZXggPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFx0YnVsbGV0ID0gbmV3IEJ1bGxldCggdGhpcy5wb2VtLCB0aGlzLCB2ZXJ0ZXggKTtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggdmVydGV4ICk7XG5cdFx0XHR0aGlzLmJ1bGxldHMucHVzaCggYnVsbGV0ICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGtpbGxCdWxsZXQgOiBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFxuXHRcdHZhciBpID0gdGhpcy5saXZlQnVsbGV0cy5pbmRleE9mKCBidWxsZXQgKTtcblx0XHRcblx0XHRpZiggaSA+PSAwICkge1xuXHRcdFx0dGhpcy5saXZlQnVsbGV0cy5zcGxpY2UoIGksIDEgKTtcblx0XHR9XG5cdFx0XG5cdFx0YnVsbGV0LmtpbGwoKTtcblx0XHRcblx0XHRpZiggdGhpcy5vYmplY3QgKSB0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmdlbmVyYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRuZXcgVEhSRUUuUG9pbnRDbG91ZE1hdGVyaWFsKHtcblx0XHRcdFx0IHNpemU6IDEgKiB0aGlzLnBvZW0ucmF0aW8sXG5cdFx0XHRcdCBjb2xvcjogMHhmZjAwMDBcblx0XHRcdH1cblx0XHQpKTtcblx0XHR0aGlzLm9iamVjdC5mcnVzdHVtQ3VsbGVkID0gZmFsc2U7XG5cdFx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKSA7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApICB7XG5cdFx0dmFyIGJ1bGxldCwgdGltZTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaTx0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWxsZXQgPSB0aGlzLmxpdmVCdWxsZXRzW2ldO1xuXHRcdFx0XG5cdFx0XHRpZihidWxsZXQuYm9ybkF0ICsgdGhpcy5idWxsZXRBZ2UgPCBlLnRpbWUpIHtcblx0XHRcdFx0dGhpcy5raWxsQnVsbGV0KCBidWxsZXQgKTtcblx0XHRcdFx0aS0tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVsbGV0LnVwZGF0ZSggZS5kdCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZih0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0c2V0QmFycmllckNvbGxpZGVyIDogZnVuY3Rpb24oIGNvbGxlY3Rpb24gKSB7XG5cdFx0XG5cdFx0Ly9Db2xsaWRlIGJ1bGxldHMgd2l0aCBhc3Rlcm9pZHNcblx0XHRuZXcgQ29sbGlkZXIoXG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb2xsZWN0aW9uO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGJhcnJpZXIsIGJ1bGxldCkge1xuXHRcdFx0XHR0aGlzLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLnNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNxdWFyZVwiICksXG5cdFx0XHRzb3VuZC5tYWtlR2FpbigpLFxuXHRcdFx0c291bmQuZ2V0RGVzdGluYXRpb24oKVxuXHRcdF0pO1xuXHRcdFxuXHRcdHNvdW5kLnNldEdhaW4oMCwwLDApO1xuXHRcdHNvdW5kLnN0YXJ0KCk7XG5cdFx0XG5cdH1cbn07IiwidmFyIHNvdW5kY2xvdWQgPSByZXF1aXJlKCdzb3VuZGNsb3VkLWJhZGdlJyk7XG5cbnZhciBNdXNpYyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXG5cdGlmKHdpbmRvdy5sb2NhdGlvbi5oYXNoID09PSBcIiNtdXNpY29mZlwiKSByZXR1cm47XG5cblx0dmFyIGF1ZGlvO1xuXHR2YXIgYWxpdmUgPSB0cnVlO1xuXG5cdHNvdW5kY2xvdWQoe1xuXHRcdGNsaWVudF9pZDogJzYwNTdjOWFmODYyYmYyNDVkNGM0MDIxNzllMzE3ZjUyJyxcblx0XHRzb25nOiBwcm9wZXJ0aWVzLnVybCxcblx0XHRkYXJrOiBmYWxzZSxcblx0XHRnZXRGb250czogZmFsc2Vcblx0fSwgZnVuY3Rpb24oZXJyLCBzcmMsIGRhdGEsIGRpdikge1xuXG5cdFx0aWYoICFhbGl2ZSApIHJldHVybjtcblx0XHRpZiggZXJyICkgdGhyb3cgZXJyO1xuXG5cdFx0YXVkaW8gPSBuZXcgQXVkaW8oKTtcblx0XHRhdWRpby5zcmMgPSBzcmM7XG5cdFx0YXVkaW8ucGxheSgpO1xuXHRcdGF1ZGlvLmxvb3AgPSB0cnVlO1xuXHRcdGF1ZGlvLnZvbHVtZSA9IHByb3BlcnRpZXMudm9sdW1lIHx8IDAuNjtcblx0XHRcblx0XHQkKGF1ZGlvKS5vbignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbigpIHtcblx0XHRcdGF1ZGlvLmN1cnJlbnRUaW1lID0gcHJvcGVydGllcy5zdGFydFRpbWUgfHwgMDtcblx0XHR9KTtcblx0XHRcblx0XHR2YXIgcGxheWluZyA9IHRydWU7XG5cdFx0XG5cdFx0JCh3aW5kb3cpLm9uKCdrZXlkb3duLk11c2ljJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0aWYoIGUua2V5Q29kZSAhPT0gODMgKSByZXR1cm47XG5cdFx0XHRpZiggcGxheWluZyApIHtcblx0XHRcdFx0YXVkaW8ucGF1c2UoKTtcblx0XHRcdFx0cGxheWluZyA9IGZhbHNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXVkaW8ucGxheSgpO1xuXHRcdFx0XHRwbGF5aW5nID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cdFxuXHRwb2VtLm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKSB7XG5cdFx0aWYoYXVkaW8pIHtcblx0XHRcdGF1ZGlvLnBhdXNlKCk7XG5cdFx0XHRhdWRpbyA9IG51bGw7XG5cdFx0fVxuXHRcdCQod2luZG93KS5vZmYoJ2tleWRvd24uTXVzaWMnKTtcblx0XHQkKCcubnBtLXNjYi13aGl0ZScpLnJlbW92ZSgpO1xuXHR9KTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE11c2ljOyIsInZhciBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xudmFyIGNvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQgfHwgbnVsbDtcblxudmFyIFNvdW5kR2VuZXJhdG9yID0gZnVuY3Rpb24oKSB7XG5cdFxuXHR0aGlzLmVuYWJsZWQgPSBjb250ZXh0ICE9PSB1bmRlZmluZWQ7XG5cdFxuXHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFxuXHR0aGlzLnRvdGFsQ3JlYXRlZCsrO1xuXHR0aGlzLnRvdGFsQ3JlYXRlZFNxID0gdGhpcy50b3RhbENyZWF0ZWQgKiB0aGlzLnRvdGFsQ3JlYXRlZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU291bmRHZW5lcmF0b3I7XG5cblNvdW5kR2VuZXJhdG9yLnByb3RvdHlwZSA9IHtcblx0XG5cdGNvbnRleHQgOiBjb250ZXh0ID8gbmV3IGNvbnRleHQoKSA6IHVuZGVmaW5lZCxcblx0XG5cdG1ha2VQaW5rTm9pc2UgOiBmdW5jdGlvbiggYnVmZmVyU2l6ZSApIHtcblx0XG5cdFx0dmFyIGIwLCBiMSwgYjIsIGIzLCBiNCwgYjUsIGI2LCBub2RlOyBcblx0XHRcblx0XHRiMCA9IGIxID0gYjIgPSBiMyA9IGI0ID0gYjUgPSBiNiA9IDAuMDtcblx0XHRub2RlID0gdGhpcy5waW5rTm9pc2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIDEsIDEpO1xuXHRcdFxuXHRcdG5vZGUub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRcblx0XHRcdC8vIGh0dHA6Ly9ub2lzZWhhY2suY29tL2dlbmVyYXRlLW5vaXNlLXdlYi1hdWRpby1hcGkvXG5cdFx0XHR2YXIgb3V0cHV0ID0gZS5vdXRwdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cdFx0XHRcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyU2l6ZTsgaSsrKSB7XG5cdFx0XHRcdHZhciB3aGl0ZSA9IE1hdGgucmFuZG9tKCkgKiAyIC0gMTtcblx0XHRcdFx0YjAgPSAwLjk5ODg2ICogYjAgKyB3aGl0ZSAqIDAuMDU1NTE3OTtcblx0XHRcdFx0YjEgPSAwLjk5MzMyICogYjEgKyB3aGl0ZSAqIDAuMDc1MDc1OTtcblx0XHRcdFx0YjIgPSAwLjk2OTAwICogYjIgKyB3aGl0ZSAqIDAuMTUzODUyMDtcblx0XHRcdFx0YjMgPSAwLjg2NjUwICogYjMgKyB3aGl0ZSAqIDAuMzEwNDg1Njtcblx0XHRcdFx0YjQgPSAwLjU1MDAwICogYjQgKyB3aGl0ZSAqIDAuNTMyOTUyMjtcblx0XHRcdFx0YjUgPSAtMC43NjE2ICogYjUgLSB3aGl0ZSAqIDAuMDE2ODk4MDtcblx0XHRcdFx0b3V0cHV0W2ldID0gYjAgKyBiMSArIGIyICsgYjMgKyBiNCArIGI1ICsgYjYgKyB3aGl0ZSAqIDAuNTM2Mjtcblx0XHRcdFx0b3V0cHV0W2ldICo9IDAuMTE7IC8vIChyb3VnaGx5KSBjb21wZW5zYXRlIGZvciBnYWluXG5cdFx0XHRcdGI2ID0gd2hpdGUgKiAwLjExNTkyNjtcblx0XHRcdH1cblx0XHR9O1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXHRcblx0fSxcblx0XG5cdG1ha2VPc2NpbGxhdG9yIDogZnVuY3Rpb24oIHR5cGUsIGZyZXF1ZW5jeSApIHtcblx0XHQvKlxuXHRcdFx0ZW51bSBPc2NpbGxhdG9yVHlwZSB7XG5cdFx0XHQgIFwic2luZVwiLFxuXHRcdFx0ICBcInNxdWFyZVwiLFxuXHRcdFx0ICBcInNhd3Rvb3RoXCIsXG5cdFx0XHQgIFwidHJpYW5nbGVcIixcblx0XHRcdCAgXCJjdXN0b21cIlxuXHRcdFx0fVxuXHRcdCovXG5cdFx0XG5cdFx0dmFyIG5vZGUgPSB0aGlzLm9zY2lsbGF0b3IgPSB0aGlzLmNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xuXHRcdFxuXHRcdG5vZGUudHlwZSA9IHR5cGUgfHwgXCJzYXd0b290aFwiO1xuXHRcdG5vZGUuZnJlcXVlbmN5LnZhbHVlID0gZnJlcXVlbmN5IHx8IDIwMDA7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdFxuXHRtYWtlR2FpbiA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBub2RlID0gdGhpcy5nYWluID0gdGhpcy5jb250ZXh0LmNyZWF0ZUdhaW4oKTtcblx0XHRcblx0XHRub2RlLmdhaW4udmFsdWUgPSAxO1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRcblx0bWFrZVBhbm5lciA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHRoaXMuY29udGV4dC5saXN0ZW5lci5zZXRQb3NpdGlvbigwLCAwLCAwKTtcblx0XHRcblx0XHR2YXIgbm9kZSA9IHRoaXMucGFubmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZVBhbm5lcigpO1xuXHRcdFxuXHRcdG5vZGUucGFubmluZ01vZGVsID0gJ2VxdWFscG93ZXInO1xuXHRcdG5vZGUuY29uZU91dGVyR2FpbiA9IDAuMTtcblx0XHRub2RlLmNvbmVPdXRlckFuZ2xlID0gMTgwO1xuXHRcdG5vZGUuY29uZUlubmVyQW5nbGUgPSAwO1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRcblx0bWFrZUJhbmRwYXNzIDogZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgbm9kZSA9IHRoaXMuYmFuZHBhc3MgPSB0aGlzLmNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG5cdFx0XG5cdFx0bm9kZS50eXBlID0gXCJiYW5kcGFzc1wiO1xuXHRcdG5vZGUuZnJlcXVlbmN5LnZhbHVlID0gNDQwO1xuXHRcdG5vZGUuUS52YWx1ZSA9IDAuNTtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblxuXHR9LFxuXHRcblx0Z2V0RGVzdGluYXRpb24gOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uO1xuXHR9LFxuXHRcblx0Y29ubmVjdE5vZGVzIDogZnVuY3Rpb24oIG5vZGVzICkge1xuXHRcdF8uZWFjaCggXy5yZXN0KCBub2RlcyApLCBmdW5jdGlvbihub2RlLCBpLCBsaXN0KSB7XG5cdFx0XHR2YXIgcHJldk5vZGUgPSBub2Rlc1tpXTtcblx0XHRcdFxuXHRcdFx0cHJldk5vZGUuY29ubmVjdCggbm9kZSApO1xuXHRcdH0pO1xuXHR9LFxuXHRcblx0c3RhcnQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm9zY2lsbGF0b3Iuc3RhcnQoMCk7XG5cdH0sXG5cdFxuXHR0b3RhbENyZWF0ZWQgOiAwLFxuXHRcblx0c2V0RnJlcXVlbmN5IDogZnVuY3Rpb24gKCBmcmVxdWVuY3ksIGRlbGF5LCBzcGVlZCApIHtcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0XG5cdFx0dGhpcy5vc2NpbGxhdG9yLmZyZXF1ZW5jeS5zZXRUYXJnZXRBdFRpbWUoZnJlcXVlbmN5LCB0aGlzLmNvbnRleHQuY3VycmVudFRpbWUgKyBkZWxheSwgc3BlZWQpO1xuXHR9LFxuXHRcblx0c2V0UG9zaXRpb24gOiBmdW5jdGlvbiAoIHgsIHksIHogKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdHRoaXMucGFubmVyLnNldFBvc2l0aW9uKCB4LCB5LCB6ICk7XG5cdH0sXG5cdFxuXHRzZXRHYWluIDogZnVuY3Rpb24gKCBnYWluLCBkZWxheSwgc3BlZWQgKSB7XG5cdFx0XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdFxuXHRcdC8vIE1hdGgubWF4KCBNYXRoLmFicyggZ2FpbiApLCAxKTtcblx0XHQvLyBnYWluIC8gdGhpcy50b3RhbENyZWF0ZWRTcTtcblx0XHRcdFx0XG5cdFx0dGhpcy5nYWluLmdhaW4uc2V0VGFyZ2V0QXRUaW1lKFxuXHRcdFx0Z2Fpbixcblx0XHRcdHRoaXMuY29udGV4dC5jdXJyZW50VGltZSArIGRlbGF5LFxuXHRcdFx0c3BlZWRcblx0XHQpO1xuXHR9LFxuXHRcblx0c2V0QmFuZHBhc3NRIDogZnVuY3Rpb24gKCBRICkge1xuXHRcdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XHR0aGlzLmJhbmRwYXNzLlEuc2V0VGFyZ2V0QXRUaW1lKFEsIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSwgMC4xKTtcblx0fSxcblx0XG5cdHNldEJhbmRwYXNzRnJlcXVlbmN5IDogZnVuY3Rpb24gKCBmcmVxdWVuY3kgKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdHRoaXMuYmFuZHBhc3MuZnJlcXVlbmN5LnNldFRhcmdldEF0VGltZShmcmVxdWVuY3ksIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSwgMC4xKTtcblx0fVxufTsiLCJ2YXIgQ2xvY2sgPSBmdW5jdGlvbiggYXV0b3N0YXJ0ICkge1xuXG5cdHRoaXMubWF4RHQgPSA2MDtcblx0dGhpcy5taW5EdCA9IDE2O1xuXHR0aGlzLnBUaW1lID0gMDtcblx0dGhpcy50aW1lID0gMDtcblx0XG5cdGlmKGF1dG9zdGFydCAhPT0gZmFsc2UpIHtcblx0XHR0aGlzLnN0YXJ0KCk7XG5cdH1cblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsb2NrO1xuXG5DbG9jay5wcm90b3R5cGUgPSB7XG5cblx0c3RhcnQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnBUaW1lID0gRGF0ZS5ub3coKTtcblx0fSxcblx0XG5cdGdldERlbHRhIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vdywgZHQ7XG5cdFx0XG5cdFx0bm93ID0gRGF0ZS5ub3coKTtcblx0XHRkdCA9IG5vdyAtIHRoaXMucFRpbWU7XG5cdFx0XG5cdFx0ZHQgPSBNYXRoLm1pbiggZHQsIHRoaXMubWF4RHQgKTtcblx0XHRkdCA9IE1hdGgubWF4KCBkdCwgdGhpcy5taW5EdCApO1xuXHRcdFxuXHRcdHRoaXMudGltZSArPSBkdDtcblx0XHR0aGlzLnBUaW1lID0gbm93O1xuXHRcdFxuXHRcdHJldHVybiBkdDtcblx0fVxuXHRcbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG5cbnZhciBDb2xsaWRlciA9IGZ1bmN0aW9uKCBwb2VtLCBnZXRDb2xsZWN0aW9uQSwgZ2V0Q29sbGVjdGlvbkIsIG9uQ29sbGlzaW9uICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHRoaXMuZ2V0Q29sbGVjdGlvbkEgPSBnZXRDb2xsZWN0aW9uQTtcblx0dGhpcy5nZXRDb2xsZWN0aW9uQiA9IGdldENvbGxlY3Rpb25CO1xuXHR0aGlzLm9uQ29sbGlzaW9uID0gb25Db2xsaXNpb247XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGlkZXI7XG5cbkNvbGxpZGVyLnByb3RvdHlwZSA9IHtcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXG5cdFx0dmFyIGNvbGxpc2lvbnMgPSBbXTtcblxuXHRcdF8uZWFjaCggdGhpcy5nZXRDb2xsZWN0aW9uQSgpLCBmdW5jdGlvbiggaXRlbUZyb21BICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgY29sbGlkZWRJdGVtRnJvbUIgPSBfLmZpbmQoIHRoaXMuZ2V0Q29sbGVjdGlvbkIoKSwgZnVuY3Rpb24oIGl0ZW1Gcm9tQiApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZHgsIGR5LCBkaXN0YW5jZTtcblx0XHRcdFxuXHRcdFx0XHRkeCA9IHRoaXMucG9lbS5jb29yZGluYXRlcy5jaXJjdW1mZXJlbmNlRGlzdGFuY2UoIGl0ZW1Gcm9tQS5wb3NpdGlvbi54LCBpdGVtRnJvbUIucG9zaXRpb24ueCApO1xuXHRcdFx0XHRkeSA9IGl0ZW1Gcm9tQS5wb3NpdGlvbi55IC0gaXRlbUZyb21CLnBvc2l0aW9uLnk7XG5cdFx0XHRcblx0XHRcdFx0ZGlzdGFuY2UgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXHRcdFx0XHRcblx0XHRcdFxuXHRcdFx0XHRyZXR1cm4gZGlzdGFuY2UgPCBpdGVtRnJvbUEucmFkaXVzICsgaXRlbUZyb21CLnJhZGl1cztcblx0XHRcdFx0XG5cdFx0XHR9LCB0aGlzKTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHRpZiggY29sbGlkZWRJdGVtRnJvbUIgKSB7XG5cdFx0XHRcdGNvbGxpc2lvbnMucHVzaChbaXRlbUZyb21BLCBjb2xsaWRlZEl0ZW1Gcm9tQl0pO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0Xy5lYWNoKCBjb2xsaXNpb25zLCBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0XHR0aGlzLm9uQ29sbGlzaW9uKCBpdGVtc1swXSwgaXRlbXNbMV0gKTtcblx0XHR9LCB0aGlzKTtcblx0fVxuXHRcbn07IiwiLy8gVHJhbnNsYXRlcyAyZCBwb2ludHMgaW50byAzZCBwb2xhciBzcGFjZVxuXG52YXIgQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy50d29SU3F1YXJlZCA9IDIgKiAodGhpcy5wb2VtLnIgKiB0aGlzLnBvZW0ucik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvb3JkaW5hdGVzO1xuXG5Db29yZGluYXRlcy5wcm90b3R5cGUgPSB7XG5cdFxuXHR4IDogZnVuY3Rpb24oIHggKSB7XG5cdFx0cmV0dXJuIE1hdGguc2luKCB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdH0sXG5cdFxuXHR5IDogZnVuY3Rpb24oIHkgKSB7XG5cdFx0cmV0dXJuIHk7XG5cdH0sXG5cdFxuXHR6IDogZnVuY3Rpb24oIHggKSB7XG5cdFx0cmV0dXJuIE1hdGguY29zKCB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdH0sXG5cdFxuXHRyIDogZnVuY3Rpb24oeCwgeikge1xuXHRcdHJldHVybiBNYXRoLnNxcnQoeCp4ICsgeip6KTtcblx0fSxcblx0XG5cdHRoZXRhIDogZnVuY3Rpb24oeCwgeikge1xuXHRcdHJldHVybiBNYXRoLmF0YW4oIHogLyB4ICk7XG5cdH0sXG5cdFxuXHRzZXRWZWN0b3IgOiBmdW5jdGlvbiggdmVjdG9yICkge1xuXHRcdFxuXHRcdHZhciB4LCB5LCB2ZWN0b3IyO1xuXHRcdFxuXHRcdGlmKCB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcIm51bWJlclwiICkge1xuXHRcdFx0XG5cdFx0XHR4ID0gYXJndW1lbnRzWzFdO1xuXHRcdFx0eSA9IGFyZ3VtZW50c1syXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh4KSxcblx0XHRcdFx0eSxcblx0XHRcdFx0dGhpcy56KHgpXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dmVjdG9yMiA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh2ZWN0b3IyLngpLFxuXHRcdFx0XHR2ZWN0b3IyLnksXG5cdFx0XHRcdHRoaXMueih2ZWN0b3IyLngpXG5cdFx0XHQpO1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGdldFZlY3RvciA6IGZ1bmN0aW9uKCB4LCB5ICkge1xuXHRcdFxuXHRcdHZhciB2ZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdHJldHVybiB0aGlzLnNldFZlY3RvciggdmVjdG9yLCB4LCB5ICk7XG5cdFx0XG5cdH0sXG5cdFxuXHRrZWVwSW5SYW5nZVggOiBmdW5jdGlvbiggeCApIHtcblx0XHRpZiggeCA+PSAwICkge1xuXHRcdFx0cmV0dXJuIHggJSB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHggKyAoeCAlIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlKTtcblx0XHR9XG5cdH0sXG5cdFxuXHRrZWVwSW5SYW5nZVkgOiBmdW5jdGlvbiggeSApIHtcblx0XHRpZiggeSA+PSAwICkge1xuXHRcdFx0cmV0dXJuIHkgJSB0aGlzLnBvZW0uaGVpZ2h0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geSArICh5ICUgdGhpcy5wb2VtLmhlaWdodCk7XG5cdFx0fVxuXHR9LFxuXHRcblx0a2VlcEluUmFuZ2UgOiBmdW5jdGlvbiggdmVjdG9yICkge1xuXHRcdHZlY3Rvci54ID0gdGhpcy5rZWVwSW5SYW5nZVgoIHZlY3Rvci54ICk7XG5cdFx0dmVjdG9yLnkgPSB0aGlzLmtlZXBJblJhbmdlWCggdmVjdG9yLnkgKTtcblx0XHRyZXR1cm4gdmVjdG9yO1xuXHR9LFxuXHRcblx0dHdvWFRvVGhldGEgOiBmdW5jdGlvbiggeCApIHtcblx0XHRyZXR1cm4geCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdH0sXG5cdFxuXHRjaXJjdW1mZXJlbmNlRGlzdGFuY2UgOiBmdW5jdGlvbiAoeDEsIHgyKSB7XG5cdFx0XG5cdFx0dmFyIHJhdGlvID0gdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbztcblx0XHRcblx0XHRyZXR1cm4gdGhpcy50d29SU3F1YXJlZCAtIHRoaXMudHdvUlNxdWFyZWQgKiBNYXRoLmNvcyggeDEgKiByYXRpbyAtIHgyICogcmF0aW8gKTtcblx0XHRcblx0fVxuXHRcbn07XG4iLCIvKipcbiAqIEBhdXRob3IgbXJkb29iIC8gaHR0cDovL21yZG9vYi5jb20vXG4gKlxuICogTW9kaWZpY2F0aW9uczogR3JlZyBUYXR1bVxuICpcbiAqIHVzYWdlOlxuICogXG4gKiBcdFx0RXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggTXlPYmplY3QucHJvdG90eXBlICk7XG4gKiBcbiAqIFx0XHRNeU9iamVjdC5kaXNwYXRjaCh7XG4gKiBcdFx0XHR0eXBlOiBcImNsaWNrXCIsXG4gKiBcdFx0XHRkYXR1bTE6IFwiZm9vXCIsXG4gKiBcdFx0XHRkYXR1bTI6IFwiYmFyXCJcbiAqIFx0XHR9KTtcbiAqIFxuICogXHRcdE15T2JqZWN0Lm9uKCBcImNsaWNrXCIsIGZ1bmN0aW9uKCBldmVudCApIHtcbiAqIFx0XHRcdGV2ZW50LmRhdHVtMTsgLy9Gb29cbiAqIFx0XHRcdGV2ZW50LnRhcmdldDsgLy9NeU9iamVjdFxuICogXHRcdH0pO1xuICogXG4gKlxuICovXG5cbnZhciBFdmVudERpc3BhdGNoZXIgPSBmdW5jdGlvbiAoKSB7fTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZSA9IHtcblxuXHRjb25zdHJ1Y3RvcjogRXZlbnREaXNwYXRjaGVyLFxuXG5cdGFwcGx5OiBmdW5jdGlvbiAoIG9iamVjdCApIHtcblxuXHRcdG9iamVjdC5vblx0XHRcdFx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUub247XG5cdFx0b2JqZWN0Lmhhc0V2ZW50TGlzdGVuZXJcdFx0PSBFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmhhc0V2ZW50TGlzdGVuZXI7XG5cdFx0b2JqZWN0Lm9mZlx0XHRcdFx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUub2ZmO1xuXHRcdG9iamVjdC5kaXNwYXRjaFx0XHRcdFx0PSBFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmRpc3BhdGNoO1xuXG5cdH0sXG5cblx0b246IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgdGhpcy5fbGlzdGVuZXJzID0ge307XG5cblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXG5cdFx0aWYgKCBsaXN0ZW5lcnNbIHR5cGUgXSA9PT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHRsaXN0ZW5lcnNbIHR5cGUgXSA9IFtdO1xuXG5cdFx0fVxuXG5cdFx0aWYgKCBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApID09PSAtIDEgKSB7XG5cblx0XHRcdGxpc3RlbmVyc1sgdHlwZSBdLnB1c2goIGxpc3RlbmVyICk7XG5cblx0XHR9XG5cblx0fSxcblxuXHRoYXNFdmVudExpc3RlbmVyOiBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG5cdFx0aWYgKCB0aGlzLl9saXN0ZW5lcnMgPT09IHVuZGVmaW5lZCApIHJldHVybiBmYWxzZTtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdICE9PSB1bmRlZmluZWQgJiYgbGlzdGVuZXJzWyB0eXBlIF0uaW5kZXhPZiggbGlzdGVuZXIgKSAhPT0gLSAxICkge1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblxuXHR9LFxuXG5cdG9mZjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSByZXR1cm47XG5cblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXHRcdHZhciBsaXN0ZW5lckFycmF5ID0gbGlzdGVuZXJzWyB0eXBlIF07XG5cblx0XHRpZiAoIGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0dmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKCBsaXN0ZW5lciApO1xuXG5cdFx0XHRpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cblx0XHRcdFx0bGlzdGVuZXJBcnJheS5zcGxpY2UoIGluZGV4LCAxICk7XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHR9LFxuXG5cdGRpc3BhdGNoOiBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XG5cdFx0aWYgKCB0aGlzLl9saXN0ZW5lcnMgPT09IHVuZGVmaW5lZCApIHJldHVybjtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cdFx0dmFyIGxpc3RlbmVyQXJyYXkgPSBsaXN0ZW5lcnNbIGV2ZW50LnR5cGUgXTtcblxuXHRcdGlmICggbGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHRldmVudC50YXJnZXQgPSB0aGlzO1xuXG5cdFx0XHR2YXIgYXJyYXkgPSBbXTtcblx0XHRcdHZhciBsZW5ndGggPSBsaXN0ZW5lckFycmF5Lmxlbmd0aDtcblx0XHRcdHZhciBpO1xuXG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbmd0aDsgaSArKyApIHtcblxuXHRcdFx0XHRhcnJheVsgaSBdID0gbGlzdGVuZXJBcnJheVsgaSBdO1xuXG5cdFx0XHR9XG5cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICsrICkge1xuXG5cdFx0XHRcdGFycmF5WyBpIF0uY2FsbCggdGhpcywgZXZlbnQgKTtcblxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdH1cblxufTtcblxuaWYgKCB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyApIHtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IEV2ZW50RGlzcGF0Y2hlcjtcblxufSIsIi8qKlxuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgU3RhdHMgPSBmdW5jdGlvbiAoKSB7XG5cblx0dmFyIHN0YXJ0VGltZSA9IERhdGUubm93KCksIHByZXZUaW1lID0gc3RhcnRUaW1lO1xuXHR2YXIgbXMgPSAwLCBtc01pbiA9IEluZmluaXR5LCBtc01heCA9IDA7XG5cdHZhciBmcHMgPSAwLCBmcHNNaW4gPSBJbmZpbml0eSwgZnBzTWF4ID0gMDtcblx0dmFyIGZyYW1lcyA9IDAsIG1vZGUgPSAwO1xuXG5cdHZhciBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRjb250YWluZXIuaWQgPSAnc3RhdHMnO1xuXHRjb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lciggJ21vdXNlZG93bicsIGZ1bmN0aW9uICggZXZlbnQgKSB7IGV2ZW50LnByZXZlbnREZWZhdWx0KCk7IHNldE1vZGUoICsrIG1vZGUgJSAyICk7IH0sIGZhbHNlICk7XG5cdGNvbnRhaW5lci5zdHlsZS5jc3NUZXh0ID0gJ3dpZHRoOjgwcHg7b3BhY2l0eTowLjk7Y3Vyc29yOnBvaW50ZXInO1xuXG5cdHZhciBmcHNEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRmcHNEaXYuaWQgPSAnZnBzJztcblx0ZnBzRGl2LnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzowIDAgM3B4IDNweDt0ZXh0LWFsaWduOmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMDAyJztcblx0Y29udGFpbmVyLmFwcGVuZENoaWxkKCBmcHNEaXYgKTtcblxuXHR2YXIgZnBzVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGZwc1RleHQuaWQgPSAnZnBzVGV4dCc7XG5cdGZwc1RleHQuc3R5bGUuY3NzVGV4dCA9ICdjb2xvcjojMGZmO2ZvbnQtZmFtaWx5OkhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmO2ZvbnQtc2l6ZTo5cHg7Zm9udC13ZWlnaHQ6Ym9sZDtsaW5lLWhlaWdodDoxNXB4Jztcblx0ZnBzVGV4dC5pbm5lckhUTUwgPSAnRlBTJztcblx0ZnBzRGl2LmFwcGVuZENoaWxkKCBmcHNUZXh0ICk7XG5cblx0dmFyIGZwc0dyYXBoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ZnBzR3JhcGguaWQgPSAnZnBzR3JhcGgnO1xuXHRmcHNHcmFwaC5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOjc0cHg7aGVpZ2h0OjMwcHg7YmFja2dyb3VuZC1jb2xvcjojMGZmJztcblx0ZnBzRGl2LmFwcGVuZENoaWxkKCBmcHNHcmFwaCApO1xuXG5cdHdoaWxlICggZnBzR3JhcGguY2hpbGRyZW4ubGVuZ3RoIDwgNzQgKSB7XG5cblx0XHR2YXIgYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0YmFyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6MXB4O2hlaWdodDozMHB4O2Zsb2F0OmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMTEzJztcblx0XHRmcHNHcmFwaC5hcHBlbmRDaGlsZCggYmFyICk7XG5cblx0fVxuXG5cdHZhciBtc0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdG1zRGl2LmlkID0gJ21zJztcblx0bXNEaXYuc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjAgMCAzcHggM3B4O3RleHQtYWxpZ246bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMwMjA7ZGlzcGxheTpub25lJztcblx0Y29udGFpbmVyLmFwcGVuZENoaWxkKCBtc0RpdiApO1xuXG5cdHZhciBtc1RleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRtc1RleHQuaWQgPSAnbXNUZXh0Jztcblx0bXNUZXh0LnN0eWxlLmNzc1RleHQgPSAnY29sb3I6IzBmMDtmb250LWZhbWlseTpIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtmb250LXNpemU6OXB4O2ZvbnQtd2VpZ2h0OmJvbGQ7bGluZS1oZWlnaHQ6MTVweCc7XG5cdG1zVGV4dC5pbm5lckhUTUwgPSAnTVMnO1xuXHRtc0Rpdi5hcHBlbmRDaGlsZCggbXNUZXh0ICk7XG5cblx0dmFyIG1zR3JhcGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRtc0dyYXBoLmlkID0gJ21zR3JhcGgnO1xuXHRtc0dyYXBoLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246cmVsYXRpdmU7d2lkdGg6NzRweDtoZWlnaHQ6MzBweDtiYWNrZ3JvdW5kLWNvbG9yOiMwZjAnO1xuXHRtc0Rpdi5hcHBlbmRDaGlsZCggbXNHcmFwaCApO1xuXG5cdHdoaWxlICggbXNHcmFwaC5jaGlsZHJlbi5sZW5ndGggPCA3NCApIHtcblxuXHRcdHZhciBiYXIyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0YmFyMi5zdHlsZS5jc3NUZXh0ID0gJ3dpZHRoOjFweDtoZWlnaHQ6MzBweDtmbG9hdDpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzEzMSc7XG5cdFx0bXNHcmFwaC5hcHBlbmRDaGlsZCggYmFyMiApO1xuXG5cdH1cblxuXHR2YXIgc2V0TW9kZSA9IGZ1bmN0aW9uICggdmFsdWUgKSB7XG5cblx0XHRtb2RlID0gdmFsdWU7XG5cblx0XHRzd2l0Y2ggKCBtb2RlICkge1xuXG5cdFx0XHRjYXNlIDA6XG5cdFx0XHRcdGZwc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdFx0bXNEaXYuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdGZwc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHRtc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdH07XG5cblx0dmFyIHVwZGF0ZUdyYXBoID0gZnVuY3Rpb24gKCBkb20sIHZhbHVlICkge1xuXG5cdFx0dmFyIGNoaWxkID0gZG9tLmFwcGVuZENoaWxkKCBkb20uZmlyc3RDaGlsZCApO1xuXHRcdGNoaWxkLnN0eWxlLmhlaWdodCA9IHZhbHVlICsgJ3B4JztcblxuXHR9O1xuXG5cdHJldHVybiB7XG5cblx0XHRSRVZJU0lPTjogMTIsXG5cblx0XHRkb21FbGVtZW50OiBjb250YWluZXIsXG5cblx0XHRzZXRNb2RlOiBzZXRNb2RlLFxuXG5cdFx0YmVnaW46IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0c3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdH0sXG5cblx0XHRlbmQ6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0dmFyIHRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0XHRtcyA9IHRpbWUgLSBzdGFydFRpbWU7XG5cdFx0XHRtc01pbiA9IE1hdGgubWluKCBtc01pbiwgbXMgKTtcblx0XHRcdG1zTWF4ID0gTWF0aC5tYXgoIG1zTWF4LCBtcyApO1xuXG5cdFx0XHRtc1RleHQudGV4dENvbnRlbnQgPSBtcyArICcgTVMgKCcgKyBtc01pbiArICctJyArIG1zTWF4ICsgJyknO1xuXHRcdFx0dXBkYXRlR3JhcGgoIG1zR3JhcGgsIE1hdGgubWluKCAzMCwgMzAgLSAoIG1zIC8gMjAwICkgKiAzMCApICk7XG5cblx0XHRcdGZyYW1lcyArKztcblxuXHRcdFx0aWYgKCB0aW1lID4gcHJldlRpbWUgKyAxMDAwICkge1xuXG5cdFx0XHRcdGZwcyA9IE1hdGgucm91bmQoICggZnJhbWVzICogMTAwMCApIC8gKCB0aW1lIC0gcHJldlRpbWUgKSApO1xuXHRcdFx0XHRmcHNNaW4gPSBNYXRoLm1pbiggZnBzTWluLCBmcHMgKTtcblx0XHRcdFx0ZnBzTWF4ID0gTWF0aC5tYXgoIGZwc01heCwgZnBzICk7XG5cblx0XHRcdFx0ZnBzVGV4dC50ZXh0Q29udGVudCA9IGZwcyArICcgRlBTICgnICsgZnBzTWluICsgJy0nICsgZnBzTWF4ICsgJyknO1xuXHRcdFx0XHR1cGRhdGVHcmFwaCggZnBzR3JhcGgsIE1hdGgubWluKCAzMCwgMzAgLSAoIGZwcyAvIDEwMCApICogMzAgKSApO1xuXG5cdFx0XHRcdHByZXZUaW1lID0gdGltZTtcblx0XHRcdFx0ZnJhbWVzID0gMDtcblxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGltZTtcblxuXHRcdH0sXG5cblx0XHR1cGRhdGU6IGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0c3RhcnRUaW1lID0gdGhpcy5lbmQoKTtcblxuXHRcdH1cblxuXHR9O1xuXG59O1xuXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICkge1xuXG5cdG1vZHVsZS5leHBvcnRzID0gU3RhdHM7XG5cbn0iLCJ2YXIgcmFuZG9tID0ge1xuXHRcblx0ZmxpcCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBNYXRoLnJhbmRvbSgpID4gMC41ID8gdHJ1ZTogZmFsc2U7XG5cdH0sXG5cdFxuXHRyYW5nZSA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0cmV0dXJuIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcblx0fSxcblx0XG5cdHJhbmdlSW50IDogZnVuY3Rpb24obWluLCBtYXgpIHtcblx0XHRyZXR1cm4gTWF0aC5mbG9vciggdGhpcy5yYW5nZShtaW4sIG1heCArIDEpICk7XG5cdH0sXG5cdFxuXHRyYW5nZUxvdyA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0Ly9Nb3JlIGxpa2VseSB0byByZXR1cm4gYSBsb3cgdmFsdWVcblx0ICByZXR1cm4gTWF0aC5yYW5kb20oKSAqIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcblx0fSxcblx0XG5cdHJhbmdlSGlnaCA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0Ly9Nb3JlIGxpa2VseSB0byByZXR1cm4gYSBoaWdoIHZhbHVlXG5cdFx0cmV0dXJuICgxIC0gTWF0aC5yYW5kb20oKSAqIE1hdGgucmFuZG9tKCkpICogKG1heCAtIG1pbikgKyBtaW47XG5cdH1cblx0IFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSByYW5kb207XG4iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8vIElmIG9iai5oYXNPd25Qcm9wZXJ0eSBoYXMgYmVlbiBvdmVycmlkZGVuLCB0aGVuIGNhbGxpbmdcbi8vIG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSB3aWxsIGJyZWFrLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvaXNzdWVzLzE3MDdcbmZ1bmN0aW9uIGhhc093blByb3BlcnR5KG9iaiwgcHJvcCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocXMsIHNlcCwgZXEsIG9wdGlvbnMpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIHZhciBvYmogPSB7fTtcblxuICBpZiAodHlwZW9mIHFzICE9PSAnc3RyaW5nJyB8fCBxcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gb2JqO1xuICB9XG5cbiAgdmFyIHJlZ2V4cCA9IC9cXCsvZztcbiAgcXMgPSBxcy5zcGxpdChzZXApO1xuXG4gIHZhciBtYXhLZXlzID0gMTAwMDtcbiAgaWYgKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMubWF4S2V5cyA9PT0gJ251bWJlcicpIHtcbiAgICBtYXhLZXlzID0gb3B0aW9ucy5tYXhLZXlzO1xuICB9XG5cbiAgdmFyIGxlbiA9IHFzLmxlbmd0aDtcbiAgLy8gbWF4S2V5cyA8PSAwIG1lYW5zIHRoYXQgd2Ugc2hvdWxkIG5vdCBsaW1pdCBrZXlzIGNvdW50XG4gIGlmIChtYXhLZXlzID4gMCAmJiBsZW4gPiBtYXhLZXlzKSB7XG4gICAgbGVuID0gbWF4S2V5cztcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICB2YXIgeCA9IHFzW2ldLnJlcGxhY2UocmVnZXhwLCAnJTIwJyksXG4gICAgICAgIGlkeCA9IHguaW5kZXhPZihlcSksXG4gICAgICAgIGtzdHIsIHZzdHIsIGssIHY7XG5cbiAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgIGtzdHIgPSB4LnN1YnN0cigwLCBpZHgpO1xuICAgICAgdnN0ciA9IHguc3Vic3RyKGlkeCArIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICBrc3RyID0geDtcbiAgICAgIHZzdHIgPSAnJztcbiAgICB9XG5cbiAgICBrID0gZGVjb2RlVVJJQ29tcG9uZW50KGtzdHIpO1xuICAgIHYgPSBkZWNvZGVVUklDb21wb25lbnQodnN0cik7XG5cbiAgICBpZiAoIWhhc093blByb3BlcnR5KG9iaiwgaykpIHtcbiAgICAgIG9ialtrXSA9IHY7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgIG9ialtrXS5wdXNoKHYpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmpba10gPSBbb2JqW2tdLCB2XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5naWZ5UHJpbWl0aXZlID0gZnVuY3Rpb24odikge1xuICBzd2l0Y2ggKHR5cGVvZiB2KSB7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB2O1xuXG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gdiA/ICd0cnVlJyA6ICdmYWxzZSc7XG5cbiAgICBjYXNlICdudW1iZXInOlxuICAgICAgcmV0dXJuIGlzRmluaXRlKHYpID8gdiA6ICcnO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiAnJztcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvYmosIHNlcCwgZXEsIG5hbWUpIHtcbiAgc2VwID0gc2VwIHx8ICcmJztcbiAgZXEgPSBlcSB8fCAnPSc7XG4gIGlmIChvYmogPT09IG51bGwpIHtcbiAgICBvYmogPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gbWFwKG9iamVjdEtleXMob2JqKSwgZnVuY3Rpb24oaykge1xuICAgICAgdmFyIGtzID0gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShrKSkgKyBlcTtcbiAgICAgIGlmIChpc0FycmF5KG9ialtrXSkpIHtcbiAgICAgICAgcmV0dXJuIG1hcChvYmpba10sIGZ1bmN0aW9uKHYpIHtcbiAgICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKHYpKTtcbiAgICAgICAgfSkuam9pbihzZXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmpba10pKTtcbiAgICAgIH1cbiAgICB9KS5qb2luKHNlcCk7XG5cbiAgfVxuXG4gIGlmICghbmFtZSkgcmV0dXJuICcnO1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShuYW1lKSkgKyBlcSArXG4gICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9iaikpO1xufTtcblxudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uICh4cykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbmZ1bmN0aW9uIG1hcCAoeHMsIGYpIHtcbiAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmKTtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgcmVzLnB1c2goZih4c1tpXSwgaSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgcmVzLnB1c2goa2V5KTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5kZWNvZGUgPSBleHBvcnRzLnBhcnNlID0gcmVxdWlyZSgnLi9kZWNvZGUnKTtcbmV4cG9ydHMuZW5jb2RlID0gZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2VuY29kZScpO1xuIiwidmFyIHJlc29sdmUgPSByZXF1aXJlKCdzb3VuZGNsb3VkLXJlc29sdmUnKVxudmFyIGZvbnRzID0gcmVxdWlyZSgnZ29vZ2xlLWZvbnRzJylcbnZhciBtaW5zdGFjaGUgPSByZXF1aXJlKCdtaW5zdGFjaGUnKVxudmFyIGluc2VydCA9IHJlcXVpcmUoJ2luc2VydC1jc3MnKVxudmFyIGZzID0gcmVxdWlyZSgnZnMnKVxuXG52YXIgaWNvbnMgPSB7XG4gICAgYmxhY2s6ICdodHRwOi8vZGV2ZWxvcGVycy5zb3VuZGNsb3VkLmNvbS9hc3NldHMvbG9nb19ibGFjay5wbmcnXG4gICwgd2hpdGU6ICdodHRwOi8vZGV2ZWxvcGVycy5zb3VuZGNsb3VkLmNvbS9hc3NldHMvbG9nb193aGl0ZS5wbmcnXG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFkZ2VcbmZ1bmN0aW9uIG5vb3AoZXJyKXsgaWYgKGVycikgdGhyb3cgZXJyIH1cblxudmFyIGluc2VydGVkID0gZmFsc2VcbnZhciBnd2ZhZGRlZCA9IGZhbHNlXG52YXIgdGVtcGxhdGUgPSBudWxsXG5cbmZ1bmN0aW9uIGJhZGdlKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICghaW5zZXJ0ZWQpIGluc2VydChcIi5ucG0tc2NiLXdyYXAge1xcbiAgZm9udC1mYW1pbHk6ICdPcGVuIFNhbnMnLCAnSGVsdmV0aWNhIE5ldWUnLCBIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmO1xcbiAgZm9udC13ZWlnaHQ6IDIwMDtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHRvcDogMDtcXG4gIGxlZnQ6IDA7XFxuICB6LWluZGV4OiA5OTk7XFxufVxcblxcbi5ucG0tc2NiLXdyYXAgYSB7XFxuICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XFxuICBjb2xvcjogIzAwMDtcXG59XFxuLm5wbS1zY2Itd2hpdGVcXG4ubnBtLXNjYi13cmFwIGEge1xcbiAgY29sb3I6ICNmZmY7XFxufVxcblxcbi5ucG0tc2NiLWlubmVyIHtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHRvcDogLTEyMHB4OyBsZWZ0OiAwO1xcbiAgcGFkZGluZzogOHB4O1xcbiAgd2lkdGg6IDEwMCU7XFxuICBoZWlnaHQ6IDE1MHB4O1xcbiAgei1pbmRleDogMjtcXG4gIC13ZWJraXQtdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbiAgICAgLW1vei10cmFuc2l0aW9uOiB3aWR0aCAwLjVzIGN1YmljLWJlemllcigxLCAwLCAwLCAxKSwgdG9wIDAuNXM7XFxuICAgICAgLW1zLXRyYW5zaXRpb246IHdpZHRoIDAuNXMgY3ViaWMtYmV6aWVyKDEsIDAsIDAsIDEpLCB0b3AgMC41cztcXG4gICAgICAgLW8tdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbiAgICAgICAgICB0cmFuc2l0aW9uOiB3aWR0aCAwLjVzIGN1YmljLWJlemllcigxLCAwLCAwLCAxKSwgdG9wIDAuNXM7XFxufVxcbi5ucG0tc2NiLXdyYXA6aG92ZXJcXG4ubnBtLXNjYi1pbm5lciB7XFxuICB0b3A6IDA7XFxufVxcblxcbi5ucG0tc2NiLWFydHdvcmsge1xcbiAgcG9zaXRpb246IGFic29sdXRlO1xcbiAgdG9wOiAxNnB4OyBsZWZ0OiAxNnB4O1xcbiAgd2lkdGg6IDEwNHB4OyBoZWlnaHQ6IDEwNHB4O1xcbiAgYm94LXNoYWRvdzogMCAwIDhweCAtM3B4ICMwMDA7XFxuICBvdXRsaW5lOiAxcHggc29saWQgcmdiYSgwLDAsMCwwLjEpO1xcbiAgei1pbmRleDogMjtcXG59XFxuLm5wbS1zY2Itd2hpdGVcXG4ubnBtLXNjYi1hcnR3b3JrIHtcXG4gIG91dGxpbmU6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMSk7XFxuICBib3gtc2hhZG93OiAwIDAgMTBweCAtMnB4IHJnYmEoMjU1LDI1NSwyNTUsMC45KTtcXG59XFxuXFxuLm5wbS1zY2ItaW5mbyB7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IDE2cHg7XFxuICBsZWZ0OiAxMjBweDtcXG4gIHdpZHRoOiAzMDBweDtcXG4gIHotaW5kZXg6IDE7XFxufVxcblxcbi5ucG0tc2NiLWluZm8gPiBhIHtcXG4gIGRpc3BsYXk6IGJsb2NrO1xcbn1cXG5cXG4ubnBtLXNjYi1ub3ctcGxheWluZyB7XFxuICBmb250LXNpemU6IDEycHg7XFxuICBsaW5lLWhlaWdodDogMTJweDtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHdpZHRoOiA1MDBweDtcXG4gIHotaW5kZXg6IDE7XFxuICBwYWRkaW5nOiAxNXB4IDA7XFxuICB0b3A6IDA7IGxlZnQ6IDEzOHB4O1xcbiAgb3BhY2l0eTogMTtcXG4gIC13ZWJraXQtdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgIC1tb3otdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAtbXMtdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAgLW8tdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG59XFxuXFxuLm5wbS1zY2Itd3JhcDpob3Zlclxcbi5ucG0tc2NiLW5vdy1wbGF5aW5nIHtcXG4gIG9wYWNpdHk6IDA7XFxufVxcblxcbi5ucG0tc2NiLXdoaXRlXFxuLm5wbS1zY2Itbm93LXBsYXlpbmcge1xcbiAgY29sb3I6ICNmZmY7XFxufVxcbi5ucG0tc2NiLW5vdy1wbGF5aW5nID4gYSB7XFxuICBmb250LXdlaWdodDogYm9sZDtcXG59XFxuXFxuLm5wbS1zY2ItaW5mbyA+IGEgPiBwIHtcXG4gIG1hcmdpbjogMDtcXG4gIHBhZGRpbmctYm90dG9tOiAwLjI1ZW07XFxuICBsaW5lLWhlaWdodDogMS4zNWVtO1xcbiAgbWFyZ2luLWxlZnQ6IDFlbTtcXG4gIGZvbnQtc2l6ZTogMWVtO1xcbn1cXG5cXG4ubnBtLXNjYi10aXRsZSB7XFxuICBmb250LXdlaWdodDogYm9sZDtcXG59XFxuXFxuLm5wbS1zY2ItaWNvbiB7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IDEyMHB4O1xcbiAgcGFkZGluZy10b3A6IDAuNzVlbTtcXG4gIGxlZnQ6IDE2cHg7XFxufVxcblwiKSwgaW5zZXJ0ZWQgPSB0cnVlXG4gIGlmICghdGVtcGxhdGUpIHRlbXBsYXRlID0gbWluc3RhY2hlLmNvbXBpbGUoXCI8ZGl2IGNsYXNzPVxcXCJucG0tc2NiLXdyYXBcXFwiPlxcbiAgPGRpdiBjbGFzcz1cXFwibnBtLXNjYi1pbm5lclxcXCI+XFxuICAgIDxhIHRhcmdldD1cXFwiX2JsYW5rXFxcIiBocmVmPVxcXCJ7e3VybHMuc29uZ319XFxcIj5cXG4gICAgICA8aW1nIGNsYXNzPVxcXCJucG0tc2NiLWljb25cXFwiIHNyYz1cXFwie3tpY29ufX1cXFwiPlxcbiAgICAgIDxpbWcgY2xhc3M9XFxcIm5wbS1zY2ItYXJ0d29ya1xcXCIgc3JjPVxcXCJ7e2FydHdvcmt9fVxcXCI+XFxuICAgIDwvYT5cXG4gICAgPGRpdiBjbGFzcz1cXFwibnBtLXNjYi1pbmZvXFxcIj5cXG4gICAgICA8YSB0YXJnZXQ9XFxcIl9ibGFua1xcXCIgaHJlZj1cXFwie3t1cmxzLnNvbmd9fVxcXCI+XFxuICAgICAgICA8cCBjbGFzcz1cXFwibnBtLXNjYi10aXRsZVxcXCI+e3t0aXRsZX19PC9wPlxcbiAgICAgIDwvYT5cXG4gICAgICA8YSB0YXJnZXQ9XFxcIl9ibGFua1xcXCIgaHJlZj1cXFwie3t1cmxzLmFydGlzdH19XFxcIj5cXG4gICAgICAgIDxwIGNsYXNzPVxcXCJucG0tc2NiLWFydGlzdFxcXCI+e3thcnRpc3R9fTwvcD5cXG4gICAgICA8L2E+XFxuICAgIDwvZGl2PlxcbiAgPC9kaXY+XFxuICA8ZGl2IGNsYXNzPVxcXCJucG0tc2NiLW5vdy1wbGF5aW5nXFxcIj5cXG4gICAgTm93IFBsYXlpbmc6XFxuICAgIDxhIGhyZWY9XFxcInt7dXJscy5zb25nfX1cXFwiPnt7dGl0bGV9fTwvYT5cXG4gICAgYnlcXG4gICAgPGEgaHJlZj1cXFwie3t1cmxzLmFydGlzdH19XFxcIj57e2FydGlzdH19PC9hPlxcbiAgPC9kaXY+XFxuPC9kaXY+XFxuXCIpXG5cbiAgaWYgKCFnd2ZhZGRlZCAmJiBvcHRpb25zLmdldEZvbnRzKSB7XG4gICAgZm9udHMuYWRkKHsgJ09wZW4gU2Fucyc6IFszMDAsIDYwMF0gfSlcbiAgICBnd2ZhZGRlZCA9IHRydWVcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgbm9vcFxuXG4gIHZhciBkaXYgICA9IG9wdGlvbnMuZWwgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgdmFyIGljb24gID0gISgnZGFyaycgaW4gb3B0aW9ucykgfHwgb3B0aW9ucy5kYXJrID8gJ2JsYWNrJyA6ICd3aGl0ZSdcbiAgdmFyIGlkICAgID0gb3B0aW9ucy5jbGllbnRfaWRcbiAgdmFyIHNvbmcgID0gb3B0aW9ucy5zb25nXG5cbiAgcmVzb2x2ZShpZCwgc29uZywgZnVuY3Rpb24oZXJyLCBqc29uKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICBpZiAoanNvbi5raW5kICE9PSAndHJhY2snKSB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnc291bmRjbG91ZC1iYWRnZSBvbmx5IHN1cHBvcnRzIGluZGl2aWR1YWwgdHJhY2tzIGF0IHRoZSBtb21lbnQnXG4gICAgKVxuXG4gICAgZGl2LmNsYXNzTGlzdFtcbiAgICAgIGljb24gPT09ICdibGFjaycgPyAncmVtb3ZlJyA6ICdhZGQnXG4gICAgXSgnbnBtLXNjYi13aGl0ZScpXG5cbiAgICBkaXYuaW5uZXJIVE1MID0gdGVtcGxhdGUoe1xuICAgICAgICBhcnR3b3JrOiBqc29uLmFydHdvcmtfdXJsIHx8IGpzb24udXNlci5hdmF0YXJfdXJsXG4gICAgICAsIGFydGlzdDoganNvbi51c2VyLnVzZXJuYW1lXG4gICAgICAsIHRpdGxlOiBqc29uLnRpdGxlXG4gICAgICAsIGljb246IGljb25zW2ljb25dXG4gICAgICAsIHVybHM6IHtcbiAgICAgICAgICBzb25nOiBqc29uLnBlcm1hbGlua191cmxcbiAgICAgICAgLCBhcnRpc3Q6IGpzb24udXNlci5wZXJtYWxpbmtfdXJsXG4gICAgICB9XG4gICAgfSlcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KVxuXG4gICAgY2FsbGJhY2sobnVsbCwganNvbi5zdHJlYW1fdXJsICsgJz9jbGllbnRfaWQ9JyArIGlkLCBqc29uLCBkaXYpXG4gIH0pXG5cbiAgcmV0dXJuIGRpdlxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBhc1N0cmluZ1xubW9kdWxlLmV4cG9ydHMuYWRkID0gYXBwZW5kXG5cbmZ1bmN0aW9uIGFzU3RyaW5nKGZvbnRzKSB7XG4gIHZhciBocmVmID0gZ2V0SHJlZihmb250cylcbiAgcmV0dXJuICc8bGluayBocmVmPVwiJyArIGhyZWYgKyAnXCIgcmVsPVwic3R5bGVzaGVldFwiIHR5cGU9XCJ0ZXh0L2Nzc1wiPidcbn1cblxuZnVuY3Rpb24gYXNFbGVtZW50KGZvbnRzKSB7XG4gIHZhciBocmVmID0gZ2V0SHJlZihmb250cylcbiAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJylcbiAgbGluay5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKVxuICBsaW5rLnNldEF0dHJpYnV0ZSgncmVsJywgJ3N0eWxlc2hlZXQnKVxuICBsaW5rLnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2NzcycpXG4gIHJldHVybiBsaW5rXG59XG5cbmZ1bmN0aW9uIGdldEhyZWYoZm9udHMpIHtcbiAgdmFyIGZhbWlseSA9IE9iamVjdC5rZXlzKGZvbnRzKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBkZXRhaWxzID0gZm9udHNbbmFtZV1cbiAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC9cXHMrLywgJysnKVxuICAgIHJldHVybiB0eXBlb2YgZGV0YWlscyA9PT0gJ2Jvb2xlYW4nXG4gICAgICA/IG5hbWVcbiAgICAgIDogbmFtZSArICc6JyArIG1ha2VBcnJheShkZXRhaWxzKS5qb2luKCcsJylcbiAgfSkuam9pbignfCcpXG5cbiAgcmV0dXJuICdodHRwOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzP2ZhbWlseT0nICsgZmFtaWx5XG59XG5cbmZ1bmN0aW9uIGFwcGVuZChmb250cykge1xuICB2YXIgbGluayA9IGFzRWxlbWVudChmb250cylcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChsaW5rKVxuICByZXR1cm4gbGlua1xufVxuXG5mdW5jdGlvbiBtYWtlQXJyYXkoYXJyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFycikgPyBhcnIgOiBbYXJyXVxufVxuIiwidmFyIGluc2VydGVkID0gW107XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNzcykge1xuICAgIGlmIChpbnNlcnRlZC5pbmRleE9mKGNzcykgPj0gMCkgcmV0dXJuO1xuICAgIGluc2VydGVkLnB1c2goY3NzKTtcbiAgICBcbiAgICB2YXIgZWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgdmFyIHRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpO1xuICAgIGVsZW0uYXBwZW5kQ2hpbGQodGV4dCk7XG4gICAgXG4gICAgaWYgKGRvY3VtZW50LmhlYWQuY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgZG9jdW1lbnQuaGVhZC5pbnNlcnRCZWZvcmUoZWxlbSwgZG9jdW1lbnQuaGVhZC5jaGlsZE5vZGVzWzBdKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZWxlbSk7XG4gICAgfVxufTtcbiIsIlxuLyoqXG4gKiBFeHBvc2UgYHJlbmRlcigpYC5gXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVuZGVyO1xuXG4vKipcbiAqIEV4cG9zZSBgY29tcGlsZSgpYC5cbiAqL1xuXG5leHBvcnRzLmNvbXBpbGUgPSBjb21waWxlO1xuXG4vKipcbiAqIFJlbmRlciB0aGUgZ2l2ZW4gbXVzdGFjaGUgYHN0cmAgd2l0aCBgb2JqYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHJlbmRlcihzdHIsIG9iaikge1xuICBvYmogPSBvYmogfHwge307XG4gIHZhciBmbiA9IGNvbXBpbGUoc3RyKTtcbiAgcmV0dXJuIGZuKG9iaik7XG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgZ2l2ZW4gYHN0cmAgdG8gYSBgRnVuY3Rpb25gLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlKHN0cikge1xuICB2YXIganMgPSBbXTtcbiAgdmFyIHRva3MgPSBwYXJzZShzdHIpO1xuICB2YXIgdG9rO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rcy5sZW5ndGg7ICsraSkge1xuICAgIHRvayA9IHRva3NbaV07XG4gICAgaWYgKGkgJSAyID09IDApIHtcbiAgICAgIGpzLnB1c2goJ1wiJyArIHRvay5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoICh0b2tbMF0pIHtcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGpzLnB1c2goJykgKyAnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGFzc2VydFByb3BlcnR5KHRvayk7XG4gICAgICAgICAganMucHVzaCgnICsgc2VjdGlvbihvYmosIFwiJyArIHRvayArICdcIiwgdHJ1ZSwgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgIHRvayA9IHRvay5zbGljZSgxKTtcbiAgICAgICAgICBhc3NlcnRQcm9wZXJ0eSh0b2spO1xuICAgICAgICAgIGpzLnB1c2goJyArIHNlY3Rpb24ob2JqLCBcIicgKyB0b2sgKyAnXCIsIGZhbHNlLCAnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGFzc2VydFByb3BlcnR5KHRvayk7XG4gICAgICAgICAganMucHVzaCgnICsgb2JqLicgKyB0b2sgKyAnICsgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYXNzZXJ0UHJvcGVydHkodG9rKTtcbiAgICAgICAgICBqcy5wdXNoKCcgKyBlc2NhcGUob2JqLicgKyB0b2sgKyAnKSArICcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGpzID0gJ1xcbidcbiAgICArIGluZGVudChlc2NhcGUudG9TdHJpbmcoKSkgKyAnO1xcblxcbidcbiAgICArIGluZGVudChzZWN0aW9uLnRvU3RyaW5nKCkpICsgJztcXG5cXG4nXG4gICAgKyAnICByZXR1cm4gJyArIGpzLmpvaW4oJycpLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKTtcblxuICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdvYmonLCBqcyk7XG59XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgYHByb3BgIGlzIGEgdmFsaWQgcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGFzc2VydFByb3BlcnR5KHByb3ApIHtcbiAgaWYgKCFwcm9wLm1hdGNoKC9eW1xcdy5dKyQvKSkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHByb3BlcnR5IFwiJyArIHByb3AgKyAnXCInKTtcbn1cblxuLyoqXG4gKiBQYXJzZSBgc3RyYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICByZXR1cm4gc3RyLnNwbGl0KC9cXHtcXHt8XFx9XFx9Lyk7XG59XG5cbi8qKlxuICogSW5kZW50IGBzdHJgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGluZGVudChzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eL2dtLCAnICAnKTtcbn1cblxuLyoqXG4gKiBTZWN0aW9uIGhhbmRsZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcFxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtCb29sZWFufSBuZWdhdGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlY3Rpb24ob2JqLCBwcm9wLCBuZWdhdGUsIHN0cikge1xuICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gdmFsLmNhbGwob2JqLCBzdHIpO1xuICBpZiAobmVnYXRlKSB2YWwgPSAhdmFsO1xuICBpZiAodmFsKSByZXR1cm4gc3RyO1xuICByZXR1cm4gJyc7XG59XG5cbi8qKlxuICogRXNjYXBlIHRoZSBnaXZlbiBgaHRtbGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGh0bWxcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7XG4gIHJldHVybiBTdHJpbmcoaHRtbClcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn1cbiIsInZhciBxcyAgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpXG52YXIgeGhyID0gcmVxdWlyZSgneGhyJylcblxubW9kdWxlLmV4cG9ydHMgPSByZXNvbHZlXG5cbmZ1bmN0aW9uIHJlc29sdmUoaWQsIGdvYWwsIGNhbGxiYWNrKSB7XG4gIHZhciB1cmkgPSAnaHR0cDovL2FwaS5zb3VuZGNsb3VkLmNvbS9yZXNvbHZlLmpzb24/JyArIHFzLnN0cmluZ2lmeSh7XG4gICAgICB1cmw6IGdvYWxcbiAgICAsIGNsaWVudF9pZDogaWRcbiAgfSlcblxuICB4aHIoe1xuICAgICAgdXJpOiB1cmlcbiAgICAsIG1ldGhvZDogJ0dFVCdcbiAgfSwgZnVuY3Rpb24oZXJyLCByZXMsIGJvZHkpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIHRyeSB7XG4gICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgIH0gY2F0Y2goZSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpXG4gICAgfVxuICAgIGlmIChib2R5LmVycm9ycykgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcihcbiAgICAgIGJvZHkuZXJyb3JzWzBdLmVycm9yX21lc3NhZ2VcbiAgICApKVxuICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBib2R5KVxuICB9KVxufVxuIiwidmFyIHdpbmRvdyA9IHJlcXVpcmUoXCJnbG9iYWwvd2luZG93XCIpXG52YXIgb25jZSA9IHJlcXVpcmUoXCJvbmNlXCIpXG5cbnZhciBtZXNzYWdlcyA9IHtcbiAgICBcIjBcIjogXCJJbnRlcm5hbCBYTUxIdHRwUmVxdWVzdCBFcnJvclwiLFxuICAgIFwiNFwiOiBcIjR4eCBDbGllbnQgRXJyb3JcIixcbiAgICBcIjVcIjogXCI1eHggU2VydmVyIEVycm9yXCJcbn1cblxudmFyIFhIUiA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCB8fCBub29wXG52YXIgWERSID0gXCJ3aXRoQ3JlZGVudGlhbHNcIiBpbiAobmV3IFhIUigpKSA/XG4gICAgICAgIHdpbmRvdy5YTUxIdHRwUmVxdWVzdCA6IHdpbmRvdy5YRG9tYWluUmVxdWVzdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVhIUlxuXG5mdW5jdGlvbiBjcmVhdGVYSFIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgb3B0aW9ucyA9IHsgdXJpOiBvcHRpb25zIH1cbiAgICB9XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIGNhbGxiYWNrID0gb25jZShjYWxsYmFjaylcblxuICAgIHZhciB4aHJcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyID0gbmV3IFhEUigpXG4gICAgfSBlbHNlIHtcbiAgICAgICAgeGhyID0gbmV3IFhIUigpXG4gICAgfVxuXG4gICAgdmFyIHVyaSA9IHhoci51cmwgPSBvcHRpb25zLnVyaVxuICAgIHZhciBtZXRob2QgPSB4aHIubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgXCJHRVRcIlxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5IHx8IG9wdGlvbnMuZGF0YVxuICAgIHZhciBoZWFkZXJzID0geGhyLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgfHwge31cbiAgICB2YXIgaXNKc29uID0gZmFsc2VcblxuICAgIGlmIChcImpzb25cIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIGlzSnNvbiA9IHRydWVcbiAgICAgICAgaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSA9IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIGJvZHkgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmpzb24pXG4gICAgfVxuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IHJlYWR5c3RhdGVjaGFuZ2VcbiAgICB4aHIub25sb2FkID0gbG9hZFxuICAgIHhoci5vbmVycm9yID0gZXJyb3JcbiAgICAvLyBJRTkgbXVzdCBoYXZlIG9ucHJvZ3Jlc3MgYmUgc2V0IHRvIGEgdW5pcXVlIGZ1bmN0aW9uLlxuICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJRSBtdXN0IGRpZVxuICAgIH1cbiAgICAvLyBoYXRlIElFXG4gICAgeGhyLm9udGltZW91dCA9IG5vb3BcbiAgICB4aHIub3BlbihtZXRob2QsIHVyaSlcbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgfVxuICAgIHhoci50aW1lb3V0ID0gXCJ0aW1lb3V0XCIgaW4gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dCA6IDUwMDBcblxuICAgIGlmICggeGhyLnNldFJlcXVlc3RIZWFkZXIpIHtcbiAgICAgICAgT2JqZWN0LmtleXMoaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGhlYWRlcnNba2V5XSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICB4aHIuc2VuZChib2R5KVxuXG4gICAgcmV0dXJuIHhoclxuXG4gICAgZnVuY3Rpb24gcmVhZHlzdGF0ZWNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBsb2FkKClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWQoKSB7XG4gICAgICAgIHZhciBlcnJvciA9IG51bGxcbiAgICAgICAgdmFyIHN0YXR1cyA9IHhoci5zdGF0dXNDb2RlID0geGhyLnN0YXR1c1xuICAgICAgICB2YXIgYm9keSA9IHhoci5ib2R5ID0geGhyLnJlc3BvbnNlIHx8XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUZXh0IHx8IHhoci5yZXNwb25zZVhNTFxuXG4gICAgICAgIGlmIChzdGF0dXMgPT09IDAgfHwgKHN0YXR1cyA+PSA0MDAgJiYgc3RhdHVzIDwgNjAwKSkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSB4aHIucmVzcG9uc2VUZXh0IHx8XG4gICAgICAgICAgICAgICAgbWVzc2FnZXNbU3RyaW5nKHhoci5zdGF0dXMpLmNoYXJBdCgwKV1cbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpXG5cbiAgICAgICAgICAgIGVycm9yLnN0YXR1c0NvZGUgPSB4aHIuc3RhdHVzXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNKc29uKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGJvZHkgPSB4aHIuYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsYmFjayhlcnJvciwgeGhyLCBib2R5KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVycm9yKGV2dCkge1xuICAgICAgICBjYWxsYmFjayhldnQsIHhocilcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gd2luZG93XG59IGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGdsb2JhbFxufSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHt9XG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gb25jZVxuXG5vbmNlLnByb3RvID0gb25jZShmdW5jdGlvbiAoKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShGdW5jdGlvbi5wcm90b3R5cGUsICdvbmNlJywge1xuICAgIHZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gb25jZSh0aGlzKVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59KVxuXG5mdW5jdGlvbiBvbmNlIChmbikge1xuICB2YXIgY2FsbGVkID0gZmFsc2VcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoY2FsbGVkKSByZXR1cm5cbiAgICBjYWxsZWQgPSB0cnVlXG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgfVxufVxuIiwiLy8gICAgIFVuZGVyc2NvcmUuanMgMS43LjBcbi8vICAgICBodHRwOi8vdW5kZXJzY29yZWpzLm9yZ1xuLy8gICAgIChjKSAyMDA5LTIwMTQgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbi8vICAgICBVbmRlcnNjb3JlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgLy8gQmFzZWxpbmUgc2V0dXBcbiAgLy8gLS0tLS0tLS0tLS0tLS1cblxuICAvLyBFc3RhYmxpc2ggdGhlIHJvb3Qgb2JqZWN0LCBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGV4cG9ydHNgIG9uIHRoZSBzZXJ2ZXIuXG4gIHZhciByb290ID0gdGhpcztcblxuICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgYF9gIHZhcmlhYmxlLlxuICB2YXIgcHJldmlvdXNVbmRlcnNjb3JlID0gcm9vdC5fO1xuXG4gIC8vIFNhdmUgYnl0ZXMgaW4gdGhlIG1pbmlmaWVkIChidXQgbm90IGd6aXBwZWQpIHZlcnNpb246XG4gIHZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlLCBPYmpQcm90byA9IE9iamVjdC5wcm90b3R5cGUsIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyXG4gICAgcHVzaCAgICAgICAgICAgICA9IEFycmF5UHJvdG8ucHVzaCxcbiAgICBzbGljZSAgICAgICAgICAgID0gQXJyYXlQcm90by5zbGljZSxcbiAgICBjb25jYXQgICAgICAgICAgID0gQXJyYXlQcm90by5jb25jYXQsXG4gICAgdG9TdHJpbmcgICAgICAgICA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgIGhhc093blByb3BlcnR5ICAgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBBbGwgKipFQ01BU2NyaXB0IDUqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhclxuICAgIG5hdGl2ZUlzQXJyYXkgICAgICA9IEFycmF5LmlzQXJyYXksXG4gICAgbmF0aXZlS2V5cyAgICAgICAgID0gT2JqZWN0LmtleXMsXG4gICAgbmF0aXZlQmluZCAgICAgICAgID0gRnVuY1Byb3RvLmJpbmQ7XG5cbiAgLy8gQ3JlYXRlIGEgc2FmZSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciB1c2UgYmVsb3cuXG4gIHZhciBfID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIF8pIHJldHVybiBvYmo7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIF8pKSByZXR1cm4gbmV3IF8ob2JqKTtcbiAgICB0aGlzLl93cmFwcGVkID0gb2JqO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbiAgLy8gdGhlIGJyb3dzZXIsIGFkZCBgX2AgYXMgYSBnbG9iYWwgb2JqZWN0LlxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBfO1xuICAgIH1cbiAgICBleHBvcnRzLl8gPSBfO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuXyA9IF87XG4gIH1cblxuICAvLyBDdXJyZW50IHZlcnNpb24uXG4gIF8uVkVSU0lPTiA9ICcxLjcuMCc7XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIGVmZmljaWVudCAoZm9yIGN1cnJlbnQgZW5naW5lcykgdmVyc2lvblxuICAvLyBvZiB0aGUgcGFzc2VkLWluIGNhbGxiYWNrLCB0byBiZSByZXBlYXRlZGx5IGFwcGxpZWQgaW4gb3RoZXIgVW5kZXJzY29yZVxuICAvLyBmdW5jdGlvbnMuXG4gIHZhciBjcmVhdGVDYWxsYmFjayA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgb3RoZXIpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgfTtcbiAgICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICB9O1xuICAgICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEEgbW9zdGx5LWludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGNhbGxiYWNrcyB0aGF0IGNhbiBiZSBhcHBsaWVkXG4gIC8vIHRvIGVhY2ggZWxlbWVudCBpbiBhIGNvbGxlY3Rpb24sIHJldHVybmluZyB0aGUgZGVzaXJlZCByZXN1bHQg4oCUIGVpdGhlclxuICAvLyBpZGVudGl0eSwgYW4gYXJiaXRyYXJ5IGNhbGxiYWNrLCBhIHByb3BlcnR5IG1hdGNoZXIsIG9yIGEgcHJvcGVydHkgYWNjZXNzb3IuXG4gIF8uaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChfLmlzT2JqZWN0KHZhbHVlKSkgcmV0dXJuIF8ubWF0Y2hlcyh2YWx1ZSk7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xuICB9O1xuXG4gIC8vIENvbGxlY3Rpb24gRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lLCBhbiBgZWFjaGAgaW1wbGVtZW50YXRpb24sIGFrYSBgZm9yRWFjaGAuXG4gIC8vIEhhbmRsZXMgcmF3IG9iamVjdHMgaW4gYWRkaXRpb24gdG8gYXJyYXktbGlrZXMuIFRyZWF0cyBhbGxcbiAgLy8gc3BhcnNlIGFycmF5LWxpa2VzIGFzIGlmIHRoZXkgd2VyZSBkZW5zZS5cbiAgXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgaSwgbGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoID09PSArbGVuZ3RoKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW2ldLCBpLCBvYmopO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVyYXRlZShvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRlZSB0byBlYWNoIGVsZW1lbnQuXG4gIF8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpLFxuICAgICAgICBjdXJyZW50S2V5O1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIHJlc3VsdHNbaW5kZXhdID0gaXRlcmF0ZWUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuICAvLyBvciBgZm9sZGxgLlxuICBfLnJlZHVjZSA9IF8uZm9sZGwgPSBfLmluamVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIG1lbW8sIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBpbmRleCA9IDAsIGN1cnJlbnRLZXk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICBpZiAoIWxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgICBtZW1vID0gb2JqW2tleXMgPyBrZXlzW2luZGV4KytdIDogaW5kZXgrK107XG4gICAgfVxuICAgIGZvciAoOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgbWVtbyA9IGl0ZXJhdGVlKG1lbW8sIG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIF8ucmVkdWNlUmlnaHQgPSBfLmZvbGRyID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgbWVtbywgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCwgNCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArIG9iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGluZGV4ID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIGN1cnJlbnRLZXk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICBpZiAoIWluZGV4KSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICAgIG1lbW8gPSBvYmpba2V5cyA/IGtleXNbLS1pbmRleF0gOiAtLWluZGV4XTtcbiAgICB9XG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIG1lbW8gPSBpdGVyYXRlZShtZW1vLCBvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgZmlyc3QgdmFsdWUgd2hpY2ggcGFzc2VzIGEgdHJ1dGggdGVzdC4gQWxpYXNlZCBhcyBgZGV0ZWN0YC5cbiAgXy5maW5kID0gXy5kZXRlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIF8uc29tZShvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZSh2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIEFsaWFzZWQgYXMgYHNlbGVjdGAuXG4gIF8uZmlsdGVyID0gXy5zZWxlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocHJlZGljYXRlKHZhbHVlLCBpbmRleCwgbGlzdCkpIHJlc3VsdHMucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgZm9yIHdoaWNoIGEgdHJ1dGggdGVzdCBmYWlscy5cbiAgXy5yZWplY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubmVnYXRlKF8uaXRlcmF0ZWUocHJlZGljYXRlKSksIGNvbnRleHQpO1xuICB9O1xuXG4gIC8vIERldGVybWluZSB3aGV0aGVyIGFsbCBvZiB0aGUgZWxlbWVudHMgbWF0Y2ggYSB0cnV0aCB0ZXN0LlxuICAvLyBBbGlhc2VkIGFzIGBhbGxgLlxuICBfLmV2ZXJ5ID0gXy5hbGwgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBpbmRleCwgY3VycmVudEtleTtcbiAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmICghcHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIG9iamVjdCBtYXRjaGVzIGEgdHJ1dGggdGVzdC5cbiAgLy8gQWxpYXNlZCBhcyBgYW55YC5cbiAgXy5zb21lID0gXy5hbnkgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBpZiAocHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIGFycmF5IG9yIG9iamVjdCBjb250YWlucyBhIGdpdmVuIHZhbHVlICh1c2luZyBgPT09YCkuXG4gIC8vIEFsaWFzZWQgYXMgYGluY2x1ZGVgLlxuICBfLmNvbnRhaW5zID0gXy5pbmNsdWRlID0gZnVuY3Rpb24ob2JqLCB0YXJnZXQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBpZiAob2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGgpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgcmV0dXJuIF8uaW5kZXhPZihvYmosIHRhcmdldCkgPj0gMDtcbiAgfTtcblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgXy5pbnZva2UgPSBmdW5jdGlvbihvYmosIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHZhciBpc0Z1bmMgPSBfLmlzRnVuY3Rpb24obWV0aG9kKTtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIChpc0Z1bmMgPyBtZXRob2QgOiB2YWx1ZVttZXRob2RdKS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgXy5wbHVjayA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaWx0ZXJgOiBzZWxlY3Rpbmcgb25seSBvYmplY3RzXG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8ud2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0IG9iamVjdFxuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLmZpbmRXaGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy5maW5kKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtYXhpbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICBfLm1heCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gLUluZmluaXR5ICYmIHJlc3VsdCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5taW4gPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IEluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSBJbmZpbml0eSxcbiAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICBpZiAodmFsdWUgPCByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgaWYgKGNvbXB1dGVkIDwgbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSBJbmZpbml0eSAmJiByZXN1bHQgPT09IEluZmluaXR5KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFNodWZmbGUgYSBjb2xsZWN0aW9uLCB1c2luZyB0aGUgbW9kZXJuIHZlcnNpb24gb2YgdGhlXG4gIC8vIFtGaXNoZXItWWF0ZXMgc2h1ZmZsZV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXLigJNZYXRlc19zaHVmZmxlKS5cbiAgXy5zaHVmZmxlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHNldCA9IG9iaiAmJiBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IHNldC5sZW5ndGg7XG4gICAgdmFyIHNodWZmbGVkID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDAsIHJhbmQ7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICByYW5kID0gXy5yYW5kb20oMCwgaW5kZXgpO1xuICAgICAgaWYgKHJhbmQgIT09IGluZGV4KSBzaHVmZmxlZFtpbmRleF0gPSBzaHVmZmxlZFtyYW5kXTtcbiAgICAgIHNodWZmbGVkW3JhbmRdID0gc2V0W2luZGV4XTtcbiAgICB9XG4gICAgcmV0dXJuIHNodWZmbGVkO1xuICB9O1xuXG4gIC8vIFNhbXBsZSAqKm4qKiByYW5kb20gdmFsdWVzIGZyb20gYSBjb2xsZWN0aW9uLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBtYXBgLlxuICBfLnNhbXBsZSA9IGZ1bmN0aW9uKG9iaiwgbiwgZ3VhcmQpIHtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSB7XG4gICAgICBpZiAob2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGgpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgICByZXR1cm4gb2JqW18ucmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHJldHVybiBfLnNodWZmbGUob2JqKS5zbGljZSgwLCBNYXRoLm1heCgwLCBuKSk7XG4gIH07XG5cbiAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdGVlLlxuICBfLnNvcnRCeSA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgIGlmIChhID4gYiB8fCBhID09PSB2b2lkIDApIHJldHVybiAxO1xuICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIHZhciBncm91cCA9IGZ1bmN0aW9uKGJlaGF2aW9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGtleSA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCB2YWx1ZSwga2V5KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEdyb3VwcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLiBQYXNzIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGVcbiAgLy8gdG8gZ3JvdXAgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjcml0ZXJpb24uXG4gIF8uZ3JvdXBCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgIGlmIChfLmhhcyhyZXN1bHQsIGtleSkpIHJlc3VsdFtrZXldLnB1c2godmFsdWUpOyBlbHNlIHJlc3VsdFtrZXldID0gW3ZhbHVlXTtcbiAgfSk7XG5cbiAgLy8gSW5kZXhlcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLCBzaW1pbGFyIHRvIGBncm91cEJ5YCwgYnV0IGZvclxuICAvLyB3aGVuIHlvdSBrbm93IHRoYXQgeW91ciBpbmRleCB2YWx1ZXMgd2lsbCBiZSB1bmlxdWUuXG4gIF8uaW5kZXhCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gIH0pO1xuXG4gIC8vIENvdW50cyBpbnN0YW5jZXMgb2YgYW4gb2JqZWN0IHRoYXQgZ3JvdXAgYnkgYSBjZXJ0YWluIGNyaXRlcmlvbi4gUGFzc1xuICAvLyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlIHRvIGNvdW50IGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGVcbiAgLy8gY3JpdGVyaW9uLlxuICBfLmNvdW50QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoXy5oYXMocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XSsrOyBlbHNlIHJlc3VsdFtrZXldID0gMTtcbiAgfSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIF8uc29ydGVkSW5kZXggPSBmdW5jdGlvbihhcnJheSwgb2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0ZWUob2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGFycmF5Lmxlbmd0aDtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IGxvdyArIGhpZ2ggPj4+IDE7XG4gICAgICBpZiAoaXRlcmF0ZWUoYXJyYXlbbWlkXSkgPCB2YWx1ZSkgbG93ID0gbWlkICsgMTsgZWxzZSBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9O1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIF8udG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKF8uaXNBcnJheShvYmopKSByZXR1cm4gc2xpY2UuY2FsbChvYmopO1xuICAgIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgcmV0dXJuIF8ubWFwKG9iaiwgXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIF8udmFsdWVzKG9iaik7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gYW4gb2JqZWN0LlxuICBfLnNpemUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iai5sZW5ndGggOiBfLmtleXMob2JqKS5sZW5ndGg7XG4gIH07XG5cbiAgLy8gU3BsaXQgYSBjb2xsZWN0aW9uIGludG8gdHdvIGFycmF5czogb25lIHdob3NlIGVsZW1lbnRzIGFsbCBzYXRpc2Z5IHRoZSBnaXZlblxuICAvLyBwcmVkaWNhdGUsIGFuZCBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIGRvIG5vdCBzYXRpc2Z5IHRoZSBwcmVkaWNhdGUuXG4gIF8ucGFydGl0aW9uID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIHBhc3MgPSBbXSwgZmFpbCA9IFtdO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iaikge1xuICAgICAgKHByZWRpY2F0ZSh2YWx1ZSwga2V5LCBvYmopID8gcGFzcyA6IGZhaWwpLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiBbcGFzcywgZmFpbF07XG4gIH07XG5cbiAgLy8gQXJyYXkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgZmlyc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBBbGlhc2VkIGFzIGBoZWFkYCBhbmQgYHRha2VgLiBUaGUgKipndWFyZCoqIGNoZWNrXG4gIC8vIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5maXJzdCA9IF8uaGVhZCA9IF8udGFrZSA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVswXTtcbiAgICBpZiAobiA8IDApIHJldHVybiBbXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgbik7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgbGFzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEVzcGVjaWFsbHkgdXNlZnVsIG9uXG4gIC8vIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIGFsbCB0aGUgdmFsdWVzIGluXG4gIC8vIHRoZSBhcnJheSwgZXhjbHVkaW5nIHRoZSBsYXN0IE4uIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aFxuICAvLyBgXy5tYXBgLlxuICBfLmluaXRpYWwgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gKG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKSkpO1xuICB9O1xuXG4gIC8vIEdldCB0aGUgbGFzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBsYXN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKiBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ubGFzdCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgTWF0aC5tYXgoYXJyYXkubGVuZ3RoIC0gbiwgMCkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgdGFpbGAgYW5kIGBkcm9wYC5cbiAgLy8gRXNwZWNpYWxseSB1c2VmdWwgb24gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgYW4gKipuKiogd2lsbCByZXR1cm5cbiAgLy8gdGhlIHJlc3QgTiB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqXG4gIC8vIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5yZXN0ID0gXy50YWlsID0gXy5kcm9wID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKTtcbiAgfTtcblxuICAvLyBUcmltIG91dCBhbGwgZmFsc3kgdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gIF8uY29tcGFjdCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBfLmlkZW50aXR5KTtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIHZhciBmbGF0dGVuID0gZnVuY3Rpb24oaW5wdXQsIHNoYWxsb3csIHN0cmljdCwgb3V0cHV0KSB7XG4gICAgaWYgKHNoYWxsb3cgJiYgXy5ldmVyeShpbnB1dCwgXy5pc0FycmF5KSkge1xuICAgICAgcmV0dXJuIGNvbmNhdC5hcHBseShvdXRwdXQsIGlucHV0KTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdmFsdWUgPSBpbnB1dFtpXTtcbiAgICAgIGlmICghXy5pc0FycmF5KHZhbHVlKSAmJiAhXy5pc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgICAgaWYgKCFzdHJpY3QpIG91dHB1dC5wdXNoKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoc2hhbGxvdykge1xuICAgICAgICBwdXNoLmFwcGx5KG91dHB1dCwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmxhdHRlbih2YWx1ZSwgc2hhbGxvdywgc3RyaWN0LCBvdXRwdXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9O1xuXG4gIC8vIEZsYXR0ZW4gb3V0IGFuIGFycmF5LCBlaXRoZXIgcmVjdXJzaXZlbHkgKGJ5IGRlZmF1bHQpLCBvciBqdXN0IG9uZSBsZXZlbC5cbiAgXy5mbGF0dGVuID0gZnVuY3Rpb24oYXJyYXksIHNoYWxsb3cpIHtcbiAgICByZXR1cm4gZmxhdHRlbihhcnJheSwgc2hhbGxvdywgZmFsc2UsIFtdKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSB2ZXJzaW9uIG9mIHRoZSBhcnJheSB0aGF0IGRvZXMgbm90IGNvbnRhaW4gdGhlIHNwZWNpZmllZCB2YWx1ZShzKS5cbiAgXy53aXRob3V0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5kaWZmZXJlbmNlKGFycmF5LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYSBkdXBsaWNhdGUtZnJlZSB2ZXJzaW9uIG9mIHRoZSBhcnJheS4gSWYgdGhlIGFycmF5IGhhcyBhbHJlYWR5XG4gIC8vIGJlZW4gc29ydGVkLCB5b3UgaGF2ZSB0aGUgb3B0aW9uIG9mIHVzaW5nIGEgZmFzdGVyIGFsZ29yaXRobS5cbiAgLy8gQWxpYXNlZCBhcyBgdW5pcXVlYC5cbiAgXy51bmlxID0gXy51bmlxdWUgPSBmdW5jdGlvbihhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICBpZiAoIV8uaXNCb29sZWFuKGlzU29ydGVkKSkge1xuICAgICAgY29udGV4dCA9IGl0ZXJhdGVlO1xuICAgICAgaXRlcmF0ZWUgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChpdGVyYXRlZSAhPSBudWxsKSBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaV07XG4gICAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgICAgaWYgKCFpIHx8IHNlZW4gIT09IHZhbHVlKSByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIHNlZW4gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlcmF0ZWUpIHtcbiAgICAgICAgdmFyIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGksIGFycmF5KTtcbiAgICAgICAgaWYgKF8uaW5kZXhPZihzZWVuLCBjb21wdXRlZCkgPCAwKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoXy5pbmRleE9mKHJlc3VsdCwgdmFsdWUpIDwgMCkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB1bmlvbjogZWFjaCBkaXN0aW5jdCBlbGVtZW50IGZyb20gYWxsIG9mXG4gIC8vIHRoZSBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLnVuaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW5pcShmbGF0dGVuKGFyZ3VtZW50cywgdHJ1ZSwgdHJ1ZSwgW10pKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgZXZlcnkgaXRlbSBzaGFyZWQgYmV0d2VlbiBhbGwgdGhlXG4gIC8vIHBhc3NlZC1pbiBhcnJheXMuXG4gIF8uaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgYXJnc0xlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgICAgaWYgKF8uY29udGFpbnMocmVzdWx0LCBpdGVtKSkgY29udGludWU7XG4gICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGFyZ3NMZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoIV8uY29udGFpbnMoYXJndW1lbnRzW2pdLCBpdGVtKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaiA9PT0gYXJnc0xlbmd0aCkgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gVGFrZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIG9uZSBhcnJheSBhbmQgYSBudW1iZXIgb2Ygb3RoZXIgYXJyYXlzLlxuICAvLyBPbmx5IHRoZSBlbGVtZW50cyBwcmVzZW50IGluIGp1c3QgdGhlIGZpcnN0IGFycmF5IHdpbGwgcmVtYWluLlxuICBfLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gZmxhdHRlbihzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIHRydWUsIHRydWUsIFtdKTtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgIHJldHVybiAhXy5jb250YWlucyhyZXN0LCB2YWx1ZSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgXy56aXAgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0c1tpXSA9IF8ucGx1Y2soYXJndW1lbnRzLCBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gQ29udmVydHMgbGlzdHMgaW50byBvYmplY3RzLiBQYXNzIGVpdGhlciBhIHNpbmdsZSBhcnJheSBvZiBgW2tleSwgdmFsdWVdYFxuICAvLyBwYWlycywgb3IgdHdvIHBhcmFsbGVsIGFycmF5cyBvZiB0aGUgc2FtZSBsZW5ndGggLS0gb25lIG9mIGtleXMsIGFuZCBvbmUgb2ZcbiAgLy8gdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICBfLm9iamVjdCA9IGZ1bmN0aW9uKGxpc3QsIHZhbHVlcykge1xuICAgIGlmIChsaXN0ID09IG51bGwpIHJldHVybiB7fTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGxpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1dID0gdmFsdWVzW2ldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1bMF1dID0gbGlzdFtpXVsxXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFuIGl0ZW0gaW4gYW4gYXJyYXksXG4gIC8vIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIC8vIElmIHRoZSBhcnJheSBpcyBsYXJnZSBhbmQgYWxyZWFkeSBpbiBzb3J0IG9yZGVyLCBwYXNzIGB0cnVlYFxuICAvLyBmb3IgKippc1NvcnRlZCoqIHRvIHVzZSBiaW5hcnkgc2VhcmNoLlxuICBfLmluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgaXNTb3J0ZWQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpID0gaXNTb3J0ZWQgPCAwID8gTWF0aC5tYXgoMCwgbGVuZ3RoICsgaXNTb3J0ZWQpIDogaXNTb3J0ZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpID0gXy5zb3J0ZWRJbmRleChhcnJheSwgaXRlbSk7XG4gICAgICAgIHJldHVybiBhcnJheVtpXSA9PT0gaXRlbSA/IGkgOiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yICg7IGkgPCBsZW5ndGg7IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgXy5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uKGFycmF5LCBpdGVtLCBmcm9tKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaWR4ID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmICh0eXBlb2YgZnJvbSA9PSAnbnVtYmVyJykge1xuICAgICAgaWR4ID0gZnJvbSA8IDAgPyBpZHggKyBmcm9tICsgMSA6IE1hdGgubWluKGlkeCwgZnJvbSArIDEpO1xuICAgIH1cbiAgICB3aGlsZSAoLS1pZHggPj0gMCkgaWYgKGFycmF5W2lkeF0gPT09IGl0ZW0pIHJldHVybiBpZHg7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGFuIGludGVnZXIgQXJyYXkgY29udGFpbmluZyBhbiBhcml0aG1ldGljIHByb2dyZXNzaW9uLiBBIHBvcnQgb2ZcbiAgLy8gdGhlIG5hdGl2ZSBQeXRob24gYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWVcbiAgLy8gW3RoZSBQeXRob24gZG9jdW1lbnRhdGlvbl0oaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlKS5cbiAgXy5yYW5nZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzdGVwKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPD0gMSkge1xuICAgICAgc3RvcCA9IHN0YXJ0IHx8IDA7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBzdGVwIHx8IDE7XG5cbiAgICB2YXIgbGVuZ3RoID0gTWF0aC5tYXgoTWF0aC5jZWlsKChzdG9wIC0gc3RhcnQpIC8gc3RlcCksIDApO1xuICAgIHZhciByYW5nZSA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBsZW5ndGg7IGlkeCsrLCBzdGFydCArPSBzdGVwKSB7XG4gICAgICByYW5nZVtpZHhdID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJhbmdlO1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIChhaGVtKSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUmV1c2FibGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHByb3RvdHlwZSBzZXR0aW5nLlxuICB2YXIgQ3RvciA9IGZ1bmN0aW9uKCl7fTtcblxuICAvLyBDcmVhdGUgYSBmdW5jdGlvbiBib3VuZCB0byBhIGdpdmVuIG9iamVjdCAoYXNzaWduaW5nIGB0aGlzYCwgYW5kIGFyZ3VtZW50cyxcbiAgLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuICAvLyBhdmFpbGFibGUuXG4gIF8uYmluZCA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQpIHtcbiAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgaWYgKG5hdGl2ZUJpbmQgJiYgZnVuYy5iaW5kID09PSBuYXRpdmVCaW5kKSByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdCaW5kIG11c3QgYmUgY2FsbGVkIG9uIGEgZnVuY3Rpb24nKTtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIGJvdW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIEN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICB2YXIgc2VsZiA9IG5ldyBDdG9yO1xuICAgICAgQ3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBpZiAoXy5pc09iamVjdChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH07XG5cbiAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAvLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gXyBhY3RzXG4gIC8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbiAgXy5wYXJ0aWFsID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHZhciBib3VuZEFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBCaW5kIGEgbnVtYmVyIG9mIGFuIG9iamVjdCdzIG1ldGhvZHMgdG8gdGhhdCBvYmplY3QuIFJlbWFpbmluZyBhcmd1bWVudHNcbiAgLy8gYXJlIHRoZSBtZXRob2QgbmFtZXMgdG8gYmUgYm91bmQuIFVzZWZ1bCBmb3IgZW5zdXJpbmcgdGhhdCBhbGwgY2FsbGJhY2tzXG4gIC8vIGRlZmluZWQgb24gYW4gb2JqZWN0IGJlbG9uZyB0byBpdC5cbiAgXy5iaW5kQWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGksIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsIGtleTtcbiAgICBpZiAobGVuZ3RoIDw9IDEpIHRocm93IG5ldyBFcnJvcignYmluZEFsbCBtdXN0IGJlIHBhc3NlZCBmdW5jdGlvbiBuYW1lcycpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAga2V5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgb2JqW2tleV0gPSBfLmJpbmQob2JqW2tleV0sIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gTWVtb2l6ZSBhbiBleHBlbnNpdmUgZnVuY3Rpb24gYnkgc3RvcmluZyBpdHMgcmVzdWx0cy5cbiAgXy5tZW1vaXplID0gZnVuY3Rpb24oZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW9pemUgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHZhciBjYWNoZSA9IG1lbW9pemUuY2FjaGU7XG4gICAgICB2YXIgYWRkcmVzcyA9IGhhc2hlciA/IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5O1xuICAgICAgaWYgKCFfLmhhcyhjYWNoZSwgYWRkcmVzcykpIGNhY2hlW2FkZHJlc3NdID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGNhY2hlW2FkZHJlc3NdO1xuICAgIH07XG4gICAgbWVtb2l6ZS5jYWNoZSA9IHt9O1xuICAgIHJldHVybiBtZW1vaXplO1xuICB9O1xuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICBfLmRlbGF5ID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9LCB3YWl0KTtcbiAgfTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgXy5kZWZlciA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICByZXR1cm4gXy5kZWxheS5hcHBseShfLCBbZnVuYywgMV0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgd2hlbiBpbnZva2VkLCB3aWxsIG9ubHkgYmUgdHJpZ2dlcmVkIGF0IG1vc3Qgb25jZVxuICAvLyBkdXJpbmcgYSBnaXZlbiB3aW5kb3cgb2YgdGltZS4gTm9ybWFsbHksIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCBydW5cbiAgLy8gYXMgbXVjaCBhcyBpdCBjYW4sIHdpdGhvdXQgZXZlciBnb2luZyBtb3JlIHRoYW4gb25jZSBwZXIgYHdhaXRgIGR1cmF0aW9uO1xuICAvLyBidXQgaWYgeW91J2QgbGlrZSB0byBkaXNhYmxlIHRoZSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSwgcGFzc1xuICAvLyBge2xlYWRpbmc6IGZhbHNlfWAuIFRvIGRpc2FibGUgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlLCBkaXR0by5cbiAgXy50aHJvdHRsZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcbiAgICB2YXIgcHJldmlvdXMgPSAwO1xuICAgIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcHJldmlvdXMgPSBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlID8gMCA6IF8ubm93KCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9O1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBfLm5vdygpO1xuICAgICAgaWYgKCFwcmV2aW91cyAmJiBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlKSBwcmV2aW91cyA9IG5vdztcbiAgICAgIHZhciByZW1haW5pbmcgPSB3YWl0IC0gKG5vdyAtIHByZXZpb3VzKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGlmIChyZW1haW5pbmcgPD0gMCB8fCByZW1haW5pbmcgPiB3YWl0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIHByZXZpb3VzID0gbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCBhcyBsb25nIGFzIGl0IGNvbnRpbnVlcyB0byBiZSBpbnZva2VkLCB3aWxsIG5vdFxuICAvLyBiZSB0cmlnZ2VyZWQuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCBhZnRlciBpdCBzdG9wcyBiZWluZyBjYWxsZWQgZm9yXG4gIC8vIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICAvLyBsZWFkaW5nIGVkZ2UsIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLlxuICBfLmRlYm91bmNlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgaW1tZWRpYXRlKSB7XG4gICAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcCwgcmVzdWx0O1xuXG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGFzdCA9IF8ubm93KCkgLSB0aW1lc3RhbXA7XG5cbiAgICAgIGlmIChsYXN0IDwgd2FpdCAmJiBsYXN0ID4gMCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aW1lc3RhbXAgPSBfLm5vdygpO1xuICAgICAgdmFyIGNhbGxOb3cgPSBpbW1lZGlhdGUgJiYgIXRpbWVvdXQ7XG4gICAgICBpZiAoIXRpbWVvdXQpIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgIGlmIChjYWxsTm93KSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGZ1bmN0aW9uIHBhc3NlZCBhcyBhbiBhcmd1bWVudCB0byB0aGUgc2Vjb25kLFxuICAvLyBhbGxvd2luZyB5b3UgdG8gYWRqdXN0IGFyZ3VtZW50cywgcnVuIGNvZGUgYmVmb3JlIGFuZCBhZnRlciwgYW5kXG4gIC8vIGNvbmRpdGlvbmFsbHkgZXhlY3V0ZSB0aGUgb3JpZ2luYWwgZnVuY3Rpb24uXG4gIF8ud3JhcCA9IGZ1bmN0aW9uKGZ1bmMsIHdyYXBwZXIpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHdyYXBwZXIsIGZ1bmMpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBuZWdhdGVkIHZlcnNpb24gb2YgdGhlIHBhc3NlZC1pbiBwcmVkaWNhdGUuXG4gIF8ubmVnYXRlID0gZnVuY3Rpb24ocHJlZGljYXRlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICFwcmVkaWNhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBhIGxpc3Qgb2YgZnVuY3Rpb25zLCBlYWNoXG4gIC8vIGNvbnN1bWluZyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gIF8uY29tcG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgIHZhciBzdGFydCA9IGFyZ3MubGVuZ3RoIC0gMTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSA9IHN0YXJ0O1xuICAgICAgdmFyIHJlc3VsdCA9IGFyZ3Nbc3RhcnRdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB3aGlsZSAoaS0tKSByZXN1bHQgPSBhcmdzW2ldLmNhbGwodGhpcywgcmVzdWx0KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgYWZ0ZXIgYmVpbmcgY2FsbGVkIE4gdGltZXMuXG4gIF8uYWZ0ZXIgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGJlZm9yZSBiZWluZyBjYWxsZWQgTiB0aW1lcy5cbiAgXy5iZWZvcmUgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHZhciBtZW1vO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzID4gMCkge1xuICAgICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVuYyA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYXQgbW9zdCBvbmUgdGltZSwgbm8gbWF0dGVyIGhvd1xuICAvLyBvZnRlbiB5b3UgY2FsbCBpdC4gVXNlZnVsIGZvciBsYXp5IGluaXRpYWxpemF0aW9uLlxuICBfLm9uY2UgPSBfLnBhcnRpYWwoXy5iZWZvcmUsIDIpO1xuXG4gIC8vIE9iamVjdCBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgT2JqZWN0LmtleXNgXG4gIF8ua2V5cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgaWYgKG5hdGl2ZUtleXMpIHJldHVybiBuYXRpdmVLZXlzKG9iaik7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9O1xuXG4gIC8vIENvbnZlcnQgYW4gb2JqZWN0IGludG8gYSBsaXN0IG9mIGBba2V5LCB2YWx1ZV1gIHBhaXJzLlxuICBfLnBhaXJzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtrZXlzW2ldLCBvYmpba2V5c1tpXV1dO1xuICAgIH1cbiAgICByZXR1cm4gcGFpcnM7XG4gIH07XG5cbiAgLy8gSW52ZXJ0IHRoZSBrZXlzIGFuZCB2YWx1ZXMgb2YgYW4gb2JqZWN0LiBUaGUgdmFsdWVzIG11c3QgYmUgc2VyaWFsaXphYmxlLlxuICBfLmludmVydCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW2tleXNbaV1dXSA9IGtleXNbaV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgc29ydGVkIGxpc3Qgb2YgdGhlIGZ1bmN0aW9uIG5hbWVzIGF2YWlsYWJsZSBvbiB0aGUgb2JqZWN0LlxuICAvLyBBbGlhc2VkIGFzIGBtZXRob2RzYFxuICBfLmZ1bmN0aW9ucyA9IF8ubWV0aG9kcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChfLmlzRnVuY3Rpb24ob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH07XG5cbiAgLy8gRXh0ZW5kIGEgZ2l2ZW4gb2JqZWN0IHdpdGggYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHBhc3NlZC1pbiBvYmplY3QocykuXG4gIF8uZXh0ZW5kID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICBmb3IgKHZhciBpID0gMSwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwgcHJvcCkpIHtcbiAgICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCBvbmx5IGNvbnRhaW5pbmcgdGhlIHdoaXRlbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ucGljayA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0ge30sIGtleTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgICBpZiAoaXRlcmF0ZWUodmFsdWUsIGtleSwgb2JqKSkgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoW10sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICBpZiAoa2V5IGluIG9iaikgcmVzdWx0W2tleV0gPSBvYmpba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKGl0ZXJhdGVlKSkge1xuICAgICAgaXRlcmF0ZWUgPSBfLm5lZ2F0ZShpdGVyYXRlZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5tYXAoY29uY2F0LmFwcGx5KFtdLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpLCBTdHJpbmcpO1xuICAgICAgaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJldHVybiAhXy5jb250YWlucyhrZXlzLCBrZXkpO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIF8ucGljayhvYmosIGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBGaWxsIGluIGEgZ2l2ZW4gb2JqZWN0IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzLlxuICBfLmRlZmF1bHRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHZvaWQgMCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYGlzRXF1YWxgLlxuICB2YXIgZXEgPSBmdW5jdGlvbihhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT09IDEgLyBiO1xuICAgIC8vIEEgc3RyaWN0IGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYG51bGwgPT0gdW5kZWZpbmVkYC5cbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGEgPT09IGI7XG4gICAgLy8gVW53cmFwIGFueSB3cmFwcGVkIG9iamVjdHMuXG4gICAgaWYgKGEgaW5zdGFuY2VvZiBfKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8pIGIgPSBiLl93cmFwcGVkO1xuICAgIC8vIENvbXBhcmUgYFtbQ2xhc3NdXWAgbmFtZXMuXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gICAgaWYgKGNsYXNzTmFtZSAhPT0gdG9TdHJpbmcuY2FsbChiKSkgcmV0dXJuIGZhbHNlO1xuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICAvLyBTdHJpbmdzLCBudW1iZXJzLCByZWd1bGFyIGV4cHJlc3Npb25zLCBkYXRlcywgYW5kIGJvb2xlYW5zIGFyZSBjb21wYXJlZCBieSB2YWx1ZS5cbiAgICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICAvLyBSZWdFeHBzIGFyZSBjb2VyY2VkIHRvIHN0cmluZ3MgZm9yIGNvbXBhcmlzb24gKE5vdGU6ICcnICsgL2EvaSA9PT0gJy9hL2knKVxuICAgICAgY2FzZSAnW29iamVjdCBTdHJpbmddJzpcbiAgICAgICAgLy8gUHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3Qgd3JhcHBlcnMgYXJlIGVxdWl2YWxlbnQ7IHRodXMsIGBcIjVcImAgaXNcbiAgICAgICAgLy8gZXF1aXZhbGVudCB0byBgbmV3IFN0cmluZyhcIjVcIilgLlxuICAgICAgICByZXR1cm4gJycgKyBhID09PSAnJyArIGI7XG4gICAgICBjYXNlICdbb2JqZWN0IE51bWJlcl0nOlxuICAgICAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLlxuICAgICAgICAvLyBPYmplY3QoTmFOKSBpcyBlcXVpdmFsZW50IHRvIE5hTlxuICAgICAgICBpZiAoK2EgIT09ICthKSByZXR1cm4gK2IgIT09ICtiO1xuICAgICAgICAvLyBBbiBgZWdhbGAgY29tcGFyaXNvbiBpcyBwZXJmb3JtZWQgZm9yIG90aGVyIG51bWVyaWMgdmFsdWVzLlxuICAgICAgICByZXR1cm4gK2EgPT09IDAgPyAxIC8gK2EgPT09IDEgLyBiIDogK2EgPT09ICtiO1xuICAgICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgICAgLy8gQ29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1lcmljIHByaW1pdGl2ZSB2YWx1ZXMuIERhdGVzIGFyZSBjb21wYXJlZCBieSB0aGVpclxuICAgICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgICAgcmV0dXJuICthID09PSArYjtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhICE9ICdvYmplY3QnIHx8IHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PT0gYjtcbiAgICB9XG4gICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gICAgLy8gZnJvbSBkaWZmZXJlbnQgZnJhbWVzIGFyZS5cbiAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgaWYgKFxuICAgICAgYUN0b3IgIT09IGJDdG9yICYmXG4gICAgICAvLyBIYW5kbGUgT2JqZWN0LmNyZWF0ZSh4KSBjYXNlc1xuICAgICAgJ2NvbnN0cnVjdG9yJyBpbiBhICYmICdjb25zdHJ1Y3RvcicgaW4gYiAmJlxuICAgICAgIShfLmlzRnVuY3Rpb24oYUN0b3IpICYmIGFDdG9yIGluc3RhbmNlb2YgYUN0b3IgJiZcbiAgICAgICAgXy5pc0Z1bmN0aW9uKGJDdG9yKSAmJiBiQ3RvciBpbnN0YW5jZW9mIGJDdG9yKVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG4gICAgdmFyIHNpemUsIHJlc3VsdDtcbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoY2xhc3NOYW1lID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICAgIHJlc3VsdCA9IHNpemUgPT09IGIubGVuZ3RoO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgdGhlIGNvbnRlbnRzLCBpZ25vcmluZyBub24tbnVtZXJpYyBwcm9wZXJ0aWVzLlxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gZXEoYVtzaXplXSwgYltzaXplXSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhhKSwga2V5O1xuICAgICAgc2l6ZSA9IGtleXMubGVuZ3RoO1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMgYmVmb3JlIGNvbXBhcmluZyBkZWVwIGVxdWFsaXR5LlxuICAgICAgcmVzdWx0ID0gXy5rZXlzKGIpLmxlbmd0aCA9PT0gc2l6ZTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIC8vIERlZXAgY29tcGFyZSBlYWNoIG1lbWJlclxuICAgICAgICAgIGtleSA9IGtleXNbc2l6ZV07XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmVtb3ZlIHRoZSBmaXJzdCBvYmplY3QgZnJvbSB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnBvcCgpO1xuICAgIGJTdGFjay5wb3AoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFBlcmZvcm0gYSBkZWVwIGNvbXBhcmlzb24gdG8gY2hlY2sgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsLlxuICBfLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGVxKGEsIGIsIFtdLCBbXSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIF8uaXNFbXB0eSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKF8uaXNBcnJheShvYmopIHx8IF8uaXNTdHJpbmcob2JqKSB8fCBfLmlzQXJndW1lbnRzKG9iaikpIHJldHVybiBvYmoubGVuZ3RoID09PSAwO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChfLmhhcyhvYmosIGtleSkpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgRE9NIGVsZW1lbnQ/XG4gIF8uaXNFbGVtZW50ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYW4gYXJyYXk/XG4gIC8vIERlbGVnYXRlcyB0byBFQ01BNSdzIG5hdGl2ZSBBcnJheS5pc0FycmF5XG4gIF8uaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIGFuIG9iamVjdD9cbiAgXy5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIG9iajtcbiAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbiAgfTtcblxuICAvLyBBZGQgc29tZSBpc1R5cGUgbWV0aG9kczogaXNBcmd1bWVudHMsIGlzRnVuY3Rpb24sIGlzU3RyaW5nLCBpc051bWJlciwgaXNEYXRlLCBpc1JlZ0V4cC5cbiAgXy5lYWNoKFsnQXJndW1lbnRzJywgJ0Z1bmN0aW9uJywgJ1N0cmluZycsICdOdW1iZXInLCAnRGF0ZScsICdSZWdFeHAnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIF9bJ2lzJyArIG5hbWVdID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCAnICsgbmFtZSArICddJztcbiAgICB9O1xuICB9KTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFKSwgd2hlcmVcbiAgLy8gdGhlcmUgaXNuJ3QgYW55IGluc3BlY3RhYmxlIFwiQXJndW1lbnRzXCIgdHlwZS5cbiAgaWYgKCFfLmlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICBfLmlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gXy5oYXMob2JqLCAnY2FsbGVlJyk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS4gV29yayBhcm91bmQgYW4gSUUgMTEgYnVnLlxuICBpZiAodHlwZW9mIC8uLyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIF8uaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT0gJ2Z1bmN0aW9uJyB8fCBmYWxzZTtcbiAgICB9O1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBfLmlzRmluaXRlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIGlzRmluaXRlKG9iaikgJiYgIWlzTmFOKHBhcnNlRmxvYXQob2JqKSk7XG4gIH07XG5cbiAgLy8gSXMgdGhlIGdpdmVuIHZhbHVlIGBOYU5gPyAoTmFOIGlzIHRoZSBvbmx5IG51bWJlciB3aGljaCBkb2VzIG5vdCBlcXVhbCBpdHNlbGYpLlxuICBfLmlzTmFOID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8uaXNOdW1iZXIob2JqKSAmJiBvYmogIT09ICtvYmo7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIGJvb2xlYW4/XG4gIF8uaXNCb29sZWFuID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgZXF1YWwgdG8gbnVsbD9cbiAgXy5pc051bGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgdW5kZWZpbmVkP1xuICBfLmlzVW5kZWZpbmVkID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdm9pZCAwO1xuICB9O1xuXG4gIC8vIFNob3J0Y3V0IGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gcHJvcGVydHkgZGlyZWN0bHlcbiAgLy8gb24gaXRzZWxmIChpbiBvdGhlciB3b3Jkcywgbm90IG9uIGEgcHJvdG90eXBlKS5cbiAgXy5oYXMgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBvYmogIT0gbnVsbCAmJiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbiAgfTtcblxuICAvLyBVdGlsaXR5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJ1biBVbmRlcnNjb3JlLmpzIGluICpub0NvbmZsaWN0KiBtb2RlLCByZXR1cm5pbmcgdGhlIGBfYCB2YXJpYWJsZSB0byBpdHNcbiAgLy8gcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290Ll8gPSBwcmV2aW91c1VuZGVyc2NvcmU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLy8gS2VlcCB0aGUgaWRlbnRpdHkgZnVuY3Rpb24gYXJvdW5kIGZvciBkZWZhdWx0IGl0ZXJhdGVlcy5cbiAgXy5pZGVudGl0eSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIF8uY29uc3RhbnQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9O1xuXG4gIF8ubm9vcCA9IGZ1bmN0aW9uKCl7fTtcblxuICBfLnByb3BlcnR5ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9ialtrZXldO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIHByZWRpY2F0ZSBmb3IgY2hlY2tpbmcgd2hldGhlciBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gc2V0IG9mIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLm1hdGNoZXMgPSBmdW5jdGlvbihhdHRycykge1xuICAgIHZhciBwYWlycyA9IF8ucGFpcnMoYXR0cnMpLCBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gIWxlbmd0aDtcbiAgICAgIG9iaiA9IG5ldyBPYmplY3Qob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpXSwga2V5ID0gcGFpclswXTtcbiAgICAgICAgaWYgKHBhaXJbMV0gIT09IG9ialtrZXldIHx8ICEoa2V5IGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIF8udGltZXMgPSBmdW5jdGlvbihuLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciBhY2N1bSA9IEFycmF5KE1hdGgubWF4KDAsIG4pKTtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRlZShpKTtcbiAgICByZXR1cm4gYWNjdW07XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBtaW4gYW5kIG1heCAoaW5jbHVzaXZlKS5cbiAgXy5yYW5kb20gPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH07XG5cbiAgLy8gQSAocG9zc2libHkgZmFzdGVyKSB3YXkgdG8gZ2V0IHRoZSBjdXJyZW50IHRpbWVzdGFtcCBhcyBhbiBpbnRlZ2VyLlxuICBfLm5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgfTtcblxuICAgLy8gTGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciBlc2NhcGluZy5cbiAgdmFyIGVzY2FwZU1hcCA9IHtcbiAgICAnJic6ICcmYW1wOycsXG4gICAgJzwnOiAnJmx0OycsXG4gICAgJz4nOiAnJmd0OycsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmI3gyNzsnLFxuICAgICdgJzogJyYjeDYwOydcbiAgfTtcbiAgdmFyIHVuZXNjYXBlTWFwID0gXy5pbnZlcnQoZXNjYXBlTWFwKTtcblxuICAvLyBGdW5jdGlvbnMgZm9yIGVzY2FwaW5nIGFuZCB1bmVzY2FwaW5nIHN0cmluZ3MgdG8vZnJvbSBIVE1MIGludGVycG9sYXRpb24uXG4gIHZhciBjcmVhdGVFc2NhcGVyID0gZnVuY3Rpb24obWFwKSB7XG4gICAgdmFyIGVzY2FwZXIgPSBmdW5jdGlvbihtYXRjaCkge1xuICAgICAgcmV0dXJuIG1hcFttYXRjaF07XG4gICAgfTtcbiAgICAvLyBSZWdleGVzIGZvciBpZGVudGlmeWluZyBhIGtleSB0aGF0IG5lZWRzIHRvIGJlIGVzY2FwZWRcbiAgICB2YXIgc291cmNlID0gJyg/OicgKyBfLmtleXMobWFwKS5qb2luKCd8JykgKyAnKSc7XG4gICAgdmFyIHRlc3RSZWdleHAgPSBSZWdFeHAoc291cmNlKTtcbiAgICB2YXIgcmVwbGFjZVJlZ2V4cCA9IFJlZ0V4cChzb3VyY2UsICdnJyk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgc3RyaW5nID0gc3RyaW5nID09IG51bGwgPyAnJyA6ICcnICsgc3RyaW5nO1xuICAgICAgcmV0dXJuIHRlc3RSZWdleHAudGVzdChzdHJpbmcpID8gc3RyaW5nLnJlcGxhY2UocmVwbGFjZVJlZ2V4cCwgZXNjYXBlcikgOiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbiAgXy5lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKGVzY2FwZU1hcCk7XG4gIF8udW5lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKHVuZXNjYXBlTWFwKTtcblxuICAvLyBJZiB0aGUgdmFsdWUgb2YgdGhlIG5hbWVkIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvbiB0aGVuIGludm9rZSBpdCB3aXRoIHRoZVxuICAvLyBgb2JqZWN0YCBhcyBjb250ZXh0OyBvdGhlcndpc2UsIHJldHVybiBpdC5cbiAgXy5yZXN1bHQgPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIHZhciB2YWx1ZSA9IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgcmV0dXJuIF8uaXNGdW5jdGlvbih2YWx1ZSkgPyBvYmplY3RbcHJvcGVydHldKCkgOiB2YWx1ZTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhIHVuaXF1ZSBpbnRlZ2VyIGlkICh1bmlxdWUgd2l0aGluIHRoZSBlbnRpcmUgY2xpZW50IHNlc3Npb24pLlxuICAvLyBVc2VmdWwgZm9yIHRlbXBvcmFyeSBET00gaWRzLlxuICB2YXIgaWRDb3VudGVyID0gMDtcbiAgXy51bmlxdWVJZCA9IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH07XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLCBjaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgIGV2YWx1YXRlICAgIDogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZSA6IC88JT0oW1xcc1xcU10rPyklPi9nLFxuICAgIGVzY2FwZSAgICAgIDogLzwlLShbXFxzXFxTXSs/KSU+L2dcbiAgfTtcblxuICAvLyBXaGVuIGN1c3RvbWl6aW5nIGB0ZW1wbGF0ZVNldHRpbmdzYCwgaWYgeW91IGRvbid0IHdhbnQgdG8gZGVmaW5lIGFuXG4gIC8vIGludGVycG9sYXRpb24sIGV2YWx1YXRpb24gb3IgZXNjYXBpbmcgcmVnZXgsIHdlIG5lZWQgb25lIHRoYXQgaXNcbiAgLy8gZ3VhcmFudGVlZCBub3QgdG8gbWF0Y2guXG4gIHZhciBub01hdGNoID0gLyguKV4vO1xuXG4gIC8vIENlcnRhaW4gY2hhcmFjdGVycyBuZWVkIHRvIGJlIGVzY2FwZWQgc28gdGhhdCB0aGV5IGNhbiBiZSBwdXQgaW50byBhXG4gIC8vIHN0cmluZyBsaXRlcmFsLlxuICB2YXIgZXNjYXBlcyA9IHtcbiAgICBcIidcIjogICAgICBcIidcIixcbiAgICAnXFxcXCc6ICAgICAnXFxcXCcsXG4gICAgJ1xccic6ICAgICAncicsXG4gICAgJ1xcbic6ICAgICAnbicsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIHZhciBlc2NhcGVyID0gL1xcXFx8J3xcXHJ8XFxufFxcdTIwMjh8XFx1MjAyOS9nO1xuXG4gIHZhciBlc2NhcGVDaGFyID0gZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gJ1xcXFwnICsgZXNjYXBlc1ttYXRjaF07XG4gIH07XG5cbiAgLy8gSmF2YVNjcmlwdCBtaWNyby10ZW1wbGF0aW5nLCBzaW1pbGFyIHRvIEpvaG4gUmVzaWcncyBpbXBsZW1lbnRhdGlvbi5cbiAgLy8gVW5kZXJzY29yZSB0ZW1wbGF0aW5nIGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlcyB3aGl0ZXNwYWNlLFxuICAvLyBhbmQgY29ycmVjdGx5IGVzY2FwZXMgcXVvdGVzIHdpdGhpbiBpbnRlcnBvbGF0ZWQgY29kZS5cbiAgLy8gTkI6IGBvbGRTZXR0aW5nc2Agb25seSBleGlzdHMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICBfLnRlbXBsYXRlID0gZnVuY3Rpb24odGV4dCwgc2V0dGluZ3MsIG9sZFNldHRpbmdzKSB7XG4gICAgaWYgKCFzZXR0aW5ncyAmJiBvbGRTZXR0aW5ncykgc2V0dGluZ3MgPSBvbGRTZXR0aW5ncztcbiAgICBzZXR0aW5ncyA9IF8uZGVmYXVsdHMoe30sIHNldHRpbmdzLCBfLnRlbXBsYXRlU2V0dGluZ3MpO1xuXG4gICAgLy8gQ29tYmluZSBkZWxpbWl0ZXJzIGludG8gb25lIHJlZ3VsYXIgZXhwcmVzc2lvbiB2aWEgYWx0ZXJuYXRpb24uXG4gICAgdmFyIG1hdGNoZXIgPSBSZWdFeHAoW1xuICAgICAgKHNldHRpbmdzLmVzY2FwZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuaW50ZXJwb2xhdGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmV2YWx1YXRlIHx8IG5vTWF0Y2gpLnNvdXJjZVxuICAgIF0uam9pbignfCcpICsgJ3wkJywgJ2cnKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIHRlbXBsYXRlIHNvdXJjZSwgZXNjYXBpbmcgc3RyaW5nIGxpdGVyYWxzIGFwcHJvcHJpYXRlbHkuXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc291cmNlID0gXCJfX3ArPSdcIjtcbiAgICB0ZXh0LnJlcGxhY2UobWF0Y2hlciwgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZSwgaW50ZXJwb2xhdGUsIGV2YWx1YXRlLCBvZmZzZXQpIHtcbiAgICAgIHNvdXJjZSArPSB0ZXh0LnNsaWNlKGluZGV4LCBvZmZzZXQpLnJlcGxhY2UoZXNjYXBlciwgZXNjYXBlQ2hhcik7XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfSBlbHNlIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cblxuICAgICAgLy8gQWRvYmUgVk1zIG5lZWQgdGhlIG1hdGNoIHJldHVybmVkIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3Qgb2ZmZXN0LlxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBJZiBhIHZhcmlhYmxlIGlzIG5vdCBzcGVjaWZpZWQsIHBsYWNlIGRhdGEgdmFsdWVzIGluIGxvY2FsIHNjb3BlLlxuICAgIGlmICghc2V0dGluZ3MudmFyaWFibGUpIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG5cbiAgICBzb3VyY2UgPSBcInZhciBfX3QsX19wPScnLF9faj1BcnJheS5wcm90b3R5cGUuam9pbixcIiArXG4gICAgICBcInByaW50PWZ1bmN0aW9uKCl7X19wKz1fX2ouY2FsbChhcmd1bWVudHMsJycpO307XFxuXCIgK1xuICAgICAgc291cmNlICsgJ3JldHVybiBfX3A7XFxuJztcblxuICAgIHRyeSB7XG4gICAgICB2YXIgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonLCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfKTtcbiAgICB9O1xuXG4gICAgLy8gUHJvdmlkZSB0aGUgY29tcGlsZWQgc291cmNlIGFzIGEgY29udmVuaWVuY2UgZm9yIHByZWNvbXBpbGF0aW9uLlxuICAgIHZhciBhcmd1bWVudCA9IHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonO1xuICAgIHRlbXBsYXRlLnNvdXJjZSA9ICdmdW5jdGlvbignICsgYXJndW1lbnQgKyAnKXtcXG4nICsgc291cmNlICsgJ30nO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9O1xuXG4gIC8vIEFkZCBhIFwiY2hhaW5cIiBmdW5jdGlvbi4gU3RhcnQgY2hhaW5pbmcgYSB3cmFwcGVkIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLmNoYWluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGluc3RhbmNlID0gXyhvYmopO1xuICAgIGluc3RhbmNlLl9jaGFpbiA9IHRydWU7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9O1xuXG4gIC8vIE9PUFxuICAvLyAtLS0tLS0tLS0tLS0tLS1cbiAgLy8gSWYgVW5kZXJzY29yZSBpcyBjYWxsZWQgYXMgYSBmdW5jdGlvbiwgaXQgcmV0dXJucyBhIHdyYXBwZWQgb2JqZWN0IHRoYXRcbiAgLy8gY2FuIGJlIHVzZWQgT08tc3R5bGUuIFRoaXMgd3JhcHBlciBob2xkcyBhbHRlcmVkIHZlcnNpb25zIG9mIGFsbCB0aGVcbiAgLy8gdW5kZXJzY29yZSBmdW5jdGlvbnMuIFdyYXBwZWQgb2JqZWN0cyBtYXkgYmUgY2hhaW5lZC5cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIHZhciByZXN1bHQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhaW4gPyBfKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfTtcblxuICAvLyBBZGQgeW91ciBvd24gY3VzdG9tIGZ1bmN0aW9ucyB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubWl4aW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICBfLmVhY2goXy5mdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfW25hbWVdID0gb2JqW25hbWVdO1xuICAgICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fd3JhcHBlZF07XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIGZ1bmMuYXBwbHkoXywgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBBZGQgYWxsIG9mIHRoZSBVbmRlcnNjb3JlIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlciBvYmplY3QuXG4gIF8ubWl4aW4oXyk7XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgXy5lYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9iaiA9IHRoaXMuX3dyYXBwZWQ7XG4gICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKChuYW1lID09PSAnc2hpZnQnIHx8IG5hbWUgPT09ICdzcGxpY2UnKSAmJiBvYmoubGVuZ3RoID09PSAwKSBkZWxldGUgb2JqWzBdO1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGFsbCBhY2Nlc3NvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIF8uZWFjaChbJ2NvbmNhdCcsICdqb2luJywgJ3NsaWNlJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG1ldGhvZC5hcHBseSh0aGlzLl93cmFwcGVkLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBFeHRyYWN0cyB0aGUgcmVzdWx0IGZyb20gYSB3cmFwcGVkIGFuZCBjaGFpbmVkIG9iamVjdC5cbiAgXy5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgfTtcblxuICAvLyBBTUQgcmVnaXN0cmF0aW9uIGhhcHBlbnMgYXQgdGhlIGVuZCBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIEFNRCBsb2FkZXJzXG4gIC8vIHRoYXQgbWF5IG5vdCBlbmZvcmNlIG5leHQtdHVybiBzZW1hbnRpY3Mgb24gbW9kdWxlcy4gRXZlbiB0aG91Z2ggZ2VuZXJhbFxuICAvLyBwcmFjdGljZSBmb3IgQU1EIHJlZ2lzdHJhdGlvbiBpcyB0byBiZSBhbm9ueW1vdXMsIHVuZGVyc2NvcmUgcmVnaXN0ZXJzXG4gIC8vIGFzIGEgbmFtZWQgbW9kdWxlIGJlY2F1c2UsIGxpa2UgalF1ZXJ5LCBpdCBpcyBhIGJhc2UgbGlicmFyeSB0aGF0IGlzXG4gIC8vIHBvcHVsYXIgZW5vdWdoIHRvIGJlIGJ1bmRsZWQgaW4gYSB0aGlyZCBwYXJ0eSBsaWIsIGJ1dCBub3QgYmUgcGFydCBvZlxuICAvLyBhbiBBTUQgbG9hZCByZXF1ZXN0LiBUaG9zZSBjYXNlcyBjb3VsZCBnZW5lcmF0ZSBhbiBlcnJvciB3aGVuIGFuXG4gIC8vIGFub255bW91cyBkZWZpbmUoKSBpcyBjYWxsZWQgb3V0c2lkZSBvZiBhIGxvYWRlciByZXF1ZXN0LlxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKCd1bmRlcnNjb3JlJywgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIF87XG4gICAgfSk7XG4gIH1cbn0uY2FsbCh0aGlzKSk7XG4iXX0=
