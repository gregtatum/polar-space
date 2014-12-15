(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./js/index.js":[function(require,module,exports){
require('./routing');
},{"./routing":"/Users/gregtatum/Dropbox/greg-sites/polar/js/routing.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js":[function(require,module,exports){
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

},{"../utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js":[function(require,module,exports){
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
	
	getCanvas : function() {
		if( renderer ) {
			return renderer.domElement;
		}
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
var destroyMesh = require('./utils/destroyMesh');

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
		this.poem.on('destroy', destroyMesh( this.object ) );
		
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
		
	}(),
	
	destroy : function() {
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
	
};
},{"./components/Damage":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js","./components/Hid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Hid.js","./utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Camera.js":[function(require,module,exports){
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
var destroyMesh = require('../utils/destroyMesh');

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
	var eccentricity	= _.isNumber( properties.eccentricity ) ? properties.eccentricity : 0.1;
	var iterations		= _.isNumber( properties.iterations ) ? properties.iterations : 10;
	
	_generateMultipleCylinderVertices(
		iterations,
		geometry.vertices,
		sides,
		radius,
		poem.height,
		eccentricity
	);
	
	var waveVertices = _verticesWaver( geometry.vertices, poem.height * 0.1 );
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
	this.poem.on('destroy', destroyMesh( this.object) );
	
	this.poem.on('update', function( e ) {

		h = (h + 0.0002 * e.dt) % 1;
		material.color.setHSL( h, s, l );
		waveVertices( e );
		geometry.verticesNeedUpdate = true;

	}.bind(this));
	
};


function _generateMultipleCylinderVertices( iterations, vertices, sides, radius, height, eccentricity ) {
	
	var ratio1, ratio2;
	
	for( var i=0; i < iterations; i++ ) {
		
		ratio1 = i / iterations;
		ratio2 = 1 - ratio1;
		
		_generateCylinderVertices(
			vertices,
			Math.floor( (sides - 3) * ratio2 ) + 3,
			radius * ratio2,
			height * ratio2 * ratio2,
			eccentricity
		);
		
	}
}

function _generateCylinderVertices( vertices, sides, radius, height, eccentricity ) {

	var x1,z1,x2,z2,h1,h2,xPrime,zPrime,hPrime;
	var ecc1 = 1 - eccentricity;
	var ecc2 = 1 + eccentricity;
	var radiansPerSide = twoπ / sides;
	var waves = 3;
	var waveHeight = 0;

	for( var i=0; i <= sides; i++ ) {

		// waveHeight = height * Math.sin( radiansPerSide * i * waves ) * 0.4;

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

function _getThetasOnXZPlane( vertices ) {
	
	return _.map( vertices, function( v ) {
				
		return Math.atan2( v.z, v.x );
		
	});
	
}

function _getYs( vertices ) {
	return _.map( vertices, function( v ) {
		return v.y;
	});
}

function _getUnitIntervalOfDistanceFromYOrigin( vertices ) {
	
	var distances = _.map( vertices, function( v ) {
		return Math.sqrt( v.x * v.x + v.z * v.z );
	});
	
	var maxDistance = _.reduce( distances, function( memo, d ) {
		return Math.max( memo, d );
	}, 0);
	
	if( maxDistance === 0 ) throw new Error("maxDistance can't be 0");
	
	return _.map( distances, function( d ) {
		return d / maxDistance;
	});
	
}

function _verticesWaver( vertices, height ) {
	
	var thetas = _getThetasOnXZPlane( vertices );
	var ys = _getYs( vertices );
	var depths = _getUnitIntervalOfDistanceFromYOrigin( vertices );
	
	return function( e ) {
	
		var t = e.time * 0.0015;
		var depthOffset = twoπ;
		var h, theta;
		
		for( var i=0, il = vertices.length; i < il; i++ ) {
			
			h = height * depths[i];
			theta = thetas[i] * 3 + t + depthOffset * depths[i];
	
			vertices[i].y = Math.sin( theta ) * h + ys[i];
		
		}
	}
}

module.exports = CylinderLines;
},{"../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js","../utils/random.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js":[function(require,module,exports){
var _ = require('underscore');
var random = require('../utils/random.js');
var Bullet = require('../entities/Bullet');
var SoundGenerator = require('../sound/SoundGenerator');
var destroyMesh = require('../utils/destroyMesh');

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
		this.poem.on( 'destroy', destroyMesh( this.object ) );
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
},{"../entities/Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js","../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js","../utils/random.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js","underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Hid.js":[function(require,module,exports){
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
var hasher = require('hasher');

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
	this.$canvas = $( this.poem.getCanvas() );
	
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
			this.conditionsCompleted();
			
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
	
	conditionsCompleted : function() {
		
		this.$canvas.css('opacity', 0.3);
		
		this.$winScore.text( this.score );
		this.$winText.html( this.message );
		
		this.showWinScreen();
		
		this.$nextLevel.one( 'click', function( e ) {
			
			e.preventDefault();
			
			hasher.setHash("level/" + this.nextLevel );
			
			this.$canvas.css('opacity', 1);
			this.hideWinScreen();
			
			
		}.bind(this));
	},
	
	showWinScreen : function() {
		
		this.$win
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
		
		setTimeout(function() {
			this.$win.removeClass('hide');
		}.bind(this), 1);
		
	},
	
	hideWinScreen : function() {
		
		this.$win.addClass('hide');
		
		setTimeout(function() {
			this.$win.hide();
		}.bind(this), 1000);
		
	},
	
};
},{"hasher":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Stars.js":[function(require,module,exports){
var destroyMesh = require('../utils/destroyMesh');

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
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	}
};
},{"../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Titles.js":[function(require,module,exports){
var HID = require('../Components/Hid');
var hasher = require('hasher');

var titleHideTimeout = null;

var Titles = function( poem, properties ) {
	this.poem = poem;
	
	this.poem.ship.disable();
	this.rotateStars();
	
	
	
	$('a[href=#keys]').click(this.handleKeysClick.bind(this));
	$('a[href=#tilt]').click(this.handleTiltClick.bind(this));
	
	this.poem.on( 'destroy', this.hideDomElements.bind(this) );
	
	this.showDomElements();
	
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
		
		hasher.setHash("level/intro");
		
	},
	
	showDomElements : function() {
		
		clearTimeout( titleHideTimeout );
		
		$('#title')
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
			
		setTimeout(function() {
			$('#title').removeClass('hide');;
		}, 1);
		
		$('.score').css('opacity', 0);
		
		
	},
	
	hideDomElements : function() {
		
		$('#title')
			.addClass('transform-transition')
			.addClass('hide');
			
		$('.score').css('opacity', 1);
		
		titleHideTimeout = setTimeout(function() {
			
			$('#title').hide();
			
		}.bind(this), 1000);
		
	},
	
	rotateStars : function() {
		
		this.poem.on('update', function(e) {
			
			this.poem.stars.object.rotation.y -= 0.0001 * e.dt;
		
		}.bind(this) );
		
	}
	
};
},{"../Components/Hid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Components/Hid.js","hasher":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Asteroid.js":[function(require,module,exports){
var _ = require('underscore');
var destroyMesh = require('../utils/destroyMesh');

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
		this.poem.on( 'destroy', destroyMesh( this.object ) );
		
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
},{"../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js","underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js":[function(require,module,exports){
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
var destroyMesh = require('../utils/destroyMesh');

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
		this.poem.on( 'destroy', destroyMesh( this.object ) );
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
},{"../components/Damage":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js","../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js","../utils/random":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Jellyship.js":[function(require,module,exports){
module.exports=require("/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js")
},{"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levelLoader.js":[function(require,module,exports){
var Poem = require('./Poem');
var levels = require('./levels');

var currentLevel = null;
var currentPoem = null;

window.levelLoader = function( name ) {

	if( !_.isObject(levels[name]) ) {
		return false;
	}
	
	if(currentPoem) currentPoem.destroy();
	
	currentLevel = levels[name];
	currentPoem = new Poem( currentLevel );
	window.poem = currentPoem;
	
	return true;
	
};
	
module.exports = levelLoader;
},{"./Poem":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js","./levels":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/index.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/asteroidsJellies.js":[function(require,module,exports){
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
var destroyMesh = require('../utils/destroyMesh');
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
		this.poem.on('destroy', destroyMesh( this.object ) );
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
},{"../entities/Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js","../utils/Collider":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js","../utils/destroyMesh":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/routing.js":[function(require,module,exports){
var crossroads = require('crossroads');
var hasher = require('hasher');
var levelLoader = require('./levelLoader');

var baseUrl = '/polar';
var defaultLevel = "titles";
var currentLevel = "";

crossroads.addRoute( '/', function showMainTitles() {
	
	_gaq.push( [ '_trackPageview', baseUrl ] );
	
	levelLoader( defaultLevel );
	
});

crossroads.addRoute( 'level/{name}', function loadUpALevel( levelName ) {
	
	_gaq.push( [ '_trackPageview', baseUrl+'/#level/'+levelName ] );
	
	var levelFound = levelLoader( levelName );
	
	if( !levelFound ) {
		levelLoader( defaultLevel );
	}
	
});

crossroads.addRoute( /.*/, function reRouteToMainTitlesIfNoMatch() {
	
	hasher.replaceHash('');
	
});

$(function startWatchingRoutes() {
	
	function parseHash(newHash, oldHash){
		crossroads.parse(newHash);
	}
	
	hasher.initialized.add(parseHash); // parse initial hash
	hasher.changed.add(parseHash); //parse hash changes
	
	hasher.init(); //start listening for history change
	
});
},{"./levelLoader":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levelLoader.js","crossroads":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/dist/crossroads.js","hasher":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/Music.js":[function(require,module,exports){
var soundcloud = require('soundcloud-badge');
var muter = require('./muter');

var soundOff = false;

var audio = null;
var fetchAndPlaySong = null;
var timesCalledSoundcloud = 0;

var Music = function( poem, properties ) {

	fetchAndPlaySong = function() {
		
		var currentTime = ++timesCalledSoundcloud;
		
		soundcloud({
			
			client_id: '6057c9af862bf245d4c402179e317f52',
			song: properties.url,
			dark: false,
			getFonts: false
			
		}, function(err, src, data, div) {
			
			//Nullify callbacks that are out of order
			if( currentTime !== timesCalledSoundcloud ) return;

			if( err ) throw err;

			audio = new Audio();
			audio.src = src;
			audio.play();
			audio.loop = true;
			audio.volume = properties.volume || 0.6;
		
			$(audio).on('loadedmetadata', function() {
				if( audio )	audio.currentTime = properties.startTime || 0;
			});
		

		});
	
		poem.on('destroy', function() {
			
			if(audio) {
				audio.pause();
				audio = null;
			}
			
			$('.npm-scb-white').remove();
			
		});
		
	};
	
	if( !muter.muted ) {
		
		fetchAndPlaySong()
		fetchAndPlaySong = null;
		
	}
	
};

Music.prototype.muted = false;

muter.on('mute', function muteMusic( e ) {

	if( audio ) audio.pause();
	
	$('.npm-scb-white').hide();

});

muter.on('unmute', function unmuteMusic( e ) {

	if( audio ) audio.play();

	if( fetchAndPlaySong ) {
		fetchAndPlaySong();
		fetchAndPlaySong = null;
	}
	
	$('.npm-scb-white').show();
	

});

module.exports = Music;
},{"./muter":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/muter.js","soundcloud-badge":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/index.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js":[function(require,module,exports){
var _ = require('underscore');
var context = window.AudioContext || window.webkitAudioContext || null;
var muter = require('./muter');

var SoundGenerator = function() {
	
	this.enabled = context !== undefined;
	
	if(!this.enabled) return;
	
	this.lastGainValue = null;
	
	this.totalCreated++;
	this.totalCreatedSq = this.totalCreated * this.totalCreated;
	
	muter.on('mute', this.handleMute.bind(this));
	muter.on('unmute', this.handleUnMute.bind(this));
	
};

module.exports = SoundGenerator;

SoundGenerator.prototype = {
	
	handleMute : function() {
		if( this.gain ) {
			this.gain.gain.value = 0;
		}
	},
	
	handleUnMute : function() {
		if( this.gain && _.isNumber( this.lastGainValue ) ) {
			this.gain.gain.value = this.lastGainValue;
		}
	},
	
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
		
		node.gain.value = 0;
		
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
		
		this.lastGainValue = gain;
		
		if( !this.enabled || muter.muted ) return;
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
},{"./muter":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/muter.js","underscore":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/muter.js":[function(require,module,exports){
var EventDispatcher = require('../utils/EventDispatcher');

var Muter = function() {
	this.muted = false;
};

EventDispatcher.prototype.apply( Muter.prototype );

var muter = new Muter();

$(window).on('keydown', function muteAudioOnHittingS( e ) {
	
	if( e.keyCode !== 83 ) return;
	
	muter.muted = !muter.muted;
	
	if( muter.muted ) {
		
		muter.dispatch({
			type: 'mute'
		});
		
	} else {
		
		muter.dispatch({
			type: 'unmute'
		});
		
	}
	
});

module.exports = muter;

},{"../utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Clock.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/destroyMesh.js":[function(require,module,exports){
module.exports = function destroyMesh( obj ) {
	return function() {
		if( obj.geometry ) obj.geometry.dispose();
		if( obj.material ) obj.material.dispose();
	};
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

},{"./decode":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/decode.js","./encode":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/browserify/node_modules/querystring-es3/encode.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/dist/crossroads.js":[function(require,module,exports){
/** @license
 * crossroads <http://millermedeiros.github.com/crossroads.js/>
 * Author: Miller Medeiros | MIT License
 * v0.12.0 (2013/01/21 13:47)
 */

(function () {
var factory = function (signals) {

    var crossroads,
        _hasOptionalGroupBug,
        UNDEF;

    // Helpers -----------
    //====================

    // IE 7-8 capture optional groups as empty strings while other browsers
    // capture as `undefined`
    _hasOptionalGroupBug = (/t(.+)?/).exec('t')[1] === '';

    function arrayIndexOf(arr, val) {
        if (arr.indexOf) {
            return arr.indexOf(val);
        } else {
            //Array.indexOf doesn't work on IE 6-7
            var n = arr.length;
            while (n--) {
                if (arr[n] === val) {
                    return n;
                }
            }
            return -1;
        }
    }

    function arrayRemove(arr, item) {
        var i = arrayIndexOf(arr, item);
        if (i !== -1) {
            arr.splice(i, 1);
        }
    }

    function isKind(val, kind) {
        return '[object '+ kind +']' === Object.prototype.toString.call(val);
    }

    function isRegExp(val) {
        return isKind(val, 'RegExp');
    }

    function isArray(val) {
        return isKind(val, 'Array');
    }

    function isFunction(val) {
        return typeof val === 'function';
    }

    //borrowed from AMD-utils
    function typecastValue(val) {
        var r;
        if (val === null || val === 'null') {
            r = null;
        } else if (val === 'true') {
            r = true;
        } else if (val === 'false') {
            r = false;
        } else if (val === UNDEF || val === 'undefined') {
            r = UNDEF;
        } else if (val === '' || isNaN(val)) {
            //isNaN('') returns false
            r = val;
        } else {
            //parseFloat(null || '') returns NaN
            r = parseFloat(val);
        }
        return r;
    }

    function typecastArrayValues(values) {
        var n = values.length,
            result = [];
        while (n--) {
            result[n] = typecastValue(values[n]);
        }
        return result;
    }

    //borrowed from AMD-Utils
    function decodeQueryString(str, shouldTypecast) {
        var queryArr = (str || '').replace('?', '').split('&'),
            n = queryArr.length,
            obj = {},
            item, val;
        while (n--) {
            item = queryArr[n].split('=');
            val = shouldTypecast ? typecastValue(item[1]) : item[1];
            obj[item[0]] = (typeof val === 'string')? decodeURIComponent(val) : val;
        }
        return obj;
    }


    // Crossroads --------
    //====================

    /**
     * @constructor
     */
    function Crossroads() {
        this.bypassed = new signals.Signal();
        this.routed = new signals.Signal();
        this._routes = [];
        this._prevRoutes = [];
        this._piped = [];
        this.resetState();
    }

    Crossroads.prototype = {

        greedy : false,

        greedyEnabled : true,

        ignoreCase : true,

        ignoreState : false,

        shouldTypecast : false,

        normalizeFn : null,

        resetState : function(){
            this._prevRoutes.length = 0;
            this._prevMatchedRequest = null;
            this._prevBypassedRequest = null;
        },

        create : function () {
            return new Crossroads();
        },

        addRoute : function (pattern, callback, priority) {
            var route = new Route(pattern, callback, priority, this);
            this._sortedInsert(route);
            return route;
        },

        removeRoute : function (route) {
            arrayRemove(this._routes, route);
            route._destroy();
        },

        removeAllRoutes : function () {
            var n = this.getNumRoutes();
            while (n--) {
                this._routes[n]._destroy();
            }
            this._routes.length = 0;
        },

        parse : function (request, defaultArgs) {
            request = request || '';
            defaultArgs = defaultArgs || [];

            // should only care about different requests if ignoreState isn't true
            if ( !this.ignoreState &&
                (request === this._prevMatchedRequest ||
                 request === this._prevBypassedRequest) ) {
                return;
            }

            var routes = this._getMatchedRoutes(request),
                i = 0,
                n = routes.length,
                cur;

            if (n) {
                this._prevMatchedRequest = request;

                this._notifyPrevRoutes(routes, request);
                this._prevRoutes = routes;
                //should be incremental loop, execute routes in order
                while (i < n) {
                    cur = routes[i];
                    cur.route.matched.dispatch.apply(cur.route.matched, defaultArgs.concat(cur.params));
                    cur.isFirst = !i;
                    this.routed.dispatch.apply(this.routed, defaultArgs.concat([request, cur]));
                    i += 1;
                }
            } else {
                this._prevBypassedRequest = request;
                this.bypassed.dispatch.apply(this.bypassed, defaultArgs.concat([request]));
            }

            this._pipeParse(request, defaultArgs);
        },

        _notifyPrevRoutes : function(matchedRoutes, request) {
            var i = 0, prev;
            while (prev = this._prevRoutes[i++]) {
                //check if switched exist since route may be disposed
                if(prev.route.switched && this._didSwitch(prev.route, matchedRoutes)) {
                    prev.route.switched.dispatch(request);
                }
            }
        },

        _didSwitch : function (route, matchedRoutes){
            var matched,
                i = 0;
            while (matched = matchedRoutes[i++]) {
                // only dispatch switched if it is going to a different route
                if (matched.route === route) {
                    return false;
                }
            }
            return true;
        },

        _pipeParse : function(request, defaultArgs) {
            var i = 0, route;
            while (route = this._piped[i++]) {
                route.parse(request, defaultArgs);
            }
        },

        getNumRoutes : function () {
            return this._routes.length;
        },

        _sortedInsert : function (route) {
            //simplified insertion sort
            var routes = this._routes,
                n = routes.length;
            do { --n; } while (routes[n] && route._priority <= routes[n]._priority);
            routes.splice(n+1, 0, route);
        },

        _getMatchedRoutes : function (request) {
            var res = [],
                routes = this._routes,
                n = routes.length,
                route;
            //should be decrement loop since higher priorities are added at the end of array
            while (route = routes[--n]) {
                if ((!res.length || this.greedy || route.greedy) && route.match(request)) {
                    res.push({
                        route : route,
                        params : route._getParamsArray(request)
                    });
                }
                if (!this.greedyEnabled && res.length) {
                    break;
                }
            }
            return res;
        },

        pipe : function (otherRouter) {
            this._piped.push(otherRouter);
        },

        unpipe : function (otherRouter) {
            arrayRemove(this._piped, otherRouter);
        },

        toString : function () {
            return '[crossroads numRoutes:'+ this.getNumRoutes() +']';
        }
    };

    //"static" instance
    crossroads = new Crossroads();
    crossroads.VERSION = '0.12.0';

    crossroads.NORM_AS_ARRAY = function (req, vals) {
        return [vals.vals_];
    };

    crossroads.NORM_AS_OBJECT = function (req, vals) {
        return [vals];
    };


    // Route --------------
    //=====================

    /**
     * @constructor
     */
    function Route(pattern, callback, priority, router) {
        var isRegexPattern = isRegExp(pattern),
            patternLexer = router.patternLexer;
        this._router = router;
        this._pattern = pattern;
        this._paramsIds = isRegexPattern? null : patternLexer.getParamIds(pattern);
        this._optionalParamsIds = isRegexPattern? null : patternLexer.getOptionalParamsIds(pattern);
        this._matchRegexp = isRegexPattern? pattern : patternLexer.compilePattern(pattern, router.ignoreCase);
        this.matched = new signals.Signal();
        this.switched = new signals.Signal();
        if (callback) {
            this.matched.add(callback);
        }
        this._priority = priority || 0;
    }

    Route.prototype = {

        greedy : false,

        rules : void(0),

        match : function (request) {
            request = request || '';
            return this._matchRegexp.test(request) && this._validateParams(request); //validate params even if regexp because of `request_` rule.
        },

        _validateParams : function (request) {
            var rules = this.rules,
                values = this._getParamsObject(request),
                key;
            for (key in rules) {
                // normalize_ isn't a validation rule... (#39)
                if(key !== 'normalize_' && rules.hasOwnProperty(key) && ! this._isValidParam(request, key, values)){
                    return false;
                }
            }
            return true;
        },

        _isValidParam : function (request, prop, values) {
            var validationRule = this.rules[prop],
                val = values[prop],
                isValid = false,
                isQuery = (prop.indexOf('?') === 0);

            if (val == null && this._optionalParamsIds && arrayIndexOf(this._optionalParamsIds, prop) !== -1) {
                isValid = true;
            }
            else if (isRegExp(validationRule)) {
                if (isQuery) {
                    val = values[prop +'_']; //use raw string
                }
                isValid = validationRule.test(val);
            }
            else if (isArray(validationRule)) {
                if (isQuery) {
                    val = values[prop +'_']; //use raw string
                }
                isValid = this._isValidArrayRule(validationRule, val);
            }
            else if (isFunction(validationRule)) {
                isValid = validationRule(val, request, values);
            }

            return isValid; //fail silently if validationRule is from an unsupported type
        },

        _isValidArrayRule : function (arr, val) {
            if (! this._router.ignoreCase) {
                return arrayIndexOf(arr, val) !== -1;
            }

            if (typeof val === 'string') {
                val = val.toLowerCase();
            }

            var n = arr.length,
                item,
                compareVal;

            while (n--) {
                item = arr[n];
                compareVal = (typeof item === 'string')? item.toLowerCase() : item;
                if (compareVal === val) {
                    return true;
                }
            }
            return false;
        },

        _getParamsObject : function (request) {
            var shouldTypecast = this._router.shouldTypecast,
                values = this._router.patternLexer.getParamValues(request, this._matchRegexp, shouldTypecast),
                o = {},
                n = values.length,
                param, val;
            while (n--) {
                val = values[n];
                if (this._paramsIds) {
                    param = this._paramsIds[n];
                    if (param.indexOf('?') === 0 && val) {
                        //make a copy of the original string so array and
                        //RegExp validation can be applied properly
                        o[param +'_'] = val;
                        //update vals_ array as well since it will be used
                        //during dispatch
                        val = decodeQueryString(val, shouldTypecast);
                        values[n] = val;
                    }
                    // IE will capture optional groups as empty strings while other
                    // browsers will capture `undefined` so normalize behavior.
                    // see: #gh-58, #gh-59, #gh-60
                    if ( _hasOptionalGroupBug && val === '' && arrayIndexOf(this._optionalParamsIds, param) !== -1 ) {
                        val = void(0);
                        values[n] = val;
                    }
                    o[param] = val;
                }
                //alias to paths and for RegExp pattern
                o[n] = val;
            }
            o.request_ = shouldTypecast? typecastValue(request) : request;
            o.vals_ = values;
            return o;
        },

        _getParamsArray : function (request) {
            var norm = this.rules? this.rules.normalize_ : null,
                params;
            norm = norm || this._router.normalizeFn; // default normalize
            if (norm && isFunction(norm)) {
                params = norm(request, this._getParamsObject(request));
            } else {
                params = this._getParamsObject(request).vals_;
            }
            return params;
        },

        interpolate : function(replacements) {
            var str = this._router.patternLexer.interpolate(this._pattern, replacements);
            if (! this._validateParams(str) ) {
                throw new Error('Generated string doesn\'t validate against `Route.rules`.');
            }
            return str;
        },

        dispose : function () {
            this._router.removeRoute(this);
        },

        _destroy : function () {
            this.matched.dispose();
            this.switched.dispose();
            this.matched = this.switched = this._pattern = this._matchRegexp = null;
        },

        toString : function () {
            return '[Route pattern:"'+ this._pattern +'", numListeners:'+ this.matched.getNumListeners() +']';
        }

    };



    // Pattern Lexer ------
    //=====================

    Crossroads.prototype.patternLexer = (function () {

        var
            //match chars that should be escaped on string regexp
            ESCAPE_CHARS_REGEXP = /[\\.+*?\^$\[\](){}\/'#]/g,

            //trailing slashes (begin/end of string)
            LOOSE_SLASHES_REGEXP = /^\/|\/$/g,
            LEGACY_SLASHES_REGEXP = /\/$/g,

            //params - everything between `{ }` or `: :`
            PARAMS_REGEXP = /(?:\{|:)([^}:]+)(?:\}|:)/g,

            //used to save params during compile (avoid escaping things that
            //shouldn't be escaped).
            TOKENS = {
                'OS' : {
                    //optional slashes
                    //slash between `::` or `}:` or `\w:` or `:{?` or `}{?` or `\w{?`
                    rgx : /([:}]|\w(?=\/))\/?(:|(?:\{\?))/g,
                    save : '$1{{id}}$2',
                    res : '\\/?'
                },
                'RS' : {
                    //required slashes
                    //used to insert slash between `:{` and `}{`
                    rgx : /([:}])\/?(\{)/g,
                    save : '$1{{id}}$2',
                    res : '\\/'
                },
                'RQ' : {
                    //required query string - everything in between `{? }`
                    rgx : /\{\?([^}]+)\}/g,
                    //everything from `?` till `#` or end of string
                    res : '\\?([^#]+)'
                },
                'OQ' : {
                    //optional query string - everything in between `:? :`
                    rgx : /:\?([^:]+):/g,
                    //everything from `?` till `#` or end of string
                    res : '(?:\\?([^#]*))?'
                },
                'OR' : {
                    //optional rest - everything in between `: *:`
                    rgx : /:([^:]+)\*:/g,
                    res : '(.*)?' // optional group to avoid passing empty string as captured
                },
                'RR' : {
                    //rest param - everything in between `{ *}`
                    rgx : /\{([^}]+)\*\}/g,
                    res : '(.+)'
                },
                // required/optional params should come after rest segments
                'RP' : {
                    //required params - everything between `{ }`
                    rgx : /\{([^}]+)\}/g,
                    res : '([^\\/?]+)'
                },
                'OP' : {
                    //optional params - everything between `: :`
                    rgx : /:([^:]+):/g,
                    res : '([^\\/?]+)?\/?'
                }
            },

            LOOSE_SLASH = 1,
            STRICT_SLASH = 2,
            LEGACY_SLASH = 3,

            _slashMode = LOOSE_SLASH;


        function precompileTokens(){
            var key, cur;
            for (key in TOKENS) {
                if (TOKENS.hasOwnProperty(key)) {
                    cur = TOKENS[key];
                    cur.id = '__CR_'+ key +'__';
                    cur.save = ('save' in cur)? cur.save.replace('{{id}}', cur.id) : cur.id;
                    cur.rRestore = new RegExp(cur.id, 'g');
                }
            }
        }
        precompileTokens();


        function captureVals(regex, pattern) {
            var vals = [], match;
            // very important to reset lastIndex since RegExp can have "g" flag
            // and multiple runs might affect the result, specially if matching
            // same string multiple times on IE 7-8
            regex.lastIndex = 0;
            while (match = regex.exec(pattern)) {
                vals.push(match[1]);
            }
            return vals;
        }

        function getParamIds(pattern) {
            return captureVals(PARAMS_REGEXP, pattern);
        }

        function getOptionalParamsIds(pattern) {
            return captureVals(TOKENS.OP.rgx, pattern);
        }

        function compilePattern(pattern, ignoreCase) {
            pattern = pattern || '';

            if(pattern){
                if (_slashMode === LOOSE_SLASH) {
                    pattern = pattern.replace(LOOSE_SLASHES_REGEXP, '');
                }
                else if (_slashMode === LEGACY_SLASH) {
                    pattern = pattern.replace(LEGACY_SLASHES_REGEXP, '');
                }

                //save tokens
                pattern = replaceTokens(pattern, 'rgx', 'save');
                //regexp escape
                pattern = pattern.replace(ESCAPE_CHARS_REGEXP, '\\$&');
                //restore tokens
                pattern = replaceTokens(pattern, 'rRestore', 'res');

                if (_slashMode === LOOSE_SLASH) {
                    pattern = '\\/?'+ pattern;
                }
            }

            if (_slashMode !== STRICT_SLASH) {
                //single slash is treated as empty and end slash is optional
                pattern += '\\/?';
            }
            return new RegExp('^'+ pattern + '$', ignoreCase? 'i' : '');
        }

        function replaceTokens(pattern, regexpName, replaceName) {
            var cur, key;
            for (key in TOKENS) {
                if (TOKENS.hasOwnProperty(key)) {
                    cur = TOKENS[key];
                    pattern = pattern.replace(cur[regexpName], cur[replaceName]);
                }
            }
            return pattern;
        }

        function getParamValues(request, regexp, shouldTypecast) {
            var vals = regexp.exec(request);
            if (vals) {
                vals.shift();
                if (shouldTypecast) {
                    vals = typecastArrayValues(vals);
                }
            }
            return vals;
        }

        function interpolate(pattern, replacements) {
            if (typeof pattern !== 'string') {
                throw new Error('Route pattern should be a string.');
            }

            var replaceFn = function(match, prop){
                    var val;
                    prop = (prop.substr(0, 1) === '?')? prop.substr(1) : prop;
                    if (replacements[prop] != null) {
                        if (typeof replacements[prop] === 'object') {
                            var queryParts = [];
                            for(var key in replacements[prop]) {
                                queryParts.push(encodeURI(key + '=' + replacements[prop][key]));
                            }
                            val = '?' + queryParts.join('&');
                        } else {
                            // make sure value is a string see #gh-54
                            val = String(replacements[prop]);
                        }

                        if (match.indexOf('*') === -1 && val.indexOf('/') !== -1) {
                            throw new Error('Invalid value "'+ val +'" for segment "'+ match +'".');
                        }
                    }
                    else if (match.indexOf('{') !== -1) {
                        throw new Error('The segment '+ match +' is required.');
                    }
                    else {
                        val = '';
                    }
                    return val;
                };

            if (! TOKENS.OS.trail) {
                TOKENS.OS.trail = new RegExp('(?:'+ TOKENS.OS.id +')+$');
            }

            return pattern
                        .replace(TOKENS.OS.rgx, TOKENS.OS.save)
                        .replace(PARAMS_REGEXP, replaceFn)
                        .replace(TOKENS.OS.trail, '') // remove trailing
                        .replace(TOKENS.OS.rRestore, '/'); // add slash between segments
        }

        //API
        return {
            strict : function(){
                _slashMode = STRICT_SLASH;
            },
            loose : function(){
                _slashMode = LOOSE_SLASH;
            },
            legacy : function(){
                _slashMode = LEGACY_SLASH;
            },
            getParamIds : getParamIds,
            getOptionalParamsIds : getOptionalParamsIds,
            getParamValues : getParamValues,
            compilePattern : compilePattern,
            interpolate : interpolate
        };

    }());


    return crossroads;
};

if (typeof define === 'function' && define.amd) {
    define(['signals'], factory);
} else if (typeof module !== 'undefined' && module.exports) { //Node
    module.exports = factory(require('signals'));
} else {
    /*jshint sub:true */
    window['crossroads'] = factory(window['signals']);
}

}());


},{"signals":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js":[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/dist/js/hasher.js":[function(require,module,exports){
/*!!
 * Hasher <http://github.com/millermedeiros/hasher>
 * @author Miller Medeiros
 * @version 1.2.0 (2013/11/11 03:18 PM)
 * Released under the MIT License
 */

;(function () {
var factory = function(signals){

/*jshint white:false*/
/*global signals:false, window:false*/

/**
 * Hasher
 * @namespace History Manager for rich-media applications.
 * @name hasher
 */
var hasher = (function(window){

    //--------------------------------------------------------------------------------------
    // Private Vars
    //--------------------------------------------------------------------------------------

    var

        // frequency that it will check hash value on IE 6-7 since it doesn't
        // support the hashchange event
        POOL_INTERVAL = 25,

        // local storage for brevity and better compression --------------------------------

        document = window.document,
        history = window.history,
        Signal = signals.Signal,

        // local vars ----------------------------------------------------------------------

        hasher,
        _hash,
        _checkInterval,
        _isActive,
        _frame, //iframe used for legacy IE (6-7)
        _checkHistory,
        _hashValRegexp = /#(.*)$/,
        _baseUrlRegexp = /(\?.*)|(\#.*)/,
        _hashRegexp = /^\#/,

        // sniffing/feature detection -------------------------------------------------------

        //hack based on this: http://webreflection.blogspot.com/2009/01/32-bytes-to-know-if-your-browser-is-ie.html
        _isIE = (!+"\v1"),
        // hashchange is supported by FF3.6+, IE8+, Chrome 5+, Safari 5+ but
        // feature detection fails on IE compatibility mode, so we need to
        // check documentMode
        _isHashChangeSupported = ('onhashchange' in window) && document.documentMode !== 7,
        //check if is IE6-7 since hash change is only supported on IE8+ and
        //changing hash value on IE6-7 doesn't generate history record.
        _isLegacyIE = _isIE && !_isHashChangeSupported,
        _isLocal = (location.protocol === 'file:');


    //--------------------------------------------------------------------------------------
    // Private Methods
    //--------------------------------------------------------------------------------------

    function _escapeRegExp(str){
        return String(str || '').replace(/\W/g, "\\$&");
    }

    function _trimHash(hash){
        if (!hash) return '';
        var regexp = new RegExp('^' + _escapeRegExp(hasher.prependHash) + '|' + _escapeRegExp(hasher.appendHash) + '$', 'g');
        return hash.replace(regexp, '');
    }

    function _getWindowHash(){
        //parsed full URL instead of getting window.location.hash because Firefox decode hash value (and all the other browsers don't)
        //also because of IE8 bug with hash query in local file [issue #6]
        var result = _hashValRegexp.exec( hasher.getURL() );
        var path = (result && result[1]) || '';
        try {
          return hasher.raw? path : decodeURIComponent(path);
        } catch (e) {
          // in case user did not set `hasher.raw` and decodeURIComponent
          // throws an error (see #57)
          return path;
        }
    }

    function _getFrameHash(){
        return (_frame)? _frame.contentWindow.frameHash : null;
    }

    function _createFrame(){
        _frame = document.createElement('iframe');
        _frame.src = 'about:blank';
        _frame.style.display = 'none';
        document.body.appendChild(_frame);
    }

    function _updateFrame(){
        if(_frame && _hash !== _getFrameHash()){
            var frameDoc = _frame.contentWindow.document;
            frameDoc.open();
            //update iframe content to force new history record.
            //based on Really Simple History, SWFAddress and YUI.history.
            frameDoc.write('<html><head><title>' + document.title + '</title><script type="text/javascript">var frameHash="' + _hash + '";</script></head><body>&nbsp;</body></html>');
            frameDoc.close();
        }
    }

    function _registerChange(newHash, isReplace){
        if(_hash !== newHash){
            var oldHash = _hash;
            _hash = newHash; //should come before event dispatch to make sure user can get proper value inside event handler
            if(_isLegacyIE){
                if(!isReplace){
                    _updateFrame();
                } else {
                    _frame.contentWindow.frameHash = newHash;
                }
            }
            hasher.changed.dispatch(_trimHash(newHash), _trimHash(oldHash));
        }
    }

    if (_isLegacyIE) {
        /**
         * @private
         */
        _checkHistory = function(){
            var windowHash = _getWindowHash(),
                frameHash = _getFrameHash();
            if(frameHash !== _hash && frameHash !== windowHash){
                //detect changes made pressing browser history buttons.
                //Workaround since history.back() and history.forward() doesn't
                //update hash value on IE6/7 but updates content of the iframe.
                //needs to trim hash since value stored already have
                //prependHash + appendHash for fast check.
                hasher.setHash(_trimHash(frameHash));
            } else if (windowHash !== _hash){
                //detect if hash changed (manually or using setHash)
                _registerChange(windowHash);
            }
        };
    } else {
        /**
         * @private
         */
        _checkHistory = function(){
            var windowHash = _getWindowHash();
            if(windowHash !== _hash){
                _registerChange(windowHash);
            }
        };
    }

    function _addListener(elm, eType, fn){
        if(elm.addEventListener){
            elm.addEventListener(eType, fn, false);
        } else if (elm.attachEvent){
            elm.attachEvent('on' + eType, fn);
        }
    }

    function _removeListener(elm, eType, fn){
        if(elm.removeEventListener){
            elm.removeEventListener(eType, fn, false);
        } else if (elm.detachEvent){
            elm.detachEvent('on' + eType, fn);
        }
    }

    function _makePath(paths){
        paths = Array.prototype.slice.call(arguments);

        var path = paths.join(hasher.separator);
        path = path? hasher.prependHash + path.replace(_hashRegexp, '') + hasher.appendHash : path;
        return path;
    }

    function _encodePath(path){
        //used encodeURI instead of encodeURIComponent to preserve '?', '/',
        //'#'. Fixes Safari bug [issue #8]
        path = encodeURI(path);
        if(_isIE && _isLocal){
            //fix IE8 local file bug [issue #6]
            path = path.replace(/\?/, '%3F');
        }
        return path;
    }

    //--------------------------------------------------------------------------------------
    // Public (API)
    //--------------------------------------------------------------------------------------

    hasher = /** @lends hasher */ {

        /**
         * hasher Version Number
         * @type string
         * @constant
         */
        VERSION : '1.2.0',

        /**
         * Boolean deciding if hasher encodes/decodes the hash or not.
         * <ul>
         * <li>default value: false;</li>
         * </ul>
         * @type boolean
         */
        raw : false,

        /**
         * String that should always be added to the end of Hash value.
         * <ul>
         * <li>default value: '';</li>
         * <li>will be automatically removed from `hasher.getHash()`</li>
         * <li>avoid conflicts with elements that contain ID equal to hash value;</li>
         * </ul>
         * @type string
         */
        appendHash : '',

        /**
         * String that should always be added to the beginning of Hash value.
         * <ul>
         * <li>default value: '/';</li>
         * <li>will be automatically removed from `hasher.getHash()`</li>
         * <li>avoid conflicts with elements that contain ID equal to hash value;</li>
         * </ul>
         * @type string
         */
        prependHash : '/',

        /**
         * String used to split hash paths; used by `hasher.getHashAsArray()` to split paths.
         * <ul>
         * <li>default value: '/';</li>
         * </ul>
         * @type string
         */
        separator : '/',

        /**
         * Signal dispatched when hash value changes.
         * - pass current hash as 1st parameter to listeners and previous hash value as 2nd parameter.
         * @type signals.Signal
         */
        changed : new Signal(),

        /**
         * Signal dispatched when hasher is stopped.
         * -  pass current hash as first parameter to listeners
         * @type signals.Signal
         */
        stopped : new Signal(),

        /**
         * Signal dispatched when hasher is initialized.
         * - pass current hash as first parameter to listeners.
         * @type signals.Signal
         */
        initialized : new Signal(),

        /**
         * Start listening/dispatching changes in the hash/history.
         * <ul>
         *   <li>hasher won't dispatch CHANGE events by manually typing a new value or pressing the back/forward buttons before calling this method.</li>
         * </ul>
         */
        init : function(){
            if(_isActive) return;

            _hash = _getWindowHash();

            //thought about branching/overloading hasher.init() to avoid checking multiple times but
            //don't think worth doing it since it probably won't be called multiple times.
            if(_isHashChangeSupported){
                _addListener(window, 'hashchange', _checkHistory);
            }else {
                if(_isLegacyIE){
                    if(! _frame){
                        _createFrame();
                    }
                    _updateFrame();
                }
                _checkInterval = setInterval(_checkHistory, POOL_INTERVAL);
            }

            _isActive = true;
            hasher.initialized.dispatch(_trimHash(_hash));
        },

        /**
         * Stop listening/dispatching changes in the hash/history.
         * <ul>
         *   <li>hasher won't dispatch CHANGE events by manually typing a new value or pressing the back/forward buttons after calling this method, unless you call hasher.init() again.</li>
         *   <li>hasher will still dispatch changes made programatically by calling hasher.setHash();</li>
         * </ul>
         */
        stop : function(){
            if(! _isActive) return;

            if(_isHashChangeSupported){
                _removeListener(window, 'hashchange', _checkHistory);
            }else{
                clearInterval(_checkInterval);
                _checkInterval = null;
            }

            _isActive = false;
            hasher.stopped.dispatch(_trimHash(_hash));
        },

        /**
         * @return {boolean}    If hasher is listening to changes on the browser history and/or hash value.
         */
        isActive : function(){
            return _isActive;
        },

        /**
         * @return {string} Full URL.
         */
        getURL : function(){
            return window.location.href;
        },

        /**
         * @return {string} Retrieve URL without query string and hash.
         */
        getBaseURL : function(){
            return hasher.getURL().replace(_baseUrlRegexp, ''); //removes everything after '?' and/or '#'
        },

        /**
         * Set Hash value, generating a new history record.
         * @param {...string} path    Hash value without '#'. Hasher will join
         * path segments using `hasher.separator` and prepend/append hash value
         * with `hasher.appendHash` and `hasher.prependHash`
         * @example hasher.setHash('lorem', 'ipsum', 'dolor') -> '#/lorem/ipsum/dolor'
         */
        setHash : function(path){
            path = _makePath.apply(null, arguments);
            if(path !== _hash){
                // we should store raw value
                _registerChange(path);
                if (path === _hash) {
                    // we check if path is still === _hash to avoid error in
                    // case of multiple consecutive redirects [issue #39]
                    if (! hasher.raw) {
                        path = _encodePath(path);
                    }
                    window.location.hash = '#' + path;
                }
            }
        },

        /**
         * Set Hash value without keeping previous hash on the history record.
         * Similar to calling `window.location.replace("#/hash")` but will also work on IE6-7.
         * @param {...string} path    Hash value without '#'. Hasher will join
         * path segments using `hasher.separator` and prepend/append hash value
         * with `hasher.appendHash` and `hasher.prependHash`
         * @example hasher.replaceHash('lorem', 'ipsum', 'dolor') -> '#/lorem/ipsum/dolor'
         */
        replaceHash : function(path){
            path = _makePath.apply(null, arguments);
            if(path !== _hash){
                // we should store raw value
                _registerChange(path, true);
                if (path === _hash) {
                    // we check if path is still === _hash to avoid error in
                    // case of multiple consecutive redirects [issue #39]
                    if (! hasher.raw) {
                        path = _encodePath(path);
                    }
                    window.location.replace('#' + path);
                }
            }
        },

        /**
         * @return {string} Hash value without '#', `hasher.appendHash` and `hasher.prependHash`.
         */
        getHash : function(){
            //didn't used actual value of the `window.location.hash` to avoid breaking the application in case `window.location.hash` isn't available and also because value should always be synched.
            return _trimHash(_hash);
        },

        /**
         * @return {Array.<string>} Hash value split into an Array.
         */
        getHashAsArray : function(){
            return hasher.getHash().split(hasher.separator);
        },

        /**
         * Removes all event listeners, stops hasher and destroy hasher object.
         * - IMPORTANT: hasher won't work after calling this method, hasher Object will be deleted.
         */
        dispose : function(){
            hasher.stop();
            hasher.initialized.dispose();
            hasher.stopped.dispose();
            hasher.changed.dispose();
            _frame = hasher = window.hasher = null;
        },

        /**
         * @return {string} A string representation of the object.
         */
        toString : function(){
            return '[hasher version="'+ hasher.VERSION +'" hash="'+ hasher.getHash() +'"]';
        }

    };

    hasher.initialized.memorize = true; //see #33

    return hasher;

}(window));


    return hasher;
};

if (typeof define === 'function' && define.amd) {
    define(['signals'], factory);
} else if (typeof exports === 'object') {
    module.exports = factory(require('signals'));
} else {
    /*jshint sub:true */
    window['hasher'] = factory(window['signals']);
}

}());

},{"signals":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/node_modules/signals/dist/signals.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/hasher/node_modules/signals/dist/signals.js":[function(require,module,exports){
module.exports=require("/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js")
},{"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js":"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/node_modules/soundcloud-badge/index.js":[function(require,module,exports){
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

},{}]},{},["./js/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2pzL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvQ29tcG9uZW50cy9IaWQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9Qb2VtLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvU2hpcC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvQ2FtZXJhLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvY29tcG9uZW50cy9DYW1lcmFJbnRyby5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvQ3lsaW5kZXJMaW5lcy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvRGFtYWdlLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvY29tcG9uZW50cy9IaWQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL1Njb3JpbmdBbmRXaW5uaW5nLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvY29tcG9uZW50cy9TdGFycy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvVGl0bGVzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvZW50aXRpZXMvQXN0ZXJvaWQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9CdWxsZXQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9KZWxseVNoaXAuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9KZWxseXNoaXAuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9sZXZlbExvYWRlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2xldmVscy9hc3Rlcm9pZHNKZWxsaWVzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL2luZGV4LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL2ludHJvLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbGV2ZWxzL3RpdGxlcy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL21hbmFnZXJzL0FzdGVyb2lkRmllbGQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbWFuYWdlcnMvR3VuLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvcm91dGluZy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3NvdW5kL011c2ljLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvc291bmQvU291bmRHZW5lcmF0b3IuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9zb3VuZC9tdXRlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL0Nsb2NrLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvQ29sbGlkZXIuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9Db29yZGluYXRlcy5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL0V2ZW50RGlzcGF0Y2hlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL1N0YXRzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvZGVzdHJveU1lc2guanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9yYW5kb20uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3F1ZXJ5c3RyaW5nLWVzMy9kZWNvZGUuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2VuY29kZS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZy1lczMvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvY3Jvc3Nyb2Fkcy9kaXN0L2Nyb3Nzcm9hZHMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvY3Jvc3Nyb2Fkcy9ub2RlX21vZHVsZXMvc2lnbmFscy9kaXN0L3NpZ25hbHMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvaGFzaGVyL2Rpc3QvanMvaGFzaGVyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvbm9kZV9tb2R1bGVzL2hhc2hlci9ub2RlX21vZHVsZXMvc2lnbmFscy9kaXN0L3NpZ25hbHMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9pbmRleC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9zb3VuZGNsb3VkLWJhZGdlL25vZGVfbW9kdWxlcy9nb29nbGUtZm9udHMvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvaW5zZXJ0LWNzcy9pbmRleC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9zb3VuZGNsb3VkLWJhZGdlL25vZGVfbW9kdWxlcy9taW5zdGFjaGUvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1yZXNvbHZlL2Jyb3dzZXIuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1yZXNvbHZlL25vZGVfbW9kdWxlcy94aHIvaW5kZXguanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1yZXNvbHZlL25vZGVfbW9kdWxlcy94aHIvbm9kZV9tb2R1bGVzL2dsb2JhbC93aW5kb3cuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvc291bmRjbG91ZC1yZXNvbHZlL25vZGVfbW9kdWxlcy94aHIvbm9kZV9tb2R1bGVzL29uY2Uvb25jZS5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy91bmRlcnNjb3JlL3VuZGVyc2NvcmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25NQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZKQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDemJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwicmVxdWlyZSgnLi9yb3V0aW5nJyk7IiwidmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xuXG53aW5kb3cuSElEdHlwZSA9IFwia2V5c1wiO1xuXG52YXIgSElEID0gZnVuY3Rpb24oIHBvZW0gKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHZhciBzdGF0ZXMgPSB7XG5cdFx0dXA6IGZhbHNlLFxuXHRcdGRvd246IGZhbHNlLFxuXHRcdGxlZnQ6IGZhbHNlLFxuXHRcdHJpZ2h0OiBmYWxzZSxcblx0XHRzcGFjZWJhcjogZmFsc2Vcblx0fTtcblx0XG5cdHRoaXMua2V5Q29kZXMgPSB7XG5cdFx0XCJrMzhcIiA6IFwidXBcIixcblx0XHRcIms0MFwiIDogXCJkb3duXCIsXG5cdFx0XCJrMzdcIiA6IFwibGVmdFwiLFxuXHRcdFwiazM5XCIgOiBcInJpZ2h0XCIsXG5cdFx0XCJrMzJcIiA6IFwic3BhY2ViYXJcIlxuXHR9O1xuXHRcblx0dGhpcy50aWx0ID0ge1xuXHRcdHg6IDAsXG5cdFx0eTogMFxuXHR9O1xuXHR0aGlzLnByZXNzZWQgPSBfLmNsb25lKHN0YXRlcyk7XG5cdHRoaXMuZG93biA9IF8uY2xvbmUoc3RhdGVzKTtcblx0dGhpcy51cCA9IF8uY2xvbmUoc3RhdGVzKTtcblx0XG5cdGlmKCB3aW5kb3cuSElEdHlwZSA9PT0gXCJrZXlzXCIgKSB7XG5cdFx0dGhpcy5zZXRLZXlIYW5kbGVycygpO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuc2V0VGlsdEhhbmRsZXJzKCk7XG5cdH1cblx0XG59O1xuXG5ISUQucHJvdG90eXBlID0ge1xuXHRcblx0c2V0S2V5SGFuZGxlcnMgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHQkKHdpbmRvdykub24oICdrZXlkb3duLkhJRCcsIHRoaXMua2V5ZG93bi5iaW5kKHRoaXMpICk7XG5cdFx0JCh3aW5kb3cpLm9uKCAna2V5dXAuSElEJywgdGhpcy5rZXl1cC5iaW5kKHRoaXMpICk7XG5cdFxuXHRcdHRoaXMucG9lbS5vbiggXCJkZXN0cm95XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JCh3aW5kb3cpLm9mZiggJ2tleWRvd24uSElEJyApO1xuXHRcdFx0JCh3aW5kb3cpLm9mZiggJ2tleXVwLkhJRCcgKTtcblx0XHR9KTtcblx0XHRcblx0fSxcblx0XG5cdHNldFRpbHRIYW5kbGVycyA6IGZ1bmN0aW9uKCkge1xuXG5cblx0XHQkKHdpbmRvdykub24oICdkZXZpY2VvcmllbnRhdGlvbi5ISUQnLCB0aGlzLmhhbmRsZVRpbHQuYmluZCh0aGlzKSApO1xuXHRcdC8vIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdkZXZpY2VvcmllbnRhdGlvbicsIHRoaXMuaGFuZGxlVGlsdC5iaW5kKHRoaXMpLCBmYWxzZSk7XG5cdFx0XG5cdFx0JChcImNhbnZhc1wiKS5vbiggJ3RvdWNoc3RhcnQuSElEJywgdGhpcy5oYW5kbGVUb3VjaFN0YXJ0LmJpbmQodGhpcykgKTtcblx0XHQkKFwiY2FudmFzXCIpLm9uKCAndG91Y2hlbmQuSElEJywgdGhpcy5oYW5kbGVUb3VjaEVuZC5iaW5kKHRoaXMpICk7XG5cblx0XHR0aGlzLnBvZW0ub24oIFwiZGVzdHJveVwiLCBmdW5jdGlvbigpIHtcblx0XHRcdCQod2luZG93KS5vZmYoICdkZXZpY2VvcmllbnRhdGlvbi5ISUQnICk7XG5cdFx0XHQkKFwiY2FudmFzXCIpLm9mZiggJ3RvdWNoc3RhcnQuSElEJyApO1xuXHRcdFx0JChcImNhbnZhc1wiKS5vZmYoICd0b3VjaGVuZC5ISUQnICk7XG5cdFx0fSk7XG5cdFx0XG5cdH0sXG5cdFxuXHR0eXBlIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5ISUR0eXBlO1xuXHR9LFxuXHRcblx0c2V0S2V5cyA6IGZ1bmN0aW9uKCkge1xuXHRcdHdpbmRvdy5ISUR0eXBlID0gXCJrZXlzXCI7XG5cdH0sXG5cdFxuXHRzZXRUaWx0IDogZnVuY3Rpb24oKSB7XG5cdFx0d2luZG93LkhJRHR5cGUgPSBcInRpbHRcIjtcdFx0XG5cdH0sXG5cdFxuXHRrZXlkb3duIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMuZG93bltjb2RlXSA9IHRydWU7XG5cdFx0XHR0aGlzLnByZXNzZWRbY29kZV0gPSB0cnVlO1xuXHRcdH1cblx0fSxcblx0XG5cdGtleXVwIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMucHJlc3NlZFtjb2RlXSA9IGZhbHNlO1xuXHRcdFx0dGhpcy51cFtjb2RlXSA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0aGFuZGxlVGlsdCA6IGZ1bmN0aW9uKGUpIHtcblx0XHRcblx0XHR2YXIgZXZlbnQsIG9yaWVudGF0aW9uLCBhbmdsZTtcblx0XHRcblx0XHRldmVudCA9IGUub3JpZ2luYWxFdmVudDtcblx0XHRvcmllbnRhdGlvbiA9IHdpbmRvdy5vcmllbnRhdGlvbiB8fCBzY3JlZW4ub3JpZW50YXRpb247XG5cdFx0XG5cdFx0aWYoXy5pc09iamVjdCggc2NyZWVuLm9yaWVudGF0aW9uICkgKSB7XG5cdFx0XHRhbmdsZSA9IHNjcmVlbi5vcmllbnRhdGlvbi5hbmdsZTtcblx0XHR9IGVsc2UgaWYgKCBfLmlzTnVtYmVyKCB3aW5kb3cub3JpZW50YXRpb24gKSApIHtcblx0XHRcdGFuZ2xlID0gd2luZG93Lm9yaWVudGF0aW9uO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbmdsZSA9IDA7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKGFuZ2xlID09PSAwKSB7XG5cdFx0XHR0aGlzLnRpbHQgPSB7XG5cdFx0XHRcdHg6IGV2ZW50LmdhbW1hLFxuXHRcdFx0XHR5OiBldmVudC5iZXRhICogLTFcblx0XHRcdH07XG5cdFx0fSBlbHNlIGlmIChhbmdsZSA+IDApIHtcblx0XHRcdHRoaXMudGlsdCA9IHtcblx0XHRcdFx0eDogZXZlbnQuYmV0YSxcblx0XHRcdFx0eTogZXZlbnQuZ2FtbWFcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudGlsdCA9IHtcblx0XHRcdFx0eDogZXZlbnQuYmV0YSAqIC0xLFxuXHRcdFx0XHR5OiBldmVudC5nYW1tYSAqIC0xXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGhhbmRsZVRvdWNoU3RhcnQgOiBmdW5jdGlvbihlKSB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHRoaXMucHJlc3NlZC5zcGFjZWJhciA9IHRydWU7XG5cdH0sXG5cdFxuXHRoYW5kbGVUb3VjaEVuZCA6IGZ1bmN0aW9uKGUpIHtcblx0XHR2YXIgdG91Y2hlcyA9IGUub3JpZ2luYWxFdmVudC50b3VjaGVzO1xuXHRcdHRoaXMucHJlc3NlZC5zcGFjZWJhciA9ICh0b3VjaGVzLmxlbmd0aCAhPT0gMCk7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZmFsc2lmeSA9IGZ1bmN0aW9uICh2YWx1ZSwga2V5LCBsaXN0KSB7XG5cdFx0XHRsaXN0W2tleV0gPSBmYWxzZTtcblx0XHR9O1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdF8uZWFjaCggdGhpcy5kb3duLCBmYWxzaWZ5ICk7XG5cdFx0XHRfLmVhY2goIHRoaXMudXAsIGZhbHNpZnkgKTtcblx0XHR9O1xuXHRcdFxuXHR9KClcblx0XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBISUQucHJvdG90eXBlICk7XG5cbm1vZHVsZS5leHBvcnRzID0gSElEO1xuIiwidmFyIENvb3JkaW5hdGVzID0gcmVxdWlyZSgnLi91dGlscy9Db29yZGluYXRlcycpO1xudmFyIENhbWVyYSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9DYW1lcmEnKTtcbnZhciBHdW4gPSByZXF1aXJlKCcuL21hbmFnZXJzL0d1bicpO1xudmFyIFNoaXAgPSByZXF1aXJlKCcuL1NoaXAnKTtcbnZhciBTdGFycyA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9TdGFycycpO1xudmFyIEFzdGVyb2lkRmllbGQgPSByZXF1aXJlKCcuL21hbmFnZXJzL0FzdGVyb2lkRmllbGQnKTtcbnZhciBTdGF0cyA9IHJlcXVpcmUoJy4vdXRpbHMvU3RhdHMnKTtcbnZhciBFdmVudERpc3BhdGNoZXIgPSByZXF1aXJlKCcuL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xudmFyIEplbGx5U2hpcCA9IHJlcXVpcmUoJy4vZW50aXRpZXMvSmVsbHlTaGlwJyk7XG52YXIgRW50aXR5TWFuYWdlciA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvRW50aXR5TWFuYWdlcicpO1xudmFyIFNjb3JpbmdBbmRXaW5uaW5nID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL1Njb3JpbmdBbmRXaW5uaW5nJyk7XG52YXIgQ2xvY2sgPSByZXF1aXJlKCcuL3V0aWxzL0Nsb2NrJyk7XG5cbnZhciByZW5kZXJlcjtcblxudmFyIFBvZW0gPSBmdW5jdGlvbiggbGV2ZWwgKSB7XG5cblx0dGhpcy5jaXJjdW1mZXJlbmNlID0gbGV2ZWwuY29uZmlnLmNpcmN1bWZlcmVuY2UgfHwgNzUwO1xuXHR0aGlzLmhlaWdodCA9IGxldmVsLmNvbmZpZy5oZWlnaHQgfHwgMTIwO1xuXHR0aGlzLnIgPSBsZXZlbC5jb25maWcuciB8fCAyNDA7XG5cdHRoaXMuY2lyY3VtZmVyZW5jZVJhdGlvID0gKDIgKiBNYXRoLlBJKSAvIHRoaXMuY2lyY3VtZmVyZW5jZTsgLy9NYXAgMmQgWCBjb29yZGluYXRlcyB0byBwb2xhciBjb29yZGluYXRlc1xuXHR0aGlzLnJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gPj0gMSA/IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIDogMTtcblx0XG5cdHRoaXMuY29udHJvbHMgPSB1bmRlZmluZWQ7XG5cdHRoaXMuZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjb250YWluZXInICk7XG5cdHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcblx0dGhpcy5yZXF1ZXN0ZWRGcmFtZSA9IHVuZGVmaW5lZDtcblxuXHR0aGlzLmNsb2NrID0gbmV3IENsb2NrKCk7XG5cdHRoaXMuY29vcmRpbmF0ZXMgPSBuZXcgQ29vcmRpbmF0ZXMoIHRoaXMgKTtcblx0dGhpcy5jYW1lcmEgPSBuZXcgQ2FtZXJhKCB0aGlzLCBsZXZlbC5jb25maWcgKTtcblx0dGhpcy5zY2VuZS5mb2cgPSBuZXcgVEhSRUUuRm9nKCAweDIyMjIyMiwgdGhpcy5jYW1lcmEub2JqZWN0LnBvc2l0aW9uLnogLyAyLCB0aGlzLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueiAqIDIgKTtcblx0XG5cdHRoaXMuZ3VuID0gbmV3IEd1biggdGhpcyApO1xuXHR0aGlzLnNoaXAgPSBuZXcgU2hpcCggdGhpcyApO1xuXHR0aGlzLnN0YXJzID0gbmV3IFN0YXJzKCB0aGlzLCBsZXZlbC5jb25maWcuc3RhcnMgKTtcblx0dGhpcy5zY29yaW5nQW5kV2lubmluZyA9IG5ldyBTY29yaW5nQW5kV2lubmluZyggdGhpcywgbGV2ZWwuY29uZmlnLnNjb3JpbmdBbmRXaW5uaW5nICk7XG5cdFxuXHR0aGlzLnBhcnNlTGV2ZWwoIGxldmVsICk7XG5cdFxuXHR0aGlzLmRpc3BhdGNoKHtcblx0XHR0eXBlOiAnbGV2ZWxQYXJzZWQnXG5cdH0pO1xuXHRcblx0aWYoIXJlbmRlcmVyKSB7XG5cdFx0dGhpcy5hZGRSZW5kZXJlcigpO1xuXHR9XG4vL1x0dGhpcy5hZGRTdGF0cygpO1xuXHR0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG5cdFxuXHR0aGlzLmxvb3AoKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvZW07XG5cblBvZW0ucHJvdG90eXBlID0ge1xuXHRcblx0cGFyc2VMZXZlbCA6IGZ1bmN0aW9uKCBsZXZlbCApIHtcblx0XHRfLmVhY2goIGxldmVsLm9iamVjdHMsIGZ1bmN0aW9uKCB2YWx1ZSwga2V5ICkge1xuXHRcdFx0aWYoXy5pc09iamVjdCggdmFsdWUgKSkge1xuXHRcdFx0XHR0aGlzWyBrZXkgXSA9IG5ldyB2YWx1ZS5vYmplY3QoIHRoaXMsIHZhbHVlLnByb3BlcnRpZXMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXNbIGtleSBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0fSxcblx0XG5cdGFkZFJlbmRlcmVyIDogZnVuY3Rpb24oKSB7XG5cdFx0cmVuZGVyZXIgPSBuZXcgVEhSRUUuV2ViR0xSZW5kZXJlcih7XG5cdFx0XHRhbHBoYSA6IHRydWVcblx0XHR9KTtcblx0XHRyZW5kZXJlci5zZXRTaXplKCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XG5cdFx0dGhpcy5kaXYuYXBwZW5kQ2hpbGQoIHJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblx0fSxcblx0XG5cdGdldENhbnZhcyA6IGZ1bmN0aW9uKCkge1xuXHRcdGlmKCByZW5kZXJlciApIHtcblx0XHRcdHJldHVybiByZW5kZXJlci5kb21FbGVtZW50O1xuXHRcdH1cblx0fSxcblx0XG5cdGFkZFN0YXRzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zdGF0cyA9IG5ldyBTdGF0cygpO1xuXHRcdHRoaXMuc3RhdHMuZG9tRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnRvcCA9ICcwcHgnO1xuXHRcdCQoXCIjY29udGFpbmVyXCIpLmFwcGVuZCggdGhpcy5zdGF0cy5kb21FbGVtZW50ICk7XG5cdH0sXG5cdFx0XG5cdGFkZEV2ZW50TGlzdGVuZXJzIDogZnVuY3Rpb24oKSB7XG5cdFx0JCh3aW5kb3cpLm9uKCdyZXNpemUnLCB0aGlzLnJlc2l6ZUhhbmRsZXIuYmluZCh0aGlzKSk7XG5cdH0sXG5cdFxuXHRyZXNpemVIYW5kbGVyIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jYW1lcmEucmVzaXplKCk7XG5cdFx0cmVuZGVyZXIuc2V0U2l6ZSggd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCApO1xuXG5cdH0sXG5cdFx0XHRcblx0bG9vcCA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dGhpcy5yZXF1ZXN0ZWRGcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSggdGhpcy5sb29wLmJpbmQodGhpcykgKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdH0sXG5cdFx0XHRcblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Ly8gdGhpcy5zdGF0cy51cGRhdGUoKTtcblx0XHRcblx0XHR0aGlzLmRpc3BhdGNoKHtcblx0XHRcdHR5cGU6IFwidXBkYXRlXCIsXG5cdFx0XHRkdDogdGhpcy5jbG9jay5nZXREZWx0YSgpLFxuXHRcdFx0dGltZTogdGhpcy5jbG9jay50aW1lXG5cdFx0fSk7XG5cdFx0XG5cdFx0cmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYS5vYmplY3QgKTtcblxuXHR9LFxuXHRcblx0ZGVzdHJveSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSggdGhpcy5yZXF1ZXN0ZWRGcmFtZSApO1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2goe1xuXHRcdFx0dHlwZTogXCJkZXN0cm95XCJcblx0XHR9KTtcblx0fVxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggUG9lbS5wcm90b3R5cGUgKTsiLCJ2YXIgSElEID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0hpZCcpO1xudmFyIERhbWFnZSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9EYW1hZ2UnKTtcbnZhciBkZXN0cm95TWVzaCA9IHJlcXVpcmUoJy4vdXRpbHMvZGVzdHJveU1lc2gnKTtcblxudmFyIFNoaXAgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuc2NlbmUgPSBwb2VtLnNjZW5lO1xuXHR0aGlzLnBvbGFyT2JqID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdHRoaXMub2JqZWN0ID0gbnVsbDtcblx0dGhpcy5oaWQgPSBuZXcgSElEKCB0aGlzLnBvZW0gKTtcblx0dGhpcy5jb2xvciA9IDB4NEE5REU3O1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMucmFkaXVzID0gMztcblx0XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHRcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cdHRoaXMubGl2ZXMgPSAzO1xuXHR0aGlzLmludnVsbmVyYWJsZSA9IHRydWU7XG5cdHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoID0gMzAwMDtcblx0dGhpcy5pbnZ1bG5lcmFibGVUaW1lID0gMCArIHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoO1xuXHR0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wID0gZmFsc2U7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BMZW5ndGggPSAxMDA7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BUaW1lID0gMDtcblx0XG5cdHRoaXMuc3BlZWQgPSAwO1xuXHRcblx0dGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkID0gMC4wNDtcblx0dGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQgPSAwLjAwMTtcblx0XG5cdHRoaXMudGhydXN0U3BlZWQgPSAwLjAwMTtcblx0dGhpcy50aHJ1c3QgPSAwO1xuXHRcblx0dGhpcy5iYW5rU3BlZWQgPSAwLjA2O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gNTAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuZGFtYWdlID0gbmV3IERhbWFnZSh0aGlzLnBvZW0sIHRoaXMpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpICk7XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaGlwO1xuXG5TaGlwLnByb3RvdHlwZSA9IHtcblx0XG5cdGNyZWF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKSxcblx0XHRcblx0XHR2ZXJ0cyA9IFtbNTAsMzYuOV0sIFszOS44LDU5LjZdLCBbNDcuMSw1My45XSwgWzUwLDU3LjVdLCBbNTMsNTMuOV0sIFs2MC4yLDU5LjZdLCBbNTAsMzYuOV1dO1xuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFx0XG5cdFx0XHRyZXR1cm4gW21lbW9bMF0gKyB2ZXJ0MmRbMF0sIG1lbW9bMV0gKyB2ZXJ0MmRbMV1dO1xuXHRcdFx0XG5cdFx0fSwgWzAsMF0pO1xuXHRcdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0Z2VvbWV0cnkudmVydGljZXMgPSBfLm1hcCggdmVydHMsIGZ1bmN0aW9uKCB2ZWMyICkge1xuXHRcdFx0dmFyIHNjYWxlID0gMSAvIDQ7XG5cdFx0XHRyZXR1cm4gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0XHRcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeSgpO1xuXHRcdFx0XHRcblx0XHRsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aFxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLkxpbmUoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdGxpbmVNYXRlcmlhbCxcblx0XHRcdFRIUkVFLkxpbmVTdHJpcFxuXHRcdCk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueiArPSB0aGlzLnBvZW0ucjtcblxuXHRcdHRoaXMucG9sYXJPYmouYWRkKCB0aGlzLm9iamVjdCApO1xuXHRcdHRoaXMucmVzZXQoKTtcblx0XHR0aGlzLnNjZW5lLmFkZCggdGhpcy5wb2xhck9iaiApO1xuXHRcdHRoaXMucG9lbS5vbignZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdFx0XG5cdH0sXG5cdFxuXHRkaXNhYmxlIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5kZWFkID0gdHJ1ZTtcblx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gZmFsc2U7XG5cdH0sXG5cdFxuXHRraWxsIDogZnVuY3Rpb24oIGZvcmNlICkge1xuXG5cdFx0aWYoICFmb3JjZSAmJiAhdGhpcy5kZWFkICYmICF0aGlzLmludnVsbmVyYWJsZSApIHtcblx0XHRcdHRoaXMuZGVhZCA9IHRydWU7XG5cdFx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gZmFsc2U7XG5cdFx0XHRcblx0XHRcdHRoaXMuZGFtYWdlLmV4cGxvZGUoKTtcblx0XHRcdFxuXHRcdFx0dmFyIGxvc3RQb2ludHMgPSBNYXRoLmNlaWwoIHRoaXMucG9lbS5zY29yaW5nQW5kV2lubmluZy5zY29yZSAvIC0yICk7XG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbS5zY29yaW5nQW5kV2lubmluZy5hZGp1c3RTY29yZShcblx0XHRcdFx0bG9zdFBvaW50cyxcblx0XHRcdFx0bG9zdFBvaW50cyArIFwiIHBvaW50c1wiLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0XCJmb250LXNpemVcIiA6IFwiMmVtXCIsXG5cdFx0XHRcdFx0XCJjb2xvclwiOiBcInJlZFwiXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XG5cdFx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdFx0XHR0aGlzLmRlYWQgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZVRpbWUgPSB0aGlzLnBvZW0uY2xvY2sudGltZSArIHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoO1xuXHRcdFx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5yZXNldCgpO1xuXHRcdFxuXHRcdFx0fS5iaW5kKHRoaXMpLCAyMDAwKTtcblx0XHR9XG5cdH0sXG5cdFxuXHRyZXNldCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucG9zaXRpb24ueCA9IDA7XG5cdFx0dGhpcy5wb3NpdGlvbi55ID0gMDtcblx0XHR0aGlzLnNwZWVkID0gMC4yO1xuXHRcdHRoaXMuYmFuayA9IDA7XG5cdFx0Ly90aGlzLm9iamVjdC5yb3RhdGlvbi56ID0gTWF0aC5QSSAqIDAuMjU7XHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0aWYoIHRoaXMuZGVhZCApIHtcblx0XHRcdFxuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dGhpcy51cGRhdGVUaHJ1c3RBbmRCYW5rKCBlICk7XG5cdFx0XHR0aGlzLnVwZGF0ZUVkZ2VBdm9pZGFuY2UoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlUG9zaXRpb24oIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlRmlyaW5nKCBlICk7XG5cdFx0XHR0aGlzLnVwZGF0ZUludnVsbmVyYWJpbGl0eSggZSApO1xuXHRcdFx0XG5cdFx0fVxuXHRcdHRoaXMuZGFtYWdlLnVwZGF0ZSggZSApO1xuXHRcdHRoaXMuaGlkLnVwZGF0ZSggZSApO1xuXG5cdH0sXG5cdFxuXHR1cGRhdGVJbnZ1bG5lcmFiaWxpdHkgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBlLnRpbWUgPCB0aGlzLmludnVsbmVyYWJsZVRpbWUgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGUudGltZSA+IHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BUaW1lICkge1xuXG5cdFx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcFRpbWUgPSBlLnRpbWUgKyB0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wTGVuZ3RoO1xuXHRcdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3AgPSAhdGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcDtcdFxuXHRcdFx0XHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSB0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGVUaHJ1c3RBbmRCYW5rIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dmFyIHByZXNzZWQsIHRpbHQsIHRoZXRhLCB0aGV0YURpZmY7XG5cdFx0XG5cdFx0dGhpcy5iYW5rICo9IDAuOTtcblx0XHR0aGlzLnRocnVzdCA9IDA7XG5cdFx0XG5cdFx0aWYoIHRoaXMuaGlkLnR5cGUoKSA9PT0gXCJrZXlzXCIgKSB7XG5cdFx0XHRcblx0XHRcdHByZXNzZWQgPSB0aGlzLmhpZC5wcmVzc2VkO1xuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQudXAgKSB7XG5cdFx0XHRcdHRoaXMudGhydXN0ICs9IHRoaXMudGhydXN0U3BlZWQgKiBlLmR0O1xuXHRcdFx0fVxuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQuZG93biApIHtcblx0XHRcdFx0dGhpcy50aHJ1c3QgLT0gdGhpcy50aHJ1c3RTcGVlZCAqIGUuZHQ7XHRcblx0XHRcdH1cblx0XHRcblx0XHRcdGlmKCBwcmVzc2VkLmxlZnQgKSB7XG5cdFx0XHRcdHRoaXMuYmFuayA9IHRoaXMuYmFua1NwZWVkO1xuXHRcdFx0fVxuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQucmlnaHQgKSB7XG5cdFx0XHRcdHRoaXMuYmFuayA9IHRoaXMuYmFua1NwZWVkICogLTE7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGlsdCA9IHRoaXMuaGlkLnRpbHQ7XG5cdFx0XHRcblx0XHRcdHZhciBkaXN0YW5jZSA9IE1hdGguc3FydCh0aWx0LnggKiB0aWx0LnggKyB0aWx0LnkgKiB0aWx0LnkpO1xuXHRcdFxuXHRcdFx0dGhpcy50aHJ1c3QgPSBNYXRoLm1pbiggMC4wMDExLCBkaXN0YW5jZSAvIDEwMDAwICk7XG5cdFx0XHRcblx0XHRcdHRoaXMudGhydXN0ICo9IGUuZHQ7XG5cdFx0XHRcblx0XHRcdHRoZXRhID0gTWF0aC5hdGFuMiggdGlsdC55LCB0aWx0LnggKTtcblx0XHRcdHRoZXRhRGlmZiA9ICh0aGV0YSAtIHRoaXMub2JqZWN0LnJvdGF0aW9uLnopICUgKDIgKiBNYXRoLlBJKTtcblx0XHRcdFxuXHRcdFx0aWYoIHRoZXRhRGlmZiA+IE1hdGguUEkgKSB7XG5cdFx0XHRcdHRoZXRhRGlmZiAtPSAyICogTWF0aC5QSTtcblx0XHRcdH0gZWxzZSBpZiAoIHRoZXRhRGlmZiA8IC1NYXRoLlBJICkge1xuXHRcdFx0XHR0aGV0YURpZmYgKz0gMiAqIE1hdGguUEk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMuYmFuayA9IHRoZXRhRGlmZiAqIGRpc3RhbmNlIC8gMjUwMCAqIGUuZHQ7XG5cdFx0XHRcblx0XHRcdFxuXHRcdH1cblx0fSxcblx0XG5cdHVwZGF0ZUVkZ2VBdm9pZGFuY2UgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR2YXIgbmVhckVkZ2UsIGZhckVkZ2UsIHBvc2l0aW9uLCBub3JtYWxpemVkRWRnZVBvc2l0aW9uLCBiYW5rRGlyZWN0aW9uLCBhYnNQb3NpdGlvbjtcblx0XHRcblx0XHRmYXJFZGdlID0gdGhpcy5wb2VtLmhlaWdodCAvIDI7XG5cdFx0bmVhckVkZ2UgPSA0IC8gNSAqIGZhckVkZ2U7XG5cdFx0cG9zaXRpb24gPSB0aGlzLm9iamVjdC5wb3NpdGlvbi55O1xuXHRcdGFic1Bvc2l0aW9uID0gTWF0aC5hYnMoIHBvc2l0aW9uICk7XG5cblx0XHR2YXIgcm90YXRpb24gPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56IC8gTWF0aC5QSTtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogJT0gMiAqIE1hdGguUEk7XG5cdFx0XG5cdFx0aWYoIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCAwICkge1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSAyICogTWF0aC5QSTtcblx0XHR9XG5cdFx0XG5cdFx0aWYoIE1hdGguYWJzKCBwb3NpdGlvbiApID4gbmVhckVkZ2UgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBpc1BvaW50aW5nTGVmdCA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPj0gTWF0aC5QSSAqIDAuNSAmJiB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgTWF0aC5QSSAqIDEuNTtcblx0XHRcdFxuXHRcdFx0aWYoIHBvc2l0aW9uID4gMCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0bm9ybWFsaXplZEVkZ2VQb3NpdGlvbiA9IChhYnNQb3NpdGlvbiAtIG5lYXJFZGdlKSAvIChmYXJFZGdlIC0gbmVhckVkZ2UpO1xuXHRcdFx0dGhpcy50aHJ1c3QgKz0gbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZVRocnVzdFNwZWVkO1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSBiYW5rRGlyZWN0aW9uICogbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZUJhbmtTcGVlZDtcblx0XHRcdFxuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZUZpcmluZyA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdGlmKCB0aGlzLmhpZC5wcmVzc2VkLnNwYWNlYmFyICkge1xuXHRcdFx0dGhpcy5wb2VtLmd1bi5maXJlKCB0aGlzLnBvc2l0aW9uLngsIHRoaXMucG9zaXRpb24ueSwgMiwgdGhpcy5vYmplY3Qucm90YXRpb24ueiApO1xuXHRcdH1cblx0fSxcblx0XG5cdHVwZGF0ZVBvc2l0aW9uIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIG1vdmVtZW50ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0XHR2YXIgdGhldGEsIHgsIHk7XG5cdFx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gdGhpcy5iYW5rO1xuXHRcdFx0XG5cdFx0XHR0aGV0YSA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLno7XG5cdFx0XHRcblx0XHRcdHRoaXMuc3BlZWQgKj0gMC45ODtcblx0XHRcdHRoaXMuc3BlZWQgKz0gdGhpcy50aHJ1c3Q7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5taW4oIHRoaXMubWF4U3BlZWQsIHRoaXMuc3BlZWQgKTtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1heCggMCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZCAqIE1hdGguY29zKCB0aGV0YSApO1xuXHRcdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueSA9IHRoaXMucG9zaXRpb24ueTtcblx0XHRcdFxuXHRcdFx0Ly9Qb2xhciBjb29yZGluYXRlc1xuXHRcdFx0dGhpcy5wb2xhck9iai5yb3RhdGlvbi55ID0gdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbztcblx0XHRcdFxuXHRcdH07XG5cdFx0XG5cdH0oKSxcblx0XG5cdGRlc3Ryb3kgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS5kaXNwb3NlKCk7XG5cdFx0dGhpcy5vYmplY3QubWF0ZXJpYWwuZGlzcG9zZSgpO1xuXHR9XG5cdFxufTsiLCJ2YXIgQ2FtZXJhID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dGhpcy5wb2xhck9iaiA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuXHRcblx0dGhpcy5zcGVlZCA9IDAuMDMyO1xuXHRcblx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoXG5cdFx0NTAsXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBmb3Zcblx0XHR3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCxcdC8vIGFzcGVjdCByYXRpb1xuXHRcdDMsXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBuZWFyIGZydXN0dW1cblx0XHQxMDAwXHRcdFx0XHRcdFx0XHRcdFx0Ly8gZmFyIGZydXN0dW1cblx0KTtcblx0XG5cdHZhciBtdWx0aXBsaWVyID0gcHJvcGVydGllcy5jYW1lcmFNdWx0aXBsaWVyID8gcHJvcGVydGllcy5jYW1lcmFNdWx0aXBsaWVyIDogMS41O1xuXHR0aGlzLm9iamVjdC5wb3NpdGlvbi56ID0gdGhpcy5wb2VtLnIgKiBtdWx0aXBsaWVyO1xuXHRcblx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW1lcmE7XG5cbkNhbWVyYS5wcm90b3R5cGUgPSB7XG5cdFxuXHRyZXNpemUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm9iamVjdC5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0XHR0aGlzLm9iamVjdC51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR2YXIgdGhpc1RoZXRhID0gdGhpcy5wb2xhck9iai5yb3RhdGlvbi55O1xuXHRcdHZhciB0aGF0VGhldGEgPSB0aGlzLnBvZW0uc2hpcC5wb2xhck9iai5yb3RhdGlvbi55O1xuXHRcdHZhciB0aGV0YURpZmYgPSBNYXRoLmFicyh0aGlzVGhldGEgLSB0aGF0VGhldGEpO1xuXHRcdFxuXHRcdC8vIGlmKCB0aGV0YURpZmYgPiAwLjIgKSB7XG5cdFx0XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPVxuXHRcdFx0XHR0aGF0VGhldGEgKiAodGhpcy5zcGVlZCkgK1xuXHRcdFx0XHR0aGlzVGhldGEgKiAoMSAtIHRoaXMuc3BlZWQpO1xuXHRcdFx0XHRcblx0XHQvLyB9XG5cdH1cbn07IiwidmFyIENhbWVyYUludHJvID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dGhpcy5wb2VtLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueSA9IHRoaXMucG9lbS5oZWlnaHQgKiA1O1xuXHR0aGlzLm9yaWdpbiA9IHByb3BlcnRpZXMub3JpZ2luID8gcHJvcGVydGllcy5vcmlnaW4gOiBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHR0aGlzLnNwZWVkID0gcHJvcGVydGllcy5zcGVlZCA/IHByb3BlcnRpZXMuc3BlZWQgOiAwLjk4O1xuXHRcblx0dGhpcy5ib3VuZFVwZGF0ZSA9IHRoaXMudXBkYXRlLmJpbmQodGhpcyk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMuYm91bmRVcGRhdGUgKTtcblx0XG59O1xuXG5cbkNhbWVyYUludHJvLnByb3RvdHlwZSA9IHtcblx0XG5cdHVwZGF0ZTogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueSAqPSB0aGlzLnNwZWVkO1xuXHRcdHRoaXMucG9lbS5jYW1lcmEub2JqZWN0Lmxvb2tBdCggdGhpcy5vcmlnaW4gKTtcblx0XHRcblx0XHRpZiggdGhpcy5wb2VtLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueSA8IDAuMSApIHtcblx0XHRcdHRoaXMucG9lbS5vZmYoJ3VwZGF0ZScsIHRoaXMuYm91bmRVcGRhdGUgKTtcblx0XHR9XG5cdFx0XG5cdH1cblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbWVyYUludHJvOyIsInZhciB0d2/PgCA9IE1hdGguUEkgKiAyO1xudmFyIGNvcyA9IE1hdGguY29zO1xudmFyIHNpbiA9IE1hdGguc2luO1xudmFyIHJhbmRvbSA9IHJlcXVpcmUoJy4uL3V0aWxzL3JhbmRvbS5qcycpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcblxudmFyIEN5bGluZGVyTGluZXMgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0XG5cdC8vIGNvbnNvbGUud2FybihcInJlbW92ZSB0aXRsZSBoaWRpbmcgaGFja1wiKTtcblx0Ly8gJCgnI3RpdGxlJykuaGlkZSgpO1xuXHQvLyAkKCcuc2NvcmUnKS5jc3MoJ29wYWNpdHknLCAxKTtcblx0XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dmFyIGggPSAwLjU7XG5cdHZhciBsID0gMC41O1xuXHR2YXIgcyA9IDAuNTtcblx0XG5cdHZhciBnZW9tZXRyeVx0XHQ9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHR2YXIgaGVpZ2h0XHRcdFx0PSBwb2VtLnIgKiAoXy5pc051bWJlciggcHJvcGVydGllcy5oZWlnaHRQZXJjZW50YWdlICkgPyBwcm9wZXJ0aWVzLnJhZGl1c1BlcmNlbnRhZ2UgOiAwLjgpO1xuXHR2YXIgcmFkaXVzXHRcdFx0PSBwb2VtLnIgKiAoXy5pc051bWJlciggcHJvcGVydGllcy5yYWRpdXNQZXJjZW50YWdlICkgPyBwcm9wZXJ0aWVzLnJhZGl1c1BlcmNlbnRhZ2UgOiAwLjgpO1xuXHR2YXIgc2lkZXNcdFx0XHQ9IF8uaXNOdW1iZXIoIHByb3BlcnRpZXMuc2lkZXMgKSA/IHByb3BlcnRpZXMuc2lkZXMgOiAxNTtcblx0dmFyIGVjY2VudHJpY2l0eVx0PSBfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLmVjY2VudHJpY2l0eSApID8gcHJvcGVydGllcy5lY2NlbnRyaWNpdHkgOiAwLjE7XG5cdHZhciBpdGVyYXRpb25zXHRcdD0gXy5pc051bWJlciggcHJvcGVydGllcy5pdGVyYXRpb25zICkgPyBwcm9wZXJ0aWVzLml0ZXJhdGlvbnMgOiAxMDtcblx0XG5cdF9nZW5lcmF0ZU11bHRpcGxlQ3lsaW5kZXJWZXJ0aWNlcyhcblx0XHRpdGVyYXRpb25zLFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzLFxuXHRcdHNpZGVzLFxuXHRcdHJhZGl1cyxcblx0XHRwb2VtLmhlaWdodCxcblx0XHRlY2NlbnRyaWNpdHlcblx0KTtcblx0XG5cdHZhciB3YXZlVmVydGljZXMgPSBfdmVydGljZXNXYXZlciggZ2VvbWV0cnkudmVydGljZXMsIHBvZW0uaGVpZ2h0ICogMC4xICk7XG5cdHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7XG5cdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGgsXG5cdFx0Zm9nOiB0cnVlXG5cdH0pO1xuXG5cdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLkxpbmUoXG5cdFx0Z2VvbWV0cnksXG5cdFx0bWF0ZXJpYWwsXG5cdFx0VEhSRUUuTGluZVBpZWNlc1xuXHQpO1xuXHRcblx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKTtcblx0dGhpcy5wb2VtLm9uKCdkZXN0cm95JywgZGVzdHJveU1lc2goIHRoaXMub2JqZWN0KSApO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCBmdW5jdGlvbiggZSApIHtcblxuXHRcdGggPSAoaCArIDAuMDAwMiAqIGUuZHQpICUgMTtcblx0XHRtYXRlcmlhbC5jb2xvci5zZXRIU0woIGgsIHMsIGwgKTtcblx0XHR3YXZlVmVydGljZXMoIGUgKTtcblx0XHRnZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXG5cdH0uYmluZCh0aGlzKSk7XG5cdFxufTtcblxuXG5mdW5jdGlvbiBfZ2VuZXJhdGVNdWx0aXBsZUN5bGluZGVyVmVydGljZXMoIGl0ZXJhdGlvbnMsIHZlcnRpY2VzLCBzaWRlcywgcmFkaXVzLCBoZWlnaHQsIGVjY2VudHJpY2l0eSApIHtcblx0XG5cdHZhciByYXRpbzEsIHJhdGlvMjtcblx0XG5cdGZvciggdmFyIGk9MDsgaSA8IGl0ZXJhdGlvbnM7IGkrKyApIHtcblx0XHRcblx0XHRyYXRpbzEgPSBpIC8gaXRlcmF0aW9ucztcblx0XHRyYXRpbzIgPSAxIC0gcmF0aW8xO1xuXHRcdFxuXHRcdF9nZW5lcmF0ZUN5bGluZGVyVmVydGljZXMoXG5cdFx0XHR2ZXJ0aWNlcyxcblx0XHRcdE1hdGguZmxvb3IoIChzaWRlcyAtIDMpICogcmF0aW8yICkgKyAzLFxuXHRcdFx0cmFkaXVzICogcmF0aW8yLFxuXHRcdFx0aGVpZ2h0ICogcmF0aW8yICogcmF0aW8yLFxuXHRcdFx0ZWNjZW50cmljaXR5XG5cdFx0KTtcblx0XHRcblx0fVxufVxuXG5mdW5jdGlvbiBfZ2VuZXJhdGVDeWxpbmRlclZlcnRpY2VzKCB2ZXJ0aWNlcywgc2lkZXMsIHJhZGl1cywgaGVpZ2h0LCBlY2NlbnRyaWNpdHkgKSB7XG5cblx0dmFyIHgxLHoxLHgyLHoyLGgxLGgyLHhQcmltZSx6UHJpbWUsaFByaW1lO1xuXHR2YXIgZWNjMSA9IDEgLSBlY2NlbnRyaWNpdHk7XG5cdHZhciBlY2MyID0gMSArIGVjY2VudHJpY2l0eTtcblx0dmFyIHJhZGlhbnNQZXJTaWRlID0gdHdvz4AgLyBzaWRlcztcblx0dmFyIHdhdmVzID0gMztcblx0dmFyIHdhdmVIZWlnaHQgPSAwO1xuXG5cdGZvciggdmFyIGk9MDsgaSA8PSBzaWRlczsgaSsrICkge1xuXG5cdFx0Ly8gd2F2ZUhlaWdodCA9IGhlaWdodCAqIE1hdGguc2luKCByYWRpYW5zUGVyU2lkZSAqIGkgKiB3YXZlcyApICogMC40O1xuXG5cdFx0eDEgPSBjb3MoIHJhZGlhbnNQZXJTaWRlICogaSApICogcmFkaXVzICogcmFuZG9tLnJhbmdlKCBlY2MxLCBlY2MyICk7XG5cdFx0ejEgPSBzaW4oIHJhZGlhbnNQZXJTaWRlICogaSApICogcmFkaXVzICogcmFuZG9tLnJhbmdlKCBlY2MxLCBlY2MyICk7XG5cdFx0aDEgPSBoZWlnaHRcdFx0XHRcdFx0XHRcdFx0KiByYW5kb20ucmFuZ2UoIGVjYzEsIGVjYzIgKSArIHdhdmVIZWlnaHQ7XG5cdFx0XG5cdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XG5cdFx0XHRpZiggaSA9PT0gc2lkZXMgKSB7XG5cdFx0XHRcdHgxID0geFByaW1lO1xuXHRcdFx0XHR6MSA9IHpQcmltZTtcblx0XHRcdFx0aDEgPSBoUHJpbWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vVmVydGljYWwgbGluZVxuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqICAwLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MSwgaDEgKiAtMC41LCB6MSApICk7XG5cblx0XHRcdC8vVG9wIGhvcml6IGxpbmVcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MSwgaDEgKiAwLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MiwgaDIgKiAwLjUsIHoyICkgKTtcblxuXHRcdFx0Ly9Cb3R0b20gaG9yaXogbGluZVxuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqIC0wLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MiwgaDIgKiAtMC41LCB6MiApICk7XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR4UHJpbWUgPSB4MTtcblx0XHRcdHpQcmltZSA9IHoxO1xuXHRcdFx0aFByaW1lID0gaDE7XG5cdFx0XHRcblx0XHR9XG5cblx0XHR4MiA9IHgxO1xuXHRcdHoyID0gejE7XG5cdFx0aDIgPSBoMTtcblxuXHR9XG5cdFxuXHRyZXR1cm4gZ2VvbWV0cnk7XG5cbn07XG5cbmZ1bmN0aW9uIF9nZXRUaGV0YXNPblhaUGxhbmUoIHZlcnRpY2VzICkge1xuXHRcblx0cmV0dXJuIF8ubWFwKCB2ZXJ0aWNlcywgZnVuY3Rpb24oIHYgKSB7XG5cdFx0XHRcdFxuXHRcdHJldHVybiBNYXRoLmF0YW4yKCB2LnosIHYueCApO1xuXHRcdFxuXHR9KTtcblx0XG59XG5cbmZ1bmN0aW9uIF9nZXRZcyggdmVydGljZXMgKSB7XG5cdHJldHVybiBfLm1hcCggdmVydGljZXMsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdHJldHVybiB2Lnk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBfZ2V0VW5pdEludGVydmFsT2ZEaXN0YW5jZUZyb21ZT3JpZ2luKCB2ZXJ0aWNlcyApIHtcblx0XG5cdHZhciBkaXN0YW5jZXMgPSBfLm1hcCggdmVydGljZXMsIGZ1bmN0aW9uKCB2ICkge1xuXHRcdHJldHVybiBNYXRoLnNxcnQoIHYueCAqIHYueCArIHYueiAqIHYueiApO1xuXHR9KTtcblx0XG5cdHZhciBtYXhEaXN0YW5jZSA9IF8ucmVkdWNlKCBkaXN0YW5jZXMsIGZ1bmN0aW9uKCBtZW1vLCBkICkge1xuXHRcdHJldHVybiBNYXRoLm1heCggbWVtbywgZCApO1xuXHR9LCAwKTtcblx0XG5cdGlmKCBtYXhEaXN0YW5jZSA9PT0gMCApIHRocm93IG5ldyBFcnJvcihcIm1heERpc3RhbmNlIGNhbid0IGJlIDBcIik7XG5cdFxuXHRyZXR1cm4gXy5tYXAoIGRpc3RhbmNlcywgZnVuY3Rpb24oIGQgKSB7XG5cdFx0cmV0dXJuIGQgLyBtYXhEaXN0YW5jZTtcblx0fSk7XG5cdFxufVxuXG5mdW5jdGlvbiBfdmVydGljZXNXYXZlciggdmVydGljZXMsIGhlaWdodCApIHtcblx0XG5cdHZhciB0aGV0YXMgPSBfZ2V0VGhldGFzT25YWlBsYW5lKCB2ZXJ0aWNlcyApO1xuXHR2YXIgeXMgPSBfZ2V0WXMoIHZlcnRpY2VzICk7XG5cdHZhciBkZXB0aHMgPSBfZ2V0VW5pdEludGVydmFsT2ZEaXN0YW5jZUZyb21ZT3JpZ2luKCB2ZXJ0aWNlcyApO1xuXHRcblx0cmV0dXJuIGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgdCA9IGUudGltZSAqIDAuMDAxNTtcblx0XHR2YXIgZGVwdGhPZmZzZXQgPSB0d2/PgDtcblx0XHR2YXIgaCwgdGhldGE7XG5cdFx0XG5cdFx0Zm9yKCB2YXIgaT0wLCBpbCA9IHZlcnRpY2VzLmxlbmd0aDsgaSA8IGlsOyBpKysgKSB7XG5cdFx0XHRcblx0XHRcdGggPSBoZWlnaHQgKiBkZXB0aHNbaV07XG5cdFx0XHR0aGV0YSA9IHRoZXRhc1tpXSAqIDMgKyB0ICsgZGVwdGhPZmZzZXQgKiBkZXB0aHNbaV07XG5cdFxuXHRcdFx0dmVydGljZXNbaV0ueSA9IE1hdGguc2luKCB0aGV0YSApICogaCArIHlzW2ldO1xuXHRcdFxuXHRcdH1cblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEN5bGluZGVyTGluZXM7IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tLmpzJyk7XG52YXIgQnVsbGV0ID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvQnVsbGV0Jyk7XG52YXIgU291bmRHZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9zb3VuZC9Tb3VuZEdlbmVyYXRvcicpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcblxudmFyIERhbWFnZSA9IGZ1bmN0aW9uKCBwb2VtLCBzaGlwLCBzZXR0aW5ncyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuc2hpcCA9IHNoaXA7XG5cdHRoaXMucGVyRXhwbG9zaW9uID0gMTAwO1xuXHR0aGlzLnJldGFpbkV4cGxvc2lvbnNDb3VudCA9IDM7XG5cdHRoaXMuYnVsbGV0cyA9IFtdO1xuXHR0aGlzLmV4cGxvZGVTcGVlZCA9IDM7XG5cdHRoaXMudHJhbnNwYXJlbnQgPSBmYWxzZTtcblx0dGhpcy5vcGFjaXR5ID0gMTtcblx0XG5cdHRoaXMuZXhwbG9zaW9uQ291bnQgPSAwO1xuXHR0aGlzLmV4cGxvc2lvblNvdW5kID0gbnVsbDtcblx0XG5cdGlmKCBfLmlzT2JqZWN0KCBzZXR0aW5ncyApICkge1xuXHRcdF8uZXh0ZW5kKCB0aGlzLCBzZXR0aW5ncyApO1xuXHR9XG5cdFxuXHR0aGlzLmNvdW50ID0gdGhpcy5wZXJFeHBsb3Npb24gKiB0aGlzLnJldGFpbkV4cGxvc2lvbnNDb3VudDtcblx0XG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuYWRkU291bmQoKTtcbn07XG5cdFxuRGFtYWdlLnByb3RvdHlwZSA9IHtcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgdmVydGV4LCBidWxsZXQ7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHR2ZXJ0ZXggPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFx0YnVsbGV0ID0gbmV3IEJ1bGxldCggdGhpcy5wb2VtLCB0aGlzLCB2ZXJ0ZXggKTtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggdmVydGV4ICk7XG5cdFx0XHR0aGlzLmJ1bGxldHMucHVzaCggYnVsbGV0ICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XHRidWxsZXQucG9zaXRpb24ueSA9IDEwMDA7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAxICogdGhpcy5wb2VtLnJhdGlvLFxuXHRcdFx0XHQgY29sb3I6IHRoaXMuc2hpcC5jb2xvcixcblx0XHRcdFx0IHRyYW5zcGFyZW50OiB0aGlzLnRyYW5zcGFyZW50LFxuXHRcdFx0XHQgb3BhY2l0eTogdGhpcy5vcGFjaXR5XG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5vYmplY3QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdHRoaXMucG9lbS5vbiggJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QgKSApO1xuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNhd3Rvb3RoXCIgKSxcblx0XHRcdHNvdW5kLm1ha2VHYWluKCksXG5cdFx0XHRzb3VuZC5nZXREZXN0aW5hdGlvbigpXG5cdFx0XSk7XG5cdFx0XG5cdFx0c291bmQuc2V0R2FpbigwLDAsMCk7XG5cdFx0c291bmQuc3RhcnQoKTtcblx0XHRcblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmJ1bGxldHMsIGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdH0pO1xuXHRcdFxuXHR9LFxuXHRcblx0ZXhwbG9kZSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHRoaXMucGxheUV4cGxvc2lvblNvdW5kKCk7XG5cdFx0XG5cdFx0Xy5lYWNoKCBfLnNhbXBsZSggdGhpcy5idWxsZXRzLCB0aGlzLnBlckV4cGxvc2lvbiApLCBmdW5jdGlvbiggYnVsbGV0KSB7XG5cblx0XHRcdHZhciB0aGV0YSA9IHJhbmRvbS5yYW5nZSgwLCAyICogTWF0aC5QSSk7XG5cdFx0XHR2YXIgciA9IHJhbmRvbS5yYW5nZUxvdyggMCwgdGhpcy5leHBsb2RlU3BlZWQgKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LmFsaXZlID0gdHJ1ZTtcblx0XHRcdGJ1bGxldC5wb3NpdGlvbi5jb3B5KCB0aGlzLnNoaXAucG9zaXRpb24gKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LnNwZWVkLnggPSByICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHRidWxsZXQuc3BlZWQueSA9IHIgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcdFx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0XG5cdH0sXG5cdFxuXHRwbGF5RXhwbG9zaW9uU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZnJlcSA9IDUwMDtcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kO1xuXG5cdFx0Ly9TdGFydCBzb3VuZFxuXHRcdHNvdW5kLnNldEdhaW4oMC41LCAwLCAwLjAwMSk7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBzdGVwID0gMC4wMjtcblx0XHR2YXIgdGltZXMgPSA2O1xuXHRcdHZhciBpPTE7XG5cdFx0XG5cdFx0Zm9yKGk9MTsgaSA8IHRpbWVzOyBpKyspIHtcblx0XHRcdHNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogTWF0aC5yYW5kb20oKSwgc3RlcCAqIGksIHN0ZXApO1xuXHRcdH1cblxuXHRcdC8vRW5kIHNvdW5kXG5cdFx0c291bmQuc2V0R2FpbigwLCBzdGVwICogdGltZXMsIDAuMik7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEgKiAwLjIxLCBzdGVwICogdGltZXMsIDAuMDUpO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSAge1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy5idWxsZXRzLCBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0YnVsbGV0LnVwZGF0ZSggZSApO1xuXHRcdFx0YnVsbGV0LnNwZWVkLm11bHRpcGx5U2NhbGFyKDAuOTk5KTtcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGFtYWdlOyIsIm1vZHVsZS5leHBvcnRzPXJlcXVpcmUoXCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9Db21wb25lbnRzL0hpZC5qc1wiKSIsIi8qXG5cdFNldCB0aGUgd2luIGNvbmRpdGlvbnMgaW4gdGhlIGxldmVsIG1hbmlmZXN0IGFzIGJlbG93XG5cblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb21wb25lbnQ6IFwiamVsbHlNYW5hZ2VyXCIsXG5cdFx0XHRcdFx0cHJvcGVydGllczogbnVsbFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fVxuXG5cdFBzdWVkby1jb2RlIGdldHMgY2FsbGVkOlxuXG5cdFx0amVsbHlNYW5hZ2VyLndhdGNoRm9yQ29tcGxldGlvbiggd2luQ2hlY2ssIHByb3BlcnRpZXMgKTtcblxuXHRUaGVuIGluIHRoZSBqZWxseU1hbmFnZXIgY29tcG9uZW50LCBjYWxsIHRoZSBmb2xsb3dpbmcgd2hlbiBjb25kaXRpb24gaXMgY29tcGxldGVkOlxuXG5cdFx0c2NvcmluZ0FuZFdpbm5pbmcucmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkKCk7XG5cbiovXG52YXIgaGFzaGVyID0gcmVxdWlyZSgnaGFzaGVyJyk7XG5cbnZhciBTY29yaW5nQW5kV2lubmluZyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0cHJvcGVydGllcyA9IF8uaXNPYmplY3QoIHByb3BlcnRpZXMgKSA/IHByb3BlcnRpZXMgOiB7fTtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLiRzY29yZSA9ICQoJyNzY29yZScpO1xuXHR0aGlzLiRlbmVtaWVzQ291bnQgPSAkKCcjZW5lbWllcy1jb3VudCcpO1xuXHR0aGlzLiR3aW4gPSAkKCcud2luJyk7XG5cdHRoaXMuJHdpblNjb3JlID0gJCgnI3dpbi1zY29yZScpO1xuXHR0aGlzLiR3aW5UZXh0ID0gdGhpcy4kd2luLmZpbmQoJ2gxOmZpcnN0Jyk7XG5cdHRoaXMuJHNjb3JlTWVzc2FnZSA9ICQoJyNzY29yZS1tZXNzYWdlJyk7XG5cdHRoaXMuJG5leHRMZXZlbCA9ICQoJyNuZXh0LWxldmVsJyk7XG5cdHRoaXMuJGNhbnZhcyA9ICQoIHRoaXMucG9lbS5nZXRDYW52YXMoKSApO1xuXHRcblx0dGhpcy5zY29yZSA9IDA7XG5cdHRoaXMuZW5lbWllc0NvdW50ID0gMDtcblx0dGhpcy5zY29yZU1lc3NhZ2VJZCA9IDA7XG5cdHRoaXMubWVzc2FnZSA9IF8uaXNTdHJpbmcoIHByb3BlcnRpZXMubWVzc2FnZSApID8gcHJvcGVydGllcy5tZXNzYWdlIDogXCJZb3UgV2luXCI7XG5cdHRoaXMubmV4dExldmVsID0gcHJvcGVydGllcy5uZXh0TGV2ZWwgPyBwcm9wZXJ0aWVzLm5leHRMZXZlbCA6IG51bGw7XG5cdHRoaXMud29uID0gZmFsc2U7XG5cdFxuXHR0aGlzLmNvbmRpdGlvbnNDb3VudCA9IF8uaXNBcnJheSggcHJvcGVydGllcy5jb25kaXRpb25zICkgPyBwcm9wZXJ0aWVzLmNvbmRpdGlvbnMubGVuZ3RoIDogMDtcblx0dGhpcy5jb25kaXRpb25zUmVtYWluaW5nID0gdGhpcy5jb25kaXRpb25zQ291bnQ7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ2xldmVsUGFyc2VkJywgZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zZXRDb25kaXRpb25zKCBwcm9wZXJ0aWVzLmNvbmRpdGlvbnMgKVxuXHR9LmJpbmQodGhpcykpO1xuXHRcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNjb3JpbmdBbmRXaW5uaW5nO1xuXG5TY29yaW5nQW5kV2lubmluZy5wcm90b3R5cGUgPSB7XG5cdFxuXHRzZXRDb25kaXRpb25zIDogZnVuY3Rpb24oIGNvbmRpdGlvbnMgKSB7XG5cdFx0XG5cdFx0Ly8gU3RhcnQgd2F0Y2hpbmcgZm9yIGNvbXBsZXRpb24gZm9yIGFsbCBjb21wb25lbnRzXG5cdFx0XG5cdFx0Xy5lYWNoKCBjb25kaXRpb25zLCBmdW5jdGlvbiggY29uZGl0aW9uICkge1xuXHRcdFxuXHRcdFx0dmFyIGNvbXBvbmVudCA9IHRoaXMucG9lbVtjb25kaXRpb24uY29tcG9uZW50XTtcblx0XHRcdHZhciBhcmd1bWVudHMgPSBfLnVuaW9uKCB0aGlzLCBjb25kaXRpb24ucHJvcGVydGllcyApO1xuXHRcdFxuXHRcdFx0Y29tcG9uZW50LndhdGNoRm9yQ29tcGxldGlvbi5hcHBseSggY29tcG9uZW50LCBhcmd1bWVudHMgKTtcblx0XHRcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdFxuXHR9LFxuXHRcblx0cmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jb25kaXRpb25zUmVtYWluaW5nLS07XG5cdFx0XG5cdFx0aWYoIHRoaXMuY29uZGl0aW9uc1JlbWFpbmluZyA9PT0gMCApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLnNoaXAuZGlzYWJsZSgpO1xuXHRcdFx0dGhpcy53b24gPSB0cnVlO1xuXHRcdFx0dGhpcy5jb25kaXRpb25zQ29tcGxldGVkKCk7XG5cdFx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGp1c3RFbmVtaWVzIDogZnVuY3Rpb24oIGNvdW50ICkge1xuXHRcdFxuXHRcdC8vIGlmKHRoaXMud29uKSByZXR1cm47XG5cdFx0XG5cdFx0dGhpcy5lbmVtaWVzQ291bnQgKz0gY291bnQ7XG5cdFx0dGhpcy4kZW5lbWllc0NvdW50LnRleHQoIHRoaXMuZW5lbWllc0NvdW50ICk7XG5cdFx0XG5cdFx0cmV0dXJuIHRoaXMuZW5lbWllc0NvdW50O1xuXHR9LFxuXHRcblx0YWRqdXN0U2NvcmUgOiBmdW5jdGlvbiggY291bnQsIG1lc3NhZ2UsIHN0eWxlICkge1xuXHRcdFxuXHRcdGlmKHRoaXMud29uKSByZXR1cm47XG5cdFx0XG5cdFx0dGhpcy5zY29yZSArPSBjb3VudDtcblx0XHR0aGlzLiRzY29yZS50ZXh0KCB0aGlzLnNjb3JlICk7XG5cdFx0XG5cdFx0aWYoIG1lc3NhZ2UgKSB7XG5cdFx0XHR0aGlzLnNob3dNZXNzYWdlKCBtZXNzYWdlLCBzdHlsZSApO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gdGhpcy5zY29yZTtcblx0fSxcblx0XG5cdHNob3dNZXNzYWdlIDogZnVuY3Rpb24oIG1lc3NhZ2UsIHN0eWxlICkge1xuXHRcdFxuXHRcdHZhciAkc3BhbiA9ICQoJzxzcGFuPjwvc3Bhbj4nKS50ZXh0KCBtZXNzYWdlICk7XG5cdFx0XG5cdFx0aWYoIHN0eWxlICkgJHNwYW4uY3NzKCBzdHlsZSApO1xuXHRcdFxuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5oaWRlKCk7XG5cdFx0dGhpcy4kc2NvcmVNZXNzYWdlLmVtcHR5KCkuYXBwZW5kKCAkc3BhbiApO1xuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5yZW1vdmVDbGFzcygnZmFkZW91dCcpO1xuXHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5hZGRDbGFzcygnZmFkZWluJyk7XG5cdFx0dGhpcy4kc2NvcmVNZXNzYWdlLnNob3coKTtcblx0XHR0aGlzLiRzY29yZU1lc3NhZ2UucmVtb3ZlQ2xhc3MoJ2ZhZGVpbicpO1xuXHRcdFxuXHRcdHZhciBpZCA9ICsrdGhpcy5zY29yZU1lc3NhZ2VJZDtcblx0XHRcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHRpZiggaWQgPT09IHRoaXMuc2NvcmVNZXNzYWdlSWQgKSB7XG5cdFx0XHRcdHRoaXMuJHNjb3JlTWVzc2FnZS5hZGRDbGFzcygnZmFkZW91dCcpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpLCAyMDAwKTtcblx0XHRcblx0fSxcblx0XG5cdGNvbmRpdGlvbnNDb21wbGV0ZWQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLiRjYW52YXMuY3NzKCdvcGFjaXR5JywgMC4zKTtcblx0XHRcblx0XHR0aGlzLiR3aW5TY29yZS50ZXh0KCB0aGlzLnNjb3JlICk7XG5cdFx0dGhpcy4kd2luVGV4dC5odG1sKCB0aGlzLm1lc3NhZ2UgKTtcblx0XHRcblx0XHR0aGlzLnNob3dXaW5TY3JlZW4oKTtcblx0XHRcblx0XHR0aGlzLiRuZXh0TGV2ZWwub25lKCAnY2xpY2snLCBmdW5jdGlvbiggZSApIHtcblx0XHRcdFxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XG5cdFx0XHRoYXNoZXIuc2V0SGFzaChcImxldmVsL1wiICsgdGhpcy5uZXh0TGV2ZWwgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy4kY2FudmFzLmNzcygnb3BhY2l0eScsIDEpO1xuXHRcdFx0dGhpcy5oaWRlV2luU2NyZWVuKCk7XG5cdFx0XHRcblx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdH0sXG5cdFxuXHRzaG93V2luU2NyZWVuIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy4kd2luXG5cdFx0XHQucmVtb3ZlQ2xhc3MoJ3RyYW5zZm9ybS10cmFuc2l0aW9uJylcblx0XHRcdC5hZGRDbGFzcygnaGlkZScpXG5cdFx0XHQuYWRkQ2xhc3MoJ3RyYW5zZm9ybS10cmFuc2l0aW9uJylcblx0XHRcdC5zaG93KCk7XG5cdFx0XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJHdpbi5yZW1vdmVDbGFzcygnaGlkZScpO1xuXHRcdH0uYmluZCh0aGlzKSwgMSk7XG5cdFx0XG5cdH0sXG5cdFxuXHRoaWRlV2luU2NyZWVuIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy4kd2luLmFkZENsYXNzKCdoaWRlJyk7XG5cdFx0XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJHdpbi5oaWRlKCk7XG5cdFx0fS5iaW5kKHRoaXMpLCAxMDAwKTtcblx0XHRcblx0fSxcblx0XG59OyIsInZhciBkZXN0cm95TWVzaCA9IHJlcXVpcmUoJy4uL3V0aWxzL2Rlc3Ryb3lNZXNoJyk7XG5cbnZhciBTdGFycyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0cHJvcGVydGllcyA9IF8uaXNPYmplY3QoIHByb3BlcnRpZXMgKSA/IHByb3BlcnRpZXMgOiB7fTtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMub2JqZWN0ID0gbnVsbDtcblx0XG5cdHRoaXMuY291bnQgPSBfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLmNvdW50ICkgPyBwcm9wZXJ0aWVzLmNvdW50IDogNDAwMDA7XG5cdHRoaXMuZGVwdGggPSA3LjU7XG5cdHRoaXMuY29sb3IgPSAweGFhYWFhYTtcblx0XG5cdHRoaXMuYWRkT2JqZWN0KCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXJzO1xuXG5TdGFycy5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHIsIHRoZXRhLCB4LCB5LCB6LCBnZW9tZXRyeTtcblx0XHRcblx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRcdFxuXHRcdGZvcih2YXIgaT0wOyBpIDwgdGhpcy5jb3VudDsgaSsrKSB7XG5cdFx0XHRcblx0XHRcdHIgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0aWYoIHIgPCB0aGlzLnBvZW0uciApIHtcblx0XHRcdFx0ciA9IE1hdGgucmFuZG9tKCkgKiB0aGlzLmRlcHRoICogdGhpcy5wb2VtLnI7XG5cdFx0XHR9XG5cdFx0XHR0aGV0YSA9IE1hdGgucmFuZG9tKCkgKiAyICogTWF0aC5QSTtcblx0XHRcdFxuXHRcdFx0eCA9IE1hdGguY29zKCB0aGV0YSApICogcjtcblx0XHRcdHogPSBNYXRoLnNpbiggdGhldGEgKSAqIHI7XG5cdFx0XHR5ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0XG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyh4LHkseikgKTtcblx0XHRcdFx0XHRcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHR9LFxuXHRcblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmdlbmVyYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRuZXcgVEhSRUUuUG9pbnRDbG91ZE1hdGVyaWFsKHtcblx0XHRcdFx0IHNpemU6IDAuNSAqIHRoaXMucG9lbS5yYXRpbyxcblx0XHRcdFx0IGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0XHQgZm9nOiBmYWxzZVxuXHRcdFx0fVxuXHRcdCkgKTtcblx0XHRcblx0XHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApIDtcblx0XHR0aGlzLnBvZW0ub24oICdkZXN0cm95JywgZGVzdHJveU1lc2goIHRoaXMub2JqZWN0ICkgKTtcblx0fVxufTsiLCJ2YXIgSElEID0gcmVxdWlyZSgnLi4vQ29tcG9uZW50cy9IaWQnKTtcbnZhciBoYXNoZXIgPSByZXF1aXJlKCdoYXNoZXInKTtcblxudmFyIHRpdGxlSGlkZVRpbWVvdXQgPSBudWxsO1xuXG52YXIgVGl0bGVzID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLnBvZW0uc2hpcC5kaXNhYmxlKCk7XG5cdHRoaXMucm90YXRlU3RhcnMoKTtcblx0XG5cdFxuXHRcblx0JCgnYVtocmVmPSNrZXlzXScpLmNsaWNrKHRoaXMuaGFuZGxlS2V5c0NsaWNrLmJpbmQodGhpcykpO1xuXHQkKCdhW2hyZWY9I3RpbHRdJykuY2xpY2sodGhpcy5oYW5kbGVUaWx0Q2xpY2suYmluZCh0aGlzKSk7XG5cdFxuXHR0aGlzLnBvZW0ub24oICdkZXN0cm95JywgdGhpcy5oaWRlRG9tRWxlbWVudHMuYmluZCh0aGlzKSApO1xuXHRcblx0dGhpcy5zaG93RG9tRWxlbWVudHMoKTtcblx0XG5cdHRoaXMud2ViZ2xDaGVjaygpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaXRsZXM7XG5cblRpdGxlcy5wcm90b3R5cGUgPSB7XG5cdFxuXHR3ZWJnbEVuYWJsZWQgOiAoIGZ1bmN0aW9uICgpIHsgdHJ5IHsgdmFyIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICk7IHJldHVybiAhISB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICYmICggY2FudmFzLmdldENvbnRleHQoICd3ZWJnbCcgKSB8fCBjYW52YXMuZ2V0Q29udGV4dCggJ2V4cGVyaW1lbnRhbC13ZWJnbCcgKSApOyB9IGNhdGNoKCBlICkgeyByZXR1cm4gZmFsc2U7IH0gfSApKCksXG5cdFxuXHR3ZWJnbENoZWNrIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0aWYoICF0aGlzLndlYmdsRW5hYmxlZCApIHtcblx0XHRcdCQoJ2FbaHJlZj0ja2V5c10nKS5oaWRlKCk7XG5cdFx0XHQkKCdhW2hyZWY9I3RpbHRdJykuaGlkZSgpO1xuXHRcdFx0JCgnLnRpdGxlLXdlYmdsLWVycm9yJykuc2hvdygpO1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGhhbmRsZUtleXNDbGljayA6IGZ1bmN0aW9uKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0SElELnByb3RvdHlwZS5zZXRLZXlzKCk7XG5cdFx0dGhpcy5uZXh0TGV2ZWwoKTtcblx0fSxcblx0XG5cdGhhbmRsZVRpbHRDbGljayA6IGZ1bmN0aW9uKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0SElELnByb3RvdHlwZS5zZXRUaWx0KCk7XG5cdFx0dGhpcy5uZXh0TGV2ZWwoKTtcblx0fSxcblx0XG5cdG5leHRMZXZlbCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdGhhc2hlci5zZXRIYXNoKFwibGV2ZWwvaW50cm9cIik7XG5cdFx0XG5cdH0sXG5cdFxuXHRzaG93RG9tRWxlbWVudHMgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHRjbGVhclRpbWVvdXQoIHRpdGxlSGlkZVRpbWVvdXQgKTtcblx0XHRcblx0XHQkKCcjdGl0bGUnKVxuXHRcdFx0LnJlbW92ZUNsYXNzKCd0cmFuc2Zvcm0tdHJhbnNpdGlvbicpXG5cdFx0XHQuYWRkQ2xhc3MoJ2hpZGUnKVxuXHRcdFx0LmFkZENsYXNzKCd0cmFuc2Zvcm0tdHJhbnNpdGlvbicpXG5cdFx0XHQuc2hvdygpO1xuXHRcdFx0XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdCQoJyN0aXRsZScpLnJlbW92ZUNsYXNzKCdoaWRlJyk7O1xuXHRcdH0sIDEpO1xuXHRcdFxuXHRcdCQoJy5zY29yZScpLmNzcygnb3BhY2l0eScsIDApO1xuXHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0aGlkZURvbUVsZW1lbnRzIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0JCgnI3RpdGxlJylcblx0XHRcdC5hZGRDbGFzcygndHJhbnNmb3JtLXRyYW5zaXRpb24nKVxuXHRcdFx0LmFkZENsYXNzKCdoaWRlJyk7XG5cdFx0XHRcblx0XHQkKCcuc2NvcmUnKS5jc3MoJ29wYWNpdHknLCAxKTtcblx0XHRcblx0XHR0aXRsZUhpZGVUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0JCgnI3RpdGxlJykuaGlkZSgpO1xuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpLCAxMDAwKTtcblx0XHRcblx0fSxcblx0XG5cdHJvdGF0ZVN0YXJzIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbS5zdGFycy5vYmplY3Qucm90YXRpb24ueSAtPSAwLjAwMDEgKiBlLmR0O1xuXHRcdFxuXHRcdH0uYmluZCh0aGlzKSApO1xuXHRcdFxuXHR9XG5cdFxufTsiLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcbnZhciBkZXN0cm95TWVzaCA9IHJlcXVpcmUoJy4uL3V0aWxzL2Rlc3Ryb3lNZXNoJyk7XG5cbnZhciBBc3Rlcm9pZCA9IGZ1bmN0aW9uKCBwb2VtLCB4LCB5LCByYWRpdXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdFxuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5wb3NpdGlvbi54ID0geCB8fCAwO1xuXHR0aGlzLnBvc2l0aW9uLnkgPSB5IHx8IDA7XG5cdHRoaXMub3NjaWxsYXRpb24gPSAwO1xuXHR0aGlzLnJhZGl1cyA9IHJhZGl1cyB8fCA1O1xuXHR0aGlzLnNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5yb3RhdGlvblNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0dGhpcy5tYXhTcGVlZCA9IDAuNTtcblx0dGhpcy5tYXhSb3RhdGlvblNwZWVkID0gMC4xO1xuXHR0aGlzLm9zY2lsbGF0aW9uU3BlZWQgPSA1MDtcblx0dGhpcy5zdHJva2VDb2xvciA9IDB4ZGRkZGRkO1xuXHR0aGlzLmZpbGxDb2xvciA9IDB4ZmZmZmZmO1xuXHR0aGlzLmFkZE9iamVjdCh4LCB5KTtcblx0dGhpcy51cGRhdGUoKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzdGVyb2lkO1xuXG5Bc3Rlcm9pZC5wcm90b3R5cGUgPSB7XG5cblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gbmV3IFRIUkVFLk9jdGFoZWRyb25HZW9tZXRyeSh0aGlzLnJhZGl1cywgMSk7XG5cdFx0XG5cdFx0Ly9EaXNmb3JtXG5cdFx0Xy5lYWNoKGdlb21ldHJ5LnZlcnRpY2VzLCBmdW5jdGlvbiggdmVydGV4ICkge1xuXHRcdFx0dmVydGV4LnggKz0gKHRoaXMucmFkaXVzIC8gMikgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cdFx0XHR2ZXJ0ZXgueSArPSAodGhpcy5yYWRpdXMgLyAyKSAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcblx0XHRcdHZlcnRleC56ICs9ICh0aGlzLnJhZGl1cyAvIDIpICogKE1hdGgucmFuZG9tKCkgLSAwLjUpO1xuXHRcdH0sIHRoaXMpO1xuXHRcdFxuXHRcdHZhciBtYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6dGhpcy5zdHJva2VDb2xvcn0pO1xuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBtYXRlcmlhbCApO1xuXHRcdFxuXHRcdHZhciBvdXRsaW5lTWF0ID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjp0aGlzLmZpbGxDb2xvciwgc2lkZTogVEhSRUUuQmFja1NpZGV9KTtcblx0XHR2YXIgb3V0bGluZU9iaiA9IG5ldyBUSFJFRS5NZXNoKCBnZW9tZXRyeSwgb3V0bGluZU1hdCApO1xuXHRcdG91dGxpbmVPYmouc2NhbGUubXVsdGlwbHlTY2FsYXIoIDEuMDUpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0LmFkZCggb3V0bGluZU9iaiApO1xuXHRcdFxuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0dGhpcy5wb2VtLm9uKCAnZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdFx0XG5cdFx0dGhpcy5zcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhTcGVlZDtcblx0XHR0aGlzLnNwZWVkLnkgPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFNwZWVkO1xuXHRcdFxuXHRcdHRoaXMucm90YXRpb25TcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC55ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC56ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdFxuXHRcdHRoaXMub3NjaWxsYXRpb24gPSBNYXRoLnJhbmRvbSgpICogTWF0aC5QSSAqIDIgKiB0aGlzLm9zY2lsbGF0aW9uU3BlZWQ7XG5cdFx0XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0aW9uICs9IHRoaXMuc3BlZWQueTtcblx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZC54O1xuXHRcdHRoaXMucG9zaXRpb24ueSA9IE1hdGguc2luKCB0aGlzLm9zY2lsbGF0aW9uIC8gdGhpcy5vc2NpbGxhdGlvblNwZWVkICkgKiB0aGlzLnBvZW0uaGVpZ2h0O1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnggKz0gdGhpcy5yb3RhdGlvblNwZWVkLng7XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi55ICs9IHRoaXMucm90YXRpb25TcGVlZC55O1x0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLnJvdGF0aW9uU3BlZWQuejtcdFxuXHRcdFxuXHRcdHRoaXMucG9lbS5jb29yZGluYXRlcy5zZXRWZWN0b3IoIHRoaXMub2JqZWN0LnBvc2l0aW9uLCB0aGlzLnBvc2l0aW9uICk7XG5cdH1cblx0XG59OyIsInZhciBCdWxsZXQgPSBmdW5jdGlvbiggcG9lbSwgZ3VuLCB2ZXJ0ZXggKSB7XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuZ3VuID0gZ3VuO1xuXHR0aGlzLnZlcnRleCA9IHZlcnRleDtcblx0XG5cdHRoaXMuc3BlZWQgPSBuZXcgVEhSRUUuVmVjdG9yMigwLDApO1xuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoMCwwKTtcblx0dGhpcy5yYWRpdXMgPSAxO1xuXHRcblx0dGhpcy5ib3JuQXQgPSAwO1xuXHR0aGlzLmFsaXZlID0gZmFsc2U7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJ1bGxldDtcblxuQnVsbGV0LnByb3RvdHlwZSA9IHtcblx0XG5cdGtpbGwgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRleC5zZXQoMCwgMCAsMTAwMCk7XG5cdFx0dGhpcy5hbGl2ZSA9IGZhbHNlO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIHgseSx6O1xuXHRcdFxuXHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkLng7XG5cdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQueTtcblx0XHRcblx0XHR0aGlzLnBvZW0uY29vcmRpbmF0ZXMuc2V0VmVjdG9yKCB0aGlzLnZlcnRleCwgdGhpcy5wb3NpdGlvbiApO1xuXHRcdFxuXHR9LFxuXHRcblx0ZmlyZSA6IGZ1bmN0aW9uKHgsIHksIHNwZWVkLCB0aGV0YSkge1xuXHRcdFx0XHRcblx0XHR0aGlzLnBvZW0uY29vcmRpbmF0ZXMuc2V0VmVjdG9yKCB0aGlzLnZlcnRleCwgeCwgeSApO1xuXHRcdFxuXHRcdHRoaXMucG9zaXRpb24uc2V0KHgseSk7XG5cdFx0XG5cdFx0dGhpcy5zcGVlZC54ID0gTWF0aC5jb3MoIHRoZXRhICkgKiBzcGVlZDtcblx0XHR0aGlzLnNwZWVkLnkgPSBNYXRoLnNpbiggdGhldGEgKSAqIHNwZWVkO1xuXHRcdFxuXHRcdHRoaXMuYm9ybkF0ID0gdGhpcy5wb2VtLmNsb2NrLnRpbWU7XG5cdFx0dGhpcy5hbGl2ZSA9IHRydWU7XG5cdFx0XG5cdH1cbn07IiwidmFyIERhbWFnZSA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvRGFtYWdlJyk7XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tJyk7XG52YXIgZGVzdHJveU1lc2ggPSByZXF1aXJlKCcuLi91dGlscy9kZXN0cm95TWVzaCcpO1xuXG52YXIgSmVsbHlzaGlwID0gZnVuY3Rpb24oIHBvZW0sIG1hbmFnZXIsIHgsIHkgKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXG5cdHRoaXMubmFtZSA9IFwiSmVsbHlzaGlwXCI7XG5cdHRoaXMuY29sb3IgPSAweGNiMzZlYTtcblx0dGhpcy5jc3NDb2xvciA9IFwiI0NCMzZFQVwiO1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMuc2NvcmVWYWx1ZSA9IDEzO1xuXG5cdHRoaXMuc3Bhd25Qb2ludCA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMih4LHkpO1xuXHRcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cblx0dGhpcy5zcGVlZCA9IDA7XG5cblx0dGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkID0gMC4wNDtcblx0dGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQgPSAwLjAwMTtcblxuXHR0aGlzLnRocnVzdFNwZWVkID0gMTtcblx0dGhpcy50aHJ1c3QgPSAwO1xuXG5cdHRoaXMuYmFua1NwZWVkID0gMC4wNjtcblx0dGhpcy5iYW5rID0gMDtcblx0dGhpcy5tYXhTcGVlZCA9IDEwMDA7XG5cdFxuXHR0aGlzLnJhZGl1cyA9IDM7XG5cblx0dGhpcy5hZGRPYmplY3QoKTtcblx0dGhpcy5kYW1hZ2UgPSBuZXcgRGFtYWdlKHRoaXMucG9lbSwgdGhpcywge1xuXHRcdHRyYW5zcGFyZW50OiB0cnVlLFxuXHRcdG9wYWNpdHk6IDAuNSxcblx0XHRyZXRhaW5FeHBsb3Npb25zQ291bnQ6IDMsXG5cdFx0cGVyRXhwbG9zaW9uOiA1MFxuXHR9KTtcblx0XG5cdHRoaXMuaGFuZGxlVXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKTtcblx0dGhpcy5tYW5hZ2VyLm9uKCd1cGRhdGUnLCB0aGlzLmhhbmRsZVVwZGF0ZSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSmVsbHlzaGlwO1xuXG5KZWxseXNoaXAucHJvdG90eXBlID0ge1xuXHRcblx0aW5pdFNoYXJlZEFzc2V0cyA6IGZ1bmN0aW9uKCBtYW5hZ2VyICkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSA9IHRoaXMuY3JlYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHRtYW5hZ2VyLnNoYXJlZC5nZW9tZXRyeSA9IGdlb21ldHJ5O1xuXHRcdFxuXHRcdG1hbmFnZXIub24oJ3VwZGF0ZScsIEplbGx5c2hpcC5wcm90b3R5cGUudXBkYXRlV2F2ZXlWZXJ0cyggZ2VvbWV0cnkgKSApO1xuXHR9LFxuXHRcblx0dXBkYXRlV2F2ZXlWZXJ0cyA6IGZ1bmN0aW9uKCBnZW9tZXRyeSApIHtcblxuXHRcdHJldHVybiBmdW5jdGlvbiggZSApIHtcblx0XHRcdFxuXHRcdFx0Xy5lYWNoKCBnZW9tZXRyeS53YXZleVZlcnRzLCBmdW5jdGlvbiggdmVjICkge1xuXHRcdFx0XHR2ZWMueSA9IDAuOCAqIE1hdGguc2luKCBlLnRpbWUgLyAxMDAgKyB2ZWMueCApICsgdmVjLm9yaWdpbmFsLnk7XG5cdFx0XHR9KTtcblx0XHRcdFxuXHRcdH07XG5cdH0sXG5cblx0Y3JlYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBnZW9tZXRyeSwgdmVydHMsIG1hbmhhdHRhbkxlbmd0aCwgY2VudGVyO1xuXHRcblx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpLFxuXHRcblx0XHQvL3ZlcnRzID0gW1szNTUuNywyMTEuN10sIFszNzUuOCwxOTUuOV0sIFszNjguNSwxNTUuNF0sIFszNjEuNCwxOTAuOF0sIFszNDEuMywyMDUuOV0sIFszMjAuNCwyMDEuOF0sIFsyOTguOSwyMDZdLCBbMjc4LjYsMTkwLjhdLCBbMjcxLjUsMTU1LjRdLCBbMjY0LjIsMTk1LjldLCBbMjg0LjcsMjEyXSwgWzI1OC4zLDIzOS4yXSwgWzI0Mi4zLDIyOC41XSwgWzIzOC4zLDE2OC45XSwgWzIyNi4xLDIzNy4xXSwgWzI0Ni43LDI2Ni4yXSwgWzIzMy43LDMxNi40XSwgWzI1OS4yLDMyMS4yXSwgWzIzNy40LDQyOS42XSwgWzI1My4xLDQzMi43XSwgWzI3NC45LDMyNC4yXSwgWzI5MywzMjcuNl0sIFsyODYuNiw0ODRdLCBbMzAyLjYsNDg0LjZdLCBbMzA4LjksMzMwLjZdLCBbMzIwLjQsMzMyLjhdLCBbMzMxLjEsMzMwLjhdLCBbMzM3LjQsNDg0LjZdLCBbMzUzLjQsNDg0XSwgWzM0NywzMjcuOF0sIFszNjUuMSwzMjQuM10sIFszODYuOSw0MzIuN10sIFs0MDIuNiw0MjkuNl0sIFszODAuOSwzMjEuNF0sIFs0MDcsMzE2LjRdLCBbMzkzLjgsMjY1LjVdLCBbNDEzLjksMjM3LjFdLCBbNDAxLjcsMTY4LjldLCBbMzk3LjcsMjI4LjVdLCBbMzgyLjEsMjM4LjldLCBbMzU1LjksMjExLjhdIF07XG5cdFx0XG5cdFx0dmVydHMgPSBbIFszNTUuNywyMTEuN10sIFszNzUuOCwxOTUuOV0sIFszNjguNSwxNTUuNF0sIFszNjEuNCwxOTAuOF0sIFszNDEuMywyMDUuOV0sIFszMjAuNCwyMDEuOF0sIFsyOTguOSwyMDZdLCBbMjc4LjYsMTkwLjhdLCBcblx0XHRcdFsyNzEuNSwxNTUuNF0sIFsyNjQuMiwxOTUuOV0sIFsyODQuNywyMTJdLCBbMjU4LjMsMjM5LjJdLCBbMjQyLjMsMjI4LjVdLCBbMjM4LjMsMTY4LjldLCBbMjI2LjEsMjM3LjFdLCBbMjQ2LjcsMjY2LjJdLCBbMjMzLjcsMzE2LjRdLCBbMjU5LjIsMzIxLjJdLCBcblx0XHRcdFsyNTcuMSwzMzEuM10sIFsyNTQuOSwzNDIuM10sIFsyNTIuOCwzNTIuOV0sIFsyNTAuNSwzNjQuNV0sIFsyNDguMiwzNzUuN10sIFsyNDYuMSwzODYuMl0sIFsyNDMuOCwzOTcuN10sIFsyNDEuMyw0MTAuM10sIFsyMzkuNSw0MTkuM10sIFsyMzcuNCw0MjkuNl0sIFxuXHRcdFx0WzI1My4xLDQzMi43XSwgWzI1NC45LDQyMy43XSwgWzI1Ni45LDQxNC4xXSwgWzI1OS4zLDQwMS44XSwgWzI2MS42LDM5MC4yXSwgWzI2My43LDM4MC4xXSwgWzI2Ni4xLDM2Ny44XSwgWzI2OC4zLDM1Ni45XSwgWzI3MC42LDM0NS42XSwgWzI3Mi43LDMzNS4xXSwgXG5cdFx0XHRbMjc0LjksMzI0LjJdLCBbMjkzLDMyNy42XSwgWzI5Mi42LDMzNi41XSwgWzI5Mi4yLDM0OF0sIFsyOTEuNywzNTkuNl0sIFsyOTEuMiwzNzEuNV0sIFsyOTAuNywzODIuNV0sIFsyOTAuMywzOTMuNl0sIFsyODkuOCw0MDUuMV0sIFsyODkuNSw0MTQuMV0sIFsyODksNDI1LjZdLCBcblx0XHRcdFsyODguNSw0MzddLCBbMjg4LjEsNDQ4LjVdLCBbMjg3LjYsNDU5LjVdLCBbMjg3LjEsNDcxLjVdLCBbMjg2LjYsNDg0XSwgWzMwMi42LDQ4NC42XSwgWzMwMy4xLDQ3My41XSwgWzMwMy42LDQ2MS41XSwgWzMwNC4xLDQ0OC41XSwgWzMwNC41LDQzOC41XSwgWzMwNSw0MjUuMV0sIFxuXHRcdFx0WzMwNS40LDQxNi4xXSwgWzMwNS45LDQwNV0sIFszMDYuMiwzOTUuNV0sIFszMDYuNiwzODZdLCBbMzA3LjEsMzczXSwgWzMwNy42LDM2MV0sIFszMDguMiwzNDcuNV0sIFszMDguNSwzMzguNV0sIFszMDguOSwzMzAuNl0sIFszMzEuMSwzMzAuOF0sIFszMzEuNCwzMzYuNV0sIFxuXHRcdFx0WzMzMS43LDM0NF0sIFszMzIsMzUzXSwgWzMzMi41LDM2NC41XSwgWzMzMywzNzZdLCBbMzMzLjQsMzg3LjVdLCBbMzMzLjksMzk4LjVdLCBbMzM0LjQsNDEwLjVdLCBbMzM0LjksNDIyLjRdLCBbMzM1LjQsNDM3XSwgWzMzNiw0NTBdLCBbMzM2LjQsNDYwXSwgWzMzNi44LDQ3MV0sIFxuXHRcdFx0WzMzNy40LDQ4NC42XSwgWzM1My40LDQ4NF0sIFszNTIuOCw0NzFdLCBbMzUyLjMsNDU3LjVdLCBbMzUxLjksNDQ4XSwgWzM1MS41LDQzNy41XSwgWzM1MC45LDQyM10sIFszNTAuNCw0MTAuNV0sIFszNDkuOCwzOTYuNV0sIFszNDkuNCwzODUuNV0sIFszNDguOSwzNzQuNF0sIFxuXHRcdFx0WzM0OC41LDM2My40XSwgWzM0OCwzNTJdLCBbMzQ3LjYsMzQzXSwgWzM0Ny4zLDMzNF0sIFszNDcsMzI3LjhdLCBbMzY1LjEsMzI0LjNdLCBbMzY2LjYsMzMxLjddLCBbMzY4LjIsMzM5LjZdLCBbMzcwLjIsMzQ5LjVdLCBbMzcxLjksMzU3LjhdLCBbMzczLjYsMzY2LjhdLCBcblx0XHRcdFszNzUuNCwzNzUuNF0sIFszNzcuMSwzODRdLCBbMzc5LDM5My41XSwgWzM4MS4yLDQwNC42XSwgWzM4My4xLDQxNF0sIFszODQuOSw0MjIuOF0sIFszODYuOSw0MzIuN10sIFs0MDIuNiw0MjkuNl0sIFs0MDAuNiw0MTkuNl0sIFszOTkuMSw0MTIuNV0sIFszOTcuMSw0MDIuNV0sIFxuXHRcdFx0WzM5NC43LDM5MC4yXSwgWzM5My4xLDM4Mi42XSwgWzM5MS40LDM3NF0sIFszODkuNiwzNjVdLCBbMzg3LjYsMzU1LjFdLCBbMzg2LDM0Ny4yXSwgWzM4NC4xLDMzNy43XSwgWzM4Mi43LDMzMC42XSwgWzM4MC45LDMyMS40XSwgWzQwNywzMTYuNF0sIFszOTMuOCwyNjUuNV0sIFxuXHRcdFx0WzQxMy45LDIzNy4xXSwgWzQwMS43LDE2OC45XSwgWzM5Ny43LDIyOC41XSwgWzM4Mi4xLDIzOC45XSwgWzM1NS45LDIxMS44XSBdO1xuXHRcdFxuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcblx0XHR9LCBbMCwwXSk7XG5cdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0Z2VvbWV0cnkud2F2ZXlWZXJ0cyA9IFtdO1xuXHRcblx0XHRnZW9tZXRyeS52ZXJ0aWNlcyA9IF8ubWFwKCB2ZXJ0cywgZnVuY3Rpb24oIHZlYzIgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBzY2FsZSA9IDEgLyAzMjtcblx0XHRcdHZhciB2ZWMzID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR2ZWMzLm9yaWdpbmFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KCB2ZWMzICk7XG5cdFx0XHRcblx0XHRcdGlmKCB2ZWMyWzFdID4gMzMwLjggKSB7XG5cdFx0XHRcdGdlb21ldHJ5LndhdmV5VmVydHMucHVzaCggdmVjMyApXG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB2ZWMzO1xuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0XG5cdH0sXG5cblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcblx0XHRnZW9tZXRyeSA9IHRoaXMubWFuYWdlci5zaGFyZWQuZ2VvbWV0cnk7XG5cdFx0XHRcblx0XHRsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aFxuXHRcdH0pO1xuXHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogKz0gdGhpcy5wb2VtLnI7XG5cdFxuXHRcdHRoaXMucG9sYXJPYmouYWRkKCB0aGlzLm9iamVjdCApO1xuXHRcdHRoaXMucmVzZXQoKTtcblx0XHR0aGlzLnNjZW5lLmFkZCggdGhpcy5wb2xhck9iaiApO1xuXHRcdHRoaXMucG9lbS5vbiggJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QgKSApO1xuXHR9LFxuXG5cdGtpbGwgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmRlYWQgPSB0cnVlO1xuXHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLmRhbWFnZS5leHBsb2RlKCk7XG5cdH0sXG5cblx0cmVzZXQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnBvc2l0aW9uLmNvcHkoIHRoaXMuc3Bhd25Qb2ludCApO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0aWYoIHRoaXMuZGVhZCApIHtcblx0XHRcblx0XHRcdHRoaXMuZGFtYWdlLnVwZGF0ZSggZSApO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5iYW5rICo9IDAuOTtcblx0XHRcdHRoaXMudGhydXN0ID0gMC4wMTtcblx0XHRcdHRoaXMuYmFuayArPSByYW5kb20ucmFuZ2UoLTAuMDEsIDAuMDEpO1xuXHRcdFxuXHRcdFx0dGhpcy5vYmplY3QuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcblx0XHRcblx0XHRcdHRoaXMudXBkYXRlRWRnZUF2b2lkYW5jZSggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZSApO1xuXHRcdFxuXHRcdH1cblxuXHR9LFxuXG5cdHVwZGF0ZUVkZ2VBdm9pZGFuY2UgOiBmdW5jdGlvbiggZSApIHtcblx0XG5cdFx0dmFyIG5lYXJFZGdlLCBmYXJFZGdlLCBwb3NpdGlvbiwgbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiwgYmFua0RpcmVjdGlvbiwgYWJzUG9zaXRpb247XG5cdFxuXHRcdGZhckVkZ2UgPSB0aGlzLnBvZW0uaGVpZ2h0IC8gMjtcblx0XHRuZWFyRWRnZSA9IDQgLyA1ICogZmFyRWRnZTtcblx0XHRwb3NpdGlvbiA9IHRoaXMub2JqZWN0LnBvc2l0aW9uLnk7XG5cdFx0YWJzUG9zaXRpb24gPSBNYXRoLmFicyggcG9zaXRpb24gKTtcblxuXHRcdHZhciByb3RhdGlvbiA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogLyBNYXRoLlBJO1xuXG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiAlPSAyICogTWF0aC5QSTtcblx0XG5cdFx0aWYoIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCAwICkge1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSAyICogTWF0aC5QSTtcblx0XHR9XG5cdFxuXHRcdGlmKCBNYXRoLmFicyggcG9zaXRpb24gKSA+IG5lYXJFZGdlICkge1xuXHRcdFxuXHRcdFx0dmFyIGlzUG9pbnRpbmdMZWZ0ID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiA+PSBNYXRoLlBJICogMC41ICYmIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCBNYXRoLlBJICogMS41O1xuXHRcdFxuXHRcdFx0aWYoIHBvc2l0aW9uID4gMCApIHtcblx0XHRcdFxuXHRcdFx0XHRpZiggaXNQb2ludGluZ0xlZnQgKSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IC0xO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiggaXNQb2ludGluZ0xlZnQgKSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IC0xO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XG5cdFx0XHRub3JtYWxpemVkRWRnZVBvc2l0aW9uID0gKGFic1Bvc2l0aW9uIC0gbmVhckVkZ2UpIC8gKGZhckVkZ2UgLSBuZWFyRWRnZSk7XG5cdFx0XHR0aGlzLnRocnVzdCArPSBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQ7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IGJhbmtEaXJlY3Rpb24gKiBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkO1xuXHRcdFxuXHRcdH1cblx0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XG5cdFxuXHR9LFxuXG5cdHVwZGF0ZVBvc2l0aW9uIDogZnVuY3Rpb24oIGUgKSB7XG5cdFxuXHRcdHZhciBtb3ZlbWVudCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XG5cdFx0XHR2YXIgdGhldGEsIHgsIHk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IHRoaXMuYmFuaztcblx0XHRcblx0XHRcdHRoZXRhID0gdGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XHRcblx0XHRcdHRoaXMuc3BlZWQgKj0gMC45ODtcblx0XHRcdHRoaXMuc3BlZWQgKz0gdGhpcy50aHJ1c3Q7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5taW4oIHRoaXMubWF4U3BlZWQsIHRoaXMuc3BlZWQgKTtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1heCggMCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0XHRcdFxuXHRcdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQgKiBNYXRoLmNvcyggdGhldGEgKTtcblx0XHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkICogTWF0aC5zaW4oIHRoZXRhICk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb3NpdGlvbi55O1xuXHRcdFxuXHRcdFx0Ly9Qb2xhciBjb29yZGluYXRlc1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueCA9IE1hdGguY29zKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdC8vIHRoaXMub2JqZWN0LnBvc2l0aW9uLnogPSBNYXRoLnNpbiggdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFxuXHRcdH07XG5cdFxuXHR9KClcdFxuXG5cbn07IiwibW9kdWxlLmV4cG9ydHM9cmVxdWlyZShcIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2VudGl0aWVzL0plbGx5U2hpcC5qc1wiKSIsInZhciBQb2VtID0gcmVxdWlyZSgnLi9Qb2VtJyk7XG52YXIgbGV2ZWxzID0gcmVxdWlyZSgnLi9sZXZlbHMnKTtcblxudmFyIGN1cnJlbnRMZXZlbCA9IG51bGw7XG52YXIgY3VycmVudFBvZW0gPSBudWxsO1xuXG53aW5kb3cubGV2ZWxMb2FkZXIgPSBmdW5jdGlvbiggbmFtZSApIHtcblxuXHRpZiggIV8uaXNPYmplY3QobGV2ZWxzW25hbWVdKSApIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0XG5cdGlmKGN1cnJlbnRQb2VtKSBjdXJyZW50UG9lbS5kZXN0cm95KCk7XG5cdFxuXHRjdXJyZW50TGV2ZWwgPSBsZXZlbHNbbmFtZV07XG5cdGN1cnJlbnRQb2VtID0gbmV3IFBvZW0oIGN1cnJlbnRMZXZlbCApO1xuXHR3aW5kb3cucG9lbSA9IGN1cnJlbnRQb2VtO1xuXHRcblx0cmV0dXJuIHRydWU7XG5cdFxufTtcblx0XG5tb2R1bGUuZXhwb3J0cyA9IGxldmVsTG9hZGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuXHRjb25maWcgOiB7XG5cdFx0c2NvcmluZ0FuZFdpbm5pbmc6IHtcblx0XHRcdG1lc3NhZ2U6IFwiTm8gamVsbGllcyBkZXRlY3RlZCB3aXRoaW4gNSBwYXJzZWNzLjxici8+IEZvbGxvdyBtZSBvbiA8YSBocmVmPSdodHRwczovL3R3aXR0ZXIuY29tL3RhdHVtY3JlYXRpdmUnPlR3aXR0ZXI8L2E+IGZvciB1cGRhdGVzIG9uIG5ldyBsZXZlbHMuXCIsXG5cdFx0XHRuZXh0TGV2ZWw6IFwidGl0bGVzXCIsXG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQvL0plbGx5IG1hbmFnZXIgaGFzIDAgbGl2ZSBzaGlwc1xuXHRcdFx0XHRcdGNvbXBvbmVudDogXCJqZWxseU1hbmFnZXJcIixcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiBudWxsXG5cdFx0XHRcdH1cdFx0XG5cdFx0XHRdXG5cdFx0fVxuXHR9LFxuXHRvYmplY3RzIDoge1xuXHRcdGFzdGVyb2lkRmllbGQgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9tYW5hZ2Vycy9Bc3Rlcm9pZEZpZWxkXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRjb3VudCA6IDIwXG5cdFx0XHR9IFxuXHRcdH0sXG5cdFx0amVsbHlNYW5hZ2VyIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vbWFuYWdlcnMvRW50aXR5TWFuYWdlclwiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0ZW50aXR5VHlwZTogcmVxdWlyZSgnLi4vZW50aXRpZXMvSmVsbHlzaGlwJyksXG5cdFx0XHRcdGNvdW50OiAyNVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0bXVzaWMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9zb3VuZC9NdXNpY1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0dXJsOiBcImh0dHBzOi8vc291bmRjbG91ZC5jb20vdGhlZWxlY3Ryb2NoaXBwZXJzL3RoZS1lbmQtb2Ytb3VyLWpvdXJuZXlcIlxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0YXN0ZXJvaWRzSmVsbGllcyA6IHJlcXVpcmUoXCIuL2FzdGVyb2lkc0plbGxpZXNcIiksXG5cdHRpdGxlcyA6IHJlcXVpcmUoXCIuL3RpdGxlc1wiKSxcblx0aW50cm8gOiByZXF1aXJlKFwiLi9pbnRyb1wiKVxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0Y29uZmlnIDoge1xuXHRcdHIgOiAxMjAsXG5cdFx0aGVpZ2h0IDogNjAsXG5cdFx0Y2lyY3VtZmVyZW5jZSA6IDkwMCxcblx0XHRjYW1lcmFNdWx0aXBsaWVyIDogMixcblx0XHRzY29yaW5nQW5kV2lubmluZzoge1xuXHRcdFx0bWVzc2FnZTogXCJZb3Ugc2F2ZWQgdGhpcyBzZWN0b3I8YnIvPm9uIHRvIHRoZSBuZXh0IGxldmVsLlwiLFxuXHRcdFx0bmV4dExldmVsOiBcImFzdGVyb2lkc0plbGxpZXNcIixcblx0XHRcdGNvbmRpdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdC8vSmVsbHkgbWFuYWdlciBoYXMgMCBsaXZlIHNoaXBzXG5cdFx0XHRcdFx0Y29tcG9uZW50OiBcImplbGx5TWFuYWdlclwiLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IG51bGxcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0c3RhcnM6IHtcblx0XHRcdGNvdW50OiAzMDAwXG5cdFx0fVxuXHR9LFxuXHRvYmplY3RzIDoge1xuXHRcdGN5bGluZGVyTGluZXMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9jb21wb25lbnRzL0N5bGluZGVyTGluZXNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fVxuXHRcdH0sXG5cdFx0Y2FtZXJhSW50cm8gOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9jb21wb25lbnRzL0NhbWVyYUludHJvXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRzcGVlZCA6IDAuOTg1XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRqZWxseU1hbmFnZXIgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRlbnRpdHlUeXBlOiByZXF1aXJlKCcuLi9lbnRpdGllcy9KZWxseXNoaXAnKSxcblx0XHRcdFx0Y291bnQ6IDVcblx0XHRcdH1cblx0XHR9LFxuXHRcdG11c2ljIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vc291bmQvTXVzaWNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHVybDogXCJodHRwczovL3NvdW5kY2xvdWQuY29tL3RoZWVsZWN0cm9jaGlwcGVycy90aGUtc3VuLWlzLXJpc2luZy1jaGlwLW11c2ljXCJcblx0XHRcdH1cblx0XHR9XG5cdH1cbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdGNvbmZpZyA6IHtcblx0XHRcblx0fSxcblx0b2JqZWN0cyA6IHtcblx0XHR0aXRsZXMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9jb21wb25lbnRzL1RpdGxlc1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHt9XG5cdFx0fSxcblx0XHRtdXNpYyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL3NvdW5kL011c2ljXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR1cmw6IFwiaHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS90aGVlbGVjdHJvY2hpcHBlcnMvY2hpcHR1bmUtc3BhY2VcIixcblx0XHRcdFx0c3RhcnRUaW1lOiAxMixcblx0XHRcdFx0dm9sdW1lOiAxXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59OyIsInZhciBBc3Rlcm9pZCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0FzdGVyb2lkJyk7XG5cbnZhciBBc3Rlcm9pZEZpZWxkID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmFzdGVyb2lkcyA9IFtdO1xuXHR0aGlzLm1heFJhZGl1cyA9IDUwO1xuXHR0aGlzLm9yaWdpbkNsZWFyYW5jZSA9IDMwO1xuXHR0aGlzLmNvdW50ID0gMjA7XG5cdFxuXHRfLmV4dGVuZCggdGhpcywgcHJvcGVydGllcyApIDtcblx0XG5cdHRoaXMuZ2VuZXJhdGUoIHRoaXMuY291bnQgKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xuXHR0aGlzLnBvZW0uZ3VuLnNldEJhcnJpZXJDb2xsaWRlciggdGhpcy5hc3Rlcm9pZHMgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXN0ZXJvaWRGaWVsZDtcblxuQXN0ZXJvaWRGaWVsZC5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZSA6IGZ1bmN0aW9uKCBjb3VudCApIHtcblx0XHRcblx0XHR2YXIgaSwgeCwgeSwgaGVpZ2h0LCB3aWR0aCwgcmFkaXVzO1xuXHRcdFxuXHRcdGhlaWdodCA9IHRoaXMucG9lbS5oZWlnaHQgKiA0O1xuXHRcdHdpZHRoID0gdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2U7XG5cdFx0XG5cdFx0Zm9yKCBpPTA7IGkgPCBjb3VudDsgaSsrICkge1xuXHRcdFx0XG5cdFx0XHRkbyB7XG5cdFx0XHRcdFxuXHRcdFx0XHR4ID0gTWF0aC5yYW5kb20oKSAqIHdpZHRoO1xuXHRcdFx0XHR5ID0gTWF0aC5yYW5kb20oKSAqIGhlaWdodCAtIChoZWlnaHQgLyAyKTtcblx0XHRcdFxuXHRcdFx0XHRyYWRpdXMgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5tYXhSYWRpdXM7XG5cdFx0XHRcdFxuXHRcdFx0fSB3aGlsZShcblx0XHRcdFx0dGhpcy5jaGVja0NvbGxpc2lvbiggeCwgeSwgcmFkaXVzICkgJiZcblx0XHRcdFx0dGhpcy5jaGVja0ZyZWVPZk9yaWdpbiggeCwgeSwgcmFkaXVzIClcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdHRoaXMuYXN0ZXJvaWRzLnB1c2goXG5cdFx0XHRcdG5ldyBBc3Rlcm9pZCggdGhpcy5wb2VtLCB4LCB5LCByYWRpdXMgKVxuXHRcdFx0KTtcblx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRfLmVhY2goIHRoaXMuYXN0ZXJvaWRzLCBmdW5jdGlvbihhc3Rlcm9pZCkge1xuXHRcdFx0XG5cdFx0XHRhc3Rlcm9pZC51cGRhdGUoIGUgKTtcblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcdFxuXHRcdGlmKCAhdGhpcy5wb2VtLnNoaXAuZGVhZCAmJiAhdGhpcy5wb2VtLnNoaXAuaW52dWxuZXJhYmxlICkge1xuXHRcdFx0dmFyIHNoaXBDb2xsaXNpb24gPSB0aGlzLmNoZWNrQ29sbGlzaW9uKFxuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5wb3NpdGlvbi54LFxuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5wb3NpdGlvbi55LFxuXHRcdFx0XHQyXG5cdFx0XHQpO1xuXHRcdFxuXHRcdFx0aWYoIHNoaXBDb2xsaXNpb24gKSB7XG5cdFx0XHRcdHRoaXMucG9lbS5zaGlwLmtpbGwoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRjaGVja0ZyZWVPZk9yaWdpbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0cmV0dXJuIE1hdGguc3FydCh4KnggKyB5KnkpID4gcmFkaXVzICsgdGhpcy5vcmlnaW5DbGVhcmFuY2U7XG5cdH0sXG5cdFxuXHRjaGVja0NvbGxpc2lvbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0XG5cdFx0dmFyIGNvbGxpc2lvbiA9IF8uZmluZCggdGhpcy5hc3Rlcm9pZHMsIGZ1bmN0aW9uKCBhc3Rlcm9pZCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGR4LCBkeSwgZGlzdGFuY2U7XG5cdFx0XHRcblx0XHRcdGR4ID0gdGhpcy5wb2VtLmNvb3JkaW5hdGVzLmNpcmN1bWZlcmVuY2VEaXN0YW5jZSggeCwgYXN0ZXJvaWQucG9zaXRpb24ueCApO1xuXHRcdFx0ZHkgPSB5IC0gYXN0ZXJvaWQucG9zaXRpb24ueTtcblx0XHRcdFxuXHRcdFx0ZGlzdGFuY2UgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXG5cdFx0XHRyZXR1cm4gZGlzdGFuY2UgPCByYWRpdXMgKyBhc3Rlcm9pZC5yYWRpdXM7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHRyZXR1cm4gISFjb2xsaXNpb247XG5cdH1cbn07IiwidmFyIENvbGxpZGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvQ29sbGlkZXInKTtcbnZhciBEZWZhdWx0SmVsbHlTaGlwID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvSmVsbHlTaGlwJyk7XG52YXIgRXZlbnREaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG5cbnZhciBFbnRpdHlNYW5hZ2VyID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmVudGl0eVR5cGUgPSBEZWZhdWx0SmVsbHlTaGlwO1xuXHR0aGlzLmNvdW50ID0gMjA7XG5cdHRoaXMuZW50aXRpZXMgPSBbXTtcblx0dGhpcy5saXZlRW50aXRpZXMgPSBbXTtcblx0dGhpcy5vcmlnaW5DbGVhcmFuY2UgPSAzMDA7XG5cdHRoaXMuc2hhcmVkID0ge307XG5cdHRoaXMud2luQ2hlY2sgPSBudWxsO1xuXHRcdFxuXHRfLmV4dGVuZCggdGhpcywgcHJvcGVydGllcyApO1xuXHRcblx0aWYoIF8uaXNGdW5jdGlvbiggdGhpcy5lbnRpdHlUeXBlLnByb3RvdHlwZS5pbml0U2hhcmVkQXNzZXRzICkgKSB7XG5cdFx0dGhpcy5lbnRpdHlUeXBlLnByb3RvdHlwZS5pbml0U2hhcmVkQXNzZXRzKCB0aGlzICk7XG5cdH1cblx0dGhpcy5nZW5lcmF0ZSggdGhpcy5jb3VudCApO1xuXHR0aGlzLmNvbmZpZ3VyZUNvbGxpZGVyKCk7XG5cblx0dGhpcy5ib3VuZFVwZGF0ZSA9IHRoaXMudXBkYXRlLmJpbmQodGhpcyk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMuYm91bmRVcGRhdGUgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW50aXR5TWFuYWdlcjtcblxuRW50aXR5TWFuYWdlci5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZSA6IGZ1bmN0aW9uKCBjb3VudCApIHtcblx0XHRcblx0XHR2YXIgaSwgeCwgeSwgaGVpZ2h0LCB3aWR0aCwgZW50aXR5O1xuXHRcdFxuXHRcdGhlaWdodCA9IHRoaXMucG9lbS5oZWlnaHQgKiA0O1xuXHRcdHdpZHRoID0gdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2U7XG5cdFx0XG5cdFx0Zm9yKCBpPTA7IGkgPCBjb3VudDsgaSsrICkge1xuXHRcdFx0XG5cdFx0XHR4ID0gTWF0aC5yYW5kb20oKSAqIHdpZHRoO1xuXHRcdFx0eSA9IE1hdGgucmFuZG9tKCkgKiBoZWlnaHQgLSAoaGVpZ2h0IC8gMik7XG5cdFx0XHRcblx0XHRcdGVudGl0eSA9IG5ldyB0aGlzLmVudGl0eVR5cGUoIHRoaXMucG9lbSwgdGhpcywgeCwgeSApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmVudGl0aWVzLnB1c2goIGVudGl0eSApO1xuXHRcdFx0dGhpcy5saXZlRW50aXRpZXMucHVzaCggZW50aXR5ICk7XG5cdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHRoaXMucG9lbS5zY29yaW5nQW5kV2lubmluZy5hZGp1c3RFbmVtaWVzKCBjb3VudCApO1xuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dGhpcy5kaXNwYXRjaCggZSApO1xuXHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0a2lsbEVudGl0eSA6IGZ1bmN0aW9uKCBlbnRpdHkgKSB7XG5cdFx0XG5cdFx0dmFyIGkgPSB0aGlzLmxpdmVFbnRpdGllcy5pbmRleE9mKCBlbnRpdHkgKTtcblx0XHRcblx0XHRpZiggaSA+PSAwICkge1xuXHRcdFx0dGhpcy5saXZlRW50aXRpZXMuc3BsaWNlKCBpLCAxICk7XG5cdFx0fVxuXHRcdFxuXHRcdGVudGl0eS5raWxsKCk7XG5cdFx0XG5cdFx0aWYoIHRoaXMud2luQ2hlY2sgJiYgdGhpcy5saXZlRW50aXRpZXMubGVuZ3RoID09PSAwICkge1xuXHRcdFx0dGhpcy53aW5DaGVjay5yZXBvcnRDb25kaXRpb25Db21wbGV0ZWQoKTtcblx0XHRcdHRoaXMud2luQ2hlY2sgPSBudWxsO1xuXHRcdH1cblx0fSxcblx0XG5cdGNvbmZpZ3VyZUNvbGxpZGVyIDogZnVuY3Rpb24oKSB7XG5cdFx0bmV3IENvbGxpZGVyKFxuXHRcdFx0XG5cdFx0XHR0aGlzLnBvZW0sXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5saXZlRW50aXRpZXM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wb2VtLmd1bi5saXZlQnVsbGV0cztcblx0XHRcdH0uYmluZCh0aGlzKSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oZW50aXR5LCBidWxsZXQpIHtcblx0XHRcdFx0XG5cdFx0XHRcdHRoaXMua2lsbEVudGl0eSggZW50aXR5ICk7XG5cdFx0XHRcdHRoaXMucG9lbS5ndW4ua2lsbEJ1bGxldCggYnVsbGV0ICk7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0U2NvcmUoXG5cdFx0XHRcdFx0ZW50aXR5LnNjb3JlVmFsdWUsXG5cdFx0XHRcdFx0XCIrXCIgKyBlbnRpdHkuc2NvcmVWYWx1ZSArIFwiIFwiICsgZW50aXR5Lm5hbWUsIFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFwiY29sb3JcIiA6IGVudGl0eS5jc3NDb2xvclxuXHRcdFx0XHRcdH1cblx0XHRcdFx0KTtcblx0XHRcdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdEVuZW1pZXMoIC0xICk7XG5cdFx0XHRcdFxuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHRcdFxuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUVudGl0aWVzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLnBvZW0uc2hpcF07XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGVudGl0eSwgYnVsbGV0KSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggIXRoaXMucG9lbS5zaGlwLmRlYWQgJiYgIXRoaXMucG9lbS5zaGlwLmludnVsbmVyYWJsZSApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLmtpbGxFbnRpdHkoIGVudGl0eSApO1xuXHRcdFx0XHRcdHRoaXMucG9lbS5zaGlwLmtpbGwoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0RW5lbWllcyggLTEgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0XG5cdFx0XHR9LmJpbmQodGhpcylcblx0XHRcdFxuXHRcdCk7XG5cdFx0XG5cdH0sXG5cdFxuXHR3YXRjaEZvckNvbXBsZXRpb24gOiBmdW5jdGlvbiggd2luQ2hlY2ssIHByb3BlcnRpZXMgKSB7XG5cdFx0dGhpcy53aW5DaGVjayA9IHdpbkNoZWNrO1xuXHR9XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBFbnRpdHlNYW5hZ2VyLnByb3RvdHlwZSApOyIsInZhciBCdWxsZXQgPSByZXF1aXJlKCcuLi9lbnRpdGllcy9CdWxsZXQnKTtcbnZhciBDb2xsaWRlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0NvbGxpZGVyJyk7XG52YXIgU291bmRHZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9zb3VuZC9Tb3VuZEdlbmVyYXRvcicpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcbnZhciBHdW4gPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLnNvdW5kID0gbnVsbDtcblx0XG5cdHRoaXMuY291bnQgPSAzNTA7XG5cdHRoaXMuYnVsbGV0QWdlID0gNTAwMDtcblx0dGhpcy5maXJlRGVsYXlNaWxsaXNlY29uZHMgPSAxMDA7XG5cdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSB0aGlzLnBvZW0uY2xvY2sudGltZTtcblx0dGhpcy5saXZlQnVsbGV0cyA9IFtdO1xuXHR0aGlzLmJ1bGxldHMgPSBbXTtcblx0dGhpcy5ib3JuQXQgPSAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuYWRkU291bmQoKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHdW47XG5cbkd1bi5wcm90b3R5cGUgPSB7XG5cdFxuXHRmaXJlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGlzRGVhZCA9IGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRyZXR1cm4gIWJ1bGxldC5hbGl2ZTtcblx0XHR9O1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbih4LCB5LCBzcGVlZCwgdGhldGEpIHtcblx0XHRcdFxuXHRcdFx0dmFyIG5vdyA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHRcdFx0XG5cdFx0XHRpZiggbm93IC0gdGhpcy5sYXN0RmlyZVRpbWVzdGFtcCA8IHRoaXMuZmlyZURlbGF5TWlsbGlzZWNvbmRzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSBub3c7XG5cdFx0XG5cdFx0XHR2YXIgYnVsbGV0ID0gXy5maW5kKCB0aGlzLmJ1bGxldHMsIGlzRGVhZCApO1xuXHRcdFxuXHRcdFx0aWYoICFidWxsZXQgKSByZXR1cm47XG5cdFx0XG5cdFx0XHR0aGlzLmxpdmVCdWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFxuXHRcdFx0YnVsbGV0LmZpcmUoeCwgeSwgc3BlZWQsIHRoZXRhKTtcblxuXG5cdFx0XHR2YXIgZnJlcSA9IDE5MDA7XG5cdFx0XHRcblx0XHRcdC8vU3RhcnQgc291bmRcblx0XHRcdHRoaXMuc291bmQuc2V0R2FpbigwLjEsIDAsIDAuMDAxKTtcblx0XHRcdHRoaXMuc291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFx0XG5cblx0XHRcdC8vRW5kIHNvdW5kXG5cdFx0XHR0aGlzLnNvdW5kLnNldEdhaW4oMCwgMC4wMSwgMC4wNSk7XG5cdFx0XHR0aGlzLnNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogMC4xLCAwLjAxLCAwLjA1KTtcblx0XHRcdFxuXHRcdH07XG5cdH0oKSxcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgdmVydGV4LCBidWxsZXQ7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0Zm9yKHZhciBpPTA7IGkgPCB0aGlzLmNvdW50OyBpKyspIHtcblx0XHRcdFxuXHRcdFx0dmVydGV4ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRcdGJ1bGxldCA9IG5ldyBCdWxsZXQoIHRoaXMucG9lbSwgdGhpcywgdmVydGV4ICk7XG5cdFx0XHRcblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIHZlcnRleCApO1xuXHRcdFx0dGhpcy5idWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFx0XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdFx0XHRcdFxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdH0sXG5cdFxuXHRraWxsQnVsbGV0IDogZnVuY3Rpb24oIGJ1bGxldCApIHtcblx0XHRcblx0XHR2YXIgaSA9IHRoaXMubGl2ZUJ1bGxldHMuaW5kZXhPZiggYnVsbGV0ICk7XG5cdFx0XG5cdFx0aWYoIGkgPj0gMCApIHtcblx0XHRcdHRoaXMubGl2ZUJ1bGxldHMuc3BsaWNlKCBpLCAxICk7XG5cdFx0fVxuXHRcdFxuXHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XG5cdFx0aWYoIHRoaXMub2JqZWN0ICkgdGhpcy5vYmplY3QuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcblx0XHRcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAxICogdGhpcy5wb2VtLnJhdGlvLFxuXHRcdFx0XHQgY29sb3I6IDB4ZmYwMDAwXG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5vYmplY3QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdHRoaXMucG9lbS5vbignZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApICB7XG5cdFx0dmFyIGJ1bGxldCwgdGltZTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaTx0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWxsZXQgPSB0aGlzLmxpdmVCdWxsZXRzW2ldO1xuXHRcdFx0XG5cdFx0XHRpZihidWxsZXQuYm9ybkF0ICsgdGhpcy5idWxsZXRBZ2UgPCBlLnRpbWUpIHtcblx0XHRcdFx0dGhpcy5raWxsQnVsbGV0KCBidWxsZXQgKTtcblx0XHRcdFx0aS0tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVsbGV0LnVwZGF0ZSggZS5kdCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZih0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0c2V0QmFycmllckNvbGxpZGVyIDogZnVuY3Rpb24oIGNvbGxlY3Rpb24gKSB7XG5cdFx0XG5cdFx0Ly9Db2xsaWRlIGJ1bGxldHMgd2l0aCBhc3Rlcm9pZHNcblx0XHRuZXcgQ29sbGlkZXIoXG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb2xsZWN0aW9uO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGJhcnJpZXIsIGJ1bGxldCkge1xuXHRcdFx0XHR0aGlzLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLnNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNxdWFyZVwiICksXG5cdFx0XHRzb3VuZC5tYWtlR2FpbigpLFxuXHRcdFx0c291bmQuZ2V0RGVzdGluYXRpb24oKVxuXHRcdF0pO1xuXHRcdFxuXHRcdHNvdW5kLnNldEdhaW4oMCwwLDApO1xuXHRcdHNvdW5kLnN0YXJ0KCk7XG5cdFx0XG5cdH1cbn07IiwidmFyIGNyb3Nzcm9hZHMgPSByZXF1aXJlKCdjcm9zc3JvYWRzJyk7XG52YXIgaGFzaGVyID0gcmVxdWlyZSgnaGFzaGVyJyk7XG52YXIgbGV2ZWxMb2FkZXIgPSByZXF1aXJlKCcuL2xldmVsTG9hZGVyJyk7XG5cbnZhciBiYXNlVXJsID0gJy9wb2xhcic7XG52YXIgZGVmYXVsdExldmVsID0gXCJ0aXRsZXNcIjtcbnZhciBjdXJyZW50TGV2ZWwgPSBcIlwiO1xuXG5jcm9zc3JvYWRzLmFkZFJvdXRlKCAnLycsIGZ1bmN0aW9uIHNob3dNYWluVGl0bGVzKCkge1xuXHRcblx0X2dhcS5wdXNoKCBbICdfdHJhY2tQYWdldmlldycsIGJhc2VVcmwgXSApO1xuXHRcblx0bGV2ZWxMb2FkZXIoIGRlZmF1bHRMZXZlbCApO1xuXHRcbn0pO1xuXG5jcm9zc3JvYWRzLmFkZFJvdXRlKCAnbGV2ZWwve25hbWV9JywgZnVuY3Rpb24gbG9hZFVwQUxldmVsKCBsZXZlbE5hbWUgKSB7XG5cdFxuXHRfZ2FxLnB1c2goIFsgJ190cmFja1BhZ2V2aWV3JywgYmFzZVVybCsnLyNsZXZlbC8nK2xldmVsTmFtZSBdICk7XG5cdFxuXHR2YXIgbGV2ZWxGb3VuZCA9IGxldmVsTG9hZGVyKCBsZXZlbE5hbWUgKTtcblx0XG5cdGlmKCAhbGV2ZWxGb3VuZCApIHtcblx0XHRsZXZlbExvYWRlciggZGVmYXVsdExldmVsICk7XG5cdH1cblx0XG59KTtcblxuY3Jvc3Nyb2Fkcy5hZGRSb3V0ZSggLy4qLywgZnVuY3Rpb24gcmVSb3V0ZVRvTWFpblRpdGxlc0lmTm9NYXRjaCgpIHtcblx0XG5cdGhhc2hlci5yZXBsYWNlSGFzaCgnJyk7XG5cdFxufSk7XG5cbiQoZnVuY3Rpb24gc3RhcnRXYXRjaGluZ1JvdXRlcygpIHtcblx0XG5cdGZ1bmN0aW9uIHBhcnNlSGFzaChuZXdIYXNoLCBvbGRIYXNoKXtcblx0XHRjcm9zc3JvYWRzLnBhcnNlKG5ld0hhc2gpO1xuXHR9XG5cdFxuXHRoYXNoZXIuaW5pdGlhbGl6ZWQuYWRkKHBhcnNlSGFzaCk7IC8vIHBhcnNlIGluaXRpYWwgaGFzaFxuXHRoYXNoZXIuY2hhbmdlZC5hZGQocGFyc2VIYXNoKTsgLy9wYXJzZSBoYXNoIGNoYW5nZXNcblx0XG5cdGhhc2hlci5pbml0KCk7IC8vc3RhcnQgbGlzdGVuaW5nIGZvciBoaXN0b3J5IGNoYW5nZVxuXHRcbn0pOyIsInZhciBzb3VuZGNsb3VkID0gcmVxdWlyZSgnc291bmRjbG91ZC1iYWRnZScpO1xudmFyIG11dGVyID0gcmVxdWlyZSgnLi9tdXRlcicpO1xuXG52YXIgc291bmRPZmYgPSBmYWxzZTtcblxudmFyIGF1ZGlvID0gbnVsbDtcbnZhciBmZXRjaEFuZFBsYXlTb25nID0gbnVsbDtcbnZhciB0aW1lc0NhbGxlZFNvdW5kY2xvdWQgPSAwO1xuXG52YXIgTXVzaWMgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblxuXHRmZXRjaEFuZFBsYXlTb25nID0gZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGN1cnJlbnRUaW1lID0gKyt0aW1lc0NhbGxlZFNvdW5kY2xvdWQ7XG5cdFx0XG5cdFx0c291bmRjbG91ZCh7XG5cdFx0XHRcblx0XHRcdGNsaWVudF9pZDogJzYwNTdjOWFmODYyYmYyNDVkNGM0MDIxNzllMzE3ZjUyJyxcblx0XHRcdHNvbmc6IHByb3BlcnRpZXMudXJsLFxuXHRcdFx0ZGFyazogZmFsc2UsXG5cdFx0XHRnZXRGb250czogZmFsc2Vcblx0XHRcdFxuXHRcdH0sIGZ1bmN0aW9uKGVyciwgc3JjLCBkYXRhLCBkaXYpIHtcblx0XHRcdFxuXHRcdFx0Ly9OdWxsaWZ5IGNhbGxiYWNrcyB0aGF0IGFyZSBvdXQgb2Ygb3JkZXJcblx0XHRcdGlmKCBjdXJyZW50VGltZSAhPT0gdGltZXNDYWxsZWRTb3VuZGNsb3VkICkgcmV0dXJuO1xuXG5cdFx0XHRpZiggZXJyICkgdGhyb3cgZXJyO1xuXG5cdFx0XHRhdWRpbyA9IG5ldyBBdWRpbygpO1xuXHRcdFx0YXVkaW8uc3JjID0gc3JjO1xuXHRcdFx0YXVkaW8ucGxheSgpO1xuXHRcdFx0YXVkaW8ubG9vcCA9IHRydWU7XG5cdFx0XHRhdWRpby52b2x1bWUgPSBwcm9wZXJ0aWVzLnZvbHVtZSB8fCAwLjY7XG5cdFx0XG5cdFx0XHQkKGF1ZGlvKS5vbignbG9hZGVkbWV0YWRhdGEnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYoIGF1ZGlvIClcdGF1ZGlvLmN1cnJlbnRUaW1lID0gcHJvcGVydGllcy5zdGFydFRpbWUgfHwgMDtcblx0XHRcdH0pO1xuXHRcdFxuXG5cdFx0fSk7XG5cdFxuXHRcdHBvZW0ub24oJ2Rlc3Ryb3knLCBmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0aWYoYXVkaW8pIHtcblx0XHRcdFx0YXVkaW8ucGF1c2UoKTtcblx0XHRcdFx0YXVkaW8gPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQkKCcubnBtLXNjYi13aGl0ZScpLnJlbW92ZSgpO1xuXHRcdFx0XG5cdFx0fSk7XG5cdFx0XG5cdH07XG5cdFxuXHRpZiggIW11dGVyLm11dGVkICkge1xuXHRcdFxuXHRcdGZldGNoQW5kUGxheVNvbmcoKVxuXHRcdGZldGNoQW5kUGxheVNvbmcgPSBudWxsO1xuXHRcdFxuXHR9XG5cdFxufTtcblxuTXVzaWMucHJvdG90eXBlLm11dGVkID0gZmFsc2U7XG5cbm11dGVyLm9uKCdtdXRlJywgZnVuY3Rpb24gbXV0ZU11c2ljKCBlICkge1xuXG5cdGlmKCBhdWRpbyApIGF1ZGlvLnBhdXNlKCk7XG5cdFxuXHQkKCcubnBtLXNjYi13aGl0ZScpLmhpZGUoKTtcblxufSk7XG5cbm11dGVyLm9uKCd1bm11dGUnLCBmdW5jdGlvbiB1bm11dGVNdXNpYyggZSApIHtcblxuXHRpZiggYXVkaW8gKSBhdWRpby5wbGF5KCk7XG5cblx0aWYoIGZldGNoQW5kUGxheVNvbmcgKSB7XG5cdFx0ZmV0Y2hBbmRQbGF5U29uZygpO1xuXHRcdGZldGNoQW5kUGxheVNvbmcgPSBudWxsO1xuXHR9XG5cdFxuXHQkKCcubnBtLXNjYi13aGl0ZScpLnNob3coKTtcblx0XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE11c2ljOyIsInZhciBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xudmFyIGNvbnRleHQgPSB3aW5kb3cuQXVkaW9Db250ZXh0IHx8IHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQgfHwgbnVsbDtcbnZhciBtdXRlciA9IHJlcXVpcmUoJy4vbXV0ZXInKTtcblxudmFyIFNvdW5kR2VuZXJhdG9yID0gZnVuY3Rpb24oKSB7XG5cdFxuXHR0aGlzLmVuYWJsZWQgPSBjb250ZXh0ICE9PSB1bmRlZmluZWQ7XG5cdFxuXHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFxuXHR0aGlzLmxhc3RHYWluVmFsdWUgPSBudWxsO1xuXHRcblx0dGhpcy50b3RhbENyZWF0ZWQrKztcblx0dGhpcy50b3RhbENyZWF0ZWRTcSA9IHRoaXMudG90YWxDcmVhdGVkICogdGhpcy50b3RhbENyZWF0ZWQ7XG5cdFxuXHRtdXRlci5vbignbXV0ZScsIHRoaXMuaGFuZGxlTXV0ZS5iaW5kKHRoaXMpKTtcblx0bXV0ZXIub24oJ3VubXV0ZScsIHRoaXMuaGFuZGxlVW5NdXRlLmJpbmQodGhpcykpO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU291bmRHZW5lcmF0b3I7XG5cblNvdW5kR2VuZXJhdG9yLnByb3RvdHlwZSA9IHtcblx0XG5cdGhhbmRsZU11dGUgOiBmdW5jdGlvbigpIHtcblx0XHRpZiggdGhpcy5nYWluICkge1xuXHRcdFx0dGhpcy5nYWluLmdhaW4udmFsdWUgPSAwO1xuXHRcdH1cblx0fSxcblx0XG5cdGhhbmRsZVVuTXV0ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdGlmKCB0aGlzLmdhaW4gJiYgXy5pc051bWJlciggdGhpcy5sYXN0R2FpblZhbHVlICkgKSB7XG5cdFx0XHR0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IHRoaXMubGFzdEdhaW5WYWx1ZTtcblx0XHR9XG5cdH0sXG5cdFxuXHRjb250ZXh0IDogY29udGV4dCA/IG5ldyBjb250ZXh0KCkgOiB1bmRlZmluZWQsXG5cdFxuXHRtYWtlUGlua05vaXNlIDogZnVuY3Rpb24oIGJ1ZmZlclNpemUgKSB7XG5cdFxuXHRcdHZhciBiMCwgYjEsIGIyLCBiMywgYjQsIGI1LCBiNiwgbm9kZTsgXG5cdFx0XG5cdFx0YjAgPSBiMSA9IGIyID0gYjMgPSBiNCA9IGI1ID0gYjYgPSAwLjA7XG5cdFx0bm9kZSA9IHRoaXMucGlua05vaXNlID0gdGhpcy5jb250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihidWZmZXJTaXplLCAxLCAxKTtcblx0XHRcblx0XHRub2RlLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZSkge1xuXHRcdFx0XG5cdFx0XHQvLyBodHRwOi8vbm9pc2VoYWNrLmNvbS9nZW5lcmF0ZS1ub2lzZS13ZWItYXVkaW8tYXBpL1xuXHRcdFx0dmFyIG91dHB1dCA9IGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuXHRcdFx0XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlclNpemU7IGkrKykge1xuXHRcdFx0XHR2YXIgd2hpdGUgPSBNYXRoLnJhbmRvbSgpICogMiAtIDE7XG5cdFx0XHRcdGIwID0gMC45OTg4NiAqIGIwICsgd2hpdGUgKiAwLjA1NTUxNzk7XG5cdFx0XHRcdGIxID0gMC45OTMzMiAqIGIxICsgd2hpdGUgKiAwLjA3NTA3NTk7XG5cdFx0XHRcdGIyID0gMC45NjkwMCAqIGIyICsgd2hpdGUgKiAwLjE1Mzg1MjA7XG5cdFx0XHRcdGIzID0gMC44NjY1MCAqIGIzICsgd2hpdGUgKiAwLjMxMDQ4NTY7XG5cdFx0XHRcdGI0ID0gMC41NTAwMCAqIGI0ICsgd2hpdGUgKiAwLjUzMjk1MjI7XG5cdFx0XHRcdGI1ID0gLTAuNzYxNiAqIGI1IC0gd2hpdGUgKiAwLjAxNjg5ODA7XG5cdFx0XHRcdG91dHB1dFtpXSA9IGIwICsgYjEgKyBiMiArIGIzICsgYjQgKyBiNSArIGI2ICsgd2hpdGUgKiAwLjUzNjI7XG5cdFx0XHRcdG91dHB1dFtpXSAqPSAwLjExOyAvLyAocm91Z2hseSkgY29tcGVuc2F0ZSBmb3IgZ2FpblxuXHRcdFx0XHRiNiA9IHdoaXRlICogMC4xMTU5MjY7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblx0XG5cdH0sXG5cdFxuXHRtYWtlT3NjaWxsYXRvciA6IGZ1bmN0aW9uKCB0eXBlLCBmcmVxdWVuY3kgKSB7XG5cdFx0Lypcblx0XHRcdGVudW0gT3NjaWxsYXRvclR5cGUge1xuXHRcdFx0ICBcInNpbmVcIixcblx0XHRcdCAgXCJzcXVhcmVcIixcblx0XHRcdCAgXCJzYXd0b290aFwiLFxuXHRcdFx0ICBcInRyaWFuZ2xlXCIsXG5cdFx0XHQgIFwiY3VzdG9tXCJcblx0XHRcdH1cblx0XHQqL1xuXHRcdFxuXHRcdHZhciBub2RlID0gdGhpcy5vc2NpbGxhdG9yID0gdGhpcy5jb250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKTtcblx0XHRcblx0XHRub2RlLnR5cGUgPSB0eXBlIHx8IFwic2F3dG9vdGhcIjtcblx0XHRub2RlLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXF1ZW5jeSB8fCAyMDAwO1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXHR9LFxuXHRcblx0bWFrZUdhaW4gOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbm9kZSA9IHRoaXMuZ2FpbiA9IHRoaXMuY29udGV4dC5jcmVhdGVHYWluKCk7XG5cdFx0XG5cdFx0bm9kZS5nYWluLnZhbHVlID0gMDtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0XG5cdG1ha2VQYW5uZXIgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLmNvbnRleHQubGlzdGVuZXIuc2V0UG9zaXRpb24oMCwgMCwgMCk7XG5cdFx0XG5cdFx0dmFyIG5vZGUgPSB0aGlzLnBhbm5lciA9IHRoaXMuY29udGV4dC5jcmVhdGVQYW5uZXIoKTtcblx0XHRcblx0XHRub2RlLnBhbm5pbmdNb2RlbCA9ICdlcXVhbHBvd2VyJztcblx0XHRub2RlLmNvbmVPdXRlckdhaW4gPSAwLjE7XG5cdFx0bm9kZS5jb25lT3V0ZXJBbmdsZSA9IDE4MDtcblx0XHRub2RlLmNvbmVJbm5lckFuZ2xlID0gMDtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0XG5cdG1ha2VCYW5kcGFzcyA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIG5vZGUgPSB0aGlzLmJhbmRwYXNzID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuXHRcdFxuXHRcdG5vZGUudHlwZSA9IFwiYmFuZHBhc3NcIjtcblx0XHRub2RlLmZyZXF1ZW5jeS52YWx1ZSA9IDQ0MDtcblx0XHRub2RlLlEudmFsdWUgPSAwLjU7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cblx0fSxcblx0XG5cdGdldERlc3RpbmF0aW9uIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbjtcblx0fSxcblx0XG5cdGNvbm5lY3ROb2RlcyA6IGZ1bmN0aW9uKCBub2RlcyApIHtcblx0XHRfLmVhY2goIF8ucmVzdCggbm9kZXMgKSwgZnVuY3Rpb24obm9kZSwgaSwgbGlzdCkge1xuXHRcdFx0dmFyIHByZXZOb2RlID0gbm9kZXNbaV07XG5cdFx0XHRcblx0XHRcdHByZXZOb2RlLmNvbm5lY3QoIG5vZGUgKTtcblx0XHR9KTtcblx0fSxcblx0XG5cdHN0YXJ0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5vc2NpbGxhdG9yLnN0YXJ0KDApO1xuXHR9LFxuXHRcblx0dG90YWxDcmVhdGVkIDogMCxcblx0XG5cdHNldEZyZXF1ZW5jeSA6IGZ1bmN0aW9uICggZnJlcXVlbmN5LCBkZWxheSwgc3BlZWQgKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdFxuXHRcdHRoaXMub3NjaWxsYXRvci5mcmVxdWVuY3kuc2V0VGFyZ2V0QXRUaW1lKGZyZXF1ZW5jeSwgdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lICsgZGVsYXksIHNwZWVkKTtcblx0fSxcblx0XG5cdHNldFBvc2l0aW9uIDogZnVuY3Rpb24gKCB4LCB5LCB6ICkge1xuXHRcdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XHR0aGlzLnBhbm5lci5zZXRQb3NpdGlvbiggeCwgeSwgeiApO1xuXHR9LFxuXHRcblx0c2V0R2FpbiA6IGZ1bmN0aW9uICggZ2FpbiwgZGVsYXksIHNwZWVkICkge1xuXHRcdFxuXHRcdHRoaXMubGFzdEdhaW5WYWx1ZSA9IGdhaW47XG5cdFx0XG5cdFx0aWYoICF0aGlzLmVuYWJsZWQgfHwgbXV0ZXIubXV0ZWQgKSByZXR1cm47XG5cdFx0Ly8gTWF0aC5tYXgoIE1hdGguYWJzKCBnYWluICksIDEpO1xuXHRcdC8vIGdhaW4gLyB0aGlzLnRvdGFsQ3JlYXRlZFNxO1xuXHRcdFx0XHRcblx0XHR0aGlzLmdhaW4uZ2Fpbi5zZXRUYXJnZXRBdFRpbWUoXG5cdFx0XHRnYWluLFxuXHRcdFx0dGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lICsgZGVsYXksXG5cdFx0XHRzcGVlZFxuXHRcdCk7XG5cdH0sXG5cdFxuXHRzZXRCYW5kcGFzc1EgOiBmdW5jdGlvbiAoIFEgKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdHRoaXMuYmFuZHBhc3MuUS5zZXRUYXJnZXRBdFRpbWUoUSwgdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lLCAwLjEpO1xuXHR9LFxuXHRcblx0c2V0QmFuZHBhc3NGcmVxdWVuY3kgOiBmdW5jdGlvbiAoIGZyZXF1ZW5jeSApIHtcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0dGhpcy5iYW5kcGFzcy5mcmVxdWVuY3kuc2V0VGFyZ2V0QXRUaW1lKGZyZXF1ZW5jeSwgdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lLCAwLjEpO1xuXHR9XG59OyIsInZhciBFdmVudERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi91dGlscy9FdmVudERpc3BhdGNoZXInKTtcblxudmFyIE11dGVyID0gZnVuY3Rpb24oKSB7XG5cdHRoaXMubXV0ZWQgPSBmYWxzZTtcbn07XG5cbkV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuYXBwbHkoIE11dGVyLnByb3RvdHlwZSApO1xuXG52YXIgbXV0ZXIgPSBuZXcgTXV0ZXIoKTtcblxuJCh3aW5kb3cpLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gbXV0ZUF1ZGlvT25IaXR0aW5nUyggZSApIHtcblx0XG5cdGlmKCBlLmtleUNvZGUgIT09IDgzICkgcmV0dXJuO1xuXHRcblx0bXV0ZXIubXV0ZWQgPSAhbXV0ZXIubXV0ZWQ7XG5cdFxuXHRpZiggbXV0ZXIubXV0ZWQgKSB7XG5cdFx0XG5cdFx0bXV0ZXIuZGlzcGF0Y2goe1xuXHRcdFx0dHlwZTogJ211dGUnXG5cdFx0fSk7XG5cdFx0XG5cdH0gZWxzZSB7XG5cdFx0XG5cdFx0bXV0ZXIuZGlzcGF0Y2goe1xuXHRcdFx0dHlwZTogJ3VubXV0ZSdcblx0XHR9KTtcblx0XHRcblx0fVxuXHRcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG11dGVyO1xuIiwidmFyIENsb2NrID0gZnVuY3Rpb24oIGF1dG9zdGFydCApIHtcblxuXHR0aGlzLm1heER0ID0gNjA7XG5cdHRoaXMubWluRHQgPSAxNjtcblx0dGhpcy5wVGltZSA9IDA7XG5cdHRoaXMudGltZSA9IDA7XG5cdFxuXHRpZihhdXRvc3RhcnQgIT09IGZhbHNlKSB7XG5cdFx0dGhpcy5zdGFydCgpO1xuXHR9XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbG9jaztcblxuQ2xvY2sucHJvdG90eXBlID0ge1xuXG5cdHN0YXJ0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wVGltZSA9IERhdGUubm93KCk7XG5cdH0sXG5cdFxuXHRnZXREZWx0YSA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBub3csIGR0O1xuXHRcdFxuXHRcdG5vdyA9IERhdGUubm93KCk7XG5cdFx0ZHQgPSBub3cgLSB0aGlzLnBUaW1lO1xuXHRcdFxuXHRcdGR0ID0gTWF0aC5taW4oIGR0LCB0aGlzLm1heER0ICk7XG5cdFx0ZHQgPSBNYXRoLm1heCggZHQsIHRoaXMubWluRHQgKTtcblx0XHRcblx0XHR0aGlzLnRpbWUgKz0gZHQ7XG5cdFx0dGhpcy5wVGltZSA9IG5vdztcblx0XHRcblx0XHRyZXR1cm4gZHQ7XG5cdH1cblx0XG59OyIsInZhciBfID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xuXG52YXIgQ29sbGlkZXIgPSBmdW5jdGlvbiggcG9lbSwgZ2V0Q29sbGVjdGlvbkEsIGdldENvbGxlY3Rpb25CLCBvbkNvbGxpc2lvbiApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLmdldENvbGxlY3Rpb25BID0gZ2V0Q29sbGVjdGlvbkE7XG5cdHRoaXMuZ2V0Q29sbGVjdGlvbkIgPSBnZXRDb2xsZWN0aW9uQjtcblx0dGhpcy5vbkNvbGxpc2lvbiA9IG9uQ29sbGlzaW9uO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbGxpZGVyO1xuXG5Db2xsaWRlci5wcm90b3R5cGUgPSB7XG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblxuXHRcdHZhciBjb2xsaXNpb25zID0gW107XG5cblx0XHRfLmVhY2goIHRoaXMuZ2V0Q29sbGVjdGlvbkEoKSwgZnVuY3Rpb24oIGl0ZW1Gcm9tQSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGNvbGxpZGVkSXRlbUZyb21CID0gXy5maW5kKCB0aGlzLmdldENvbGxlY3Rpb25CKCksIGZ1bmN0aW9uKCBpdGVtRnJvbUIgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcblx0XHRcdFx0dmFyIGR4LCBkeSwgZGlzdGFuY2U7XG5cdFx0XHRcblx0XHRcdFx0ZHggPSB0aGlzLnBvZW0uY29vcmRpbmF0ZXMuY2lyY3VtZmVyZW5jZURpc3RhbmNlKCBpdGVtRnJvbUEucG9zaXRpb24ueCwgaXRlbUZyb21CLnBvc2l0aW9uLnggKTtcblx0XHRcdFx0ZHkgPSBpdGVtRnJvbUEucG9zaXRpb24ueSAtIGl0ZW1Gcm9tQi5wb3NpdGlvbi55O1xuXHRcdFx0XG5cdFx0XHRcdGRpc3RhbmNlID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcblx0XHRcdFx0XG5cdFx0XHRcblx0XHRcdFx0cmV0dXJuIGRpc3RhbmNlIDwgaXRlbUZyb21BLnJhZGl1cyArIGl0ZW1Gcm9tQi5yYWRpdXM7XG5cdFx0XHRcdFxuXHRcdFx0fSwgdGhpcyk7XG5cdFx0XHRcblx0XHRcdFxuXHRcdFx0aWYoIGNvbGxpZGVkSXRlbUZyb21CICkge1xuXHRcdFx0XHRjb2xsaXNpb25zLnB1c2goW2l0ZW1Gcm9tQSwgY29sbGlkZWRJdGVtRnJvbUJdKTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcdFxuXHRcdF8uZWFjaCggY29sbGlzaW9ucywgZnVuY3Rpb24oIGl0ZW1zICkge1xuXHRcdFx0dGhpcy5vbkNvbGxpc2lvbiggaXRlbXNbMF0sIGl0ZW1zWzFdICk7XG5cdFx0fSwgdGhpcyk7XG5cdH1cblx0XG59OyIsIi8vIFRyYW5zbGF0ZXMgMmQgcG9pbnRzIGludG8gM2QgcG9sYXIgc3BhY2VcblxudmFyIENvb3JkaW5hdGVzID0gZnVuY3Rpb24oIHBvZW0gKSB7XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMudHdvUlNxdWFyZWQgPSAyICogKHRoaXMucG9lbS5yICogdGhpcy5wb2VtLnIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb29yZGluYXRlcztcblxuQ29vcmRpbmF0ZXMucHJvdG90eXBlID0ge1xuXHRcblx0eCA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiBNYXRoLnNpbiggeCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW8gKSAqIHRoaXMucG9lbS5yO1xuXHR9LFxuXHRcblx0eSA6IGZ1bmN0aW9uKCB5ICkge1xuXHRcdHJldHVybiB5O1xuXHR9LFxuXHRcblx0eiA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiBNYXRoLmNvcyggeCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW8gKSAqIHRoaXMucG9lbS5yO1xuXHR9LFxuXHRcblx0ciA6IGZ1bmN0aW9uKHgsIHopIHtcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KHgqeCArIHoqeik7XG5cdH0sXG5cdFxuXHR0aGV0YSA6IGZ1bmN0aW9uKHgsIHopIHtcblx0XHRyZXR1cm4gTWF0aC5hdGFuKCB6IC8geCApO1xuXHR9LFxuXHRcblx0c2V0VmVjdG9yIDogZnVuY3Rpb24oIHZlY3RvciApIHtcblx0XHRcblx0XHR2YXIgeCwgeSwgdmVjdG9yMjtcblx0XHRcblx0XHRpZiggdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gXCJudW1iZXJcIiApIHtcblx0XHRcdFxuXHRcdFx0eCA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdHkgPSBhcmd1bWVudHNbMl07XG5cdFx0XHRcblx0XHRcdHJldHVybiB2ZWN0b3Iuc2V0KFxuXHRcdFx0XHR0aGlzLngoeCksXG5cdFx0XHRcdHksXG5cdFx0XHRcdHRoaXMueih4KVxuXHRcdFx0KTtcblx0XHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRcblx0XHRcdHZlY3RvcjIgPSBhcmd1bWVudHNbMV07XG5cdFx0XHRcblx0XHRcdHJldHVybiB2ZWN0b3Iuc2V0KFxuXHRcdFx0XHR0aGlzLngodmVjdG9yMi54KSxcblx0XHRcdFx0dmVjdG9yMi55LFxuXHRcdFx0XHR0aGlzLnoodmVjdG9yMi54KVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRnZXRWZWN0b3IgOiBmdW5jdGlvbiggeCwgeSApIHtcblx0XHRcblx0XHR2YXIgdmVjdG9yID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRyZXR1cm4gdGhpcy5zZXRWZWN0b3IoIHZlY3RvciwgeCwgeSApO1xuXHRcdFxuXHR9LFxuXHRcblx0a2VlcEluUmFuZ2VYIDogZnVuY3Rpb24oIHggKSB7XG5cdFx0aWYoIHggPj0gMCApIHtcblx0XHRcdHJldHVybiB4ICUgdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB4ICsgKHggJSB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZSk7XG5cdFx0fVxuXHR9LFxuXHRcblx0a2VlcEluUmFuZ2VZIDogZnVuY3Rpb24oIHkgKSB7XG5cdFx0aWYoIHkgPj0gMCApIHtcblx0XHRcdHJldHVybiB5ICUgdGhpcy5wb2VtLmhlaWdodDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHkgKyAoeSAlIHRoaXMucG9lbS5oZWlnaHQpO1xuXHRcdH1cblx0fSxcblx0XG5cdGtlZXBJblJhbmdlIDogZnVuY3Rpb24oIHZlY3RvciApIHtcblx0XHR2ZWN0b3IueCA9IHRoaXMua2VlcEluUmFuZ2VYKCB2ZWN0b3IueCApO1xuXHRcdHZlY3Rvci55ID0gdGhpcy5rZWVwSW5SYW5nZVgoIHZlY3Rvci55ICk7XG5cdFx0cmV0dXJuIHZlY3Rvcjtcblx0fSxcblx0XG5cdHR3b1hUb1RoZXRhIDogZnVuY3Rpb24oIHggKSB7XG5cdFx0cmV0dXJuIHggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHR9LFxuXHRcblx0Y2lyY3VtZmVyZW5jZURpc3RhbmNlIDogZnVuY3Rpb24gKHgxLCB4Mikge1xuXHRcdFxuXHRcdHZhciByYXRpbyA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdFx0XG5cdFx0cmV0dXJuIHRoaXMudHdvUlNxdWFyZWQgLSB0aGlzLnR3b1JTcXVhcmVkICogTWF0aC5jb3MoIHgxICogcmF0aW8gLSB4MiAqIHJhdGlvICk7XG5cdFx0XG5cdH1cblx0XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIG1yZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICpcbiAqIE1vZGlmaWNhdGlvbnM6IEdyZWcgVGF0dW1cbiAqXG4gKiB1c2FnZTpcbiAqIFxuICogXHRcdEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuYXBwbHkoIE15T2JqZWN0LnByb3RvdHlwZSApO1xuICogXG4gKiBcdFx0TXlPYmplY3QuZGlzcGF0Y2goe1xuICogXHRcdFx0dHlwZTogXCJjbGlja1wiLFxuICogXHRcdFx0ZGF0dW0xOiBcImZvb1wiLFxuICogXHRcdFx0ZGF0dW0yOiBcImJhclwiXG4gKiBcdFx0fSk7XG4gKiBcbiAqIFx0XHRNeU9iamVjdC5vbiggXCJjbGlja1wiLCBmdW5jdGlvbiggZXZlbnQgKSB7XG4gKiBcdFx0XHRldmVudC5kYXR1bTE7IC8vRm9vXG4gKiBcdFx0XHRldmVudC50YXJnZXQ7IC8vTXlPYmplY3RcbiAqIFx0XHR9KTtcbiAqIFxuICpcbiAqL1xuXG52YXIgRXZlbnREaXNwYXRjaGVyID0gZnVuY3Rpb24gKCkge307XG5cbkV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUgPSB7XG5cblx0Y29uc3RydWN0b3I6IEV2ZW50RGlzcGF0Y2hlcixcblxuXHRhcHBseTogZnVuY3Rpb24gKCBvYmplY3QgKSB7XG5cblx0XHRvYmplY3Qub25cdFx0XHRcdFx0PSBFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLm9uO1xuXHRcdG9iamVjdC5oYXNFdmVudExpc3RlbmVyXHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5oYXNFdmVudExpc3RlbmVyO1xuXHRcdG9iamVjdC5vZmZcdFx0XHRcdFx0PSBFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLm9mZjtcblx0XHRvYmplY3QuZGlzcGF0Y2hcdFx0XHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5kaXNwYXRjaDtcblxuXHR9LFxuXG5cdG9uOiBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG5cdFx0aWYgKCB0aGlzLl9saXN0ZW5lcnMgPT09IHVuZGVmaW5lZCApIHRoaXMuX2xpc3RlbmVycyA9IHt9O1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblxuXHRcdGlmICggbGlzdGVuZXJzWyB0eXBlIF0gPT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0bGlzdGVuZXJzWyB0eXBlIF0gPSBbXTtcblxuXHRcdH1cblxuXHRcdGlmICggbGlzdGVuZXJzWyB0eXBlIF0uaW5kZXhPZiggbGlzdGVuZXIgKSA9PT0gLSAxICkge1xuXG5cdFx0XHRsaXN0ZW5lcnNbIHR5cGUgXS5wdXNoKCBsaXN0ZW5lciApO1xuXG5cdFx0fVxuXG5cdH0sXG5cblx0aGFzRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSByZXR1cm4gZmFsc2U7XG5cblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXG5cdFx0aWYgKCBsaXN0ZW5lcnNbIHR5cGUgXSAhPT0gdW5kZWZpbmVkICYmIGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICkgIT09IC0gMSApIHtcblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cblx0fSxcblxuXHRvZmY6IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblx0XHR2YXIgbGlzdGVuZXJBcnJheSA9IGxpc3RlbmVyc1sgdHlwZSBdO1xuXG5cdFx0aWYgKCBsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdHZhciBpbmRleCA9IGxpc3RlbmVyQXJyYXkuaW5kZXhPZiggbGlzdGVuZXIgKTtcblxuXHRcdFx0aWYgKCBpbmRleCAhPT0gLSAxICkge1xuXG5cdFx0XHRcdGxpc3RlbmVyQXJyYXkuc3BsaWNlKCBpbmRleCwgMSApO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0fSxcblxuXHRkaXNwYXRjaDogZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSByZXR1cm47XG5cblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXHRcdHZhciBsaXN0ZW5lckFycmF5ID0gbGlzdGVuZXJzWyBldmVudC50eXBlIF07XG5cblx0XHRpZiAoIGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0ZXZlbnQudGFyZ2V0ID0gdGhpcztcblxuXHRcdFx0dmFyIGFycmF5ID0gW107XG5cdFx0XHR2YXIgbGVuZ3RoID0gbGlzdGVuZXJBcnJheS5sZW5ndGg7XG5cdFx0XHR2YXIgaTtcblxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0YXJyYXlbIGkgXSA9IGxpc3RlbmVyQXJyYXlbIGkgXTtcblxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKCBpID0gMDsgaSA8IGxlbmd0aDsgaSArKyApIHtcblxuXHRcdFx0XHRhcnJheVsgaSBdLmNhbGwoIHRoaXMsIGV2ZW50ICk7XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHR9XG5cbn07XG5cbmlmICggdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgKSB7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBFdmVudERpc3BhdGNoZXI7XG5cbn0iLCIvKipcbiAqIEBhdXRob3IgbXJkb29iIC8gaHR0cDovL21yZG9vYi5jb20vXG4gKi9cblxudmFyIFN0YXRzID0gZnVuY3Rpb24gKCkge1xuXG5cdHZhciBzdGFydFRpbWUgPSBEYXRlLm5vdygpLCBwcmV2VGltZSA9IHN0YXJ0VGltZTtcblx0dmFyIG1zID0gMCwgbXNNaW4gPSBJbmZpbml0eSwgbXNNYXggPSAwO1xuXHR2YXIgZnBzID0gMCwgZnBzTWluID0gSW5maW5pdHksIGZwc01heCA9IDA7XG5cdHZhciBmcmFtZXMgPSAwLCBtb2RlID0gMDtcblxuXHR2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0Y29udGFpbmVyLmlkID0gJ3N0YXRzJztcblx0Y29udGFpbmVyLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBmdW5jdGlvbiAoIGV2ZW50ICkgeyBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyBzZXRNb2RlKCArKyBtb2RlICUgMiApOyB9LCBmYWxzZSApO1xuXHRjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9ICd3aWR0aDo4MHB4O29wYWNpdHk6MC45O2N1cnNvcjpwb2ludGVyJztcblxuXHR2YXIgZnBzRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ZnBzRGl2LmlkID0gJ2Zwcyc7XG5cdGZwc0Rpdi5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6MCAwIDNweCAzcHg7dGV4dC1hbGlnbjpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzAwMic7XG5cdGNvbnRhaW5lci5hcHBlbmRDaGlsZCggZnBzRGl2ICk7XG5cblx0dmFyIGZwc1RleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRmcHNUZXh0LmlkID0gJ2Zwc1RleHQnO1xuXHRmcHNUZXh0LnN0eWxlLmNzc1RleHQgPSAnY29sb3I6IzBmZjtmb250LWZhbWlseTpIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtmb250LXNpemU6OXB4O2ZvbnQtd2VpZ2h0OmJvbGQ7bGluZS1oZWlnaHQ6MTVweCc7XG5cdGZwc1RleHQuaW5uZXJIVE1MID0gJ0ZQUyc7XG5cdGZwc0Rpdi5hcHBlbmRDaGlsZCggZnBzVGV4dCApO1xuXG5cdHZhciBmcHNHcmFwaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGZwc0dyYXBoLmlkID0gJ2Zwc0dyYXBoJztcblx0ZnBzR3JhcGguc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDo3NHB4O2hlaWdodDozMHB4O2JhY2tncm91bmQtY29sb3I6IzBmZic7XG5cdGZwc0Rpdi5hcHBlbmRDaGlsZCggZnBzR3JhcGggKTtcblxuXHR3aGlsZSAoIGZwc0dyYXBoLmNoaWxkcmVuLmxlbmd0aCA8IDc0ICkge1xuXG5cdFx0dmFyIGJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdGJhci5zdHlsZS5jc3NUZXh0ID0gJ3dpZHRoOjFweDtoZWlnaHQ6MzBweDtmbG9hdDpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzExMyc7XG5cdFx0ZnBzR3JhcGguYXBwZW5kQ2hpbGQoIGJhciApO1xuXG5cdH1cblxuXHR2YXIgbXNEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRtc0Rpdi5pZCA9ICdtcyc7XG5cdG1zRGl2LnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzowIDAgM3B4IDNweDt0ZXh0LWFsaWduOmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMDIwO2Rpc3BsYXk6bm9uZSc7XG5cdGNvbnRhaW5lci5hcHBlbmRDaGlsZCggbXNEaXYgKTtcblxuXHR2YXIgbXNUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNUZXh0LmlkID0gJ21zVGV4dCc7XG5cdG1zVGV4dC5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOiMwZjA7Zm9udC1mYW1pbHk6SGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWY7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDpib2xkO2xpbmUtaGVpZ2h0OjE1cHgnO1xuXHRtc1RleHQuaW5uZXJIVE1MID0gJ01TJztcblx0bXNEaXYuYXBwZW5kQ2hpbGQoIG1zVGV4dCApO1xuXG5cdHZhciBtc0dyYXBoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNHcmFwaC5pZCA9ICdtc0dyYXBoJztcblx0bXNHcmFwaC5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOjc0cHg7aGVpZ2h0OjMwcHg7YmFja2dyb3VuZC1jb2xvcjojMGYwJztcblx0bXNEaXYuYXBwZW5kQ2hpbGQoIG1zR3JhcGggKTtcblxuXHR3aGlsZSAoIG1zR3JhcGguY2hpbGRyZW4ubGVuZ3RoIDwgNzQgKSB7XG5cblx0XHR2YXIgYmFyMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdGJhcjIuc3R5bGUuY3NzVGV4dCA9ICd3aWR0aDoxcHg7aGVpZ2h0OjMwcHg7ZmxvYXQ6bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMxMzEnO1xuXHRcdG1zR3JhcGguYXBwZW5kQ2hpbGQoIGJhcjIgKTtcblxuXHR9XG5cblx0dmFyIHNldE1vZGUgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0bW9kZSA9IHZhbHVlO1xuXG5cdFx0c3dpdGNoICggbW9kZSApIHtcblxuXHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRmcHNEaXYuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdG1zRGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRmcHNEaXYuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdFx0bXNEaXYuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHR9O1xuXG5cdHZhciB1cGRhdGVHcmFwaCA9IGZ1bmN0aW9uICggZG9tLCB2YWx1ZSApIHtcblxuXHRcdHZhciBjaGlsZCA9IGRvbS5hcHBlbmRDaGlsZCggZG9tLmZpcnN0Q2hpbGQgKTtcblx0XHRjaGlsZC5zdHlsZS5oZWlnaHQgPSB2YWx1ZSArICdweCc7XG5cblx0fTtcblxuXHRyZXR1cm4ge1xuXG5cdFx0UkVWSVNJT046IDEyLFxuXG5cdFx0ZG9tRWxlbWVudDogY29udGFpbmVyLFxuXG5cdFx0c2V0TW9kZTogc2V0TW9kZSxcblxuXHRcdGJlZ2luOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cblx0XHR9LFxuXG5cdFx0ZW5kOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHZhciB0aW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdFx0bXMgPSB0aW1lIC0gc3RhcnRUaW1lO1xuXHRcdFx0bXNNaW4gPSBNYXRoLm1pbiggbXNNaW4sIG1zICk7XG5cdFx0XHRtc01heCA9IE1hdGgubWF4KCBtc01heCwgbXMgKTtcblxuXHRcdFx0bXNUZXh0LnRleHRDb250ZW50ID0gbXMgKyAnIE1TICgnICsgbXNNaW4gKyAnLScgKyBtc01heCArICcpJztcblx0XHRcdHVwZGF0ZUdyYXBoKCBtc0dyYXBoLCBNYXRoLm1pbiggMzAsIDMwIC0gKCBtcyAvIDIwMCApICogMzAgKSApO1xuXG5cdFx0XHRmcmFtZXMgKys7XG5cblx0XHRcdGlmICggdGltZSA+IHByZXZUaW1lICsgMTAwMCApIHtcblxuXHRcdFx0XHRmcHMgPSBNYXRoLnJvdW5kKCAoIGZyYW1lcyAqIDEwMDAgKSAvICggdGltZSAtIHByZXZUaW1lICkgKTtcblx0XHRcdFx0ZnBzTWluID0gTWF0aC5taW4oIGZwc01pbiwgZnBzICk7XG5cdFx0XHRcdGZwc01heCA9IE1hdGgubWF4KCBmcHNNYXgsIGZwcyApO1xuXG5cdFx0XHRcdGZwc1RleHQudGV4dENvbnRlbnQgPSBmcHMgKyAnIEZQUyAoJyArIGZwc01pbiArICctJyArIGZwc01heCArICcpJztcblx0XHRcdFx0dXBkYXRlR3JhcGgoIGZwc0dyYXBoLCBNYXRoLm1pbiggMzAsIDMwIC0gKCBmcHMgLyAxMDAgKSAqIDMwICkgKTtcblxuXHRcdFx0XHRwcmV2VGltZSA9IHRpbWU7XG5cdFx0XHRcdGZyYW1lcyA9IDA7XG5cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRpbWU7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHN0YXJ0VGltZSA9IHRoaXMuZW5kKCk7XG5cblx0XHR9XG5cblx0fTtcblxufTtcblxuaWYgKCB0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyApIHtcblxuXHRtb2R1bGUuZXhwb3J0cyA9IFN0YXRzO1xuXG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZXN0cm95TWVzaCggb2JqICkge1xuXHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0aWYoIG9iai5nZW9tZXRyeSApIG9iai5nZW9tZXRyeS5kaXNwb3NlKCk7XG5cdFx0aWYoIG9iai5tYXRlcmlhbCApIG9iai5tYXRlcmlhbC5kaXNwb3NlKCk7XG5cdH07XG59IiwidmFyIHJhbmRvbSA9IHtcblx0XG5cdGZsaXAgOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gTWF0aC5yYW5kb20oKSA+IDAuNSA/IHRydWU6IGZhbHNlO1xuXHR9LFxuXHRcblx0cmFuZ2UgOiBmdW5jdGlvbihtaW4sIG1heCkge1xuXHRcdHJldHVybiBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikgKyBtaW47XG5cdH0sXG5cdFxuXHRyYW5nZUludCA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0cmV0dXJuIE1hdGguZmxvb3IoIHRoaXMucmFuZ2UobWluLCBtYXggKyAxKSApO1xuXHR9LFxuXHRcblx0cmFuZ2VMb3cgOiBmdW5jdGlvbihtaW4sIG1heCkge1xuXHRcdC8vTW9yZSBsaWtlbHkgdG8gcmV0dXJuIGEgbG93IHZhbHVlXG5cdCAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbikgKyBtaW47XG5cdH0sXG5cdFxuXHRyYW5nZUhpZ2ggOiBmdW5jdGlvbihtaW4sIG1heCkge1xuXHRcdC8vTW9yZSBsaWtlbHkgdG8gcmV0dXJuIGEgaGlnaCB2YWx1ZVxuXHRcdHJldHVybiAoMSAtIE1hdGgucmFuZG9tKCkgKiBNYXRoLnJhbmRvbSgpKSAqIChtYXggLSBtaW4pICsgbWluO1xuXHR9XG5cdCBcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZG9tO1xuIixudWxsLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJZiBvYmouaGFzT3duUHJvcGVydHkgaGFzIGJlZW4gb3ZlcnJpZGRlbiwgdGhlbiBjYWxsaW5nXG4vLyBvYmouaGFzT3duUHJvcGVydHkocHJvcCkgd2lsbCBicmVhay5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2pveWVudC9ub2RlL2lzc3Vlcy8xNzA3XG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHFzLCBzZXAsIGVxLCBvcHRpb25zKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICB2YXIgb2JqID0ge307XG5cbiAgaWYgKHR5cGVvZiBxcyAhPT0gJ3N0cmluZycgfHwgcXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIHZhciByZWdleHAgPSAvXFwrL2c7XG4gIHFzID0gcXMuc3BsaXQoc2VwKTtcblxuICB2YXIgbWF4S2V5cyA9IDEwMDA7XG4gIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLm1heEtleXMgPT09ICdudW1iZXInKSB7XG4gICAgbWF4S2V5cyA9IG9wdGlvbnMubWF4S2V5cztcbiAgfVxuXG4gIHZhciBsZW4gPSBxcy5sZW5ndGg7XG4gIC8vIG1heEtleXMgPD0gMCBtZWFucyB0aGF0IHdlIHNob3VsZCBub3QgbGltaXQga2V5cyBjb3VudFxuICBpZiAobWF4S2V5cyA+IDAgJiYgbGVuID4gbWF4S2V5cykge1xuICAgIGxlbiA9IG1heEtleXM7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgdmFyIHggPSBxc1tpXS5yZXBsYWNlKHJlZ2V4cCwgJyUyMCcpLFxuICAgICAgICBpZHggPSB4LmluZGV4T2YoZXEpLFxuICAgICAgICBrc3RyLCB2c3RyLCBrLCB2O1xuXG4gICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICBrc3RyID0geC5zdWJzdHIoMCwgaWR4KTtcbiAgICAgIHZzdHIgPSB4LnN1YnN0cihpZHggKyAxKTtcbiAgICB9IGVsc2Uge1xuICAgICAga3N0ciA9IHg7XG4gICAgICB2c3RyID0gJyc7XG4gICAgfVxuXG4gICAgayA9IGRlY29kZVVSSUNvbXBvbmVudChrc3RyKTtcbiAgICB2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHZzdHIpO1xuXG4gICAgaWYgKCFoYXNPd25Qcm9wZXJ0eShvYmosIGspKSB7XG4gICAgICBvYmpba10gPSB2O1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICBvYmpba10ucHVzaCh2KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb2JqW2tdID0gW29ialtrXSwgdl07XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG9iajtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ2lmeVByaW1pdGl2ZSA9IGZ1bmN0aW9uKHYpIHtcbiAgc3dpdGNoICh0eXBlb2Ygdikge1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gdjtcblxuICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgcmV0dXJuIHYgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiBpc0Zpbml0ZSh2KSA/IHYgOiAnJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJyc7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob2JqLCBzZXAsIGVxLCBuYW1lKSB7XG4gIHNlcCA9IHNlcCB8fCAnJic7XG4gIGVxID0gZXEgfHwgJz0nO1xuICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgb2JqID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG1hcChvYmplY3RLZXlzKG9iaiksIGZ1bmN0aW9uKGspIHtcbiAgICAgIHZhciBrcyA9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUoaykpICsgZXE7XG4gICAgICBpZiAoaXNBcnJheShvYmpba10pKSB7XG4gICAgICAgIHJldHVybiBtYXAob2JqW2tdLCBmdW5jdGlvbih2KSB7XG4gICAgICAgICAgcmV0dXJuIGtzICsgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZSh2KSk7XG4gICAgICAgIH0pLmpvaW4oc2VwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqW2tdKSk7XG4gICAgICB9XG4gICAgfSkuam9pbihzZXApO1xuXG4gIH1cblxuICBpZiAoIW5hbWUpIHJldHVybiAnJztcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUobmFtZSkpICsgZXEgK1xuICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ2lmeVByaW1pdGl2ZShvYmopKTtcbn07XG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoeHMpIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4cykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuXG5mdW5jdGlvbiBtYXAgKHhzLCBmKSB7XG4gIGlmICh4cy5tYXApIHJldHVybiB4cy5tYXAoZik7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIHJlcy5wdXNoKGYoeHNbaV0sIGkpKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgb2JqZWN0S2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuZGVjb2RlID0gZXhwb3J0cy5wYXJzZSA9IHJlcXVpcmUoJy4vZGVjb2RlJyk7XG5leHBvcnRzLmVuY29kZSA9IGV4cG9ydHMuc3RyaW5naWZ5ID0gcmVxdWlyZSgnLi9lbmNvZGUnKTtcbiIsIi8qKiBAbGljZW5zZVxuICogY3Jvc3Nyb2FkcyA8aHR0cDovL21pbGxlcm1lZGVpcm9zLmdpdGh1Yi5jb20vY3Jvc3Nyb2Fkcy5qcy8+XG4gKiBBdXRob3I6IE1pbGxlciBNZWRlaXJvcyB8IE1JVCBMaWNlbnNlXG4gKiB2MC4xMi4wICgyMDEzLzAxLzIxIDEzOjQ3KVxuICovXG5cbihmdW5jdGlvbiAoKSB7XG52YXIgZmFjdG9yeSA9IGZ1bmN0aW9uIChzaWduYWxzKSB7XG5cbiAgICB2YXIgY3Jvc3Nyb2FkcyxcbiAgICAgICAgX2hhc09wdGlvbmFsR3JvdXBCdWcsXG4gICAgICAgIFVOREVGO1xuXG4gICAgLy8gSGVscGVycyAtLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIElFIDctOCBjYXB0dXJlIG9wdGlvbmFsIGdyb3VwcyBhcyBlbXB0eSBzdHJpbmdzIHdoaWxlIG90aGVyIGJyb3dzZXJzXG4gICAgLy8gY2FwdHVyZSBhcyBgdW5kZWZpbmVkYFxuICAgIF9oYXNPcHRpb25hbEdyb3VwQnVnID0gKC90KC4rKT8vKS5leGVjKCd0JylbMV0gPT09ICcnO1xuXG4gICAgZnVuY3Rpb24gYXJyYXlJbmRleE9mKGFyciwgdmFsKSB7XG4gICAgICAgIGlmIChhcnIuaW5kZXhPZikge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKHZhbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL0FycmF5LmluZGV4T2YgZG9lc24ndCB3b3JrIG9uIElFIDYtN1xuICAgICAgICAgICAgdmFyIG4gPSBhcnIubGVuZ3RoO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIGlmIChhcnJbbl0gPT09IHZhbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcnJheVJlbW92ZShhcnIsIGl0ZW0pIHtcbiAgICAgICAgdmFyIGkgPSBhcnJheUluZGV4T2YoYXJyLCBpdGVtKTtcbiAgICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgICAgICBhcnIuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNLaW5kKHZhbCwga2luZCkge1xuICAgICAgICByZXR1cm4gJ1tvYmplY3QgJysga2luZCArJ10nID09PSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1JlZ0V4cCh2YWwpIHtcbiAgICAgICAgcmV0dXJuIGlzS2luZCh2YWwsICdSZWdFeHAnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0FycmF5KHZhbCkge1xuICAgICAgICByZXR1cm4gaXNLaW5kKHZhbCwgJ0FycmF5Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbih2YWwpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgLy9ib3Jyb3dlZCBmcm9tIEFNRC11dGlsc1xuICAgIGZ1bmN0aW9uIHR5cGVjYXN0VmFsdWUodmFsKSB7XG4gICAgICAgIHZhciByO1xuICAgICAgICBpZiAodmFsID09PSBudWxsIHx8IHZhbCA9PT0gJ251bGwnKSB7XG4gICAgICAgICAgICByID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgciA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICByID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSBVTkRFRiB8fCB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByID0gVU5ERUY7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSAnJyB8fCBpc05hTih2YWwpKSB7XG4gICAgICAgICAgICAvL2lzTmFOKCcnKSByZXR1cm5zIGZhbHNlXG4gICAgICAgICAgICByID0gdmFsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9wYXJzZUZsb2F0KG51bGwgfHwgJycpIHJldHVybnMgTmFOXG4gICAgICAgICAgICByID0gcGFyc2VGbG9hdCh2YWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHR5cGVjYXN0QXJyYXlWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgIHZhciBuID0gdmFsdWVzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICByZXN1bHRbbl0gPSB0eXBlY2FzdFZhbHVlKHZhbHVlc1tuXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvL2JvcnJvd2VkIGZyb20gQU1ELVV0aWxzXG4gICAgZnVuY3Rpb24gZGVjb2RlUXVlcnlTdHJpbmcoc3RyLCBzaG91bGRUeXBlY2FzdCkge1xuICAgICAgICB2YXIgcXVlcnlBcnIgPSAoc3RyIHx8ICcnKS5yZXBsYWNlKCc/JywgJycpLnNwbGl0KCcmJyksXG4gICAgICAgICAgICBuID0gcXVlcnlBcnIubGVuZ3RoLFxuICAgICAgICAgICAgb2JqID0ge30sXG4gICAgICAgICAgICBpdGVtLCB2YWw7XG4gICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgIGl0ZW0gPSBxdWVyeUFycltuXS5zcGxpdCgnPScpO1xuICAgICAgICAgICAgdmFsID0gc2hvdWxkVHlwZWNhc3QgPyB0eXBlY2FzdFZhbHVlKGl0ZW1bMV0pIDogaXRlbVsxXTtcbiAgICAgICAgICAgIG9ialtpdGVtWzBdXSA9ICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJyk/IGRlY29kZVVSSUNvbXBvbmVudCh2YWwpIDogdmFsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG5cbiAgICAvLyBDcm9zc3JvYWRzIC0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gQ3Jvc3Nyb2FkcygpIHtcbiAgICAgICAgdGhpcy5ieXBhc3NlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICB0aGlzLnJvdXRlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICB0aGlzLl9yb3V0ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlJvdXRlcyA9IFtdO1xuICAgICAgICB0aGlzLl9waXBlZCA9IFtdO1xuICAgICAgICB0aGlzLnJlc2V0U3RhdGUoKTtcbiAgICB9XG5cbiAgICBDcm9zc3JvYWRzLnByb3RvdHlwZSA9IHtcblxuICAgICAgICBncmVlZHkgOiBmYWxzZSxcblxuICAgICAgICBncmVlZHlFbmFibGVkIDogdHJ1ZSxcblxuICAgICAgICBpZ25vcmVDYXNlIDogdHJ1ZSxcblxuICAgICAgICBpZ25vcmVTdGF0ZSA6IGZhbHNlLFxuXG4gICAgICAgIHNob3VsZFR5cGVjYXN0IDogZmFsc2UsXG5cbiAgICAgICAgbm9ybWFsaXplRm4gOiBudWxsLFxuXG4gICAgICAgIHJlc2V0U3RhdGUgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlJvdXRlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5fcHJldk1hdGNoZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3ByZXZCeXBhc3NlZFJlcXVlc3QgPSBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIGNyZWF0ZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQ3Jvc3Nyb2FkcygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFkZFJvdXRlIDogZnVuY3Rpb24gKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSkge1xuICAgICAgICAgICAgdmFyIHJvdXRlID0gbmV3IFJvdXRlKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9zb3J0ZWRJbnNlcnQocm91dGUpO1xuICAgICAgICAgICAgcmV0dXJuIHJvdXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlbW92ZVJvdXRlIDogZnVuY3Rpb24gKHJvdXRlKSB7XG4gICAgICAgICAgICBhcnJheVJlbW92ZSh0aGlzLl9yb3V0ZXMsIHJvdXRlKTtcbiAgICAgICAgICAgIHJvdXRlLl9kZXN0cm95KCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcmVtb3ZlQWxsUm91dGVzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLmdldE51bVJvdXRlcygpO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JvdXRlc1tuXS5fZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcm91dGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyc2UgOiBmdW5jdGlvbiAocmVxdWVzdCwgZGVmYXVsdEFyZ3MpIHtcbiAgICAgICAgICAgIHJlcXVlc3QgPSByZXF1ZXN0IHx8ICcnO1xuICAgICAgICAgICAgZGVmYXVsdEFyZ3MgPSBkZWZhdWx0QXJncyB8fCBbXTtcblxuICAgICAgICAgICAgLy8gc2hvdWxkIG9ubHkgY2FyZSBhYm91dCBkaWZmZXJlbnQgcmVxdWVzdHMgaWYgaWdub3JlU3RhdGUgaXNuJ3QgdHJ1ZVxuICAgICAgICAgICAgaWYgKCAhdGhpcy5pZ25vcmVTdGF0ZSAmJlxuICAgICAgICAgICAgICAgIChyZXF1ZXN0ID09PSB0aGlzLl9wcmV2TWF0Y2hlZFJlcXVlc3QgfHxcbiAgICAgICAgICAgICAgICAgcmVxdWVzdCA9PT0gdGhpcy5fcHJldkJ5cGFzc2VkUmVxdWVzdCkgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcm91dGVzID0gdGhpcy5fZ2V0TWF0Y2hlZFJvdXRlcyhyZXF1ZXN0KSxcbiAgICAgICAgICAgICAgICBpID0gMCxcbiAgICAgICAgICAgICAgICBuID0gcm91dGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG5cbiAgICAgICAgICAgIGlmIChuKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldk1hdGNoZWRSZXF1ZXN0ID0gcmVxdWVzdDtcblxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeVByZXZSb3V0ZXMocm91dGVzLCByZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmV2Um91dGVzID0gcm91dGVzO1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGJlIGluY3JlbWVudGFsIGxvb3AsIGV4ZWN1dGUgcm91dGVzIGluIG9yZGVyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBuKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ciA9IHJvdXRlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY3VyLnJvdXRlLm1hdGNoZWQuZGlzcGF0Y2guYXBwbHkoY3VyLnJvdXRlLm1hdGNoZWQsIGRlZmF1bHRBcmdzLmNvbmNhdChjdXIucGFyYW1zKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1ci5pc0ZpcnN0ID0gIWk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucm91dGVkLmRpc3BhdGNoLmFwcGx5KHRoaXMucm91dGVkLCBkZWZhdWx0QXJncy5jb25jYXQoW3JlcXVlc3QsIGN1cl0pKTtcbiAgICAgICAgICAgICAgICAgICAgaSArPSAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldkJ5cGFzc2VkUmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgdGhpcy5ieXBhc3NlZC5kaXNwYXRjaC5hcHBseSh0aGlzLmJ5cGFzc2VkLCBkZWZhdWx0QXJncy5jb25jYXQoW3JlcXVlc3RdKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3BpcGVQYXJzZShyZXF1ZXN0LCBkZWZhdWx0QXJncyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX25vdGlmeVByZXZSb3V0ZXMgOiBmdW5jdGlvbihtYXRjaGVkUm91dGVzLCByZXF1ZXN0KSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIHByZXY7XG4gICAgICAgICAgICB3aGlsZSAocHJldiA9IHRoaXMuX3ByZXZSb3V0ZXNbaSsrXSkge1xuICAgICAgICAgICAgICAgIC8vY2hlY2sgaWYgc3dpdGNoZWQgZXhpc3Qgc2luY2Ugcm91dGUgbWF5IGJlIGRpc3Bvc2VkXG4gICAgICAgICAgICAgICAgaWYocHJldi5yb3V0ZS5zd2l0Y2hlZCAmJiB0aGlzLl9kaWRTd2l0Y2gocHJldi5yb3V0ZSwgbWF0Y2hlZFJvdXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldi5yb3V0ZS5zd2l0Y2hlZC5kaXNwYXRjaChyZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2RpZFN3aXRjaCA6IGZ1bmN0aW9uIChyb3V0ZSwgbWF0Y2hlZFJvdXRlcyl7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlZCxcbiAgICAgICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlIChtYXRjaGVkID0gbWF0Y2hlZFJvdXRlc1tpKytdKSB7XG4gICAgICAgICAgICAgICAgLy8gb25seSBkaXNwYXRjaCBzd2l0Y2hlZCBpZiBpdCBpcyBnb2luZyB0byBhIGRpZmZlcmVudCByb3V0ZVxuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkLnJvdXRlID09PSByb3V0ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX3BpcGVQYXJzZSA6IGZ1bmN0aW9uKHJlcXVlc3QsIGRlZmF1bHRBcmdzKSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIHJvdXRlO1xuICAgICAgICAgICAgd2hpbGUgKHJvdXRlID0gdGhpcy5fcGlwZWRbaSsrXSkge1xuICAgICAgICAgICAgICAgIHJvdXRlLnBhcnNlKHJlcXVlc3QsIGRlZmF1bHRBcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBnZXROdW1Sb3V0ZXMgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcm91dGVzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICBfc29ydGVkSW5zZXJ0IDogZnVuY3Rpb24gKHJvdXRlKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciByb3V0ZXMgPSB0aGlzLl9yb3V0ZXMsXG4gICAgICAgICAgICAgICAgbiA9IHJvdXRlcy5sZW5ndGg7XG4gICAgICAgICAgICBkbyB7IC0tbjsgfSB3aGlsZSAocm91dGVzW25dICYmIHJvdXRlLl9wcmlvcml0eSA8PSByb3V0ZXNbbl0uX3ByaW9yaXR5KTtcbiAgICAgICAgICAgIHJvdXRlcy5zcGxpY2UobisxLCAwLCByb3V0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2dldE1hdGNoZWRSb3V0ZXMgOiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICAgICAgdmFyIHJlcyA9IFtdLFxuICAgICAgICAgICAgICAgIHJvdXRlcyA9IHRoaXMuX3JvdXRlcyxcbiAgICAgICAgICAgICAgICBuID0gcm91dGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICByb3V0ZTtcbiAgICAgICAgICAgIC8vc2hvdWxkIGJlIGRlY3JlbWVudCBsb29wIHNpbmNlIGhpZ2hlciBwcmlvcml0aWVzIGFyZSBhZGRlZCBhdCB0aGUgZW5kIG9mIGFycmF5XG4gICAgICAgICAgICB3aGlsZSAocm91dGUgPSByb3V0ZXNbLS1uXSkge1xuICAgICAgICAgICAgICAgIGlmICgoIXJlcy5sZW5ndGggfHwgdGhpcy5ncmVlZHkgfHwgcm91dGUuZ3JlZWR5KSAmJiByb3V0ZS5tYXRjaChyZXF1ZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3V0ZSA6IHJvdXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zIDogcm91dGUuX2dldFBhcmFtc0FycmF5KHJlcXVlc3QpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ3JlZWR5RW5hYmxlZCAmJiByZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGlwZSA6IGZ1bmN0aW9uIChvdGhlclJvdXRlcikge1xuICAgICAgICAgICAgdGhpcy5fcGlwZWQucHVzaChvdGhlclJvdXRlcik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdW5waXBlIDogZnVuY3Rpb24gKG90aGVyUm91dGVyKSB7XG4gICAgICAgICAgICBhcnJheVJlbW92ZSh0aGlzLl9waXBlZCwgb3RoZXJSb3V0ZXIpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbY3Jvc3Nyb2FkcyBudW1Sb3V0ZXM6JysgdGhpcy5nZXROdW1Sb3V0ZXMoKSArJ10nO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vXCJzdGF0aWNcIiBpbnN0YW5jZVxuICAgIGNyb3Nzcm9hZHMgPSBuZXcgQ3Jvc3Nyb2FkcygpO1xuICAgIGNyb3Nzcm9hZHMuVkVSU0lPTiA9ICcwLjEyLjAnO1xuXG4gICAgY3Jvc3Nyb2Fkcy5OT1JNX0FTX0FSUkFZID0gZnVuY3Rpb24gKHJlcSwgdmFscykge1xuICAgICAgICByZXR1cm4gW3ZhbHMudmFsc19dO1xuICAgIH07XG5cbiAgICBjcm9zc3JvYWRzLk5PUk1fQVNfT0JKRUNUID0gZnVuY3Rpb24gKHJlcSwgdmFscykge1xuICAgICAgICByZXR1cm4gW3ZhbHNdO1xuICAgIH07XG5cblxuICAgIC8vIFJvdXRlIC0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJvdXRlKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSwgcm91dGVyKSB7XG4gICAgICAgIHZhciBpc1JlZ2V4UGF0dGVybiA9IGlzUmVnRXhwKHBhdHRlcm4pLFxuICAgICAgICAgICAgcGF0dGVybkxleGVyID0gcm91dGVyLnBhdHRlcm5MZXhlcjtcbiAgICAgICAgdGhpcy5fcm91dGVyID0gcm91dGVyO1xuICAgICAgICB0aGlzLl9wYXR0ZXJuID0gcGF0dGVybjtcbiAgICAgICAgdGhpcy5fcGFyYW1zSWRzID0gaXNSZWdleFBhdHRlcm4/IG51bGwgOiBwYXR0ZXJuTGV4ZXIuZ2V0UGFyYW1JZHMocGF0dGVybik7XG4gICAgICAgIHRoaXMuX29wdGlvbmFsUGFyYW1zSWRzID0gaXNSZWdleFBhdHRlcm4/IG51bGwgOiBwYXR0ZXJuTGV4ZXIuZ2V0T3B0aW9uYWxQYXJhbXNJZHMocGF0dGVybik7XG4gICAgICAgIHRoaXMuX21hdGNoUmVnZXhwID0gaXNSZWdleFBhdHRlcm4/IHBhdHRlcm4gOiBwYXR0ZXJuTGV4ZXIuY29tcGlsZVBhdHRlcm4ocGF0dGVybiwgcm91dGVyLmlnbm9yZUNhc2UpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSBuZXcgc2lnbmFscy5TaWduYWwoKTtcbiAgICAgICAgdGhpcy5zd2l0Y2hlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlZC5hZGQoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBSb3V0ZS5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgZ3JlZWR5IDogZmFsc2UsXG5cbiAgICAgICAgcnVsZXMgOiB2b2lkKDApLFxuXG4gICAgICAgIG1hdGNoIDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHJlcXVlc3QgPSByZXF1ZXN0IHx8ICcnO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21hdGNoUmVnZXhwLnRlc3QocmVxdWVzdCkgJiYgdGhpcy5fdmFsaWRhdGVQYXJhbXMocmVxdWVzdCk7IC8vdmFsaWRhdGUgcGFyYW1zIGV2ZW4gaWYgcmVnZXhwIGJlY2F1c2Ugb2YgYHJlcXVlc3RfYCBydWxlLlxuICAgICAgICB9LFxuXG4gICAgICAgIF92YWxpZGF0ZVBhcmFtcyA6IGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgICAgICB2YXIgcnVsZXMgPSB0aGlzLnJ1bGVzLFxuICAgICAgICAgICAgICAgIHZhbHVlcyA9IHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KSxcbiAgICAgICAgICAgICAgICBrZXk7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBydWxlcykge1xuICAgICAgICAgICAgICAgIC8vIG5vcm1hbGl6ZV8gaXNuJ3QgYSB2YWxpZGF0aW9uIHJ1bGUuLi4gKCMzOSlcbiAgICAgICAgICAgICAgICBpZihrZXkgIT09ICdub3JtYWxpemVfJyAmJiBydWxlcy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICEgdGhpcy5faXNWYWxpZFBhcmFtKHJlcXVlc3QsIGtleSwgdmFsdWVzKSl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBfaXNWYWxpZFBhcmFtIDogZnVuY3Rpb24gKHJlcXVlc3QsIHByb3AsIHZhbHVlcykge1xuICAgICAgICAgICAgdmFyIHZhbGlkYXRpb25SdWxlID0gdGhpcy5ydWxlc1twcm9wXSxcbiAgICAgICAgICAgICAgICB2YWwgPSB2YWx1ZXNbcHJvcF0sXG4gICAgICAgICAgICAgICAgaXNWYWxpZCA9IGZhbHNlLFxuICAgICAgICAgICAgICAgIGlzUXVlcnkgPSAocHJvcC5pbmRleE9mKCc/JykgPT09IDApO1xuXG4gICAgICAgICAgICBpZiAodmFsID09IG51bGwgJiYgdGhpcy5fb3B0aW9uYWxQYXJhbXNJZHMgJiYgYXJyYXlJbmRleE9mKHRoaXMuX29wdGlvbmFsUGFyYW1zSWRzLCBwcm9wKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBpc1ZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGlzUmVnRXhwKHZhbGlkYXRpb25SdWxlKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1F1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbCA9IHZhbHVlc1twcm9wICsnXyddOyAvL3VzZSByYXcgc3RyaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlzVmFsaWQgPSB2YWxpZGF0aW9uUnVsZS50ZXN0KHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0FycmF5KHZhbGlkYXRpb25SdWxlKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1F1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbCA9IHZhbHVlc1twcm9wICsnXyddOyAvL3VzZSByYXcgc3RyaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlzVmFsaWQgPSB0aGlzLl9pc1ZhbGlkQXJyYXlSdWxlKHZhbGlkYXRpb25SdWxlLCB2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNGdW5jdGlvbih2YWxpZGF0aW9uUnVsZSkpIHtcbiAgICAgICAgICAgICAgICBpc1ZhbGlkID0gdmFsaWRhdGlvblJ1bGUodmFsLCByZXF1ZXN0LCB2YWx1ZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaXNWYWxpZDsgLy9mYWlsIHNpbGVudGx5IGlmIHZhbGlkYXRpb25SdWxlIGlzIGZyb20gYW4gdW5zdXBwb3J0ZWQgdHlwZVxuICAgICAgICB9LFxuXG4gICAgICAgIF9pc1ZhbGlkQXJyYXlSdWxlIDogZnVuY3Rpb24gKGFyciwgdmFsKSB7XG4gICAgICAgICAgICBpZiAoISB0aGlzLl9yb3V0ZXIuaWdub3JlQ2FzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcnJheUluZGV4T2YoYXJyLCB2YWwpICE9PSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gdmFsLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBuID0gYXJyLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpdGVtLFxuICAgICAgICAgICAgICAgIGNvbXBhcmVWYWw7XG5cbiAgICAgICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gYXJyW25dO1xuICAgICAgICAgICAgICAgIGNvbXBhcmVWYWwgPSAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKT8gaXRlbS50b0xvd2VyQ2FzZSgpIDogaXRlbTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcGFyZVZhbCA9PT0gdmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0UGFyYW1zT2JqZWN0IDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHZhciBzaG91bGRUeXBlY2FzdCA9IHRoaXMuX3JvdXRlci5zaG91bGRUeXBlY2FzdCxcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSB0aGlzLl9yb3V0ZXIucGF0dGVybkxleGVyLmdldFBhcmFtVmFsdWVzKHJlcXVlc3QsIHRoaXMuX21hdGNoUmVnZXhwLCBzaG91bGRUeXBlY2FzdCksXG4gICAgICAgICAgICAgICAgbyA9IHt9LFxuICAgICAgICAgICAgICAgIG4gPSB2YWx1ZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBhcmFtLCB2YWw7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gdmFsdWVzW25dO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJhbXNJZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW0gPSB0aGlzLl9wYXJhbXNJZHNbbl07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJhbS5pbmRleE9mKCc/JykgPT09IDAgJiYgdmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL21ha2UgYSBjb3B5IG9mIHRoZSBvcmlnaW5hbCBzdHJpbmcgc28gYXJyYXkgYW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1JlZ0V4cCB2YWxpZGF0aW9uIGNhbiBiZSBhcHBsaWVkIHByb3Blcmx5XG4gICAgICAgICAgICAgICAgICAgICAgICBvW3BhcmFtICsnXyddID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy91cGRhdGUgdmFsc18gYXJyYXkgYXMgd2VsbCBzaW5jZSBpdCB3aWxsIGJlIHVzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSBkZWNvZGVRdWVyeVN0cmluZyh2YWwsIHNob3VsZFR5cGVjYXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlc1tuXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBJRSB3aWxsIGNhcHR1cmUgb3B0aW9uYWwgZ3JvdXBzIGFzIGVtcHR5IHN0cmluZ3Mgd2hpbGUgb3RoZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gYnJvd3NlcnMgd2lsbCBjYXB0dXJlIGB1bmRlZmluZWRgIHNvIG5vcm1hbGl6ZSBiZWhhdmlvci5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VlOiAjZ2gtNTgsICNnaC01OSwgI2doLTYwXG4gICAgICAgICAgICAgICAgICAgIGlmICggX2hhc09wdGlvbmFsR3JvdXBCdWcgJiYgdmFsID09PSAnJyAmJiBhcnJheUluZGV4T2YodGhpcy5fb3B0aW9uYWxQYXJhbXNJZHMsIHBhcmFtKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSB2b2lkKDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzW25dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9bcGFyYW1dID0gdmFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2FsaWFzIHRvIHBhdGhzIGFuZCBmb3IgUmVnRXhwIHBhdHRlcm5cbiAgICAgICAgICAgICAgICBvW25dID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgby5yZXF1ZXN0XyA9IHNob3VsZFR5cGVjYXN0PyB0eXBlY2FzdFZhbHVlKHJlcXVlc3QpIDogcmVxdWVzdDtcbiAgICAgICAgICAgIG8udmFsc18gPSB2YWx1ZXM7XG4gICAgICAgICAgICByZXR1cm4gbztcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0UGFyYW1zQXJyYXkgOiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICAgICAgdmFyIG5vcm0gPSB0aGlzLnJ1bGVzPyB0aGlzLnJ1bGVzLm5vcm1hbGl6ZV8gOiBudWxsLFxuICAgICAgICAgICAgICAgIHBhcmFtcztcbiAgICAgICAgICAgIG5vcm0gPSBub3JtIHx8IHRoaXMuX3JvdXRlci5ub3JtYWxpemVGbjsgLy8gZGVmYXVsdCBub3JtYWxpemVcbiAgICAgICAgICAgIGlmIChub3JtICYmIGlzRnVuY3Rpb24obm9ybSkpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBub3JtKHJlcXVlc3QsIHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KS52YWxzXztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgaW50ZXJwb2xhdGUgOiBmdW5jdGlvbihyZXBsYWNlbWVudHMpIHtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLl9yb3V0ZXIucGF0dGVybkxleGVyLmludGVycG9sYXRlKHRoaXMuX3BhdHRlcm4sIHJlcGxhY2VtZW50cyk7XG4gICAgICAgICAgICBpZiAoISB0aGlzLl92YWxpZGF0ZVBhcmFtcyhzdHIpICkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignR2VuZXJhdGVkIHN0cmluZyBkb2VzblxcJ3QgdmFsaWRhdGUgYWdhaW5zdCBgUm91dGUucnVsZXNgLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgfSxcblxuICAgICAgICBkaXNwb3NlIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5fcm91dGVyLnJlbW92ZVJvdXRlKHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9kZXN0cm95IDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuc3dpdGNoZWQuZGlzcG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkID0gdGhpcy5zd2l0Y2hlZCA9IHRoaXMuX3BhdHRlcm4gPSB0aGlzLl9tYXRjaFJlZ2V4cCA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdG9TdHJpbmcgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1tSb3V0ZSBwYXR0ZXJuOlwiJysgdGhpcy5fcGF0dGVybiArJ1wiLCBudW1MaXN0ZW5lcnM6JysgdGhpcy5tYXRjaGVkLmdldE51bUxpc3RlbmVycygpICsnXSc7XG4gICAgICAgIH1cblxuICAgIH07XG5cblxuXG4gICAgLy8gUGF0dGVybiBMZXhlciAtLS0tLS1cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgQ3Jvc3Nyb2Fkcy5wcm90b3R5cGUucGF0dGVybkxleGVyID0gKGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXJcbiAgICAgICAgICAgIC8vbWF0Y2ggY2hhcnMgdGhhdCBzaG91bGQgYmUgZXNjYXBlZCBvbiBzdHJpbmcgcmVnZXhwXG4gICAgICAgICAgICBFU0NBUEVfQ0hBUlNfUkVHRVhQID0gL1tcXFxcLisqP1xcXiRcXFtcXF0oKXt9XFwvJyNdL2csXG5cbiAgICAgICAgICAgIC8vdHJhaWxpbmcgc2xhc2hlcyAoYmVnaW4vZW5kIG9mIHN0cmluZylcbiAgICAgICAgICAgIExPT1NFX1NMQVNIRVNfUkVHRVhQID0gL15cXC98XFwvJC9nLFxuICAgICAgICAgICAgTEVHQUNZX1NMQVNIRVNfUkVHRVhQID0gL1xcLyQvZyxcblxuICAgICAgICAgICAgLy9wYXJhbXMgLSBldmVyeXRoaW5nIGJldHdlZW4gYHsgfWAgb3IgYDogOmBcbiAgICAgICAgICAgIFBBUkFNU19SRUdFWFAgPSAvKD86XFx7fDopKFtefTpdKykoPzpcXH18OikvZyxcblxuICAgICAgICAgICAgLy91c2VkIHRvIHNhdmUgcGFyYW1zIGR1cmluZyBjb21waWxlIChhdm9pZCBlc2NhcGluZyB0aGluZ3MgdGhhdFxuICAgICAgICAgICAgLy9zaG91bGRuJ3QgYmUgZXNjYXBlZCkuXG4gICAgICAgICAgICBUT0tFTlMgPSB7XG4gICAgICAgICAgICAgICAgJ09TJyA6IHtcbiAgICAgICAgICAgICAgICAgICAgLy9vcHRpb25hbCBzbGFzaGVzXG4gICAgICAgICAgICAgICAgICAgIC8vc2xhc2ggYmV0d2VlbiBgOjpgIG9yIGB9OmAgb3IgYFxcdzpgIG9yIGA6ez9gIG9yIGB9ez9gIG9yIGBcXHd7P2BcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLyhbOn1dfFxcdyg/PVxcLykpXFwvPyg6fCg/Olxce1xcPykpL2csXG4gICAgICAgICAgICAgICAgICAgIHNhdmUgOiAnJDF7e2lkfX0kMicsXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICdcXFxcLz8nXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlMnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHNsYXNoZXNcbiAgICAgICAgICAgICAgICAgICAgLy91c2VkIHRvIGluc2VydCBzbGFzaCBiZXR3ZWVuIGA6e2AgYW5kIGB9e2BcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLyhbOn1dKVxcLz8oXFx7KS9nLFxuICAgICAgICAgICAgICAgICAgICBzYXZlIDogJyQxe3tpZH19JDInLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnXFxcXC8nXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlEnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHF1ZXJ5IHN0cmluZyAtIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiBgez8gfWBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogL1xce1xcPyhbXn1dKylcXH0vZyxcbiAgICAgICAgICAgICAgICAgICAgLy9ldmVyeXRoaW5nIGZyb20gYD9gIHRpbGwgYCNgIG9yIGVuZCBvZiBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgcmVzIDogJ1xcXFw/KFteI10rKSdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdPUScgOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vb3B0aW9uYWwgcXVlcnkgc3RyaW5nIC0gZXZlcnl0aGluZyBpbiBiZXR3ZWVuIGA6PyA6YFxuICAgICAgICAgICAgICAgICAgICByZ3ggOiAvOlxcPyhbXjpdKyk6L2csXG4gICAgICAgICAgICAgICAgICAgIC8vZXZlcnl0aGluZyBmcm9tIGA/YCB0aWxsIGAjYCBvciBlbmQgb2Ygc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICcoPzpcXFxcPyhbXiNdKikpPydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdPUicgOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vb3B0aW9uYWwgcmVzdCAtIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiBgOiAqOmBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLzooW146XSspXFwqOi9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKC4qKT8nIC8vIG9wdGlvbmFsIGdyb3VwIHRvIGF2b2lkIHBhc3NpbmcgZW1wdHkgc3RyaW5nIGFzIGNhcHR1cmVkXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlInIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3Jlc3QgcGFyYW0gLSBldmVyeXRoaW5nIGluIGJldHdlZW4gYHsgKn1gXG4gICAgICAgICAgICAgICAgICAgIHJneCA6IC9cXHsoW159XSspXFwqXFx9L2csXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICcoLispJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgLy8gcmVxdWlyZWQvb3B0aW9uYWwgcGFyYW1zIHNob3VsZCBjb21lIGFmdGVyIHJlc3Qgc2VnbWVudHNcbiAgICAgICAgICAgICAgICAnUlAnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHBhcmFtcyAtIGV2ZXJ5dGhpbmcgYmV0d2VlbiBgeyB9YFxuICAgICAgICAgICAgICAgICAgICByZ3ggOiAvXFx7KFtefV0rKVxcfS9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKFteXFxcXC8/XSspJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgJ09QJyA6IHtcbiAgICAgICAgICAgICAgICAgICAgLy9vcHRpb25hbCBwYXJhbXMgLSBldmVyeXRoaW5nIGJldHdlZW4gYDogOmBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLzooW146XSspOi9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKFteXFxcXC8/XSspP1xcLz8nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgTE9PU0VfU0xBU0ggPSAxLFxuICAgICAgICAgICAgU1RSSUNUX1NMQVNIID0gMixcbiAgICAgICAgICAgIExFR0FDWV9TTEFTSCA9IDMsXG5cbiAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMT09TRV9TTEFTSDtcblxuXG4gICAgICAgIGZ1bmN0aW9uIHByZWNvbXBpbGVUb2tlbnMoKXtcbiAgICAgICAgICAgIHZhciBrZXksIGN1cjtcbiAgICAgICAgICAgIGZvciAoa2V5IGluIFRPS0VOUykge1xuICAgICAgICAgICAgICAgIGlmIChUT0tFTlMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBjdXIgPSBUT0tFTlNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgY3VyLmlkID0gJ19fQ1JfJysga2V5ICsnX18nO1xuICAgICAgICAgICAgICAgICAgICBjdXIuc2F2ZSA9ICgnc2F2ZScgaW4gY3VyKT8gY3VyLnNhdmUucmVwbGFjZSgne3tpZH19JywgY3VyLmlkKSA6IGN1ci5pZDtcbiAgICAgICAgICAgICAgICAgICAgY3VyLnJSZXN0b3JlID0gbmV3IFJlZ0V4cChjdXIuaWQsICdnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHByZWNvbXBpbGVUb2tlbnMoKTtcblxuXG4gICAgICAgIGZ1bmN0aW9uIGNhcHR1cmVWYWxzKHJlZ2V4LCBwYXR0ZXJuKSB7XG4gICAgICAgICAgICB2YXIgdmFscyA9IFtdLCBtYXRjaDtcbiAgICAgICAgICAgIC8vIHZlcnkgaW1wb3J0YW50IHRvIHJlc2V0IGxhc3RJbmRleCBzaW5jZSBSZWdFeHAgY2FuIGhhdmUgXCJnXCIgZmxhZ1xuICAgICAgICAgICAgLy8gYW5kIG11bHRpcGxlIHJ1bnMgbWlnaHQgYWZmZWN0IHRoZSByZXN1bHQsIHNwZWNpYWxseSBpZiBtYXRjaGluZ1xuICAgICAgICAgICAgLy8gc2FtZSBzdHJpbmcgbXVsdGlwbGUgdGltZXMgb24gSUUgNy04XG4gICAgICAgICAgICByZWdleC5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgd2hpbGUgKG1hdGNoID0gcmVnZXguZXhlYyhwYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHZhbHMucHVzaChtYXRjaFsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFBhcmFtSWRzKHBhdHRlcm4pIHtcbiAgICAgICAgICAgIHJldHVybiBjYXB0dXJlVmFscyhQQVJBTVNfUkVHRVhQLCBwYXR0ZXJuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldE9wdGlvbmFsUGFyYW1zSWRzKHBhdHRlcm4pIHtcbiAgICAgICAgICAgIHJldHVybiBjYXB0dXJlVmFscyhUT0tFTlMuT1Aucmd4LCBwYXR0ZXJuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvbXBpbGVQYXR0ZXJuKHBhdHRlcm4sIGlnbm9yZUNhc2UpIHtcbiAgICAgICAgICAgIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuXG4gICAgICAgICAgICBpZihwYXR0ZXJuKXtcbiAgICAgICAgICAgICAgICBpZiAoX3NsYXNoTW9kZSA9PT0gTE9PU0VfU0xBU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShMT09TRV9TTEFTSEVTX1JFR0VYUCwgJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChfc2xhc2hNb2RlID09PSBMRUdBQ1lfU0xBU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShMRUdBQ1lfU0xBU0hFU19SRUdFWFAsICcnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgdG9rZW5zXG4gICAgICAgICAgICAgICAgcGF0dGVybiA9IHJlcGxhY2VUb2tlbnMocGF0dGVybiwgJ3JneCcsICdzYXZlJyk7XG4gICAgICAgICAgICAgICAgLy9yZWdleHAgZXNjYXBlXG4gICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShFU0NBUEVfQ0hBUlNfUkVHRVhQLCAnXFxcXCQmJyk7XG4gICAgICAgICAgICAgICAgLy9yZXN0b3JlIHRva2Vuc1xuICAgICAgICAgICAgICAgIHBhdHRlcm4gPSByZXBsYWNlVG9rZW5zKHBhdHRlcm4sICdyUmVzdG9yZScsICdyZXMnKTtcblxuICAgICAgICAgICAgICAgIGlmIChfc2xhc2hNb2RlID09PSBMT09TRV9TTEFTSCkge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuID0gJ1xcXFwvPycrIHBhdHRlcm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoX3NsYXNoTW9kZSAhPT0gU1RSSUNUX1NMQVNIKSB7XG4gICAgICAgICAgICAgICAgLy9zaW5nbGUgc2xhc2ggaXMgdHJlYXRlZCBhcyBlbXB0eSBhbmQgZW5kIHNsYXNoIGlzIG9wdGlvbmFsXG4gICAgICAgICAgICAgICAgcGF0dGVybiArPSAnXFxcXC8/JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVnRXhwKCdeJysgcGF0dGVybiArICckJywgaWdub3JlQ2FzZT8gJ2knIDogJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmVwbGFjZVRva2VucyhwYXR0ZXJuLCByZWdleHBOYW1lLCByZXBsYWNlTmFtZSkge1xuICAgICAgICAgICAgdmFyIGN1ciwga2V5O1xuICAgICAgICAgICAgZm9yIChrZXkgaW4gVE9LRU5TKSB7XG4gICAgICAgICAgICAgICAgaWYgKFRPS0VOUy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ciA9IFRPS0VOU1trZXldO1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuID0gcGF0dGVybi5yZXBsYWNlKGN1cltyZWdleHBOYW1lXSwgY3VyW3JlcGxhY2VOYW1lXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHBhdHRlcm47XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRQYXJhbVZhbHVlcyhyZXF1ZXN0LCByZWdleHAsIHNob3VsZFR5cGVjYXN0KSB7XG4gICAgICAgICAgICB2YXIgdmFscyA9IHJlZ2V4cC5leGVjKHJlcXVlc3QpO1xuICAgICAgICAgICAgaWYgKHZhbHMpIHtcbiAgICAgICAgICAgICAgICB2YWxzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFR5cGVjYXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHMgPSB0eXBlY2FzdEFycmF5VmFsdWVzKHZhbHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWxzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW50ZXJwb2xhdGUocGF0dGVybiwgcmVwbGFjZW1lbnRzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhdHRlcm4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSb3V0ZSBwYXR0ZXJuIHNob3VsZCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlcGxhY2VGbiA9IGZ1bmN0aW9uKG1hdGNoLCBwcm9wKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbDtcbiAgICAgICAgICAgICAgICAgICAgcHJvcCA9IChwcm9wLnN1YnN0cigwLCAxKSA9PT0gJz8nKT8gcHJvcC5zdWJzdHIoMSkgOiBwcm9wO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZW1lbnRzW3Byb3BdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVwbGFjZW1lbnRzW3Byb3BdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBxdWVyeVBhcnRzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gcmVwbGFjZW1lbnRzW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5UGFydHMucHVzaChlbmNvZGVVUkkoa2V5ICsgJz0nICsgcmVwbGFjZW1lbnRzW3Byb3BdW2tleV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gJz8nICsgcXVlcnlQYXJ0cy5qb2luKCcmJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB2YWx1ZSBpcyBhIHN0cmluZyBzZWUgI2doLTU0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gU3RyaW5nKHJlcGxhY2VtZW50c1twcm9wXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaC5pbmRleE9mKCcqJykgPT09IC0xICYmIHZhbC5pbmRleE9mKCcvJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZhbHVlIFwiJysgdmFsICsnXCIgZm9yIHNlZ21lbnQgXCInKyBtYXRjaCArJ1wiLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoLmluZGV4T2YoJ3snKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIHNlZ21lbnQgJysgbWF0Y2ggKycgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICghIFRPS0VOUy5PUy50cmFpbCkge1xuICAgICAgICAgICAgICAgIFRPS0VOUy5PUy50cmFpbCA9IG5ldyBSZWdFeHAoJyg/OicrIFRPS0VOUy5PUy5pZCArJykrJCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcGF0dGVyblxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoVE9LRU5TLk9TLnJneCwgVE9LRU5TLk9TLnNhdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShQQVJBTVNfUkVHRVhQLCByZXBsYWNlRm4pXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShUT0tFTlMuT1MudHJhaWwsICcnKSAvLyByZW1vdmUgdHJhaWxpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKFRPS0VOUy5PUy5yUmVzdG9yZSwgJy8nKTsgLy8gYWRkIHNsYXNoIGJldHdlZW4gc2VnbWVudHNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQVBJXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdHJpY3QgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBTVFJJQ1RfU0xBU0g7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbG9vc2UgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMT09TRV9TTEFTSDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsZWdhY3kgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMRUdBQ1lfU0xBU0g7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0UGFyYW1JZHMgOiBnZXRQYXJhbUlkcyxcbiAgICAgICAgICAgIGdldE9wdGlvbmFsUGFyYW1zSWRzIDogZ2V0T3B0aW9uYWxQYXJhbXNJZHMsXG4gICAgICAgICAgICBnZXRQYXJhbVZhbHVlcyA6IGdldFBhcmFtVmFsdWVzLFxuICAgICAgICAgICAgY29tcGlsZVBhdHRlcm4gOiBjb21waWxlUGF0dGVybixcbiAgICAgICAgICAgIGludGVycG9sYXRlIDogaW50ZXJwb2xhdGVcbiAgICAgICAgfTtcblxuICAgIH0oKSk7XG5cblxuICAgIHJldHVybiBjcm9zc3JvYWRzO1xufTtcblxuaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbJ3NpZ25hbHMnXSwgZmFjdG9yeSk7XG59IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7IC8vTm9kZVxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKCdzaWduYWxzJykpO1xufSBlbHNlIHtcbiAgICAvKmpzaGludCBzdWI6dHJ1ZSAqL1xuICAgIHdpbmRvd1snY3Jvc3Nyb2FkcyddID0gZmFjdG9yeSh3aW5kb3dbJ3NpZ25hbHMnXSk7XG59XG5cbn0oKSk7XG5cbiIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwiLyohIVxuICogSGFzaGVyIDxodHRwOi8vZ2l0aHViLmNvbS9taWxsZXJtZWRlaXJvcy9oYXNoZXI+XG4gKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICogQHZlcnNpb24gMS4yLjAgKDIwMTMvMTEvMTEgMDM6MTggUE0pXG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2VcbiAqL1xuXG47KGZ1bmN0aW9uICgpIHtcbnZhciBmYWN0b3J5ID0gZnVuY3Rpb24oc2lnbmFscyl7XG5cbi8qanNoaW50IHdoaXRlOmZhbHNlKi9cbi8qZ2xvYmFsIHNpZ25hbHM6ZmFsc2UsIHdpbmRvdzpmYWxzZSovXG5cbi8qKlxuICogSGFzaGVyXG4gKiBAbmFtZXNwYWNlIEhpc3RvcnkgTWFuYWdlciBmb3IgcmljaC1tZWRpYSBhcHBsaWNhdGlvbnMuXG4gKiBAbmFtZSBoYXNoZXJcbiAqL1xudmFyIGhhc2hlciA9IChmdW5jdGlvbih3aW5kb3cpe1xuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFByaXZhdGUgVmFyc1xuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIHZhclxuXG4gICAgICAgIC8vIGZyZXF1ZW5jeSB0aGF0IGl0IHdpbGwgY2hlY2sgaGFzaCB2YWx1ZSBvbiBJRSA2LTcgc2luY2UgaXQgZG9lc24ndFxuICAgICAgICAvLyBzdXBwb3J0IHRoZSBoYXNoY2hhbmdlIGV2ZW50XG4gICAgICAgIFBPT0xfSU5URVJWQUwgPSAyNSxcblxuICAgICAgICAvLyBsb2NhbCBzdG9yYWdlIGZvciBicmV2aXR5IGFuZCBiZXR0ZXIgY29tcHJlc3Npb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCxcbiAgICAgICAgaGlzdG9yeSA9IHdpbmRvdy5oaXN0b3J5LFxuICAgICAgICBTaWduYWwgPSBzaWduYWxzLlNpZ25hbCxcblxuICAgICAgICAvLyBsb2NhbCB2YXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICBoYXNoZXIsXG4gICAgICAgIF9oYXNoLFxuICAgICAgICBfY2hlY2tJbnRlcnZhbCxcbiAgICAgICAgX2lzQWN0aXZlLFxuICAgICAgICBfZnJhbWUsIC8vaWZyYW1lIHVzZWQgZm9yIGxlZ2FjeSBJRSAoNi03KVxuICAgICAgICBfY2hlY2tIaXN0b3J5LFxuICAgICAgICBfaGFzaFZhbFJlZ2V4cCA9IC8jKC4qKSQvLFxuICAgICAgICBfYmFzZVVybFJlZ2V4cCA9IC8oXFw/LiopfChcXCMuKikvLFxuICAgICAgICBfaGFzaFJlZ2V4cCA9IC9eXFwjLyxcblxuICAgICAgICAvLyBzbmlmZmluZy9mZWF0dXJlIGRldGVjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgICAgLy9oYWNrIGJhc2VkIG9uIHRoaXM6IGh0dHA6Ly93ZWJyZWZsZWN0aW9uLmJsb2dzcG90LmNvbS8yMDA5LzAxLzMyLWJ5dGVzLXRvLWtub3ctaWYteW91ci1icm93c2VyLWlzLWllLmh0bWxcbiAgICAgICAgX2lzSUUgPSAoIStcIlxcdjFcIiksXG4gICAgICAgIC8vIGhhc2hjaGFuZ2UgaXMgc3VwcG9ydGVkIGJ5IEZGMy42KywgSUU4KywgQ2hyb21lIDUrLCBTYWZhcmkgNSsgYnV0XG4gICAgICAgIC8vIGZlYXR1cmUgZGV0ZWN0aW9uIGZhaWxzIG9uIElFIGNvbXBhdGliaWxpdHkgbW9kZSwgc28gd2UgbmVlZCB0b1xuICAgICAgICAvLyBjaGVjayBkb2N1bWVudE1vZGVcbiAgICAgICAgX2lzSGFzaENoYW5nZVN1cHBvcnRlZCA9ICgnb25oYXNoY2hhbmdlJyBpbiB3aW5kb3cpICYmIGRvY3VtZW50LmRvY3VtZW50TW9kZSAhPT0gNyxcbiAgICAgICAgLy9jaGVjayBpZiBpcyBJRTYtNyBzaW5jZSBoYXNoIGNoYW5nZSBpcyBvbmx5IHN1cHBvcnRlZCBvbiBJRTgrIGFuZFxuICAgICAgICAvL2NoYW5naW5nIGhhc2ggdmFsdWUgb24gSUU2LTcgZG9lc24ndCBnZW5lcmF0ZSBoaXN0b3J5IHJlY29yZC5cbiAgICAgICAgX2lzTGVnYWN5SUUgPSBfaXNJRSAmJiAhX2lzSGFzaENoYW5nZVN1cHBvcnRlZCxcbiAgICAgICAgX2lzTG9jYWwgPSAobG9jYXRpb24ucHJvdG9jb2wgPT09ICdmaWxlOicpO1xuXG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUHJpdmF0ZSBNZXRob2RzXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgZnVuY3Rpb24gX2VzY2FwZVJlZ0V4cChzdHIpe1xuICAgICAgICByZXR1cm4gU3RyaW5nKHN0ciB8fCAnJykucmVwbGFjZSgvXFxXL2csIFwiXFxcXCQmXCIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF90cmltSGFzaChoYXNoKXtcbiAgICAgICAgaWYgKCFoYXNoKSByZXR1cm4gJyc7XG4gICAgICAgIHZhciByZWdleHAgPSBuZXcgUmVnRXhwKCdeJyArIF9lc2NhcGVSZWdFeHAoaGFzaGVyLnByZXBlbmRIYXNoKSArICd8JyArIF9lc2NhcGVSZWdFeHAoaGFzaGVyLmFwcGVuZEhhc2gpICsgJyQnLCAnZycpO1xuICAgICAgICByZXR1cm4gaGFzaC5yZXBsYWNlKHJlZ2V4cCwgJycpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRXaW5kb3dIYXNoKCl7XG4gICAgICAgIC8vcGFyc2VkIGZ1bGwgVVJMIGluc3RlYWQgb2YgZ2V0dGluZyB3aW5kb3cubG9jYXRpb24uaGFzaCBiZWNhdXNlIEZpcmVmb3ggZGVjb2RlIGhhc2ggdmFsdWUgKGFuZCBhbGwgdGhlIG90aGVyIGJyb3dzZXJzIGRvbid0KVxuICAgICAgICAvL2Fsc28gYmVjYXVzZSBvZiBJRTggYnVnIHdpdGggaGFzaCBxdWVyeSBpbiBsb2NhbCBmaWxlIFtpc3N1ZSAjNl1cbiAgICAgICAgdmFyIHJlc3VsdCA9IF9oYXNoVmFsUmVnZXhwLmV4ZWMoIGhhc2hlci5nZXRVUkwoKSApO1xuICAgICAgICB2YXIgcGF0aCA9IChyZXN1bHQgJiYgcmVzdWx0WzFdKSB8fCAnJztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gaGFzaGVyLnJhdz8gcGF0aCA6IGRlY29kZVVSSUNvbXBvbmVudChwYXRoKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIGluIGNhc2UgdXNlciBkaWQgbm90IHNldCBgaGFzaGVyLnJhd2AgYW5kIGRlY29kZVVSSUNvbXBvbmVudFxuICAgICAgICAgIC8vIHRocm93cyBhbiBlcnJvciAoc2VlICM1NylcbiAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRGcmFtZUhhc2goKXtcbiAgICAgICAgcmV0dXJuIChfZnJhbWUpPyBfZnJhbWUuY29udGVudFdpbmRvdy5mcmFtZUhhc2ggOiBudWxsO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9jcmVhdGVGcmFtZSgpe1xuICAgICAgICBfZnJhbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpZnJhbWUnKTtcbiAgICAgICAgX2ZyYW1lLnNyYyA9ICdhYm91dDpibGFuayc7XG4gICAgICAgIF9mcmFtZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKF9mcmFtZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3VwZGF0ZUZyYW1lKCl7XG4gICAgICAgIGlmKF9mcmFtZSAmJiBfaGFzaCAhPT0gX2dldEZyYW1lSGFzaCgpKXtcbiAgICAgICAgICAgIHZhciBmcmFtZURvYyA9IF9mcmFtZS5jb250ZW50V2luZG93LmRvY3VtZW50O1xuICAgICAgICAgICAgZnJhbWVEb2Mub3BlbigpO1xuICAgICAgICAgICAgLy91cGRhdGUgaWZyYW1lIGNvbnRlbnQgdG8gZm9yY2UgbmV3IGhpc3RvcnkgcmVjb3JkLlxuICAgICAgICAgICAgLy9iYXNlZCBvbiBSZWFsbHkgU2ltcGxlIEhpc3RvcnksIFNXRkFkZHJlc3MgYW5kIFlVSS5oaXN0b3J5LlxuICAgICAgICAgICAgZnJhbWVEb2Mud3JpdGUoJzxodG1sPjxoZWFkPjx0aXRsZT4nICsgZG9jdW1lbnQudGl0bGUgKyAnPC90aXRsZT48c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj52YXIgZnJhbWVIYXNoPVwiJyArIF9oYXNoICsgJ1wiOzwvc2NyaXB0PjwvaGVhZD48Ym9keT4mbmJzcDs8L2JvZHk+PC9odG1sPicpO1xuICAgICAgICAgICAgZnJhbWVEb2MuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9yZWdpc3RlckNoYW5nZShuZXdIYXNoLCBpc1JlcGxhY2Upe1xuICAgICAgICBpZihfaGFzaCAhPT0gbmV3SGFzaCl7XG4gICAgICAgICAgICB2YXIgb2xkSGFzaCA9IF9oYXNoO1xuICAgICAgICAgICAgX2hhc2ggPSBuZXdIYXNoOyAvL3Nob3VsZCBjb21lIGJlZm9yZSBldmVudCBkaXNwYXRjaCB0byBtYWtlIHN1cmUgdXNlciBjYW4gZ2V0IHByb3BlciB2YWx1ZSBpbnNpZGUgZXZlbnQgaGFuZGxlclxuICAgICAgICAgICAgaWYoX2lzTGVnYWN5SUUpe1xuICAgICAgICAgICAgICAgIGlmKCFpc1JlcGxhY2Upe1xuICAgICAgICAgICAgICAgICAgICBfdXBkYXRlRnJhbWUoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBfZnJhbWUuY29udGVudFdpbmRvdy5mcmFtZUhhc2ggPSBuZXdIYXNoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGhhc2hlci5jaGFuZ2VkLmRpc3BhdGNoKF90cmltSGFzaChuZXdIYXNoKSwgX3RyaW1IYXNoKG9sZEhhc2gpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChfaXNMZWdhY3lJRSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9jaGVja0hpc3RvcnkgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyIHdpbmRvd0hhc2ggPSBfZ2V0V2luZG93SGFzaCgpLFxuICAgICAgICAgICAgICAgIGZyYW1lSGFzaCA9IF9nZXRGcmFtZUhhc2goKTtcbiAgICAgICAgICAgIGlmKGZyYW1lSGFzaCAhPT0gX2hhc2ggJiYgZnJhbWVIYXNoICE9PSB3aW5kb3dIYXNoKXtcbiAgICAgICAgICAgICAgICAvL2RldGVjdCBjaGFuZ2VzIG1hZGUgcHJlc3NpbmcgYnJvd3NlciBoaXN0b3J5IGJ1dHRvbnMuXG4gICAgICAgICAgICAgICAgLy9Xb3JrYXJvdW5kIHNpbmNlIGhpc3RvcnkuYmFjaygpIGFuZCBoaXN0b3J5LmZvcndhcmQoKSBkb2Vzbid0XG4gICAgICAgICAgICAgICAgLy91cGRhdGUgaGFzaCB2YWx1ZSBvbiBJRTYvNyBidXQgdXBkYXRlcyBjb250ZW50IG9mIHRoZSBpZnJhbWUuXG4gICAgICAgICAgICAgICAgLy9uZWVkcyB0byB0cmltIGhhc2ggc2luY2UgdmFsdWUgc3RvcmVkIGFscmVhZHkgaGF2ZVxuICAgICAgICAgICAgICAgIC8vcHJlcGVuZEhhc2ggKyBhcHBlbmRIYXNoIGZvciBmYXN0IGNoZWNrLlxuICAgICAgICAgICAgICAgIGhhc2hlci5zZXRIYXNoKF90cmltSGFzaChmcmFtZUhhc2gpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAod2luZG93SGFzaCAhPT0gX2hhc2gpe1xuICAgICAgICAgICAgICAgIC8vZGV0ZWN0IGlmIGhhc2ggY2hhbmdlZCAobWFudWFsbHkgb3IgdXNpbmcgc2V0SGFzaClcbiAgICAgICAgICAgICAgICBfcmVnaXN0ZXJDaGFuZ2Uod2luZG93SGFzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfY2hlY2tIaXN0b3J5ID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHZhciB3aW5kb3dIYXNoID0gX2dldFdpbmRvd0hhc2goKTtcbiAgICAgICAgICAgIGlmKHdpbmRvd0hhc2ggIT09IF9oYXNoKXtcbiAgICAgICAgICAgICAgICBfcmVnaXN0ZXJDaGFuZ2Uod2luZG93SGFzaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2FkZExpc3RlbmVyKGVsbSwgZVR5cGUsIGZuKXtcbiAgICAgICAgaWYoZWxtLmFkZEV2ZW50TGlzdGVuZXIpe1xuICAgICAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIoZVR5cGUsIGZuLCBmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxtLmF0dGFjaEV2ZW50KXtcbiAgICAgICAgICAgIGVsbS5hdHRhY2hFdmVudCgnb24nICsgZVR5cGUsIGZuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9yZW1vdmVMaXN0ZW5lcihlbG0sIGVUeXBlLCBmbil7XG4gICAgICAgIGlmKGVsbS5yZW1vdmVFdmVudExpc3RlbmVyKXtcbiAgICAgICAgICAgIGVsbS5yZW1vdmVFdmVudExpc3RlbmVyKGVUeXBlLCBmbiwgZmFsc2UpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsbS5kZXRhY2hFdmVudCl7XG4gICAgICAgICAgICBlbG0uZGV0YWNoRXZlbnQoJ29uJyArIGVUeXBlLCBmbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfbWFrZVBhdGgocGF0aHMpe1xuICAgICAgICBwYXRocyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICAgICAgdmFyIHBhdGggPSBwYXRocy5qb2luKGhhc2hlci5zZXBhcmF0b3IpO1xuICAgICAgICBwYXRoID0gcGF0aD8gaGFzaGVyLnByZXBlbmRIYXNoICsgcGF0aC5yZXBsYWNlKF9oYXNoUmVnZXhwLCAnJykgKyBoYXNoZXIuYXBwZW5kSGFzaCA6IHBhdGg7XG4gICAgICAgIHJldHVybiBwYXRoO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9lbmNvZGVQYXRoKHBhdGgpe1xuICAgICAgICAvL3VzZWQgZW5jb2RlVVJJIGluc3RlYWQgb2YgZW5jb2RlVVJJQ29tcG9uZW50IHRvIHByZXNlcnZlICc/JywgJy8nLFxuICAgICAgICAvLycjJy4gRml4ZXMgU2FmYXJpIGJ1ZyBbaXNzdWUgIzhdXG4gICAgICAgIHBhdGggPSBlbmNvZGVVUkkocGF0aCk7XG4gICAgICAgIGlmKF9pc0lFICYmIF9pc0xvY2FsKXtcbiAgICAgICAgICAgIC8vZml4IElFOCBsb2NhbCBmaWxlIGJ1ZyBbaXNzdWUgIzZdXG4gICAgICAgICAgICBwYXRoID0gcGF0aC5yZXBsYWNlKC9cXD8vLCAnJTNGJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxuXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFB1YmxpYyAoQVBJKVxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIGhhc2hlciA9IC8qKiBAbGVuZHMgaGFzaGVyICovIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogaGFzaGVyIFZlcnNpb24gTnVtYmVyXG4gICAgICAgICAqIEB0eXBlIHN0cmluZ1xuICAgICAgICAgKiBAY29uc3RhbnRcbiAgICAgICAgICovXG4gICAgICAgIFZFUlNJT04gOiAnMS4yLjAnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCb29sZWFuIGRlY2lkaW5nIGlmIGhhc2hlciBlbmNvZGVzL2RlY29kZXMgdGhlIGhhc2ggb3Igbm90LlxuICAgICAgICAgKiA8dWw+XG4gICAgICAgICAqIDxsaT5kZWZhdWx0IHZhbHVlOiBmYWxzZTs8L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqL1xuICAgICAgICByYXcgOiBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RyaW5nIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSBhZGRlZCB0byB0aGUgZW5kIG9mIEhhc2ggdmFsdWUuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogPGxpPmRlZmF1bHQgdmFsdWU6ICcnOzwvbGk+XG4gICAgICAgICAqIDxsaT53aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIGBoYXNoZXIuZ2V0SGFzaCgpYDwvbGk+XG4gICAgICAgICAqIDxsaT5hdm9pZCBjb25mbGljdHMgd2l0aCBlbGVtZW50cyB0aGF0IGNvbnRhaW4gSUQgZXF1YWwgdG8gaGFzaCB2YWx1ZTs8L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKiBAdHlwZSBzdHJpbmdcbiAgICAgICAgICovXG4gICAgICAgIGFwcGVuZEhhc2ggOiAnJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RyaW5nIHRoYXQgc2hvdWxkIGFsd2F5cyBiZSBhZGRlZCB0byB0aGUgYmVnaW5uaW5nIG9mIEhhc2ggdmFsdWUuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogPGxpPmRlZmF1bHQgdmFsdWU6ICcvJzs8L2xpPlxuICAgICAgICAgKiA8bGk+d2lsbCBiZSBhdXRvbWF0aWNhbGx5IHJlbW92ZWQgZnJvbSBgaGFzaGVyLmdldEhhc2goKWA8L2xpPlxuICAgICAgICAgKiA8bGk+YXZvaWQgY29uZmxpY3RzIHdpdGggZWxlbWVudHMgdGhhdCBjb250YWluIElEIGVxdWFsIHRvIGhhc2ggdmFsdWU7PC9saT5cbiAgICAgICAgICogPC91bD5cbiAgICAgICAgICogQHR5cGUgc3RyaW5nXG4gICAgICAgICAqL1xuICAgICAgICBwcmVwZW5kSGFzaCA6ICcvJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RyaW5nIHVzZWQgdG8gc3BsaXQgaGFzaCBwYXRoczsgdXNlZCBieSBgaGFzaGVyLmdldEhhc2hBc0FycmF5KClgIHRvIHNwbGl0IHBhdGhzLlxuICAgICAgICAgKiA8dWw+XG4gICAgICAgICAqIDxsaT5kZWZhdWx0IHZhbHVlOiAnLyc7PC9saT5cbiAgICAgICAgICogPC91bD5cbiAgICAgICAgICogQHR5cGUgc3RyaW5nXG4gICAgICAgICAqL1xuICAgICAgICBzZXBhcmF0b3IgOiAnLycsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gaGFzaCB2YWx1ZSBjaGFuZ2VzLlxuICAgICAgICAgKiAtIHBhc3MgY3VycmVudCBoYXNoIGFzIDFzdCBwYXJhbWV0ZXIgdG8gbGlzdGVuZXJzIGFuZCBwcmV2aW91cyBoYXNoIHZhbHVlIGFzIDJuZCBwYXJhbWV0ZXIuXG4gICAgICAgICAqIEB0eXBlIHNpZ25hbHMuU2lnbmFsXG4gICAgICAgICAqL1xuICAgICAgICBjaGFuZ2VkIDogbmV3IFNpZ25hbCgpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTaWduYWwgZGlzcGF0Y2hlZCB3aGVuIGhhc2hlciBpcyBzdG9wcGVkLlxuICAgICAgICAgKiAtICBwYXNzIGN1cnJlbnQgaGFzaCBhcyBmaXJzdCBwYXJhbWV0ZXIgdG8gbGlzdGVuZXJzXG4gICAgICAgICAqIEB0eXBlIHNpZ25hbHMuU2lnbmFsXG4gICAgICAgICAqL1xuICAgICAgICBzdG9wcGVkIDogbmV3IFNpZ25hbCgpLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTaWduYWwgZGlzcGF0Y2hlZCB3aGVuIGhhc2hlciBpcyBpbml0aWFsaXplZC5cbiAgICAgICAgICogLSBwYXNzIGN1cnJlbnQgaGFzaCBhcyBmaXJzdCBwYXJhbWV0ZXIgdG8gbGlzdGVuZXJzLlxuICAgICAgICAgKiBAdHlwZSBzaWduYWxzLlNpZ25hbFxuICAgICAgICAgKi9cbiAgICAgICAgaW5pdGlhbGl6ZWQgOiBuZXcgU2lnbmFsKCksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGxpc3RlbmluZy9kaXNwYXRjaGluZyBjaGFuZ2VzIGluIHRoZSBoYXNoL2hpc3RvcnkuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogICA8bGk+aGFzaGVyIHdvbid0IGRpc3BhdGNoIENIQU5HRSBldmVudHMgYnkgbWFudWFsbHkgdHlwaW5nIGEgbmV3IHZhbHVlIG9yIHByZXNzaW5nIHRoZSBiYWNrL2ZvcndhcmQgYnV0dG9ucyBiZWZvcmUgY2FsbGluZyB0aGlzIG1ldGhvZC48L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKi9cbiAgICAgICAgaW5pdCA6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBpZihfaXNBY3RpdmUpIHJldHVybjtcblxuICAgICAgICAgICAgX2hhc2ggPSBfZ2V0V2luZG93SGFzaCgpO1xuXG4gICAgICAgICAgICAvL3Rob3VnaHQgYWJvdXQgYnJhbmNoaW5nL292ZXJsb2FkaW5nIGhhc2hlci5pbml0KCkgdG8gYXZvaWQgY2hlY2tpbmcgbXVsdGlwbGUgdGltZXMgYnV0XG4gICAgICAgICAgICAvL2Rvbid0IHRoaW5rIHdvcnRoIGRvaW5nIGl0IHNpbmNlIGl0IHByb2JhYmx5IHdvbid0IGJlIGNhbGxlZCBtdWx0aXBsZSB0aW1lcy5cbiAgICAgICAgICAgIGlmKF9pc0hhc2hDaGFuZ2VTdXBwb3J0ZWQpe1xuICAgICAgICAgICAgICAgIF9hZGRMaXN0ZW5lcih3aW5kb3csICdoYXNoY2hhbmdlJywgX2NoZWNrSGlzdG9yeSk7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYoX2lzTGVnYWN5SUUpe1xuICAgICAgICAgICAgICAgICAgICBpZighIF9mcmFtZSl7XG4gICAgICAgICAgICAgICAgICAgICAgICBfY3JlYXRlRnJhbWUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBfdXBkYXRlRnJhbWUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2NoZWNrSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChfY2hlY2tIaXN0b3J5LCBQT09MX0lOVEVSVkFMKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX2lzQWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgIGhhc2hlci5pbml0aWFsaXplZC5kaXNwYXRjaChfdHJpbUhhc2goX2hhc2gpKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBsaXN0ZW5pbmcvZGlzcGF0Y2hpbmcgY2hhbmdlcyBpbiB0aGUgaGFzaC9oaXN0b3J5LlxuICAgICAgICAgKiA8dWw+XG4gICAgICAgICAqICAgPGxpPmhhc2hlciB3b24ndCBkaXNwYXRjaCBDSEFOR0UgZXZlbnRzIGJ5IG1hbnVhbGx5IHR5cGluZyBhIG5ldyB2YWx1ZSBvciBwcmVzc2luZyB0aGUgYmFjay9mb3J3YXJkIGJ1dHRvbnMgYWZ0ZXIgY2FsbGluZyB0aGlzIG1ldGhvZCwgdW5sZXNzIHlvdSBjYWxsIGhhc2hlci5pbml0KCkgYWdhaW4uPC9saT5cbiAgICAgICAgICogICA8bGk+aGFzaGVyIHdpbGwgc3RpbGwgZGlzcGF0Y2ggY2hhbmdlcyBtYWRlIHByb2dyYW1hdGljYWxseSBieSBjYWxsaW5nIGhhc2hlci5zZXRIYXNoKCk7PC9saT5cbiAgICAgICAgICogPC91bD5cbiAgICAgICAgICovXG4gICAgICAgIHN0b3AgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgaWYoISBfaXNBY3RpdmUpIHJldHVybjtcblxuICAgICAgICAgICAgaWYoX2lzSGFzaENoYW5nZVN1cHBvcnRlZCl7XG4gICAgICAgICAgICAgICAgX3JlbW92ZUxpc3RlbmVyKHdpbmRvdywgJ2hhc2hjaGFuZ2UnLCBfY2hlY2tIaXN0b3J5KTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoX2NoZWNrSW50ZXJ2YWwpO1xuICAgICAgICAgICAgICAgIF9jaGVja0ludGVydmFsID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX2lzQWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICBoYXNoZXIuc3RvcHBlZC5kaXNwYXRjaChfdHJpbUhhc2goX2hhc2gpKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gICAgSWYgaGFzaGVyIGlzIGxpc3RlbmluZyB0byBjaGFuZ2VzIG9uIHRoZSBicm93c2VyIGhpc3RvcnkgYW5kL29yIGhhc2ggdmFsdWUuXG4gICAgICAgICAqL1xuICAgICAgICBpc0FjdGl2ZSA6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICByZXR1cm4gX2lzQWN0aXZlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IEZ1bGwgVVJMLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0VVJMIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiB3aW5kb3cubG9jYXRpb24uaHJlZjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBSZXRyaWV2ZSBVUkwgd2l0aG91dCBxdWVyeSBzdHJpbmcgYW5kIGhhc2guXG4gICAgICAgICAqL1xuICAgICAgICBnZXRCYXNlVVJMIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiBoYXNoZXIuZ2V0VVJMKCkucmVwbGFjZShfYmFzZVVybFJlZ2V4cCwgJycpOyAvL3JlbW92ZXMgZXZlcnl0aGluZyBhZnRlciAnPycgYW5kL29yICcjJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgSGFzaCB2YWx1ZSwgZ2VuZXJhdGluZyBhIG5ldyBoaXN0b3J5IHJlY29yZC5cbiAgICAgICAgICogQHBhcmFtIHsuLi5zdHJpbmd9IHBhdGggICAgSGFzaCB2YWx1ZSB3aXRob3V0ICcjJy4gSGFzaGVyIHdpbGwgam9pblxuICAgICAgICAgKiBwYXRoIHNlZ21lbnRzIHVzaW5nIGBoYXNoZXIuc2VwYXJhdG9yYCBhbmQgcHJlcGVuZC9hcHBlbmQgaGFzaCB2YWx1ZVxuICAgICAgICAgKiB3aXRoIGBoYXNoZXIuYXBwZW5kSGFzaGAgYW5kIGBoYXNoZXIucHJlcGVuZEhhc2hgXG4gICAgICAgICAqIEBleGFtcGxlIGhhc2hlci5zZXRIYXNoKCdsb3JlbScsICdpcHN1bScsICdkb2xvcicpIC0+ICcjL2xvcmVtL2lwc3VtL2RvbG9yJ1xuICAgICAgICAgKi9cbiAgICAgICAgc2V0SGFzaCA6IGZ1bmN0aW9uKHBhdGgpe1xuICAgICAgICAgICAgcGF0aCA9IF9tYWtlUGF0aC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgaWYocGF0aCAhPT0gX2hhc2gpe1xuICAgICAgICAgICAgICAgIC8vIHdlIHNob3VsZCBzdG9yZSByYXcgdmFsdWVcbiAgICAgICAgICAgICAgICBfcmVnaXN0ZXJDaGFuZ2UocGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGggPT09IF9oYXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIGNoZWNrIGlmIHBhdGggaXMgc3RpbGwgPT09IF9oYXNoIHRvIGF2b2lkIGVycm9yIGluXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhc2Ugb2YgbXVsdGlwbGUgY29uc2VjdXRpdmUgcmVkaXJlY3RzIFtpc3N1ZSAjMzldXG4gICAgICAgICAgICAgICAgICAgIGlmICghIGhhc2hlci5yYXcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGggPSBfZW5jb2RlUGF0aChwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9ICcjJyArIHBhdGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgSGFzaCB2YWx1ZSB3aXRob3V0IGtlZXBpbmcgcHJldmlvdXMgaGFzaCBvbiB0aGUgaGlzdG9yeSByZWNvcmQuXG4gICAgICAgICAqIFNpbWlsYXIgdG8gY2FsbGluZyBgd2luZG93LmxvY2F0aW9uLnJlcGxhY2UoXCIjL2hhc2hcIilgIGJ1dCB3aWxsIGFsc28gd29yayBvbiBJRTYtNy5cbiAgICAgICAgICogQHBhcmFtIHsuLi5zdHJpbmd9IHBhdGggICAgSGFzaCB2YWx1ZSB3aXRob3V0ICcjJy4gSGFzaGVyIHdpbGwgam9pblxuICAgICAgICAgKiBwYXRoIHNlZ21lbnRzIHVzaW5nIGBoYXNoZXIuc2VwYXJhdG9yYCBhbmQgcHJlcGVuZC9hcHBlbmQgaGFzaCB2YWx1ZVxuICAgICAgICAgKiB3aXRoIGBoYXNoZXIuYXBwZW5kSGFzaGAgYW5kIGBoYXNoZXIucHJlcGVuZEhhc2hgXG4gICAgICAgICAqIEBleGFtcGxlIGhhc2hlci5yZXBsYWNlSGFzaCgnbG9yZW0nLCAnaXBzdW0nLCAnZG9sb3InKSAtPiAnIy9sb3JlbS9pcHN1bS9kb2xvcidcbiAgICAgICAgICovXG4gICAgICAgIHJlcGxhY2VIYXNoIDogZnVuY3Rpb24ocGF0aCl7XG4gICAgICAgICAgICBwYXRoID0gX21ha2VQYXRoLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBpZihwYXRoICE9PSBfaGFzaCl7XG4gICAgICAgICAgICAgICAgLy8gd2Ugc2hvdWxkIHN0b3JlIHJhdyB2YWx1ZVxuICAgICAgICAgICAgICAgIF9yZWdpc3RlckNoYW5nZShwYXRoLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBpZiAocGF0aCA9PT0gX2hhc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgY2hlY2sgaWYgcGF0aCBpcyBzdGlsbCA9PT0gX2hhc2ggdG8gYXZvaWQgZXJyb3IgaW5cbiAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSBvZiBtdWx0aXBsZSBjb25zZWN1dGl2ZSByZWRpcmVjdHMgW2lzc3VlICMzOV1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEgaGFzaGVyLnJhdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCA9IF9lbmNvZGVQYXRoKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZXBsYWNlKCcjJyArIHBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBIYXNoIHZhbHVlIHdpdGhvdXQgJyMnLCBgaGFzaGVyLmFwcGVuZEhhc2hgIGFuZCBgaGFzaGVyLnByZXBlbmRIYXNoYC5cbiAgICAgICAgICovXG4gICAgICAgIGdldEhhc2ggOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgLy9kaWRuJ3QgdXNlZCBhY3R1YWwgdmFsdWUgb2YgdGhlIGB3aW5kb3cubG9jYXRpb24uaGFzaGAgdG8gYXZvaWQgYnJlYWtpbmcgdGhlIGFwcGxpY2F0aW9uIGluIGNhc2UgYHdpbmRvdy5sb2NhdGlvbi5oYXNoYCBpc24ndCBhdmFpbGFibGUgYW5kIGFsc28gYmVjYXVzZSB2YWx1ZSBzaG91bGQgYWx3YXlzIGJlIHN5bmNoZWQuXG4gICAgICAgICAgICByZXR1cm4gX3RyaW1IYXNoKF9oYXNoKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7QXJyYXkuPHN0cmluZz59IEhhc2ggdmFsdWUgc3BsaXQgaW50byBhbiBBcnJheS5cbiAgICAgICAgICovXG4gICAgICAgIGdldEhhc2hBc0FycmF5IDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiBoYXNoZXIuZ2V0SGFzaCgpLnNwbGl0KGhhc2hlci5zZXBhcmF0b3IpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmVzIGFsbCBldmVudCBsaXN0ZW5lcnMsIHN0b3BzIGhhc2hlciBhbmQgZGVzdHJveSBoYXNoZXIgb2JqZWN0LlxuICAgICAgICAgKiAtIElNUE9SVEFOVDogaGFzaGVyIHdvbid0IHdvcmsgYWZ0ZXIgY2FsbGluZyB0aGlzIG1ldGhvZCwgaGFzaGVyIE9iamVjdCB3aWxsIGJlIGRlbGV0ZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkaXNwb3NlIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGhhc2hlci5zdG9wKCk7XG4gICAgICAgICAgICBoYXNoZXIuaW5pdGlhbGl6ZWQuZGlzcG9zZSgpO1xuICAgICAgICAgICAgaGFzaGVyLnN0b3BwZWQuZGlzcG9zZSgpO1xuICAgICAgICAgICAgaGFzaGVyLmNoYW5nZWQuZGlzcG9zZSgpO1xuICAgICAgICAgICAgX2ZyYW1lID0gaGFzaGVyID0gd2luZG93Lmhhc2hlciA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gQSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiAnW2hhc2hlciB2ZXJzaW9uPVwiJysgaGFzaGVyLlZFUlNJT04gKydcIiBoYXNoPVwiJysgaGFzaGVyLmdldEhhc2goKSArJ1wiXSc7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBoYXNoZXIuaW5pdGlhbGl6ZWQubWVtb3JpemUgPSB0cnVlOyAvL3NlZSAjMzNcblxuICAgIHJldHVybiBoYXNoZXI7XG5cbn0od2luZG93KSk7XG5cblxuICAgIHJldHVybiBoYXNoZXI7XG59O1xuXG5pZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFsnc2lnbmFscyddLCBmYWN0b3J5KTtcbn0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUoJ3NpZ25hbHMnKSk7XG59IGVsc2Uge1xuICAgIC8qanNoaW50IHN1Yjp0cnVlICovXG4gICAgd2luZG93WydoYXNoZXInXSA9IGZhY3Rvcnkod2luZG93WydzaWduYWxzJ10pO1xufVxuXG59KCkpO1xuIiwibW9kdWxlLmV4cG9ydHM9cmVxdWlyZShcIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9jcm9zc3JvYWRzL25vZGVfbW9kdWxlcy9zaWduYWxzL2Rpc3Qvc2lnbmFscy5qc1wiKSIsInZhciByZXNvbHZlID0gcmVxdWlyZSgnc291bmRjbG91ZC1yZXNvbHZlJylcbnZhciBmb250cyA9IHJlcXVpcmUoJ2dvb2dsZS1mb250cycpXG52YXIgbWluc3RhY2hlID0gcmVxdWlyZSgnbWluc3RhY2hlJylcbnZhciBpbnNlcnQgPSByZXF1aXJlKCdpbnNlcnQtY3NzJylcbnZhciBmcyA9IHJlcXVpcmUoJ2ZzJylcblxudmFyIGljb25zID0ge1xuICAgIGJsYWNrOiAnaHR0cDovL2RldmVsb3BlcnMuc291bmRjbG91ZC5jb20vYXNzZXRzL2xvZ29fYmxhY2sucG5nJ1xuICAsIHdoaXRlOiAnaHR0cDovL2RldmVsb3BlcnMuc291bmRjbG91ZC5jb20vYXNzZXRzL2xvZ29fd2hpdGUucG5nJ1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJhZGdlXG5mdW5jdGlvbiBub29wKGVycil7IGlmIChlcnIpIHRocm93IGVyciB9XG5cbnZhciBpbnNlcnRlZCA9IGZhbHNlXG52YXIgZ3dmYWRkZWQgPSBmYWxzZVxudmFyIHRlbXBsYXRlID0gbnVsbFxuXG5mdW5jdGlvbiBiYWRnZShvcHRpb25zLCBjYWxsYmFjaykge1xuICBpZiAoIWluc2VydGVkKSBpbnNlcnQoXCIubnBtLXNjYi13cmFwIHtcXG4gIGZvbnQtZmFtaWx5OiAnT3BlbiBTYW5zJywgJ0hlbHZldGljYSBOZXVlJywgSGVsdmV0aWNhLCBBcmlhbCwgc2Fucy1zZXJpZjtcXG4gIGZvbnQtd2VpZ2h0OiAyMDA7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IDA7XFxuICBsZWZ0OiAwO1xcbiAgei1pbmRleDogOTk5O1xcbn1cXG5cXG4ubnBtLXNjYi13cmFwIGEge1xcbiAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xcbiAgY29sb3I6ICMwMDA7XFxufVxcbi5ucG0tc2NiLXdoaXRlXFxuLm5wbS1zY2Itd3JhcCBhIHtcXG4gIGNvbG9yOiAjZmZmO1xcbn1cXG5cXG4ubnBtLXNjYi1pbm5lciB7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IC0xMjBweDsgbGVmdDogMDtcXG4gIHBhZGRpbmc6IDhweDtcXG4gIHdpZHRoOiAxMDAlO1xcbiAgaGVpZ2h0OiAxNTBweDtcXG4gIHotaW5kZXg6IDI7XFxuICAtd2Via2l0LXRyYW5zaXRpb246IHdpZHRoIDAuNXMgY3ViaWMtYmV6aWVyKDEsIDAsIDAsIDEpLCB0b3AgMC41cztcXG4gICAgIC1tb3otdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbiAgICAgIC1tcy10cmFuc2l0aW9uOiB3aWR0aCAwLjVzIGN1YmljLWJlemllcigxLCAwLCAwLCAxKSwgdG9wIDAuNXM7XFxuICAgICAgIC1vLXRyYW5zaXRpb246IHdpZHRoIDAuNXMgY3ViaWMtYmV6aWVyKDEsIDAsIDAsIDEpLCB0b3AgMC41cztcXG4gICAgICAgICAgdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbn1cXG4ubnBtLXNjYi13cmFwOmhvdmVyXFxuLm5wbS1zY2ItaW5uZXIge1xcbiAgdG9wOiAwO1xcbn1cXG5cXG4ubnBtLXNjYi1hcnR3b3JrIHtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHRvcDogMTZweDsgbGVmdDogMTZweDtcXG4gIHdpZHRoOiAxMDRweDsgaGVpZ2h0OiAxMDRweDtcXG4gIGJveC1zaGFkb3c6IDAgMCA4cHggLTNweCAjMDAwO1xcbiAgb3V0bGluZTogMXB4IHNvbGlkIHJnYmEoMCwwLDAsMC4xKTtcXG4gIHotaW5kZXg6IDI7XFxufVxcbi5ucG0tc2NiLXdoaXRlXFxuLm5wbS1zY2ItYXJ0d29yayB7XFxuICBvdXRsaW5lOiAxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjEpO1xcbiAgYm94LXNoYWRvdzogMCAwIDEwcHggLTJweCByZ2JhKDI1NSwyNTUsMjU1LDAuOSk7XFxufVxcblxcbi5ucG0tc2NiLWluZm8ge1xcbiAgcG9zaXRpb246IGFic29sdXRlO1xcbiAgdG9wOiAxNnB4O1xcbiAgbGVmdDogMTIwcHg7XFxuICB3aWR0aDogMzAwcHg7XFxuICB6LWluZGV4OiAxO1xcbn1cXG5cXG4ubnBtLXNjYi1pbmZvID4gYSB7XFxuICBkaXNwbGF5OiBibG9jaztcXG59XFxuXFxuLm5wbS1zY2Itbm93LXBsYXlpbmcge1xcbiAgZm9udC1zaXplOiAxMnB4O1xcbiAgbGluZS1oZWlnaHQ6IDEycHg7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB3aWR0aDogNTAwcHg7XFxuICB6LWluZGV4OiAxO1xcbiAgcGFkZGluZzogMTVweCAwO1xcbiAgdG9wOiAwOyBsZWZ0OiAxMzhweDtcXG4gIG9wYWNpdHk6IDE7XFxuICAtd2Via2l0LXRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XFxuICAgICAtbW96LXRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XFxuICAgICAgLW1zLXRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XFxuICAgICAgIC1vLXRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XFxuICAgICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4yNXM7XFxufVxcblxcbi5ucG0tc2NiLXdyYXA6aG92ZXJcXG4ubnBtLXNjYi1ub3ctcGxheWluZyB7XFxuICBvcGFjaXR5OiAwO1xcbn1cXG5cXG4ubnBtLXNjYi13aGl0ZVxcbi5ucG0tc2NiLW5vdy1wbGF5aW5nIHtcXG4gIGNvbG9yOiAjZmZmO1xcbn1cXG4ubnBtLXNjYi1ub3ctcGxheWluZyA+IGEge1xcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XFxufVxcblxcbi5ucG0tc2NiLWluZm8gPiBhID4gcCB7XFxuICBtYXJnaW46IDA7XFxuICBwYWRkaW5nLWJvdHRvbTogMC4yNWVtO1xcbiAgbGluZS1oZWlnaHQ6IDEuMzVlbTtcXG4gIG1hcmdpbi1sZWZ0OiAxZW07XFxuICBmb250LXNpemU6IDFlbTtcXG59XFxuXFxuLm5wbS1zY2ItdGl0bGUge1xcbiAgZm9udC13ZWlnaHQ6IGJvbGQ7XFxufVxcblxcbi5ucG0tc2NiLWljb24ge1xcbiAgcG9zaXRpb246IGFic29sdXRlO1xcbiAgdG9wOiAxMjBweDtcXG4gIHBhZGRpbmctdG9wOiAwLjc1ZW07XFxuICBsZWZ0OiAxNnB4O1xcbn1cXG5cIiksIGluc2VydGVkID0gdHJ1ZVxuICBpZiAoIXRlbXBsYXRlKSB0ZW1wbGF0ZSA9IG1pbnN0YWNoZS5jb21waWxlKFwiPGRpdiBjbGFzcz1cXFwibnBtLXNjYi13cmFwXFxcIj5cXG4gIDxkaXYgY2xhc3M9XFxcIm5wbS1zY2ItaW5uZXJcXFwiPlxcbiAgICA8YSB0YXJnZXQ9XFxcIl9ibGFua1xcXCIgaHJlZj1cXFwie3t1cmxzLnNvbmd9fVxcXCI+XFxuICAgICAgPGltZyBjbGFzcz1cXFwibnBtLXNjYi1pY29uXFxcIiBzcmM9XFxcInt7aWNvbn19XFxcIj5cXG4gICAgICA8aW1nIGNsYXNzPVxcXCJucG0tc2NiLWFydHdvcmtcXFwiIHNyYz1cXFwie3thcnR3b3JrfX1cXFwiPlxcbiAgICA8L2E+XFxuICAgIDxkaXYgY2xhc3M9XFxcIm5wbS1zY2ItaW5mb1xcXCI+XFxuICAgICAgPGEgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiIGhyZWY9XFxcInt7dXJscy5zb25nfX1cXFwiPlxcbiAgICAgICAgPHAgY2xhc3M9XFxcIm5wbS1zY2ItdGl0bGVcXFwiPnt7dGl0bGV9fTwvcD5cXG4gICAgICA8L2E+XFxuICAgICAgPGEgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiIGhyZWY9XFxcInt7dXJscy5hcnRpc3R9fVxcXCI+XFxuICAgICAgICA8cCBjbGFzcz1cXFwibnBtLXNjYi1hcnRpc3RcXFwiPnt7YXJ0aXN0fX08L3A+XFxuICAgICAgPC9hPlxcbiAgICA8L2Rpdj5cXG4gIDwvZGl2PlxcbiAgPGRpdiBjbGFzcz1cXFwibnBtLXNjYi1ub3ctcGxheWluZ1xcXCI+XFxuICAgIE5vdyBQbGF5aW5nOlxcbiAgICA8YSBocmVmPVxcXCJ7e3VybHMuc29uZ319XFxcIj57e3RpdGxlfX08L2E+XFxuICAgIGJ5XFxuICAgIDxhIGhyZWY9XFxcInt7dXJscy5hcnRpc3R9fVxcXCI+e3thcnRpc3R9fTwvYT5cXG4gIDwvZGl2PlxcbjwvZGl2PlxcblwiKVxuXG4gIGlmICghZ3dmYWRkZWQgJiYgb3B0aW9ucy5nZXRGb250cykge1xuICAgIGZvbnRzLmFkZCh7ICdPcGVuIFNhbnMnOiBbMzAwLCA2MDBdIH0pXG4gICAgZ3dmYWRkZWQgPSB0cnVlXG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICBjYWxsYmFjayA9IGNhbGxiYWNrIHx8IG5vb3BcblxuICB2YXIgZGl2ICAgPSBvcHRpb25zLmVsIHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG4gIHZhciBpY29uICA9ICEoJ2RhcmsnIGluIG9wdGlvbnMpIHx8IG9wdGlvbnMuZGFyayA/ICdibGFjaycgOiAnd2hpdGUnXG4gIHZhciBpZCAgICA9IG9wdGlvbnMuY2xpZW50X2lkXG4gIHZhciBzb25nICA9IG9wdGlvbnMuc29uZ1xuXG4gIHJlc29sdmUoaWQsIHNvbmcsIGZ1bmN0aW9uKGVyciwganNvbikge1xuICAgIGlmIChlcnIpIHJldHVybiBjYWxsYmFjayhlcnIpXG4gICAgaWYgKGpzb24ua2luZCAhPT0gJ3RyYWNrJykgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ3NvdW5kY2xvdWQtYmFkZ2Ugb25seSBzdXBwb3J0cyBpbmRpdmlkdWFsIHRyYWNrcyBhdCB0aGUgbW9tZW50J1xuICAgIClcblxuICAgIGRpdi5jbGFzc0xpc3RbXG4gICAgICBpY29uID09PSAnYmxhY2snID8gJ3JlbW92ZScgOiAnYWRkJ1xuICAgIF0oJ25wbS1zY2Itd2hpdGUnKVxuXG4gICAgZGl2LmlubmVySFRNTCA9IHRlbXBsYXRlKHtcbiAgICAgICAgYXJ0d29yazoganNvbi5hcnR3b3JrX3VybCB8fCBqc29uLnVzZXIuYXZhdGFyX3VybFxuICAgICAgLCBhcnRpc3Q6IGpzb24udXNlci51c2VybmFtZVxuICAgICAgLCB0aXRsZToganNvbi50aXRsZVxuICAgICAgLCBpY29uOiBpY29uc1tpY29uXVxuICAgICAgLCB1cmxzOiB7XG4gICAgICAgICAgc29uZzoganNvbi5wZXJtYWxpbmtfdXJsXG4gICAgICAgICwgYXJ0aXN0OiBqc29uLnVzZXIucGVybWFsaW5rX3VybFxuICAgICAgfVxuICAgIH0pXG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpdilcblxuICAgIGNhbGxiYWNrKG51bGwsIGpzb24uc3RyZWFtX3VybCArICc/Y2xpZW50X2lkPScgKyBpZCwganNvbiwgZGl2KVxuICB9KVxuXG4gIHJldHVybiBkaXZcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gYXNTdHJpbmdcbm1vZHVsZS5leHBvcnRzLmFkZCA9IGFwcGVuZFxuXG5mdW5jdGlvbiBhc1N0cmluZyhmb250cykge1xuICB2YXIgaHJlZiA9IGdldEhyZWYoZm9udHMpXG4gIHJldHVybiAnPGxpbmsgaHJlZj1cIicgKyBocmVmICsgJ1wiIHJlbD1cInN0eWxlc2hlZXRcIiB0eXBlPVwidGV4dC9jc3NcIj4nXG59XG5cbmZ1bmN0aW9uIGFzRWxlbWVudChmb250cykge1xuICB2YXIgaHJlZiA9IGdldEhyZWYoZm9udHMpXG4gIHZhciBsaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGluaycpXG4gIGxpbmsuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZilcbiAgbGluay5zZXRBdHRyaWJ1dGUoJ3JlbCcsICdzdHlsZXNoZWV0JylcbiAgbGluay5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9jc3MnKVxuICByZXR1cm4gbGlua1xufVxuXG5mdW5jdGlvbiBnZXRIcmVmKGZvbnRzKSB7XG4gIHZhciBmYW1pbHkgPSBPYmplY3Qua2V5cyhmb250cykubWFwKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgZGV0YWlscyA9IGZvbnRzW25hbWVdXG4gICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvXFxzKy8sICcrJylcbiAgICByZXR1cm4gdHlwZW9mIGRldGFpbHMgPT09ICdib29sZWFuJ1xuICAgICAgPyBuYW1lXG4gICAgICA6IG5hbWUgKyAnOicgKyBtYWtlQXJyYXkoZGV0YWlscykuam9pbignLCcpXG4gIH0pLmpvaW4oJ3wnKVxuXG4gIHJldHVybiAnaHR0cDovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2Nzcz9mYW1pbHk9JyArIGZhbWlseVxufVxuXG5mdW5jdGlvbiBhcHBlbmQoZm9udHMpIHtcbiAgdmFyIGxpbmsgPSBhc0VsZW1lbnQoZm9udHMpXG4gIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQobGluaylcbiAgcmV0dXJuIGxpbmtcbn1cblxuZnVuY3Rpb24gbWFrZUFycmF5KGFycikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcnIpID8gYXJyIDogW2Fycl1cbn1cbiIsInZhciBpbnNlcnRlZCA9IFtdO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjc3MpIHtcbiAgICBpZiAoaW5zZXJ0ZWQuaW5kZXhPZihjc3MpID49IDApIHJldHVybjtcbiAgICBpbnNlcnRlZC5wdXNoKGNzcyk7XG4gICAgXG4gICAgdmFyIGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHZhciB0ZXh0ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKTtcbiAgICBlbGVtLmFwcGVuZENoaWxkKHRleHQpO1xuICAgIFxuICAgIGlmIChkb2N1bWVudC5oZWFkLmNoaWxkTm9kZXMubGVuZ3RoKSB7XG4gICAgICAgIGRvY3VtZW50LmhlYWQuaW5zZXJ0QmVmb3JlKGVsZW0sIGRvY3VtZW50LmhlYWQuY2hpbGROb2Rlc1swXSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGVsZW0pO1xuICAgIH1cbn07XG4iLCJcbi8qKlxuICogRXhwb3NlIGByZW5kZXIoKWAuYFxuICovXG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlbmRlcjtcblxuLyoqXG4gKiBFeHBvc2UgYGNvbXBpbGUoKWAuXG4gKi9cblxuZXhwb3J0cy5jb21waWxlID0gY29tcGlsZTtcblxuLyoqXG4gKiBSZW5kZXIgdGhlIGdpdmVuIG11c3RhY2hlIGBzdHJgIHdpdGggYG9iamAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiByZW5kZXIoc3RyLCBvYmopIHtcbiAgb2JqID0gb2JqIHx8IHt9O1xuICB2YXIgZm4gPSBjb21waWxlKHN0cik7XG4gIHJldHVybiBmbihvYmopO1xufVxuXG4vKipcbiAqIENvbXBpbGUgdGhlIGdpdmVuIGBzdHJgIHRvIGEgYEZ1bmN0aW9uYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZShzdHIpIHtcbiAgdmFyIGpzID0gW107XG4gIHZhciB0b2tzID0gcGFyc2Uoc3RyKTtcbiAgdmFyIHRvaztcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHRva3MubGVuZ3RoOyArK2kpIHtcbiAgICB0b2sgPSB0b2tzW2ldO1xuICAgIGlmIChpICUgMiA9PSAwKSB7XG4gICAgICBqcy5wdXNoKCdcIicgKyB0b2sucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpICsgJ1wiJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAodG9rWzBdKSB7XG4gICAgICAgIGNhc2UgJy8nOlxuICAgICAgICAgIHRvayA9IHRvay5zbGljZSgxKTtcbiAgICAgICAgICBqcy5wdXNoKCcpICsgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ14nOlxuICAgICAgICAgIHRvayA9IHRvay5zbGljZSgxKTtcbiAgICAgICAgICBhc3NlcnRQcm9wZXJ0eSh0b2spO1xuICAgICAgICAgIGpzLnB1c2goJyArIHNlY3Rpb24ob2JqLCBcIicgKyB0b2sgKyAnXCIsIHRydWUsICcpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICcjJzpcbiAgICAgICAgICB0b2sgPSB0b2suc2xpY2UoMSk7XG4gICAgICAgICAgYXNzZXJ0UHJvcGVydHkodG9rKTtcbiAgICAgICAgICBqcy5wdXNoKCcgKyBzZWN0aW9uKG9iaiwgXCInICsgdG9rICsgJ1wiLCBmYWxzZSwgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgIHRvayA9IHRvay5zbGljZSgxKTtcbiAgICAgICAgICBhc3NlcnRQcm9wZXJ0eSh0b2spO1xuICAgICAgICAgIGpzLnB1c2goJyArIG9iai4nICsgdG9rICsgJyArICcpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGFzc2VydFByb3BlcnR5KHRvayk7XG4gICAgICAgICAganMucHVzaCgnICsgZXNjYXBlKG9iai4nICsgdG9rICsgJykgKyAnKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBqcyA9ICdcXG4nXG4gICAgKyBpbmRlbnQoZXNjYXBlLnRvU3RyaW5nKCkpICsgJztcXG5cXG4nXG4gICAgKyBpbmRlbnQoc2VjdGlvbi50b1N0cmluZygpKSArICc7XFxuXFxuJ1xuICAgICsgJyAgcmV0dXJuICcgKyBqcy5qb2luKCcnKS5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJyk7XG5cbiAgcmV0dXJuIG5ldyBGdW5jdGlvbignb2JqJywganMpO1xufVxuXG4vKipcbiAqIEFzc2VydCB0aGF0IGBwcm9wYCBpcyBhIHZhbGlkIHByb3BlcnR5LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBhc3NlcnRQcm9wZXJ0eShwcm9wKSB7XG4gIGlmICghcHJvcC5tYXRjaCgvXltcXHcuXSskLykpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBwcm9wZXJ0eSBcIicgKyBwcm9wICsgJ1wiJyk7XG59XG5cbi8qKlxuICogUGFyc2UgYHN0cmAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShzdHIpIHtcbiAgcmV0dXJuIHN0ci5zcGxpdCgvXFx7XFx7fFxcfVxcfS8pO1xufVxuXG4vKipcbiAqIEluZGVudCBgc3RyYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBpbmRlbnQoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXi9nbSwgJyAgJyk7XG59XG5cbi8qKlxuICogU2VjdGlvbiBoYW5kbGVyLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb250ZXh0IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gbmVnYXRlXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBzZWN0aW9uKG9iaiwgcHJvcCwgbmVnYXRlLCBzdHIpIHtcbiAgdmFyIHZhbCA9IG9ialtwcm9wXTtcbiAgaWYgKCdmdW5jdGlvbicgPT0gdHlwZW9mIHZhbCkgcmV0dXJuIHZhbC5jYWxsKG9iaiwgc3RyKTtcbiAgaWYgKG5lZ2F0ZSkgdmFsID0gIXZhbDtcbiAgaWYgKHZhbCkgcmV0dXJuIHN0cjtcbiAgcmV0dXJuICcnO1xufVxuXG4vKipcbiAqIEVzY2FwZSB0aGUgZ2l2ZW4gYGh0bWxgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBodG1sXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBlc2NhcGUoaHRtbCkge1xuICByZXR1cm4gU3RyaW5nKGh0bWwpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXG4gICAgLnJlcGxhY2UoLzwvZywgJyZsdDsnKVxuICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7Jyk7XG59XG4iLCJ2YXIgcXMgID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKVxudmFyIHhociA9IHJlcXVpcmUoJ3hocicpXG5cbm1vZHVsZS5leHBvcnRzID0gcmVzb2x2ZVxuXG5mdW5jdGlvbiByZXNvbHZlKGlkLCBnb2FsLCBjYWxsYmFjaykge1xuICB2YXIgdXJpID0gJ2h0dHA6Ly9hcGkuc291bmRjbG91ZC5jb20vcmVzb2x2ZS5qc29uPycgKyBxcy5zdHJpbmdpZnkoe1xuICAgICAgdXJsOiBnb2FsXG4gICAgLCBjbGllbnRfaWQ6IGlkXG4gIH0pXG5cbiAgeGhyKHtcbiAgICAgIHVyaTogdXJpXG4gICAgLCBtZXRob2Q6ICdHRVQnXG4gIH0sIGZ1bmN0aW9uKGVyciwgcmVzLCBib2R5KSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICB0cnkge1xuICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlKVxuICAgIH1cbiAgICBpZiAoYm9keS5lcnJvcnMpIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoXG4gICAgICBib2R5LmVycm9yc1swXS5lcnJvcl9tZXNzYWdlXG4gICAgKSlcbiAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgYm9keSlcbiAgfSlcbn1cbiIsInZhciB3aW5kb3cgPSByZXF1aXJlKFwiZ2xvYmFsL3dpbmRvd1wiKVxudmFyIG9uY2UgPSByZXF1aXJlKFwib25jZVwiKVxuXG52YXIgbWVzc2FnZXMgPSB7XG4gICAgXCIwXCI6IFwiSW50ZXJuYWwgWE1MSHR0cFJlcXVlc3QgRXJyb3JcIixcbiAgICBcIjRcIjogXCI0eHggQ2xpZW50IEVycm9yXCIsXG4gICAgXCI1XCI6IFwiNXh4IFNlcnZlciBFcnJvclwiXG59XG5cbnZhciBYSFIgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgfHwgbm9vcFxudmFyIFhEUiA9IFwid2l0aENyZWRlbnRpYWxzXCIgaW4gKG5ldyBYSFIoKSkgP1xuICAgICAgICB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgOiB3aW5kb3cuWERvbWFpblJlcXVlc3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVYSFJcblxuZnVuY3Rpb24gY3JlYXRlWEhSKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIG9wdGlvbnMgPSB7IHVyaTogb3B0aW9ucyB9XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICBjYWxsYmFjayA9IG9uY2UoY2FsbGJhY2spXG5cbiAgICB2YXIgeGhyXG5cbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhociA9IG5ldyBYRFIoKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHhociA9IG5ldyBYSFIoKVxuICAgIH1cblxuICAgIHZhciB1cmkgPSB4aHIudXJsID0gb3B0aW9ucy51cmlcbiAgICB2YXIgbWV0aG9kID0geGhyLm1ldGhvZCA9IG9wdGlvbnMubWV0aG9kIHx8IFwiR0VUXCJcbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keSB8fCBvcHRpb25zLmRhdGFcbiAgICB2YXIgaGVhZGVycyA9IHhoci5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIHx8IHt9XG4gICAgdmFyIGlzSnNvbiA9IGZhbHNlXG5cbiAgICBpZiAoXCJqc29uXCIgaW4gb3B0aW9ucykge1xuICAgICAgICBpc0pzb24gPSB0cnVlXG4gICAgICAgIGhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0gPSBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICBib2R5ID0gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5qc29uKVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSByZWFkeXN0YXRlY2hhbmdlXG4gICAgeGhyLm9ubG9hZCA9IGxvYWRcbiAgICB4aHIub25lcnJvciA9IGVycm9yXG4gICAgLy8gSUU5IG11c3QgaGF2ZSBvbnByb2dyZXNzIGJlIHNldCB0byBhIHVuaXF1ZSBmdW5jdGlvbi5cbiAgICB4aHIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gSUUgbXVzdCBkaWVcbiAgICB9XG4gICAgLy8gaGF0ZSBJRVxuICAgIHhoci5vbnRpbWVvdXQgPSBub29wXG4gICAgeGhyLm9wZW4obWV0aG9kLCB1cmkpXG4gICAgaWYgKG9wdGlvbnMuY29ycykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gdHJ1ZVxuICAgIH1cbiAgICB4aHIudGltZW91dCA9IFwidGltZW91dFwiIGluIG9wdGlvbnMgPyBvcHRpb25zLnRpbWVvdXQgOiA1MDAwXG5cbiAgICBpZiAoIHhoci5zZXRSZXF1ZXN0SGVhZGVyKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGhlYWRlcnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCBoZWFkZXJzW2tleV0pXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgeGhyLnNlbmQoYm9keSlcblxuICAgIHJldHVybiB4aHJcblxuICAgIGZ1bmN0aW9uIHJlYWR5c3RhdGVjaGFuZ2UoKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgbG9hZCgpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkKCkge1xuICAgICAgICB2YXIgZXJyb3IgPSBudWxsXG4gICAgICAgIHZhciBzdGF0dXMgPSB4aHIuc3RhdHVzQ29kZSA9IHhoci5zdGF0dXNcbiAgICAgICAgdmFyIGJvZHkgPSB4aHIuYm9keSA9IHhoci5yZXNwb25zZSB8fFxuICAgICAgICAgICAgeGhyLnJlc3BvbnNlVGV4dCB8fCB4aHIucmVzcG9uc2VYTUxcblxuICAgICAgICBpZiAoc3RhdHVzID09PSAwIHx8IChzdGF0dXMgPj0gNDAwICYmIHN0YXR1cyA8IDYwMCkpIHtcbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0geGhyLnJlc3BvbnNlVGV4dCB8fFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzW1N0cmluZyh4aHIuc3RhdHVzKS5jaGFyQXQoMCldXG4gICAgICAgICAgICBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKVxuXG4gICAgICAgICAgICBlcnJvci5zdGF0dXNDb2RlID0geGhyLnN0YXR1c1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSnNvbikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBib2R5ID0geGhyLmJvZHkgPSBKU09OLnBhcnNlKGJvZHkpXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgICB9XG5cbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIHhociwgYm9keSlcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlcnJvcihldnQpIHtcbiAgICAgICAgY2FsbGJhY2soZXZ0LCB4aHIpXG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHdpbmRvd1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBnbG9iYWxcbn0gZWxzZSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7fVxufVxuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IG9uY2Vcblxub25jZS5wcm90byA9IG9uY2UoZnVuY3Rpb24gKCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnb25jZScsIHtcbiAgICB2YWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG9uY2UodGhpcylcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KVxufSlcblxuZnVuY3Rpb24gb25jZSAoZm4pIHtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGNhbGxlZCkgcmV0dXJuXG4gICAgY2FsbGVkID0gdHJ1ZVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gIH1cbn1cbiIsIi8vICAgICBVbmRlcnNjb3JlLmpzIDEuNy4wXG4vLyAgICAgaHR0cDovL3VuZGVyc2NvcmVqcy5vcmdcbi8vICAgICAoYykgMjAwOS0yMDE0IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4vLyAgICAgVW5kZXJzY29yZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIC8vIEJhc2VsaW5lIHNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRXN0YWJsaXNoIHRoZSByb290IG9iamVjdCwgYHdpbmRvd2AgaW4gdGhlIGJyb3dzZXIsIG9yIGBleHBvcnRzYCBvbiB0aGUgc2VydmVyLlxuICB2YXIgcm9vdCA9IHRoaXM7XG5cbiAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIGBfYCB2YXJpYWJsZS5cbiAgdmFyIHByZXZpb3VzVW5kZXJzY29yZSA9IHJvb3QuXztcblxuICAvLyBTYXZlIGJ5dGVzIGluIHRoZSBtaW5pZmllZCAoYnV0IG5vdCBnemlwcGVkKSB2ZXJzaW9uOlxuICB2YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSwgT2JqUHJvdG8gPSBPYmplY3QucHJvdG90eXBlLCBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgLy8gQ3JlYXRlIHF1aWNrIHJlZmVyZW5jZSB2YXJpYWJsZXMgZm9yIHNwZWVkIGFjY2VzcyB0byBjb3JlIHByb3RvdHlwZXMuXG4gIHZhclxuICAgIHB1c2ggICAgICAgICAgICAgPSBBcnJheVByb3RvLnB1c2gsXG4gICAgc2xpY2UgICAgICAgICAgICA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgY29uY2F0ICAgICAgICAgICA9IEFycmF5UHJvdG8uY29uY2F0LFxuICAgIHRvU3RyaW5nICAgICAgICAgPSBPYmpQcm90by50b1N0cmluZyxcbiAgICBoYXNPd25Qcm9wZXJ0eSAgID0gT2JqUHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbiAgLy8gQWxsICoqRUNNQVNjcmlwdCA1KiogbmF0aXZlIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9ucyB0aGF0IHdlIGhvcGUgdG8gdXNlXG4gIC8vIGFyZSBkZWNsYXJlZCBoZXJlLlxuICB2YXJcbiAgICBuYXRpdmVJc0FycmF5ICAgICAgPSBBcnJheS5pc0FycmF5LFxuICAgIG5hdGl2ZUtleXMgICAgICAgICA9IE9iamVjdC5rZXlzLFxuICAgIG5hdGl2ZUJpbmQgICAgICAgICA9IEZ1bmNQcm90by5iaW5kO1xuXG4gIC8vIENyZWF0ZSBhIHNhZmUgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgdXNlIGJlbG93LlxuICB2YXIgXyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBfKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfKSkgcmV0dXJuIG5ldyBfKG9iaik7XG4gICAgdGhpcy5fd3JhcHBlZCA9IG9iajtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuICAvLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4gIC8vIHRoZSBicm93c2VyLCBhZGQgYF9gIGFzIGEgZ2xvYmFsIG9iamVjdC5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gXztcbiAgICB9XG4gICAgZXhwb3J0cy5fID0gXztcbiAgfSBlbHNlIHtcbiAgICByb290Ll8gPSBfO1xuICB9XG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICBfLlZFUlNJT04gPSAnMS43LjAnO1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgLy8gZnVuY3Rpb25zLlxuICB2YXIgY3JlYXRlQ2FsbGJhY2sgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgIGlmIChjb250ZXh0ID09PSB2b2lkIDApIHJldHVybiBmdW5jO1xuICAgIHN3aXRjaCAoYXJnQ291bnQgPT0gbnVsbCA/IDMgOiBhcmdDb3VudCkge1xuICAgICAgY2FzZSAxOiByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgICAgY2FzZSAyOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIG90aGVyKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgdmFsdWUsIG90aGVyKTtcbiAgICAgIH07XG4gICAgICBjYXNlIDM6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICAgIGNhc2UgNDogcmV0dXJuIGZ1bmN0aW9uKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBBIG1vc3RseS1pbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBjYWxsYmFja3MgdGhhdCBjYW4gYmUgYXBwbGllZFxuICAvLyB0byBlYWNoIGVsZW1lbnQgaW4gYSBjb2xsZWN0aW9uLCByZXR1cm5pbmcgdGhlIGRlc2lyZWQgcmVzdWx0IOKAlCBlaXRoZXJcbiAgLy8gaWRlbnRpdHksIGFuIGFyYml0cmFyeSBjYWxsYmFjaywgYSBwcm9wZXJ0eSBtYXRjaGVyLCBvciBhIHByb3BlcnR5IGFjY2Vzc29yLlxuICBfLml0ZXJhdGVlID0gZnVuY3Rpb24odmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gY3JlYXRlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXModmFsdWUpO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgfTtcblxuICAvLyBDb2xsZWN0aW9uIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFRoZSBjb3JuZXJzdG9uZSwgYW4gYGVhY2hgIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIHJhdyBvYmplY3RzIGluIGFkZGl0aW9uIHRvIGFycmF5LWxpa2VzLiBUcmVhdHMgYWxsXG4gIC8vIHNwYXJzZSBhcnJheS1saWtlcyBhcyBpZiB0aGV5IHdlcmUgZGVuc2UuXG4gIF8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGksIGxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCA9PT0gK2xlbmd0aCkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdGVlKG9ialtpXSwgaSwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW2tleXNbaV1dLCBrZXlzW2ldLCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0ZWUgdG8gZWFjaCBlbGVtZW50LlxuICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBbXTtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICByZXN1bHRzID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgICAgY3VycmVudEtleTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IGl0ZXJhdGVlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgdmFyIHJlZHVjZUVycm9yID0gJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnO1xuXG4gIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgLy8gb3IgYGZvbGRsYC5cbiAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCA0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXggPSAwLCBjdXJyZW50S2V5O1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgaWYgKCFsZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgICAgbWVtbyA9IG9ialtrZXlzID8ga2V5c1tpbmRleCsrXSA6IGluZGV4KytdO1xuICAgIH1cbiAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIG1lbW8gPSBpdGVyYXRlZShtZW1vLCBvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIHJlZHVjZSwgYWxzbyBrbm93biBhcyBgZm9sZHJgLlxuICBfLnJlZHVjZVJpZ2h0ID0gXy5mb2xkciA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIG1lbW8sIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gKyBvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBpbmRleCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBjdXJyZW50S2V5O1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgaWYgKCFpbmRleCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgICBtZW1vID0gb2JqW2tleXMgPyBrZXlzWy0taW5kZXhdIDogLS1pbmRleF07XG4gICAgfVxuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBtZW1vID0gaXRlcmF0ZWUobWVtbywgb2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuIEFsaWFzZWQgYXMgYGRldGVjdGAuXG4gIF8uZmluZCA9IF8uZGV0ZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBfLnNvbWUob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUodmFsdWUsIGluZGV4LCBsaXN0KSkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBlbGVtZW50cyB0aGF0IHBhc3MgYSB0cnV0aCB0ZXN0LlxuICAvLyBBbGlhc2VkIGFzIGBzZWxlY3RgLlxuICBfLmZpbHRlciA9IF8uc2VsZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZSh2YWx1ZSwgaW5kZXgsIGxpc3QpKSByZXN1bHRzLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIF8ucmVqZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBfLm5lZ2F0ZShfLml0ZXJhdGVlKHByZWRpY2F0ZSkpLCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgd2hldGhlciBhbGwgb2YgdGhlIGVsZW1lbnRzIG1hdGNoIGEgdHJ1dGggdGVzdC5cbiAgLy8gQWxpYXNlZCBhcyBgYWxsYC5cbiAgXy5ldmVyeSA9IF8uYWxsID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBpZiAoIXByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIGF0IGxlYXN0IG9uZSBlbGVtZW50IGluIHRoZSBvYmplY3QgbWF0Y2hlcyBhIHRydXRoIHRlc3QuXG4gIC8vIEFsaWFzZWQgYXMgYGFueWAuXG4gIF8uc29tZSA9IF8uYW55ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIGluZGV4LCBjdXJyZW50S2V5O1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiB2YWx1ZSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZSA9IGZ1bmN0aW9uKG9iaiwgdGFyZ2V0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoKSBvYmogPSBfLnZhbHVlcyhvYmopO1xuICAgIHJldHVybiBfLmluZGV4T2Yob2JqLCB0YXJnZXQpID49IDA7XG4gIH07XG5cbiAgLy8gSW52b2tlIGEgbWV0aG9kICh3aXRoIGFyZ3VtZW50cykgb24gZXZlcnkgaXRlbSBpbiBhIGNvbGxlY3Rpb24uXG4gIF8uaW52b2tlID0gZnVuY3Rpb24ob2JqLCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgaXNGdW5jID0gXy5pc0Z1bmN0aW9uKG1ldGhvZCk7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiAoaXNGdW5jID8gbWV0aG9kIDogdmFsdWVbbWV0aG9kXSkuYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gIF8ucGx1Y2sgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmlsdGVyYDogc2VsZWN0aW5nIG9ubHkgb2JqZWN0c1xuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLndoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbmRgOiBnZXR0aW5nIHRoZSBmaXJzdCBvYmplY3RcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5maW5kV2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmluZChvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5tYXggPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IC1JbmZpbml0eSwgbGFzdENvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgIG9iaiA9IG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoID8gb2JqIDogXy52YWx1ZXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1pbmltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIF8ubWluID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQgPSBJbmZpbml0eSwgbGFzdENvbXB1dGVkID0gSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA8IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gSW5maW5pdHkgJiYgcmVzdWx0ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBTaHVmZmxlIGEgY29sbGVjdGlvbiwgdXNpbmcgdGhlIG1vZGVybiB2ZXJzaW9uIG9mIHRoZVxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVy4oCTWWF0ZXNfc2h1ZmZsZSkuXG4gIF8uc2h1ZmZsZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBzZXQgPSBvYmogJiYgb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBzZXQubGVuZ3RoO1xuICAgIHZhciBzaHVmZmxlZCA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwLCByYW5kOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgcmFuZCA9IF8ucmFuZG9tKDAsIGluZGV4KTtcbiAgICAgIGlmIChyYW5kICE9PSBpbmRleCkgc2h1ZmZsZWRbaW5kZXhdID0gc2h1ZmZsZWRbcmFuZF07XG4gICAgICBzaHVmZmxlZFtyYW5kXSA9IHNldFtpbmRleF07XG4gICAgfVxuICAgIHJldHVybiBzaHVmZmxlZDtcbiAgfTtcblxuICAvLyBTYW1wbGUgKipuKiogcmFuZG9tIHZhbHVlcyBmcm9tIGEgY29sbGVjdGlvbi5cbiAgLy8gSWYgKipuKiogaXMgbm90IHNwZWNpZmllZCwgcmV0dXJucyBhIHNpbmdsZSByYW5kb20gZWxlbWVudC5cbiAgLy8gVGhlIGludGVybmFsIGBndWFyZGAgYXJndW1lbnQgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgbWFwYC5cbiAgXy5zYW1wbGUgPSBmdW5jdGlvbihvYmosIG4sIGd1YXJkKSB7XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xuICAgICAgaWYgKG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoKSBvYmogPSBfLnZhbHVlcyhvYmopO1xuICAgICAgcmV0dXJuIG9ialtfLnJhbmRvbShvYmoubGVuZ3RoIC0gMSldO1xuICAgIH1cbiAgICByZXR1cm4gXy5zaHVmZmxlKG9iaikuc2xpY2UoMCwgTWF0aC5tYXgoMCwgbikpO1xuICB9O1xuXG4gIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRlZS5cbiAgXy5zb3J0QnkgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIGNyaXRlcmlhOiBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdXNlZCBmb3IgYWdncmVnYXRlIFwiZ3JvdXAgYnlcIiBvcGVyYXRpb25zLlxuICB2YXIgZ3JvdXAgPSBmdW5jdGlvbihiZWhhdmlvcikge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBrZXkgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIG9iaik7XG4gICAgICAgIGJlaGF2aW9yKHJlc3VsdCwgdmFsdWUsIGtleSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBHcm91cHMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbi4gUGFzcyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlXG4gIC8vIHRvIGdyb3VwIGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY3JpdGVyaW9uLlxuICBfLmdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoXy5oYXMocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XS5wdXNoKHZhbHVlKTsgZWxzZSByZXN1bHRba2V5XSA9IFt2YWx1ZV07XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgZ3JvdXBCeWAsIGJ1dCBmb3JcbiAgLy8gd2hlbiB5b3Uga25vdyB0aGF0IHlvdXIgaW5kZXggdmFsdWVzIHdpbGwgYmUgdW5pcXVlLlxuICBfLmluZGV4QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICB9KTtcblxuICAvLyBDb3VudHMgaW5zdGFuY2VzIG9mIGFuIG9iamVjdCB0aGF0IGdyb3VwIGJ5IGEgY2VydGFpbiBjcml0ZXJpb24uIFBhc3NcbiAgLy8gZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZSB0byBjb3VudCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlXG4gIC8vIGNyaXRlcmlvbi5cbiAgXy5jb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgaWYgKF8uaGFzKHJlc3VsdCwga2V5KSkgcmVzdWx0W2tleV0rKzsgZWxzZSByZXN1bHRba2V5XSA9IDE7XG4gIH0pO1xuXG4gIC8vIFVzZSBhIGNvbXBhcmF0b3IgZnVuY3Rpb24gdG8gZmlndXJlIG91dCB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2hcbiAgLy8gYW4gb2JqZWN0IHNob3VsZCBiZSBpbnNlcnRlZCBzbyBhcyB0byBtYWludGFpbiBvcmRlci4gVXNlcyBiaW5hcnkgc2VhcmNoLlxuICBfLnNvcnRlZEluZGV4ID0gZnVuY3Rpb24oYXJyYXksIG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQsIDEpO1xuICAgIHZhciB2YWx1ZSA9IGl0ZXJhdGVlKG9iaik7XG4gICAgdmFyIGxvdyA9IDAsIGhpZ2ggPSBhcnJheS5sZW5ndGg7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSBsb3cgKyBoaWdoID4+PiAxO1xuICAgICAgaWYgKGl0ZXJhdGVlKGFycmF5W21pZF0pIDwgdmFsdWUpIGxvdyA9IG1pZCArIDE7IGVsc2UgaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfTtcblxuICAvLyBTYWZlbHkgY3JlYXRlIGEgcmVhbCwgbGl2ZSBhcnJheSBmcm9tIGFueXRoaW5nIGl0ZXJhYmxlLlxuICBfLnRvQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIW9iaikgcmV0dXJuIFtdO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHJldHVybiBfLm1hcChvYmosIF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBfLnZhbHVlcyhvYmopO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGFuIG9iamVjdC5cbiAgXy5zaXplID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICByZXR1cm4gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmoubGVuZ3RoIDogXy5rZXlzKG9iaikubGVuZ3RoO1xuICB9O1xuXG4gIC8vIFNwbGl0IGEgY29sbGVjdGlvbiBpbnRvIHR3byBhcnJheXM6IG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgc2F0aXNmeSB0aGUgZ2l2ZW5cbiAgLy8gcHJlZGljYXRlLCBhbmQgb25lIHdob3NlIGVsZW1lbnRzIGFsbCBkbyBub3Qgc2F0aXNmeSB0aGUgcHJlZGljYXRlLlxuICBfLnBhcnRpdGlvbiA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBwYXNzID0gW10sIGZhaWwgPSBbXTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmopIHtcbiAgICAgIChwcmVkaWNhdGUodmFsdWUsIGtleSwgb2JqKSA/IHBhc3MgOiBmYWlsKS5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gW3Bhc3MsIGZhaWxdO1xuICB9O1xuXG4gIC8vIEFycmF5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS1cblxuICAvLyBHZXQgdGhlIGZpcnN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGZpcnN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgaGVhZGAgYW5kIGB0YWtlYC4gVGhlICoqZ3VhcmQqKiBjaGVja1xuICAvLyBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8uZmlyc3QgPSBfLmhlYWQgPSBfLnRha2UgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbMF07XG4gICAgaWYgKG4gPCAwKSByZXR1cm4gW107XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGxhc3QgZW50cnkgb2YgdGhlIGFycmF5LiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiBhbGwgdGhlIHZhbHVlcyBpblxuICAvLyB0aGUgYXJyYXksIGV4Y2x1ZGluZyB0aGUgbGFzdCBOLiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGhcbiAgLy8gYF8ubWFwYC5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIE1hdGgubWF4KDAsIGFycmF5Lmxlbmd0aCAtIChuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbikpKTtcbiAgfTtcblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmxhc3QgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIE1hdGgubWF4KGFycmF5Lmxlbmd0aCAtIG4sIDApKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBmaXJzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYHRhaWxgIGFuZCBgZHJvcGAuXG4gIC8vIEVzcGVjaWFsbHkgdXNlZnVsIG9uIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuXG4gIC8vIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKlxuICAvLyBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ucmVzdCA9IF8udGFpbCA9IF8uZHJvcCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH07XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBfLmNvbXBhY3QgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgXy5pZGVudGl0eSk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgYSByZWN1cnNpdmUgYGZsYXR0ZW5gIGZ1bmN0aW9uLlxuICB2YXIgZmxhdHRlbiA9IGZ1bmN0aW9uKGlucHV0LCBzaGFsbG93LCBzdHJpY3QsIG91dHB1dCkge1xuICAgIGlmIChzaGFsbG93ICYmIF8uZXZlcnkoaW5wdXQsIF8uaXNBcnJheSkpIHtcbiAgICAgIHJldHVybiBjb25jYXQuYXBwbHkob3V0cHV0LCBpbnB1dCk7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBpbnB1dC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZhbHVlID0gaW5wdXRbaV07XG4gICAgICBpZiAoIV8uaXNBcnJheSh2YWx1ZSkgJiYgIV8uaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICAgIGlmICghc3RyaWN0KSBvdXRwdXQucHVzaCh2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNoYWxsb3cpIHtcbiAgICAgICAgcHVzaC5hcHBseShvdXRwdXQsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZsYXR0ZW4odmFsdWUsIHNoYWxsb3csIHN0cmljdCwgb3V0cHV0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IganVzdCBvbmUgbGV2ZWwuXG4gIF8uZmxhdHRlbiA9IGZ1bmN0aW9uKGFycmF5LCBzaGFsbG93KSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4oYXJyYXksIHNoYWxsb3csIGZhbHNlLCBbXSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIF8ud2l0aG91dCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZGlmZmVyZW5jZShhcnJheSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIEFsaWFzZWQgYXMgYHVuaXF1ZWAuXG4gIF8udW5pcSA9IF8udW5pcXVlID0gZnVuY3Rpb24oYXJyYXksIGlzU29ydGVkLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgaWYgKCFfLmlzQm9vbGVhbihpc1NvcnRlZCkpIHtcbiAgICAgIGNvbnRleHQgPSBpdGVyYXRlZTtcbiAgICAgIGl0ZXJhdGVlID0gaXNTb3J0ZWQ7XG4gICAgICBpc1NvcnRlZCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoaXRlcmF0ZWUgIT0gbnVsbCkgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIHNlZW4gPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldO1xuICAgICAgaWYgKGlzU29ydGVkKSB7XG4gICAgICAgIGlmICghaSB8fCBzZWVuICE9PSB2YWx1ZSkgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICBzZWVuID0gdmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKGl0ZXJhdGVlKSB7XG4gICAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpLCBhcnJheSk7XG4gICAgICAgIGlmIChfLmluZGV4T2Yoc2VlbiwgY29tcHV0ZWQpIDwgMCkge1xuICAgICAgICAgIHNlZW4ucHVzaChjb21wdXRlZCk7XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKF8uaW5kZXhPZihyZXN1bHQsIHZhbHVlKSA8IDApIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgXy51bmlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLnVuaXEoZmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUsIFtdKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIGV2ZXJ5IGl0ZW0gc2hhcmVkIGJldHdlZW4gYWxsIHRoZVxuICAvLyBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGl0ZW0gPSBhcnJheVtpXTtcbiAgICAgIGlmIChfLmNvbnRhaW5zKHJlc3VsdCwgaXRlbSkpIGNvbnRpbnVlO1xuICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBhcmdzTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKCFfLmNvbnRhaW5zKGFyZ3VtZW50c1tqXSwgaXRlbSkpIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGogPT09IGFyZ3NMZW5ndGgpIHJlc3VsdC5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgXy5kaWZmZXJlbmNlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdCA9IGZsYXR0ZW4oc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLCB0cnVlLCB0cnVlLCBbXSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICByZXR1cm4gIV8uY29udGFpbnMocmVzdCwgdmFsdWUpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFppcCB0b2dldGhlciBtdWx0aXBsZSBsaXN0cyBpbnRvIGEgc2luZ2xlIGFycmF5IC0tIGVsZW1lbnRzIHRoYXQgc2hhcmVcbiAgLy8gYW4gaW5kZXggZ28gdG9nZXRoZXIuXG4gIF8uemlwID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIHZhciBsZW5ndGggPSBfLm1heChhcmd1bWVudHMsICdsZW5ndGgnKS5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICBpZiAobGlzdCA9PSBudWxsKSByZXR1cm4ge307XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBhbiBpdGVtIGluIGFuIGFycmF5LFxuICAvLyBvciAtMSBpZiB0aGUgaXRlbSBpcyBub3QgaW5jbHVkZWQgaW4gdGhlIGFycmF5LlxuICAvLyBJZiB0aGUgYXJyYXkgaXMgbGFyZ2UgYW5kIGFscmVhZHkgaW4gc29ydCBvcmRlciwgcGFzcyBgdHJ1ZWBcbiAgLy8gZm9yICoqaXNTb3J0ZWQqKiB0byB1c2UgYmluYXJ5IHNlYXJjaC5cbiAgXy5pbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGlzU29ydGVkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ251bWJlcicpIHtcbiAgICAgICAgaSA9IGlzU29ydGVkIDwgMCA/IE1hdGgubWF4KDAsIGxlbmd0aCArIGlzU29ydGVkKSA6IGlzU29ydGVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaSA9IF8uc29ydGVkSW5kZXgoYXJyYXksIGl0ZW0pO1xuICAgICAgICByZXR1cm4gYXJyYXlbaV0gPT09IGl0ZW0gPyBpIDogLTE7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIF8ubGFzdEluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgZnJvbSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGlkeCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAodHlwZW9mIGZyb20gPT0gJ251bWJlcicpIHtcbiAgICAgIGlkeCA9IGZyb20gPCAwID8gaWR4ICsgZnJvbSArIDEgOiBNYXRoLm1pbihpZHgsIGZyb20gKyAxKTtcbiAgICB9XG4gICAgd2hpbGUgKC0taWR4ID49IDApIGlmIChhcnJheVtpZHhdID09PSBpdGVtKSByZXR1cm4gaWR4O1xuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhbiBpbnRlZ2VyIEFycmF5IGNvbnRhaW5pbmcgYW4gYXJpdGhtZXRpYyBwcm9ncmVzc2lvbi4gQSBwb3J0IG9mXG4gIC8vIHRoZSBuYXRpdmUgUHl0aG9uIGByYW5nZSgpYCBmdW5jdGlvbi4gU2VlXG4gIC8vIFt0aGUgUHl0aG9uIGRvY3VtZW50YXRpb25dKGh0dHA6Ly9kb2NzLnB5dGhvbi5vcmcvbGlicmFyeS9mdW5jdGlvbnMuaHRtbCNyYW5nZSkuXG4gIF8ucmFuZ2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc3RlcCkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDw9IDEpIHtcbiAgICAgIHN0b3AgPSBzdGFydCB8fCAwO1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH1cbiAgICBzdGVwID0gc3RlcCB8fCAxO1xuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgcmFuZ2UgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgbGVuZ3RoOyBpZHgrKywgc3RhcnQgKz0gc3RlcCkge1xuICAgICAgcmFuZ2VbaWR4XSA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfTtcblxuICAvLyBGdW5jdGlvbiAoYWhlbSkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldXNhYmxlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciBwcm90b3R5cGUgc2V0dGluZy5cbiAgdmFyIEN0b3IgPSBmdW5jdGlvbigpe307XG5cbiAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgLy8gYXZhaWxhYmxlLlxuICBfLmJpbmQgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQmluZCBtdXN0IGJlIGNhbGxlZCBvbiBhIGZ1bmN0aW9uJyk7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBDdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgdmFyIHNlbGYgPSBuZXcgQ3RvcjtcbiAgICAgIEN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgaWYgKF8uaXNPYmplY3QocmVzdWx0KSkgcmV0dXJuIHJlc3VsdDtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9O1xuXG4gIC8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbiAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gIF8ucGFydGlhbCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gQmluZCBhIG51bWJlciBvZiBhbiBvYmplY3QncyBtZXRob2RzIHRvIHRoYXQgb2JqZWN0LiBSZW1haW5pbmcgYXJndW1lbnRzXG4gIC8vIGFyZSB0aGUgbWV0aG9kIG5hbWVzIHRvIGJlIGJvdW5kLiBVc2VmdWwgZm9yIGVuc3VyaW5nIHRoYXQgYWxsIGNhbGxiYWNrc1xuICAvLyBkZWZpbmVkIG9uIGFuIG9iamVjdCBiZWxvbmcgdG8gaXQuXG4gIF8uYmluZEFsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBpLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLCBrZXk7XG4gICAgaWYgKGxlbmd0aCA8PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ2JpbmRBbGwgbXVzdCBiZSBwYXNzZWQgZnVuY3Rpb24gbmFtZXMnKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGtleSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIG9ialtrZXldID0gXy5iaW5kKG9ialtrZXldLCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIF8ubWVtb2l6ZSA9IGZ1bmN0aW9uKGZ1bmMsIGhhc2hlcikge1xuICAgIHZhciBtZW1vaXplID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICB2YXIgY2FjaGUgPSBtZW1vaXplLmNhY2hlO1xuICAgICAgdmFyIGFkZHJlc3MgPSBoYXNoZXIgPyBoYXNoZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKSA6IGtleTtcbiAgICAgIGlmICghXy5oYXMoY2FjaGUsIGFkZHJlc3MpKSBjYWNoZVthZGRyZXNzXSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBjYWNoZVthZGRyZXNzXTtcbiAgICB9O1xuICAgIG1lbW9pemUuY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gbWVtb2l6ZTtcbiAgfTtcblxuICAvLyBEZWxheXMgYSBmdW5jdGlvbiBmb3IgdGhlIGdpdmVuIG51bWJlciBvZiBtaWxsaXNlY29uZHMsIGFuZCB0aGVuIGNhbGxzXG4gIC8vIGl0IHdpdGggdGhlIGFyZ3VtZW50cyBzdXBwbGllZC5cbiAgXy5kZWxheSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfSwgd2FpdCk7XG4gIH07XG5cbiAgLy8gRGVmZXJzIGEgZnVuY3Rpb24sIHNjaGVkdWxpbmcgaXQgdG8gcnVuIGFmdGVyIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzXG4gIC8vIGNsZWFyZWQuXG4gIF8uZGVmZXIgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgcmV0dXJuIF8uZGVsYXkuYXBwbHkoXywgW2Z1bmMsIDFdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIF8udGhyb3R0bGUgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgdmFyIGNvbnRleHQsIGFyZ3MsIHJlc3VsdDtcbiAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBfLm5vdygpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gXy5ub3coKTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDAgfHwgcmVtYWluaW5nID4gd2FpdCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBwcmV2aW91cyA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAgLy8gYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICAvLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbiAgLy8gbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy5cbiAgXy5kZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxhc3QgPSBfLm5vdygpIC0gdGltZXN0YW1wO1xuXG4gICAgICBpZiAobGFzdCA8IHdhaXQgJiYgbGFzdCA+IDApIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGltZXN0YW1wID0gXy5ub3coKTtcbiAgICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgICAgaWYgKCF0aW1lb3V0KSB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICBpZiAoY2FsbE5vdykge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXNzZWQgYXMgYW4gYXJndW1lbnQgdG8gdGhlIHNlY29uZCxcbiAgLy8gYWxsb3dpbmcgeW91IHRvIGFkanVzdCBhcmd1bWVudHMsIHJ1biBjb2RlIGJlZm9yZSBhbmQgYWZ0ZXIsIGFuZFxuICAvLyBjb25kaXRpb25hbGx5IGV4ZWN1dGUgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uLlxuICBfLndyYXAgPSBmdW5jdGlvbihmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh3cmFwcGVyLCBmdW5jKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgbmVnYXRlZCB2ZXJzaW9uIG9mIHRoZSBwYXNzZWQtaW4gcHJlZGljYXRlLlxuICBfLm5lZ2F0ZSA9IGZ1bmN0aW9uKHByZWRpY2F0ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAhcHJlZGljYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBpcyB0aGUgY29tcG9zaXRpb24gb2YgYSBsaXN0IG9mIGZ1bmN0aW9ucywgZWFjaFxuICAvLyBjb25zdW1pbmcgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBmb2xsb3dzLlxuICBfLmNvbXBvc2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICB2YXIgc3RhcnQgPSBhcmdzLmxlbmd0aCAtIDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGkgPSBzdGFydDtcbiAgICAgIHZhciByZXN1bHQgPSBhcmdzW3N0YXJ0XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgd2hpbGUgKGktLSkgcmVzdWx0ID0gYXJnc1tpXS5jYWxsKHRoaXMsIHJlc3VsdCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGFmdGVyIGJlaW5nIGNhbGxlZCBOIHRpbWVzLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCBiZWZvcmUgYmVpbmcgY2FsbGVkIE4gdGltZXMuXG4gIF8uYmVmb3JlID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICB2YXIgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA+IDApIHtcbiAgICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bmMgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgXy5vbmNlID0gXy5wYXJ0aWFsKF8uYmVmb3JlLCAyKTtcblxuICAvLyBPYmplY3QgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXRyaWV2ZSB0aGUgbmFtZXMgb2YgYW4gb2JqZWN0J3MgcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYFxuICBfLmtleXMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIFtdO1xuICAgIGlmIChuYXRpdmVLZXlzKSByZXR1cm4gbmF0aXZlS2V5cyhvYmopO1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBfLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciB2YWx1ZXMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlc1tpXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xuICB9O1xuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgXy5pbnZlcnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0W29ialtrZXlzW2ldXV0gPSBrZXlzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgLy8gQWxpYXNlZCBhcyBgbWV0aG9kc2BcbiAgXy5mdW5jdGlvbnMgPSBfLm1ldGhvZHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoXy5pc0Z1bmN0aW9uKG9ialtrZXldKSkgbmFtZXMucHVzaChrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZXMuc29ydCgpO1xuICB9O1xuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICBfLmV4dGVuZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHZhciBzb3VyY2UsIHByb3A7XG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9LCBrZXk7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChfLmlzRnVuY3Rpb24oaXRlcmF0ZWUpKSB7XG4gICAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICB2YXIgdmFsdWUgPSBvYmpba2V5XTtcbiAgICAgICAgaWYgKGl0ZXJhdGVlKHZhbHVlLCBrZXksIG9iaikpIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KFtdLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgb2JqID0gbmV3IE9iamVjdChvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgaWYgKGtleSBpbiBvYmopIHJlc3VsdFtrZXldID0gb2JqW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCB3aXRob3V0IHRoZSBibGFja2xpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLm9taXQgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gXy5uZWdhdGUoaXRlcmF0ZWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ubWFwKGNvbmNhdC5hcHBseShbXSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSwgU3RyaW5nKTtcbiAgICAgIGl0ZXJhdGVlID0gZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICByZXR1cm4gIV8uY29udGFpbnMoa2V5cywga2V5KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBfLnBpY2sob2JqLCBpdGVyYXRlZSwgY29udGV4dCk7XG4gIH07XG5cbiAgLy8gRmlsbCBpbiBhIGdpdmVuIG9iamVjdCB3aXRoIGRlZmF1bHQgcHJvcGVydGllcy5cbiAgXy5kZWZhdWx0cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIGZvciAodmFyIGkgPSAxLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICBpZiAob2JqW3Byb3BdID09PSB2b2lkIDApIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBDcmVhdGUgYSAoc2hhbGxvdy1jbG9uZWQpIGR1cGxpY2F0ZSBvZiBhbiBvYmplY3QuXG4gIF8uY2xvbmUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICByZXR1cm4gXy5pc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IF8uZXh0ZW5kKHt9LCBvYmopO1xuICB9O1xuXG4gIC8vIEludm9rZXMgaW50ZXJjZXB0b3Igd2l0aCB0aGUgb2JqLCBhbmQgdGhlbiByZXR1cm5zIG9iai5cbiAgLy8gVGhlIHByaW1hcnkgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sIGluXG4gIC8vIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICBfLnRhcCA9IGZ1bmN0aW9uKG9iaiwgaW50ZXJjZXB0b3IpIHtcbiAgICBpbnRlcmNlcHRvcihvYmopO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgcmVjdXJzaXZlIGNvbXBhcmlzb24gZnVuY3Rpb24gZm9yIGBpc0VxdWFsYC5cbiAgdmFyIGVxID0gZnVuY3Rpb24oYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbCkuXG4gICAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09PSAxIC8gYjtcbiAgICAvLyBBIHN0cmljdCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGBudWxsID09IHVuZGVmaW5lZGAuXG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBhID09PSBiO1xuICAgIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAgIGlmIChhIGluc3RhbmNlb2YgXykgYSA9IGEuX3dyYXBwZWQ7XG4gICAgaWYgKGIgaW5zdGFuY2VvZiBfKSBiID0gYi5fd3JhcHBlZDtcbiAgICAvLyBDb21wYXJlIGBbW0NsYXNzXV1gIG5hbWVzLlxuICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKGEpO1xuICAgIGlmIChjbGFzc05hbWUgIT09IHRvU3RyaW5nLmNhbGwoYikpIHJldHVybiBmYWxzZTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gU3RyaW5ncywgbnVtYmVycywgcmVndWxhciBleHByZXNzaW9ucywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgICBjYXNlICdbb2JqZWN0IFJlZ0V4cF0nOlxuICAgICAgLy8gUmVnRXhwcyBhcmUgY29lcmNlZCB0byBzdHJpbmdzIGZvciBjb21wYXJpc29uIChOb3RlOiAnJyArIC9hL2kgPT09ICcvYS9pJylcbiAgICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gYG5ldyBTdHJpbmcoXCI1XCIpYC5cbiAgICAgICAgcmV0dXJuICcnICsgYSA9PT0gJycgKyBiO1xuICAgICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgICAgLy8gYE5hTmBzIGFyZSBlcXVpdmFsZW50LCBidXQgbm9uLXJlZmxleGl2ZS5cbiAgICAgICAgLy8gT2JqZWN0KE5hTikgaXMgZXF1aXZhbGVudCB0byBOYU5cbiAgICAgICAgaWYgKCthICE9PSArYSkgcmV0dXJuICtiICE9PSArYjtcbiAgICAgICAgLy8gQW4gYGVnYWxgIGNvbXBhcmlzb24gaXMgcGVyZm9ybWVkIGZvciBvdGhlciBudW1lcmljIHZhbHVlcy5cbiAgICAgICAgcmV0dXJuICthID09PSAwID8gMSAvICthID09PSAxIC8gYiA6ICthID09PSArYjtcbiAgICAgIGNhc2UgJ1tvYmplY3QgRGF0ZV0nOlxuICAgICAgY2FzZSAnW29iamVjdCBCb29sZWFuXSc6XG4gICAgICAgIC8vIENvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtZXJpYyBwcmltaXRpdmUgdmFsdWVzLiBEYXRlcyBhcmUgY29tcGFyZWQgYnkgdGhlaXJcbiAgICAgICAgLy8gbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zLiBOb3RlIHRoYXQgaW52YWxpZCBkYXRlcyB3aXRoIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9uc1xuICAgICAgICAvLyBvZiBgTmFOYCBhcmUgbm90IGVxdWl2YWxlbnQuXG4gICAgICAgIHJldHVybiArYSA9PT0gK2I7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSAhPSAnb2JqZWN0JyB8fCB0eXBlb2YgYiAhPSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIEFzc3VtZSBlcXVhbGl0eSBmb3IgY3ljbGljIHN0cnVjdHVyZXMuIFRoZSBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBjeWNsaWNcbiAgICAvLyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjEgc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYC5cbiAgICB2YXIgbGVuZ3RoID0gYVN0YWNrLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIC8vIExpbmVhciBzZWFyY2guIFBlcmZvcm1hbmNlIGlzIGludmVyc2VseSBwcm9wb3J0aW9uYWwgdG8gdGhlIG51bWJlciBvZlxuICAgICAgLy8gdW5pcXVlIG5lc3RlZCBzdHJ1Y3R1cmVzLlxuICAgICAgaWYgKGFTdGFja1tsZW5ndGhdID09PSBhKSByZXR1cm4gYlN0YWNrW2xlbmd0aF0gPT09IGI7XG4gICAgfVxuICAgIC8vIE9iamVjdHMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1aXZhbGVudCwgYnV0IGBPYmplY3Rgc1xuICAgIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgIGlmIChcbiAgICAgIGFDdG9yICE9PSBiQ3RvciAmJlxuICAgICAgLy8gSGFuZGxlIE9iamVjdC5jcmVhdGUoeCkgY2FzZXNcbiAgICAgICdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIgJiZcbiAgICAgICEoXy5pc0Z1bmN0aW9uKGFDdG9yKSAmJiBhQ3RvciBpbnN0YW5jZW9mIGFDdG9yICYmXG4gICAgICAgIF8uaXNGdW5jdGlvbihiQ3RvcikgJiYgYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcilcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gQWRkIHRoZSBmaXJzdCBvYmplY3QgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wdXNoKGEpO1xuICAgIGJTdGFjay5wdXNoKGIpO1xuICAgIHZhciBzaXplLCByZXN1bHQ7XG4gICAgLy8gUmVjdXJzaXZlbHkgY29tcGFyZSBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAgaWYgKGNsYXNzTmFtZSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgLy8gQ29tcGFyZSBhcnJheSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkuXG4gICAgICBzaXplID0gYS5sZW5ndGg7XG4gICAgICByZXN1bHQgPSBzaXplID09PSBiLmxlbmd0aDtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgLy8gRGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllcy5cbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGVxKGFbc2l6ZV0sIGJbc2l6ZV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgdmFyIGtleXMgPSBfLmtleXMoYSksIGtleTtcbiAgICAgIHNpemUgPSBrZXlzLmxlbmd0aDtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IGJvdGggb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzIGJlZm9yZSBjb21wYXJpbmcgZGVlcCBlcXVhbGl0eS5cbiAgICAgIHJlc3VsdCA9IF8ua2V5cyhiKS5sZW5ndGggPT09IHNpemU7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXJcbiAgICAgICAgICBrZXkgPSBrZXlzW3NpemVdO1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IF8uaGFzKGIsIGtleSkgJiYgZXEoYVtrZXldLCBiW2tleV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFJlbW92ZSB0aGUgZmlyc3Qgb2JqZWN0IGZyb20gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wb3AoKTtcbiAgICBiU3RhY2sucG9wKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBQZXJmb3JtIGEgZGVlcCBjb21wYXJpc29uIHRvIGNoZWNrIGlmIHR3byBvYmplY3RzIGFyZSBlcXVhbC5cbiAgXy5pc0VxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiLCBbXSwgW10pO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gYXJyYXksIHN0cmluZywgb3Igb2JqZWN0IGVtcHR5P1xuICAvLyBBbiBcImVtcHR5XCIgb2JqZWN0IGhhcyBubyBlbnVtZXJhYmxlIG93bi1wcm9wZXJ0aWVzLlxuICBfLmlzRW1wdHkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSB8fCBfLmlzU3RyaW5nKG9iaikgfHwgXy5pc0FyZ3VtZW50cyhvYmopKSByZXR1cm4gb2JqLmxlbmd0aCA9PT0gMDtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBfLmlzRWxlbWVudCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiAhIShvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgQXJyYXkuaXNBcnJheVxuICBfLmlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSBhbiBvYmplY3Q/XG4gIF8uaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG4gIH07XG5cbiAgLy8gQWRkIHNvbWUgaXNUeXBlIG1ldGhvZHM6IGlzQXJndW1lbnRzLCBpc0Z1bmN0aW9uLCBpc1N0cmluZywgaXNOdW1iZXIsIGlzRGF0ZSwgaXNSZWdFeHAuXG4gIF8uZWFjaChbJ0FyZ3VtZW50cycsICdGdW5jdGlvbicsICdTdHJpbmcnLCAnTnVtYmVyJywgJ0RhdGUnLCAnUmVnRXhwJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBfWydpcycgKyBuYW1lXSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRGVmaW5lIGEgZmFsbGJhY2sgdmVyc2lvbiBvZiB0aGUgbWV0aG9kIGluIGJyb3dzZXJzIChhaGVtLCBJRSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIGlmICghXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpKSB7XG4gICAgXy5pc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIF8uaGFzKG9iaiwgJ2NhbGxlZScpO1xuICAgIH07XG4gIH1cblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuIFdvcmsgYXJvdW5kIGFuIElFIDExIGJ1Zy5cbiAgaWYgKHR5cGVvZiAvLi8gIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09ICdmdW5jdGlvbicgfHwgZmFsc2U7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gb2JqZWN0IGEgZmluaXRlIG51bWJlcj9cbiAgXy5pc0Zpbml0ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBpc0Zpbml0ZShvYmopICYmICFpc05hTihwYXJzZUZsb2F0KG9iaikpO1xuICB9O1xuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD8gKE5hTiBpcyB0aGUgb25seSBudW1iZXIgd2hpY2ggZG9lcyBub3QgZXF1YWwgaXRzZWxmKS5cbiAgXy5pc05hTiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfLmlzTnVtYmVyKG9iaikgJiYgb2JqICE9PSArb2JqO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBfLmlzQm9vbGVhbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHRydWUgfHwgb2JqID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEJvb2xlYW5dJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIF8uaXNOdWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbDtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIHVuZGVmaW5lZD9cbiAgXy5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfTtcblxuICAvLyBTaG9ydGN1dCBmdW5jdGlvbiBmb3IgY2hlY2tpbmcgaWYgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHByb3BlcnR5IGRpcmVjdGx5XG4gIC8vIG9uIGl0c2VsZiAoaW4gb3RoZXIgd29yZHMsIG5vdCBvbiBhIHByb3RvdHlwZSkuXG4gIF8uaGFzID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gIH07XG5cbiAgLy8gVXRpbGl0eSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSdW4gVW5kZXJzY29yZS5qcyBpbiAqbm9Db25mbGljdCogbW9kZSwgcmV0dXJuaW5nIHRoZSBgX2AgdmFyaWFibGUgdG8gaXRzXG4gIC8vIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcm9vdC5fID0gcHJldmlvdXNVbmRlcnNjb3JlO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRlZXMuXG4gIF8uaWRlbnRpdHkgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBfLmNvbnN0YW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgfTtcblxuICBfLm5vb3AgPSBmdW5jdGlvbigpe307XG5cbiAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBwcmVkaWNhdGUgZm9yIGNoZWNraW5nIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5tYXRjaGVzID0gZnVuY3Rpb24oYXR0cnMpIHtcbiAgICB2YXIgcGFpcnMgPSBfLnBhaXJzKGF0dHJzKSwgbGVuZ3RoID0gcGFpcnMubGVuZ3RoO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuICFsZW5ndGg7XG4gICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sIGtleSA9IHBhaXJbMF07XG4gICAgICAgIGlmIChwYWlyWzFdICE9PSBvYmpba2V5XSB8fCAhKGtleSBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJ1biBhIGZ1bmN0aW9uICoqbioqIHRpbWVzLlxuICBfLnRpbWVzID0gZnVuY3Rpb24obiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgYWNjdW0gPSBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyIGJldHdlZW4gbWluIGFuZCBtYXggKGluY2x1c2l2ZSkuXG4gIF8ucmFuZG9tID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICB9O1xuXG4gIC8vIEEgKHBvc3NpYmx5IGZhc3Rlcikgd2F5IHRvIGdldCB0aGUgY3VycmVudCB0aW1lc3RhbXAgYXMgYW4gaW50ZWdlci5cbiAgXy5ub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH07XG5cbiAgIC8vIExpc3Qgb2YgSFRNTCBlbnRpdGllcyBmb3IgZXNjYXBpbmcuXG4gIHZhciBlc2NhcGVNYXAgPSB7XG4gICAgJyYnOiAnJmFtcDsnLFxuICAgICc8JzogJyZsdDsnLFxuICAgICc+JzogJyZndDsnLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiN4Mjc7JyxcbiAgICAnYCc6ICcmI3g2MDsnXG4gIH07XG4gIHZhciB1bmVzY2FwZU1hcCA9IF8uaW52ZXJ0KGVzY2FwZU1hcCk7XG5cbiAgLy8gRnVuY3Rpb25zIGZvciBlc2NhcGluZyBhbmQgdW5lc2NhcGluZyBzdHJpbmdzIHRvL2Zyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICB2YXIgY3JlYXRlRXNjYXBlciA9IGZ1bmN0aW9uKG1hcCkge1xuICAgIHZhciBlc2NhcGVyID0gZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgIHJldHVybiBtYXBbbWF0Y2hdO1xuICAgIH07XG4gICAgLy8gUmVnZXhlcyBmb3IgaWRlbnRpZnlpbmcgYSBrZXkgdGhhdCBuZWVkcyB0byBiZSBlc2NhcGVkXG4gICAgdmFyIHNvdXJjZSA9ICcoPzonICsgXy5rZXlzKG1hcCkuam9pbignfCcpICsgJyknO1xuICAgIHZhciB0ZXN0UmVnZXhwID0gUmVnRXhwKHNvdXJjZSk7XG4gICAgdmFyIHJlcGxhY2VSZWdleHAgPSBSZWdFeHAoc291cmNlLCAnZycpO1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgICAgIHJldHVybiB0ZXN0UmVnZXhwLnRlc3Qoc3RyaW5nKSA/IHN0cmluZy5yZXBsYWNlKHJlcGxhY2VSZWdleHAsIGVzY2FwZXIpIDogc3RyaW5nO1xuICAgIH07XG4gIH07XG4gIF8uZXNjYXBlID0gY3JlYXRlRXNjYXBlcihlc2NhcGVNYXApO1xuICBfLnVuZXNjYXBlID0gY3JlYXRlRXNjYXBlcih1bmVzY2FwZU1hcCk7XG5cbiAgLy8gSWYgdGhlIHZhbHVlIG9mIHRoZSBuYW1lZCBgcHJvcGVydHlgIGlzIGEgZnVuY3Rpb24gdGhlbiBpbnZva2UgaXQgd2l0aCB0aGVcbiAgLy8gYG9iamVjdGAgYXMgY29udGV4dDsgb3RoZXJ3aXNlLCByZXR1cm4gaXQuXG4gIF8ucmVzdWx0ID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIGlmIChvYmplY3QgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3RbcHJvcGVydHldO1xuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gb2JqZWN0W3Byb3BlcnR5XSgpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIF8udW5pcXVlSWQgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIFVuZGVyc2NvcmUgdXNlcyBFUkItc3R5bGUgdGVtcGxhdGUgZGVsaW1pdGVycywgY2hhbmdlIHRoZVxuICAvLyBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlIGRlbGltaXRlcnMuXG4gIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZSAgICA6IC88JShbXFxzXFxTXSs/KSU+L2csXG4gICAgaW50ZXJwb2xhdGUgOiAvPCU9KFtcXHNcXFNdKz8pJT4vZyxcbiAgICBlc2NhcGUgICAgICA6IC88JS0oW1xcc1xcU10rPyklPi9nXG4gIH07XG5cbiAgLy8gV2hlbiBjdXN0b21pemluZyBgdGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6ICAgICAgXCInXCIsXG4gICAgJ1xcXFwnOiAgICAgJ1xcXFwnLFxuICAgICdcXHInOiAgICAgJ3InLFxuICAgICdcXG4nOiAgICAgJ24nLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICB2YXIgZXNjYXBlciA9IC9cXFxcfCd8XFxyfFxcbnxcXHUyMDI4fFxcdTIwMjkvZztcblxuICB2YXIgZXNjYXBlQ2hhciA9IGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdO1xuICB9O1xuXG4gIC8vIEphdmFTY3JpcHQgbWljcm8tdGVtcGxhdGluZywgc2ltaWxhciB0byBKb2huIFJlc2lnJ3MgaW1wbGVtZW50YXRpb24uXG4gIC8vIFVuZGVyc2NvcmUgdGVtcGxhdGluZyBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXMgd2hpdGVzcGFjZSxcbiAgLy8gYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gIC8vIE5COiBgb2xkU2V0dGluZ3NgIG9ubHkgZXhpc3RzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgXy50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHRleHQsIHNldHRpbmdzLCBvbGRTZXR0aW5ncykge1xuICAgIGlmICghc2V0dGluZ3MgJiYgb2xkU2V0dGluZ3MpIHNldHRpbmdzID0gb2xkU2V0dGluZ3M7XG4gICAgc2V0dGluZ3MgPSBfLmRlZmF1bHRzKHt9LCBzZXR0aW5ncywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKGVzY2FwZXIsIGVzY2FwZUNoYXIpO1xuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG5cbiAgICAgIGlmIChlc2NhcGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBlc2NhcGUgKyBcIikpPT1udWxsPycnOl8uZXNjYXBlKF9fdCkpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoaW50ZXJwb2xhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBpbnRlcnBvbGF0ZSArIFwiKSk9PW51bGw/Jyc6X190KStcXG4nXCI7XG4gICAgICB9IGVsc2UgaWYgKGV2YWx1YXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZSArIFwiXFxuX19wKz0nXCI7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkb2JlIFZNcyBuZWVkIHRoZSBtYXRjaCByZXR1cm5lZCB0byBwcm9kdWNlIHRoZSBjb3JyZWN0IG9mZmVzdC5cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICBpZiAoIXNldHRpbmdzLnZhcmlhYmxlKSBzb3VyY2UgPSAnd2l0aChvYmp8fHt9KXtcXG4nICsgc291cmNlICsgJ31cXG4nO1xuXG4gICAgc291cmNlID0gXCJ2YXIgX190LF9fcD0nJyxfX2o9QXJyYXkucHJvdG90eXBlLmpvaW4sXCIgK1xuICAgICAgXCJwcmludD1mdW5jdGlvbigpe19fcCs9X19qLmNhbGwoYXJndW1lbnRzLCcnKTt9O1xcblwiICtcbiAgICAgIHNvdXJjZSArICdyZXR1cm4gX19wO1xcbic7XG5cbiAgICB0cnkge1xuICAgICAgdmFyIHJlbmRlciA9IG5ldyBGdW5jdGlvbihzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJywgJ18nLCBzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcGxhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gcmVuZGVyLmNhbGwodGhpcywgZGF0YSwgXyk7XG4gICAgfTtcblxuICAgIC8vIFByb3ZpZGUgdGhlIGNvbXBpbGVkIHNvdXJjZSBhcyBhIGNvbnZlbmllbmNlIGZvciBwcmVjb21waWxhdGlvbi5cbiAgICB2YXIgYXJndW1lbnQgPSBzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJztcbiAgICB0ZW1wbGF0ZS5zb3VyY2UgPSAnZnVuY3Rpb24oJyArIGFyZ3VtZW50ICsgJyl7XFxuJyArIHNvdXJjZSArICd9JztcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYSBcImNoYWluXCIgZnVuY3Rpb24uIFN0YXJ0IGNoYWluaW5nIGEgd3JhcHBlZCBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5jaGFpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBpbnN0YW5jZSA9IF8ob2JqKTtcbiAgICBpbnN0YW5jZS5fY2hhaW4gPSB0cnVlO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfTtcblxuICAvLyBPT1BcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0XG4gIC8vIGNhbiBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgdGhlXG4gIC8vIHVuZGVyc2NvcmUgZnVuY3Rpb25zLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnRpbnVlIGNoYWluaW5nIGludGVybWVkaWF0ZSByZXN1bHRzLlxuICB2YXIgcmVzdWx0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NoYWluID8gXyhvYmopLmNoYWluKCkgOiBvYmo7XG4gIH07XG5cbiAgLy8gQWRkIHlvdXIgb3duIGN1c3RvbSBmdW5jdGlvbnMgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm1peGluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgXy5lYWNoKF8uZnVuY3Rpb25zKG9iaiksIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gX1tuYW1lXSA9IG9ialtuYW1lXTtcbiAgICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBmdW5jLmFwcGx5KF8sIGFyZ3MpKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICBfLm1peGluKF8pO1xuXG4gIC8vIEFkZCBhbGwgbXV0YXRvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIF8uZWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgbWV0aG9kLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIGlmICgobmFtZSA9PT0gJ3NoaWZ0JyB8fCBuYW1lID09PSAnc3BsaWNlJykgJiYgb2JqLmxlbmd0aCA9PT0gMCkgZGVsZXRlIG9ialswXTtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBvYmopO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFkZCBhbGwgYWNjZXNzb3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBfLmVhY2goWydjb25jYXQnLCAnam9pbicsICdzbGljZSddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBtZXRob2QuYXBwbHkodGhpcy5fd3JhcHBlZCwgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gIF8ucHJvdG90eXBlLnZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dyYXBwZWQ7XG4gIH07XG5cbiAgLy8gQU1EIHJlZ2lzdHJhdGlvbiBoYXBwZW5zIGF0IHRoZSBlbmQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBBTUQgbG9hZGVyc1xuICAvLyB0aGF0IG1heSBub3QgZW5mb3JjZSBuZXh0LXR1cm4gc2VtYW50aWNzIG9uIG1vZHVsZXMuIEV2ZW4gdGhvdWdoIGdlbmVyYWxcbiAgLy8gcHJhY3RpY2UgZm9yIEFNRCByZWdpc3RyYXRpb24gaXMgdG8gYmUgYW5vbnltb3VzLCB1bmRlcnNjb3JlIHJlZ2lzdGVyc1xuICAvLyBhcyBhIG5hbWVkIG1vZHVsZSBiZWNhdXNlLCBsaWtlIGpRdWVyeSwgaXQgaXMgYSBiYXNlIGxpYnJhcnkgdGhhdCBpc1xuICAvLyBwb3B1bGFyIGVub3VnaCB0byBiZSBidW5kbGVkIGluIGEgdGhpcmQgcGFydHkgbGliLCBidXQgbm90IGJlIHBhcnQgb2ZcbiAgLy8gYW4gQU1EIGxvYWQgcmVxdWVzdC4gVGhvc2UgY2FzZXMgY291bGQgZ2VuZXJhdGUgYW4gZXJyb3Igd2hlbiBhblxuICAvLyBhbm9ueW1vdXMgZGVmaW5lKCkgaXMgY2FsbGVkIG91dHNpZGUgb2YgYSBsb2FkZXIgcmVxdWVzdC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgndW5kZXJzY29yZScsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfO1xuICAgIH0pO1xuICB9XG59LmNhbGwodGhpcykpO1xuIl19
