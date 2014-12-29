(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./js":[function(require,module,exports){
var routing = require('./routing');
var ui = require('./ui');

routing.start( require('./Poem') );
},{"./Poem":"/Users/gregtatum/Google Drive/greg-sites/polar/js/Poem.js","./routing":"/Users/gregtatum/Google Drive/greg-sites/polar/js/routing.js","./ui":"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/Components/Hid.js":[function(require,module,exports){
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

},{"../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/Poem.js":[function(require,module,exports){
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

var Poem = function( level, slug ) {

	this.circumference = level.config.circumference || 750;
	this.height = level.config.height || 120;
	this.r = level.config.r || 240;
	this.circumferenceRatio = (2 * Math.PI) / this.circumference; //Map 2d X coordinates to polar coordinates
	this.ratio = window.devicePixelRatio >= 1 ? window.devicePixelRatio : 1;
	this.slug = slug;	
	
	this.controls = undefined;
	this.div = document.getElementById( 'container' );
	this.scene = new THREE.Scene();
	this.requestedFrame = undefined;
	this.started = false;

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
	
	this.start();
	
};

module.exports = Poem;

Poem.prototype = {
	
	parseLevel : function( level ) {
		_.each( level.objects, function loadComponent( value, key ) {
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
	
	start : function() {
		if( !this.started ) {
			this.loop();
		}
		this.started = true;
	},
	
	loop : function() {

		this.requestedFrame = requestAnimationFrame( this.loop.bind(this) );
		this.update();

	},
	
	pause : function() {
		
		window.cancelAnimationFrame( this.requestedFrame );
		this.started = false;
		
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
},{"./Ship":"/Users/gregtatum/Google Drive/greg-sites/polar/js/Ship.js","./components/Camera":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Camera.js","./components/ScoringAndWinning":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/ScoringAndWinning.js","./components/Stars":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Stars.js","./entities/JellyShip":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/JellyShip.js","./managers/AsteroidField":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/AsteroidField.js","./managers/EntityManager":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/EntityManager.js","./managers/Gun":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/Gun.js","./utils/Clock":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Clock.js","./utils/Coordinates":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Coordinates.js","./utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js","./utils/Stats":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Stats.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/Ship.js":[function(require,module,exports){
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
	this.killTimeout = null;
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
	this.bankSpeed = 0.0075;
	this.bank = 0;
	this.maxSpeed = 500;

	this.addObject();
	this.damage = new Damage(this.poem, {
		color: this.color
	});
	
	this.poem.on('update', this.update.bind(this) );
	
};

module.exports = Ship;

Ship.prototype = {
	
	createGeometry : function() {
		
		var geometry, verts, manhattanLength, center;
		
		geometry = new THREE.Geometry();
		
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
		clearTimeout( this.killTimeout );
		this.dead = true;
		this.object.visible = false;
	},
	
	kill : function( force ) {

		if( !force && !this.dead && !this.invulnerable ) {
			this.dead = true;
			this.object.visible = false;
			
			this.damage.explode( this.position );
			
			var lostPoints = Math.ceil( this.poem.scoringAndWinning.score / -2 );
			
			this.poem.scoringAndWinning.adjustScore(
				lostPoints,
				lostPoints + " points",
				{
					"font-size" : "2em",
					"color": "red"
				}
			);
		
			this.killTimeout = setTimeout(function() {
		
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
				this.bank += this.bankSpeed;
			}
		
			if( pressed.right ) {
				this.bank += this.bankSpeed * -1;
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
},{"./components/Damage":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Damage.js","./components/Hid":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Hid.js","./utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Camera.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/CameraIntro.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/CylinderLines.js":[function(require,module,exports){
var twoπ = Math.PI * 2;
var cos = Math.cos;
var sin = Math.sin;
var random = require('../utils/random.js');
var destroyMesh = require('../utils/destroyMesh');

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
	
	return vertices;

}

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
	};
}

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

module.exports = CylinderLines;
},{"../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random.js":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Damage.js":[function(require,module,exports){
var _ = require('underscore');
var random = require('../utils/random.js');
var Bullet = require('../entities/Bullet');
var SoundGenerator = require('../sound/SoundGenerator');
var destroyMesh = require('../utils/destroyMesh');

var Damage = function( poem, settings ) {
	
	this.poem = poem;
	this.color = null;
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
		
		var geometry = new THREE.Geometry();
		
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
				 color: this.color,
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
	
	explode : function( position ) {
		
		this.playExplosionSound();
		
		_.each( _.sample( this.bullets, this.perExplosion ), function( bullet) {

			var theta = random.range(0, 2 * Math.PI);
			var r = random.rangeLow( 0, this.explodeSpeed );
			
			bullet.alive = true;
			bullet.position.copy( position );
			
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
},{"../entities/Bullet":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/SoundGenerator.js","../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random.js":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js","underscore":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Hid.js":[function(require,module,exports){
arguments[4]["/Users/gregtatum/Google Drive/greg-sites/polar/js/Components/Hid.js"][0].apply(exports,arguments)
},{"../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/ScoringAndWinning.js":[function(require,module,exports){
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
var routing = require('../routing');
var scores = require('./scores');
var selectors = require('../utils/selectors');
var levels = require('../levels');

var ScoringAndWinning = function( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	
	this.poem = poem;
	
	this.$score = selectors( "#score", {
		value			: '.score-value',
		total			: '.score-total',
		bar				: '.score-bar-bar',
		text			: '.score-bar-number',
		enemiesCount	: '.enemies-count',
		message			: '.score-message',
	});

	this.$win = selectors( '#win', {
		score		: '.win-score',
		maxScore	: '.win-max-score',
		text		: '.win-text',
		nextLevel	: '.win-next-level',
		restart		: '.win-restart'
	});
	
	this.score = 0;
	this.enemiesCount = 0;
	this.scoreMessageId = 0;
	this.message = _.isString( properties.message ) ? properties.message : "You Win";
	this.nextLevel = properties.nextLevel ? properties.nextLevel : null;
	this.won = false;
	this.maxScore = levels[ poem.slug ].maxScore;
	
	this.$score.total.text( this.maxScore );
	this.updateScoreElements();
	
	this.conditionsRemaining = [];
	
	this.poem.on('levelParsed', function() {
		this.setConditions( properties.conditions );
	}.bind(this));
	
};

module.exports = ScoringAndWinning;

ScoringAndWinning.prototype = {
	
	setConditions : function( conditions ) {
		
		// Start watching for completion for all components
		
		_.each( conditions, function( condition ) {
		
			var component = this.poem[condition.component];
			var args = _.union( this, condition.properties );
		
			component.watchForCompletion.apply( component, args );
			
			this.conditionsRemaining.push( component );
		
		}.bind(this));
		
	},
	
	reportConditionCompleted : function( component ) {
		
		if( this.won ) return;
		
		_.defer(function() {
			
			this.conditionsRemaining = _.filter( this.conditionsRemaing, function( condition ) {
				return condition !== component;
			});
		
			if( this.conditionsRemaining.length === 0 ) {
			
				this.poem.ship.disable();
				this.won = true;
				this.conditionsCompleted();
			
			}
			
		}.bind(this));		
	},

	reportConditionIncomplete : function( component ) {

		if( this.won ) return;
				
		_.defer(function() {
			
			var index = this.conditionsRemaining.indexOf( component ) ;
			
			if( index === -1 ) {
				this.conditionsRemaining.push( component );
			}
					
		}.bind(this));		
	},
	
	
	adjustEnemies : function( count ) {
		
		// if(this.won) return;
		
		this.enemiesCount += count;
		this.$score.enemiesCount.text( this.enemiesCount );
		
		return this.enemiesCount;
	},
	
	adjustScore : function( count, message, style ) {
		
		if(this.won) return;
		
		this.score += count;
		
		this.updateScoreElements();
		
		if( message ) this.showMessage( message, style );
		
		return this.score;
	},
	
	updateScoreElements : function() {
		
		var scorePercentage = Math.round( this.score / this.maxScore * 100 );
		
		this.$score.value.text( this.score );
		this.$score.bar.width(  );
		this.$score.text.toggleClass('score-bar-left', scorePercentage >= 50 );
		this.$score.text.toggleClass('score-bar-right', scorePercentage < 50 );
		this.$score.bar.css({
			width: scorePercentage + "%",
			backgroundColor: "#f00"
		});
		
		this.updateScoreElementsTimeout = setTimeout(function() {
			
			this.$score.bar.css({
				width: scorePercentage + "%",
				backgroundColor: "#C44F4F"
			});
			
		}.bind(this), 500);
		
	},
	
	showMessage : function( message, style ) {
		
		var $span = $('<span></span>').text( message );
		
		if( style ) $span.css( style );
		
		this.$score.message.hide();
		this.$score.message.empty().append( $span );
		this.$score.message.removeClass('fadeout');
		this.$score.message.addClass('fadein');
		this.$score.message.show();
		this.$score.message.removeClass('fadein');
		
		var id = ++this.scoreMessageId;
		
		setTimeout(function() {
			
			if( id === this.scoreMessageId ) {
				this.$score.message.addClass('fadeout');
			}
			
		}.bind(this), 2000);
		
	},
	
	conditionsCompleted : function() {
				
		this.$win.score.text( this.score );
		this.$win.maxScore.text( this.maxScore );
		this.$win.text.html( this.message );
		
		this.showWinScreen();
		
		this.$win.nextLevel.off().one( 'click', function( e ) {
			
			e.preventDefault();
			
			hasher.setHash("level/" + this.nextLevel );
			
			this.hideWinScreen();
			
			
		}.bind(this));
		
		this.$win.restart.off().one( 'click', function( e ) {
			
			e.preventDefault();

			routing.loadUpALevel( this.poem.slug );

			this.hideWinScreen();
			
			
		}.bind(this));
		
	},
	
	showWinScreen : function() {
		
		this.$win.scope
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
		
		$('#container canvas').css('opacity', 0.3);
		
		scores.set( this.poem.slug, this.score );
		
		setTimeout(function() {
			this.$win.scope.removeClass('hide');
		}.bind(this), 1);
		
		this.poem.on( 'destroy', this.hideWinScreen.bind(this) );
		
	},
	
	hideWinScreen : function() {
		
		this.$win.scope.addClass('hide');
		$('#container canvas').css('opacity', 1);
		
		setTimeout(function() {
			this.$win.scope.hide();
		}.bind(this), 1000);
		
	},
	
};
},{"../levels":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/index.js","../routing":"/Users/gregtatum/Google Drive/greg-sites/polar/js/routing.js","../utils/selectors":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/selectors.js","./scores":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/scores.js","hasher":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Stars.js":[function(require,module,exports){
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
},{"../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Titles.js":[function(require,module,exports){
var HID = require('../Components/Hid');
var hasher = require('hasher');

var Titles = function( poem, properties ) {
	this.poem = poem;
	
	this.poem.ship.disable();
	this.rotateStars();
	
	$('a[href=#keys]').off().click(this.handleKeysClick.bind(this));
	$('a[href=#tilt]').off().click(this.handleTiltClick.bind(this));
	
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
	
	rotateStars : function() {
		
		this.poem.on('update', function(e) {
			
			this.poem.stars.object.rotation.y -= 0.0001 * e.dt;
		
		}.bind(this) );
		
	}
	
};
},{"../Components/Hid":"/Users/gregtatum/Google Drive/greg-sites/polar/js/Components/Hid.js","hasher":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Web/geometry.js":[function(require,module,exports){
var twoπ = Math.PI * 2;

module.exports = function createWebGeometry( sides, levels, radius, height ) {
	
	var geometry = new THREE.Geometry();
	var vertices = geometry.vertices;
	var faces = geometry.faces;
	var sideLength = twoπ / sides;
	var levelHeight = height / levels;

	var a,b,c,d;
	var ai,bi,ci,di;
	var an,bn,cn,dn;
	
	var sideOffset, offset = 0;

	for( var level=0; level < levels; level++ ) {
		
		offset += 0.5;
		
		for( var side=0; side < sides; side++ ) {

			// Vertices and faces like so:
			//     c ______ d
			//      /\    /
			//     /  \  /
			//  a /____\/ b
			
			sideOffset = side + offset;
			
			a = new THREE.Vector3(
				Math.cos( sideLength * sideOffset ) * radius,
				level * levelHeight - height / 2,
				Math.sin( sideLength * sideOffset ) * radius
			);
			
			b = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 1) ) * radius,
				level * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 1) ) * radius
			);
			
			c = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 0.5) ) * radius,
				(level + 1) * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 0.5) ) * radius
			);
			
			d = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 1.5) ) * radius,
				(level + 1) * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 1.5) ) * radius
			);
			
			//Push and get index
			ai = vertices.push( a ) - 1;
			bi = vertices.push( b ) - 1;
			ci = vertices.push( c ) - 1;
			di = vertices.push( d ) - 1;
			
			faces.push(
				new THREE.Face3( ci, ai, bi ),
				new THREE.Face3( ci, bi, di )
			);
			
		}
		
	}
	
	
	geometry.mergeVertices();
	geometry.computeVertexNormals();
	geometry.computeFaceNormals();
	
	return geometry;
	
};
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Web/index.js":[function(require,module,exports){
var glslify = require("glslify");
var createShader = require("three-glslify")(THREE);
var createWebGeometry = require("./geometry");
var Coordinates = require("../../utils/Coordinates");

function worldPositionVelocityUpdater(coordinates, fromPolarPosition, toWorldPosition, toVelocity) {
    var newWorldPosition = new THREE.Vector3();
    var newVelocity = new THREE.Vector3();
    coordinates.setVector(toWorldPosition, fromPolarPosition);

    return function() {
        coordinates.setVector(newWorldPosition, fromPolarPosition);
        newVelocity.subVectors(newWorldPosition, toWorldPosition);

        if (newVelocity.lengthSq() > 2500) {
            newVelocity.set(0, 0, 0);
        } else {
            newWorldPosition.lerp(toWorldPosition, 0.5);
            newVelocity.lerp(toVelocity, 0.95);
        }

        toVelocity.copy(newVelocity);
        toWorldPosition.copy(newWorldPosition);
    };
}

function shipPositionUniforms(poem, shader, shipPosition) {
    var shipWorldPosition = new THREE.Vector3();
    var shipWorldVelocity = new THREE.Vector3();

    shader.uniforms.shipPosition = {
        type: "v3",
        value: shipWorldPosition
    };

    shader.uniforms.shipVelocity = {
        type: "v3",
        value: shipWorldVelocity
    };

    shader.uniforms.time = {
        type: "f",
        value: 0
    };

    poem.on("update", worldPositionVelocityUpdater(poem.coordinates, poem.ship.position, shipWorldPosition, shipWorldVelocity));
}

var Web = function(poem, properties) {
    this.poem = poem;
    var shader = createShader(require("glslify/simple-adapter.js")("\n#define GLSLIFY 1\n\nuniform vec3 shipPosition;\nuniform vec3 shipVelocity;\nattribute float time;\nvarying vec4 vColor;\nvoid main() {\n  float shipDistance = max(distance(shipPosition, position), 10.0);\n  vColor = vec4(1.0, 0.0, 0.0, 1.0) * 5.0 * length(shipVelocity) / shipDistance;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position - shipVelocity * 50.0 / (shipDistance * 0.3), 1.0);\n}", "\n#define GLSLIFY 1\n\nvarying vec4 vColor;\nvoid main() {\n  gl_FragColor = vec4(0.2, 0.3, 0.3, 0.1) + vColor;\n}", [{"name":"shipPosition","type":"vec3"},{"name":"shipVelocity","type":"vec3"}], [{"name":"time","type":"float"}]));
    shipPositionUniforms(poem, shader, poem.ship.position);
    var material = new THREE.ShaderMaterial(shader);
    var geometry = createWebGeometry(64, 12, poem.r, poem.height);
    var mesh = new THREE.Mesh(geometry, material);
    material.wireframe = true;
    material.transparent = true;
    poem.scene.add(mesh);
};

module.exports = Web;
},{"../../utils/Coordinates":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Coordinates.js","./geometry":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Web/geometry.js","glslify":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/glslify/browser.js","glslify/simple-adapter.js":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/glslify/simple-adapter.js","three-glslify":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/three-glslify/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/scores.js":[function(require,module,exports){
var localforage = require('localforage');
var levels = require('../levels');
var scores = {};
var EventDispatcher = require('../utils/EventDispatcher');

function dispatchChange() {
	
	exports.dispatch({
		type: "change",
		scores: scores
	});
	
}

function isRealNumber( number ) {
	return _.isNumber( number ) && !_.isNaN( number );
}

var exports = {
	
	get : function( slug ) {

		var value = isRealNumber( scores[slug] ) ? scores[slug] : 0;
		var total = _.isNumber( levels[slug].maxScore ) ? levels[slug].maxScore : 1;
		var unitI = 1;
		
		if( total > 0 ) {
			unitI = value / total;
		}
		
		var percent = Math.round(unitI * 100);
		
		var obj = {
			value	: value,
			total	: total,
			unitI	: unitI,
			percent	: percent
		};
		
		_.each( obj, function(val) {
			if( _.isNaN( val ) ) {
				debugger;
			}
		});
		return obj;
		
	},
	
	set : function( slug, score ) {
		
		if( isRealNumber( score ) ) {
			
			//Only save the higher score
			
			scores[slug] = isRealNumber( scores[slug] ) ?
				Math.max( scores[slug], score ) :
				score
			;
			localforage.setItem( 'scores', scores );
			dispatchChange();
			
		}
		
	},
	
	reset : function() {
		
		scores = {};
		localforage.setItem( 'scores', scores );
		dispatchChange();
		
	}
		
};

EventDispatcher.prototype.apply( exports );

(function() {
	
	localforage.getItem('scores', function( err, value ) {
	
		if(err) return;
		scores = _.isObject( value ) ? value : {};
		
		dispatchChange();
		
	});	
	
})();


module.exports = exports;
},{"../levels":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/index.js","../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js","localforage":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/localforage.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Arachnid.js":[function(require,module,exports){
var random = require('../utils/random');
var destroyMesh = require('../utils/destroyMesh');
var twoπ = Math.PI * 2;
var color = 0xBC492A;

var Arachnid = function( poem, manager, x, y ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Arachnid";
	this.color = 0xBC492A;
	this.cssColor = "#BC492A";
	this.linewidth = 2 * this.poem.ratio;
	this.scoreValue = 23;

	this.spawnPoint = new THREE.Vector2(x,y);
	this.position = new THREE.Vector2(x,y);
	
	this.dead = false;

	this.speed = 0;

	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;

	this.thrustSpeed = 0.5;
	this.thrust = 0;

	this.bankSpeed = 0.03;
	this.bank = 0;
	this.maxSpeed = 1000;
	
	this.radius = 3;

	this.addObject();
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
	if( !_.isObject( this.poem.spiderlings ) ) {
		throw new Error("Arachnids require spiderlings");
	}
	
	
};

module.exports = Arachnid;

Arachnid.prototype = {
	
	damageSettings : {
		color: 0xBC492A,
		transparent: true,
		opacity: 0.5,
		retainExplosionsCount: 3,
		perExplosion: 20
	},
	
	initSharedAssets : function( manager ) {
		
		var geometry = this.createGeometry();
		
		manager.shared.geometry = geometry;
		
		manager.on('update', Arachnid.prototype.updateGeometry( geometry ) );
	},
	
	updateGeometry : function( geometry ) {

		return function( e ) {
			
			_.each( geometry.waveyVerts, function( vec ) {
				vec.y = 0.8 * Math.sin( e.time / 100 + vec.x ) + vec.original.y;
			});
			
			
			
		};
	},

	createGeometry : function() {

		var geometry, verts, manhattanLength, center;
	
		geometry = new THREE.Geometry();
		
		verts = [[373.900,249.200], [466.000,191.600], [556.700,314.200], [556.600,254.000], [454.900,138.800], [361.400,203.200], [354.800,187.600], [344.300,176.800], [332.800,170.900], [319.000,168.700], [303.300,171.600], [291.400,178.600], [282.600,188.600], [276.600,203.500], [182.800,138.800], [81.000,254.000], [80.900,314.200], [171.600,191.600], [263.700,249.200], [163.600,247.300], [91.600,354.600], [117.600,423.300], [169.000,290.000], [252.300,286.700], [186.400,321.400], [149.700,444.700], [183.000,498.700], [207.300,345.900], [252.300,326.100], [231.700,372.800], [259.000,417.400], [294.000,428.700], [261.100,376.500], [295.000,322.600], [319.000,316.100], [319.000,316.100], [342.800,322.600], [376.500,376.500], [343.600,428.700], [378.600,417.400], [405.900,372.800], [385.300,326.000], [430.300,345.800], [454.600,498.600], [487.900,444.600], [451.200,321.300], [385.300,286.600], [468.600,289.900], [519.900,423.200], [545.900,354.500], [473.900,247.200], [373.900,249.200]];

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [ 0, 0 ]);
	
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
			
			if( vec2[0] > 400 || vec2[0] < 200 ) {
				geometry.waveyVerts.push( vec3 );
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
		this.object.scale.multiplyScalar( 0.6 );
		this.object.position.z += this.poem.r;
	
		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.position );

		var spiderlings = random.rangeInt( 2, 5 );
		var shipTheta = Math.atan2(
			this.poem.ship.position.y - this.position.y,
			this.poem.coordinates.keepDiffInRange(
				this.poem.ship.position.x - this.position.x
			)
		);
		
		
		var spiderlingTheta;
		
		var thetaSpread = Math.PI * 0.25;
		var thetaStep = thetaSpread / spiderlings;
		var reverseShipTheta = shipTheta + Math.PI;

		for( var i=0; i < spiderlings; i++ ) {
			
			this.poem.spiderlings.add(
				this.position.x,
				this.position.y,
				reverseShipTheta + random.range(0, 1) * (i * thetaStep - (thetaSpread / 2) )
			);
			
		}
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
},{"../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Asteroid.js":[function(require,module,exports){
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
},{"../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","underscore":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Bullet.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/JellyShip.js":[function(require,module,exports){
var Damage = require('../components/Damage');
var random = require('../utils/random');
var destroyMesh = require('../utils/destroyMesh');
var color = 0xcb36ea;

var Jellyship = function( poem, manager, x, y ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Jellyship";
	this.color = color;
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
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
};

module.exports = Jellyship;

Jellyship.prototype = {
	
	damageSettings : {
		color: 0xcb36ea
	},
	
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
	
		geometry = new THREE.Geometry();
		
		/* jshint ignore:start */
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
		/* jshint ignore:end */

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [ 0, 0 ]);
	
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
				geometry.waveyVerts.push( vec3 );
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
		this.damage.explode( this.position );
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
},{"../components/Damage":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Damage.js","../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Jellyship.js":[function(require,module,exports){
arguments[4]["/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/JellyShip.js"][0].apply(exports,arguments)
},{"../components/Damage":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Damage.js","../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Spiderlings.js":[function(require,module,exports){
var random = require('../utils/random');
var destroyMesh = require('../utils/destroyMesh');
var color = 0xff0000;

var Spiderling = function( poem, manager, x, y, theta ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Spiderling";
	this.color = color;
	this.cssColor = "#ff0000";
	this.linewidth = 2 * this.poem.ratio;
	this.scoreValue = -5;

	this.spawnPoint = new THREE.Vector2(x,y);
	this.position = new THREE.Vector2(x,y);
	this.unitDirection = new THREE.Vector2(
		Math.cos( theta ),
		Math.sin( theta )
	);
	this.list = random.range( -Math.PI / 8, Math.PI / 8 );
	
	this.dead = false;

	

	this.speed = 0.02;
	
	this.radius = 1.5;
	this.thetaJitter = random.range( -Math.PI * 0.2, Math.PI * 0.2 );

	this.addObject();
	this.damage = manager.damage;
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
};

module.exports = Spiderling;

Spiderling.prototype = {
	
	damageSettings : {
		color: color,
		transparent: true,
		opacity: 0.5,
		retainExplosionsCount: 3,
		perExplosion: 5
	},
	
	initSharedAssets : function( manager ) {
		
		var geometry = this.createGeometry();
		
		manager.shared.geometry = geometry;
		
		manager.on('update', Spiderling.prototype.updateGeometry( geometry ) );
	},
	
	updateGeometry : function( geometry ) {

		return function( e ) {

			var time = (e.time / 100);
			var interval = Math.PI * 6 / geometry.waveyVerts.length;
			_.each( geometry.waveyVerts, function( vec, i ) {
				
				var unitI = Math.sin( i * interval + time ) * 0.8 + 0.2;
				
				vec.x = unitI * vec.original.x;
				vec.y = unitI * vec.original.y;
				
			});
			
		};
	},

	createGeometry : function() {

		var geometry, verts, manhattanLength, center;
	
		geometry = new THREE.Geometry();
		
		var sides = 16;
		
		var increment = Math.PI * 2 / (sides-1);
		
		/* jshint ignore:start */
		verts = _.map( _.range(sides), function( i ) {
			return [
				Math.cos( i * increment ) * 2,
				Math.sin( i * increment ) * 2
			];
		});
		/* jshint ignore:end */
		
		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [ 0, 0 ]);
	
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2, i ) {
			
			var scale = 1;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( i % 2 === 0 ) {
				geometry.waveyVerts.push( vec3 );
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
		this.object.scale.multiplyScalar( random.range( 0.3, 0.8 ) );
		this.object.position.z += this.poem.r;
	
		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.position );
	},

	reset : function() {
		this.position.copy( this.spawnPoint );
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},

	update : function( e ) {
		
		if( this.dead ) {
			this.damage.update( e );
		} else {
			this.object.geometry.verticesNeedUpdate = true;
			this.updatePosition( e );
		}

	},

	updatePosition : function() {
	
		var unitSeek = new THREE.Vector2();
		var velocity = new THREE.Vector2();
	
		return function( e ) {

			var theta = Math.atan2(
				this.poem.ship.position.y - this.position.y,
				this.poem.coordinates.keepDiffInRange(
					this.poem.ship.position.x - this.position.x
				)
			);
			
			unitSeek.x = Math.cos( theta + this.list );
			unitSeek.y = Math.sin( theta + this.list );
			
			velocity
				.copy( this.unitDirection )
				.lerp( unitSeek, 0.02 )
				.normalize()
			;
			
			this.unitDirection.copy( velocity );
			
			velocity.multiplyScalar( this.speed * e.dt );
			
			this.position.add( velocity );
			
			this.object.position.y = this.position.y;
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
			
		};
	
	}()	


};
},{"../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js","../utils/random":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levelLoader.js":[function(require,module,exports){
var Poem = null;
var levels = require('./levels');
var EventDispatcher = require('./utils/EventDispatcher');

var currentLevel = null;
var currentPoem = null;
var titleHideTimeout = null;

function showTitles() {
	
	clearTimeout( titleHideTimeout );
	
	$('#title')
		.removeClass('transform-transition')
		.addClass('hide')
		.addClass('transform-transition')
		.show();
	
	setTimeout(function() {
		$('#title').removeClass('hide');
	}, 1);
	
	$('.score').css('opacity', 0);
	
}

function hideTitles() {

	$('.score').css('opacity', 1);
	
	if( $('#title:visible').length > 0 ) {		
	
		$('#title')
			.addClass('transform-transition')
			.addClass('hide');

		titleHideTimeout = setTimeout(function() {
	
			$('#title').hide();
	
		}, 1000);
	}
			
	
}

var levelLoader = {
	
	init : function( PoemClass ) {
		Poem = PoemClass;
	},
	
	load : function( slug ) {
		
		if( !_.isObject(levels[slug]) ) {
			return false;
		}
		
		if(currentPoem) currentPoem.destroy();
		
		currentLevel = levels[slug];
		currentPoem = new Poem( currentLevel, slug );
		
		if( slug === "titles" ) {
			showTitles();
		} else {
			hideTitles();
		}
		
		this.dispatch({
			type: "newLevel",
			level: currentLevel,
			poem: currentPoem
		});
		
		window.poem = currentPoem;
	
		return true;
	}
	
};

EventDispatcher.prototype.apply( levelLoader );

module.exports = levelLoader;

},{"./levels":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/index.js","./utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/asteroidsJellies.js":[function(require,module,exports){
var numberOfJellies = 25;

module.exports = {
	name : "Polar Rocks",
	description : "Flight into the asteroid field",
	order : 2,
	maxScore : numberOfJellies * 13,
	config : {
		scoringAndWinning: {
			message: "Arachnids detected in the next sector.<br/>Please spare their babies.<br/>",
			nextLevel: "web",
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
				count: numberOfJellies
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
},{"../entities/Jellyship":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Jellyship.js","../managers/AsteroidField":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/AsteroidField.js","../managers/EntityManager":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/EntityManager.js","../sound/Music":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/index.js":[function(require,module,exports){
module.exports = {
	asteroidsJellies : require("./asteroidsJellies"),
	titles : require("./titles"),
	intro : require("./intro"),
	web : require("./web")
};
},{"./asteroidsJellies":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/asteroidsJellies.js","./intro":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/intro.js","./titles":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/titles.js","./web":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/web.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/intro.js":[function(require,module,exports){
var numberOfJellies = 5;

module.exports = {
	name : "Intro",
	description : "Invasion of the Jellies",
	order : 1,
	maxScore : 13 * numberOfJellies,
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
				count: numberOfJellies
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
},{"../components/CameraIntro":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/CameraIntro.js","../components/CylinderLines":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/CylinderLines.js","../entities/Jellyship":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Jellyship.js","../managers/EntityManager":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/EntityManager.js","../sound/Music":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/titles.js":[function(require,module,exports){
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
},{"../components/Titles":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Titles.js","../sound/Music":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/web.js":[function(require,module,exports){
var numberOfArachnids = 20;

module.exports = {
	name : "Stuck in the Web",
	description : "Don't hurt the babies",
	maxScore : 23 * numberOfArachnids,
	order: 3,
	config : {
		r : 110,
		// height : 60,
		// circumference : 900,
		cameraMultiplier : 2,
		scoringAndWinning: {
			message: "Hopefully the spiderlings will grow into pleasant individuals. Follow me on <a href='https://twitter.com/tatumcreative'>Twitter</a> for updates on new levels.",
			nextLevel: "titles",
			conditions: [
				{
					//No arachnids left
					component: "arachnids",
					properties: null
				}
			]
		},
		stars: {
	 		 count: 3000
		}
	},
	objects : {
		web : {
			object: require("../components/Web"),
			properties: {}
		},
		// cameraIntro : {
		// 	object: require("../components/CameraIntro"),
		// 	properties: {
		// 		speed : 0.989
		// 	}
		// },
		spiderlings : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Spiderlings'),
				count: 0
			}
		},
		arachnids : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Arachnid'),
				count: numberOfArachnids
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/electrochip-artillery"
			}
		}
	}
};
},{"../components/Web":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Web/index.js","../entities/Arachnid":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Arachnid.js","../entities/Spiderlings":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Spiderlings.js","../managers/EntityManager":"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/EntityManager.js","../sound/Music":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/Music.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/AsteroidField.js":[function(require,module,exports){
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
},{"../entities/Asteroid":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Asteroid.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/EntityManager.js":[function(require,module,exports){
var Collider = require('../utils/Collider');
var DefaultJellyShip = require('../entities/JellyShip');
var EventDispatcher = require('../utils/EventDispatcher');
var Damage = require('../components/Damage');

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

	this.damage = new Damage( this.poem, this.entityType.prototype.damageSettings );
	
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
			entity.damage = this.damage;
			
			this.entities.push( entity );
			this.liveEntities.push( entity );
		
		}
		
		this.poem.scoringAndWinning.adjustEnemies( count );
		
	},
	
	add : function( x, y, theta ) {
		
		var entity = new this.entityType( this.poem, this, x, y, theta );
		
		entity.bank = theta;
		entity.update({
			dt: 0
		});
		
		this.entities.push( entity );
		this.liveEntities.push( entity );
		
		this.poem.scoringAndWinning.adjustEnemies( 1 );
		
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
				
				var sign = (entity.scoreValue > 0) ? "+" : "";
				var color = (entity.scoreValue > 0) ? entity.cssColor : "#ff0000";
				
				if( entity.scoreValue !== 0 ) {
					
					this.poem.scoringAndWinning.adjustScore(
						entity.scoreValue,
						sign + entity.scoreValue + " " + entity.name, 
						{
							"color" : color
						}
					);
					
				}
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
},{"../components/Damage":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/Damage.js","../entities/JellyShip":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/JellyShip.js","../utils/Collider":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Collider.js","../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/managers/Gun.js":[function(require,module,exports){
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
},{"../entities/Bullet":"/Users/gregtatum/Google Drive/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/SoundGenerator.js","../utils/Collider":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Collider.js","../utils/destroyMesh":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/routing.js":[function(require,module,exports){
var crossroads = require('crossroads');
var hasher = require('hasher');
var routing = require('./routing');
var levelLoader = require('./levelLoader');

var baseUrl = '/polar';
var defaultLevel = "titles";
var currentLevel = "";

var routing = {
	
	start : function( Poem ) {
		
		levelLoader.init( Poem );
		
		function parseHash( newHash, oldHash ){
			crossroads.parse( newHash );
		}
		
		crossroads.addRoute( '/',				routing.showMainTitles );
		crossroads.addRoute( 'level/{name}',	routing.loadUpALevel );
	
		crossroads.addRoute( /.*/, function reRouteToMainTitlesIfNoMatch() {
			hasher.replaceHash('');
		});
	
		hasher.initialized.add(parseHash); // parse initial hash
		hasher.changed.add(parseHash); //parse hash changes
		hasher.init(); //start listening for history change
		
	},
	
	showMainTitles : function() {

		_gaq.push( [ '_trackPageview', baseUrl ] );
	
		levelLoader.load( defaultLevel );		

	},

	loadUpALevel : function( levelName ) {

		_gaq.push( [ '_trackPageview', baseUrl+'/#level/'+levelName ] );
	
		var levelFound = levelLoader.load( levelName );
	
		if( !levelFound ) {
			levelLoader.load( defaultLevel );
		}
		
	},
	
	on : levelLoader.on,
	off : levelLoader.off
	
};

module.exports = routing;
},{"./levelLoader":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levelLoader.js","./routing":"/Users/gregtatum/Google Drive/greg-sites/polar/js/routing.js","crossroads":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/crossroads/dist/crossroads.js","hasher":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/dist/js/hasher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/Music.js":[function(require,module,exports){
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
			
		}, function( err, src, data, div ) {
			
			//Nullify callbacks that are out of order
			if( currentTime !== timesCalledSoundcloud ) return;
			if( muter.muted ) return;

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
			
			if( audio ) {
				audio.pause();
				audio = null;
			}
			
			$('.npm-scb-white').remove();
			
		});
		
	};
	
	if( !muter.muted ) {
		
		fetchAndPlaySong();
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
},{"./muter":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/muter.js","soundcloud-badge":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/SoundGenerator.js":[function(require,module,exports){
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
},{"./muter":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/muter.js","underscore":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/muter.js":[function(require,module,exports){
var EventDispatcher = require('../utils/EventDispatcher');
var localforage = require('localforage');
var muter;

var Muter = function() {
	
	this.muted = true;
	
	localforage.getItem('muted', function( err, value ) {

		if( err || value === null ) {
			this.muted = false;
		} else {
			this.muted = value;
		}
		
		this.dispatchChanged();
		
	}.bind(this));
	
};

Muter.prototype = {
	
	mute : function() {
		this.muted = true;
		this.dispatchChanged();
		this.save();
	},
	
	unmute : function() {
		this.muted = false;
		this.dispatchChanged();
		this.save();
	},
	
	save : function() {
		localforage.setItem( 'muted', this.muted );
	},
	
	dispatchChanged : function() {
		
		if( this.muted ) {
			muter.dispatch({
				type: 'mute'
			});
			
		} else {
			muter.dispatch({
				type: 'unmute'
			});
		}
	}
	
};

EventDispatcher.prototype.apply( Muter.prototype );

muter = new Muter();

$(window).on('keydown', function muteAudioOnHittingS( e ) {
	
	if( e.keyCode !== 83 ) return;
	
	if( muter.muted ) {
		muter.unmute();
	} else {
		muter.mute();
	}
	
});

module.exports = muter;

},{"../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js","localforage":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/localforage.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/index.js":[function(require,module,exports){
var menu = require('./menu');
var mute = require('./mute');
var menuLevels = require('./menuLevels');

jQuery(function($) {
	
	menu.setHandlers();
	mute.setHandlers();
	
});
},{"./menu":"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/menu.js","./menuLevels":"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/menuLevels.js","./mute":"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/mute.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/menu.js":[function(require,module,exports){
var	EventDispatcher	= require('../utils/EventDispatcher');
var	routing		= require('../routing');
var	scores			= require('../components/scores');

var poem;
var isOpen = false;
var $body;

routing.on( 'newLevel', function( e ) {

	poem = e.poem;
	
});


var menu = {
	
	setHandlers : function() {
		
		$body = $('body');
		
		$('#menu a, #container-blocker').click( menu.close );
		
		$('#menu-button').off().click( this.toggle );
		$('#menu-reset-score').off().click( this.resetScores );
		
		routing.on( 'newLevel', menu.close );
		
		$(window).on('keydown', function toggleMenuHandler( e ) {
	
			if( e.keyCode !== 27 ) return;
			menu.toggle(e);
	
		});
		
		
	},
	
	resetScores : function(e) {
		
		e.preventDefault();
		
		if( confirm( "Are you sure you want to reset your scores?" ) ) {
			scores.reset();
		}
		
	},
	
	toggle : function( e ) {

		e.preventDefault();
		
		if( isOpen ) {
			menu.close();
		} else {
			menu.open();
		}
		
		isOpen = !isOpen;
		
	},
	
	close : function() {
		$body.removeClass('menu-open');
		if( poem ) poem.start();
	},
	
	open : function() {
		$body.addClass('menu-open');
		if( poem ) poem.pause();
	}
	
};

EventDispatcher.prototype.apply( menu );
module.exports = menu;
},{"../components/scores":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/scores.js","../routing":"/Users/gregtatum/Google Drive/greg-sites/polar/js/routing.js","../utils/EventDispatcher":"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/menuLevels.js":[function(require,module,exports){
var scores = require('../components/scores');
var levelKeyPairs = (function sortAndFilterLevels( levels ) {
		
	return _.chain(levels)
		.pairs()
		.filter(function( keypair ) {
			return keypair[1].order;
		})
		.sortBy(function( keypair ) {
			return keypair[1].order;
		})
	.value();
	
})( require('../levels') );

function reactiveLevels( $scope, template ) {
	
	$scope.children().remove();
	
	var templateData = _.map( levelKeyPairs, function( keypair ) {
		
		var slug = keypair[0];
		var level = keypair[1];
		
		var score = scores.get( slug );
		
		return {
			name : level.name,
			description : level.description,
			slug : slug,
			percent : score ? score.percent : 0,
			score : score ? score.value : 0,
			total : score ? score.total : 1,
			leftOrRight : score && score.unitI < 0.5 ? "right" : "left"
		};
		
	});
	
	$scope.append( _.reduce( templateData, function( memo, text) {
		
		return memo + template( text );
		
	}, "") );
}

(function init() {
	
	var template = _.template( $('#menu-level-template').text() );
	var $scope = $('#menu-levels');
	
	function updateReactiveLevels() {
		reactiveLevels( $scope, template );
	}
	
	scores.on( 'change', updateReactiveLevels );
	updateReactiveLevels();
	
})();

},{"../components/scores":"/Users/gregtatum/Google Drive/greg-sites/polar/js/components/scores.js","../levels":"/Users/gregtatum/Google Drive/greg-sites/polar/js/levels/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/ui/mute.js":[function(require,module,exports){
var muter = require('../sound/muter');

var mutedSrc = 'assets/images/sound-mute.png';
var unMutedSrc = 'assets/images/sound-unmute.png';
var mutedSrcHover = 'assets/images/sound-mute-hover.png';
var unMutedSrcHover = 'assets/images/sound-unmute-hover.png';

new Image().src = mutedSrc;
new Image().src = unMutedSrc;
new Image().src = mutedSrcHover;
new Image().src = unMutedSrcHover;


var $mute;
var $img;

module.exports = {
	
	setHandlers : function() {
		
		$mute = $('#mute');
		$img = $mute.find('img');
		
		muter.on('mute', function() {
			$img.attr( 'src', mutedSrc );
		});
		
		muter.on('unmute', function() {
			$img.attr( 'src', unMutedSrc );
		});
		
		$img.attr( 'src', muter.muted ? mutedSrc : unMutedSrc );
		
		$mute.off().click( function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
			
				$img.attr('src', unMutedSrcHover);
				muter.unmute();
			
			} else {
			
				$img.attr('src', mutedSrcHover);
				muter.mute();
			
			}
			e.stopImmediatePropagation();
		
		});

		$mute.on('mouseover', function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
				$img.attr('src', mutedSrcHover);
			} else {
				$img.attr('src', unMutedSrcHover);
			}
		
		});
		
		$mute.on('mouseout', function( e ) {
			
			if( muter.muted ) {
				$img.attr('src', mutedSrc);
			} else {
				$img.attr('src', unMutedSrc);
			}		
		});
		
	}
	
};
},{"../sound/muter":"/Users/gregtatum/Google Drive/greg-sites/polar/js/sound/muter.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Clock.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Collider.js":[function(require,module,exports){
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
},{"underscore":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/underscore/underscore.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Coordinates.js":[function(require,module,exports){
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
		vector.y = this.keepInRangeY( vector.y );
		return vector;
	},
	
	keepDiffInRange : function( diff ) {
		
		var xWidth = this.poem.circumference;
		
		while( diff <= xWidth / -2 ) diff += xWidth;
		while( diff > xWidth / 2 ) diff -= xWidth;
		
		return diff;
	},
	
	twoXToTheta : function( x ) {
		return x * this.poem.circumferenceRatio;
	},
	
	circumferenceDistance : function (x1, x2) {
		
		var ratio = this.poem.circumferenceRatio;
		
		return this.twoRSquared - this.twoRSquared * Math.cos( x1 * ratio - x2 * ratio );
		
	}
	
};

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/EventDispatcher.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/Stats.js":[function(require,module,exports){
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
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/destroyMesh.js":[function(require,module,exports){
module.exports = function destroyMesh( obj ) {
	return function() {
		if( obj.geometry ) obj.geometry.dispose();
		if( obj.material ) obj.material.dispose();
	};
};
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/random.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/js/utils/selectors.js":[function(require,module,exports){
var selectors = function( scopeOrSelector, selectors, allowEmptySelections ) {
	
	var $scope = $( scopeOrSelector );
	
	return _.reduce( selectors, function( memo, selector, key ) {
		
		memo[key] = $( selector, $scope );
		
		if( !allowEmptySelections ) {
			if( memo[key].length === 0 ) {
				throw new Error("Empty selections are not allowed");
			}
		}
		
		return memo;
		
	}, { "scope" : $scope } );
	
};

module.exports = selectors;

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/crossroads/dist/crossroads.js":[function(require,module,exports){
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


},{"signals":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/glslify/browser.js":[function(require,module,exports){
module.exports = noop

function noop() {
  throw new Error(
      'You should bundle your code ' +
      'using `glslify` as a transform.'
  )
}

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/glslify/simple-adapter.js":[function(require,module,exports){
module.exports = programify

function programify(vertex, fragment, uniforms, attributes) {
  return {
    vertex: vertex, 
    fragment: fragment,
    uniforms: uniforms, 
    attributes: attributes
  };
}

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/lib/_empty.js":[function(require,module,exports){

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/decode.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/encode.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/index.js":[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/decode.js","./encode":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/encode.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/dist/js/hasher.js":[function(require,module,exports){
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

},{"signals":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/node_modules/signals/dist/signals.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/hasher/node_modules/signals/dist/signals.js":[function(require,module,exports){
arguments[4]["/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/crossroads/node_modules/signals/dist/signals.js"][0].apply(exports,arguments)
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/core.js":[function(require,module,exports){
'use strict';

var asap = require('asap')

module.exports = Promise
function Promise(fn) {
  if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
  if (typeof fn !== 'function') throw new TypeError('not a function')
  var state = null
  var value = null
  var deferreds = []
  var self = this

  this.then = function(onFulfilled, onRejected) {
    return new Promise(function(resolve, reject) {
      handle(new Handler(onFulfilled, onRejected, resolve, reject))
    })
  }

  function handle(deferred) {
    if (state === null) {
      deferreds.push(deferred)
      return
    }
    asap(function() {
      var cb = state ? deferred.onFulfilled : deferred.onRejected
      if (cb === null) {
        (state ? deferred.resolve : deferred.reject)(value)
        return
      }
      var ret
      try {
        ret = cb(value)
      }
      catch (e) {
        deferred.reject(e)
        return
      }
      deferred.resolve(ret)
    })
  }

  function resolve(newValue) {
    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.')
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then
        if (typeof then === 'function') {
          doResolve(then.bind(newValue), resolve, reject)
          return
        }
      }
      state = true
      value = newValue
      finale()
    } catch (e) { reject(e) }
  }

  function reject(newValue) {
    state = false
    value = newValue
    finale()
  }

  function finale() {
    for (var i = 0, len = deferreds.length; i < len; i++)
      handle(deferreds[i])
    deferreds = null
  }

  doResolve(fn, resolve, reject)
}


function Handler(onFulfilled, onRejected, resolve, reject){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  this.resolve = resolve
  this.reject = reject
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, onFulfilled, onRejected) {
  var done = false;
  try {
    fn(function (value) {
      if (done) return
      done = true
      onFulfilled(value)
    }, function (reason) {
      if (done) return
      done = true
      onRejected(reason)
    })
  } catch (ex) {
    if (done) return
    done = true
    onRejected(ex)
  }
}

},{"asap":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/node_modules/asap/asap.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/index.js":[function(require,module,exports){
'use strict';

//This file contains then/promise specific extensions to the core promise API

var Promise = require('./core.js')
var asap = require('asap')

module.exports = Promise

/* Static Functions */

function ValuePromise(value) {
  this.then = function (onFulfilled) {
    if (typeof onFulfilled !== 'function') return this
    return new Promise(function (resolve, reject) {
      asap(function () {
        try {
          resolve(onFulfilled(value))
        } catch (ex) {
          reject(ex);
        }
      })
    })
  }
}
ValuePromise.prototype = Object.create(Promise.prototype)

var TRUE = new ValuePromise(true)
var FALSE = new ValuePromise(false)
var NULL = new ValuePromise(null)
var UNDEFINED = new ValuePromise(undefined)
var ZERO = new ValuePromise(0)
var EMPTYSTRING = new ValuePromise('')

Promise.resolve = function (value) {
  if (value instanceof Promise) return value

  if (value === null) return NULL
  if (value === undefined) return UNDEFINED
  if (value === true) return TRUE
  if (value === false) return FALSE
  if (value === 0) return ZERO
  if (value === '') return EMPTYSTRING

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then
      if (typeof then === 'function') {
        return new Promise(then.bind(value))
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex)
      })
    }
  }

  return new ValuePromise(value)
}

Promise.from = Promise.cast = function (value) {
  var err = new Error('Promise.from and Promise.cast are deprecated, use Promise.resolve instead')
  err.name = 'Warning'
  console.warn(err.stack)
  return Promise.resolve(value)
}

Promise.denodeify = function (fn, argumentCount) {
  argumentCount = argumentCount || Infinity
  return function () {
    var self = this
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      while (args.length && args.length > argumentCount) {
        args.pop()
      }
      args.push(function (err, res) {
        if (err) reject(err)
        else resolve(res)
      })
      fn.apply(self, args)
    })
  }
}
Promise.nodeify = function (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : null
    try {
      return fn.apply(this, arguments).nodeify(callback)
    } catch (ex) {
      if (callback === null || typeof callback == 'undefined') {
        return new Promise(function (resolve, reject) { reject(ex) })
      } else {
        asap(function () {
          callback(ex)
        })
      }
    }
  }
}

Promise.all = function () {
  var calledWithArray = arguments.length === 1 && Array.isArray(arguments[0])
  var args = Array.prototype.slice.call(calledWithArray ? arguments[0] : arguments)

  if (!calledWithArray) {
    var err = new Error('Promise.all should be called with a single array, calling it with multiple arguments is deprecated')
    err.name = 'Warning'
    console.warn(err.stack)
  }

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([])
    var remaining = args.length
    function res(i, val) {
      try {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then
          if (typeof then === 'function') {
            then.call(val, function (val) { res(i, val) }, reject)
            return
          }
        }
        args[i] = val
        if (--remaining === 0) {
          resolve(args);
        }
      } catch (ex) {
        reject(ex)
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i])
    }
  })
}

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) { 
    reject(value);
  });
}

Promise.race = function (values) {
  return new Promise(function (resolve, reject) { 
    values.forEach(function(value){
      Promise.resolve(value).then(resolve, reject);
    })
  });
}

/* Prototype Methods */

Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this
  self.then(null, function (err) {
    asap(function () {
      throw err
    })
  })
}

Promise.prototype.nodeify = function (callback) {
  if (typeof callback != 'function') return this

  this.then(function (value) {
    asap(function () {
      callback(null, value)
    })
  }, function (err) {
    asap(function () {
      callback(err)
    })
  })
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
}

},{"./core.js":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/core.js","asap":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/node_modules/asap/asap.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/node_modules/asap/asap.js":[function(require,module,exports){
(function (process){

// Use the fastest possible means to execute a task in a future turn
// of the event loop.

// linked list of tasks (single, with head node)
var head = {task: void 0, next: null};
var tail = head;
var flushing = false;
var requestFlush = void 0;
var isNodeJS = false;

function flush() {
    /* jshint loopfunc: true */

    while (head.next) {
        head = head.next;
        var task = head.task;
        head.task = void 0;
        var domain = head.domain;

        if (domain) {
            head.domain = void 0;
            domain.enter();
        }

        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function() {
                   throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    flushing = false;
}

if (typeof process !== "undefined" && process.nextTick) {
    // Node.js before 0.9. Note that some fake-Node environments, like the
    // Mocha test runner, introduce a `process` global without a `nextTick`.
    isNodeJS = true;

    requestFlush = function () {
        process.nextTick(flush);
    };

} else if (typeof setImmediate === "function") {
    // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
    if (typeof window !== "undefined") {
        requestFlush = setImmediate.bind(window, flush);
    } else {
        requestFlush = function () {
            setImmediate(flush);
        };
    }

} else if (typeof MessageChannel !== "undefined") {
    // modern browsers
    // http://www.nonblocking.io/2011/06/windownexttick.html
    var channel = new MessageChannel();
    channel.port1.onmessage = flush;
    requestFlush = function () {
        channel.port2.postMessage(0);
    };

} else {
    // old browsers
    requestFlush = function () {
        setTimeout(flush, 0);
    };
}

function asap(task) {
    tail = tail.next = {
        task: task,
        domain: isNodeJS && process.domain,
        next: null
    };

    if (!flushing) {
        flushing = true;
        requestFlush();
    }
};

module.exports = asap;


}).call(this,require('_process'))
},{"_process":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/process/browser.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/indexeddb.js":[function(require,module,exports){
// Some code originally from async_storage.js in
// [Gaia](https://github.com/mozilla-b2g/gaia).
(function() {
    'use strict';

    // Originally found in https://github.com/mozilla-b2g/gaia/blob/e8f624e4cc9ea945727278039b3bc9bcb9f8667a/shared/js/async_storage.js

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    // Initialize IndexedDB; fall back to vendor-prefixed versions if needed.
    var indexedDB = indexedDB || this.indexedDB || this.webkitIndexedDB ||
                    this.mozIndexedDB || this.OIndexedDB ||
                    this.msIndexedDB;

    // If IndexedDB isn't available, we get outta here!
    if (!indexedDB) {
        return;
    }

    // Open the IndexedDB database (automatically creates one if one didn't
    // previously exist), using any options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {
            db: null
        };

        if (options) {
            for (var i in options) {
                dbInfo[i] = options[i];
            }
        }

        return new Promise(function(resolve, reject) {
            var openreq = indexedDB.open(dbInfo.name, dbInfo.version);
            openreq.onerror = function() {
                reject(openreq.error);
            };
            openreq.onupgradeneeded = function() {
                // First time setup: create an empty object store
                openreq.result.createObjectStore(dbInfo.storeName);
            };
            openreq.onsuccess = function() {
                dbInfo.db = openreq.result;
                self._dbInfo = dbInfo;
                resolve();
            };
        });
    }

    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                    .objectStore(dbInfo.storeName);
                var req = store.get(key);

                req.onsuccess = function() {
                    var value = req.result;
                    if (value === undefined) {
                        value = null;
                    }

                    resolve(value);
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    // Iterate over all items stored in database.
    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                                     .objectStore(dbInfo.storeName);

                var req = store.openCursor();

                req.onsuccess = function() {
                    var cursor = req.result;

                    if (cursor) {
                        var result = iterator(cursor.value, cursor.key);

                        if (result !== void(0)) {
                            resolve(result);
                        } else {
                            cursor.continue();
                        }
                    } else {
                        resolve();
                    }
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);

        return promise;
    }

    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);

                // The reason we don't _save_ null is because IE 10 does
                // not support saving the `null` type in IndexedDB. How
                // ironic, given the bug below!
                // See: https://github.com/mozilla/localForage/issues/161
                if (value === null) {
                    value = undefined;
                }

                var req = store.put(value, key);
                req.onsuccess = function() {
                    // Cast to undefined so the value passed to
                    // callback/promise is the same as what one would get out
                    // of `getItem()` later. This leads to some weirdness
                    // (setItem('foo', undefined) will return `null`), but
                    // it's not my fault localStorage is our baseline and that
                    // it's weird.
                    if (value === undefined) {
                        value = null;
                    }

                    resolve(value);
                };
                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);

                // We use a Grunt task to make this safe for IE and some
                // versions of Android (including those used by Cordova).
                // Normally IE won't like `.delete()` and will insist on
                // using `['delete']()`, but we have a build step that
                // fixes this for us now.
                var req = store.delete(key);
                req.onsuccess = function() {
                    resolve();
                };

                req.onerror = function() {
                    reject(req.error);
                };

                // The request will be aborted if we've exceeded our storage
                // space. In this case, we will reject with a specific
                // "QuotaExceededError".
                req.onabort = function(event) {
                    var error = event.target.error;
                    if (error === 'QuotaExceededError') {
                        reject(error);
                    }
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function clear(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readwrite')
                              .objectStore(dbInfo.storeName);
                var req = store.clear();

                req.onsuccess = function() {
                    resolve();
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeDeferedCallback(promise, callback);
        return promise;
    }

    function length(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);
                var req = store.count();

                req.onsuccess = function() {
                    resolve(req.result);
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function key(n, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            if (n < 0) {
                resolve(null);

                return;
            }

            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);

                var advanced = false;
                var req = store.openCursor();
                req.onsuccess = function() {
                    var cursor = req.result;
                    if (!cursor) {
                        // this means there weren't enough keys
                        resolve(null);

                        return;
                    }

                    if (n === 0) {
                        // We have the first key, return it if that's what they
                        // wanted.
                        resolve(cursor.key);
                    } else {
                        if (!advanced) {
                            // Otherwise, ask the cursor to skip ahead n
                            // records.
                            advanced = true;
                            cursor.advance(n);
                        } else {
                            // When we get here, we've got the nth key.
                            resolve(cursor.key);
                        }
                    }
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var store = dbInfo.db.transaction(dbInfo.storeName, 'readonly')
                              .objectStore(dbInfo.storeName);

                var req = store.openCursor();
                var keys = [];

                req.onsuccess = function() {
                    var cursor = req.result;

                    if (!cursor) {
                        resolve(keys);
                        return;
                    }

                    keys.push(cursor.key);
                    cursor.continue();
                };

                req.onerror = function() {
                    reject(req.error);
                };
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    function executeDeferedCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                deferCallback(callback, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    // Under Chrome the callback is called before the changes (save, clear)
    // are actually made. So we use a defer function which wait that the
    // call stack to be empty.
    // For more info : https://github.com/mozilla/localForage/issues/175
    // Pull request : https://github.com/mozilla/localForage/pull/178
    function deferCallback(callback, result) {
        if (callback) {
            return setTimeout(function() {
                return callback(null, result);
            }, 0);
        }
    }

    var asyncStorage = {
        _driver: 'asyncStorage',
        _initStorage: _initStorage,
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('asyncStorage', function() {
            return asyncStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = asyncStorage;
    } else {
        this.asyncStorage = asyncStorage;
    }
}).call(window);

},{"promise":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/localstorage.js":[function(require,module,exports){
// If IndexedDB isn't available, we'll fall back to localStorage.
// Note that this will have considerable performance and storage
// side-effects (all data will be serialized on save and only data that
// can be converted to a string via `JSON.stringify()` will be saved).
(function() {
    'use strict';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;
    var localStorage = null;

    // If the app is running inside a Google Chrome packaged webapp, or some
    // other context where localStorage isn't available, we don't use
    // localStorage. This feature detection is preferred over the old
    // `if (window.chrome && window.chrome.runtime)` code.
    // See: https://github.com/mozilla/localForage/issues/68
    try {
        // If localStorage isn't available, we get outta here!
        // This should be inside a try catch
        if (!this.localStorage || !('setItem' in this.localStorage)) {
            return;
        }
        // Initialize localStorage and create a variable to use throughout
        // the code.
        localStorage = this.localStorage;
    } catch (e) {
        return;
    }

    // Config the localStorage backend, using options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {};
        if (options) {
            for (var i in options) {
                dbInfo[i] = options[i];
            }
        }

        dbInfo.keyPrefix = dbInfo.name + '/';

        self._dbInfo = dbInfo;
        return Promise.resolve();
    }

    var SERIALIZED_MARKER = '__lfsc__:';
    var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

    // OMG the serializations!
    var TYPE_ARRAYBUFFER = 'arbf';
    var TYPE_BLOB = 'blob';
    var TYPE_INT8ARRAY = 'si08';
    var TYPE_UINT8ARRAY = 'ui08';
    var TYPE_UINT8CLAMPEDARRAY = 'uic8';
    var TYPE_INT16ARRAY = 'si16';
    var TYPE_INT32ARRAY = 'si32';
    var TYPE_UINT16ARRAY = 'ur16';
    var TYPE_UINT32ARRAY = 'ui32';
    var TYPE_FLOAT32ARRAY = 'fl32';
    var TYPE_FLOAT64ARRAY = 'fl64';
    var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH +
                                        TYPE_ARRAYBUFFER.length;

    // Remove all keys from the datastore, effectively destroying all data in
    // the app's key/value store!
    function clear(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var keyPrefix = self._dbInfo.keyPrefix;

                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i);

                    if (key.indexOf(keyPrefix) === 0) {
                        localStorage.removeItem(key);
                    }
                }

                resolve();
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Retrieve an item from the store. Unlike the original async_storage
    // library in Gaia, we don't modify return values at all. If a key's value
    // is `undefined`, we pass that value to the callback function.
    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                try {
                    var dbInfo = self._dbInfo;
                    var result = localStorage.getItem(dbInfo.keyPrefix + key);

                    // If a result was found, parse it from the serialized
                    // string into a JS object. If result isn't truthy, the key
                    // is likely undefined and we'll pass it straight to the
                    // callback.
                    if (result) {
                        result = _deserialize(result);
                    }

                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Iterate over all items in the store.
    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                try {
                    var keyPrefix = self._dbInfo.keyPrefix;
                    var keyPrefixLength = keyPrefix.length;
                    var length = localStorage.length;

                    for (var i = 0; i < length; i++) {
                        var key = localStorage.key(i);
                        var value = localStorage.getItem(key);

                        // If a result was found, parse it from the serialized
                        // string into a JS object. If result isn't truthy, the
                        // key is likely undefined and we'll pass it straight
                        // to the iterator.
                        if (value) {
                            value = _deserialize(value);
                        }

                        value = iterator(value, key.substring(keyPrefixLength));

                        if (value !== void(0)) {
                            resolve(value);
                            return;
                        }
                    }

                    resolve();
                } catch (e) {
                    reject(e);
                }
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Same as localStorage's key() method, except takes a callback.
    function key(n, callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var result;
                try {
                    result = localStorage.key(n);
                } catch (error) {
                    result = null;
                }

                // Remove the prefix from the key, if a key is found.
                if (result) {
                    result = result.substring(dbInfo.keyPrefix.length);
                }

                resolve(result);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                var length = localStorage.length;
                var keys = [];

                for (var i = 0; i < length; i++) {
                    if (localStorage.key(i).indexOf(dbInfo.keyPrefix) === 0) {
                        keys.push(localStorage.key(i).substring(dbInfo.keyPrefix.length));
                    }
                }

                resolve(keys);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Supply the number of keys in the datastore to the callback function.
    function length(callback) {
        var self = this;
        var promise = new Promise(function(resolve, reject) {
            self.keys().then(function(keys) {
                resolve(keys.length);
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Remove an item from the store, nice and simple.
    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                localStorage.removeItem(dbInfo.keyPrefix + key);

                resolve();
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Deserialize data we've inserted into a value column/field. We place
    // special markers into our strings to mark them as encoded; this isn't
    // as nice as a meta field, but it's the only sane thing we can do whilst
    // keeping localStorage support intact.
    //
    // Oftentimes this will just deserialize JSON content, but if we have a
    // special marker (SERIALIZED_MARKER, defined above), we will extract
    // some kind of arraybuffer/binary data/typed array out of the string.
    function _deserialize(value) {
        // If we haven't marked this string as being specially serialized (i.e.
        // something other than serialized JSON), we can just return it and be
        // done with it.
        if (value.substring(0,
            SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
            return JSON.parse(value);
        }

        // The following code deals with deserializing some kind of Blob or
        // TypedArray. First we separate out the type of data we're dealing
        // with from the data itself.
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH,
                                   TYPE_SERIALIZED_MARKER_LENGTH);

        // Fill the string into a ArrayBuffer.
        // 2 bytes for each char.
        var buffer = new ArrayBuffer(serializedString.length * 2);
        var bufferView = new Uint16Array(buffer);
        for (var i = serializedString.length - 1; i >= 0; i--) {
            bufferView[i] = serializedString.charCodeAt(i);
        }

        // Return the right type based on the code/type set during
        // serialization.
        switch (type) {
            case TYPE_ARRAYBUFFER:
                return buffer;
            case TYPE_BLOB:
                return new Blob([buffer]);
            case TYPE_INT8ARRAY:
                return new Int8Array(buffer);
            case TYPE_UINT8ARRAY:
                return new Uint8Array(buffer);
            case TYPE_UINT8CLAMPEDARRAY:
                return new Uint8ClampedArray(buffer);
            case TYPE_INT16ARRAY:
                return new Int16Array(buffer);
            case TYPE_UINT16ARRAY:
                return new Uint16Array(buffer);
            case TYPE_INT32ARRAY:
                return new Int32Array(buffer);
            case TYPE_UINT32ARRAY:
                return new Uint32Array(buffer);
            case TYPE_FLOAT32ARRAY:
                return new Float32Array(buffer);
            case TYPE_FLOAT64ARRAY:
                return new Float64Array(buffer);
            default:
                throw new Error('Unkown type: ' + type);
        }
    }

    // Converts a buffer to a string to store, serialized, in the backend
    // storage library.
    function _bufferToString(buffer) {
        var str = '';
        var uint16Array = new Uint16Array(buffer);

        try {
            str = String.fromCharCode.apply(null, uint16Array);
        } catch (e) {
            // This is a fallback implementation in case the first one does
            // not work. This is required to get the phantomjs passing...
            for (var i = 0; i < uint16Array.length; i++) {
                str += String.fromCharCode(uint16Array[i]);
            }
        }

        return str;
    }

    // Serialize a value, afterwards executing a callback (which usually
    // instructs the `setItem()` callback/promise to be executed). This is how
    // we store binary data with localStorage.
    function _serialize(value, callback) {
        var valueString = '';
        if (value) {
            valueString = value.toString();
        }

        // Cannot use `value instanceof ArrayBuffer` or such here, as these
        // checks fail when running the tests using casper.js...
        //
        // TODO: See why those tests fail and use a better solution.
        if (value && (value.toString() === '[object ArrayBuffer]' ||
                      value.buffer &&
                      value.buffer.toString() === '[object ArrayBuffer]')) {
            // Convert binary arrays to a string and prefix the string with
            // a special marker.
            var buffer;
            var marker = SERIALIZED_MARKER;

            if (value instanceof ArrayBuffer) {
                buffer = value;
                marker += TYPE_ARRAYBUFFER;
            } else {
                buffer = value.buffer;

                if (valueString === '[object Int8Array]') {
                    marker += TYPE_INT8ARRAY;
                } else if (valueString === '[object Uint8Array]') {
                    marker += TYPE_UINT8ARRAY;
                } else if (valueString === '[object Uint8ClampedArray]') {
                    marker += TYPE_UINT8CLAMPEDARRAY;
                } else if (valueString === '[object Int16Array]') {
                    marker += TYPE_INT16ARRAY;
                } else if (valueString === '[object Uint16Array]') {
                    marker += TYPE_UINT16ARRAY;
                } else if (valueString === '[object Int32Array]') {
                    marker += TYPE_INT32ARRAY;
                } else if (valueString === '[object Uint32Array]') {
                    marker += TYPE_UINT32ARRAY;
                } else if (valueString === '[object Float32Array]') {
                    marker += TYPE_FLOAT32ARRAY;
                } else if (valueString === '[object Float64Array]') {
                    marker += TYPE_FLOAT64ARRAY;
                } else {
                    callback(new Error('Failed to get type for BinaryArray'));
                }
            }

            callback(marker + _bufferToString(buffer));
        } else if (valueString === '[object Blob]') {
            // Conver the blob to a binaryArray and then to a string.
            var fileReader = new FileReader();

            fileReader.onload = function() {
                var str = _bufferToString(this.result);

                callback(SERIALIZED_MARKER + TYPE_BLOB + str);
            };

            fileReader.readAsArrayBuffer(value);
        } else {
            try {
                callback(JSON.stringify(value));
            } catch (e) {
                window.console.error("Couldn't convert value into a JSON " +
                                     'string: ', value);

                callback(e);
            }
        }
    }

    // Set a key's value and run an optional callback once the value is set.
    // Unlike Gaia's implementation, the callback function is passed the value,
    // in case you want to operate on that value only after you're sure it
    // saved, or something like that.
    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                // Convert undefined values to null.
                // https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                var originalValue = value;

                _serialize(value, function(value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        try {
                            var dbInfo = self._dbInfo;
                            localStorage.setItem(dbInfo.keyPrefix + key, value);
                        } catch (e) {
                            // localStorage capacity exceeded.
                            // TODO: Make this a specific error/event.
                            if (e.name === 'QuotaExceededError' ||
                                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                                reject(e);
                            }
                        }

                        resolve(originalValue);
                    }
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    var localStorageWrapper = {
        _driver: 'localStorageWrapper',
        _initStorage: _initStorage,
        // Default API, from Gaia/localStorage.
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('localStorageWrapper', function() {
            return localStorageWrapper;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = localStorageWrapper;
    } else {
        this.localStorageWrapper = localStorageWrapper;
    }
}).call(window);

},{"promise":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/websql.js":[function(require,module,exports){
/*
 * Includes code from:
 *
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
(function() {
    'use strict';

    // Sadly, the best way to save binary data in WebSQL is Base64 serializing
    // it, so this is how we store it to prevent very strange errors with less
    // verbose ways of binary <-> string data storage.
    var BASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    var openDatabase = this.openDatabase;

    var SERIALIZED_MARKER = '__lfsc__:';
    var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;

    // OMG the serializations!
    var TYPE_ARRAYBUFFER = 'arbf';
    var TYPE_BLOB = 'blob';
    var TYPE_INT8ARRAY = 'si08';
    var TYPE_UINT8ARRAY = 'ui08';
    var TYPE_UINT8CLAMPEDARRAY = 'uic8';
    var TYPE_INT16ARRAY = 'si16';
    var TYPE_INT32ARRAY = 'si32';
    var TYPE_UINT16ARRAY = 'ur16';
    var TYPE_UINT32ARRAY = 'ui32';
    var TYPE_FLOAT32ARRAY = 'fl32';
    var TYPE_FLOAT64ARRAY = 'fl64';
    var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH +
                                        TYPE_ARRAYBUFFER.length;

    // If WebSQL methods aren't available, we can stop now.
    if (!openDatabase) {
        return;
    }

    // Open the WebSQL database (automatically creates one if one didn't
    // previously exist), using any options set in the config.
    function _initStorage(options) {
        var self = this;
        var dbInfo = {
            db: null
        };

        if (options) {
            for (var i in options) {
                dbInfo[i] = typeof(options[i]) !== 'string' ?
                            options[i].toString() : options[i];
            }
        }

        return new Promise(function(resolve, reject) {
            // Open the database; the openDatabase API will automatically
            // create it for us if it doesn't exist.
            try {
                dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version),
                                         dbInfo.description, dbInfo.size);
            } catch (e) {
                return self.setDriver('localStorageWrapper')
                    .then(function() {
                        return self._initStorage(options);
                    })
                    .then(resolve)
                    .catch(reject);
            }

            // Create our key/value table if it doesn't exist.
            dbInfo.db.transaction(function(t) {
                t.executeSql('CREATE TABLE IF NOT EXISTS ' + dbInfo.storeName +
                             ' (id INTEGER PRIMARY KEY, key unique, value)', [],
                             function() {
                    self._dbInfo = dbInfo;
                    resolve();
                }, function(t, error) {
                    reject(error);
                });
            });
        });
    }

    function getItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT * FROM ' + dbInfo.storeName +
                                 ' WHERE key = ? LIMIT 1', [key],
                                 function(t, results) {
                        var result = results.rows.length ?
                                     results.rows.item(0).value : null;

                        // Check to see if this is serialized content we need to
                        // unpack.
                        if (result) {
                            result = _deserialize(result);
                        }

                        resolve(result);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function iterate(iterator, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;

                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT * FROM ' + dbInfo.storeName, [],
                        function(t, results) {
                            var rows = results.rows;
                            var length = rows.length;

                            for (var i = 0; i < length; i++) {
                                var item = rows.item(i);
                                var result = item.value;

                                // Check to see if this is serialized content
                                // we need to unpack.
                                if (result) {
                                    result = _deserialize(result);
                                }

                                result = iterator(result, item.key);

                                // void(0) prevents problems with redefinition
                                // of `undefined`.
                                if (result !== void(0)) {
                                    resolve(result);
                                    return;
                                }
                            }

                            resolve();
                        }, function(t, error) {
                            reject(error);
                        });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function setItem(key, value, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                // The localStorage API doesn't return undefined values in an
                // "expected" way, so undefined is always cast to null in all
                // drivers. See: https://github.com/mozilla/localForage/pull/42
                if (value === undefined) {
                    value = null;
                }

                // Save the original value to pass to the callback.
                var originalValue = value;

                _serialize(value, function(value, error) {
                    if (error) {
                        reject(error);
                    } else {
                        var dbInfo = self._dbInfo;
                        dbInfo.db.transaction(function(t) {
                            t.executeSql('INSERT OR REPLACE INTO ' +
                                         dbInfo.storeName +
                                         ' (key, value) VALUES (?, ?)',
                                         [key, value], function() {
                                resolve(originalValue);
                            }, function(t, error) {
                                reject(error);
                            });
                        }, function(sqlError) { // The transaction failed; check
                                                // to see if it's a quota error.
                            if (sqlError.code === sqlError.QUOTA_ERR) {
                                // We reject the callback outright for now, but
                                // it's worth trying to re-run the transaction.
                                // Even if the user accepts the prompt to use
                                // more storage on Safari, this error will
                                // be called.
                                //
                                // TODO: Try to re-run the transaction.
                                reject(sqlError);
                            }
                        });
                    }
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function removeItem(key, callback) {
        var self = this;

        // Cast the key to a string, as that's all we can set as a key.
        if (typeof key !== 'string') {
            window.console.warn(key +
                                ' used as a key, but it is not a string.');
            key = String(key);
        }

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('DELETE FROM ' + dbInfo.storeName +
                                 ' WHERE key = ?', [key], function() {

                        resolve();
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Deletes every item in the table.
    // TODO: Find out if this resets the AUTO_INCREMENT number.
    function clear(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('DELETE FROM ' + dbInfo.storeName, [],
                                 function() {
                        resolve();
                    }, function(t, error) {
                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Does a simple `COUNT(key)` to get the number of items stored in
    // localForage.
    function length(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    // Ahhh, SQL makes this one soooooo easy.
                    t.executeSql('SELECT COUNT(key) as c FROM ' +
                                 dbInfo.storeName, [], function(t, results) {
                        var result = results.rows.item(0).c;

                        resolve(result);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Return the key located at key index X; essentially gets the key from a
    // `WHERE id = ?`. This is the most efficient way I can think to implement
    // this rarely-used (in my experience) part of the API, but it can seem
    // inconsistent, because we do `INSERT OR REPLACE INTO` on `setItem()`, so
    // the ID of each key will change every time it's updated. Perhaps a stored
    // procedure for the `setItem()` SQL would solve this problem?
    // TODO: Don't change ID on `setItem()`.
    function key(n, callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT key FROM ' + dbInfo.storeName +
                                 ' WHERE id = ? LIMIT 1', [n + 1],
                                 function(t, results) {
                        var result = results.rows.length ?
                                     results.rows.item(0).key : null;
                        resolve(result);
                    }, function(t, error) {
                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    function keys(callback) {
        var self = this;

        var promise = new Promise(function(resolve, reject) {
            self.ready().then(function() {
                var dbInfo = self._dbInfo;
                dbInfo.db.transaction(function(t) {
                    t.executeSql('SELECT key FROM ' + dbInfo.storeName, [],
                                 function(t, results) {
                        var keys = [];

                        for (var i = 0; i < results.rows.length; i++) {
                            keys.push(results.rows.item(i).key);
                        }

                        resolve(keys);
                    }, function(t, error) {

                        reject(error);
                    });
                });
            }).catch(reject);
        });

        executeCallback(promise, callback);
        return promise;
    }

    // Converts a buffer to a string to store, serialized, in the backend
    // storage library.
    function _bufferToString(buffer) {
        // base64-arraybuffer
        var bytes = new Uint8Array(buffer);
        var i;
        var base64String = '';

        for (i = 0; i < bytes.length; i += 3) {
            /*jslint bitwise: true */
            base64String += BASE_CHARS[bytes[i] >> 2];
            base64String += BASE_CHARS[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
            base64String += BASE_CHARS[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
            base64String += BASE_CHARS[bytes[i + 2] & 63];
        }

        if ((bytes.length % 3) === 2) {
            base64String = base64String.substring(0, base64String.length - 1) + '=';
        } else if (bytes.length % 3 === 1) {
            base64String = base64String.substring(0, base64String.length - 2) + '==';
        }

        return base64String;
    }

    // Deserialize data we've inserted into a value column/field. We place
    // special markers into our strings to mark them as encoded; this isn't
    // as nice as a meta field, but it's the only sane thing we can do whilst
    // keeping localStorage support intact.
    //
    // Oftentimes this will just deserialize JSON content, but if we have a
    // special marker (SERIALIZED_MARKER, defined above), we will extract
    // some kind of arraybuffer/binary data/typed array out of the string.
    function _deserialize(value) {
        // If we haven't marked this string as being specially serialized (i.e.
        // something other than serialized JSON), we can just return it and be
        // done with it.
        if (value.substring(0,
                            SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
            return JSON.parse(value);
        }

        // The following code deals with deserializing some kind of Blob or
        // TypedArray. First we separate out the type of data we're dealing
        // with from the data itself.
        var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
        var type = value.substring(SERIALIZED_MARKER_LENGTH,
                                   TYPE_SERIALIZED_MARKER_LENGTH);

        // Fill the string into a ArrayBuffer.
        var bufferLength = serializedString.length * 0.75;
        var len = serializedString.length;
        var i;
        var p = 0;
        var encoded1, encoded2, encoded3, encoded4;

        if (serializedString[serializedString.length - 1] === '=') {
            bufferLength--;
            if (serializedString[serializedString.length - 2] === '=') {
                bufferLength--;
            }
        }

        var buffer = new ArrayBuffer(bufferLength);
        var bytes = new Uint8Array(buffer);

        for (i = 0; i < len; i+=4) {
            encoded1 = BASE_CHARS.indexOf(serializedString[i]);
            encoded2 = BASE_CHARS.indexOf(serializedString[i+1]);
            encoded3 = BASE_CHARS.indexOf(serializedString[i+2]);
            encoded4 = BASE_CHARS.indexOf(serializedString[i+3]);

            /*jslint bitwise: true */
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }

        // Return the right type based on the code/type set during
        // serialization.
        switch (type) {
            case TYPE_ARRAYBUFFER:
                return buffer;
            case TYPE_BLOB:
                return new Blob([buffer]);
            case TYPE_INT8ARRAY:
                return new Int8Array(buffer);
            case TYPE_UINT8ARRAY:
                return new Uint8Array(buffer);
            case TYPE_UINT8CLAMPEDARRAY:
                return new Uint8ClampedArray(buffer);
            case TYPE_INT16ARRAY:
                return new Int16Array(buffer);
            case TYPE_UINT16ARRAY:
                return new Uint16Array(buffer);
            case TYPE_INT32ARRAY:
                return new Int32Array(buffer);
            case TYPE_UINT32ARRAY:
                return new Uint32Array(buffer);
            case TYPE_FLOAT32ARRAY:
                return new Float32Array(buffer);
            case TYPE_FLOAT64ARRAY:
                return new Float64Array(buffer);
            default:
                throw new Error('Unkown type: ' + type);
        }
    }

    // Serialize a value, afterwards executing a callback (which usually
    // instructs the `setItem()` callback/promise to be executed). This is how
    // we store binary data with localStorage.
    function _serialize(value, callback) {
        var valueString = '';
        if (value) {
            valueString = value.toString();
        }

        // Cannot use `value instanceof ArrayBuffer` or such here, as these
        // checks fail when running the tests using casper.js...
        //
        // TODO: See why those tests fail and use a better solution.
        if (value && (value.toString() === '[object ArrayBuffer]' ||
                      value.buffer &&
                      value.buffer.toString() === '[object ArrayBuffer]')) {
            // Convert binary arrays to a string and prefix the string with
            // a special marker.
            var buffer;
            var marker = SERIALIZED_MARKER;

            if (value instanceof ArrayBuffer) {
                buffer = value;
                marker += TYPE_ARRAYBUFFER;
            } else {
                buffer = value.buffer;

                if (valueString === '[object Int8Array]') {
                    marker += TYPE_INT8ARRAY;
                } else if (valueString === '[object Uint8Array]') {
                    marker += TYPE_UINT8ARRAY;
                } else if (valueString === '[object Uint8ClampedArray]') {
                    marker += TYPE_UINT8CLAMPEDARRAY;
                } else if (valueString === '[object Int16Array]') {
                    marker += TYPE_INT16ARRAY;
                } else if (valueString === '[object Uint16Array]') {
                    marker += TYPE_UINT16ARRAY;
                } else if (valueString === '[object Int32Array]') {
                    marker += TYPE_INT32ARRAY;
                } else if (valueString === '[object Uint32Array]') {
                    marker += TYPE_UINT32ARRAY;
                } else if (valueString === '[object Float32Array]') {
                    marker += TYPE_FLOAT32ARRAY;
                } else if (valueString === '[object Float64Array]') {
                    marker += TYPE_FLOAT64ARRAY;
                } else {
                    callback(new Error('Failed to get type for BinaryArray'));
                }
            }

            callback(marker + _bufferToString(buffer));
        } else if (valueString === '[object Blob]') {
            // Conver the blob to a binaryArray and then to a string.
            var fileReader = new FileReader();

            fileReader.onload = function() {
                var str = _bufferToString(this.result);

                callback(SERIALIZED_MARKER + TYPE_BLOB + str);
            };

            fileReader.readAsArrayBuffer(value);
        } else {
            try {
                callback(JSON.stringify(value));
            } catch (e) {
                window.console.error("Couldn't convert value into a JSON " +
                                     'string: ', value);

                callback(null, e);
            }
        }
    }

    function executeCallback(promise, callback) {
        if (callback) {
            promise.then(function(result) {
                callback(null, result);
            }, function(error) {
                callback(error);
            });
        }
    }

    var webSQLStorage = {
        _driver: 'webSQLStorage',
        _initStorage: _initStorage,
        iterate: iterate,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        clear: clear,
        length: length,
        key: key,
        keys: keys
    };

    if (typeof define === 'function' && define.amd) {
        define('webSQLStorage', function() {
            return webSQLStorage;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = webSQLStorage;
    } else {
        this.webSQLStorage = webSQLStorage;
    }
}).call(window);

},{"promise":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/localforage.js":[function(require,module,exports){
(function() {
    'use strict';

    // Promises!
    var Promise = (typeof module !== 'undefined' && module.exports) ?
                  require('promise') : this.Promise;

    // Custom drivers are stored here when `defineDriver()` is called.
    // They are shared across all instances of localForage.
    var CustomDrivers = {};

    var DriverType = {
        INDEXEDDB: 'asyncStorage',
        LOCALSTORAGE: 'localStorageWrapper',
        WEBSQL: 'webSQLStorage'
    };

    var DefaultDriverOrder = [
        DriverType.INDEXEDDB,
        DriverType.WEBSQL,
        DriverType.LOCALSTORAGE
    ];

    var LibraryMethods = [
        'clear',
        'getItem',
        'iterate',
        'key',
        'keys',
        'length',
        'removeItem',
        'setItem'
    ];

    var ModuleType = {
        DEFINE: 1,
        EXPORT: 2,
        WINDOW: 3
    };

    var DefaultConfig = {
        description: '',
        driver: DefaultDriverOrder.slice(),
        name: 'localforage',
        // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
        // we can use without a prompt.
        size: 4980736,
        storeName: 'keyvaluepairs',
        version: 1.0
    };

    // Attaching to window (i.e. no module loader) is the assumed,
    // simple default.
    var moduleType = ModuleType.WINDOW;

    // Find out what kind of module setup we have; if none, we'll just attach
    // localForage to the main window.
    if (typeof define === 'function' && define.amd) {
        moduleType = ModuleType.DEFINE;
    } else if (typeof module !== 'undefined' && module.exports) {
        moduleType = ModuleType.EXPORT;
    }

    // Check to see if IndexedDB is available and if it is the latest
    // implementation; it's our preferred backend library. We use "_spec_test"
    // as the name of the database because it's not the one we'll operate on,
    // but it's useful to make sure its using the right spec.
    // See: https://github.com/mozilla/localForage/issues/128
    var driverSupport = (function(self) {
        // Initialize IndexedDB; fall back to vendor-prefixed versions
        // if needed.
        var indexedDB = indexedDB || self.indexedDB || self.webkitIndexedDB ||
                        self.mozIndexedDB || self.OIndexedDB ||
                        self.msIndexedDB;

        var result = {};

        result[DriverType.WEBSQL] = !!self.openDatabase;
        result[DriverType.INDEXEDDB] = !!(function() {
            // We mimic PouchDB here; just UA test for Safari (which, as of
            // iOS 8/Yosemite, doesn't properly support IndexedDB).
            // IndexedDB support is broken and different from Blink's.
            // This is faster than the test case (and it's sync), so we just
            // do this. *SIGH*
            // http://bl.ocks.org/nolanlawson/raw/c83e9039edf2278047e9/
            //
            // We test for openDatabase because IE Mobile identifies itself
            // as Safari. Oh the lulz...
            if (typeof self.openDatabase !== 'undefined' && self.navigator &&
                self.navigator.userAgent &&
                /Safari/.test(self.navigator.userAgent) &&
                !/Chrome/.test(self.navigator.userAgent)) {
                return false;
            }
            try {
                return indexedDB &&
                       typeof indexedDB.open === 'function' &&
                       // Some Samsung/HTC Android 4.0-4.3 devices
                       // have older IndexedDB specs; if this isn't available
                       // their IndexedDB is too old for us to use.
                       // (Replaces the onupgradeneeded test.)
                       typeof self.IDBKeyRange !== 'undefined';
            } catch (e) {
                return false;
            }
        })();

        result[DriverType.LOCALSTORAGE] = !!(function() {
            try {
                return (self.localStorage &&
                        ('setItem' in self.localStorage) &&
                        (self.localStorage.setItem));
            } catch (e) {
                return false;
            }
        })();

        return result;
    })(this);

    var isArray = Array.isArray || function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
    };

    function callWhenReady(localForageInstance, libraryMethod) {
        localForageInstance[libraryMethod] = function() {
            var _args = arguments;
            return localForageInstance.ready().then(function() {
                return localForageInstance[libraryMethod].apply(localForageInstance, _args);
            });
        };
    }

    function extend() {
        for (var i = 1; i < arguments.length; i++) {
            var arg = arguments[i];

            if (arg) {
                for (var key in arg) {
                    if (arg.hasOwnProperty(key)) {
                        if (isArray(arg[key])) {
                            arguments[0][key] = arg[key].slice();
                        } else {
                            arguments[0][key] = arg[key];
                        }
                    }
                }
            }
        }

        return arguments[0];
    }

    function isLibraryDriver(driverName) {
        for (var driver in DriverType) {
            if (DriverType.hasOwnProperty(driver) &&
                DriverType[driver] === driverName) {
                return true;
            }
        }

        return false;
    }

    var globalObject = this;

    function LocalForage(options) {
        this._config = extend({}, DefaultConfig, options);
        this._driverSet = null;
        this._ready = false;
        this._dbInfo = null;

        // Add a stub for each driver API method that delays the call to the
        // corresponding driver method until localForage is ready. These stubs
        // will be replaced by the driver methods as soon as the driver is
        // loaded, so there is no performance impact.
        for (var i = 0; i < LibraryMethods.length; i++) {
            callWhenReady(this, LibraryMethods[i]);
        }

        this.setDriver(this._config.driver);
    }

    LocalForage.prototype.INDEXEDDB = DriverType.INDEXEDDB;
    LocalForage.prototype.LOCALSTORAGE = DriverType.LOCALSTORAGE;
    LocalForage.prototype.WEBSQL = DriverType.WEBSQL;

    // Set any config values for localForage; can be called anytime before
    // the first API call (e.g. `getItem`, `setItem`).
    // We loop through options so we don't overwrite existing config
    // values.
    LocalForage.prototype.config = function(options) {
        // If the options argument is an object, we use it to set values.
        // Otherwise, we return either a specified config value or all
        // config values.
        if (typeof(options) === 'object') {
            // If localforage is ready and fully initialized, we can't set
            // any new configuration values. Instead, we return an error.
            if (this._ready) {
                return new Error("Can't call config() after localforage " +
                                 'has been used.');
            }

            for (var i in options) {
                if (i === 'storeName') {
                    options[i] = options[i].replace(/\W/g, '_');
                }

                this._config[i] = options[i];
            }

            // after all config options are set and
            // the driver option is used, try setting it
            if ('driver' in options && options.driver) {
                this.setDriver(this._config.driver);
            }

            return true;
        } else if (typeof(options) === 'string') {
            return this._config[options];
        } else {
            return this._config;
        }
    };

    // Used to define a custom driver, shared across all instances of
    // localForage.
    LocalForage.prototype.defineDriver = function(driverObject, callback,
                                                  errorCallback) {
        var defineDriver = new Promise(function(resolve, reject) {
            try {
                var driverName = driverObject._driver;
                var complianceError = new Error(
                    'Custom driver not compliant; see ' +
                    'https://mozilla.github.io/localForage/#definedriver'
                );
                var namingError = new Error(
                    'Custom driver name already in use: ' + driverObject._driver
                );

                // A driver name should be defined and not overlap with the
                // library-defined, default drivers.
                if (!driverObject._driver) {
                    reject(complianceError);
                    return;
                }
                if (isLibraryDriver(driverObject._driver)) {
                    reject(namingError);
                    return;
                }

                var customDriverMethods = LibraryMethods.concat('_initStorage');
                for (var i = 0; i < customDriverMethods.length; i++) {
                    var customDriverMethod = customDriverMethods[i];
                    if (!customDriverMethod ||
                        !driverObject[customDriverMethod] ||
                        typeof driverObject[customDriverMethod] !== 'function') {
                        reject(complianceError);
                        return;
                    }
                }

                var supportPromise = Promise.resolve(true);
                if ('_support'  in driverObject) {
                    if (driverObject._support && typeof driverObject._support === 'function') {
                        supportPromise = driverObject._support();
                    } else {
                        supportPromise = Promise.resolve(!!driverObject._support);
                    }
                }

                supportPromise.then(function(supportResult) {
                    driverSupport[driverName] = supportResult;
                    CustomDrivers[driverName] = driverObject;
                    resolve();
                }, reject);
            } catch (e) {
                reject(e);
            }
        });

        defineDriver.then(callback, errorCallback);
        return defineDriver;
    };

    LocalForage.prototype.driver = function() {
        return this._driver || null;
    };

    LocalForage.prototype.ready = function(callback) {
        var self = this;

        var ready = new Promise(function(resolve, reject) {
            self._driverSet.then(function() {
                if (self._ready === null) {
                    self._ready = self._initStorage(self._config);
                }

                self._ready.then(resolve, reject);
            }).catch(reject);
        });

        ready.then(callback, callback);
        return ready;
    };

    LocalForage.prototype.setDriver = function(drivers, callback,
                                               errorCallback) {
        var self = this;

        if (typeof drivers === 'string') {
            drivers = [drivers];
        }

        this._driverSet = new Promise(function(resolve, reject) {
            var driverName = self._getFirstSupportedDriver(drivers);
            var error = new Error('No available storage method found.');

            if (!driverName) {
                self._driverSet = Promise.reject(error);
                reject(error);
                return;
            }

            self._dbInfo = null;
            self._ready = null;

            if (isLibraryDriver(driverName)) {
                // We allow localForage to be declared as a module or as a
                // library available without AMD/require.js.
                if (moduleType === ModuleType.DEFINE) {
                    require([driverName], function(lib) {
                        self._extend(lib);

                        resolve();
                    });

                    return;
                } else if (moduleType === ModuleType.EXPORT) {
                    // Making it browserify friendly
                    var driver;
                    switch (driverName) {
                        case self.INDEXEDDB:
                            driver = require('./drivers/indexeddb');
                            break;
                        case self.LOCALSTORAGE:
                            driver = require('./drivers/localstorage');
                            break;
                        case self.WEBSQL:
                            driver = require('./drivers/websql');
                    }

                    self._extend(driver);
                } else {
                    self._extend(globalObject[driverName]);
                }
            } else if (CustomDrivers[driverName]) {
                self._extend(CustomDrivers[driverName]);
            } else {
                self._driverSet = Promise.reject(error);
                reject(error);
                return;
            }

            resolve();
        });

        function setDriverToConfig() {
            self._config.driver = self.driver();
        }
        this._driverSet.then(setDriverToConfig, setDriverToConfig);

        this._driverSet.then(callback, errorCallback);
        return this._driverSet;
    };

    LocalForage.prototype.supports = function(driverName) {
        return !!driverSupport[driverName];
    };

    LocalForage.prototype._extend = function(libraryMethodsAndProperties) {
        extend(this, libraryMethodsAndProperties);
    };

    // Used to determine which driver we should use as the backend for this
    // instance of localForage.
    LocalForage.prototype._getFirstSupportedDriver = function(drivers) {
        if (drivers && isArray(drivers)) {
            for (var i = 0; i < drivers.length; i++) {
                var driver = drivers[i];

                if (this.supports(driver)) {
                    return driver;
                }
            }
        }

        return null;
    };

    LocalForage.prototype.createInstance = function(options) {
        return new LocalForage(options);
    };

    // The actual localForage object that we expose as a module or via a
    // global. It's extended by pulling in one of our other libraries.
    var localForage = new LocalForage();

    // We allow localForage to be declared as a module or as a library
    // available without AMD/require.js.
    if (moduleType === ModuleType.DEFINE) {
        define('localforage', function() {
            return localForage;
        });
    } else if (moduleType === ModuleType.EXPORT) {
        module.exports = localForage;
    } else {
        this.localforage = localForage;
    }
}).call(window);

},{"./drivers/indexeddb":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/indexeddb.js","./drivers/localstorage":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/localstorage.js","./drivers/websql":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/src/drivers/websql.js","promise":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/localforage/node_modules/promise/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/index.js":[function(require,module,exports){
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

},{"fs":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/lib/_empty.js","google-fonts":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/google-fonts/index.js","insert-css":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/insert-css/index.js","minstache":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/minstache/index.js","soundcloud-resolve":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/google-fonts/index.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/insert-css/index.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/minstache/index.js":[function(require,module,exports){

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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/browser.js":[function(require,module,exports){
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

},{"querystring":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/gulpfile/node_modules/browserify/node_modules/querystring-es3/index.js","xhr":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/index.js":[function(require,module,exports){
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

},{"global/window":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js","once":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/global/window.js":[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window
} else if (typeof global !== "undefined") {
    module.exports = global
} else {
    module.exports = {}
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/soundcloud-badge/node_modules/soundcloud-resolve/node_modules/xhr/node_modules/once/once.js":[function(require,module,exports){
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

},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/three-glslify/index.js":[function(require,module,exports){
var createTypes = require('./types')


module.exports = function(THREE) {

    var types = createTypes(THREE) 

    return function create(glShader, opts) {
        opts = opts||{}

        if (typeof opts.colors === 'string')
            opts.colors = [opts.colors]
        
        var tUniforms = types( glShader.uniforms, opts.colors )
        var tAttribs = types( glShader.attributes, opts.colors )
            
        //clear the attribute arrays
        for (var k in tAttribs) {
            tAttribs[k].value = []
        }

        return {
            vertexShader: glShader.vertex,
            fragmentShader: glShader.fragment,
            uniforms: tUniforms,
            attributes: tAttribs
        }
    }
}
},{"./types":"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/three-glslify/types.js"}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/three-glslify/types.js":[function(require,module,exports){
var typeMap = {
    'int': 'i',
    'float': 'f',
    'ivec2': 'i2',
    'ivec3': 'i3',
    'ivec4': 'i4',
    'vec2': 'v2',
    'vec3': 'v3',
    'vec4': 'v4',
    'mat4': 'm4',
    'mat3': 'm3',
    'sampler2D': 't',
    'samplerCube': 't'
}

function create(THREE) {
    function newInstance(type, isArray) {
        switch (type) {
            case 'float': 
            case 'int':
                return 0
            case 'vec2':
            case 'ivec2':
                return new THREE.Vector2()
            case 'vec3':
            case 'ivec3':
                return new THREE.Vector3()
            case 'vec4':
            case 'ivec4':
                return new THREE.Vector4()
            case 'mat4':
                return new THREE.Matrix4()
            case 'mat3':
                return new THREE.Matrix3()
            case 'samplerCube':
            case 'sampler2D':
                return new THREE.Texture()
            default:
                return undefined
        }
    }

    function defaultValue(type, isArray, arrayLen) {
        if (isArray) {
            //ThreeJS flattens ivec3 type
            //(we don't support 'fv' type)
            if (type === 'ivec3')
                arrayLen *= 3
            var ar = new Array(arrayLen)
            for (var i=0; i<ar.length; i++)
                ar[i] = newInstance(type, isArray)
            return ar
        }  
        return newInstance(type)
    }

    function getType(type, isArray) {
        if (!isArray)
            return typeMap[type]

        if (type === 'int')
            return 'iv1'
        else if (type === 'float')
            return 'fv1'
        else
            return typeMap[type]+'v'
    }

    return function setupUniforms(glUniforms, colorNames) {
        if (!Array.isArray(colorNames))
            colorNames = Array.prototype.slice.call(arguments, 1)

        var result = {}
        var arrays = {}

        //map uniform types
        glUniforms.forEach(function(uniform) {
            var name = uniform.name
            var isArray = /(.+)\[[0-9]+\]/.exec(name)

            //special case: colors...
            if (colorNames && colorNames.indexOf(name) !== -1) {
                if (isArray)
                    throw new Error("array of color uniforms not supported")
                if (uniform.type !== 'vec3')
                    throw new Error("ThreeJS expects vec3 for Color uniforms") 
                result[name] = {
                    type: 'c',
                    value: new THREE.Color()
                }
                return
            }

            if (isArray) {
                name = isArray[1]
                if (name in arrays) 
                    arrays[name].count++ 
                else
                    arrays[name] = { count: 1, type: uniform.type }
            }
            result[name] = { 
                type: getType(uniform.type, isArray), 
                value: isArray ? null : defaultValue(uniform.type) 
            }
        })

        //now clean up any array values
        for (var k in result) {
            var u = result[k]
            if (k in arrays) { //is an array
                var a = arrays[k]
                u.value = defaultValue(a.type, true, a.count)
            }
        }
        return result
    }
}

module.exports = create
},{}],"/Users/gregtatum/Google Drive/greg-sites/polar/node_modules/underscore/underscore.js":[function(require,module,exports){
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

},{}]},{},["./js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ndWxwZmlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwianMiLCJqcy9Db21wb25lbnRzL0hpZC5qcyIsImpzL1BvZW0uanMiLCJqcy9TaGlwLmpzIiwianMvY29tcG9uZW50cy9DYW1lcmEuanMiLCJqcy9jb21wb25lbnRzL0NhbWVyYUludHJvLmpzIiwianMvY29tcG9uZW50cy9DeWxpbmRlckxpbmVzLmpzIiwianMvY29tcG9uZW50cy9EYW1hZ2UuanMiLCJqcy9jb21wb25lbnRzL1Njb3JpbmdBbmRXaW5uaW5nLmpzIiwianMvY29tcG9uZW50cy9TdGFycy5qcyIsImpzL2NvbXBvbmVudHMvVGl0bGVzLmpzIiwianMvY29tcG9uZW50cy9XZWIvZ2VvbWV0cnkuanMiLCJqcy9jb21wb25lbnRzL1dlYi9pbmRleC5qcyIsImpzL2NvbXBvbmVudHMvc2NvcmVzLmpzIiwianMvZW50aXRpZXMvQXJhY2huaWQuanMiLCJqcy9lbnRpdGllcy9Bc3Rlcm9pZC5qcyIsImpzL2VudGl0aWVzL0J1bGxldC5qcyIsImpzL2VudGl0aWVzL0plbGx5U2hpcC5qcyIsImpzL2VudGl0aWVzL1NwaWRlcmxpbmdzLmpzIiwianMvbGV2ZWxMb2FkZXIuanMiLCJqcy9sZXZlbHMvYXN0ZXJvaWRzSmVsbGllcy5qcyIsImpzL2xldmVscy9pbmRleC5qcyIsImpzL2xldmVscy9pbnRyby5qcyIsImpzL2xldmVscy90aXRsZXMuanMiLCJqcy9sZXZlbHMvd2ViLmpzIiwianMvbWFuYWdlcnMvQXN0ZXJvaWRGaWVsZC5qcyIsImpzL21hbmFnZXJzL0VudGl0eU1hbmFnZXIuanMiLCJqcy9tYW5hZ2Vycy9HdW4uanMiLCJqcy9yb3V0aW5nLmpzIiwianMvc291bmQvTXVzaWMuanMiLCJqcy9zb3VuZC9Tb3VuZEdlbmVyYXRvci5qcyIsImpzL3NvdW5kL211dGVyLmpzIiwianMvdWkvaW5kZXguanMiLCJqcy91aS9tZW51LmpzIiwianMvdWkvbWVudUxldmVscy5qcyIsImpzL3VpL211dGUuanMiLCJqcy91dGlscy9DbG9jay5qcyIsImpzL3V0aWxzL0NvbGxpZGVyLmpzIiwianMvdXRpbHMvQ29vcmRpbmF0ZXMuanMiLCJqcy91dGlscy9FdmVudERpc3BhdGNoZXIuanMiLCJqcy91dGlscy9TdGF0cy5qcyIsImpzL3V0aWxzL2Rlc3Ryb3lNZXNoLmpzIiwianMvdXRpbHMvcmFuZG9tLmpzIiwianMvdXRpbHMvc2VsZWN0b3JzLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3Nzcm9hZHMvZGlzdC9jcm9zc3JvYWRzLmpzIiwibm9kZV9tb2R1bGVzL2Nyb3Nzcm9hZHMvbm9kZV9tb2R1bGVzL3NpZ25hbHMvZGlzdC9zaWduYWxzLmpzIiwibm9kZV9tb2R1bGVzL2dsc2xpZnkvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9nbHNsaWZ5L3NpbXBsZS1hZGFwdGVyLmpzIiwibm9kZV9tb2R1bGVzL2d1bHBmaWxlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCJub2RlX21vZHVsZXMvZ3VscGZpbGUvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9ndWxwZmlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2RlY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9ndWxwZmlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9ndWxwZmlsZS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcXVlcnlzdHJpbmctZXMzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2hhc2hlci9kaXN0L2pzL2hhc2hlci5qcyIsIm5vZGVfbW9kdWxlcy9sb2NhbGZvcmFnZS9ub2RlX21vZHVsZXMvcHJvbWlzZS9jb3JlLmpzIiwibm9kZV9tb2R1bGVzL2xvY2FsZm9yYWdlL25vZGVfbW9kdWxlcy9wcm9taXNlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xvY2FsZm9yYWdlL25vZGVfbW9kdWxlcy9wcm9taXNlL25vZGVfbW9kdWxlcy9hc2FwL2FzYXAuanMiLCJub2RlX21vZHVsZXMvbG9jYWxmb3JhZ2Uvc3JjL2RyaXZlcnMvaW5kZXhlZGRiLmpzIiwibm9kZV9tb2R1bGVzL2xvY2FsZm9yYWdlL3NyYy9kcml2ZXJzL2xvY2Fsc3RvcmFnZS5qcyIsIm5vZGVfbW9kdWxlcy9sb2NhbGZvcmFnZS9zcmMvZHJpdmVycy93ZWJzcWwuanMiLCJub2RlX21vZHVsZXMvbG9jYWxmb3JhZ2Uvc3JjL2xvY2FsZm9yYWdlLmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvZ29vZ2xlLWZvbnRzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL2luc2VydC1jc3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc291bmRjbG91ZC1iYWRnZS9ub2RlX21vZHVsZXMvbWluc3RhY2hlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwibm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtYmFkZ2Uvbm9kZV9tb2R1bGVzL3NvdW5kY2xvdWQtcmVzb2x2ZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9vbmNlL29uY2UuanMiLCJub2RlX21vZHVsZXMvdGhyZWUtZ2xzbGlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90aHJlZS1nbHNsaWZ5L3R5cGVzLmpzIiwibm9kZV9tb2R1bGVzL3VuZGVyc2NvcmUvdW5kZXJzY29yZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5VUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4ckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIHJvdXRpbmcgPSByZXF1aXJlKCcuL3JvdXRpbmcnKTtcbnZhciB1aSA9IHJlcXVpcmUoJy4vdWknKTtcblxucm91dGluZy5zdGFydCggcmVxdWlyZSgnLi9Qb2VtJykgKTsiLCJ2YXIgRXZlbnREaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG5cbndpbmRvdy5ISUR0eXBlID0gXCJrZXlzXCI7XG5cbnZhciBISUQgPSBmdW5jdGlvbiggcG9lbSApIHtcblxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dmFyIHN0YXRlcyA9IHtcblx0XHR1cDogZmFsc2UsXG5cdFx0ZG93bjogZmFsc2UsXG5cdFx0bGVmdDogZmFsc2UsXG5cdFx0cmlnaHQ6IGZhbHNlLFxuXHRcdHNwYWNlYmFyOiBmYWxzZVxuXHR9O1xuXHRcblx0dGhpcy5rZXlDb2RlcyA9IHtcblx0XHRcImszOFwiIDogXCJ1cFwiLFxuXHRcdFwiazQwXCIgOiBcImRvd25cIixcblx0XHRcImszN1wiIDogXCJsZWZ0XCIsXG5cdFx0XCJrMzlcIiA6IFwicmlnaHRcIixcblx0XHRcImszMlwiIDogXCJzcGFjZWJhclwiXG5cdH07XG5cdFxuXHR0aGlzLnRpbHQgPSB7XG5cdFx0eDogMCxcblx0XHR5OiAwXG5cdH07XG5cdHRoaXMucHJlc3NlZCA9IF8uY2xvbmUoc3RhdGVzKTtcblx0dGhpcy5kb3duID0gXy5jbG9uZShzdGF0ZXMpO1xuXHR0aGlzLnVwID0gXy5jbG9uZShzdGF0ZXMpO1xuXHRcblx0aWYoIHdpbmRvdy5ISUR0eXBlID09PSBcImtleXNcIiApIHtcblx0XHR0aGlzLnNldEtleUhhbmRsZXJzKCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5zZXRUaWx0SGFuZGxlcnMoKTtcblx0fVxuXHRcbn07XG5cbkhJRC5wcm90b3R5cGUgPSB7XG5cdFxuXHRzZXRLZXlIYW5kbGVycyA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdCQod2luZG93KS5vbiggJ2tleWRvd24uSElEJywgdGhpcy5rZXlkb3duLmJpbmQodGhpcykgKTtcblx0XHQkKHdpbmRvdykub24oICdrZXl1cC5ISUQnLCB0aGlzLmtleXVwLmJpbmQodGhpcykgKTtcblx0XG5cdFx0dGhpcy5wb2VtLm9uKCBcImRlc3Ryb3lcIiwgZnVuY3Rpb24oKSB7XG5cdFx0XHQkKHdpbmRvdykub2ZmKCAna2V5ZG93bi5ISUQnICk7XG5cdFx0XHQkKHdpbmRvdykub2ZmKCAna2V5dXAuSElEJyApO1xuXHRcdH0pO1xuXHRcdFxuXHR9LFxuXHRcblx0c2V0VGlsdEhhbmRsZXJzIDogZnVuY3Rpb24oKSB7XG5cblxuXHRcdCQod2luZG93KS5vbiggJ2RldmljZW9yaWVudGF0aW9uLkhJRCcsIHRoaXMuaGFuZGxlVGlsdC5iaW5kKHRoaXMpICk7XG5cdFx0Ly8gd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RldmljZW9yaWVudGF0aW9uJywgdGhpcy5oYW5kbGVUaWx0LmJpbmQodGhpcyksIGZhbHNlKTtcblx0XHRcblx0XHQkKFwiY2FudmFzXCIpLm9uKCAndG91Y2hzdGFydC5ISUQnLCB0aGlzLmhhbmRsZVRvdWNoU3RhcnQuYmluZCh0aGlzKSApO1xuXHRcdCQoXCJjYW52YXNcIikub24oICd0b3VjaGVuZC5ISUQnLCB0aGlzLmhhbmRsZVRvdWNoRW5kLmJpbmQodGhpcykgKTtcblxuXHRcdHRoaXMucG9lbS5vbiggXCJkZXN0cm95XCIsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JCh3aW5kb3cpLm9mZiggJ2RldmljZW9yaWVudGF0aW9uLkhJRCcgKTtcblx0XHRcdCQoXCJjYW52YXNcIikub2ZmKCAndG91Y2hzdGFydC5ISUQnICk7XG5cdFx0XHQkKFwiY2FudmFzXCIpLm9mZiggJ3RvdWNoZW5kLkhJRCcgKTtcblx0XHR9KTtcblx0XHRcblx0fSxcblx0XG5cdHR5cGUgOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gd2luZG93LkhJRHR5cGU7XG5cdH0sXG5cdFxuXHRzZXRLZXlzIDogZnVuY3Rpb24oKSB7XG5cdFx0d2luZG93LkhJRHR5cGUgPSBcImtleXNcIjtcblx0fSxcblx0XG5cdHNldFRpbHQgOiBmdW5jdGlvbigpIHtcblx0XHR3aW5kb3cuSElEdHlwZSA9IFwidGlsdFwiO1x0XHRcblx0fSxcblx0XG5cdGtleWRvd24gOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgY29kZSA9IHRoaXMua2V5Q29kZXNbIFwia1wiICsgZS5rZXlDb2RlIF07XG5cdFx0XG5cdFx0aWYoY29kZSkge1xuXHRcdFx0dGhpcy5kb3duW2NvZGVdID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJlc3NlZFtjb2RlXSA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0a2V5dXAgOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgY29kZSA9IHRoaXMua2V5Q29kZXNbIFwia1wiICsgZS5rZXlDb2RlIF07XG5cdFx0XG5cdFx0aWYoY29kZSkge1xuXHRcdFx0dGhpcy5wcmVzc2VkW2NvZGVdID0gZmFsc2U7XG5cdFx0XHR0aGlzLnVwW2NvZGVdID0gdHJ1ZTtcblx0XHR9XG5cdH0sXG5cdFxuXHRoYW5kbGVUaWx0IDogZnVuY3Rpb24oZSkge1xuXHRcdFxuXHRcdHZhciBldmVudCwgb3JpZW50YXRpb24sIGFuZ2xlO1xuXHRcdFxuXHRcdGV2ZW50ID0gZS5vcmlnaW5hbEV2ZW50O1xuXHRcdG9yaWVudGF0aW9uID0gd2luZG93Lm9yaWVudGF0aW9uIHx8IHNjcmVlbi5vcmllbnRhdGlvbjtcblx0XHRcblx0XHRpZihfLmlzT2JqZWN0KCBzY3JlZW4ub3JpZW50YXRpb24gKSApIHtcblx0XHRcdGFuZ2xlID0gc2NyZWVuLm9yaWVudGF0aW9uLmFuZ2xlO1xuXHRcdH0gZWxzZSBpZiAoIF8uaXNOdW1iZXIoIHdpbmRvdy5vcmllbnRhdGlvbiApICkge1xuXHRcdFx0YW5nbGUgPSB3aW5kb3cub3JpZW50YXRpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFuZ2xlID0gMDtcblx0XHR9XG5cdFx0XG5cdFx0aWYoYW5nbGUgPT09IDApIHtcblx0XHRcdHRoaXMudGlsdCA9IHtcblx0XHRcdFx0eDogZXZlbnQuZ2FtbWEsXG5cdFx0XHRcdHk6IGV2ZW50LmJldGEgKiAtMVxuXHRcdFx0fTtcblx0XHR9IGVsc2UgaWYgKGFuZ2xlID4gMCkge1xuXHRcdFx0dGhpcy50aWx0ID0ge1xuXHRcdFx0XHR4OiBldmVudC5iZXRhLFxuXHRcdFx0XHR5OiBldmVudC5nYW1tYVxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50aWx0ID0ge1xuXHRcdFx0XHR4OiBldmVudC5iZXRhICogLTEsXG5cdFx0XHRcdHk6IGV2ZW50LmdhbW1hICogLTFcblx0XHRcdH07XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0aGFuZGxlVG91Y2hTdGFydCA6IGZ1bmN0aW9uKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0dGhpcy5wcmVzc2VkLnNwYWNlYmFyID0gdHJ1ZTtcblx0fSxcblx0XG5cdGhhbmRsZVRvdWNoRW5kIDogZnVuY3Rpb24oZSkge1xuXHRcdHZhciB0b3VjaGVzID0gZS5vcmlnaW5hbEV2ZW50LnRvdWNoZXM7XG5cdFx0dGhpcy5wcmVzc2VkLnNwYWNlYmFyID0gKHRvdWNoZXMubGVuZ3RoICE9PSAwKTtcblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBmYWxzaWZ5ID0gZnVuY3Rpb24gKHZhbHVlLCBrZXksIGxpc3QpIHtcblx0XHRcdGxpc3Rba2V5XSA9IGZhbHNlO1xuXHRcdH07XG5cdFx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0Xy5lYWNoKCB0aGlzLmRvd24sIGZhbHNpZnkgKTtcblx0XHRcdF8uZWFjaCggdGhpcy51cCwgZmFsc2lmeSApO1xuXHRcdH07XG5cdFx0XG5cdH0oKVxuXHRcbn07XG5cbkV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuYXBwbHkoIEhJRC5wcm90b3R5cGUgKTtcblxubW9kdWxlLmV4cG9ydHMgPSBISUQ7XG4iLCJ2YXIgQ29vcmRpbmF0ZXMgPSByZXF1aXJlKCcuL3V0aWxzL0Nvb3JkaW5hdGVzJyk7XG52YXIgQ2FtZXJhID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0NhbWVyYScpO1xudmFyIEd1biA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvR3VuJyk7XG52YXIgU2hpcCA9IHJlcXVpcmUoJy4vU2hpcCcpO1xudmFyIFN0YXJzID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL1N0YXJzJyk7XG52YXIgQXN0ZXJvaWRGaWVsZCA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvQXN0ZXJvaWRGaWVsZCcpO1xudmFyIFN0YXRzID0gcmVxdWlyZSgnLi91dGlscy9TdGF0cycpO1xudmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG52YXIgSmVsbHlTaGlwID0gcmVxdWlyZSgnLi9lbnRpdGllcy9KZWxseVNoaXAnKTtcbnZhciBFbnRpdHlNYW5hZ2VyID0gcmVxdWlyZSgnLi9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyJyk7XG52YXIgU2NvcmluZ0FuZFdpbm5pbmcgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvU2NvcmluZ0FuZFdpbm5pbmcnKTtcbnZhciBDbG9jayA9IHJlcXVpcmUoJy4vdXRpbHMvQ2xvY2snKTtcblxudmFyIHJlbmRlcmVyO1xuXG52YXIgUG9lbSA9IGZ1bmN0aW9uKCBsZXZlbCwgc2x1ZyApIHtcblxuXHR0aGlzLmNpcmN1bWZlcmVuY2UgPSBsZXZlbC5jb25maWcuY2lyY3VtZmVyZW5jZSB8fCA3NTA7XG5cdHRoaXMuaGVpZ2h0ID0gbGV2ZWwuY29uZmlnLmhlaWdodCB8fCAxMjA7XG5cdHRoaXMuciA9IGxldmVsLmNvbmZpZy5yIHx8IDI0MDtcblx0dGhpcy5jaXJjdW1mZXJlbmNlUmF0aW8gPSAoMiAqIE1hdGguUEkpIC8gdGhpcy5jaXJjdW1mZXJlbmNlOyAvL01hcCAyZCBYIGNvb3JkaW5hdGVzIHRvIHBvbGFyIGNvb3JkaW5hdGVzXG5cdHRoaXMucmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA+PSAxID8gd2luZG93LmRldmljZVBpeGVsUmF0aW8gOiAxO1xuXHR0aGlzLnNsdWcgPSBzbHVnO1x0XG5cdFxuXHR0aGlzLmNvbnRyb2xzID0gdW5kZWZpbmVkO1xuXHR0aGlzLmRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY29udGFpbmVyJyApO1xuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cdHRoaXMucmVxdWVzdGVkRnJhbWUgPSB1bmRlZmluZWQ7XG5cdHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xuXG5cdHRoaXMuY2xvY2sgPSBuZXcgQ2xvY2soKTtcblx0dGhpcy5jb29yZGluYXRlcyA9IG5ldyBDb29yZGluYXRlcyggdGhpcyApO1xuXHR0aGlzLmNhbWVyYSA9IG5ldyBDYW1lcmEoIHRoaXMsIGxldmVsLmNvbmZpZyApO1xuXHR0aGlzLnNjZW5lLmZvZyA9IG5ldyBUSFJFRS5Gb2coIDB4MjIyMjIyLCB0aGlzLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueiAvIDIsIHRoaXMuY2FtZXJhLm9iamVjdC5wb3NpdGlvbi56ICogMiApO1xuXHRcblx0dGhpcy5ndW4gPSBuZXcgR3VuKCB0aGlzICk7XG5cdHRoaXMuc2hpcCA9IG5ldyBTaGlwKCB0aGlzICk7XG5cdHRoaXMuc3RhcnMgPSBuZXcgU3RhcnMoIHRoaXMsIGxldmVsLmNvbmZpZy5zdGFycyApO1xuXHR0aGlzLnNjb3JpbmdBbmRXaW5uaW5nID0gbmV3IFNjb3JpbmdBbmRXaW5uaW5nKCB0aGlzLCBsZXZlbC5jb25maWcuc2NvcmluZ0FuZFdpbm5pbmcgKTtcblx0XG5cdHRoaXMucGFyc2VMZXZlbCggbGV2ZWwgKTtcblx0XG5cdHRoaXMuZGlzcGF0Y2goe1xuXHRcdHR5cGU6ICdsZXZlbFBhcnNlZCdcblx0fSk7XG5cdFxuXHRpZighcmVuZGVyZXIpIHtcblx0XHR0aGlzLmFkZFJlbmRlcmVyKCk7XG5cdH1cbi8vXHR0aGlzLmFkZFN0YXRzKCk7XG5cdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcblx0XG5cdHRoaXMuc3RhcnQoKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvZW07XG5cblBvZW0ucHJvdG90eXBlID0ge1xuXHRcblx0cGFyc2VMZXZlbCA6IGZ1bmN0aW9uKCBsZXZlbCApIHtcblx0XHRfLmVhY2goIGxldmVsLm9iamVjdHMsIGZ1bmN0aW9uIGxvYWRDb21wb25lbnQoIHZhbHVlLCBrZXkgKSB7XG5cdFx0XHRpZihfLmlzT2JqZWN0KCB2YWx1ZSApKSB7XG5cdFx0XHRcdHRoaXNbIGtleSBdID0gbmV3IHZhbHVlLm9iamVjdCggdGhpcywgdmFsdWUucHJvcGVydGllcyApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpc1sga2V5IF0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHR9LFxuXHRcblx0YWRkUmVuZGVyZXIgOiBmdW5jdGlvbigpIHtcblx0XHRyZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHtcblx0XHRcdGFscGhhIDogdHJ1ZVxuXHRcdH0pO1xuXHRcdHJlbmRlcmVyLnNldFNpemUoIHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQgKTtcblx0XHR0aGlzLmRpdi5hcHBlbmRDaGlsZCggcmVuZGVyZXIuZG9tRWxlbWVudCApO1xuXHR9LFxuXHRcblx0Z2V0Q2FudmFzIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYoIHJlbmRlcmVyICkge1xuXHRcdFx0cmV0dXJuIHJlbmRlcmVyLmRvbUVsZW1lbnQ7XG5cdFx0fVxuXHR9LFxuXHRcblx0YWRkU3RhdHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnN0YXRzID0gbmV3IFN0YXRzKCk7XG5cdFx0dGhpcy5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLnN0YXRzLmRvbUVsZW1lbnQuc3R5bGUudG9wID0gJzBweCc7XG5cdFx0JChcIiNjb250YWluZXJcIikuYXBwZW5kKCB0aGlzLnN0YXRzLmRvbUVsZW1lbnQgKTtcblx0fSxcblx0XHRcblx0YWRkRXZlbnRMaXN0ZW5lcnMgOiBmdW5jdGlvbigpIHtcblx0XHQkKHdpbmRvdykub24oJ3Jlc2l6ZScsIHRoaXMucmVzaXplSGFuZGxlci5iaW5kKHRoaXMpKTtcblx0fSxcblx0XG5cdHJlc2l6ZUhhbmRsZXIgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLmNhbWVyYS5yZXNpemUoKTtcblx0XHRyZW5kZXJlci5zZXRTaXplKCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XG5cblx0fSxcblx0XG5cdHN0YXJ0IDogZnVuY3Rpb24oKSB7XG5cdFx0aWYoICF0aGlzLnN0YXJ0ZWQgKSB7XG5cdFx0XHR0aGlzLmxvb3AoKTtcblx0XHR9XG5cdFx0dGhpcy5zdGFydGVkID0gdHJ1ZTtcblx0fSxcblx0XG5cdGxvb3AgOiBmdW5jdGlvbigpIHtcblxuXHRcdHRoaXMucmVxdWVzdGVkRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHRoaXMubG9vcC5iaW5kKHRoaXMpICk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblxuXHR9LFxuXHRcblx0cGF1c2UgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIHRoaXMucmVxdWVzdGVkRnJhbWUgKTtcblx0XHR0aGlzLnN0YXJ0ZWQgPSBmYWxzZTtcblx0XHRcblx0fSxcblx0XHRcdFxuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHQvLyB0aGlzLnN0YXRzLnVwZGF0ZSgpO1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2goe1xuXHRcdFx0dHlwZTogXCJ1cGRhdGVcIixcblx0XHRcdGR0OiB0aGlzLmNsb2NrLmdldERlbHRhKCksXG5cdFx0XHR0aW1lOiB0aGlzLmNsb2NrLnRpbWVcblx0XHR9KTtcblx0XHRcblx0XHRyZW5kZXJlci5yZW5kZXIoIHRoaXMuc2NlbmUsIHRoaXMuY2FtZXJhLm9iamVjdCApO1xuXG5cdH0sXG5cdFxuXHRkZXN0cm95IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKCB0aGlzLnJlcXVlc3RlZEZyYW1lICk7XG5cdFx0XG5cdFx0dGhpcy5kaXNwYXRjaCh7XG5cdFx0XHR0eXBlOiBcImRlc3Ryb3lcIlxuXHRcdH0pO1xuXHR9XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBQb2VtLnByb3RvdHlwZSApOyIsInZhciBISUQgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvSGlkJyk7XG52YXIgRGFtYWdlID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0RhbWFnZScpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi91dGlscy9kZXN0cm95TWVzaCcpO1xuXG52YXIgU2hpcCA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLmhpZCA9IG5ldyBISUQoIHRoaXMucG9lbSApO1xuXHR0aGlzLmNvbG9yID0gMHg0QTlERTc7XG5cdHRoaXMubGluZXdpZHRoID0gMiAqIHRoaXMucG9lbS5yYXRpbztcblx0dGhpcy5yYWRpdXMgPSAzO1xuXHRcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XHRcblx0XG5cdHRoaXMuZGVhZCA9IGZhbHNlO1xuXHR0aGlzLmtpbGxUaW1lb3V0ID0gbnVsbDtcblx0dGhpcy5saXZlcyA9IDM7XG5cdHRoaXMuaW52dWxuZXJhYmxlID0gdHJ1ZTtcblx0dGhpcy5pbnZ1bG5lcmFibGVMZW5ndGggPSAzMDAwO1xuXHR0aGlzLmludnVsbmVyYWJsZVRpbWUgPSAwICsgdGhpcy5pbnZ1bG5lcmFibGVMZW5ndGg7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3AgPSBmYWxzZTtcblx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcExlbmd0aCA9IDEwMDtcblx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcFRpbWUgPSAwO1xuXHRcblx0dGhpcy5zcGVlZCA9IDA7XG5cdFxuXHR0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQgPSAwLjA0O1xuXHR0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZCA9IDAuMDAxO1xuXHRcblx0dGhpcy50aHJ1c3RTcGVlZCA9IDAuMDAxO1xuXHR0aGlzLnRocnVzdCA9IDA7XG5cdFxuXHR0aGlzLmJhbmtTcGVlZCA9IDAuMDY7XG5cdHRoaXMuYmFua1NwZWVkID0gMC4wMDc1O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gNTAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuZGFtYWdlID0gbmV3IERhbWFnZSh0aGlzLnBvZW0sIHtcblx0XHRjb2xvcjogdGhpcy5jb2xvclxuXHR9KTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2hpcDtcblxuU2hpcC5wcm90b3R5cGUgPSB7XG5cdFxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgdmVydHMsIG1hbmhhdHRhbkxlbmd0aCwgY2VudGVyO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dmVydHMgPSBbWzUwLDM2LjldLCBbMzkuOCw1OS42XSwgWzQ3LjEsNTMuOV0sIFs1MCw1Ny41XSwgWzUzLDUzLjldLCBbNjAuMiw1OS42XSwgWzUwLDM2LjldXTtcblxuXHRcdG1hbmhhdHRhbkxlbmd0aCA9IF8ucmVkdWNlKCB2ZXJ0cywgZnVuY3Rpb24oIG1lbW8sIHZlcnQyZCApIHtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcdFxuXHRcdH0sIFswLDBdKTtcblx0XHRcblx0XHRjZW50ZXIgPSBbXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMF0gLyB2ZXJ0cy5sZW5ndGgsXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMV0gLyB2ZXJ0cy5sZW5ndGhcblx0XHRdO1xuXHRcdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiApIHtcblx0XHRcdHZhciBzY2FsZSA9IDEgLyA0O1xuXHRcdFx0cmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKFxuXHRcdFx0XHQodmVjMlsxXSAtIGNlbnRlclsxXSkgKiBzY2FsZSAqIC0xLFxuXHRcdFx0XHQodmVjMlswXSAtIGNlbnRlclswXSkgKiBzY2FsZSxcblx0XHRcdFx0MFxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuY3JlYXRlR2VvbWV0cnkoKTtcblx0XHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogKz0gdGhpcy5wb2VtLnI7XG5cblx0XHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0dGhpcy5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0XHR0aGlzLnBvZW0ub24oJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QgKSApO1xuXHRcdFxuXHR9LFxuXHRcblx0ZGlzYWJsZSA6IGZ1bmN0aW9uKCkge1xuXHRcdGNsZWFyVGltZW91dCggdGhpcy5raWxsVGltZW91dCApO1xuXHRcdHRoaXMuZGVhZCA9IHRydWU7XG5cdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IGZhbHNlO1xuXHR9LFxuXHRcblx0a2lsbCA6IGZ1bmN0aW9uKCBmb3JjZSApIHtcblxuXHRcdGlmKCAhZm9yY2UgJiYgIXRoaXMuZGVhZCAmJiAhdGhpcy5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHR0aGlzLmRlYWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmRhbWFnZS5leHBsb2RlKCB0aGlzLnBvc2l0aW9uICk7XG5cdFx0XHRcblx0XHRcdHZhciBsb3N0UG9pbnRzID0gTWF0aC5jZWlsKCB0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuc2NvcmUgLyAtMiApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0U2NvcmUoXG5cdFx0XHRcdGxvc3RQb2ludHMsXG5cdFx0XHRcdGxvc3RQb2ludHMgKyBcIiBwb2ludHNcIixcblx0XHRcdFx0e1xuXHRcdFx0XHRcdFwiZm9udC1zaXplXCIgOiBcIjJlbVwiLFxuXHRcdFx0XHRcdFwiY29sb3JcIjogXCJyZWRcIlxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFxuXHRcdFx0dGhpcy5raWxsVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0XHRcdHRoaXMuZGVhZCA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlVGltZSA9IHRoaXMucG9lbS5jbG9jay50aW1lICsgdGhpcy5pbnZ1bG5lcmFibGVMZW5ndGg7XG5cdFx0XHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0XG5cdFx0XHR9LmJpbmQodGhpcyksIDIwMDApO1xuXHRcdH1cblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi54ID0gMDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgPSAwO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFx0XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZVRocnVzdEFuZEJhbmsoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlRWRnZUF2b2lkYW5jZSggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVGaXJpbmcoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlSW52dWxuZXJhYmlsaXR5KCBlICk7XG5cdFx0XHRcblx0XHR9XG5cdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cdFx0dGhpcy5oaWQudXBkYXRlKCBlICk7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGVJbnZ1bG5lcmFiaWxpdHkgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBlLnRpbWUgPCB0aGlzLmludnVsbmVyYWJsZVRpbWUgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGUudGltZSA+IHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BUaW1lICkge1xuXG5cdFx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcFRpbWUgPSBlLnRpbWUgKyB0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wTGVuZ3RoO1xuXHRcdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3AgPSAhdGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcDtcdFxuXHRcdFx0XHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSB0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaW52dWxuZXJhYmxlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGVUaHJ1c3RBbmRCYW5rIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dmFyIHByZXNzZWQsIHRpbHQsIHRoZXRhLCB0aGV0YURpZmY7XG5cdFx0XG5cdFx0dGhpcy5iYW5rICo9IDAuOTtcblx0XHR0aGlzLnRocnVzdCA9IDA7XG5cdFx0XG5cdFx0aWYoIHRoaXMuaGlkLnR5cGUoKSA9PT0gXCJrZXlzXCIgKSB7XG5cdFx0XHRcblx0XHRcdHByZXNzZWQgPSB0aGlzLmhpZC5wcmVzc2VkO1xuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQudXAgKSB7XG5cdFx0XHRcdHRoaXMudGhydXN0ICs9IHRoaXMudGhydXN0U3BlZWQgKiBlLmR0O1xuXHRcdFx0fVxuXHRcdFxuXHRcdFx0aWYoIHByZXNzZWQuZG93biApIHtcblx0XHRcdFx0dGhpcy50aHJ1c3QgLT0gdGhpcy50aHJ1c3RTcGVlZCAqIGUuZHQ7XHRcblx0XHRcdH1cblx0XHRcblx0XHRcdGlmKCBwcmVzc2VkLmxlZnQgKSB7XG5cdFx0XHRcdHRoaXMuYmFuayArPSB0aGlzLmJhbmtTcGVlZDtcblx0XHRcdH1cblx0XHRcblx0XHRcdGlmKCBwcmVzc2VkLnJpZ2h0ICkge1xuXHRcdFx0XHR0aGlzLmJhbmsgKz0gdGhpcy5iYW5rU3BlZWQgKiAtMTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aWx0ID0gdGhpcy5oaWQudGlsdDtcblx0XHRcdFxuXHRcdFx0dmFyIGRpc3RhbmNlID0gTWF0aC5zcXJ0KHRpbHQueCAqIHRpbHQueCArIHRpbHQueSAqIHRpbHQueSk7XG5cdFx0XG5cdFx0XHR0aGlzLnRocnVzdCA9IE1hdGgubWluKCAwLjAwMTEsIGRpc3RhbmNlIC8gMTAwMDAgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy50aHJ1c3QgKj0gZS5kdDtcblx0XHRcdFxuXHRcdFx0dGhldGEgPSBNYXRoLmF0YW4yKCB0aWx0LnksIHRpbHQueCApO1xuXHRcdFx0dGhldGFEaWZmID0gKHRoZXRhIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueikgJSAoMiAqIE1hdGguUEkpO1xuXHRcdFx0XG5cdFx0XHRpZiggdGhldGFEaWZmID4gTWF0aC5QSSApIHtcblx0XHRcdFx0dGhldGFEaWZmIC09IDIgKiBNYXRoLlBJO1xuXHRcdFx0fSBlbHNlIGlmICggdGhldGFEaWZmIDwgLU1hdGguUEkgKSB7XG5cdFx0XHRcdHRoZXRhRGlmZiArPSAyICogTWF0aC5QSTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0dGhpcy5iYW5rID0gdGhldGFEaWZmICogZGlzdGFuY2UgLyAyNTAwICogZS5kdDtcblx0XHRcdFxuXHRcdFx0XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlRWRnZUF2b2lkYW5jZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHZhciBuZWFyRWRnZSwgZmFyRWRnZSwgcG9zaXRpb24sIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24sIGJhbmtEaXJlY3Rpb24sIGFic1Bvc2l0aW9uO1xuXHRcdFxuXHRcdGZhckVkZ2UgPSB0aGlzLnBvZW0uaGVpZ2h0IC8gMjtcblx0XHRuZWFyRWRnZSA9IDQgLyA1ICogZmFyRWRnZTtcblx0XHRwb3NpdGlvbiA9IHRoaXMub2JqZWN0LnBvc2l0aW9uLnk7XG5cdFx0YWJzUG9zaXRpb24gPSBNYXRoLmFicyggcG9zaXRpb24gKTtcblxuXHRcdHZhciByb3RhdGlvbiA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogLyBNYXRoLlBJO1xuXG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiAlPSAyICogTWF0aC5QSTtcblx0XHRcblx0XHRpZiggdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IDAgKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IDIgKiBNYXRoLlBJO1xuXHRcdH1cblx0XHRcblx0XHRpZiggTWF0aC5hYnMoIHBvc2l0aW9uICkgPiBuZWFyRWRnZSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGlzUG9pbnRpbmdMZWZ0ID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiA+PSBNYXRoLlBJICogMC41ICYmIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCBNYXRoLlBJICogMS41O1xuXHRcdFx0XG5cdFx0XHRpZiggcG9zaXRpb24gPiAwICkge1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRub3JtYWxpemVkRWRnZVBvc2l0aW9uID0gKGFic1Bvc2l0aW9uIC0gbmVhckVkZ2UpIC8gKGZhckVkZ2UgLSBuZWFyRWRnZSk7XG5cdFx0XHR0aGlzLnRocnVzdCArPSBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQ7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IGJhbmtEaXJlY3Rpb24gKiBub3JtYWxpemVkRWRnZVBvc2l0aW9uICogdGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkO1xuXHRcdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlRmlyaW5nIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0aWYoIHRoaXMuaGlkLnByZXNzZWQuc3BhY2ViYXIgKSB7XG5cdFx0XHR0aGlzLnBvZW0uZ3VuLmZpcmUoIHRoaXMucG9zaXRpb24ueCwgdGhpcy5wb3NpdGlvbi55LCAyLCB0aGlzLm9iamVjdC5yb3RhdGlvbi56ICk7XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgbW92ZW1lbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRcdHZhciB0aGV0YSwgeCwgeTtcblx0XHRcdFxuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLmJhbms7XG5cdFx0XHRcblx0XHRcdHRoZXRhID0gdGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XHRcdFxuXHRcdFx0dGhpcy5zcGVlZCAqPSAwLjk4O1xuXHRcdFx0dGhpcy5zcGVlZCArPSB0aGlzLnRocnVzdDtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1pbiggdGhpcy5tYXhTcGVlZCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWF4KCAwLCB0aGlzLnNwZWVkICk7XG5cdFx0XHRcdFx0XHRcblx0XHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnkgKz0gdGhpcy5zcGVlZCAqIE1hdGguc2luKCB0aGV0YSApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb3NpdGlvbi55O1xuXHRcdFx0XG5cdFx0XHQvL1BvbGFyIGNvb3JkaW5hdGVzXG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFx0XG5cdFx0fTtcblx0XHRcblx0fSgpLFxuXHRcblx0ZGVzdHJveSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LmRpc3Bvc2UoKTtcblx0XHR0aGlzLm9iamVjdC5tYXRlcmlhbC5kaXNwb3NlKCk7XG5cdH1cblx0XG59OyIsInZhciBDYW1lcmEgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLnBvbGFyT2JqID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdFxuXHR0aGlzLnNwZWVkID0gMC4wMzI7XG5cdFxuXHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShcblx0XHQ1MCxcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZvdlxuXHRcdHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LFx0Ly8gYXNwZWN0IHJhdGlvXG5cdFx0MyxcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG5lYXIgZnJ1c3R1bVxuXHRcdDEwMDBcdFx0XHRcdFx0XHRcdFx0XHQvLyBmYXIgZnJ1c3R1bVxuXHQpO1xuXHRcblx0dmFyIG11bHRpcGxpZXIgPSBwcm9wZXJ0aWVzLmNhbWVyYU11bHRpcGxpZXIgPyBwcm9wZXJ0aWVzLmNhbWVyYU11bHRpcGxpZXIgOiAxLjU7XG5cdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogPSB0aGlzLnBvZW0uciAqIG11bHRpcGxpZXI7XG5cdFxuXHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5wb2xhck9iaiApO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbWVyYTtcblxuQ2FtZXJhLnByb3RvdHlwZSA9IHtcblx0XG5cdHJlc2l6ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMub2JqZWN0LmFzcGVjdCA9IHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0O1xuXHRcdHRoaXMub2JqZWN0LnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHZhciB0aGlzVGhldGEgPSB0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnk7XG5cdFx0dmFyIHRoYXRUaGV0YSA9IHRoaXMucG9lbS5zaGlwLnBvbGFyT2JqLnJvdGF0aW9uLnk7XG5cdFx0dmFyIHRoZXRhRGlmZiA9IE1hdGguYWJzKHRoaXNUaGV0YSAtIHRoYXRUaGV0YSk7XG5cdFx0XG5cdFx0Ly8gaWYoIHRoZXRhRGlmZiA+IDAuMiApIHtcblx0XHRcblx0XHRcdHRoaXMucG9sYXJPYmoucm90YXRpb24ueSA9XG5cdFx0XHRcdHRoYXRUaGV0YSAqICh0aGlzLnNwZWVkKSArXG5cdFx0XHRcdHRoaXNUaGV0YSAqICgxIC0gdGhpcy5zcGVlZCk7XG5cdFx0XHRcdFxuXHRcdC8vIH1cblx0fVxufTsiLCJ2YXIgQ2FtZXJhSW50cm8gPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLnBvZW0uY2FtZXJhLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb2VtLmhlaWdodCAqIDU7XG5cdHRoaXMub3JpZ2luID0gcHJvcGVydGllcy5vcmlnaW4gPyBwcm9wZXJ0aWVzLm9yaWdpbiA6IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdHRoaXMuc3BlZWQgPSBwcm9wZXJ0aWVzLnNwZWVkID8gcHJvcGVydGllcy5zcGVlZCA6IDAuOTg7XG5cdFxuXHR0aGlzLmJvdW5kVXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy5ib3VuZFVwZGF0ZSApO1xuXHRcbn07XG5cblxuQ2FtZXJhSW50cm8ucHJvdG90eXBlID0ge1xuXHRcblx0dXBkYXRlOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR0aGlzLnBvZW0uY2FtZXJhLm9iamVjdC5wb3NpdGlvbi55ICo9IHRoaXMuc3BlZWQ7XG5cdFx0dGhpcy5wb2VtLmNhbWVyYS5vYmplY3QubG9va0F0KCB0aGlzLm9yaWdpbiApO1xuXHRcdFxuXHRcdGlmKCB0aGlzLnBvZW0uY2FtZXJhLm9iamVjdC5wb3NpdGlvbi55IDwgMC4xICkge1xuXHRcdFx0dGhpcy5wb2VtLm9mZigndXBkYXRlJywgdGhpcy5ib3VuZFVwZGF0ZSApO1xuXHRcdH1cblx0XHRcblx0fVxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FtZXJhSW50cm87IiwidmFyIHR3b8+AID0gTWF0aC5QSSAqIDI7XG52YXIgY29zID0gTWF0aC5jb3M7XG52YXIgc2luID0gTWF0aC5zaW47XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tLmpzJyk7XG52YXIgZGVzdHJveU1lc2ggPSByZXF1aXJlKCcuLi91dGlscy9kZXN0cm95TWVzaCcpO1xuXG5mdW5jdGlvbiBfZ2VuZXJhdGVDeWxpbmRlclZlcnRpY2VzKCB2ZXJ0aWNlcywgc2lkZXMsIHJhZGl1cywgaGVpZ2h0LCBlY2NlbnRyaWNpdHkgKSB7XG5cblx0dmFyIHgxLHoxLHgyLHoyLGgxLGgyLHhQcmltZSx6UHJpbWUsaFByaW1lO1xuXHR2YXIgZWNjMSA9IDEgLSBlY2NlbnRyaWNpdHk7XG5cdHZhciBlY2MyID0gMSArIGVjY2VudHJpY2l0eTtcblx0dmFyIHJhZGlhbnNQZXJTaWRlID0gdHdvz4AgLyBzaWRlcztcblx0dmFyIHdhdmVzID0gMztcblx0dmFyIHdhdmVIZWlnaHQgPSAwO1xuXG5cdGZvciggdmFyIGk9MDsgaSA8PSBzaWRlczsgaSsrICkge1xuXG5cdFx0Ly8gd2F2ZUhlaWdodCA9IGhlaWdodCAqIE1hdGguc2luKCByYWRpYW5zUGVyU2lkZSAqIGkgKiB3YXZlcyApICogMC40O1xuXG5cdFx0eDEgPSBjb3MoIHJhZGlhbnNQZXJTaWRlICogaSApICogcmFkaXVzICogcmFuZG9tLnJhbmdlKCBlY2MxLCBlY2MyICk7XG5cdFx0ejEgPSBzaW4oIHJhZGlhbnNQZXJTaWRlICogaSApICogcmFkaXVzICogcmFuZG9tLnJhbmdlKCBlY2MxLCBlY2MyICk7XG5cdFx0aDEgPSBoZWlnaHRcdFx0XHRcdFx0XHRcdFx0KiByYW5kb20ucmFuZ2UoIGVjYzEsIGVjYzIgKSArIHdhdmVIZWlnaHQ7XG5cdFx0XG5cdFx0aWYoIGkgPiAwICkge1xuXHRcdFx0XG5cdFx0XHRpZiggaSA9PT0gc2lkZXMgKSB7XG5cdFx0XHRcdHgxID0geFByaW1lO1xuXHRcdFx0XHR6MSA9IHpQcmltZTtcblx0XHRcdFx0aDEgPSBoUHJpbWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vVmVydGljYWwgbGluZVxuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqICAwLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MSwgaDEgKiAtMC41LCB6MSApICk7XG5cblx0XHRcdC8vVG9wIGhvcml6IGxpbmVcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MSwgaDEgKiAwLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MiwgaDIgKiAwLjUsIHoyICkgKTtcblxuXHRcdFx0Ly9Cb3R0b20gaG9yaXogbGluZVxuXHRcdFx0dmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIHgxLCBoMSAqIC0wLjUsIHoxICkgKTtcblx0XHRcdHZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCB4MiwgaDIgKiAtMC41LCB6MiApICk7XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR4UHJpbWUgPSB4MTtcblx0XHRcdHpQcmltZSA9IHoxO1xuXHRcdFx0aFByaW1lID0gaDE7XG5cdFx0XHRcblx0XHR9XG5cblx0XHR4MiA9IHgxO1xuXHRcdHoyID0gejE7XG5cdFx0aDIgPSBoMTtcblxuXHR9XG5cdFxuXHRyZXR1cm4gdmVydGljZXM7XG5cbn1cblxuZnVuY3Rpb24gX2dlbmVyYXRlTXVsdGlwbGVDeWxpbmRlclZlcnRpY2VzKCBpdGVyYXRpb25zLCB2ZXJ0aWNlcywgc2lkZXMsIHJhZGl1cywgaGVpZ2h0LCBlY2NlbnRyaWNpdHkgKSB7XG5cdFxuXHR2YXIgcmF0aW8xLCByYXRpbzI7XG5cdFxuXHRmb3IoIHZhciBpPTA7IGkgPCBpdGVyYXRpb25zOyBpKysgKSB7XG5cdFx0XG5cdFx0cmF0aW8xID0gaSAvIGl0ZXJhdGlvbnM7XG5cdFx0cmF0aW8yID0gMSAtIHJhdGlvMTtcblx0XHRcblx0XHRfZ2VuZXJhdGVDeWxpbmRlclZlcnRpY2VzKFxuXHRcdFx0dmVydGljZXMsXG5cdFx0XHRNYXRoLmZsb29yKCAoc2lkZXMgLSAzKSAqIHJhdGlvMiApICsgMyxcblx0XHRcdHJhZGl1cyAqIHJhdGlvMixcblx0XHRcdGhlaWdodCAqIHJhdGlvMiAqIHJhdGlvMixcblx0XHRcdGVjY2VudHJpY2l0eVxuXHRcdCk7XG5cdFx0XG5cdH1cbn1cblxuZnVuY3Rpb24gX2dldFRoZXRhc09uWFpQbGFuZSggdmVydGljZXMgKSB7XG5cdFxuXHRyZXR1cm4gXy5tYXAoIHZlcnRpY2VzLCBmdW5jdGlvbiggdiApIHtcblx0XHRcdFx0XG5cdFx0cmV0dXJuIE1hdGguYXRhbjIoIHYueiwgdi54ICk7XG5cdFx0XG5cdH0pO1xuXHRcbn1cblxuZnVuY3Rpb24gX2dldFlzKCB2ZXJ0aWNlcyApIHtcblx0cmV0dXJuIF8ubWFwKCB2ZXJ0aWNlcywgZnVuY3Rpb24oIHYgKSB7XG5cdFx0cmV0dXJuIHYueTtcblx0fSk7XG59XG5cbmZ1bmN0aW9uIF9nZXRVbml0SW50ZXJ2YWxPZkRpc3RhbmNlRnJvbVlPcmlnaW4oIHZlcnRpY2VzICkge1xuXHRcblx0dmFyIGRpc3RhbmNlcyA9IF8ubWFwKCB2ZXJ0aWNlcywgZnVuY3Rpb24oIHYgKSB7XG5cdFx0cmV0dXJuIE1hdGguc3FydCggdi54ICogdi54ICsgdi56ICogdi56ICk7XG5cdH0pO1xuXHRcblx0dmFyIG1heERpc3RhbmNlID0gXy5yZWR1Y2UoIGRpc3RhbmNlcywgZnVuY3Rpb24oIG1lbW8sIGQgKSB7XG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtZW1vLCBkICk7XG5cdH0sIDApO1xuXHRcblx0aWYoIG1heERpc3RhbmNlID09PSAwICkgdGhyb3cgbmV3IEVycm9yKFwibWF4RGlzdGFuY2UgY2FuJ3QgYmUgMFwiKTtcblx0XG5cdHJldHVybiBfLm1hcCggZGlzdGFuY2VzLCBmdW5jdGlvbiggZCApIHtcblx0XHRyZXR1cm4gZCAvIG1heERpc3RhbmNlO1xuXHR9KTtcblx0XG59XG5cbmZ1bmN0aW9uIF92ZXJ0aWNlc1dhdmVyKCB2ZXJ0aWNlcywgaGVpZ2h0ICkge1xuXHRcblx0dmFyIHRoZXRhcyA9IF9nZXRUaGV0YXNPblhaUGxhbmUoIHZlcnRpY2VzICk7XG5cdHZhciB5cyA9IF9nZXRZcyggdmVydGljZXMgKTtcblx0dmFyIGRlcHRocyA9IF9nZXRVbml0SW50ZXJ2YWxPZkRpc3RhbmNlRnJvbVlPcmlnaW4oIHZlcnRpY2VzICk7XG5cdFxuXHRyZXR1cm4gZnVuY3Rpb24oIGUgKSB7XG5cdFxuXHRcdHZhciB0ID0gZS50aW1lICogMC4wMDE1O1xuXHRcdHZhciBkZXB0aE9mZnNldCA9IHR3b8+AO1xuXHRcdHZhciBoLCB0aGV0YTtcblx0XHRcblx0XHRmb3IoIHZhciBpPTAsIGlsID0gdmVydGljZXMubGVuZ3RoOyBpIDwgaWw7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0aCA9IGhlaWdodCAqIGRlcHRoc1tpXTtcblx0XHRcdHRoZXRhID0gdGhldGFzW2ldICogMyArIHQgKyBkZXB0aE9mZnNldCAqIGRlcHRoc1tpXTtcblx0XG5cdFx0XHR2ZXJ0aWNlc1tpXS55ID0gTWF0aC5zaW4oIHRoZXRhICkgKiBoICsgeXNbaV07XG5cdFx0XG5cdFx0fVxuXHR9O1xufVxuXG52YXIgQ3lsaW5kZXJMaW5lcyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0Ly8gY29uc29sZS53YXJuKFwicmVtb3ZlIHRpdGxlIGhpZGluZyBoYWNrXCIpO1xuXHQvLyAkKCcjdGl0bGUnKS5oaWRlKCk7XG5cdC8vICQoJy5zY29yZScpLmNzcygnb3BhY2l0eScsIDEpO1xuXHRcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR2YXIgaCA9IDAuNTtcblx0dmFyIGwgPSAwLjU7XG5cdHZhciBzID0gMC41O1xuXHRcblx0dmFyIGdlb21ldHJ5XHRcdD0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdHZhciBoZWlnaHRcdFx0XHQ9IHBvZW0uciAqIChfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLmhlaWdodFBlcmNlbnRhZ2UgKSA/IHByb3BlcnRpZXMucmFkaXVzUGVyY2VudGFnZSA6IDAuOCk7XG5cdHZhciByYWRpdXNcdFx0XHQ9IHBvZW0uciAqIChfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLnJhZGl1c1BlcmNlbnRhZ2UgKSA/IHByb3BlcnRpZXMucmFkaXVzUGVyY2VudGFnZSA6IDAuOCk7XG5cdHZhciBzaWRlc1x0XHRcdD0gXy5pc051bWJlciggcHJvcGVydGllcy5zaWRlcyApID8gcHJvcGVydGllcy5zaWRlcyA6IDE1O1xuXHR2YXIgZWNjZW50cmljaXR5XHQ9IF8uaXNOdW1iZXIoIHByb3BlcnRpZXMuZWNjZW50cmljaXR5ICkgPyBwcm9wZXJ0aWVzLmVjY2VudHJpY2l0eSA6IDAuMTtcblx0dmFyIGl0ZXJhdGlvbnNcdFx0PSBfLmlzTnVtYmVyKCBwcm9wZXJ0aWVzLml0ZXJhdGlvbnMgKSA/IHByb3BlcnRpZXMuaXRlcmF0aW9ucyA6IDEwO1xuXHRcblx0X2dlbmVyYXRlTXVsdGlwbGVDeWxpbmRlclZlcnRpY2VzKFxuXHRcdGl0ZXJhdGlvbnMsXG5cdFx0Z2VvbWV0cnkudmVydGljZXMsXG5cdFx0c2lkZXMsXG5cdFx0cmFkaXVzLFxuXHRcdHBvZW0uaGVpZ2h0LFxuXHRcdGVjY2VudHJpY2l0eVxuXHQpO1xuXHRcblx0dmFyIHdhdmVWZXJ0aWNlcyA9IF92ZXJ0aWNlc1dhdmVyKCBnZW9tZXRyeS52ZXJ0aWNlcywgcG9lbS5oZWlnaHQgKiAwLjEgKTtcblx0dmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRjb2xvcjogdGhpcy5jb2xvcixcblx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aCxcblx0XHRmb2c6IHRydWVcblx0fSk7XG5cblx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTGluZShcblx0XHRnZW9tZXRyeSxcblx0XHRtYXRlcmlhbCxcblx0XHRUSFJFRS5MaW5lUGllY2VzXG5cdCk7XG5cdFxuXHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApO1xuXHR0aGlzLnBvZW0ub24oJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QpICk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIGZ1bmN0aW9uKCBlICkge1xuXG5cdFx0aCA9IChoICsgMC4wMDAyICogZS5kdCkgJSAxO1xuXHRcdG1hdGVyaWFsLmNvbG9yLnNldEhTTCggaCwgcywgbCApO1xuXHRcdHdhdmVWZXJ0aWNlcyggZSApO1xuXHRcdGdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cblx0fS5iaW5kKHRoaXMpKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEN5bGluZGVyTGluZXM7IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tLmpzJyk7XG52YXIgQnVsbGV0ID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvQnVsbGV0Jyk7XG52YXIgU291bmRHZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9zb3VuZC9Tb3VuZEdlbmVyYXRvcicpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcblxudmFyIERhbWFnZSA9IGZ1bmN0aW9uKCBwb2VtLCBzZXR0aW5ncyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMuY29sb3IgPSBudWxsO1xuXHR0aGlzLnBlckV4cGxvc2lvbiA9IDEwMDtcblx0dGhpcy5yZXRhaW5FeHBsb3Npb25zQ291bnQgPSAzO1xuXHR0aGlzLmJ1bGxldHMgPSBbXTtcblx0dGhpcy5leHBsb2RlU3BlZWQgPSAzO1xuXHR0aGlzLnRyYW5zcGFyZW50ID0gZmFsc2U7XG5cdHRoaXMub3BhY2l0eSA9IDE7XG5cdFxuXHR0aGlzLmV4cGxvc2lvbkNvdW50ID0gMDtcblx0dGhpcy5leHBsb3Npb25Tb3VuZCA9IG51bGw7XG5cdFxuXHRpZiggXy5pc09iamVjdCggc2V0dGluZ3MgKSApIHtcblx0XHRfLmV4dGVuZCggdGhpcywgc2V0dGluZ3MgKTtcblx0fVxuXHRcblx0dGhpcy5jb3VudCA9IHRoaXMucGVyRXhwbG9zaW9uICogdGhpcy5yZXRhaW5FeHBsb3Npb25zQ291bnQ7XG5cdFxuXHR0aGlzLmFkZE9iamVjdCgpO1xuXHR0aGlzLmFkZFNvdW5kKCk7XG59O1xuXHRcbkRhbWFnZS5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIHZlcnRleCwgYnVsbGV0O1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRcdFxuXHRcdGZvcih2YXIgaT0wOyBpIDwgdGhpcy5jb3VudDsgaSsrKSB7XG5cdFx0XHRcblx0XHRcdHZlcnRleCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0XHRidWxsZXQgPSBuZXcgQnVsbGV0KCB0aGlzLnBvZW0sIHRoaXMsIHZlcnRleCApO1xuXHRcdFx0XG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCB2ZXJ0ZXggKTtcblx0XHRcdHRoaXMuYnVsbGV0cy5wdXNoKCBidWxsZXQgKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LmtpbGwoKTtcblx0XHRcdGJ1bGxldC5wb3NpdGlvbi55ID0gMTAwMDtcblx0XHRcdFx0XHRcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHR9LFxuXHRcblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmdlbmVyYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRuZXcgVEhSRUUuUG9pbnRDbG91ZE1hdGVyaWFsKHtcblx0XHRcdFx0IHNpemU6IDEgKiB0aGlzLnBvZW0ucmF0aW8sXG5cdFx0XHRcdCBjb2xvcjogdGhpcy5jb2xvcixcblx0XHRcdFx0IHRyYW5zcGFyZW50OiB0aGlzLnRyYW5zcGFyZW50LFxuXHRcdFx0XHQgb3BhY2l0eTogdGhpcy5vcGFjaXR5XG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5vYmplY3QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdHRoaXMucG9lbS5vbiggJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QgKSApO1xuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNhd3Rvb3RoXCIgKSxcblx0XHRcdHNvdW5kLm1ha2VHYWluKCksXG5cdFx0XHRzb3VuZC5nZXREZXN0aW5hdGlvbigpXG5cdFx0XSk7XG5cdFx0XG5cdFx0c291bmQuc2V0R2FpbigwLDAsMCk7XG5cdFx0c291bmQuc3RhcnQoKTtcblx0XHRcblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmJ1bGxldHMsIGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdH0pO1xuXHRcdFxuXHR9LFxuXHRcblx0ZXhwbG9kZSA6IGZ1bmN0aW9uKCBwb3NpdGlvbiApIHtcblx0XHRcblx0XHR0aGlzLnBsYXlFeHBsb3Npb25Tb3VuZCgpO1xuXHRcdFxuXHRcdF8uZWFjaCggXy5zYW1wbGUoIHRoaXMuYnVsbGV0cywgdGhpcy5wZXJFeHBsb3Npb24gKSwgZnVuY3Rpb24oIGJ1bGxldCkge1xuXG5cdFx0XHR2YXIgdGhldGEgPSByYW5kb20ucmFuZ2UoMCwgMiAqIE1hdGguUEkpO1xuXHRcdFx0dmFyIHIgPSByYW5kb20ucmFuZ2VMb3coIDAsIHRoaXMuZXhwbG9kZVNwZWVkICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5hbGl2ZSA9IHRydWU7XG5cdFx0XHRidWxsZXQucG9zaXRpb24uY29weSggcG9zaXRpb24gKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LnNwZWVkLnggPSByICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHRidWxsZXQuc3BlZWQueSA9IHIgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcdFx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0XG5cdH0sXG5cdFxuXHRwbGF5RXhwbG9zaW9uU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZnJlcSA9IDUwMDtcblx0XHR2YXIgc291bmQgPSB0aGlzLmV4cGxvc2lvblNvdW5kO1xuXG5cdFx0Ly9TdGFydCBzb3VuZFxuXHRcdHNvdW5kLnNldEdhaW4oMC41LCAwLCAwLjAwMSk7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBzdGVwID0gMC4wMjtcblx0XHR2YXIgdGltZXMgPSA2O1xuXHRcdHZhciBpPTE7XG5cdFx0XG5cdFx0Zm9yKGk9MTsgaSA8IHRpbWVzOyBpKyspIHtcblx0XHRcdHNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogTWF0aC5yYW5kb20oKSwgc3RlcCAqIGksIHN0ZXApO1xuXHRcdH1cblxuXHRcdC8vRW5kIHNvdW5kXG5cdFx0c291bmQuc2V0R2FpbigwLCBzdGVwICogdGltZXMsIDAuMik7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEgKiAwLjIxLCBzdGVwICogdGltZXMsIDAuMDUpO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSAge1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy5idWxsZXRzLCBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0YnVsbGV0LnVwZGF0ZSggZSApO1xuXHRcdFx0YnVsbGV0LnNwZWVkLm11bHRpcGx5U2NhbGFyKDAuOTk5KTtcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGFtYWdlOyIsIi8qXG5cdFNldCB0aGUgd2luIGNvbmRpdGlvbnMgaW4gdGhlIGxldmVsIG1hbmlmZXN0IGFzIGJlbG93XG5cblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb21wb25lbnQ6IFwiamVsbHlNYW5hZ2VyXCIsXG5cdFx0XHRcdFx0cHJvcGVydGllczogbnVsbFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fVxuXG5cdFBzdWVkby1jb2RlIGdldHMgY2FsbGVkOlxuXG5cdFx0amVsbHlNYW5hZ2VyLndhdGNoRm9yQ29tcGxldGlvbiggd2luQ2hlY2ssIHByb3BlcnRpZXMgKTtcblxuXHRUaGVuIGluIHRoZSBqZWxseU1hbmFnZXIgY29tcG9uZW50LCBjYWxsIHRoZSBmb2xsb3dpbmcgd2hlbiBjb25kaXRpb24gaXMgY29tcGxldGVkOlxuXG5cdFx0c2NvcmluZ0FuZFdpbm5pbmcucmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkKCk7XG5cbiovXG52YXIgaGFzaGVyID0gcmVxdWlyZSgnaGFzaGVyJyk7XG52YXIgcm91dGluZyA9IHJlcXVpcmUoJy4uL3JvdXRpbmcnKTtcbnZhciBzY29yZXMgPSByZXF1aXJlKCcuL3Njb3JlcycpO1xudmFyIHNlbGVjdG9ycyA9IHJlcXVpcmUoJy4uL3V0aWxzL3NlbGVjdG9ycycpO1xudmFyIGxldmVscyA9IHJlcXVpcmUoJy4uL2xldmVscycpO1xuXG52YXIgU2NvcmluZ0FuZFdpbm5pbmcgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0XG5cdHByb3BlcnRpZXMgPSBfLmlzT2JqZWN0KCBwcm9wZXJ0aWVzICkgPyBwcm9wZXJ0aWVzIDoge307XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dGhpcy4kc2NvcmUgPSBzZWxlY3RvcnMoIFwiI3Njb3JlXCIsIHtcblx0XHR2YWx1ZVx0XHRcdDogJy5zY29yZS12YWx1ZScsXG5cdFx0dG90YWxcdFx0XHQ6ICcuc2NvcmUtdG90YWwnLFxuXHRcdGJhclx0XHRcdFx0OiAnLnNjb3JlLWJhci1iYXInLFxuXHRcdHRleHRcdFx0XHQ6ICcuc2NvcmUtYmFyLW51bWJlcicsXG5cdFx0ZW5lbWllc0NvdW50XHQ6ICcuZW5lbWllcy1jb3VudCcsXG5cdFx0bWVzc2FnZVx0XHRcdDogJy5zY29yZS1tZXNzYWdlJyxcblx0fSk7XG5cblx0dGhpcy4kd2luID0gc2VsZWN0b3JzKCAnI3dpbicsIHtcblx0XHRzY29yZVx0XHQ6ICcud2luLXNjb3JlJyxcblx0XHRtYXhTY29yZVx0OiAnLndpbi1tYXgtc2NvcmUnLFxuXHRcdHRleHRcdFx0OiAnLndpbi10ZXh0Jyxcblx0XHRuZXh0TGV2ZWxcdDogJy53aW4tbmV4dC1sZXZlbCcsXG5cdFx0cmVzdGFydFx0XHQ6ICcud2luLXJlc3RhcnQnXG5cdH0pO1xuXHRcblx0dGhpcy5zY29yZSA9IDA7XG5cdHRoaXMuZW5lbWllc0NvdW50ID0gMDtcblx0dGhpcy5zY29yZU1lc3NhZ2VJZCA9IDA7XG5cdHRoaXMubWVzc2FnZSA9IF8uaXNTdHJpbmcoIHByb3BlcnRpZXMubWVzc2FnZSApID8gcHJvcGVydGllcy5tZXNzYWdlIDogXCJZb3UgV2luXCI7XG5cdHRoaXMubmV4dExldmVsID0gcHJvcGVydGllcy5uZXh0TGV2ZWwgPyBwcm9wZXJ0aWVzLm5leHRMZXZlbCA6IG51bGw7XG5cdHRoaXMud29uID0gZmFsc2U7XG5cdHRoaXMubWF4U2NvcmUgPSBsZXZlbHNbIHBvZW0uc2x1ZyBdLm1heFNjb3JlO1xuXHRcblx0dGhpcy4kc2NvcmUudG90YWwudGV4dCggdGhpcy5tYXhTY29yZSApO1xuXHR0aGlzLnVwZGF0ZVNjb3JlRWxlbWVudHMoKTtcblx0XG5cdHRoaXMuY29uZGl0aW9uc1JlbWFpbmluZyA9IFtdO1xuXHRcblx0dGhpcy5wb2VtLm9uKCdsZXZlbFBhcnNlZCcsIGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuc2V0Q29uZGl0aW9ucyggcHJvcGVydGllcy5jb25kaXRpb25zICk7XG5cdH0uYmluZCh0aGlzKSk7XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTY29yaW5nQW5kV2lubmluZztcblxuU2NvcmluZ0FuZFdpbm5pbmcucHJvdG90eXBlID0ge1xuXHRcblx0c2V0Q29uZGl0aW9ucyA6IGZ1bmN0aW9uKCBjb25kaXRpb25zICkge1xuXHRcdFxuXHRcdC8vIFN0YXJ0IHdhdGNoaW5nIGZvciBjb21wbGV0aW9uIGZvciBhbGwgY29tcG9uZW50c1xuXHRcdFxuXHRcdF8uZWFjaCggY29uZGl0aW9ucywgZnVuY3Rpb24oIGNvbmRpdGlvbiApIHtcblx0XHRcblx0XHRcdHZhciBjb21wb25lbnQgPSB0aGlzLnBvZW1bY29uZGl0aW9uLmNvbXBvbmVudF07XG5cdFx0XHR2YXIgYXJncyA9IF8udW5pb24oIHRoaXMsIGNvbmRpdGlvbi5wcm9wZXJ0aWVzICk7XG5cdFx0XG5cdFx0XHRjb21wb25lbnQud2F0Y2hGb3JDb21wbGV0aW9uLmFwcGx5KCBjb21wb25lbnQsIGFyZ3MgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5jb25kaXRpb25zUmVtYWluaW5nLnB1c2goIGNvbXBvbmVudCApO1xuXHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0XG5cdH0sXG5cdFxuXHRyZXBvcnRDb25kaXRpb25Db21wbGV0ZWQgOiBmdW5jdGlvbiggY29tcG9uZW50ICkge1xuXHRcdFxuXHRcdGlmKCB0aGlzLndvbiApIHJldHVybjtcblx0XHRcblx0XHRfLmRlZmVyKGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR0aGlzLmNvbmRpdGlvbnNSZW1haW5pbmcgPSBfLmZpbHRlciggdGhpcy5jb25kaXRpb25zUmVtYWluZywgZnVuY3Rpb24oIGNvbmRpdGlvbiApIHtcblx0XHRcdFx0cmV0dXJuIGNvbmRpdGlvbiAhPT0gY29tcG9uZW50O1xuXHRcdFx0fSk7XG5cdFx0XG5cdFx0XHRpZiggdGhpcy5jb25kaXRpb25zUmVtYWluaW5nLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdFxuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5kaXNhYmxlKCk7XG5cdFx0XHRcdHRoaXMud29uID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5jb25kaXRpb25zQ29tcGxldGVkKCk7XG5cdFx0XHRcblx0XHRcdH1cblx0XHRcdFxuXHRcdH0uYmluZCh0aGlzKSk7XHRcdFxuXHR9LFxuXG5cdHJlcG9ydENvbmRpdGlvbkluY29tcGxldGUgOiBmdW5jdGlvbiggY29tcG9uZW50ICkge1xuXG5cdFx0aWYoIHRoaXMud29uICkgcmV0dXJuO1xuXHRcdFx0XHRcblx0XHRfLmRlZmVyKGZ1bmN0aW9uKCkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaW5kZXggPSB0aGlzLmNvbmRpdGlvbnNSZW1haW5pbmcuaW5kZXhPZiggY29tcG9uZW50ICkgO1xuXHRcdFx0XG5cdFx0XHRpZiggaW5kZXggPT09IC0xICkge1xuXHRcdFx0XHR0aGlzLmNvbmRpdGlvbnNSZW1haW5pbmcucHVzaCggY29tcG9uZW50ICk7XG5cdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpKTtcdFx0XG5cdH0sXG5cdFxuXHRcblx0YWRqdXN0RW5lbWllcyA6IGZ1bmN0aW9uKCBjb3VudCApIHtcblx0XHRcblx0XHQvLyBpZih0aGlzLndvbikgcmV0dXJuO1xuXHRcdFxuXHRcdHRoaXMuZW5lbWllc0NvdW50ICs9IGNvdW50O1xuXHRcdHRoaXMuJHNjb3JlLmVuZW1pZXNDb3VudC50ZXh0KCB0aGlzLmVuZW1pZXNDb3VudCApO1xuXHRcdFxuXHRcdHJldHVybiB0aGlzLmVuZW1pZXNDb3VudDtcblx0fSxcblx0XG5cdGFkanVzdFNjb3JlIDogZnVuY3Rpb24oIGNvdW50LCBtZXNzYWdlLCBzdHlsZSApIHtcblx0XHRcblx0XHRpZih0aGlzLndvbikgcmV0dXJuO1xuXHRcdFxuXHRcdHRoaXMuc2NvcmUgKz0gY291bnQ7XG5cdFx0XG5cdFx0dGhpcy51cGRhdGVTY29yZUVsZW1lbnRzKCk7XG5cdFx0XG5cdFx0aWYoIG1lc3NhZ2UgKSB0aGlzLnNob3dNZXNzYWdlKCBtZXNzYWdlLCBzdHlsZSApO1xuXHRcdFxuXHRcdHJldHVybiB0aGlzLnNjb3JlO1xuXHR9LFxuXHRcblx0dXBkYXRlU2NvcmVFbGVtZW50cyA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBzY29yZVBlcmNlbnRhZ2UgPSBNYXRoLnJvdW5kKCB0aGlzLnNjb3JlIC8gdGhpcy5tYXhTY29yZSAqIDEwMCApO1xuXHRcdFxuXHRcdHRoaXMuJHNjb3JlLnZhbHVlLnRleHQoIHRoaXMuc2NvcmUgKTtcblx0XHR0aGlzLiRzY29yZS5iYXIud2lkdGgoICApO1xuXHRcdHRoaXMuJHNjb3JlLnRleHQudG9nZ2xlQ2xhc3MoJ3Njb3JlLWJhci1sZWZ0Jywgc2NvcmVQZXJjZW50YWdlID49IDUwICk7XG5cdFx0dGhpcy4kc2NvcmUudGV4dC50b2dnbGVDbGFzcygnc2NvcmUtYmFyLXJpZ2h0Jywgc2NvcmVQZXJjZW50YWdlIDwgNTAgKTtcblx0XHR0aGlzLiRzY29yZS5iYXIuY3NzKHtcblx0XHRcdHdpZHRoOiBzY29yZVBlcmNlbnRhZ2UgKyBcIiVcIixcblx0XHRcdGJhY2tncm91bmRDb2xvcjogXCIjZjAwXCJcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLnVwZGF0ZVNjb3JlRWxlbWVudHNUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0dGhpcy4kc2NvcmUuYmFyLmNzcyh7XG5cdFx0XHRcdHdpZHRoOiBzY29yZVBlcmNlbnRhZ2UgKyBcIiVcIixcblx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBcIiNDNDRGNEZcIlxuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHR9LmJpbmQodGhpcyksIDUwMCk7XG5cdFx0XG5cdH0sXG5cdFxuXHRzaG93TWVzc2FnZSA6IGZ1bmN0aW9uKCBtZXNzYWdlLCBzdHlsZSApIHtcblx0XHRcblx0XHR2YXIgJHNwYW4gPSAkKCc8c3Bhbj48L3NwYW4+JykudGV4dCggbWVzc2FnZSApO1xuXHRcdFxuXHRcdGlmKCBzdHlsZSApICRzcGFuLmNzcyggc3R5bGUgKTtcblx0XHRcblx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLmhpZGUoKTtcblx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLmVtcHR5KCkuYXBwZW5kKCAkc3BhbiApO1xuXHRcdHRoaXMuJHNjb3JlLm1lc3NhZ2UucmVtb3ZlQ2xhc3MoJ2ZhZGVvdXQnKTtcblx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLmFkZENsYXNzKCdmYWRlaW4nKTtcblx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLnNob3coKTtcblx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLnJlbW92ZUNsYXNzKCdmYWRlaW4nKTtcblx0XHRcblx0XHR2YXIgaWQgPSArK3RoaXMuc2NvcmVNZXNzYWdlSWQ7XG5cdFx0XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0aWYoIGlkID09PSB0aGlzLnNjb3JlTWVzc2FnZUlkICkge1xuXHRcdFx0XHR0aGlzLiRzY29yZS5tZXNzYWdlLmFkZENsYXNzKCdmYWRlb3V0Jyk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LmJpbmQodGhpcyksIDIwMDApO1xuXHRcdFxuXHR9LFxuXHRcblx0Y29uZGl0aW9uc0NvbXBsZXRlZCA6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcblx0XHR0aGlzLiR3aW4uc2NvcmUudGV4dCggdGhpcy5zY29yZSApO1xuXHRcdHRoaXMuJHdpbi5tYXhTY29yZS50ZXh0KCB0aGlzLm1heFNjb3JlICk7XG5cdFx0dGhpcy4kd2luLnRleHQuaHRtbCggdGhpcy5tZXNzYWdlICk7XG5cdFx0XG5cdFx0dGhpcy5zaG93V2luU2NyZWVuKCk7XG5cdFx0XG5cdFx0dGhpcy4kd2luLm5leHRMZXZlbC5vZmYoKS5vbmUoICdjbGljaycsIGZ1bmN0aW9uKCBlICkge1xuXHRcdFx0XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcblx0XHRcdGhhc2hlci5zZXRIYXNoKFwibGV2ZWwvXCIgKyB0aGlzLm5leHRMZXZlbCApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmhpZGVXaW5TY3JlZW4oKTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcblx0XHR0aGlzLiR3aW4ucmVzdGFydC5vZmYoKS5vbmUoICdjbGljaycsIGZ1bmN0aW9uKCBlICkge1xuXHRcdFx0XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHRcdHJvdXRpbmcubG9hZFVwQUxldmVsKCB0aGlzLnBvZW0uc2x1ZyApO1xuXG5cdFx0XHR0aGlzLmhpZGVXaW5TY3JlZW4oKTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcblx0fSxcblx0XG5cdHNob3dXaW5TY3JlZW4gOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLiR3aW4uc2NvcGVcblx0XHRcdC5yZW1vdmVDbGFzcygndHJhbnNmb3JtLXRyYW5zaXRpb24nKVxuXHRcdFx0LmFkZENsYXNzKCdoaWRlJylcblx0XHRcdC5hZGRDbGFzcygndHJhbnNmb3JtLXRyYW5zaXRpb24nKVxuXHRcdFx0LnNob3coKTtcblx0XHRcblx0XHQkKCcjY29udGFpbmVyIGNhbnZhcycpLmNzcygnb3BhY2l0eScsIDAuMyk7XG5cdFx0XG5cdFx0c2NvcmVzLnNldCggdGhpcy5wb2VtLnNsdWcsIHRoaXMuc2NvcmUgKTtcblx0XHRcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy4kd2luLnNjb3BlLnJlbW92ZUNsYXNzKCdoaWRlJyk7XG5cdFx0fS5iaW5kKHRoaXMpLCAxKTtcblx0XHRcblx0XHR0aGlzLnBvZW0ub24oICdkZXN0cm95JywgdGhpcy5oaWRlV2luU2NyZWVuLmJpbmQodGhpcykgKTtcblx0XHRcblx0fSxcblx0XG5cdGhpZGVXaW5TY3JlZW4gOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLiR3aW4uc2NvcGUuYWRkQ2xhc3MoJ2hpZGUnKTtcblx0XHQkKCcjY29udGFpbmVyIGNhbnZhcycpLmNzcygnb3BhY2l0eScsIDEpO1xuXHRcdFxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHR0aGlzLiR3aW4uc2NvcGUuaGlkZSgpO1xuXHRcdH0uYmluZCh0aGlzKSwgMTAwMCk7XG5cdFx0XG5cdH0sXG5cdFxufTsiLCJ2YXIgZGVzdHJveU1lc2ggPSByZXF1aXJlKCcuLi91dGlscy9kZXN0cm95TWVzaCcpO1xuXG52YXIgU3RhcnMgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0XG5cdHByb3BlcnRpZXMgPSBfLmlzT2JqZWN0KCBwcm9wZXJ0aWVzICkgPyBwcm9wZXJ0aWVzIDoge307XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdFxuXHR0aGlzLmNvdW50ID0gXy5pc051bWJlciggcHJvcGVydGllcy5jb3VudCApID8gcHJvcGVydGllcy5jb3VudCA6IDQwMDAwO1xuXHR0aGlzLmRlcHRoID0gNy41O1xuXHR0aGlzLmNvbG9yID0gMHhhYWFhYWE7XG5cdFxuXHR0aGlzLmFkZE9iamVjdCgpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGFycztcblxuU3RhcnMucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByLCB0aGV0YSwgeCwgeSwgeiwgZ2VvbWV0cnk7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHRyID0gTWF0aC5yYW5kb20oKSAqIHRoaXMuZGVwdGggKiB0aGlzLnBvZW0ucjtcblx0XHRcdGlmKCByIDwgdGhpcy5wb2VtLnIgKSB7XG5cdFx0XHRcdHIgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0fVxuXHRcdFx0dGhldGEgPSBNYXRoLnJhbmRvbSgpICogMiAqIE1hdGguUEk7XG5cdFx0XHRcblx0XHRcdHggPSBNYXRoLmNvcyggdGhldGEgKSAqIHI7XG5cdFx0XHR6ID0gTWF0aC5zaW4oIHRoZXRhICkgKiByO1xuXHRcdFx0eSA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMuZGVwdGggKiB0aGlzLnBvZW0ucjtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoeCx5LHopICk7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAwLjUgKiB0aGlzLnBvZW0ucmF0aW8sXG5cdFx0XHRcdCBjb2xvcjogdGhpcy5jb2xvcixcblx0XHRcdFx0IGZvZzogZmFsc2Vcblx0XHRcdH1cblx0XHQpICk7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKSA7XG5cdFx0dGhpcy5wb2VtLm9uKCAnZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdH1cbn07IiwidmFyIEhJRCA9IHJlcXVpcmUoJy4uL0NvbXBvbmVudHMvSGlkJyk7XG52YXIgaGFzaGVyID0gcmVxdWlyZSgnaGFzaGVyJyk7XG5cbnZhciBUaXRsZXMgPSBmdW5jdGlvbiggcG9lbSwgcHJvcGVydGllcyApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHRoaXMucG9lbS5zaGlwLmRpc2FibGUoKTtcblx0dGhpcy5yb3RhdGVTdGFycygpO1xuXHRcblx0JCgnYVtocmVmPSNrZXlzXScpLm9mZigpLmNsaWNrKHRoaXMuaGFuZGxlS2V5c0NsaWNrLmJpbmQodGhpcykpO1xuXHQkKCdhW2hyZWY9I3RpbHRdJykub2ZmKCkuY2xpY2sodGhpcy5oYW5kbGVUaWx0Q2xpY2suYmluZCh0aGlzKSk7XG5cdFxuXHR0aGlzLndlYmdsQ2hlY2soKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVGl0bGVzO1xuXG5UaXRsZXMucHJvdG90eXBlID0ge1xuXHRcblx0d2ViZ2xFbmFibGVkIDogKCBmdW5jdGlvbiAoKSB7IHRyeSB7IHZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApOyByZXR1cm4gISEgd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCAmJiAoIGNhbnZhcy5nZXRDb250ZXh0KCAnd2ViZ2wnICkgfHwgY2FudmFzLmdldENvbnRleHQoICdleHBlcmltZW50YWwtd2ViZ2wnICkgKTsgfSBjYXRjaCggZSApIHsgcmV0dXJuIGZhbHNlOyB9IH0gKSgpLFxuXHRcblx0d2ViZ2xDaGVjayA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdGlmKCAhdGhpcy53ZWJnbEVuYWJsZWQgKSB7XG5cdFx0XHQkKCdhW2hyZWY9I2tleXNdJykuaGlkZSgpO1xuXHRcdFx0JCgnYVtocmVmPSN0aWx0XScpLmhpZGUoKTtcblx0XHRcdCQoJy50aXRsZS13ZWJnbC1lcnJvcicpLnNob3coKTtcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRoYW5kbGVLZXlzQ2xpY2sgOiBmdW5jdGlvbihlKSB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdEhJRC5wcm90b3R5cGUuc2V0S2V5cygpO1xuXHRcdHRoaXMubmV4dExldmVsKCk7XG5cdH0sXG5cdFxuXHRoYW5kbGVUaWx0Q2xpY2sgOiBmdW5jdGlvbihlKSB7XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdEhJRC5wcm90b3R5cGUuc2V0VGlsdCgpO1xuXHRcdHRoaXMubmV4dExldmVsKCk7XG5cdH0sXG5cdFxuXHRuZXh0TGV2ZWwgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHRoYXNoZXIuc2V0SGFzaChcImxldmVsL2ludHJvXCIpO1xuXHRcdFxuXHR9LFxuXHRcblx0cm90YXRlU3RhcnMgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLnN0YXJzLm9iamVjdC5yb3RhdGlvbi55IC09IDAuMDAwMSAqIGUuZHQ7XG5cdFx0XG5cdFx0fS5iaW5kKHRoaXMpICk7XG5cdFx0XG5cdH1cblx0XG59OyIsInZhciB0d2/PgCA9IE1hdGguUEkgKiAyO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyZWF0ZVdlYkdlb21ldHJ5KCBzaWRlcywgbGV2ZWxzLCByYWRpdXMsIGhlaWdodCApIHtcblx0XG5cdHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHR2YXIgdmVydGljZXMgPSBnZW9tZXRyeS52ZXJ0aWNlcztcblx0dmFyIGZhY2VzID0gZ2VvbWV0cnkuZmFjZXM7XG5cdHZhciBzaWRlTGVuZ3RoID0gdHdvz4AgLyBzaWRlcztcblx0dmFyIGxldmVsSGVpZ2h0ID0gaGVpZ2h0IC8gbGV2ZWxzO1xuXG5cdHZhciBhLGIsYyxkO1xuXHR2YXIgYWksYmksY2ksZGk7XG5cdHZhciBhbixibixjbixkbjtcblx0XG5cdHZhciBzaWRlT2Zmc2V0LCBvZmZzZXQgPSAwO1xuXG5cdGZvciggdmFyIGxldmVsPTA7IGxldmVsIDwgbGV2ZWxzOyBsZXZlbCsrICkge1xuXHRcdFxuXHRcdG9mZnNldCArPSAwLjU7XG5cdFx0XG5cdFx0Zm9yKCB2YXIgc2lkZT0wOyBzaWRlIDwgc2lkZXM7IHNpZGUrKyApIHtcblxuXHRcdFx0Ly8gVmVydGljZXMgYW5kIGZhY2VzIGxpa2Ugc286XG5cdFx0XHQvLyAgICAgYyBfX19fX18gZFxuXHRcdFx0Ly8gICAgICAvXFwgICAgL1xuXHRcdFx0Ly8gICAgIC8gIFxcICAvXG5cdFx0XHQvLyAgYSAvX19fX1xcLyBiXG5cdFx0XHRcblx0XHRcdHNpZGVPZmZzZXQgPSBzaWRlICsgb2Zmc2V0O1xuXHRcdFx0XG5cdFx0XHRhID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdE1hdGguY29zKCBzaWRlTGVuZ3RoICogc2lkZU9mZnNldCApICogcmFkaXVzLFxuXHRcdFx0XHRsZXZlbCAqIGxldmVsSGVpZ2h0IC0gaGVpZ2h0IC8gMixcblx0XHRcdFx0TWF0aC5zaW4oIHNpZGVMZW5ndGggKiBzaWRlT2Zmc2V0ICkgKiByYWRpdXNcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdGIgPSBuZXcgVEhSRUUuVmVjdG9yMyhcblx0XHRcdFx0TWF0aC5jb3MoIHNpZGVMZW5ndGggKiAoc2lkZU9mZnNldCArIDEpICkgKiByYWRpdXMsXG5cdFx0XHRcdGxldmVsICogbGV2ZWxIZWlnaHQgLSBoZWlnaHQgLyAyLFxuXHRcdFx0XHRNYXRoLnNpbiggc2lkZUxlbmd0aCAqIChzaWRlT2Zmc2V0ICsgMSkgKSAqIHJhZGl1c1xuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0YyA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuXHRcdFx0XHRNYXRoLmNvcyggc2lkZUxlbmd0aCAqIChzaWRlT2Zmc2V0ICsgMC41KSApICogcmFkaXVzLFxuXHRcdFx0XHQobGV2ZWwgKyAxKSAqIGxldmVsSGVpZ2h0IC0gaGVpZ2h0IC8gMixcblx0XHRcdFx0TWF0aC5zaW4oIHNpZGVMZW5ndGggKiAoc2lkZU9mZnNldCArIDAuNSkgKSAqIHJhZGl1c1xuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0ZCA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuXHRcdFx0XHRNYXRoLmNvcyggc2lkZUxlbmd0aCAqIChzaWRlT2Zmc2V0ICsgMS41KSApICogcmFkaXVzLFxuXHRcdFx0XHQobGV2ZWwgKyAxKSAqIGxldmVsSGVpZ2h0IC0gaGVpZ2h0IC8gMixcblx0XHRcdFx0TWF0aC5zaW4oIHNpZGVMZW5ndGggKiAoc2lkZU9mZnNldCArIDEuNSkgKSAqIHJhZGl1c1xuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFx0Ly9QdXNoIGFuZCBnZXQgaW5kZXhcblx0XHRcdGFpID0gdmVydGljZXMucHVzaCggYSApIC0gMTtcblx0XHRcdGJpID0gdmVydGljZXMucHVzaCggYiApIC0gMTtcblx0XHRcdGNpID0gdmVydGljZXMucHVzaCggYyApIC0gMTtcblx0XHRcdGRpID0gdmVydGljZXMucHVzaCggZCApIC0gMTtcblx0XHRcdFxuXHRcdFx0ZmFjZXMucHVzaChcblx0XHRcdFx0bmV3IFRIUkVFLkZhY2UzKCBjaSwgYWksIGJpICksXG5cdFx0XHRcdG5ldyBUSFJFRS5GYWNlMyggY2ksIGJpLCBkaSApXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0fVxuXHRcdFxuXHR9XG5cdFxuXHRcblx0Z2VvbWV0cnkubWVyZ2VWZXJ0aWNlcygpO1xuXHRnZW9tZXRyeS5jb21wdXRlVmVydGV4Tm9ybWFscygpO1xuXHRnZW9tZXRyeS5jb21wdXRlRmFjZU5vcm1hbHMoKTtcblx0XG5cdHJldHVybiBnZW9tZXRyeTtcblx0XG59OyIsInZhciBnbHNsaWZ5ID0gcmVxdWlyZShcImdsc2xpZnlcIik7XG52YXIgY3JlYXRlU2hhZGVyID0gcmVxdWlyZShcInRocmVlLWdsc2xpZnlcIikoVEhSRUUpO1xudmFyIGNyZWF0ZVdlYkdlb21ldHJ5ID0gcmVxdWlyZShcIi4vZ2VvbWV0cnlcIik7XG52YXIgQ29vcmRpbmF0ZXMgPSByZXF1aXJlKFwiLi4vLi4vdXRpbHMvQ29vcmRpbmF0ZXNcIik7XG5cbmZ1bmN0aW9uIHdvcmxkUG9zaXRpb25WZWxvY2l0eVVwZGF0ZXIoY29vcmRpbmF0ZXMsIGZyb21Qb2xhclBvc2l0aW9uLCB0b1dvcmxkUG9zaXRpb24sIHRvVmVsb2NpdHkpIHtcbiAgICB2YXIgbmV3V29ybGRQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG4gICAgdmFyIG5ld1ZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbiAgICBjb29yZGluYXRlcy5zZXRWZWN0b3IodG9Xb3JsZFBvc2l0aW9uLCBmcm9tUG9sYXJQb3NpdGlvbik7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvb3JkaW5hdGVzLnNldFZlY3RvcihuZXdXb3JsZFBvc2l0aW9uLCBmcm9tUG9sYXJQb3NpdGlvbik7XG4gICAgICAgIG5ld1ZlbG9jaXR5LnN1YlZlY3RvcnMobmV3V29ybGRQb3NpdGlvbiwgdG9Xb3JsZFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAobmV3VmVsb2NpdHkubGVuZ3RoU3EoKSA+IDI1MDApIHtcbiAgICAgICAgICAgIG5ld1ZlbG9jaXR5LnNldCgwLCAwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld1dvcmxkUG9zaXRpb24ubGVycCh0b1dvcmxkUG9zaXRpb24sIDAuNSk7XG4gICAgICAgICAgICBuZXdWZWxvY2l0eS5sZXJwKHRvVmVsb2NpdHksIDAuOTUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9WZWxvY2l0eS5jb3B5KG5ld1ZlbG9jaXR5KTtcbiAgICAgICAgdG9Xb3JsZFBvc2l0aW9uLmNvcHkobmV3V29ybGRQb3NpdGlvbik7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gc2hpcFBvc2l0aW9uVW5pZm9ybXMocG9lbSwgc2hhZGVyLCBzaGlwUG9zaXRpb24pIHtcbiAgICB2YXIgc2hpcFdvcmxkUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuICAgIHZhciBzaGlwV29ybGRWZWxvY2l0eSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgICBzaGFkZXIudW5pZm9ybXMuc2hpcFBvc2l0aW9uID0ge1xuICAgICAgICB0eXBlOiBcInYzXCIsXG4gICAgICAgIHZhbHVlOiBzaGlwV29ybGRQb3NpdGlvblxuICAgIH07XG5cbiAgICBzaGFkZXIudW5pZm9ybXMuc2hpcFZlbG9jaXR5ID0ge1xuICAgICAgICB0eXBlOiBcInYzXCIsXG4gICAgICAgIHZhbHVlOiBzaGlwV29ybGRWZWxvY2l0eVxuICAgIH07XG5cbiAgICBzaGFkZXIudW5pZm9ybXMudGltZSA9IHtcbiAgICAgICAgdHlwZTogXCJmXCIsXG4gICAgICAgIHZhbHVlOiAwXG4gICAgfTtcblxuICAgIHBvZW0ub24oXCJ1cGRhdGVcIiwgd29ybGRQb3NpdGlvblZlbG9jaXR5VXBkYXRlcihwb2VtLmNvb3JkaW5hdGVzLCBwb2VtLnNoaXAucG9zaXRpb24sIHNoaXBXb3JsZFBvc2l0aW9uLCBzaGlwV29ybGRWZWxvY2l0eSkpO1xufVxuXG52YXIgV2ViID0gZnVuY3Rpb24ocG9lbSwgcHJvcGVydGllcykge1xuICAgIHRoaXMucG9lbSA9IHBvZW07XG4gICAgdmFyIHNoYWRlciA9IGNyZWF0ZVNoYWRlcihyZXF1aXJlKFwiZ2xzbGlmeS9zaW1wbGUtYWRhcHRlci5qc1wiKShcIlxcbiNkZWZpbmUgR0xTTElGWSAxXFxuXFxudW5pZm9ybSB2ZWMzIHNoaXBQb3NpdGlvbjtcXG51bmlmb3JtIHZlYzMgc2hpcFZlbG9jaXR5O1xcbmF0dHJpYnV0ZSBmbG9hdCB0aW1lO1xcbnZhcnlpbmcgdmVjNCB2Q29sb3I7XFxudm9pZCBtYWluKCkge1xcbiAgZmxvYXQgc2hpcERpc3RhbmNlID0gbWF4KGRpc3RhbmNlKHNoaXBQb3NpdGlvbiwgcG9zaXRpb24pLCAxMC4wKTtcXG4gIHZDb2xvciA9IHZlYzQoMS4wLCAwLjAsIDAuMCwgMS4wKSAqIDUuMCAqIGxlbmd0aChzaGlwVmVsb2NpdHkpIC8gc2hpcERpc3RhbmNlO1xcbiAgZ2xfUG9zaXRpb24gPSBwcm9qZWN0aW9uTWF0cml4ICogbW9kZWxWaWV3TWF0cml4ICogdmVjNChwb3NpdGlvbiAtIHNoaXBWZWxvY2l0eSAqIDUwLjAgLyAoc2hpcERpc3RhbmNlICogMC4zKSwgMS4wKTtcXG59XCIsIFwiXFxuI2RlZmluZSBHTFNMSUZZIDFcXG5cXG52YXJ5aW5nIHZlYzQgdkNvbG9yO1xcbnZvaWQgbWFpbigpIHtcXG4gIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4yLCAwLjMsIDAuMywgMC4xKSArIHZDb2xvcjtcXG59XCIsIFt7XCJuYW1lXCI6XCJzaGlwUG9zaXRpb25cIixcInR5cGVcIjpcInZlYzNcIn0se1wibmFtZVwiOlwic2hpcFZlbG9jaXR5XCIsXCJ0eXBlXCI6XCJ2ZWMzXCJ9XSwgW3tcIm5hbWVcIjpcInRpbWVcIixcInR5cGVcIjpcImZsb2F0XCJ9XSkpO1xuICAgIHNoaXBQb3NpdGlvblVuaWZvcm1zKHBvZW0sIHNoYWRlciwgcG9lbS5zaGlwLnBvc2l0aW9uKTtcbiAgICB2YXIgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuU2hhZGVyTWF0ZXJpYWwoc2hhZGVyKTtcbiAgICB2YXIgZ2VvbWV0cnkgPSBjcmVhdGVXZWJHZW9tZXRyeSg2NCwgMTIsIHBvZW0uciwgcG9lbS5oZWlnaHQpO1xuICAgIHZhciBtZXNoID0gbmV3IFRIUkVFLk1lc2goZ2VvbWV0cnksIG1hdGVyaWFsKTtcbiAgICBtYXRlcmlhbC53aXJlZnJhbWUgPSB0cnVlO1xuICAgIG1hdGVyaWFsLnRyYW5zcGFyZW50ID0gdHJ1ZTtcbiAgICBwb2VtLnNjZW5lLmFkZChtZXNoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViOyIsInZhciBsb2NhbGZvcmFnZSA9IHJlcXVpcmUoJ2xvY2FsZm9yYWdlJyk7XG52YXIgbGV2ZWxzID0gcmVxdWlyZSgnLi4vbGV2ZWxzJyk7XG52YXIgc2NvcmVzID0ge307XG52YXIgRXZlbnREaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG5cbmZ1bmN0aW9uIGRpc3BhdGNoQ2hhbmdlKCkge1xuXHRcblx0ZXhwb3J0cy5kaXNwYXRjaCh7XG5cdFx0dHlwZTogXCJjaGFuZ2VcIixcblx0XHRzY29yZXM6IHNjb3Jlc1xuXHR9KTtcblx0XG59XG5cbmZ1bmN0aW9uIGlzUmVhbE51bWJlciggbnVtYmVyICkge1xuXHRyZXR1cm4gXy5pc051bWJlciggbnVtYmVyICkgJiYgIV8uaXNOYU4oIG51bWJlciApO1xufVxuXG52YXIgZXhwb3J0cyA9IHtcblx0XG5cdGdldCA6IGZ1bmN0aW9uKCBzbHVnICkge1xuXG5cdFx0dmFyIHZhbHVlID0gaXNSZWFsTnVtYmVyKCBzY29yZXNbc2x1Z10gKSA/IHNjb3Jlc1tzbHVnXSA6IDA7XG5cdFx0dmFyIHRvdGFsID0gXy5pc051bWJlciggbGV2ZWxzW3NsdWddLm1heFNjb3JlICkgPyBsZXZlbHNbc2x1Z10ubWF4U2NvcmUgOiAxO1xuXHRcdHZhciB1bml0SSA9IDE7XG5cdFx0XG5cdFx0aWYoIHRvdGFsID4gMCApIHtcblx0XHRcdHVuaXRJID0gdmFsdWUgLyB0b3RhbDtcblx0XHR9XG5cdFx0XG5cdFx0dmFyIHBlcmNlbnQgPSBNYXRoLnJvdW5kKHVuaXRJICogMTAwKTtcblx0XHRcblx0XHR2YXIgb2JqID0ge1xuXHRcdFx0dmFsdWVcdDogdmFsdWUsXG5cdFx0XHR0b3RhbFx0OiB0b3RhbCxcblx0XHRcdHVuaXRJXHQ6IHVuaXRJLFxuXHRcdFx0cGVyY2VudFx0OiBwZXJjZW50XG5cdFx0fTtcblx0XHRcblx0XHRfLmVhY2goIG9iaiwgZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRpZiggXy5pc05hTiggdmFsICkgKSB7XG5cdFx0XHRcdGRlYnVnZ2VyO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiBvYmo7XG5cdFx0XG5cdH0sXG5cdFxuXHRzZXQgOiBmdW5jdGlvbiggc2x1Zywgc2NvcmUgKSB7XG5cdFx0XG5cdFx0aWYoIGlzUmVhbE51bWJlciggc2NvcmUgKSApIHtcblx0XHRcdFxuXHRcdFx0Ly9Pbmx5IHNhdmUgdGhlIGhpZ2hlciBzY29yZVxuXHRcdFx0XG5cdFx0XHRzY29yZXNbc2x1Z10gPSBpc1JlYWxOdW1iZXIoIHNjb3Jlc1tzbHVnXSApID9cblx0XHRcdFx0TWF0aC5tYXgoIHNjb3Jlc1tzbHVnXSwgc2NvcmUgKSA6XG5cdFx0XHRcdHNjb3JlXG5cdFx0XHQ7XG5cdFx0XHRsb2NhbGZvcmFnZS5zZXRJdGVtKCAnc2NvcmVzJywgc2NvcmVzICk7XG5cdFx0XHRkaXNwYXRjaENoYW5nZSgpO1xuXHRcdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0cmVzZXQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHRzY29yZXMgPSB7fTtcblx0XHRsb2NhbGZvcmFnZS5zZXRJdGVtKCAnc2NvcmVzJywgc2NvcmVzICk7XG5cdFx0ZGlzcGF0Y2hDaGFuZ2UoKTtcblx0XHRcblx0fVxuXHRcdFxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggZXhwb3J0cyApO1xuXG4oZnVuY3Rpb24oKSB7XG5cdFxuXHRsb2NhbGZvcmFnZS5nZXRJdGVtKCdzY29yZXMnLCBmdW5jdGlvbiggZXJyLCB2YWx1ZSApIHtcblx0XG5cdFx0aWYoZXJyKSByZXR1cm47XG5cdFx0c2NvcmVzID0gXy5pc09iamVjdCggdmFsdWUgKSA/IHZhbHVlIDoge307XG5cdFx0XG5cdFx0ZGlzcGF0Y2hDaGFuZ2UoKTtcblx0XHRcblx0fSk7XHRcblx0XG59KSgpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0czsiLCJ2YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tJyk7XG52YXIgZGVzdHJveU1lc2ggPSByZXF1aXJlKCcuLi91dGlscy9kZXN0cm95TWVzaCcpO1xudmFyIHR3b8+AID0gTWF0aC5QSSAqIDI7XG52YXIgY29sb3IgPSAweEJDNDkyQTtcblxudmFyIEFyYWNobmlkID0gZnVuY3Rpb24oIHBvZW0sIG1hbmFnZXIsIHgsIHkgKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXG5cdHRoaXMubmFtZSA9IFwiQXJhY2huaWRcIjtcblx0dGhpcy5jb2xvciA9IDB4QkM0OTJBO1xuXHR0aGlzLmNzc0NvbG9yID0gXCIjQkM0OTJBXCI7XG5cdHRoaXMubGluZXdpZHRoID0gMiAqIHRoaXMucG9lbS5yYXRpbztcblx0dGhpcy5zY29yZVZhbHVlID0gMjM7XG5cblx0dGhpcy5zcGF3blBvaW50ID0gbmV3IFRIUkVFLlZlY3RvcjIoeCx5KTtcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdFxuXHR0aGlzLmRlYWQgPSBmYWxzZTtcblxuXHR0aGlzLnNwZWVkID0gMDtcblxuXHR0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQgPSAwLjA0O1xuXHR0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZCA9IDAuMDAxO1xuXG5cdHRoaXMudGhydXN0U3BlZWQgPSAwLjU7XG5cdHRoaXMudGhydXN0ID0gMDtcblxuXHR0aGlzLmJhbmtTcGVlZCA9IDAuMDM7XG5cdHRoaXMuYmFuayA9IDA7XG5cdHRoaXMubWF4U3BlZWQgPSAxMDAwO1xuXHRcblx0dGhpcy5yYWRpdXMgPSAzO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdFxuXHR0aGlzLmhhbmRsZVVwZGF0ZSA9IHRoaXMudXBkYXRlLmJpbmQodGhpcyk7XG5cdHRoaXMubWFuYWdlci5vbigndXBkYXRlJywgdGhpcy5oYW5kbGVVcGRhdGUgKTtcblx0XG5cdGlmKCAhXy5pc09iamVjdCggdGhpcy5wb2VtLnNwaWRlcmxpbmdzICkgKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKFwiQXJhY2huaWRzIHJlcXVpcmUgc3BpZGVybGluZ3NcIik7XG5cdH1cblx0XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcmFjaG5pZDtcblxuQXJhY2huaWQucHJvdG90eXBlID0ge1xuXHRcblx0ZGFtYWdlU2V0dGluZ3MgOiB7XG5cdFx0Y29sb3I6IDB4QkM0OTJBLFxuXHRcdHRyYW5zcGFyZW50OiB0cnVlLFxuXHRcdG9wYWNpdHk6IDAuNSxcblx0XHRyZXRhaW5FeHBsb3Npb25zQ291bnQ6IDMsXG5cdFx0cGVyRXhwbG9zaW9uOiAyMFxuXHR9LFxuXHRcblx0aW5pdFNoYXJlZEFzc2V0cyA6IGZ1bmN0aW9uKCBtYW5hZ2VyICkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSA9IHRoaXMuY3JlYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHRtYW5hZ2VyLnNoYXJlZC5nZW9tZXRyeSA9IGdlb21ldHJ5O1xuXHRcdFxuXHRcdG1hbmFnZXIub24oJ3VwZGF0ZScsIEFyYWNobmlkLnByb3RvdHlwZS51cGRhdGVHZW9tZXRyeSggZ2VvbWV0cnkgKSApO1xuXHR9LFxuXHRcblx0dXBkYXRlR2VvbWV0cnkgOiBmdW5jdGlvbiggZ2VvbWV0cnkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGUgKSB7XG5cdFx0XHRcblx0XHRcdF8uZWFjaCggZ2VvbWV0cnkud2F2ZXlWZXJ0cywgZnVuY3Rpb24oIHZlYyApIHtcblx0XHRcdFx0dmVjLnkgPSAwLjggKiBNYXRoLnNpbiggZS50aW1lIC8gMTAwICsgdmVjLnggKSArIHZlYy5vcmlnaW5hbC55O1xuXHRcdFx0fSk7XG5cdFx0XHRcblx0XHRcdFxuXHRcdFx0XG5cdFx0fTtcblx0fSxcblxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dmVydHMgPSBbWzM3My45MDAsMjQ5LjIwMF0sIFs0NjYuMDAwLDE5MS42MDBdLCBbNTU2LjcwMCwzMTQuMjAwXSwgWzU1Ni42MDAsMjU0LjAwMF0sIFs0NTQuOTAwLDEzOC44MDBdLCBbMzYxLjQwMCwyMDMuMjAwXSwgWzM1NC44MDAsMTg3LjYwMF0sIFszNDQuMzAwLDE3Ni44MDBdLCBbMzMyLjgwMCwxNzAuOTAwXSwgWzMxOS4wMDAsMTY4LjcwMF0sIFszMDMuMzAwLDE3MS42MDBdLCBbMjkxLjQwMCwxNzguNjAwXSwgWzI4Mi42MDAsMTg4LjYwMF0sIFsyNzYuNjAwLDIwMy41MDBdLCBbMTgyLjgwMCwxMzguODAwXSwgWzgxLjAwMCwyNTQuMDAwXSwgWzgwLjkwMCwzMTQuMjAwXSwgWzE3MS42MDAsMTkxLjYwMF0sIFsyNjMuNzAwLDI0OS4yMDBdLCBbMTYzLjYwMCwyNDcuMzAwXSwgWzkxLjYwMCwzNTQuNjAwXSwgWzExNy42MDAsNDIzLjMwMF0sIFsxNjkuMDAwLDI5MC4wMDBdLCBbMjUyLjMwMCwyODYuNzAwXSwgWzE4Ni40MDAsMzIxLjQwMF0sIFsxNDkuNzAwLDQ0NC43MDBdLCBbMTgzLjAwMCw0OTguNzAwXSwgWzIwNy4zMDAsMzQ1LjkwMF0sIFsyNTIuMzAwLDMyNi4xMDBdLCBbMjMxLjcwMCwzNzIuODAwXSwgWzI1OS4wMDAsNDE3LjQwMF0sIFsyOTQuMDAwLDQyOC43MDBdLCBbMjYxLjEwMCwzNzYuNTAwXSwgWzI5NS4wMDAsMzIyLjYwMF0sIFszMTkuMDAwLDMxNi4xMDBdLCBbMzE5LjAwMCwzMTYuMTAwXSwgWzM0Mi44MDAsMzIyLjYwMF0sIFszNzYuNTAwLDM3Ni41MDBdLCBbMzQzLjYwMCw0MjguNzAwXSwgWzM3OC42MDAsNDE3LjQwMF0sIFs0MDUuOTAwLDM3Mi44MDBdLCBbMzg1LjMwMCwzMjYuMDAwXSwgWzQzMC4zMDAsMzQ1LjgwMF0sIFs0NTQuNjAwLDQ5OC42MDBdLCBbNDg3LjkwMCw0NDQuNjAwXSwgWzQ1MS4yMDAsMzIxLjMwMF0sIFszODUuMzAwLDI4Ni42MDBdLCBbNDY4LjYwMCwyODkuOTAwXSwgWzUxOS45MDAsNDIzLjIwMF0sIFs1NDUuOTAwLDM1NC41MDBdLCBbNDczLjkwMCwyNDcuMjAwXSwgWzM3My45MDAsMjQ5LjIwMF1dO1xuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcblx0XHR9LCBbIDAsIDAgXSk7XG5cdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0Z2VvbWV0cnkud2F2ZXlWZXJ0cyA9IFtdO1xuXHRcblx0XHRnZW9tZXRyeS52ZXJ0aWNlcyA9IF8ubWFwKCB2ZXJ0cywgZnVuY3Rpb24oIHZlYzIgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBzY2FsZSA9IDEgLyAzMjtcblx0XHRcdHZhciB2ZWMzID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR2ZWMzLm9yaWdpbmFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KCB2ZWMzICk7XG5cdFx0XHRcblx0XHRcdGlmKCB2ZWMyWzBdID4gNDAwIHx8IHZlYzJbMF0gPCAyMDAgKSB7XG5cdFx0XHRcdGdlb21ldHJ5LndhdmV5VmVydHMucHVzaCggdmVjMyApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdmVjMztcblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFxuXHR9LFxuXG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLm1hbmFnZXIuc2hhcmVkLmdlb21ldHJ5O1xuXHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTGluZShcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bGluZU1hdGVyaWFsLFxuXHRcdFx0VEhSRUUuTGluZVN0cmlwXG5cdFx0KTtcblx0XHR0aGlzLm9iamVjdC5zY2FsZS5tdWx0aXBseVNjYWxhciggMC42ICk7XG5cdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueiArPSB0aGlzLnBvZW0ucjtcblx0XG5cdFx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0dGhpcy5yZXNldCgpO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLnBvbGFyT2JqICk7XG5cdFx0dGhpcy5wb2VtLm9uKCAnZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdH0sXG5cblx0a2lsbCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZGVhZCA9IHRydWU7XG5cdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuZGFtYWdlLmV4cGxvZGUoIHRoaXMucG9zaXRpb24gKTtcblxuXHRcdHZhciBzcGlkZXJsaW5ncyA9IHJhbmRvbS5yYW5nZUludCggMiwgNSApO1xuXHRcdHZhciBzaGlwVGhldGEgPSBNYXRoLmF0YW4yKFxuXHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueSAtIHRoaXMucG9zaXRpb24ueSxcblx0XHRcdHRoaXMucG9lbS5jb29yZGluYXRlcy5rZWVwRGlmZkluUmFuZ2UoXG5cdFx0XHRcdHRoaXMucG9lbS5zaGlwLnBvc2l0aW9uLnggLSB0aGlzLnBvc2l0aW9uLnhcblx0XHRcdClcblx0XHQpO1xuXHRcdFxuXHRcdFxuXHRcdHZhciBzcGlkZXJsaW5nVGhldGE7XG5cdFx0XG5cdFx0dmFyIHRoZXRhU3ByZWFkID0gTWF0aC5QSSAqIDAuMjU7XG5cdFx0dmFyIHRoZXRhU3RlcCA9IHRoZXRhU3ByZWFkIC8gc3BpZGVybGluZ3M7XG5cdFx0dmFyIHJldmVyc2VTaGlwVGhldGEgPSBzaGlwVGhldGEgKyBNYXRoLlBJO1xuXG5cdFx0Zm9yKCB2YXIgaT0wOyBpIDwgc3BpZGVybGluZ3M7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLnNwaWRlcmxpbmdzLmFkZChcblx0XHRcdFx0dGhpcy5wb3NpdGlvbi54LFxuXHRcdFx0XHR0aGlzLnBvc2l0aW9uLnksXG5cdFx0XHRcdHJldmVyc2VTaGlwVGhldGEgKyByYW5kb20ucmFuZ2UoMCwgMSkgKiAoaSAqIHRoZXRhU3RlcCAtICh0aGV0YVNwcmVhZCAvIDIpIClcblx0XHRcdCk7XG5cdFx0XHRcblx0XHR9XG5cdH0sXG5cblx0cmVzZXQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnBvc2l0aW9uLmNvcHkoIHRoaXMuc3Bhd25Qb2ludCApO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0aWYoIHRoaXMuZGVhZCApIHtcblx0XHRcblx0XHRcdHRoaXMuZGFtYWdlLnVwZGF0ZSggZSApO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dGhpcy5iYW5rICo9IDAuOTtcblx0XHRcdHRoaXMudGhydXN0ID0gMC4wMTtcblx0XHRcdHRoaXMuYmFuayArPSByYW5kb20ucmFuZ2UoLTAuMDEsIDAuMDEpO1xuXHRcdFxuXHRcdFx0dGhpcy5vYmplY3QuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcblx0XHRcblx0XHRcdHRoaXMudXBkYXRlRWRnZUF2b2lkYW5jZSggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZSApO1xuXHRcdFxuXHRcdH1cblxuXHR9LFxuXHRcblx0dXBkYXRlRWRnZUF2b2lkYW5jZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgbmVhckVkZ2UsIGZhckVkZ2UsIHBvc2l0aW9uLCBub3JtYWxpemVkRWRnZVBvc2l0aW9uLCBiYW5rRGlyZWN0aW9uLCBhYnNQb3NpdGlvbjtcblx0XG5cdFx0ZmFyRWRnZSA9IHRoaXMucG9lbS5oZWlnaHQgLyAyO1xuXHRcdG5lYXJFZGdlID0gNCAvIDUgKiBmYXJFZGdlO1xuXHRcdHBvc2l0aW9uID0gdGhpcy5vYmplY3QucG9zaXRpb24ueTtcblx0XHRhYnNQb3NpdGlvbiA9IE1hdGguYWJzKCBwb3NpdGlvbiApO1xuXG5cdFx0dmFyIHJvdGF0aW9uID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiAvIE1hdGguUEk7XG5cblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICU9IDIgKiBNYXRoLlBJO1xuXHRcblx0XHRpZiggdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IDAgKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IDIgKiBNYXRoLlBJO1xuXHRcdH1cblx0XG5cdFx0aWYoIE1hdGguYWJzKCBwb3NpdGlvbiApID4gbmVhckVkZ2UgKSB7XG5cdFx0XG5cdFx0XHR2YXIgaXNQb2ludGluZ0xlZnQgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56ID49IE1hdGguUEkgKiAwLjUgJiYgdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IE1hdGguUEkgKiAxLjU7XG5cdFx0XG5cdFx0XHRpZiggcG9zaXRpb24gPiAwICkge1xuXHRcdFx0XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcblx0XHRcdG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gPSAoYWJzUG9zaXRpb24gLSBuZWFyRWRnZSkgLyAoZmFyRWRnZSAtIG5lYXJFZGdlKTtcblx0XHRcdHRoaXMudGhydXN0ICs9IG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZDtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gYmFua0RpcmVjdGlvbiAqIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQ7XG5cdFx0XG5cdFx0fVxuXHRcblx0fSxcblxuXHR1cGRhdGVQb3NpdGlvbiA6IGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgbW92ZW1lbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFxuXHRcdFx0dmFyIHRoZXRhLCB4LCB5O1xuXHRcdFxuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLmJhbms7XG5cdFx0XHRcblx0XHRcdHRoZXRhID0gdGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XHRcblx0XHRcdHRoaXMuc3BlZWQgKj0gMC45ODtcblx0XHRcdHRoaXMuc3BlZWQgKz0gdGhpcy50aHJ1c3Q7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5taW4oIHRoaXMubWF4U3BlZWQsIHRoaXMuc3BlZWQgKTtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1heCggMCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0XHRcdFxuXHRcdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQgKiBNYXRoLmNvcyggdGhldGEgKTtcblx0XHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkICogTWF0aC5zaW4oIHRoZXRhICk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb3NpdGlvbi55O1xuXHRcdFxuXHRcdFx0Ly9Qb2xhciBjb29yZGluYXRlc1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueCA9IE1hdGguY29zKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdC8vIHRoaXMub2JqZWN0LnBvc2l0aW9uLnogPSBNYXRoLnNpbiggdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFxuXHRcdH07XG5cdFxuXHR9KClcdFxuXG5cbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG52YXIgZGVzdHJveU1lc2ggPSByZXF1aXJlKCcuLi91dGlscy9kZXN0cm95TWVzaCcpO1xuXG52YXIgQXN0ZXJvaWQgPSBmdW5jdGlvbiggcG9lbSwgeCwgeSwgcmFkaXVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHRcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5cdHRoaXMucG9zaXRpb24ueCA9IHggfHwgMDtcblx0dGhpcy5wb3NpdGlvbi55ID0geSB8fCAwO1xuXHR0aGlzLm9zY2lsbGF0aW9uID0gMDtcblx0dGhpcy5yYWRpdXMgPSByYWRpdXMgfHwgNTtcblx0dGhpcy5zcGVlZCA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5cdHRoaXMucm90YXRpb25TcGVlZCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdHRoaXMubWF4U3BlZWQgPSAwLjU7XG5cdHRoaXMubWF4Um90YXRpb25TcGVlZCA9IDAuMTtcblx0dGhpcy5vc2NpbGxhdGlvblNwZWVkID0gNTA7XG5cdHRoaXMuc3Ryb2tlQ29sb3IgPSAweGRkZGRkZDtcblx0dGhpcy5maWxsQ29sb3IgPSAweGZmZmZmZjtcblx0dGhpcy5hZGRPYmplY3QoeCwgeSk7XG5cdHRoaXMudXBkYXRlKCk7XG5cdFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBc3Rlcm9pZDtcblxuQXN0ZXJvaWQucHJvdG90eXBlID0ge1xuXG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSA9IG5ldyBUSFJFRS5PY3RhaGVkcm9uR2VvbWV0cnkodGhpcy5yYWRpdXMsIDEpO1xuXHRcdFxuXHRcdC8vRGlzZm9ybVxuXHRcdF8uZWFjaChnZW9tZXRyeS52ZXJ0aWNlcywgZnVuY3Rpb24oIHZlcnRleCApIHtcblx0XHRcdHZlcnRleC54ICs9ICh0aGlzLnJhZGl1cyAvIDIpICogKE1hdGgucmFuZG9tKCkgLSAwLjUpO1xuXHRcdFx0dmVydGV4LnkgKz0gKHRoaXMucmFkaXVzIC8gMikgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cdFx0XHR2ZXJ0ZXgueiArPSAodGhpcy5yYWRpdXMgLyAyKSAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHR2YXIgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOnRoaXMuc3Ryb2tlQ29sb3J9KTtcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5NZXNoKCBnZW9tZXRyeSwgbWF0ZXJpYWwgKTtcblx0XHRcblx0XHR2YXIgb3V0bGluZU1hdCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7Y29sb3I6dGhpcy5maWxsQ29sb3IsIHNpZGU6IFRIUkVFLkJhY2tTaWRlfSk7XG5cdFx0dmFyIG91dGxpbmVPYmogPSBuZXcgVEhSRUUuTWVzaCggZ2VvbWV0cnksIG91dGxpbmVNYXQgKTtcblx0XHRvdXRsaW5lT2JqLnNjYWxlLm11bHRpcGx5U2NhbGFyKCAxLjA1KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5hZGQoIG91dGxpbmVPYmogKTtcblx0XHRcblx0XHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApO1xuXHRcdHRoaXMucG9lbS5vbiggJ2Rlc3Ryb3knLCBkZXN0cm95TWVzaCggdGhpcy5vYmplY3QgKSApO1xuXHRcdFxuXHRcdHRoaXMuc3BlZWQueCA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMubWF4U3BlZWQ7XG5cdFx0dGhpcy5zcGVlZC55ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhTcGVlZDtcblx0XHRcblx0XHR0aGlzLnJvdGF0aW9uU3BlZWQueCA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMubWF4Um90YXRpb25TcGVlZDtcblx0XHR0aGlzLnJvdGF0aW9uU3BlZWQueSA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMubWF4Um90YXRpb25TcGVlZDtcblx0XHR0aGlzLnJvdGF0aW9uU3BlZWQueiA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMubWF4Um90YXRpb25TcGVlZDtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0aW9uID0gTWF0aC5yYW5kb20oKSAqIE1hdGguUEkgKiAyICogdGhpcy5vc2NpbGxhdGlvblNwZWVkO1xuXHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dGhpcy5vc2NpbGxhdGlvbiArPSB0aGlzLnNwZWVkLnk7XG5cdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQueDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgPSBNYXRoLnNpbiggdGhpcy5vc2NpbGxhdGlvbiAvIHRoaXMub3NjaWxsYXRpb25TcGVlZCApICogdGhpcy5wb2VtLmhlaWdodDtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi54ICs9IHRoaXMucm90YXRpb25TcGVlZC54O1x0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueSArPSB0aGlzLnJvdGF0aW9uU3BlZWQueTtcdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gdGhpcy5yb3RhdGlvblNwZWVkLno7XHRcblx0XHRcblx0XHR0aGlzLnBvZW0uY29vcmRpbmF0ZXMuc2V0VmVjdG9yKCB0aGlzLm9iamVjdC5wb3NpdGlvbiwgdGhpcy5wb3NpdGlvbiApO1xuXHR9XG5cdFxufTsiLCJ2YXIgQnVsbGV0ID0gZnVuY3Rpb24oIHBvZW0sIGd1biwgdmVydGV4ICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmd1biA9IGd1bjtcblx0dGhpcy52ZXJ0ZXggPSB2ZXJ0ZXg7XG5cdFxuXHR0aGlzLnNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjIoMCwwKTtcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKDAsMCk7XG5cdHRoaXMucmFkaXVzID0gMTtcblx0XG5cdHRoaXMuYm9ybkF0ID0gMDtcblx0dGhpcy5hbGl2ZSA9IGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCdWxsZXQ7XG5cbkJ1bGxldC5wcm90b3R5cGUgPSB7XG5cdFxuXHRraWxsIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy52ZXJ0ZXguc2V0KDAsIDAgLDEwMDApO1xuXHRcdHRoaXMuYWxpdmUgPSBmYWxzZTtcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdHZhciB4LHksejtcblx0XHRcblx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZC54O1xuXHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkLnk7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLmNvb3JkaW5hdGVzLnNldFZlY3RvciggdGhpcy52ZXJ0ZXgsIHRoaXMucG9zaXRpb24gKTtcblx0XHRcblx0fSxcblx0XG5cdGZpcmUgOiBmdW5jdGlvbih4LCB5LCBzcGVlZCwgdGhldGEpIHtcblx0XHRcdFx0XG5cdFx0dGhpcy5wb2VtLmNvb3JkaW5hdGVzLnNldFZlY3RvciggdGhpcy52ZXJ0ZXgsIHgsIHkgKTtcblx0XHRcblx0XHR0aGlzLnBvc2l0aW9uLnNldCh4LHkpO1xuXHRcdFxuXHRcdHRoaXMuc3BlZWQueCA9IE1hdGguY29zKCB0aGV0YSApICogc3BlZWQ7XG5cdFx0dGhpcy5zcGVlZC55ID0gTWF0aC5zaW4oIHRoZXRhICkgKiBzcGVlZDtcblx0XHRcblx0XHR0aGlzLmJvcm5BdCA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHRcdHRoaXMuYWxpdmUgPSB0cnVlO1xuXHRcdFxuXHR9XG59OyIsInZhciBEYW1hZ2UgPSByZXF1aXJlKCcuLi9jb21wb25lbnRzL0RhbWFnZScpO1xudmFyIHJhbmRvbSA9IHJlcXVpcmUoJy4uL3V0aWxzL3JhbmRvbScpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcbnZhciBjb2xvciA9IDB4Y2IzNmVhO1xuXG52YXIgSmVsbHlzaGlwID0gZnVuY3Rpb24oIHBvZW0sIG1hbmFnZXIsIHgsIHkgKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXG5cdHRoaXMubmFtZSA9IFwiSmVsbHlzaGlwXCI7XG5cdHRoaXMuY29sb3IgPSBjb2xvcjtcblx0dGhpcy5jc3NDb2xvciA9IFwiI0NCMzZFQVwiO1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMuc2NvcmVWYWx1ZSA9IDEzO1xuXG5cdHRoaXMuc3Bhd25Qb2ludCA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMih4LHkpO1xuXHRcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cblx0dGhpcy5zcGVlZCA9IDA7XG5cblx0dGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkID0gMC4wNDtcblx0dGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQgPSAwLjAwMTtcblxuXHR0aGlzLnRocnVzdFNwZWVkID0gMTtcblx0dGhpcy50aHJ1c3QgPSAwO1xuXG5cdHRoaXMuYmFua1NwZWVkID0gMC4wNjtcblx0dGhpcy5iYW5rID0gMDtcblx0dGhpcy5tYXhTcGVlZCA9IDEwMDA7XG5cdFxuXHR0aGlzLnJhZGl1cyA9IDM7XG5cblx0dGhpcy5hZGRPYmplY3QoKTtcblx0XG5cdHRoaXMuaGFuZGxlVXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKTtcblx0dGhpcy5tYW5hZ2VyLm9uKCd1cGRhdGUnLCB0aGlzLmhhbmRsZVVwZGF0ZSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSmVsbHlzaGlwO1xuXG5KZWxseXNoaXAucHJvdG90eXBlID0ge1xuXHRcblx0ZGFtYWdlU2V0dGluZ3MgOiB7XG5cdFx0Y29sb3I6IDB4Y2IzNmVhXG5cdH0sXG5cdFxuXHRpbml0U2hhcmVkQXNzZXRzIDogZnVuY3Rpb24oIG1hbmFnZXIgKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeSgpO1xuXHRcdFxuXHRcdG1hbmFnZXIuc2hhcmVkLmdlb21ldHJ5ID0gZ2VvbWV0cnk7XG5cdFx0XG5cdFx0bWFuYWdlci5vbigndXBkYXRlJywgSmVsbHlzaGlwLnByb3RvdHlwZS51cGRhdGVXYXZleVZlcnRzKCBnZW9tZXRyeSApICk7XG5cdH0sXG5cdFxuXHR1cGRhdGVXYXZleVZlcnRzIDogZnVuY3Rpb24oIGdlb21ldHJ5ICkge1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlICkge1xuXHRcdFx0XG5cdFx0XHRfLmVhY2goIGdlb21ldHJ5LndhdmV5VmVydHMsIGZ1bmN0aW9uKCB2ZWMgKSB7XG5cdFx0XHRcdHZlYy55ID0gMC44ICogTWF0aC5zaW4oIGUudGltZSAvIDEwMCArIHZlYy54ICkgKyB2ZWMub3JpZ2luYWwueTtcblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0fTtcblx0fSxcblxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0LyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuXHRcdHZlcnRzID0gWyBbMzU1LjcsMjExLjddLCBbMzc1LjgsMTk1LjldLCBbMzY4LjUsMTU1LjRdLCBbMzYxLjQsMTkwLjhdLCBbMzQxLjMsMjA1LjldLCBbMzIwLjQsMjAxLjhdLCBbMjk4LjksMjA2XSwgWzI3OC42LDE5MC44XSwgXG5cdFx0XHRbMjcxLjUsMTU1LjRdLCBbMjY0LjIsMTk1LjldLCBbMjg0LjcsMjEyXSwgWzI1OC4zLDIzOS4yXSwgWzI0Mi4zLDIyOC41XSwgWzIzOC4zLDE2OC45XSwgWzIyNi4xLDIzNy4xXSwgWzI0Ni43LDI2Ni4yXSwgWzIzMy43LDMxNi40XSwgWzI1OS4yLDMyMS4yXSwgXG5cdFx0XHRbMjU3LjEsMzMxLjNdLCBbMjU0LjksMzQyLjNdLCBbMjUyLjgsMzUyLjldLCBbMjUwLjUsMzY0LjVdLCBbMjQ4LjIsMzc1LjddLCBbMjQ2LjEsMzg2LjJdLCBbMjQzLjgsMzk3LjddLCBbMjQxLjMsNDEwLjNdLCBbMjM5LjUsNDE5LjNdLCBbMjM3LjQsNDI5LjZdLCBcblx0XHRcdFsyNTMuMSw0MzIuN10sIFsyNTQuOSw0MjMuN10sIFsyNTYuOSw0MTQuMV0sIFsyNTkuMyw0MDEuOF0sIFsyNjEuNiwzOTAuMl0sIFsyNjMuNywzODAuMV0sIFsyNjYuMSwzNjcuOF0sIFsyNjguMywzNTYuOV0sIFsyNzAuNiwzNDUuNl0sIFsyNzIuNywzMzUuMV0sIFxuXHRcdFx0WzI3NC45LDMyNC4yXSwgWzI5MywzMjcuNl0sIFsyOTIuNiwzMzYuNV0sIFsyOTIuMiwzNDhdLCBbMjkxLjcsMzU5LjZdLCBbMjkxLjIsMzcxLjVdLCBbMjkwLjcsMzgyLjVdLCBbMjkwLjMsMzkzLjZdLCBbMjg5LjgsNDA1LjFdLCBbMjg5LjUsNDE0LjFdLCBbMjg5LDQyNS42XSwgXG5cdFx0XHRbMjg4LjUsNDM3XSwgWzI4OC4xLDQ0OC41XSwgWzI4Ny42LDQ1OS41XSwgWzI4Ny4xLDQ3MS41XSwgWzI4Ni42LDQ4NF0sIFszMDIuNiw0ODQuNl0sIFszMDMuMSw0NzMuNV0sIFszMDMuNiw0NjEuNV0sIFszMDQuMSw0NDguNV0sIFszMDQuNSw0MzguNV0sIFszMDUsNDI1LjFdLCBcblx0XHRcdFszMDUuNCw0MTYuMV0sIFszMDUuOSw0MDVdLCBbMzA2LjIsMzk1LjVdLCBbMzA2LjYsMzg2XSwgWzMwNy4xLDM3M10sIFszMDcuNiwzNjFdLCBbMzA4LjIsMzQ3LjVdLCBbMzA4LjUsMzM4LjVdLCBbMzA4LjksMzMwLjZdLCBbMzMxLjEsMzMwLjhdLCBbMzMxLjQsMzM2LjVdLCBcblx0XHRcdFszMzEuNywzNDRdLCBbMzMyLDM1M10sIFszMzIuNSwzNjQuNV0sIFszMzMsMzc2XSwgWzMzMy40LDM4Ny41XSwgWzMzMy45LDM5OC41XSwgWzMzNC40LDQxMC41XSwgWzMzNC45LDQyMi40XSwgWzMzNS40LDQzN10sIFszMzYsNDUwXSwgWzMzNi40LDQ2MF0sIFszMzYuOCw0NzFdLCBcblx0XHRcdFszMzcuNCw0ODQuNl0sIFszNTMuNCw0ODRdLCBbMzUyLjgsNDcxXSwgWzM1Mi4zLDQ1Ny41XSwgWzM1MS45LDQ0OF0sIFszNTEuNSw0MzcuNV0sIFszNTAuOSw0MjNdLCBbMzUwLjQsNDEwLjVdLCBbMzQ5LjgsMzk2LjVdLCBbMzQ5LjQsMzg1LjVdLCBbMzQ4LjksMzc0LjRdLCBcblx0XHRcdFszNDguNSwzNjMuNF0sIFszNDgsMzUyXSwgWzM0Ny42LDM0M10sIFszNDcuMywzMzRdLCBbMzQ3LDMyNy44XSwgWzM2NS4xLDMyNC4zXSwgWzM2Ni42LDMzMS43XSwgWzM2OC4yLDMzOS42XSwgWzM3MC4yLDM0OS41XSwgWzM3MS45LDM1Ny44XSwgWzM3My42LDM2Ni44XSwgXG5cdFx0XHRbMzc1LjQsMzc1LjRdLCBbMzc3LjEsMzg0XSwgWzM3OSwzOTMuNV0sIFszODEuMiw0MDQuNl0sIFszODMuMSw0MTRdLCBbMzg0LjksNDIyLjhdLCBbMzg2LjksNDMyLjddLCBbNDAyLjYsNDI5LjZdLCBbNDAwLjYsNDE5LjZdLCBbMzk5LjEsNDEyLjVdLCBbMzk3LjEsNDAyLjVdLCBcblx0XHRcdFszOTQuNywzOTAuMl0sIFszOTMuMSwzODIuNl0sIFszOTEuNCwzNzRdLCBbMzg5LjYsMzY1XSwgWzM4Ny42LDM1NS4xXSwgWzM4NiwzNDcuMl0sIFszODQuMSwzMzcuN10sIFszODIuNywzMzAuNl0sIFszODAuOSwzMjEuNF0sIFs0MDcsMzE2LjRdLCBbMzkzLjgsMjY1LjVdLCBcblx0XHRcdFs0MTMuOSwyMzcuMV0sIFs0MDEuNywxNjguOV0sIFszOTcuNywyMjguNV0sIFszODIuMSwyMzguOV0sIFszNTUuOSwyMTEuOF0gXTtcblx0XHQvKiBqc2hpbnQgaWdub3JlOmVuZCAqL1xuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcblx0XHR9LCBbIDAsIDAgXSk7XG5cdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0Z2VvbWV0cnkud2F2ZXlWZXJ0cyA9IFtdO1xuXHRcblx0XHRnZW9tZXRyeS52ZXJ0aWNlcyA9IF8ubWFwKCB2ZXJ0cywgZnVuY3Rpb24oIHZlYzIgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBzY2FsZSA9IDEgLyAzMjtcblx0XHRcdHZhciB2ZWMzID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR2ZWMzLm9yaWdpbmFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KCB2ZWMzICk7XG5cdFx0XHRcblx0XHRcdGlmKCB2ZWMyWzFdID4gMzMwLjggKSB7XG5cdFx0XHRcdGdlb21ldHJ5LndhdmV5VmVydHMucHVzaCggdmVjMyApO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdmVjMztcblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFxuXHR9LFxuXG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLm1hbmFnZXIuc2hhcmVkLmdlb21ldHJ5O1xuXHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTGluZShcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bGluZU1hdGVyaWFsLFxuXHRcdFx0VEhSRUUuTGluZVN0cmlwXG5cdFx0KTtcblx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi56ICs9IHRoaXMucG9lbS5yO1xuXHRcblx0XHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0dGhpcy5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0XHR0aGlzLnBvZW0ub24oICdkZXN0cm95JywgZGVzdHJveU1lc2goIHRoaXMub2JqZWN0ICkgKTtcblx0fSxcblxuXHRraWxsIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5kZWFkID0gdHJ1ZTtcblx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gZmFsc2U7XG5cdFx0dGhpcy5kYW1hZ2UuZXhwbG9kZSggdGhpcy5wb3NpdGlvbiApO1xuXHR9LFxuXG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi5jb3B5KCB0aGlzLnNwYXduUG9pbnQgKTtcblx0XHR0aGlzLnNwZWVkID0gMC4yO1xuXHRcdHRoaXMuYmFuayA9IDA7XG5cdFx0Ly90aGlzLm9iamVjdC5yb3RhdGlvbi56ID0gTWF0aC5QSSAqIDAuMjU7XHRcdFxuXHR9LFxuXG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdGlmKCB0aGlzLmRlYWQgKSB7XG5cdFx0XG5cdFx0XHR0aGlzLmRhbWFnZS51cGRhdGUoIGUgKTtcblx0XHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRcblx0XHRcdHRoaXMuYmFuayAqPSAwLjk7XG5cdFx0XHR0aGlzLnRocnVzdCA9IDAuMDE7XG5cdFx0XHR0aGlzLmJhbmsgKz0gcmFuZG9tLnJhbmdlKC0wLjAxLCAwLjAxKTtcblx0XHRcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZUVkZ2VBdm9pZGFuY2UoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlUG9zaXRpb24oIGUgKTtcblx0XHRcblx0XHR9XG5cblx0fSxcblxuXHR1cGRhdGVFZGdlQXZvaWRhbmNlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFxuXHRcdHZhciBuZWFyRWRnZSwgZmFyRWRnZSwgcG9zaXRpb24sIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24sIGJhbmtEaXJlY3Rpb24sIGFic1Bvc2l0aW9uO1xuXHRcblx0XHRmYXJFZGdlID0gdGhpcy5wb2VtLmhlaWdodCAvIDI7XG5cdFx0bmVhckVkZ2UgPSA0IC8gNSAqIGZhckVkZ2U7XG5cdFx0cG9zaXRpb24gPSB0aGlzLm9iamVjdC5wb3NpdGlvbi55O1xuXHRcdGFic1Bvc2l0aW9uID0gTWF0aC5hYnMoIHBvc2l0aW9uICk7XG5cblx0XHR2YXIgcm90YXRpb24gPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56IC8gTWF0aC5QSTtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogJT0gMiAqIE1hdGguUEk7XG5cdFxuXHRcdGlmKCB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgMCApIHtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gMiAqIE1hdGguUEk7XG5cdFx0fVxuXHRcblx0XHRpZiggTWF0aC5hYnMoIHBvc2l0aW9uICkgPiBuZWFyRWRnZSApIHtcblx0XHRcblx0XHRcdHZhciBpc1BvaW50aW5nTGVmdCA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPj0gTWF0aC5QSSAqIDAuNSAmJiB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgTWF0aC5QSSAqIDEuNTtcblx0XHRcblx0XHRcdGlmKCBwb3NpdGlvbiA+IDAgKSB7XG5cdFx0XHRcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFxuXHRcdFx0bm9ybWFsaXplZEVkZ2VQb3NpdGlvbiA9IChhYnNQb3NpdGlvbiAtIG5lYXJFZGdlKSAvIChmYXJFZGdlIC0gbmVhckVkZ2UpO1xuXHRcdFx0dGhpcy50aHJ1c3QgKz0gbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZVRocnVzdFNwZWVkO1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSBiYW5rRGlyZWN0aW9uICogbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZUJhbmtTcGVlZDtcblx0XHRcblx0XHR9XG5cdFxuXHR9LFxuXG5cdHVwZGF0ZVBvc2l0aW9uIDogZnVuY3Rpb24oIGUgKSB7XG5cdFxuXHRcdHZhciBtb3ZlbWVudCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFxuXHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XG5cdFx0XHR2YXIgdGhldGEsIHgsIHk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IHRoaXMuYmFuaztcblx0XHRcblx0XHRcdHRoZXRhID0gdGhpcy5vYmplY3Qucm90YXRpb24uejtcblx0XHRcblx0XHRcdHRoaXMuc3BlZWQgKj0gMC45ODtcblx0XHRcdHRoaXMuc3BlZWQgKz0gdGhpcy50aHJ1c3Q7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5taW4oIHRoaXMubWF4U3BlZWQsIHRoaXMuc3BlZWQgKTtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1heCggMCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0XHRcdFxuXHRcdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQgKiBNYXRoLmNvcyggdGhldGEgKTtcblx0XHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkICogTWF0aC5zaW4oIHRoZXRhICk7XG5cdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi55ID0gdGhpcy5wb3NpdGlvbi55O1xuXHRcdFxuXHRcdFx0Ly9Qb2xhciBjb29yZGluYXRlc1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueCA9IE1hdGguY29zKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdC8vIHRoaXMub2JqZWN0LnBvc2l0aW9uLnogPSBNYXRoLnNpbiggdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFxuXHRcdH07XG5cdFxuXHR9KClcdFxuXG5cbn07IiwidmFyIHJhbmRvbSA9IHJlcXVpcmUoJy4uL3V0aWxzL3JhbmRvbScpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcbnZhciBjb2xvciA9IDB4ZmYwMDAwO1xuXG52YXIgU3BpZGVybGluZyA9IGZ1bmN0aW9uKCBwb2VtLCBtYW5hZ2VyLCB4LCB5LCB0aGV0YSApIHtcblxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuXHR0aGlzLnNjZW5lID0gcG9lbS5zY2VuZTtcblx0dGhpcy5wb2xhck9iaiA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cblx0dGhpcy5uYW1lID0gXCJTcGlkZXJsaW5nXCI7XG5cdHRoaXMuY29sb3IgPSBjb2xvcjtcblx0dGhpcy5jc3NDb2xvciA9IFwiI2ZmMDAwMFwiO1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMuc2NvcmVWYWx1ZSA9IC01O1xuXG5cdHRoaXMuc3Bhd25Qb2ludCA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMih4LHkpO1xuXHR0aGlzLnVuaXREaXJlY3Rpb24gPSBuZXcgVEhSRUUuVmVjdG9yMihcblx0XHRNYXRoLmNvcyggdGhldGEgKSxcblx0XHRNYXRoLnNpbiggdGhldGEgKVxuXHQpO1xuXHR0aGlzLmxpc3QgPSByYW5kb20ucmFuZ2UoIC1NYXRoLlBJIC8gOCwgTWF0aC5QSSAvIDggKTtcblx0XG5cdHRoaXMuZGVhZCA9IGZhbHNlO1xuXG5cdFxuXG5cdHRoaXMuc3BlZWQgPSAwLjAyO1xuXHRcblx0dGhpcy5yYWRpdXMgPSAxLjU7XG5cdHRoaXMudGhldGFKaXR0ZXIgPSByYW5kb20ucmFuZ2UoIC1NYXRoLlBJICogMC4yLCBNYXRoLlBJICogMC4yICk7XG5cblx0dGhpcy5hZGRPYmplY3QoKTtcblx0dGhpcy5kYW1hZ2UgPSBtYW5hZ2VyLmRhbWFnZTtcblx0XG5cdHRoaXMuaGFuZGxlVXBkYXRlID0gdGhpcy51cGRhdGUuYmluZCh0aGlzKTtcblx0dGhpcy5tYW5hZ2VyLm9uKCd1cGRhdGUnLCB0aGlzLmhhbmRsZVVwZGF0ZSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3BpZGVybGluZztcblxuU3BpZGVybGluZy5wcm90b3R5cGUgPSB7XG5cdFxuXHRkYW1hZ2VTZXR0aW5ncyA6IHtcblx0XHRjb2xvcjogY29sb3IsXG5cdFx0dHJhbnNwYXJlbnQ6IHRydWUsXG5cdFx0b3BhY2l0eTogMC41LFxuXHRcdHJldGFpbkV4cGxvc2lvbnNDb3VudDogMyxcblx0XHRwZXJFeHBsb3Npb246IDVcblx0fSxcblx0XG5cdGluaXRTaGFyZWRBc3NldHMgOiBmdW5jdGlvbiggbWFuYWdlciApIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnkgPSB0aGlzLmNyZWF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0bWFuYWdlci5zaGFyZWQuZ2VvbWV0cnkgPSBnZW9tZXRyeTtcblx0XHRcblx0XHRtYW5hZ2VyLm9uKCd1cGRhdGUnLCBTcGlkZXJsaW5nLnByb3RvdHlwZS51cGRhdGVHZW9tZXRyeSggZ2VvbWV0cnkgKSApO1xuXHR9LFxuXHRcblx0dXBkYXRlR2VvbWV0cnkgOiBmdW5jdGlvbiggZ2VvbWV0cnkgKSB7XG5cblx0XHRyZXR1cm4gZnVuY3Rpb24oIGUgKSB7XG5cblx0XHRcdHZhciB0aW1lID0gKGUudGltZSAvIDEwMCk7XG5cdFx0XHR2YXIgaW50ZXJ2YWwgPSBNYXRoLlBJICogNiAvIGdlb21ldHJ5LndhdmV5VmVydHMubGVuZ3RoO1xuXHRcdFx0Xy5lYWNoKCBnZW9tZXRyeS53YXZleVZlcnRzLCBmdW5jdGlvbiggdmVjLCBpICkge1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHVuaXRJID0gTWF0aC5zaW4oIGkgKiBpbnRlcnZhbCArIHRpbWUgKSAqIDAuOCArIDAuMjtcblx0XHRcdFx0XG5cdFx0XHRcdHZlYy54ID0gdW5pdEkgKiB2ZWMub3JpZ2luYWwueDtcblx0XHRcdFx0dmVjLnkgPSB1bml0SSAqIHZlYy5vcmlnaW5hbC55O1xuXHRcdFx0XHRcblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0fTtcblx0fSxcblxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0dmFyIGdlb21ldHJ5LCB2ZXJ0cywgbWFuaGF0dGFuTGVuZ3RoLCBjZW50ZXI7XG5cdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dmFyIHNpZGVzID0gMTY7XG5cdFx0XG5cdFx0dmFyIGluY3JlbWVudCA9IE1hdGguUEkgKiAyIC8gKHNpZGVzLTEpO1xuXHRcdFxuXHRcdC8qIGpzaGludCBpZ25vcmU6c3RhcnQgKi9cblx0XHR2ZXJ0cyA9IF8ubWFwKCBfLnJhbmdlKHNpZGVzKSwgZnVuY3Rpb24oIGkgKSB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRNYXRoLmNvcyggaSAqIGluY3JlbWVudCApICogMixcblx0XHRcdFx0TWF0aC5zaW4oIGkgKiBpbmNyZW1lbnQgKSAqIDJcblx0XHRcdF07XG5cdFx0fSk7XG5cdFx0LyoganNoaW50IGlnbm9yZTplbmQgKi9cblx0XHRcblx0XHRtYW5oYXR0YW5MZW5ndGggPSBfLnJlZHVjZSggdmVydHMsIGZ1bmN0aW9uKCBtZW1vLCB2ZXJ0MmQgKSB7XG5cdFx0XG5cdFx0XHRyZXR1cm4gW21lbW9bMF0gKyB2ZXJ0MmRbMF0sIG1lbW9bMV0gKyB2ZXJ0MmRbMV1dO1xuXHRcdFxuXHRcdH0sIFsgMCwgMCBdKTtcblx0XG5cdFx0Y2VudGVyID0gW1xuXHRcdFx0bWFuaGF0dGFuTGVuZ3RoWzBdIC8gdmVydHMubGVuZ3RoLFxuXHRcdFx0bWFuaGF0dGFuTGVuZ3RoWzFdIC8gdmVydHMubGVuZ3RoXG5cdFx0XTtcblx0XHRcblx0XHRnZW9tZXRyeS53YXZleVZlcnRzID0gW107XG5cdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiwgaSApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHNjYWxlID0gMTtcblx0XHRcdHZhciB2ZWMzID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR2ZWMzLm9yaWdpbmFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KCB2ZWMzICk7XG5cdFx0XHRcblx0XHRcdGlmKCBpICUgMiA9PT0gMCApIHtcblx0XHRcdFx0Z2VvbWV0cnkud2F2ZXlWZXJ0cy5wdXNoKCB2ZWMzICk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHJldHVybiB2ZWMzO1xuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0XG5cdH0sXG5cblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcblx0XHRnZW9tZXRyeSA9IHRoaXMubWFuYWdlci5zaGFyZWQuZ2VvbWV0cnk7XG5cdFx0XHRcblx0XHRsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aFxuXHRcdH0pO1xuXHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnNjYWxlLm11bHRpcGx5U2NhbGFyKCByYW5kb20ucmFuZ2UoIDAuMywgMC44ICkgKTtcblx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi56ICs9IHRoaXMucG9lbS5yO1xuXHRcblx0XHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0dGhpcy5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0XHR0aGlzLnBvZW0ub24oICdkZXN0cm95JywgZGVzdHJveU1lc2goIHRoaXMub2JqZWN0ICkgKTtcblx0fSxcblxuXHRraWxsIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5kZWFkID0gdHJ1ZTtcblx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gZmFsc2U7XG5cdFx0dGhpcy5kYW1hZ2UuZXhwbG9kZSggdGhpcy5wb3NpdGlvbiApO1xuXHR9LFxuXG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi5jb3B5KCB0aGlzLnNwYXduUG9pbnQgKTtcblx0XHR0aGlzLmJhbmsgPSAwO1xuXHRcdC8vdGhpcy5vYmplY3Qucm90YXRpb24ueiA9IE1hdGguUEkgKiAwLjI1O1x0XHRcblx0fSxcblxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0XHR0aGlzLnVwZGF0ZVBvc2l0aW9uKCBlICk7XG5cdFx0fVxuXG5cdH0sXG5cblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbigpIHtcblx0XG5cdFx0dmFyIHVuaXRTZWVrID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0XHR2YXIgdmVsb2NpdHkgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oIGUgKSB7XG5cblx0XHRcdHZhciB0aGV0YSA9IE1hdGguYXRhbjIoXG5cdFx0XHRcdHRoaXMucG9lbS5zaGlwLnBvc2l0aW9uLnkgLSB0aGlzLnBvc2l0aW9uLnksXG5cdFx0XHRcdHRoaXMucG9lbS5jb29yZGluYXRlcy5rZWVwRGlmZkluUmFuZ2UoXG5cdFx0XHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueCAtIHRoaXMucG9zaXRpb24ueFxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR1bml0U2Vlay54ID0gTWF0aC5jb3MoIHRoZXRhICsgdGhpcy5saXN0ICk7XG5cdFx0XHR1bml0U2Vlay55ID0gTWF0aC5zaW4oIHRoZXRhICsgdGhpcy5saXN0ICk7XG5cdFx0XHRcblx0XHRcdHZlbG9jaXR5XG5cdFx0XHRcdC5jb3B5KCB0aGlzLnVuaXREaXJlY3Rpb24gKVxuXHRcdFx0XHQubGVycCggdW5pdFNlZWssIDAuMDIgKVxuXHRcdFx0XHQubm9ybWFsaXplKClcblx0XHRcdDtcblx0XHRcdFxuXHRcdFx0dGhpcy51bml0RGlyZWN0aW9uLmNvcHkoIHZlbG9jaXR5ICk7XG5cdFx0XHRcblx0XHRcdHZlbG9jaXR5Lm11bHRpcGx5U2NhbGFyKCB0aGlzLnNwZWVkICogZS5kdCApO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnBvc2l0aW9uLmFkZCggdmVsb2NpdHkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueSA9IHRoaXMucG9zaXRpb24ueTtcblx0XHRcdHRoaXMucG9sYXJPYmoucm90YXRpb24ueSA9IHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdFx0XHRcblx0XHR9O1xuXHRcblx0fSgpXHRcblxuXG59OyIsInZhciBQb2VtID0gbnVsbDtcbnZhciBsZXZlbHMgPSByZXF1aXJlKCcuL2xldmVscycpO1xudmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG5cbnZhciBjdXJyZW50TGV2ZWwgPSBudWxsO1xudmFyIGN1cnJlbnRQb2VtID0gbnVsbDtcbnZhciB0aXRsZUhpZGVUaW1lb3V0ID0gbnVsbDtcblxuZnVuY3Rpb24gc2hvd1RpdGxlcygpIHtcblx0XG5cdGNsZWFyVGltZW91dCggdGl0bGVIaWRlVGltZW91dCApO1xuXHRcblx0JCgnI3RpdGxlJylcblx0XHQucmVtb3ZlQ2xhc3MoJ3RyYW5zZm9ybS10cmFuc2l0aW9uJylcblx0XHQuYWRkQ2xhc3MoJ2hpZGUnKVxuXHRcdC5hZGRDbGFzcygndHJhbnNmb3JtLXRyYW5zaXRpb24nKVxuXHRcdC5zaG93KCk7XG5cdFxuXHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdCQoJyN0aXRsZScpLnJlbW92ZUNsYXNzKCdoaWRlJyk7XG5cdH0sIDEpO1xuXHRcblx0JCgnLnNjb3JlJykuY3NzKCdvcGFjaXR5JywgMCk7XG5cdFxufVxuXG5mdW5jdGlvbiBoaWRlVGl0bGVzKCkge1xuXG5cdCQoJy5zY29yZScpLmNzcygnb3BhY2l0eScsIDEpO1xuXHRcblx0aWYoICQoJyN0aXRsZTp2aXNpYmxlJykubGVuZ3RoID4gMCApIHtcdFx0XG5cdFxuXHRcdCQoJyN0aXRsZScpXG5cdFx0XHQuYWRkQ2xhc3MoJ3RyYW5zZm9ybS10cmFuc2l0aW9uJylcblx0XHRcdC5hZGRDbGFzcygnaGlkZScpO1xuXG5cdFx0dGl0bGVIaWRlVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFxuXHRcdFx0JCgnI3RpdGxlJykuaGlkZSgpO1xuXHRcblx0XHR9LCAxMDAwKTtcblx0fVxuXHRcdFx0XG5cdFxufVxuXG52YXIgbGV2ZWxMb2FkZXIgPSB7XG5cdFxuXHRpbml0IDogZnVuY3Rpb24oIFBvZW1DbGFzcyApIHtcblx0XHRQb2VtID0gUG9lbUNsYXNzO1xuXHR9LFxuXHRcblx0bG9hZCA6IGZ1bmN0aW9uKCBzbHVnICkge1xuXHRcdFxuXHRcdGlmKCAhXy5pc09iamVjdChsZXZlbHNbc2x1Z10pICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRcblx0XHRpZihjdXJyZW50UG9lbSkgY3VycmVudFBvZW0uZGVzdHJveSgpO1xuXHRcdFxuXHRcdGN1cnJlbnRMZXZlbCA9IGxldmVsc1tzbHVnXTtcblx0XHRjdXJyZW50UG9lbSA9IG5ldyBQb2VtKCBjdXJyZW50TGV2ZWwsIHNsdWcgKTtcblx0XHRcblx0XHRpZiggc2x1ZyA9PT0gXCJ0aXRsZXNcIiApIHtcblx0XHRcdHNob3dUaXRsZXMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGlkZVRpdGxlcygpO1xuXHRcdH1cblx0XHRcblx0XHR0aGlzLmRpc3BhdGNoKHtcblx0XHRcdHR5cGU6IFwibmV3TGV2ZWxcIixcblx0XHRcdGxldmVsOiBjdXJyZW50TGV2ZWwsXG5cdFx0XHRwb2VtOiBjdXJyZW50UG9lbVxuXHRcdH0pO1xuXHRcdFxuXHRcdHdpbmRvdy5wb2VtID0gY3VycmVudFBvZW07XG5cdFxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdFxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggbGV2ZWxMb2FkZXIgKTtcblxubW9kdWxlLmV4cG9ydHMgPSBsZXZlbExvYWRlcjtcbiIsInZhciBudW1iZXJPZkplbGxpZXMgPSAyNTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG5hbWUgOiBcIlBvbGFyIFJvY2tzXCIsXG5cdGRlc2NyaXB0aW9uIDogXCJGbGlnaHQgaW50byB0aGUgYXN0ZXJvaWQgZmllbGRcIixcblx0b3JkZXIgOiAyLFxuXHRtYXhTY29yZSA6IG51bWJlck9mSmVsbGllcyAqIDEzLFxuXHRjb25maWcgOiB7XG5cdFx0c2NvcmluZ0FuZFdpbm5pbmc6IHtcblx0XHRcdG1lc3NhZ2U6IFwiQXJhY2huaWRzIGRldGVjdGVkIGluIHRoZSBuZXh0IHNlY3Rvci48YnIvPlBsZWFzZSBzcGFyZSB0aGVpciBiYWJpZXMuPGJyLz5cIixcblx0XHRcdG5leHRMZXZlbDogXCJ3ZWJcIixcblx0XHRcdGNvbmRpdGlvbnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdC8vSmVsbHkgbWFuYWdlciBoYXMgMCBsaXZlIHNoaXBzXG5cdFx0XHRcdFx0Y29tcG9uZW50OiBcImplbGx5TWFuYWdlclwiLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IG51bGxcblx0XHRcdFx0fVx0XHRcblx0XHRcdF1cblx0XHR9XG5cdH0sXG5cdG9iamVjdHMgOiB7XG5cdFx0YXN0ZXJvaWRGaWVsZCA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0FzdGVyb2lkRmllbGRcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGNvdW50IDogMjBcblx0XHRcdH1cblx0XHR9LFxuXHRcdGplbGx5TWFuYWdlciA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0VudGl0eU1hbmFnZXJcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGVudGl0eVR5cGU6IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5c2hpcCcpLFxuXHRcdFx0XHRjb3VudDogbnVtYmVyT2ZKZWxsaWVzXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRtdXNpYyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL3NvdW5kL011c2ljXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR1cmw6IFwiaHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS90aGVlbGVjdHJvY2hpcHBlcnMvdGhlLWVuZC1vZi1vdXItam91cm5leVwiXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xuXHRhc3Rlcm9pZHNKZWxsaWVzIDogcmVxdWlyZShcIi4vYXN0ZXJvaWRzSmVsbGllc1wiKSxcblx0dGl0bGVzIDogcmVxdWlyZShcIi4vdGl0bGVzXCIpLFxuXHRpbnRybyA6IHJlcXVpcmUoXCIuL2ludHJvXCIpLFxuXHR3ZWIgOiByZXF1aXJlKFwiLi93ZWJcIilcbn07IiwidmFyIG51bWJlck9mSmVsbGllcyA9IDU7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRuYW1lIDogXCJJbnRyb1wiLFxuXHRkZXNjcmlwdGlvbiA6IFwiSW52YXNpb24gb2YgdGhlIEplbGxpZXNcIixcblx0b3JkZXIgOiAxLFxuXHRtYXhTY29yZSA6IDEzICogbnVtYmVyT2ZKZWxsaWVzLFxuXHRjb25maWcgOiB7XG5cdFx0ciA6IDEyMCxcblx0XHRoZWlnaHQgOiA2MCxcblx0XHRjaXJjdW1mZXJlbmNlIDogOTAwLFxuXHRcdGNhbWVyYU11bHRpcGxpZXIgOiAyLFxuXHRcdHNjb3JpbmdBbmRXaW5uaW5nOiB7XG5cdFx0XHRtZXNzYWdlOiBcIllvdSBzYXZlZCB0aGlzIHNlY3Rvcjxici8+b24gdG8gdGhlIG5leHQgbGV2ZWwuXCIsXG5cdFx0XHRuZXh0TGV2ZWw6IFwiYXN0ZXJvaWRzSmVsbGllc1wiLFxuXHRcdFx0Y29uZGl0aW9uczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Ly9KZWxseSBtYW5hZ2VyIGhhcyAwIGxpdmUgc2hpcHNcblx0XHRcdFx0XHRjb21wb25lbnQ6IFwiamVsbHlNYW5hZ2VyXCIsXG5cdFx0XHRcdFx0cHJvcGVydGllczogbnVsbFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRzdGFyczoge1xuXHRcdFx0Y291bnQ6IDMwMDBcblx0XHR9XG5cdH0sXG5cdG9iamVjdHMgOiB7XG5cdFx0Y3lsaW5kZXJMaW5lcyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL2NvbXBvbmVudHMvQ3lsaW5kZXJMaW5lc1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHt9XG5cdFx0fSxcblx0XHRjYW1lcmFJbnRybyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL2NvbXBvbmVudHMvQ2FtZXJhSW50cm9cIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHNwZWVkIDogMC45ODVcblx0XHRcdH1cblx0XHR9LFxuXHRcdGplbGx5TWFuYWdlciA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0VudGl0eU1hbmFnZXJcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGVudGl0eVR5cGU6IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5c2hpcCcpLFxuXHRcdFx0XHRjb3VudDogbnVtYmVyT2ZKZWxsaWVzXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRtdXNpYyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL3NvdW5kL011c2ljXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHR1cmw6IFwiaHR0cHM6Ly9zb3VuZGNsb3VkLmNvbS90aGVlbGVjdHJvY2hpcHBlcnMvdGhlLXN1bi1pcy1yaXNpbmctY2hpcC1tdXNpY1wiXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59OyIsIm1vZHVsZS5leHBvcnRzID0ge1xuXHRjb25maWcgOiB7XG5cdFx0XG5cdH0sXG5cdG9iamVjdHMgOiB7XG5cdFx0dGl0bGVzIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vY29tcG9uZW50cy9UaXRsZXNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fVxuXHRcdH0sXG5cdFx0bXVzaWMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9zb3VuZC9NdXNpY1wiKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0dXJsOiBcImh0dHBzOi8vc291bmRjbG91ZC5jb20vdGhlZWxlY3Ryb2NoaXBwZXJzL2NoaXB0dW5lLXNwYWNlXCIsXG5cdFx0XHRcdHN0YXJ0VGltZTogMTIsXG5cdFx0XHRcdHZvbHVtZTogMVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTsiLCJ2YXIgbnVtYmVyT2ZBcmFjaG5pZHMgPSAyMDtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG5hbWUgOiBcIlN0dWNrIGluIHRoZSBXZWJcIixcblx0ZGVzY3JpcHRpb24gOiBcIkRvbid0IGh1cnQgdGhlIGJhYmllc1wiLFxuXHRtYXhTY29yZSA6IDIzICogbnVtYmVyT2ZBcmFjaG5pZHMsXG5cdG9yZGVyOiAzLFxuXHRjb25maWcgOiB7XG5cdFx0ciA6IDExMCxcblx0XHQvLyBoZWlnaHQgOiA2MCxcblx0XHQvLyBjaXJjdW1mZXJlbmNlIDogOTAwLFxuXHRcdGNhbWVyYU11bHRpcGxpZXIgOiAyLFxuXHRcdHNjb3JpbmdBbmRXaW5uaW5nOiB7XG5cdFx0XHRtZXNzYWdlOiBcIkhvcGVmdWxseSB0aGUgc3BpZGVybGluZ3Mgd2lsbCBncm93IGludG8gcGxlYXNhbnQgaW5kaXZpZHVhbHMuIEZvbGxvdyBtZSBvbiA8YSBocmVmPSdodHRwczovL3R3aXR0ZXIuY29tL3RhdHVtY3JlYXRpdmUnPlR3aXR0ZXI8L2E+IGZvciB1cGRhdGVzIG9uIG5ldyBsZXZlbHMuXCIsXG5cdFx0XHRuZXh0TGV2ZWw6IFwidGl0bGVzXCIsXG5cdFx0XHRjb25kaXRpb25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHQvL05vIGFyYWNobmlkcyBsZWZ0XG5cdFx0XHRcdFx0Y29tcG9uZW50OiBcImFyYWNobmlkc1wiLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IG51bGxcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0c3RhcnM6IHtcblx0IFx0XHQgY291bnQ6IDMwMDBcblx0XHR9XG5cdH0sXG5cdG9iamVjdHMgOiB7XG5cdFx0d2ViIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vY29tcG9uZW50cy9XZWJcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fVxuXHRcdH0sXG5cdFx0Ly8gY2FtZXJhSW50cm8gOiB7XG5cdFx0Ly8gXHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9jb21wb25lbnRzL0NhbWVyYUludHJvXCIpLFxuXHRcdC8vIFx0cHJvcGVydGllczoge1xuXHRcdC8vIFx0XHRzcGVlZCA6IDAuOTg5XG5cdFx0Ly8gXHR9XG5cdFx0Ly8gfSxcblx0XHRzcGlkZXJsaW5ncyA6IHtcblx0XHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0VudGl0eU1hbmFnZXJcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGVudGl0eVR5cGU6IHJlcXVpcmUoJy4uL2VudGl0aWVzL1NwaWRlcmxpbmdzJyksXG5cdFx0XHRcdGNvdW50OiAwXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhcmFjaG5pZHMgOiB7XG5cdFx0XHRvYmplY3Q6IHJlcXVpcmUoXCIuLi9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyXCIpLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRlbnRpdHlUeXBlOiByZXF1aXJlKCcuLi9lbnRpdGllcy9BcmFjaG5pZCcpLFxuXHRcdFx0XHRjb3VudDogbnVtYmVyT2ZBcmFjaG5pZHNcblx0XHRcdH1cblx0XHR9LFxuXHRcdG11c2ljIDoge1xuXHRcdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vc291bmQvTXVzaWNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHVybDogXCJodHRwczovL3NvdW5kY2xvdWQuY29tL3RoZWVsZWN0cm9jaGlwcGVycy9lbGVjdHJvY2hpcC1hcnRpbGxlcnlcIlxuXHRcdFx0fVxuXHRcdH1cblx0fVxufTsiLCJ2YXIgQXN0ZXJvaWQgPSByZXF1aXJlKCcuLi9lbnRpdGllcy9Bc3Rlcm9pZCcpO1xuXG52YXIgQXN0ZXJvaWRGaWVsZCA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5hc3Rlcm9pZHMgPSBbXTtcblx0dGhpcy5tYXhSYWRpdXMgPSA1MDtcblx0dGhpcy5vcmlnaW5DbGVhcmFuY2UgPSAzMDtcblx0dGhpcy5jb3VudCA9IDIwO1xuXHRcblx0Xy5leHRlbmQoIHRoaXMsIHByb3BlcnRpZXMgKSA7XG5cdFxuXHR0aGlzLmdlbmVyYXRlKCB0aGlzLmNvdW50ICk7XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcblx0dGhpcy5wb2VtLmd1bi5zZXRCYXJyaWVyQ29sbGlkZXIoIHRoaXMuYXN0ZXJvaWRzICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFzdGVyb2lkRmllbGQ7XG5cbkFzdGVyb2lkRmllbGQucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0XG5cdFx0dmFyIGksIHgsIHksIGhlaWdodCwgd2lkdGgsIHJhZGl1cztcblx0XHRcblx0XHRoZWlnaHQgPSB0aGlzLnBvZW0uaGVpZ2h0ICogNDtcblx0XHR3aWR0aCA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdFxuXHRcdGZvciggaT0wOyBpIDwgY291bnQ7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0ZG8ge1xuXHRcdFx0XHRcblx0XHRcdFx0eCA9IE1hdGgucmFuZG9tKCkgKiB3aWR0aDtcblx0XHRcdFx0eSA9IE1hdGgucmFuZG9tKCkgKiBoZWlnaHQgLSAoaGVpZ2h0IC8gMik7XG5cdFx0XHRcblx0XHRcdFx0cmFkaXVzID0gTWF0aC5yYW5kb20oKSAqIHRoaXMubWF4UmFkaXVzO1xuXHRcdFx0XHRcblx0XHRcdH0gd2hpbGUoXG5cdFx0XHRcdHRoaXMuY2hlY2tDb2xsaXNpb24oIHgsIHksIHJhZGl1cyApICYmXG5cdFx0XHRcdHRoaXMuY2hlY2tGcmVlT2ZPcmlnaW4oIHgsIHksIHJhZGl1cyApXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmFzdGVyb2lkcy5wdXNoKFxuXHRcdFx0XHRuZXcgQXN0ZXJvaWQoIHRoaXMucG9lbSwgeCwgeSwgcmFkaXVzIClcblx0XHRcdCk7XG5cdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmFzdGVyb2lkcywgZnVuY3Rpb24oYXN0ZXJvaWQpIHtcblx0XHRcdFxuXHRcdFx0YXN0ZXJvaWQudXBkYXRlKCBlICk7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHRpZiggIXRoaXMucG9lbS5zaGlwLmRlYWQgJiYgIXRoaXMucG9lbS5zaGlwLmludnVsbmVyYWJsZSApIHtcblx0XHRcdHZhciBzaGlwQ29sbGlzaW9uID0gdGhpcy5jaGVja0NvbGxpc2lvbihcblx0XHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueCxcblx0XHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueSxcblx0XHRcdFx0MlxuXHRcdFx0KTtcblx0XHRcblx0XHRcdGlmKCBzaGlwQ29sbGlzaW9uICkge1xuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5raWxsKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0Y2hlY2tGcmVlT2ZPcmlnaW4gOiBmdW5jdGlvbiggeCwgeSwgcmFkaXVzICkge1xuXHRcdHJldHVybiBNYXRoLnNxcnQoeCp4ICsgeSp5KSA+IHJhZGl1cyArIHRoaXMub3JpZ2luQ2xlYXJhbmNlO1xuXHR9LFxuXHRcblx0Y2hlY2tDb2xsaXNpb24gOiBmdW5jdGlvbiggeCwgeSwgcmFkaXVzICkge1xuXHRcdFxuXHRcdHZhciBjb2xsaXNpb24gPSBfLmZpbmQoIHRoaXMuYXN0ZXJvaWRzLCBmdW5jdGlvbiggYXN0ZXJvaWQgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBkeCwgZHksIGRpc3RhbmNlO1xuXHRcdFx0XG5cdFx0XHRkeCA9IHRoaXMucG9lbS5jb29yZGluYXRlcy5jaXJjdW1mZXJlbmNlRGlzdGFuY2UoIHgsIGFzdGVyb2lkLnBvc2l0aW9uLnggKTtcblx0XHRcdGR5ID0geSAtIGFzdGVyb2lkLnBvc2l0aW9uLnk7XG5cdFx0XHRcblx0XHRcdGRpc3RhbmNlID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcblxuXHRcdFx0cmV0dXJuIGRpc3RhbmNlIDwgcmFkaXVzICsgYXN0ZXJvaWQucmFkaXVzO1xuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0cmV0dXJuICEhY29sbGlzaW9uO1xuXHR9XG59OyIsInZhciBDb2xsaWRlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0NvbGxpZGVyJyk7XG52YXIgRGVmYXVsdEplbGx5U2hpcCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5U2hpcCcpO1xudmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0V2ZW50RGlzcGF0Y2hlcicpO1xudmFyIERhbWFnZSA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvRGFtYWdlJyk7XG5cbnZhciBFbnRpdHlNYW5hZ2VyID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmVudGl0eVR5cGUgPSBEZWZhdWx0SmVsbHlTaGlwO1xuXHR0aGlzLmNvdW50ID0gMjA7XG5cdHRoaXMuZW50aXRpZXMgPSBbXTtcblx0dGhpcy5saXZlRW50aXRpZXMgPSBbXTtcblx0dGhpcy5vcmlnaW5DbGVhcmFuY2UgPSAzMDA7XG5cdHRoaXMuc2hhcmVkID0ge307XG5cdHRoaXMud2luQ2hlY2sgPSBudWxsO1xuXHRcdFxuXHRfLmV4dGVuZCggdGhpcywgcHJvcGVydGllcyApO1xuXG5cdHRoaXMuZGFtYWdlID0gbmV3IERhbWFnZSggdGhpcy5wb2VtLCB0aGlzLmVudGl0eVR5cGUucHJvdG90eXBlLmRhbWFnZVNldHRpbmdzICk7XG5cdFxuXHRpZiggXy5pc0Z1bmN0aW9uKCB0aGlzLmVudGl0eVR5cGUucHJvdG90eXBlLmluaXRTaGFyZWRBc3NldHMgKSApIHtcblx0XHR0aGlzLmVudGl0eVR5cGUucHJvdG90eXBlLmluaXRTaGFyZWRBc3NldHMoIHRoaXMgKTtcblx0fVxuXHR0aGlzLmdlbmVyYXRlKCB0aGlzLmNvdW50ICk7XG5cdHRoaXMuY29uZmlndXJlQ29sbGlkZXIoKTtcblx0XG5cdHRoaXMuYm91bmRVcGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuXHRcblx0dGhpcy5wb2VtLm9uKCd1cGRhdGUnLCB0aGlzLmJvdW5kVXBkYXRlICk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVudGl0eU1hbmFnZXI7XG5cbkVudGl0eU1hbmFnZXIucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0XG5cdFx0dmFyIGksIHgsIHksIGhlaWdodCwgd2lkdGgsIGVudGl0eTtcblx0XHRcblx0XHRoZWlnaHQgPSB0aGlzLnBvZW0uaGVpZ2h0ICogNDtcblx0XHR3aWR0aCA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdFxuXHRcdGZvciggaT0wOyBpIDwgY291bnQ7IGkrKyApIHtcblx0XHRcdFxuXHRcdFx0eCA9IE1hdGgucmFuZG9tKCkgKiB3aWR0aDtcblx0XHRcdHkgPSBNYXRoLnJhbmRvbSgpICogaGVpZ2h0IC0gKGhlaWdodCAvIDIpO1xuXHRcdFx0XG5cdFx0XHRlbnRpdHkgPSBuZXcgdGhpcy5lbnRpdHlUeXBlKCB0aGlzLnBvZW0sIHRoaXMsIHgsIHkgKTtcblx0XHRcdGVudGl0eS5kYW1hZ2UgPSB0aGlzLmRhbWFnZTtcblx0XHRcdFxuXHRcdFx0dGhpcy5lbnRpdGllcy5wdXNoKCBlbnRpdHkgKTtcblx0XHRcdHRoaXMubGl2ZUVudGl0aWVzLnB1c2goIGVudGl0eSApO1xuXHRcdFxuXHRcdH1cblx0XHRcblx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0RW5lbWllcyggY291bnQgKTtcblx0XHRcblx0fSxcblx0XG5cdGFkZCA6IGZ1bmN0aW9uKCB4LCB5LCB0aGV0YSApIHtcblx0XHRcblx0XHR2YXIgZW50aXR5ID0gbmV3IHRoaXMuZW50aXR5VHlwZSggdGhpcy5wb2VtLCB0aGlzLCB4LCB5LCB0aGV0YSApO1xuXHRcdFxuXHRcdGVudGl0eS5iYW5rID0gdGhldGE7XG5cdFx0ZW50aXR5LnVwZGF0ZSh7XG5cdFx0XHRkdDogMFxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMuZW50aXRpZXMucHVzaCggZW50aXR5ICk7XG5cdFx0dGhpcy5saXZlRW50aXRpZXMucHVzaCggZW50aXR5ICk7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdEVuZW1pZXMoIDEgKTtcblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHRoaXMuZGlzcGF0Y2goIGUgKTtcblx0XHRcblx0XHRcblx0fSxcblx0XG5cdGtpbGxFbnRpdHkgOiBmdW5jdGlvbiggZW50aXR5ICkge1xuXHRcdFxuXHRcdHZhciBpID0gdGhpcy5saXZlRW50aXRpZXMuaW5kZXhPZiggZW50aXR5ICk7XG5cdFx0XG5cdFx0aWYoIGkgPj0gMCApIHtcblx0XHRcdHRoaXMubGl2ZUVudGl0aWVzLnNwbGljZSggaSwgMSApO1xuXHRcdH1cblx0XHRcblx0XHRlbnRpdHkua2lsbCgpO1xuXHRcdFxuXHRcdGlmKCB0aGlzLndpbkNoZWNrICYmIHRoaXMubGl2ZUVudGl0aWVzLmxlbmd0aCA9PT0gMCApIHtcblx0XHRcdHRoaXMud2luQ2hlY2sucmVwb3J0Q29uZGl0aW9uQ29tcGxldGVkKCk7XG5cdFx0XHR0aGlzLndpbkNoZWNrID0gbnVsbDtcblx0XHR9XG5cdH0sXG5cdFxuXHRjb25maWd1cmVDb2xsaWRlciA6IGZ1bmN0aW9uKCkge1xuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUVudGl0aWVzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucG9lbS5ndW4ubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGVudGl0eSwgYnVsbGV0KSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLmtpbGxFbnRpdHkoIGVudGl0eSApO1xuXHRcdFx0XHR0aGlzLnBvZW0uZ3VuLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0XHRcblx0XHRcdFx0dmFyIHNpZ24gPSAoZW50aXR5LnNjb3JlVmFsdWUgPiAwKSA/IFwiK1wiIDogXCJcIjtcblx0XHRcdFx0dmFyIGNvbG9yID0gKGVudGl0eS5zY29yZVZhbHVlID4gMCkgPyBlbnRpdHkuY3NzQ29sb3IgOiBcIiNmZjAwMDBcIjtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBlbnRpdHkuc2NvcmVWYWx1ZSAhPT0gMCApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0U2NvcmUoXG5cdFx0XHRcdFx0XHRlbnRpdHkuc2NvcmVWYWx1ZSxcblx0XHRcdFx0XHRcdHNpZ24gKyBlbnRpdHkuc2NvcmVWYWx1ZSArIFwiIFwiICsgZW50aXR5Lm5hbWUsIFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcImNvbG9yXCIgOiBjb2xvclxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wb2VtLnNjb3JpbmdBbmRXaW5uaW5nLmFkanVzdEVuZW1pZXMoIC0xICk7XG5cdFx0XHRcdFxuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHRcdFxuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUVudGl0aWVzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLnBvZW0uc2hpcF07XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGVudGl0eSwgYnVsbGV0KSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggIXRoaXMucG9lbS5zaGlwLmRlYWQgJiYgIXRoaXMucG9lbS5zaGlwLmludnVsbmVyYWJsZSApIHtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLmtpbGxFbnRpdHkoIGVudGl0eSApO1xuXHRcdFx0XHRcdHRoaXMucG9lbS5zaGlwLmtpbGwoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLnBvZW0uc2NvcmluZ0FuZFdpbm5pbmcuYWRqdXN0RW5lbWllcyggLTEgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0XG5cdFx0XHR9LmJpbmQodGhpcylcblx0XHRcdFxuXHRcdCk7XG5cdFx0XG5cdH0sXG5cdFxuXHR3YXRjaEZvckNvbXBsZXRpb24gOiBmdW5jdGlvbiggd2luQ2hlY2ssIHByb3BlcnRpZXMgKSB7XG5cdFx0dGhpcy53aW5DaGVjayA9IHdpbkNoZWNrO1xuXHR9XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBFbnRpdHlNYW5hZ2VyLnByb3RvdHlwZSApOyIsInZhciBCdWxsZXQgPSByZXF1aXJlKCcuLi9lbnRpdGllcy9CdWxsZXQnKTtcbnZhciBDb2xsaWRlciA9IHJlcXVpcmUoJy4uL3V0aWxzL0NvbGxpZGVyJyk7XG52YXIgU291bmRHZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9zb3VuZC9Tb3VuZEdlbmVyYXRvcicpO1xudmFyIGRlc3Ryb3lNZXNoID0gcmVxdWlyZSgnLi4vdXRpbHMvZGVzdHJveU1lc2gnKTtcbnZhciBHdW4gPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLnNvdW5kID0gbnVsbDtcblx0XG5cdHRoaXMuY291bnQgPSAzNTA7XG5cdHRoaXMuYnVsbGV0QWdlID0gNTAwMDtcblx0dGhpcy5maXJlRGVsYXlNaWxsaXNlY29uZHMgPSAxMDA7XG5cdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSB0aGlzLnBvZW0uY2xvY2sudGltZTtcblx0dGhpcy5saXZlQnVsbGV0cyA9IFtdO1xuXHR0aGlzLmJ1bGxldHMgPSBbXTtcblx0dGhpcy5ib3JuQXQgPSAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuYWRkU291bmQoKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBHdW47XG5cbkd1bi5wcm90b3R5cGUgPSB7XG5cdFxuXHRmaXJlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGlzRGVhZCA9IGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRyZXR1cm4gIWJ1bGxldC5hbGl2ZTtcblx0XHR9O1xuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbih4LCB5LCBzcGVlZCwgdGhldGEpIHtcblx0XHRcdFxuXHRcdFx0dmFyIG5vdyA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHRcdFx0XG5cdFx0XHRpZiggbm93IC0gdGhpcy5sYXN0RmlyZVRpbWVzdGFtcCA8IHRoaXMuZmlyZURlbGF5TWlsbGlzZWNvbmRzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSBub3c7XG5cdFx0XG5cdFx0XHR2YXIgYnVsbGV0ID0gXy5maW5kKCB0aGlzLmJ1bGxldHMsIGlzRGVhZCApO1xuXHRcdFxuXHRcdFx0aWYoICFidWxsZXQgKSByZXR1cm47XG5cdFx0XG5cdFx0XHR0aGlzLmxpdmVCdWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFxuXHRcdFx0YnVsbGV0LmZpcmUoeCwgeSwgc3BlZWQsIHRoZXRhKTtcblxuXG5cdFx0XHR2YXIgZnJlcSA9IDE5MDA7XG5cdFx0XHRcblx0XHRcdC8vU3RhcnQgc291bmRcblx0XHRcdHRoaXMuc291bmQuc2V0R2FpbigwLjEsIDAsIDAuMDAxKTtcblx0XHRcdHRoaXMuc291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFx0XG5cblx0XHRcdC8vRW5kIHNvdW5kXG5cdFx0XHR0aGlzLnNvdW5kLnNldEdhaW4oMCwgMC4wMSwgMC4wNSk7XG5cdFx0XHR0aGlzLnNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogMC4xLCAwLjAxLCAwLjA1KTtcblx0XHRcdFxuXHRcdH07XG5cdH0oKSxcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgdmVydGV4LCBidWxsZXQ7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0Zm9yKHZhciBpPTA7IGkgPCB0aGlzLmNvdW50OyBpKyspIHtcblx0XHRcdFxuXHRcdFx0dmVydGV4ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRcdGJ1bGxldCA9IG5ldyBCdWxsZXQoIHRoaXMucG9lbSwgdGhpcywgdmVydGV4ICk7XG5cdFx0XHRcblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIHZlcnRleCApO1xuXHRcdFx0dGhpcy5idWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFx0XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdFx0XHRcdFxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdH0sXG5cdFxuXHRraWxsQnVsbGV0IDogZnVuY3Rpb24oIGJ1bGxldCApIHtcblx0XHRcblx0XHR2YXIgaSA9IHRoaXMubGl2ZUJ1bGxldHMuaW5kZXhPZiggYnVsbGV0ICk7XG5cdFx0XG5cdFx0aWYoIGkgPj0gMCApIHtcblx0XHRcdHRoaXMubGl2ZUJ1bGxldHMuc3BsaWNlKCBpLCAxICk7XG5cdFx0fVxuXHRcdFxuXHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XG5cdFx0aWYoIHRoaXMub2JqZWN0ICkgdGhpcy5vYmplY3QuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcblx0XHRcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAxICogdGhpcy5wb2VtLnJhdGlvLFxuXHRcdFx0XHQgY29sb3I6IDB4ZmYwMDAwXG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5vYmplY3QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdHRoaXMucG9lbS5vbignZGVzdHJveScsIGRlc3Ryb3lNZXNoKCB0aGlzLm9iamVjdCApICk7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApICB7XG5cdFx0dmFyIGJ1bGxldCwgdGltZTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaTx0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWxsZXQgPSB0aGlzLmxpdmVCdWxsZXRzW2ldO1xuXHRcdFx0XG5cdFx0XHRpZihidWxsZXQuYm9ybkF0ICsgdGhpcy5idWxsZXRBZ2UgPCBlLnRpbWUpIHtcblx0XHRcdFx0dGhpcy5raWxsQnVsbGV0KCBidWxsZXQgKTtcblx0XHRcdFx0aS0tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVsbGV0LnVwZGF0ZSggZS5kdCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZih0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0c2V0QmFycmllckNvbGxpZGVyIDogZnVuY3Rpb24oIGNvbGxlY3Rpb24gKSB7XG5cdFx0XG5cdFx0Ly9Db2xsaWRlIGJ1bGxldHMgd2l0aCBhc3Rlcm9pZHNcblx0XHRuZXcgQ29sbGlkZXIoXG5cdFx0XHRcblx0XHRcdHRoaXMucG9lbSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb2xsZWN0aW9uO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKGJhcnJpZXIsIGJ1bGxldCkge1xuXHRcdFx0XHR0aGlzLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHR9LFxuXHRcblx0YWRkU291bmQgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgc291bmQgPSB0aGlzLnNvdW5kID0gbmV3IFNvdW5kR2VuZXJhdG9yKCk7XG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNxdWFyZVwiICksXG5cdFx0XHRzb3VuZC5tYWtlR2FpbigpLFxuXHRcdFx0c291bmQuZ2V0RGVzdGluYXRpb24oKVxuXHRcdF0pO1xuXHRcdFxuXHRcdHNvdW5kLnNldEdhaW4oMCwwLDApO1xuXHRcdHNvdW5kLnN0YXJ0KCk7XG5cdFx0XG5cdH1cbn07IiwidmFyIGNyb3Nzcm9hZHMgPSByZXF1aXJlKCdjcm9zc3JvYWRzJyk7XG52YXIgaGFzaGVyID0gcmVxdWlyZSgnaGFzaGVyJyk7XG52YXIgcm91dGluZyA9IHJlcXVpcmUoJy4vcm91dGluZycpO1xudmFyIGxldmVsTG9hZGVyID0gcmVxdWlyZSgnLi9sZXZlbExvYWRlcicpO1xuXG52YXIgYmFzZVVybCA9ICcvcG9sYXInO1xudmFyIGRlZmF1bHRMZXZlbCA9IFwidGl0bGVzXCI7XG52YXIgY3VycmVudExldmVsID0gXCJcIjtcblxudmFyIHJvdXRpbmcgPSB7XG5cdFxuXHRzdGFydCA6IGZ1bmN0aW9uKCBQb2VtICkge1xuXHRcdFxuXHRcdGxldmVsTG9hZGVyLmluaXQoIFBvZW0gKTtcblx0XHRcblx0XHRmdW5jdGlvbiBwYXJzZUhhc2goIG5ld0hhc2gsIG9sZEhhc2ggKXtcblx0XHRcdGNyb3Nzcm9hZHMucGFyc2UoIG5ld0hhc2ggKTtcblx0XHR9XG5cdFx0XG5cdFx0Y3Jvc3Nyb2Fkcy5hZGRSb3V0ZSggJy8nLFx0XHRcdFx0cm91dGluZy5zaG93TWFpblRpdGxlcyApO1xuXHRcdGNyb3Nzcm9hZHMuYWRkUm91dGUoICdsZXZlbC97bmFtZX0nLFx0cm91dGluZy5sb2FkVXBBTGV2ZWwgKTtcblx0XG5cdFx0Y3Jvc3Nyb2Fkcy5hZGRSb3V0ZSggLy4qLywgZnVuY3Rpb24gcmVSb3V0ZVRvTWFpblRpdGxlc0lmTm9NYXRjaCgpIHtcblx0XHRcdGhhc2hlci5yZXBsYWNlSGFzaCgnJyk7XG5cdFx0fSk7XG5cdFxuXHRcdGhhc2hlci5pbml0aWFsaXplZC5hZGQocGFyc2VIYXNoKTsgLy8gcGFyc2UgaW5pdGlhbCBoYXNoXG5cdFx0aGFzaGVyLmNoYW5nZWQuYWRkKHBhcnNlSGFzaCk7IC8vcGFyc2UgaGFzaCBjaGFuZ2VzXG5cdFx0aGFzaGVyLmluaXQoKTsgLy9zdGFydCBsaXN0ZW5pbmcgZm9yIGhpc3RvcnkgY2hhbmdlXG5cdFx0XG5cdH0sXG5cdFxuXHRzaG93TWFpblRpdGxlcyA6IGZ1bmN0aW9uKCkge1xuXG5cdFx0X2dhcS5wdXNoKCBbICdfdHJhY2tQYWdldmlldycsIGJhc2VVcmwgXSApO1xuXHRcblx0XHRsZXZlbExvYWRlci5sb2FkKCBkZWZhdWx0TGV2ZWwgKTtcdFx0XG5cblx0fSxcblxuXHRsb2FkVXBBTGV2ZWwgOiBmdW5jdGlvbiggbGV2ZWxOYW1lICkge1xuXG5cdFx0X2dhcS5wdXNoKCBbICdfdHJhY2tQYWdldmlldycsIGJhc2VVcmwrJy8jbGV2ZWwvJytsZXZlbE5hbWUgXSApO1xuXHRcblx0XHR2YXIgbGV2ZWxGb3VuZCA9IGxldmVsTG9hZGVyLmxvYWQoIGxldmVsTmFtZSApO1xuXHRcblx0XHRpZiggIWxldmVsRm91bmQgKSB7XG5cdFx0XHRsZXZlbExvYWRlci5sb2FkKCBkZWZhdWx0TGV2ZWwgKTtcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRvbiA6IGxldmVsTG9hZGVyLm9uLFxuXHRvZmYgOiBsZXZlbExvYWRlci5vZmZcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJvdXRpbmc7IiwidmFyIHNvdW5kY2xvdWQgPSByZXF1aXJlKCdzb3VuZGNsb3VkLWJhZGdlJyk7XG52YXIgbXV0ZXIgPSByZXF1aXJlKCcuL211dGVyJyk7XG5cbnZhciBzb3VuZE9mZiA9IGZhbHNlO1xuXG52YXIgYXVkaW8gPSBudWxsO1xudmFyIGZldGNoQW5kUGxheVNvbmcgPSBudWxsO1xudmFyIHRpbWVzQ2FsbGVkU291bmRjbG91ZCA9IDA7XG5cbnZhciBNdXNpYyA9IGZ1bmN0aW9uKCBwb2VtLCBwcm9wZXJ0aWVzICkge1xuXG5cdGZldGNoQW5kUGxheVNvbmcgPSBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgY3VycmVudFRpbWUgPSArK3RpbWVzQ2FsbGVkU291bmRjbG91ZDtcblx0XHRcblx0XHRzb3VuZGNsb3VkKHtcblx0XHRcdFxuXHRcdFx0Y2xpZW50X2lkOiAnNjA1N2M5YWY4NjJiZjI0NWQ0YzQwMjE3OWUzMTdmNTInLFxuXHRcdFx0c29uZzogcHJvcGVydGllcy51cmwsXG5cdFx0XHRkYXJrOiBmYWxzZSxcblx0XHRcdGdldEZvbnRzOiBmYWxzZVxuXHRcdFx0XG5cdFx0fSwgZnVuY3Rpb24oIGVyciwgc3JjLCBkYXRhLCBkaXYgKSB7XG5cdFx0XHRcblx0XHRcdC8vTnVsbGlmeSBjYWxsYmFja3MgdGhhdCBhcmUgb3V0IG9mIG9yZGVyXG5cdFx0XHRpZiggY3VycmVudFRpbWUgIT09IHRpbWVzQ2FsbGVkU291bmRjbG91ZCApIHJldHVybjtcblx0XHRcdGlmKCBtdXRlci5tdXRlZCApIHJldHVybjtcblxuXHRcdFx0aWYoIGVyciApIHRocm93IGVycjtcblxuXHRcdFx0YXVkaW8gPSBuZXcgQXVkaW8oKTtcblx0XHRcdGF1ZGlvLnNyYyA9IHNyYztcblx0XHRcdGF1ZGlvLnBsYXkoKTtcblx0XHRcdGF1ZGlvLmxvb3AgPSB0cnVlO1xuXHRcdFx0YXVkaW8udm9sdW1lID0gcHJvcGVydGllcy52b2x1bWUgfHwgMC42O1xuXHRcdFxuXHRcdFx0JChhdWRpbykub24oJ2xvYWRlZG1ldGFkYXRhJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKCBhdWRpbyApXHRhdWRpby5jdXJyZW50VGltZSA9IHByb3BlcnRpZXMuc3RhcnRUaW1lIHx8IDA7XG5cdFx0XHR9KTtcblx0XHRcblxuXHRcdH0pO1xuXHRcblx0XHRwb2VtLm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcblx0XHRcdGlmKCBhdWRpbyApIHtcblx0XHRcdFx0YXVkaW8ucGF1c2UoKTtcblx0XHRcdFx0YXVkaW8gPSBudWxsO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHQkKCcubnBtLXNjYi13aGl0ZScpLnJlbW92ZSgpO1xuXHRcdFx0XG5cdFx0fSk7XG5cdFx0XG5cdH07XG5cdFxuXHRpZiggIW11dGVyLm11dGVkICkge1xuXHRcdFxuXHRcdGZldGNoQW5kUGxheVNvbmcoKTtcblx0XHRmZXRjaEFuZFBsYXlTb25nID0gbnVsbDtcblx0XHRcblx0fVxuXHRcbn07XG5cbk11c2ljLnByb3RvdHlwZS5tdXRlZCA9IGZhbHNlO1xuXG5tdXRlci5vbignbXV0ZScsIGZ1bmN0aW9uIG11dGVNdXNpYyggZSApIHtcblxuXHRpZiggYXVkaW8gKSBhdWRpby5wYXVzZSgpO1xuXHRcblx0JCgnLm5wbS1zY2Itd2hpdGUnKS5oaWRlKCk7XG5cbn0pO1xuXG5tdXRlci5vbigndW5tdXRlJywgZnVuY3Rpb24gdW5tdXRlTXVzaWMoIGUgKSB7XG5cblx0aWYoIGF1ZGlvICkgYXVkaW8ucGxheSgpO1xuXG5cdGlmKCBmZXRjaEFuZFBsYXlTb25nICkge1xuXHRcdGZldGNoQW5kUGxheVNvbmcoKTtcblx0XHRmZXRjaEFuZFBsYXlTb25nID0gbnVsbDtcblx0fVxuXHRcblx0JCgnLm5wbS1zY2Itd2hpdGUnKS5zaG93KCk7XG5cdFxuXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNdXNpYzsiLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcbnZhciBjb250ZXh0ID0gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0IHx8IG51bGw7XG52YXIgbXV0ZXIgPSByZXF1aXJlKCcuL211dGVyJyk7XG5cbnZhciBTb3VuZEdlbmVyYXRvciA9IGZ1bmN0aW9uKCkge1xuXHRcblx0dGhpcy5lbmFibGVkID0gY29udGV4dCAhPT0gdW5kZWZpbmVkO1xuXHRcblx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcblx0dGhpcy5sYXN0R2FpblZhbHVlID0gbnVsbDtcblx0XG5cdHRoaXMudG90YWxDcmVhdGVkKys7XG5cdHRoaXMudG90YWxDcmVhdGVkU3EgPSB0aGlzLnRvdGFsQ3JlYXRlZCAqIHRoaXMudG90YWxDcmVhdGVkO1xuXHRcblx0bXV0ZXIub24oJ211dGUnLCB0aGlzLmhhbmRsZU11dGUuYmluZCh0aGlzKSk7XG5cdG11dGVyLm9uKCd1bm11dGUnLCB0aGlzLmhhbmRsZVVuTXV0ZS5iaW5kKHRoaXMpKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNvdW5kR2VuZXJhdG9yO1xuXG5Tb3VuZEdlbmVyYXRvci5wcm90b3R5cGUgPSB7XG5cdFxuXHRoYW5kbGVNdXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYoIHRoaXMuZ2FpbiApIHtcblx0XHRcdHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gMDtcblx0XHR9XG5cdH0sXG5cdFxuXHRoYW5kbGVVbk11dGUgOiBmdW5jdGlvbigpIHtcblx0XHRpZiggdGhpcy5nYWluICYmIF8uaXNOdW1iZXIoIHRoaXMubGFzdEdhaW5WYWx1ZSApICkge1xuXHRcdFx0dGhpcy5nYWluLmdhaW4udmFsdWUgPSB0aGlzLmxhc3RHYWluVmFsdWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0Y29udGV4dCA6IGNvbnRleHQgPyBuZXcgY29udGV4dCgpIDogdW5kZWZpbmVkLFxuXHRcblx0bWFrZVBpbmtOb2lzZSA6IGZ1bmN0aW9uKCBidWZmZXJTaXplICkge1xuXHRcblx0XHR2YXIgYjAsIGIxLCBiMiwgYjMsIGI0LCBiNSwgYjYsIG5vZGU7IFxuXHRcdFxuXHRcdGIwID0gYjEgPSBiMiA9IGIzID0gYjQgPSBiNSA9IGI2ID0gMC4wO1xuXHRcdG5vZGUgPSB0aGlzLnBpbmtOb2lzZSA9IHRoaXMuY29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoYnVmZmVyU2l6ZSwgMSwgMSk7XG5cdFx0XG5cdFx0bm9kZS5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGUpIHtcblx0XHRcdFxuXHRcdFx0Ly8gaHR0cDovL25vaXNlaGFjay5jb20vZ2VuZXJhdGUtbm9pc2Utd2ViLWF1ZGlvLWFwaS9cblx0XHRcdHZhciBvdXRwdXQgPSBlLm91dHB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJTaXplOyBpKyspIHtcblx0XHRcdFx0dmFyIHdoaXRlID0gTWF0aC5yYW5kb20oKSAqIDIgLSAxO1xuXHRcdFx0XHRiMCA9IDAuOTk4ODYgKiBiMCArIHdoaXRlICogMC4wNTU1MTc5O1xuXHRcdFx0XHRiMSA9IDAuOTkzMzIgKiBiMSArIHdoaXRlICogMC4wNzUwNzU5O1xuXHRcdFx0XHRiMiA9IDAuOTY5MDAgKiBiMiArIHdoaXRlICogMC4xNTM4NTIwO1xuXHRcdFx0XHRiMyA9IDAuODY2NTAgKiBiMyArIHdoaXRlICogMC4zMTA0ODU2O1xuXHRcdFx0XHRiNCA9IDAuNTUwMDAgKiBiNCArIHdoaXRlICogMC41MzI5NTIyO1xuXHRcdFx0XHRiNSA9IC0wLjc2MTYgKiBiNSAtIHdoaXRlICogMC4wMTY4OTgwO1xuXHRcdFx0XHRvdXRwdXRbaV0gPSBiMCArIGIxICsgYjIgKyBiMyArIGI0ICsgYjUgKyBiNiArIHdoaXRlICogMC41MzYyO1xuXHRcdFx0XHRvdXRwdXRbaV0gKj0gMC4xMTsgLy8gKHJvdWdobHkpIGNvbXBlbnNhdGUgZm9yIGdhaW5cblx0XHRcdFx0YjYgPSB3aGl0ZSAqIDAuMTE1OTI2O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdFxuXHR9LFxuXHRcblx0bWFrZU9zY2lsbGF0b3IgOiBmdW5jdGlvbiggdHlwZSwgZnJlcXVlbmN5ICkge1xuXHRcdC8qXG5cdFx0XHRlbnVtIE9zY2lsbGF0b3JUeXBlIHtcblx0XHRcdCAgXCJzaW5lXCIsXG5cdFx0XHQgIFwic3F1YXJlXCIsXG5cdFx0XHQgIFwic2F3dG9vdGhcIixcblx0XHRcdCAgXCJ0cmlhbmdsZVwiLFxuXHRcdFx0ICBcImN1c3RvbVwiXG5cdFx0XHR9XG5cdFx0Ki9cblx0XHRcblx0XHR2YXIgbm9kZSA9IHRoaXMub3NjaWxsYXRvciA9IHRoaXMuY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG5cdFx0XG5cdFx0bm9kZS50eXBlID0gdHlwZSB8fCBcInNhd3Rvb3RoXCI7XG5cdFx0bm9kZS5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3kgfHwgMjAwMDtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0XG5cdG1ha2VHYWluIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vZGUgPSB0aGlzLmdhaW4gPSB0aGlzLmNvbnRleHQuY3JlYXRlR2FpbigpO1xuXHRcdFxuXHRcdG5vZGUuZ2Fpbi52YWx1ZSA9IDA7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdFxuXHRtYWtlUGFubmVyIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jb250ZXh0Lmxpc3RlbmVyLnNldFBvc2l0aW9uKDAsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBub2RlID0gdGhpcy5wYW5uZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlUGFubmVyKCk7XG5cdFx0XG5cdFx0bm9kZS5wYW5uaW5nTW9kZWwgPSAnZXF1YWxwb3dlcic7XG5cdFx0bm9kZS5jb25lT3V0ZXJHYWluID0gMC4xO1xuXHRcdG5vZGUuY29uZU91dGVyQW5nbGUgPSAxODA7XG5cdFx0bm9kZS5jb25lSW5uZXJBbmdsZSA9IDA7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdFxuXHRtYWtlQmFuZHBhc3MgOiBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBub2RlID0gdGhpcy5iYW5kcGFzcyA9IHRoaXMuY29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcblx0XHRcblx0XHRub2RlLnR5cGUgPSBcImJhbmRwYXNzXCI7XG5cdFx0bm9kZS5mcmVxdWVuY3kudmFsdWUgPSA0NDA7XG5cdFx0bm9kZS5RLnZhbHVlID0gMC41O1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXG5cdH0sXG5cdFxuXHRnZXREZXN0aW5hdGlvbiA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmNvbnRleHQuZGVzdGluYXRpb247XG5cdH0sXG5cdFxuXHRjb25uZWN0Tm9kZXMgOiBmdW5jdGlvbiggbm9kZXMgKSB7XG5cdFx0Xy5lYWNoKCBfLnJlc3QoIG5vZGVzICksIGZ1bmN0aW9uKG5vZGUsIGksIGxpc3QpIHtcblx0XHRcdHZhciBwcmV2Tm9kZSA9IG5vZGVzW2ldO1xuXHRcdFx0XG5cdFx0XHRwcmV2Tm9kZS5jb25uZWN0KCBub2RlICk7XG5cdFx0fSk7XG5cdH0sXG5cdFxuXHRzdGFydCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMub3NjaWxsYXRvci5zdGFydCgwKTtcblx0fSxcblx0XG5cdHRvdGFsQ3JlYXRlZCA6IDAsXG5cdFxuXHRzZXRGcmVxdWVuY3kgOiBmdW5jdGlvbiAoIGZyZXF1ZW5jeSwgZGVsYXksIHNwZWVkICkge1xuXHRcdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0b3IuZnJlcXVlbmN5LnNldFRhcmdldEF0VGltZShmcmVxdWVuY3ksIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSArIGRlbGF5LCBzcGVlZCk7XG5cdH0sXG5cdFxuXHRzZXRQb3NpdGlvbiA6IGZ1bmN0aW9uICggeCwgeSwgeiApIHtcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0dGhpcy5wYW5uZXIuc2V0UG9zaXRpb24oIHgsIHksIHogKTtcblx0fSxcblx0XG5cdHNldEdhaW4gOiBmdW5jdGlvbiAoIGdhaW4sIGRlbGF5LCBzcGVlZCApIHtcblx0XHRcblx0XHR0aGlzLmxhc3RHYWluVmFsdWUgPSBnYWluO1xuXHRcdFxuXHRcdGlmKCAhdGhpcy5lbmFibGVkIHx8IG11dGVyLm11dGVkICkgcmV0dXJuO1xuXHRcdC8vIE1hdGgubWF4KCBNYXRoLmFicyggZ2FpbiApLCAxKTtcblx0XHQvLyBnYWluIC8gdGhpcy50b3RhbENyZWF0ZWRTcTtcblx0XHRcdFx0XG5cdFx0dGhpcy5nYWluLmdhaW4uc2V0VGFyZ2V0QXRUaW1lKFxuXHRcdFx0Z2Fpbixcblx0XHRcdHRoaXMuY29udGV4dC5jdXJyZW50VGltZSArIGRlbGF5LFxuXHRcdFx0c3BlZWRcblx0XHQpO1xuXHR9LFxuXHRcblx0c2V0QmFuZHBhc3NRIDogZnVuY3Rpb24gKCBRICkge1xuXHRcdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XHR0aGlzLmJhbmRwYXNzLlEuc2V0VGFyZ2V0QXRUaW1lKFEsIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSwgMC4xKTtcblx0fSxcblx0XG5cdHNldEJhbmRwYXNzRnJlcXVlbmN5IDogZnVuY3Rpb24gKCBmcmVxdWVuY3kgKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdHRoaXMuYmFuZHBhc3MuZnJlcXVlbmN5LnNldFRhcmdldEF0VGltZShmcmVxdWVuY3ksIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSwgMC4xKTtcblx0fVxufTsiLCJ2YXIgRXZlbnREaXNwYXRjaGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG52YXIgbG9jYWxmb3JhZ2UgPSByZXF1aXJlKCdsb2NhbGZvcmFnZScpO1xudmFyIG11dGVyO1xuXG52YXIgTXV0ZXIgPSBmdW5jdGlvbigpIHtcblx0XG5cdHRoaXMubXV0ZWQgPSB0cnVlO1xuXHRcblx0bG9jYWxmb3JhZ2UuZ2V0SXRlbSgnbXV0ZWQnLCBmdW5jdGlvbiggZXJyLCB2YWx1ZSApIHtcblxuXHRcdGlmKCBlcnIgfHwgdmFsdWUgPT09IG51bGwgKSB7XG5cdFx0XHR0aGlzLm11dGVkID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubXV0ZWQgPSB2YWx1ZTtcblx0XHR9XG5cdFx0XG5cdFx0dGhpcy5kaXNwYXRjaENoYW5nZWQoKTtcblx0XHRcblx0fS5iaW5kKHRoaXMpKTtcblx0XG59O1xuXG5NdXRlci5wcm90b3R5cGUgPSB7XG5cdFxuXHRtdXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5tdXRlZCA9IHRydWU7XG5cdFx0dGhpcy5kaXNwYXRjaENoYW5nZWQoKTtcblx0XHR0aGlzLnNhdmUoKTtcblx0fSxcblx0XG5cdHVubXV0ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMubXV0ZWQgPSBmYWxzZTtcblx0XHR0aGlzLmRpc3BhdGNoQ2hhbmdlZCgpO1xuXHRcdHRoaXMuc2F2ZSgpO1xuXHR9LFxuXHRcblx0c2F2ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdGxvY2FsZm9yYWdlLnNldEl0ZW0oICdtdXRlZCcsIHRoaXMubXV0ZWQgKTtcblx0fSxcblx0XG5cdGRpc3BhdGNoQ2hhbmdlZCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdGlmKCB0aGlzLm11dGVkICkge1xuXHRcdFx0bXV0ZXIuZGlzcGF0Y2goe1xuXHRcdFx0XHR0eXBlOiAnbXV0ZSdcblx0XHRcdH0pO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGVyLmRpc3BhdGNoKHtcblx0XHRcdFx0dHlwZTogJ3VubXV0ZSdcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXHRcbn07XG5cbkV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuYXBwbHkoIE11dGVyLnByb3RvdHlwZSApO1xuXG5tdXRlciA9IG5ldyBNdXRlcigpO1xuXG4kKHdpbmRvdykub24oJ2tleWRvd24nLCBmdW5jdGlvbiBtdXRlQXVkaW9PbkhpdHRpbmdTKCBlICkge1xuXHRcblx0aWYoIGUua2V5Q29kZSAhPT0gODMgKSByZXR1cm47XG5cdFxuXHRpZiggbXV0ZXIubXV0ZWQgKSB7XG5cdFx0bXV0ZXIudW5tdXRlKCk7XG5cdH0gZWxzZSB7XG5cdFx0bXV0ZXIubXV0ZSgpO1xuXHR9XG5cdFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gbXV0ZXI7XG4iLCJ2YXIgbWVudSA9IHJlcXVpcmUoJy4vbWVudScpO1xudmFyIG11dGUgPSByZXF1aXJlKCcuL211dGUnKTtcbnZhciBtZW51TGV2ZWxzID0gcmVxdWlyZSgnLi9tZW51TGV2ZWxzJyk7XG5cbmpRdWVyeShmdW5jdGlvbigkKSB7XG5cdFxuXHRtZW51LnNldEhhbmRsZXJzKCk7XG5cdG11dGUuc2V0SGFuZGxlcnMoKTtcblx0XG59KTsiLCJ2YXJcdEV2ZW50RGlzcGF0Y2hlclx0PSByZXF1aXJlKCcuLi91dGlscy9FdmVudERpc3BhdGNoZXInKTtcbnZhclx0cm91dGluZ1x0XHQ9IHJlcXVpcmUoJy4uL3JvdXRpbmcnKTtcbnZhclx0c2NvcmVzXHRcdFx0PSByZXF1aXJlKCcuLi9jb21wb25lbnRzL3Njb3JlcycpO1xuXG52YXIgcG9lbTtcbnZhciBpc09wZW4gPSBmYWxzZTtcbnZhciAkYm9keTtcblxucm91dGluZy5vbiggJ25ld0xldmVsJywgZnVuY3Rpb24oIGUgKSB7XG5cblx0cG9lbSA9IGUucG9lbTtcblx0XG59KTtcblxuXG52YXIgbWVudSA9IHtcblx0XG5cdHNldEhhbmRsZXJzIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0JGJvZHkgPSAkKCdib2R5Jyk7XG5cdFx0XG5cdFx0JCgnI21lbnUgYSwgI2NvbnRhaW5lci1ibG9ja2VyJykuY2xpY2soIG1lbnUuY2xvc2UgKTtcblx0XHRcblx0XHQkKCcjbWVudS1idXR0b24nKS5vZmYoKS5jbGljayggdGhpcy50b2dnbGUgKTtcblx0XHQkKCcjbWVudS1yZXNldC1zY29yZScpLm9mZigpLmNsaWNrKCB0aGlzLnJlc2V0U2NvcmVzICk7XG5cdFx0XG5cdFx0cm91dGluZy5vbiggJ25ld0xldmVsJywgbWVudS5jbG9zZSApO1xuXHRcdFxuXHRcdCQod2luZG93KS5vbigna2V5ZG93bicsIGZ1bmN0aW9uIHRvZ2dsZU1lbnVIYW5kbGVyKCBlICkge1xuXHRcblx0XHRcdGlmKCBlLmtleUNvZGUgIT09IDI3ICkgcmV0dXJuO1xuXHRcdFx0bWVudS50b2dnbGUoZSk7XG5cdFxuXHRcdH0pO1xuXHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0cmVzZXRTY29yZXMgOiBmdW5jdGlvbihlKSB7XG5cdFx0XG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFxuXHRcdGlmKCBjb25maXJtKCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byByZXNldCB5b3VyIHNjb3Jlcz9cIiApICkge1xuXHRcdFx0c2NvcmVzLnJlc2V0KCk7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dG9nZ2xlIDogZnVuY3Rpb24oIGUgKSB7XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XG5cdFx0aWYoIGlzT3BlbiApIHtcblx0XHRcdG1lbnUuY2xvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWVudS5vcGVuKCk7XG5cdFx0fVxuXHRcdFxuXHRcdGlzT3BlbiA9ICFpc09wZW47XG5cdFx0XG5cdH0sXG5cdFxuXHRjbG9zZSA6IGZ1bmN0aW9uKCkge1xuXHRcdCRib2R5LnJlbW92ZUNsYXNzKCdtZW51LW9wZW4nKTtcblx0XHRpZiggcG9lbSApIHBvZW0uc3RhcnQoKTtcblx0fSxcblx0XG5cdG9wZW4gOiBmdW5jdGlvbigpIHtcblx0XHQkYm9keS5hZGRDbGFzcygnbWVudS1vcGVuJyk7XG5cdFx0aWYoIHBvZW0gKSBwb2VtLnBhdXNlKCk7XG5cdH1cblx0XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBtZW51ICk7XG5tb2R1bGUuZXhwb3J0cyA9IG1lbnU7IiwidmFyIHNjb3JlcyA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvc2NvcmVzJyk7XG52YXIgbGV2ZWxLZXlQYWlycyA9IChmdW5jdGlvbiBzb3J0QW5kRmlsdGVyTGV2ZWxzKCBsZXZlbHMgKSB7XG5cdFx0XG5cdHJldHVybiBfLmNoYWluKGxldmVscylcblx0XHQucGFpcnMoKVxuXHRcdC5maWx0ZXIoZnVuY3Rpb24oIGtleXBhaXIgKSB7XG5cdFx0XHRyZXR1cm4ga2V5cGFpclsxXS5vcmRlcjtcblx0XHR9KVxuXHRcdC5zb3J0QnkoZnVuY3Rpb24oIGtleXBhaXIgKSB7XG5cdFx0XHRyZXR1cm4ga2V5cGFpclsxXS5vcmRlcjtcblx0XHR9KVxuXHQudmFsdWUoKTtcblx0XG59KSggcmVxdWlyZSgnLi4vbGV2ZWxzJykgKTtcblxuZnVuY3Rpb24gcmVhY3RpdmVMZXZlbHMoICRzY29wZSwgdGVtcGxhdGUgKSB7XG5cdFxuXHQkc2NvcGUuY2hpbGRyZW4oKS5yZW1vdmUoKTtcblx0XG5cdHZhciB0ZW1wbGF0ZURhdGEgPSBfLm1hcCggbGV2ZWxLZXlQYWlycywgZnVuY3Rpb24oIGtleXBhaXIgKSB7XG5cdFx0XG5cdFx0dmFyIHNsdWcgPSBrZXlwYWlyWzBdO1xuXHRcdHZhciBsZXZlbCA9IGtleXBhaXJbMV07XG5cdFx0XG5cdFx0dmFyIHNjb3JlID0gc2NvcmVzLmdldCggc2x1ZyApO1xuXHRcdFxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lIDogbGV2ZWwubmFtZSxcblx0XHRcdGRlc2NyaXB0aW9uIDogbGV2ZWwuZGVzY3JpcHRpb24sXG5cdFx0XHRzbHVnIDogc2x1Zyxcblx0XHRcdHBlcmNlbnQgOiBzY29yZSA/IHNjb3JlLnBlcmNlbnQgOiAwLFxuXHRcdFx0c2NvcmUgOiBzY29yZSA/IHNjb3JlLnZhbHVlIDogMCxcblx0XHRcdHRvdGFsIDogc2NvcmUgPyBzY29yZS50b3RhbCA6IDEsXG5cdFx0XHRsZWZ0T3JSaWdodCA6IHNjb3JlICYmIHNjb3JlLnVuaXRJIDwgMC41ID8gXCJyaWdodFwiIDogXCJsZWZ0XCJcblx0XHR9O1xuXHRcdFxuXHR9KTtcblx0XG5cdCRzY29wZS5hcHBlbmQoIF8ucmVkdWNlKCB0ZW1wbGF0ZURhdGEsIGZ1bmN0aW9uKCBtZW1vLCB0ZXh0KSB7XG5cdFx0XG5cdFx0cmV0dXJuIG1lbW8gKyB0ZW1wbGF0ZSggdGV4dCApO1xuXHRcdFxuXHR9LCBcIlwiKSApO1xufVxuXG4oZnVuY3Rpb24gaW5pdCgpIHtcblx0XG5cdHZhciB0ZW1wbGF0ZSA9IF8udGVtcGxhdGUoICQoJyNtZW51LWxldmVsLXRlbXBsYXRlJykudGV4dCgpICk7XG5cdHZhciAkc2NvcGUgPSAkKCcjbWVudS1sZXZlbHMnKTtcblx0XG5cdGZ1bmN0aW9uIHVwZGF0ZVJlYWN0aXZlTGV2ZWxzKCkge1xuXHRcdHJlYWN0aXZlTGV2ZWxzKCAkc2NvcGUsIHRlbXBsYXRlICk7XG5cdH1cblx0XG5cdHNjb3Jlcy5vbiggJ2NoYW5nZScsIHVwZGF0ZVJlYWN0aXZlTGV2ZWxzICk7XG5cdHVwZGF0ZVJlYWN0aXZlTGV2ZWxzKCk7XG5cdFxufSkoKTtcbiIsInZhciBtdXRlciA9IHJlcXVpcmUoJy4uL3NvdW5kL211dGVyJyk7XG5cbnZhciBtdXRlZFNyYyA9ICdhc3NldHMvaW1hZ2VzL3NvdW5kLW11dGUucG5nJztcbnZhciB1bk11dGVkU3JjID0gJ2Fzc2V0cy9pbWFnZXMvc291bmQtdW5tdXRlLnBuZyc7XG52YXIgbXV0ZWRTcmNIb3ZlciA9ICdhc3NldHMvaW1hZ2VzL3NvdW5kLW11dGUtaG92ZXIucG5nJztcbnZhciB1bk11dGVkU3JjSG92ZXIgPSAnYXNzZXRzL2ltYWdlcy9zb3VuZC11bm11dGUtaG92ZXIucG5nJztcblxubmV3IEltYWdlKCkuc3JjID0gbXV0ZWRTcmM7XG5uZXcgSW1hZ2UoKS5zcmMgPSB1bk11dGVkU3JjO1xubmV3IEltYWdlKCkuc3JjID0gbXV0ZWRTcmNIb3Zlcjtcbm5ldyBJbWFnZSgpLnNyYyA9IHVuTXV0ZWRTcmNIb3ZlcjtcblxuXG52YXIgJG11dGU7XG52YXIgJGltZztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdFxuXHRzZXRIYW5kbGVycyA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdCRtdXRlID0gJCgnI211dGUnKTtcblx0XHQkaW1nID0gJG11dGUuZmluZCgnaW1nJyk7XG5cdFx0XG5cdFx0bXV0ZXIub24oJ211dGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdCRpbWcuYXR0ciggJ3NyYycsIG11dGVkU3JjICk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0bXV0ZXIub24oJ3VubXV0ZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JGltZy5hdHRyKCAnc3JjJywgdW5NdXRlZFNyYyApO1xuXHRcdH0pO1xuXHRcdFxuXHRcdCRpbWcuYXR0ciggJ3NyYycsIG11dGVyLm11dGVkID8gbXV0ZWRTcmMgOiB1bk11dGVkU3JjICk7XG5cdFx0XG5cdFx0JG11dGUub2ZmKCkuY2xpY2soIGZ1bmN0aW9uKCBlICkge1xuXHRcdFx0XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XG5cdFx0XHRpZiggbXV0ZXIubXV0ZWQgKSB7XG5cdFx0XHRcblx0XHRcdFx0JGltZy5hdHRyKCdzcmMnLCB1bk11dGVkU3JjSG92ZXIpO1xuXHRcdFx0XHRtdXRlci51bm11dGUoKTtcblx0XHRcdFxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0XHQkaW1nLmF0dHIoJ3NyYycsIG11dGVkU3JjSG92ZXIpO1xuXHRcdFx0XHRtdXRlci5tdXRlKCk7XG5cdFx0XHRcblx0XHRcdH1cblx0XHRcdGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XG5cdFx0fSk7XG5cblx0XHQkbXV0ZS5vbignbW91c2VvdmVyJywgZnVuY3Rpb24oIGUgKSB7XG5cdFx0XHRcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcblx0XHRcdGlmKCBtdXRlci5tdXRlZCApIHtcblx0XHRcdFx0JGltZy5hdHRyKCdzcmMnLCBtdXRlZFNyY0hvdmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRpbWcuYXR0cignc3JjJywgdW5NdXRlZFNyY0hvdmVyKTtcblx0XHRcdH1cblx0XHRcblx0XHR9KTtcblx0XHRcblx0XHQkbXV0ZS5vbignbW91c2VvdXQnLCBmdW5jdGlvbiggZSApIHtcblx0XHRcdFxuXHRcdFx0aWYoIG11dGVyLm11dGVkICkge1xuXHRcdFx0XHQkaW1nLmF0dHIoJ3NyYycsIG11dGVkU3JjKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdCRpbWcuYXR0cignc3JjJywgdW5NdXRlZFNyYyk7XG5cdFx0XHR9XHRcdFxuXHRcdH0pO1xuXHRcdFxuXHR9XG5cdFxufTsiLCJ2YXIgQ2xvY2sgPSBmdW5jdGlvbiggYXV0b3N0YXJ0ICkge1xuXG5cdHRoaXMubWF4RHQgPSA2MDtcblx0dGhpcy5taW5EdCA9IDE2O1xuXHR0aGlzLnBUaW1lID0gMDtcblx0dGhpcy50aW1lID0gMDtcblx0XG5cdGlmKGF1dG9zdGFydCAhPT0gZmFsc2UpIHtcblx0XHR0aGlzLnN0YXJ0KCk7XG5cdH1cblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsb2NrO1xuXG5DbG9jay5wcm90b3R5cGUgPSB7XG5cblx0c3RhcnQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnBUaW1lID0gRGF0ZS5ub3coKTtcblx0fSxcblx0XG5cdGdldERlbHRhIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vdywgZHQ7XG5cdFx0XG5cdFx0bm93ID0gRGF0ZS5ub3coKTtcblx0XHRkdCA9IG5vdyAtIHRoaXMucFRpbWU7XG5cdFx0XG5cdFx0ZHQgPSBNYXRoLm1pbiggZHQsIHRoaXMubWF4RHQgKTtcblx0XHRkdCA9IE1hdGgubWF4KCBkdCwgdGhpcy5taW5EdCApO1xuXHRcdFxuXHRcdHRoaXMudGltZSArPSBkdDtcblx0XHR0aGlzLnBUaW1lID0gbm93O1xuXHRcdFxuXHRcdHJldHVybiBkdDtcblx0fVxuXHRcbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG5cbnZhciBDb2xsaWRlciA9IGZ1bmN0aW9uKCBwb2VtLCBnZXRDb2xsZWN0aW9uQSwgZ2V0Q29sbGVjdGlvbkIsIG9uQ29sbGlzaW9uICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0XG5cdHRoaXMuZ2V0Q29sbGVjdGlvbkEgPSBnZXRDb2xsZWN0aW9uQTtcblx0dGhpcy5nZXRDb2xsZWN0aW9uQiA9IGdldENvbGxlY3Rpb25CO1xuXHR0aGlzLm9uQ29sbGlzaW9uID0gb25Db2xsaXNpb247XG5cdFxuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sbGlkZXI7XG5cbkNvbGxpZGVyLnByb3RvdHlwZSA9IHtcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXG5cdFx0dmFyIGNvbGxpc2lvbnMgPSBbXTtcblxuXHRcdF8uZWFjaCggdGhpcy5nZXRDb2xsZWN0aW9uQSgpLCBmdW5jdGlvbiggaXRlbUZyb21BICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgY29sbGlkZWRJdGVtRnJvbUIgPSBfLmZpbmQoIHRoaXMuZ2V0Q29sbGVjdGlvbkIoKSwgZnVuY3Rpb24oIGl0ZW1Gcm9tQiApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFxuXHRcdFx0XHR2YXIgZHgsIGR5LCBkaXN0YW5jZTtcblx0XHRcdFxuXHRcdFx0XHRkeCA9IHRoaXMucG9lbS5jb29yZGluYXRlcy5jaXJjdW1mZXJlbmNlRGlzdGFuY2UoIGl0ZW1Gcm9tQS5wb3NpdGlvbi54LCBpdGVtRnJvbUIucG9zaXRpb24ueCApO1xuXHRcdFx0XHRkeSA9IGl0ZW1Gcm9tQS5wb3NpdGlvbi55IC0gaXRlbUZyb21CLnBvc2l0aW9uLnk7XG5cdFx0XHRcblx0XHRcdFx0ZGlzdGFuY2UgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXHRcdFx0XHRcblx0XHRcdFxuXHRcdFx0XHRyZXR1cm4gZGlzdGFuY2UgPCBpdGVtRnJvbUEucmFkaXVzICsgaXRlbUZyb21CLnJhZGl1cztcblx0XHRcdFx0XG5cdFx0XHR9LCB0aGlzKTtcblx0XHRcdFxuXHRcdFx0XG5cdFx0XHRpZiggY29sbGlkZWRJdGVtRnJvbUIgKSB7XG5cdFx0XHRcdGNvbGxpc2lvbnMucHVzaChbaXRlbUZyb21BLCBjb2xsaWRlZEl0ZW1Gcm9tQl0pO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0Xy5lYWNoKCBjb2xsaXNpb25zLCBmdW5jdGlvbiggaXRlbXMgKSB7XG5cdFx0XHR0aGlzLm9uQ29sbGlzaW9uKCBpdGVtc1swXSwgaXRlbXNbMV0gKTtcblx0XHR9LCB0aGlzKTtcblx0fVxuXHRcbn07IiwiLy8gVHJhbnNsYXRlcyAyZCBwb2ludHMgaW50byAzZCBwb2xhciBzcGFjZVxuXG52YXIgQ29vcmRpbmF0ZXMgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy50d29SU3F1YXJlZCA9IDIgKiAodGhpcy5wb2VtLnIgKiB0aGlzLnBvZW0ucik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvb3JkaW5hdGVzO1xuXG5Db29yZGluYXRlcy5wcm90b3R5cGUgPSB7XG5cdFxuXHR4IDogZnVuY3Rpb24oIHggKSB7XG5cdFx0cmV0dXJuIE1hdGguc2luKCB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdH0sXG5cdFxuXHR5IDogZnVuY3Rpb24oIHkgKSB7XG5cdFx0cmV0dXJuIHk7XG5cdH0sXG5cdFxuXHR6IDogZnVuY3Rpb24oIHggKSB7XG5cdFx0cmV0dXJuIE1hdGguY29zKCB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdH0sXG5cdFxuXHRyIDogZnVuY3Rpb24oeCwgeikge1xuXHRcdHJldHVybiBNYXRoLnNxcnQoeCp4ICsgeip6KTtcblx0fSxcblx0XG5cdHRoZXRhIDogZnVuY3Rpb24oeCwgeikge1xuXHRcdHJldHVybiBNYXRoLmF0YW4oIHogLyB4ICk7XG5cdH0sXG5cdFxuXHRzZXRWZWN0b3IgOiBmdW5jdGlvbiggdmVjdG9yICkge1xuXHRcdFxuXHRcdHZhciB4LCB5LCB2ZWN0b3IyO1xuXHRcdFxuXHRcdGlmKCB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcIm51bWJlclwiICkge1xuXHRcdFx0XG5cdFx0XHR4ID0gYXJndW1lbnRzWzFdO1xuXHRcdFx0eSA9IGFyZ3VtZW50c1syXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh4KSxcblx0XHRcdFx0eSxcblx0XHRcdFx0dGhpcy56KHgpXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dmVjdG9yMiA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh2ZWN0b3IyLngpLFxuXHRcdFx0XHR2ZWN0b3IyLnksXG5cdFx0XHRcdHRoaXMueih2ZWN0b3IyLngpXG5cdFx0XHQpO1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGdldFZlY3RvciA6IGZ1bmN0aW9uKCB4LCB5ICkge1xuXHRcdFxuXHRcdHZhciB2ZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdHJldHVybiB0aGlzLnNldFZlY3RvciggdmVjdG9yLCB4LCB5ICk7XG5cdFx0XG5cdH0sXG5cdFxuXHRrZWVwSW5SYW5nZVggOiBmdW5jdGlvbiggeCApIHtcblx0XHRpZiggeCA+PSAwICkge1xuXHRcdFx0cmV0dXJuIHggJSB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHggKyAoeCAlIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlKTtcblx0XHR9XG5cdH0sXG5cdFxuXHRrZWVwSW5SYW5nZVkgOiBmdW5jdGlvbiggeSApIHtcblx0XHRpZiggeSA+PSAwICkge1xuXHRcdFx0cmV0dXJuIHkgJSB0aGlzLnBvZW0uaGVpZ2h0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geSArICh5ICUgdGhpcy5wb2VtLmhlaWdodCk7XG5cdFx0fVxuXHR9LFxuXHRcblx0a2VlcEluUmFuZ2UgOiBmdW5jdGlvbiggdmVjdG9yICkge1xuXHRcdHZlY3Rvci54ID0gdGhpcy5rZWVwSW5SYW5nZVgoIHZlY3Rvci54ICk7XG5cdFx0dmVjdG9yLnkgPSB0aGlzLmtlZXBJblJhbmdlWSggdmVjdG9yLnkgKTtcblx0XHRyZXR1cm4gdmVjdG9yO1xuXHR9LFxuXHRcblx0a2VlcERpZmZJblJhbmdlIDogZnVuY3Rpb24oIGRpZmYgKSB7XG5cdFx0XG5cdFx0dmFyIHhXaWR0aCA9IHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdFxuXHRcdHdoaWxlKCBkaWZmIDw9IHhXaWR0aCAvIC0yICkgZGlmZiArPSB4V2lkdGg7XG5cdFx0d2hpbGUoIGRpZmYgPiB4V2lkdGggLyAyICkgZGlmZiAtPSB4V2lkdGg7XG5cdFx0XG5cdFx0cmV0dXJuIGRpZmY7XG5cdH0sXG5cdFxuXHR0d29YVG9UaGV0YSA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbztcblx0fSxcblx0XG5cdGNpcmN1bWZlcmVuY2VEaXN0YW5jZSA6IGZ1bmN0aW9uICh4MSwgeDIpIHtcblx0XHRcblx0XHR2YXIgcmF0aW8gPSB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFxuXHRcdHJldHVybiB0aGlzLnR3b1JTcXVhcmVkIC0gdGhpcy50d29SU3F1YXJlZCAqIE1hdGguY29zKCB4MSAqIHJhdGlvIC0geDIgKiByYXRpbyApO1xuXHRcdFxuXHR9XG5cdFxufTtcbiIsIi8qKlxuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqXG4gKiBNb2RpZmljYXRpb25zOiBHcmVnIFRhdHVtXG4gKlxuICogdXNhZ2U6XG4gKiBcbiAqIFx0XHRFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBNeU9iamVjdC5wcm90b3R5cGUgKTtcbiAqIFxuICogXHRcdE15T2JqZWN0LmRpc3BhdGNoKHtcbiAqIFx0XHRcdHR5cGU6IFwiY2xpY2tcIixcbiAqIFx0XHRcdGRhdHVtMTogXCJmb29cIixcbiAqIFx0XHRcdGRhdHVtMjogXCJiYXJcIlxuICogXHRcdH0pO1xuICogXG4gKiBcdFx0TXlPYmplY3Qub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2ZW50ICkge1xuICogXHRcdFx0ZXZlbnQuZGF0dW0xOyAvL0Zvb1xuICogXHRcdFx0ZXZlbnQudGFyZ2V0OyAvL015T2JqZWN0XG4gKiBcdFx0fSk7XG4gKiBcbiAqXG4gKi9cblxudmFyIEV2ZW50RGlzcGF0Y2hlciA9IGZ1bmN0aW9uICgpIHt9O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlID0ge1xuXG5cdGNvbnN0cnVjdG9yOiBFdmVudERpc3BhdGNoZXIsXG5cblx0YXBwbHk6IGZ1bmN0aW9uICggb2JqZWN0ICkge1xuXG5cdFx0b2JqZWN0Lm9uXHRcdFx0XHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5vbjtcblx0XHRvYmplY3QuaGFzRXZlbnRMaXN0ZW5lclx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuaGFzRXZlbnRMaXN0ZW5lcjtcblx0XHRvYmplY3Qub2ZmXHRcdFx0XHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5vZmY7XG5cdFx0b2JqZWN0LmRpc3BhdGNoXHRcdFx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2g7XG5cblx0fSxcblxuXHRvbjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdID09PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGxpc3RlbmVyc1sgdHlwZSBdID0gW107XG5cblx0XHR9XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICkgPT09IC0gMSApIHtcblxuXHRcdFx0bGlzdGVuZXJzWyB0eXBlIF0ucHVzaCggbGlzdGVuZXIgKTtcblxuXHRcdH1cblxuXHR9LFxuXG5cdGhhc0V2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblxuXHRcdGlmICggbGlzdGVuZXJzWyB0eXBlIF0gIT09IHVuZGVmaW5lZCAmJiBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApICE9PSAtIDEgKSB7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXG5cdH0sXG5cblx0b2ZmOiBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG5cdFx0aWYgKCB0aGlzLl9saXN0ZW5lcnMgPT09IHVuZGVmaW5lZCApIHJldHVybjtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cdFx0dmFyIGxpc3RlbmVyQXJyYXkgPSBsaXN0ZW5lcnNbIHR5cGUgXTtcblxuXHRcdGlmICggbGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHR2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YoIGxpc3RlbmVyICk7XG5cblx0XHRcdGlmICggaW5kZXggIT09IC0gMSApIHtcblxuXHRcdFx0XHRsaXN0ZW5lckFycmF5LnNwbGljZSggaW5kZXgsIDEgKTtcblxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdH0sXG5cblx0ZGlzcGF0Y2g6IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblx0XHR2YXIgbGlzdGVuZXJBcnJheSA9IGxpc3RlbmVyc1sgZXZlbnQudHlwZSBdO1xuXG5cdFx0aWYgKCBsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGV2ZW50LnRhcmdldCA9IHRoaXM7XG5cblx0XHRcdHZhciBhcnJheSA9IFtdO1xuXHRcdFx0dmFyIGxlbmd0aCA9IGxpc3RlbmVyQXJyYXkubGVuZ3RoO1xuXHRcdFx0dmFyIGk7XG5cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICsrICkge1xuXG5cdFx0XHRcdGFycmF5WyBpIF0gPSBsaXN0ZW5lckFycmF5WyBpIF07XG5cblx0XHRcdH1cblxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0YXJyYXlbIGkgXS5jYWxsKCB0aGlzLCBldmVudCApO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0fVxuXG59O1xuXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICkge1xuXG5cdG1vZHVsZS5leHBvcnRzID0gRXZlbnREaXNwYXRjaGVyO1xuXG59IiwiLyoqXG4gKiBAYXV0aG9yIG1yZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBTdGF0cyA9IGZ1bmN0aW9uICgpIHtcblxuXHR2YXIgc3RhcnRUaW1lID0gRGF0ZS5ub3coKSwgcHJldlRpbWUgPSBzdGFydFRpbWU7XG5cdHZhciBtcyA9IDAsIG1zTWluID0gSW5maW5pdHksIG1zTWF4ID0gMDtcblx0dmFyIGZwcyA9IDAsIGZwc01pbiA9IEluZmluaXR5LCBmcHNNYXggPSAwO1xuXHR2YXIgZnJhbWVzID0gMCwgbW9kZSA9IDA7XG5cblx0dmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGNvbnRhaW5lci5pZCA9ICdzdGF0cyc7XG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgc2V0TW9kZSggKysgbW9kZSAlIDIgKTsgfSwgZmFsc2UgKTtcblx0Y29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6ODBweDtvcGFjaXR5OjAuOTtjdXJzb3I6cG9pbnRlcic7XG5cblx0dmFyIGZwc0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGZwc0Rpdi5pZCA9ICdmcHMnO1xuXHRmcHNEaXYuc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjAgMCAzcHggM3B4O3RleHQtYWxpZ246bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMwMDInO1xuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIGZwc0RpdiApO1xuXG5cdHZhciBmcHNUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ZnBzVGV4dC5pZCA9ICdmcHNUZXh0Jztcblx0ZnBzVGV4dC5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOiMwZmY7Zm9udC1mYW1pbHk6SGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWY7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDpib2xkO2xpbmUtaGVpZ2h0OjE1cHgnO1xuXHRmcHNUZXh0LmlubmVySFRNTCA9ICdGUFMnO1xuXHRmcHNEaXYuYXBwZW5kQ2hpbGQoIGZwc1RleHQgKTtcblxuXHR2YXIgZnBzR3JhcGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRmcHNHcmFwaC5pZCA9ICdmcHNHcmFwaCc7XG5cdGZwc0dyYXBoLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246cmVsYXRpdmU7d2lkdGg6NzRweDtoZWlnaHQ6MzBweDtiYWNrZ3JvdW5kLWNvbG9yOiMwZmYnO1xuXHRmcHNEaXYuYXBwZW5kQ2hpbGQoIGZwc0dyYXBoICk7XG5cblx0d2hpbGUgKCBmcHNHcmFwaC5jaGlsZHJlbi5sZW5ndGggPCA3NCApIHtcblxuXHRcdHZhciBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRiYXIuc3R5bGUuY3NzVGV4dCA9ICd3aWR0aDoxcHg7aGVpZ2h0OjMwcHg7ZmxvYXQ6bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMxMTMnO1xuXHRcdGZwc0dyYXBoLmFwcGVuZENoaWxkKCBiYXIgKTtcblxuXHR9XG5cblx0dmFyIG1zRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNEaXYuaWQgPSAnbXMnO1xuXHRtc0Rpdi5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6MCAwIDNweCAzcHg7dGV4dC1hbGlnbjpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzAyMDtkaXNwbGF5Om5vbmUnO1xuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIG1zRGl2ICk7XG5cblx0dmFyIG1zVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdG1zVGV4dC5pZCA9ICdtc1RleHQnO1xuXHRtc1RleHQuc3R5bGUuY3NzVGV4dCA9ICdjb2xvcjojMGYwO2ZvbnQtZmFtaWx5OkhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmO2ZvbnQtc2l6ZTo5cHg7Zm9udC13ZWlnaHQ6Ym9sZDtsaW5lLWhlaWdodDoxNXB4Jztcblx0bXNUZXh0LmlubmVySFRNTCA9ICdNUyc7XG5cdG1zRGl2LmFwcGVuZENoaWxkKCBtc1RleHQgKTtcblxuXHR2YXIgbXNHcmFwaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdG1zR3JhcGguaWQgPSAnbXNHcmFwaCc7XG5cdG1zR3JhcGguc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDo3NHB4O2hlaWdodDozMHB4O2JhY2tncm91bmQtY29sb3I6IzBmMCc7XG5cdG1zRGl2LmFwcGVuZENoaWxkKCBtc0dyYXBoICk7XG5cblx0d2hpbGUgKCBtc0dyYXBoLmNoaWxkcmVuLmxlbmd0aCA8IDc0ICkge1xuXG5cdFx0dmFyIGJhcjIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRiYXIyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6MXB4O2hlaWdodDozMHB4O2Zsb2F0OmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMTMxJztcblx0XHRtc0dyYXBoLmFwcGVuZENoaWxkKCBiYXIyICk7XG5cblx0fVxuXG5cdHZhciBzZXRNb2RlID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcblxuXHRcdG1vZGUgPSB2YWx1ZTtcblxuXHRcdHN3aXRjaCAoIG1vZGUgKSB7XG5cblx0XHRcdGNhc2UgMDpcblx0XHRcdFx0ZnBzRGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHRtc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0ZnBzRGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdG1zRGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0fTtcblxuXHR2YXIgdXBkYXRlR3JhcGggPSBmdW5jdGlvbiAoIGRvbSwgdmFsdWUgKSB7XG5cblx0XHR2YXIgY2hpbGQgPSBkb20uYXBwZW5kQ2hpbGQoIGRvbS5maXJzdENoaWxkICk7XG5cdFx0Y2hpbGQuc3R5bGUuaGVpZ2h0ID0gdmFsdWUgKyAncHgnO1xuXG5cdH07XG5cblx0cmV0dXJuIHtcblxuXHRcdFJFVklTSU9OOiAxMixcblxuXHRcdGRvbUVsZW1lbnQ6IGNvbnRhaW5lcixcblxuXHRcdHNldE1vZGU6IHNldE1vZGUsXG5cblx0XHRiZWdpbjogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0fSxcblxuXHRcdGVuZDogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHR2YXIgdGltZSA9IERhdGUubm93KCk7XG5cblx0XHRcdG1zID0gdGltZSAtIHN0YXJ0VGltZTtcblx0XHRcdG1zTWluID0gTWF0aC5taW4oIG1zTWluLCBtcyApO1xuXHRcdFx0bXNNYXggPSBNYXRoLm1heCggbXNNYXgsIG1zICk7XG5cblx0XHRcdG1zVGV4dC50ZXh0Q29udGVudCA9IG1zICsgJyBNUyAoJyArIG1zTWluICsgJy0nICsgbXNNYXggKyAnKSc7XG5cdFx0XHR1cGRhdGVHcmFwaCggbXNHcmFwaCwgTWF0aC5taW4oIDMwLCAzMCAtICggbXMgLyAyMDAgKSAqIDMwICkgKTtcblxuXHRcdFx0ZnJhbWVzICsrO1xuXG5cdFx0XHRpZiAoIHRpbWUgPiBwcmV2VGltZSArIDEwMDAgKSB7XG5cblx0XHRcdFx0ZnBzID0gTWF0aC5yb3VuZCggKCBmcmFtZXMgKiAxMDAwICkgLyAoIHRpbWUgLSBwcmV2VGltZSApICk7XG5cdFx0XHRcdGZwc01pbiA9IE1hdGgubWluKCBmcHNNaW4sIGZwcyApO1xuXHRcdFx0XHRmcHNNYXggPSBNYXRoLm1heCggZnBzTWF4LCBmcHMgKTtcblxuXHRcdFx0XHRmcHNUZXh0LnRleHRDb250ZW50ID0gZnBzICsgJyBGUFMgKCcgKyBmcHNNaW4gKyAnLScgKyBmcHNNYXggKyAnKSc7XG5cdFx0XHRcdHVwZGF0ZUdyYXBoKCBmcHNHcmFwaCwgTWF0aC5taW4oIDMwLCAzMCAtICggZnBzIC8gMTAwICkgKiAzMCApICk7XG5cblx0XHRcdFx0cHJldlRpbWUgPSB0aW1lO1xuXHRcdFx0XHRmcmFtZXMgPSAwO1xuXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aW1lO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRzdGFydFRpbWUgPSB0aGlzLmVuZCgpO1xuXG5cdFx0fVxuXG5cdH07XG5cbn07XG5cbmlmICggdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgKSB7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBTdGF0cztcblxufSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVzdHJveU1lc2goIG9iaiApIHtcblx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdGlmKCBvYmouZ2VvbWV0cnkgKSBvYmouZ2VvbWV0cnkuZGlzcG9zZSgpO1xuXHRcdGlmKCBvYmoubWF0ZXJpYWwgKSBvYmoubWF0ZXJpYWwuZGlzcG9zZSgpO1xuXHR9O1xufTsiLCJ2YXIgcmFuZG9tID0ge1xuXHRcblx0ZmxpcCA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBNYXRoLnJhbmRvbSgpID4gMC41ID8gdHJ1ZTogZmFsc2U7XG5cdH0sXG5cdFxuXHRyYW5nZSA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0cmV0dXJuIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcblx0fSxcblx0XG5cdHJhbmdlSW50IDogZnVuY3Rpb24obWluLCBtYXgpIHtcblx0XHRyZXR1cm4gTWF0aC5mbG9vciggdGhpcy5yYW5nZShtaW4sIG1heCArIDEpICk7XG5cdH0sXG5cdFxuXHRyYW5nZUxvdyA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0Ly9Nb3JlIGxpa2VseSB0byByZXR1cm4gYSBsb3cgdmFsdWVcblx0ICByZXR1cm4gTWF0aC5yYW5kb20oKSAqIE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluKSArIG1pbjtcblx0fSxcblx0XG5cdHJhbmdlSGlnaCA6IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG5cdFx0Ly9Nb3JlIGxpa2VseSB0byByZXR1cm4gYSBoaWdoIHZhbHVlXG5cdFx0cmV0dXJuICgxIC0gTWF0aC5yYW5kb20oKSAqIE1hdGgucmFuZG9tKCkpICogKG1heCAtIG1pbikgKyBtaW47XG5cdH1cblx0IFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSByYW5kb207XG4iLCJ2YXIgc2VsZWN0b3JzID0gZnVuY3Rpb24oIHNjb3BlT3JTZWxlY3Rvciwgc2VsZWN0b3JzLCBhbGxvd0VtcHR5U2VsZWN0aW9ucyApIHtcblx0XG5cdHZhciAkc2NvcGUgPSAkKCBzY29wZU9yU2VsZWN0b3IgKTtcblx0XG5cdHJldHVybiBfLnJlZHVjZSggc2VsZWN0b3JzLCBmdW5jdGlvbiggbWVtbywgc2VsZWN0b3IsIGtleSApIHtcblx0XHRcblx0XHRtZW1vW2tleV0gPSAkKCBzZWxlY3RvciwgJHNjb3BlICk7XG5cdFx0XG5cdFx0aWYoICFhbGxvd0VtcHR5U2VsZWN0aW9ucyApIHtcblx0XHRcdGlmKCBtZW1vW2tleV0ubGVuZ3RoID09PSAwICkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJFbXB0eSBzZWxlY3Rpb25zIGFyZSBub3QgYWxsb3dlZFwiKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIG1lbW87XG5cdFx0XG5cdH0sIHsgXCJzY29wZVwiIDogJHNjb3BlIH0gKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNlbGVjdG9ycztcbiIsIi8qKiBAbGljZW5zZVxuICogY3Jvc3Nyb2FkcyA8aHR0cDovL21pbGxlcm1lZGVpcm9zLmdpdGh1Yi5jb20vY3Jvc3Nyb2Fkcy5qcy8+XG4gKiBBdXRob3I6IE1pbGxlciBNZWRlaXJvcyB8IE1JVCBMaWNlbnNlXG4gKiB2MC4xMi4wICgyMDEzLzAxLzIxIDEzOjQ3KVxuICovXG5cbihmdW5jdGlvbiAoKSB7XG52YXIgZmFjdG9yeSA9IGZ1bmN0aW9uIChzaWduYWxzKSB7XG5cbiAgICB2YXIgY3Jvc3Nyb2FkcyxcbiAgICAgICAgX2hhc09wdGlvbmFsR3JvdXBCdWcsXG4gICAgICAgIFVOREVGO1xuXG4gICAgLy8gSGVscGVycyAtLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIElFIDctOCBjYXB0dXJlIG9wdGlvbmFsIGdyb3VwcyBhcyBlbXB0eSBzdHJpbmdzIHdoaWxlIG90aGVyIGJyb3dzZXJzXG4gICAgLy8gY2FwdHVyZSBhcyBgdW5kZWZpbmVkYFxuICAgIF9oYXNPcHRpb25hbEdyb3VwQnVnID0gKC90KC4rKT8vKS5leGVjKCd0JylbMV0gPT09ICcnO1xuXG4gICAgZnVuY3Rpb24gYXJyYXlJbmRleE9mKGFyciwgdmFsKSB7XG4gICAgICAgIGlmIChhcnIuaW5kZXhPZikge1xuICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKHZhbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL0FycmF5LmluZGV4T2YgZG9lc24ndCB3b3JrIG9uIElFIDYtN1xuICAgICAgICAgICAgdmFyIG4gPSBhcnIubGVuZ3RoO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIGlmIChhcnJbbl0gPT09IHZhbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhcnJheVJlbW92ZShhcnIsIGl0ZW0pIHtcbiAgICAgICAgdmFyIGkgPSBhcnJheUluZGV4T2YoYXJyLCBpdGVtKTtcbiAgICAgICAgaWYgKGkgIT09IC0xKSB7XG4gICAgICAgICAgICBhcnIuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNLaW5kKHZhbCwga2luZCkge1xuICAgICAgICByZXR1cm4gJ1tvYmplY3QgJysga2luZCArJ10nID09PSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc1JlZ0V4cCh2YWwpIHtcbiAgICAgICAgcmV0dXJuIGlzS2luZCh2YWwsICdSZWdFeHAnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0FycmF5KHZhbCkge1xuICAgICAgICByZXR1cm4gaXNLaW5kKHZhbCwgJ0FycmF5Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbih2YWwpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbic7XG4gICAgfVxuXG4gICAgLy9ib3Jyb3dlZCBmcm9tIEFNRC11dGlsc1xuICAgIGZ1bmN0aW9uIHR5cGVjYXN0VmFsdWUodmFsKSB7XG4gICAgICAgIHZhciByO1xuICAgICAgICBpZiAodmFsID09PSBudWxsIHx8IHZhbCA9PT0gJ251bGwnKSB7XG4gICAgICAgICAgICByID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICh2YWwgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgciA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICByID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSBVTkRFRiB8fCB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByID0gVU5ERUY7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsID09PSAnJyB8fCBpc05hTih2YWwpKSB7XG4gICAgICAgICAgICAvL2lzTmFOKCcnKSByZXR1cm5zIGZhbHNlXG4gICAgICAgICAgICByID0gdmFsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9wYXJzZUZsb2F0KG51bGwgfHwgJycpIHJldHVybnMgTmFOXG4gICAgICAgICAgICByID0gcGFyc2VGbG9hdCh2YWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHR5cGVjYXN0QXJyYXlWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgIHZhciBuID0gdmFsdWVzLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICByZXN1bHRbbl0gPSB0eXBlY2FzdFZhbHVlKHZhbHVlc1tuXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvL2JvcnJvd2VkIGZyb20gQU1ELVV0aWxzXG4gICAgZnVuY3Rpb24gZGVjb2RlUXVlcnlTdHJpbmcoc3RyLCBzaG91bGRUeXBlY2FzdCkge1xuICAgICAgICB2YXIgcXVlcnlBcnIgPSAoc3RyIHx8ICcnKS5yZXBsYWNlKCc/JywgJycpLnNwbGl0KCcmJyksXG4gICAgICAgICAgICBuID0gcXVlcnlBcnIubGVuZ3RoLFxuICAgICAgICAgICAgb2JqID0ge30sXG4gICAgICAgICAgICBpdGVtLCB2YWw7XG4gICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgIGl0ZW0gPSBxdWVyeUFycltuXS5zcGxpdCgnPScpO1xuICAgICAgICAgICAgdmFsID0gc2hvdWxkVHlwZWNhc3QgPyB0eXBlY2FzdFZhbHVlKGl0ZW1bMV0pIDogaXRlbVsxXTtcbiAgICAgICAgICAgIG9ialtpdGVtWzBdXSA9ICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJyk/IGRlY29kZVVSSUNvbXBvbmVudCh2YWwpIDogdmFsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuXG5cbiAgICAvLyBDcm9zc3JvYWRzIC0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgZnVuY3Rpb24gQ3Jvc3Nyb2FkcygpIHtcbiAgICAgICAgdGhpcy5ieXBhc3NlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICB0aGlzLnJvdXRlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICB0aGlzLl9yb3V0ZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlJvdXRlcyA9IFtdO1xuICAgICAgICB0aGlzLl9waXBlZCA9IFtdO1xuICAgICAgICB0aGlzLnJlc2V0U3RhdGUoKTtcbiAgICB9XG5cbiAgICBDcm9zc3JvYWRzLnByb3RvdHlwZSA9IHtcblxuICAgICAgICBncmVlZHkgOiBmYWxzZSxcblxuICAgICAgICBncmVlZHlFbmFibGVkIDogdHJ1ZSxcblxuICAgICAgICBpZ25vcmVDYXNlIDogdHJ1ZSxcblxuICAgICAgICBpZ25vcmVTdGF0ZSA6IGZhbHNlLFxuXG4gICAgICAgIHNob3VsZFR5cGVjYXN0IDogZmFsc2UsXG5cbiAgICAgICAgbm9ybWFsaXplRm4gOiBudWxsLFxuXG4gICAgICAgIHJlc2V0U3RhdGUgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlJvdXRlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5fcHJldk1hdGNoZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3ByZXZCeXBhc3NlZFJlcXVlc3QgPSBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIGNyZWF0ZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQ3Jvc3Nyb2FkcygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFkZFJvdXRlIDogZnVuY3Rpb24gKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSkge1xuICAgICAgICAgICAgdmFyIHJvdXRlID0gbmV3IFJvdXRlKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9zb3J0ZWRJbnNlcnQocm91dGUpO1xuICAgICAgICAgICAgcmV0dXJuIHJvdXRlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlbW92ZVJvdXRlIDogZnVuY3Rpb24gKHJvdXRlKSB7XG4gICAgICAgICAgICBhcnJheVJlbW92ZSh0aGlzLl9yb3V0ZXMsIHJvdXRlKTtcbiAgICAgICAgICAgIHJvdXRlLl9kZXN0cm95KCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcmVtb3ZlQWxsUm91dGVzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLmdldE51bVJvdXRlcygpO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JvdXRlc1tuXS5fZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcm91dGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyc2UgOiBmdW5jdGlvbiAocmVxdWVzdCwgZGVmYXVsdEFyZ3MpIHtcbiAgICAgICAgICAgIHJlcXVlc3QgPSByZXF1ZXN0IHx8ICcnO1xuICAgICAgICAgICAgZGVmYXVsdEFyZ3MgPSBkZWZhdWx0QXJncyB8fCBbXTtcblxuICAgICAgICAgICAgLy8gc2hvdWxkIG9ubHkgY2FyZSBhYm91dCBkaWZmZXJlbnQgcmVxdWVzdHMgaWYgaWdub3JlU3RhdGUgaXNuJ3QgdHJ1ZVxuICAgICAgICAgICAgaWYgKCAhdGhpcy5pZ25vcmVTdGF0ZSAmJlxuICAgICAgICAgICAgICAgIChyZXF1ZXN0ID09PSB0aGlzLl9wcmV2TWF0Y2hlZFJlcXVlc3QgfHxcbiAgICAgICAgICAgICAgICAgcmVxdWVzdCA9PT0gdGhpcy5fcHJldkJ5cGFzc2VkUmVxdWVzdCkgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcm91dGVzID0gdGhpcy5fZ2V0TWF0Y2hlZFJvdXRlcyhyZXF1ZXN0KSxcbiAgICAgICAgICAgICAgICBpID0gMCxcbiAgICAgICAgICAgICAgICBuID0gcm91dGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG5cbiAgICAgICAgICAgIGlmIChuKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldk1hdGNoZWRSZXF1ZXN0ID0gcmVxdWVzdDtcblxuICAgICAgICAgICAgICAgIHRoaXMuX25vdGlmeVByZXZSb3V0ZXMocm91dGVzLCByZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmV2Um91dGVzID0gcm91dGVzO1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGJlIGluY3JlbWVudGFsIGxvb3AsIGV4ZWN1dGUgcm91dGVzIGluIG9yZGVyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBuKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ciA9IHJvdXRlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY3VyLnJvdXRlLm1hdGNoZWQuZGlzcGF0Y2guYXBwbHkoY3VyLnJvdXRlLm1hdGNoZWQsIGRlZmF1bHRBcmdzLmNvbmNhdChjdXIucGFyYW1zKSk7XG4gICAgICAgICAgICAgICAgICAgIGN1ci5pc0ZpcnN0ID0gIWk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucm91dGVkLmRpc3BhdGNoLmFwcGx5KHRoaXMucm91dGVkLCBkZWZhdWx0QXJncy5jb25jYXQoW3JlcXVlc3QsIGN1cl0pKTtcbiAgICAgICAgICAgICAgICAgICAgaSArPSAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldkJ5cGFzc2VkUmVxdWVzdCA9IHJlcXVlc3Q7XG4gICAgICAgICAgICAgICAgdGhpcy5ieXBhc3NlZC5kaXNwYXRjaC5hcHBseSh0aGlzLmJ5cGFzc2VkLCBkZWZhdWx0QXJncy5jb25jYXQoW3JlcXVlc3RdKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3BpcGVQYXJzZShyZXF1ZXN0LCBkZWZhdWx0QXJncyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX25vdGlmeVByZXZSb3V0ZXMgOiBmdW5jdGlvbihtYXRjaGVkUm91dGVzLCByZXF1ZXN0KSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIHByZXY7XG4gICAgICAgICAgICB3aGlsZSAocHJldiA9IHRoaXMuX3ByZXZSb3V0ZXNbaSsrXSkge1xuICAgICAgICAgICAgICAgIC8vY2hlY2sgaWYgc3dpdGNoZWQgZXhpc3Qgc2luY2Ugcm91dGUgbWF5IGJlIGRpc3Bvc2VkXG4gICAgICAgICAgICAgICAgaWYocHJldi5yb3V0ZS5zd2l0Y2hlZCAmJiB0aGlzLl9kaWRTd2l0Y2gocHJldi5yb3V0ZSwgbWF0Y2hlZFJvdXRlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJldi5yb3V0ZS5zd2l0Y2hlZC5kaXNwYXRjaChyZXF1ZXN0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2RpZFN3aXRjaCA6IGZ1bmN0aW9uIChyb3V0ZSwgbWF0Y2hlZFJvdXRlcyl7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlZCxcbiAgICAgICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlIChtYXRjaGVkID0gbWF0Y2hlZFJvdXRlc1tpKytdKSB7XG4gICAgICAgICAgICAgICAgLy8gb25seSBkaXNwYXRjaCBzd2l0Y2hlZCBpZiBpdCBpcyBnb2luZyB0byBhIGRpZmZlcmVudCByb3V0ZVxuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkLnJvdXRlID09PSByb3V0ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX3BpcGVQYXJzZSA6IGZ1bmN0aW9uKHJlcXVlc3QsIGRlZmF1bHRBcmdzKSB7XG4gICAgICAgICAgICB2YXIgaSA9IDAsIHJvdXRlO1xuICAgICAgICAgICAgd2hpbGUgKHJvdXRlID0gdGhpcy5fcGlwZWRbaSsrXSkge1xuICAgICAgICAgICAgICAgIHJvdXRlLnBhcnNlKHJlcXVlc3QsIGRlZmF1bHRBcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBnZXROdW1Sb3V0ZXMgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcm91dGVzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICBfc29ydGVkSW5zZXJ0IDogZnVuY3Rpb24gKHJvdXRlKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciByb3V0ZXMgPSB0aGlzLl9yb3V0ZXMsXG4gICAgICAgICAgICAgICAgbiA9IHJvdXRlcy5sZW5ndGg7XG4gICAgICAgICAgICBkbyB7IC0tbjsgfSB3aGlsZSAocm91dGVzW25dICYmIHJvdXRlLl9wcmlvcml0eSA8PSByb3V0ZXNbbl0uX3ByaW9yaXR5KTtcbiAgICAgICAgICAgIHJvdXRlcy5zcGxpY2UobisxLCAwLCByb3V0ZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2dldE1hdGNoZWRSb3V0ZXMgOiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICAgICAgdmFyIHJlcyA9IFtdLFxuICAgICAgICAgICAgICAgIHJvdXRlcyA9IHRoaXMuX3JvdXRlcyxcbiAgICAgICAgICAgICAgICBuID0gcm91dGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICByb3V0ZTtcbiAgICAgICAgICAgIC8vc2hvdWxkIGJlIGRlY3JlbWVudCBsb29wIHNpbmNlIGhpZ2hlciBwcmlvcml0aWVzIGFyZSBhZGRlZCBhdCB0aGUgZW5kIG9mIGFycmF5XG4gICAgICAgICAgICB3aGlsZSAocm91dGUgPSByb3V0ZXNbLS1uXSkge1xuICAgICAgICAgICAgICAgIGlmICgoIXJlcy5sZW5ndGggfHwgdGhpcy5ncmVlZHkgfHwgcm91dGUuZ3JlZWR5KSAmJiByb3V0ZS5tYXRjaChyZXF1ZXN0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3V0ZSA6IHJvdXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zIDogcm91dGUuX2dldFBhcmFtc0FycmF5KHJlcXVlc3QpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZ3JlZWR5RW5hYmxlZCAmJiByZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGlwZSA6IGZ1bmN0aW9uIChvdGhlclJvdXRlcikge1xuICAgICAgICAgICAgdGhpcy5fcGlwZWQucHVzaChvdGhlclJvdXRlcik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdW5waXBlIDogZnVuY3Rpb24gKG90aGVyUm91dGVyKSB7XG4gICAgICAgICAgICBhcnJheVJlbW92ZSh0aGlzLl9waXBlZCwgb3RoZXJSb3V0ZXIpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbY3Jvc3Nyb2FkcyBudW1Sb3V0ZXM6JysgdGhpcy5nZXROdW1Sb3V0ZXMoKSArJ10nO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vXCJzdGF0aWNcIiBpbnN0YW5jZVxuICAgIGNyb3Nzcm9hZHMgPSBuZXcgQ3Jvc3Nyb2FkcygpO1xuICAgIGNyb3Nzcm9hZHMuVkVSU0lPTiA9ICcwLjEyLjAnO1xuXG4gICAgY3Jvc3Nyb2Fkcy5OT1JNX0FTX0FSUkFZID0gZnVuY3Rpb24gKHJlcSwgdmFscykge1xuICAgICAgICByZXR1cm4gW3ZhbHMudmFsc19dO1xuICAgIH07XG5cbiAgICBjcm9zc3JvYWRzLk5PUk1fQVNfT0JKRUNUID0gZnVuY3Rpb24gKHJlcSwgdmFscykge1xuICAgICAgICByZXR1cm4gW3ZhbHNdO1xuICAgIH07XG5cblxuICAgIC8vIFJvdXRlIC0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFJvdXRlKHBhdHRlcm4sIGNhbGxiYWNrLCBwcmlvcml0eSwgcm91dGVyKSB7XG4gICAgICAgIHZhciBpc1JlZ2V4UGF0dGVybiA9IGlzUmVnRXhwKHBhdHRlcm4pLFxuICAgICAgICAgICAgcGF0dGVybkxleGVyID0gcm91dGVyLnBhdHRlcm5MZXhlcjtcbiAgICAgICAgdGhpcy5fcm91dGVyID0gcm91dGVyO1xuICAgICAgICB0aGlzLl9wYXR0ZXJuID0gcGF0dGVybjtcbiAgICAgICAgdGhpcy5fcGFyYW1zSWRzID0gaXNSZWdleFBhdHRlcm4/IG51bGwgOiBwYXR0ZXJuTGV4ZXIuZ2V0UGFyYW1JZHMocGF0dGVybik7XG4gICAgICAgIHRoaXMuX29wdGlvbmFsUGFyYW1zSWRzID0gaXNSZWdleFBhdHRlcm4/IG51bGwgOiBwYXR0ZXJuTGV4ZXIuZ2V0T3B0aW9uYWxQYXJhbXNJZHMocGF0dGVybik7XG4gICAgICAgIHRoaXMuX21hdGNoUmVnZXhwID0gaXNSZWdleFBhdHRlcm4/IHBhdHRlcm4gOiBwYXR0ZXJuTGV4ZXIuY29tcGlsZVBhdHRlcm4ocGF0dGVybiwgcm91dGVyLmlnbm9yZUNhc2UpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSBuZXcgc2lnbmFscy5TaWduYWwoKTtcbiAgICAgICAgdGhpcy5zd2l0Y2hlZCA9IG5ldyBzaWduYWxzLlNpZ25hbCgpO1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMubWF0Y2hlZC5hZGQoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBSb3V0ZS5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgZ3JlZWR5IDogZmFsc2UsXG5cbiAgICAgICAgcnVsZXMgOiB2b2lkKDApLFxuXG4gICAgICAgIG1hdGNoIDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHJlcXVlc3QgPSByZXF1ZXN0IHx8ICcnO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21hdGNoUmVnZXhwLnRlc3QocmVxdWVzdCkgJiYgdGhpcy5fdmFsaWRhdGVQYXJhbXMocmVxdWVzdCk7IC8vdmFsaWRhdGUgcGFyYW1zIGV2ZW4gaWYgcmVnZXhwIGJlY2F1c2Ugb2YgYHJlcXVlc3RfYCBydWxlLlxuICAgICAgICB9LFxuXG4gICAgICAgIF92YWxpZGF0ZVBhcmFtcyA6IGZ1bmN0aW9uIChyZXF1ZXN0KSB7XG4gICAgICAgICAgICB2YXIgcnVsZXMgPSB0aGlzLnJ1bGVzLFxuICAgICAgICAgICAgICAgIHZhbHVlcyA9IHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KSxcbiAgICAgICAgICAgICAgICBrZXk7XG4gICAgICAgICAgICBmb3IgKGtleSBpbiBydWxlcykge1xuICAgICAgICAgICAgICAgIC8vIG5vcm1hbGl6ZV8gaXNuJ3QgYSB2YWxpZGF0aW9uIHJ1bGUuLi4gKCMzOSlcbiAgICAgICAgICAgICAgICBpZihrZXkgIT09ICdub3JtYWxpemVfJyAmJiBydWxlcy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmICEgdGhpcy5faXNWYWxpZFBhcmFtKHJlcXVlc3QsIGtleSwgdmFsdWVzKSl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBfaXNWYWxpZFBhcmFtIDogZnVuY3Rpb24gKHJlcXVlc3QsIHByb3AsIHZhbHVlcykge1xuICAgICAgICAgICAgdmFyIHZhbGlkYXRpb25SdWxlID0gdGhpcy5ydWxlc1twcm9wXSxcbiAgICAgICAgICAgICAgICB2YWwgPSB2YWx1ZXNbcHJvcF0sXG4gICAgICAgICAgICAgICAgaXNWYWxpZCA9IGZhbHNlLFxuICAgICAgICAgICAgICAgIGlzUXVlcnkgPSAocHJvcC5pbmRleE9mKCc/JykgPT09IDApO1xuXG4gICAgICAgICAgICBpZiAodmFsID09IG51bGwgJiYgdGhpcy5fb3B0aW9uYWxQYXJhbXNJZHMgJiYgYXJyYXlJbmRleE9mKHRoaXMuX29wdGlvbmFsUGFyYW1zSWRzLCBwcm9wKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBpc1ZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGlzUmVnRXhwKHZhbGlkYXRpb25SdWxlKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1F1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbCA9IHZhbHVlc1twcm9wICsnXyddOyAvL3VzZSByYXcgc3RyaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlzVmFsaWQgPSB2YWxpZGF0aW9uUnVsZS50ZXN0KHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChpc0FycmF5KHZhbGlkYXRpb25SdWxlKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1F1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbCA9IHZhbHVlc1twcm9wICsnXyddOyAvL3VzZSByYXcgc3RyaW5nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlzVmFsaWQgPSB0aGlzLl9pc1ZhbGlkQXJyYXlSdWxlKHZhbGlkYXRpb25SdWxlLCB2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaXNGdW5jdGlvbih2YWxpZGF0aW9uUnVsZSkpIHtcbiAgICAgICAgICAgICAgICBpc1ZhbGlkID0gdmFsaWRhdGlvblJ1bGUodmFsLCByZXF1ZXN0LCB2YWx1ZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaXNWYWxpZDsgLy9mYWlsIHNpbGVudGx5IGlmIHZhbGlkYXRpb25SdWxlIGlzIGZyb20gYW4gdW5zdXBwb3J0ZWQgdHlwZVxuICAgICAgICB9LFxuXG4gICAgICAgIF9pc1ZhbGlkQXJyYXlSdWxlIDogZnVuY3Rpb24gKGFyciwgdmFsKSB7XG4gICAgICAgICAgICBpZiAoISB0aGlzLl9yb3V0ZXIuaWdub3JlQ2FzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcnJheUluZGV4T2YoYXJyLCB2YWwpICE9PSAtMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gdmFsLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBuID0gYXJyLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpdGVtLFxuICAgICAgICAgICAgICAgIGNvbXBhcmVWYWw7XG5cbiAgICAgICAgICAgIHdoaWxlIChuLS0pIHtcbiAgICAgICAgICAgICAgICBpdGVtID0gYXJyW25dO1xuICAgICAgICAgICAgICAgIGNvbXBhcmVWYWwgPSAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKT8gaXRlbS50b0xvd2VyQ2FzZSgpIDogaXRlbTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcGFyZVZhbCA9PT0gdmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0UGFyYW1zT2JqZWN0IDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgICAgIHZhciBzaG91bGRUeXBlY2FzdCA9IHRoaXMuX3JvdXRlci5zaG91bGRUeXBlY2FzdCxcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSB0aGlzLl9yb3V0ZXIucGF0dGVybkxleGVyLmdldFBhcmFtVmFsdWVzKHJlcXVlc3QsIHRoaXMuX21hdGNoUmVnZXhwLCBzaG91bGRUeXBlY2FzdCksXG4gICAgICAgICAgICAgICAgbyA9IHt9LFxuICAgICAgICAgICAgICAgIG4gPSB2YWx1ZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHBhcmFtLCB2YWw7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gdmFsdWVzW25dO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJhbXNJZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW0gPSB0aGlzLl9wYXJhbXNJZHNbbl07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJhbS5pbmRleE9mKCc/JykgPT09IDAgJiYgdmFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL21ha2UgYSBjb3B5IG9mIHRoZSBvcmlnaW5hbCBzdHJpbmcgc28gYXJyYXkgYW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAvL1JlZ0V4cCB2YWxpZGF0aW9uIGNhbiBiZSBhcHBsaWVkIHByb3Blcmx5XG4gICAgICAgICAgICAgICAgICAgICAgICBvW3BhcmFtICsnXyddID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy91cGRhdGUgdmFsc18gYXJyYXkgYXMgd2VsbCBzaW5jZSBpdCB3aWxsIGJlIHVzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSBkZWNvZGVRdWVyeVN0cmluZyh2YWwsIHNob3VsZFR5cGVjYXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlc1tuXSA9IHZhbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBJRSB3aWxsIGNhcHR1cmUgb3B0aW9uYWwgZ3JvdXBzIGFzIGVtcHR5IHN0cmluZ3Mgd2hpbGUgb3RoZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gYnJvd3NlcnMgd2lsbCBjYXB0dXJlIGB1bmRlZmluZWRgIHNvIG5vcm1hbGl6ZSBiZWhhdmlvci5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2VlOiAjZ2gtNTgsICNnaC01OSwgI2doLTYwXG4gICAgICAgICAgICAgICAgICAgIGlmICggX2hhc09wdGlvbmFsR3JvdXBCdWcgJiYgdmFsID09PSAnJyAmJiBhcnJheUluZGV4T2YodGhpcy5fb3B0aW9uYWxQYXJhbXNJZHMsIHBhcmFtKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSB2b2lkKDApO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzW25dID0gdmFsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9bcGFyYW1dID0gdmFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL2FsaWFzIHRvIHBhdGhzIGFuZCBmb3IgUmVnRXhwIHBhdHRlcm5cbiAgICAgICAgICAgICAgICBvW25dID0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgby5yZXF1ZXN0XyA9IHNob3VsZFR5cGVjYXN0PyB0eXBlY2FzdFZhbHVlKHJlcXVlc3QpIDogcmVxdWVzdDtcbiAgICAgICAgICAgIG8udmFsc18gPSB2YWx1ZXM7XG4gICAgICAgICAgICByZXR1cm4gbztcbiAgICAgICAgfSxcblxuICAgICAgICBfZ2V0UGFyYW1zQXJyYXkgOiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICAgICAgdmFyIG5vcm0gPSB0aGlzLnJ1bGVzPyB0aGlzLnJ1bGVzLm5vcm1hbGl6ZV8gOiBudWxsLFxuICAgICAgICAgICAgICAgIHBhcmFtcztcbiAgICAgICAgICAgIG5vcm0gPSBub3JtIHx8IHRoaXMuX3JvdXRlci5ub3JtYWxpemVGbjsgLy8gZGVmYXVsdCBub3JtYWxpemVcbiAgICAgICAgICAgIGlmIChub3JtICYmIGlzRnVuY3Rpb24obm9ybSkpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSBub3JtKHJlcXVlc3QsIHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcmFtcyA9IHRoaXMuX2dldFBhcmFtc09iamVjdChyZXF1ZXN0KS52YWxzXztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgaW50ZXJwb2xhdGUgOiBmdW5jdGlvbihyZXBsYWNlbWVudHMpIHtcbiAgICAgICAgICAgIHZhciBzdHIgPSB0aGlzLl9yb3V0ZXIucGF0dGVybkxleGVyLmludGVycG9sYXRlKHRoaXMuX3BhdHRlcm4sIHJlcGxhY2VtZW50cyk7XG4gICAgICAgICAgICBpZiAoISB0aGlzLl92YWxpZGF0ZVBhcmFtcyhzdHIpICkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignR2VuZXJhdGVkIHN0cmluZyBkb2VzblxcJ3QgdmFsaWRhdGUgYWdhaW5zdCBgUm91dGUucnVsZXNgLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgICAgfSxcblxuICAgICAgICBkaXNwb3NlIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5fcm91dGVyLnJlbW92ZVJvdXRlKHRoaXMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIF9kZXN0cm95IDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkLmRpc3Bvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuc3dpdGNoZWQuZGlzcG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkID0gdGhpcy5zd2l0Y2hlZCA9IHRoaXMuX3BhdHRlcm4gPSB0aGlzLl9tYXRjaFJlZ2V4cCA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgdG9TdHJpbmcgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1tSb3V0ZSBwYXR0ZXJuOlwiJysgdGhpcy5fcGF0dGVybiArJ1wiLCBudW1MaXN0ZW5lcnM6JysgdGhpcy5tYXRjaGVkLmdldE51bUxpc3RlbmVycygpICsnXSc7XG4gICAgICAgIH1cblxuICAgIH07XG5cblxuXG4gICAgLy8gUGF0dGVybiBMZXhlciAtLS0tLS1cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgQ3Jvc3Nyb2Fkcy5wcm90b3R5cGUucGF0dGVybkxleGVyID0gKGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXJcbiAgICAgICAgICAgIC8vbWF0Y2ggY2hhcnMgdGhhdCBzaG91bGQgYmUgZXNjYXBlZCBvbiBzdHJpbmcgcmVnZXhwXG4gICAgICAgICAgICBFU0NBUEVfQ0hBUlNfUkVHRVhQID0gL1tcXFxcLisqP1xcXiRcXFtcXF0oKXt9XFwvJyNdL2csXG5cbiAgICAgICAgICAgIC8vdHJhaWxpbmcgc2xhc2hlcyAoYmVnaW4vZW5kIG9mIHN0cmluZylcbiAgICAgICAgICAgIExPT1NFX1NMQVNIRVNfUkVHRVhQID0gL15cXC98XFwvJC9nLFxuICAgICAgICAgICAgTEVHQUNZX1NMQVNIRVNfUkVHRVhQID0gL1xcLyQvZyxcblxuICAgICAgICAgICAgLy9wYXJhbXMgLSBldmVyeXRoaW5nIGJldHdlZW4gYHsgfWAgb3IgYDogOmBcbiAgICAgICAgICAgIFBBUkFNU19SRUdFWFAgPSAvKD86XFx7fDopKFtefTpdKykoPzpcXH18OikvZyxcblxuICAgICAgICAgICAgLy91c2VkIHRvIHNhdmUgcGFyYW1zIGR1cmluZyBjb21waWxlIChhdm9pZCBlc2NhcGluZyB0aGluZ3MgdGhhdFxuICAgICAgICAgICAgLy9zaG91bGRuJ3QgYmUgZXNjYXBlZCkuXG4gICAgICAgICAgICBUT0tFTlMgPSB7XG4gICAgICAgICAgICAgICAgJ09TJyA6IHtcbiAgICAgICAgICAgICAgICAgICAgLy9vcHRpb25hbCBzbGFzaGVzXG4gICAgICAgICAgICAgICAgICAgIC8vc2xhc2ggYmV0d2VlbiBgOjpgIG9yIGB9OmAgb3IgYFxcdzpgIG9yIGA6ez9gIG9yIGB9ez9gIG9yIGBcXHd7P2BcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLyhbOn1dfFxcdyg/PVxcLykpXFwvPyg6fCg/Olxce1xcPykpL2csXG4gICAgICAgICAgICAgICAgICAgIHNhdmUgOiAnJDF7e2lkfX0kMicsXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICdcXFxcLz8nXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlMnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHNsYXNoZXNcbiAgICAgICAgICAgICAgICAgICAgLy91c2VkIHRvIGluc2VydCBzbGFzaCBiZXR3ZWVuIGA6e2AgYW5kIGB9e2BcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLyhbOn1dKVxcLz8oXFx7KS9nLFxuICAgICAgICAgICAgICAgICAgICBzYXZlIDogJyQxe3tpZH19JDInLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnXFxcXC8nXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlEnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHF1ZXJ5IHN0cmluZyAtIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiBgez8gfWBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogL1xce1xcPyhbXn1dKylcXH0vZyxcbiAgICAgICAgICAgICAgICAgICAgLy9ldmVyeXRoaW5nIGZyb20gYD9gIHRpbGwgYCNgIG9yIGVuZCBvZiBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgcmVzIDogJ1xcXFw/KFteI10rKSdcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdPUScgOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vb3B0aW9uYWwgcXVlcnkgc3RyaW5nIC0gZXZlcnl0aGluZyBpbiBiZXR3ZWVuIGA6PyA6YFxuICAgICAgICAgICAgICAgICAgICByZ3ggOiAvOlxcPyhbXjpdKyk6L2csXG4gICAgICAgICAgICAgICAgICAgIC8vZXZlcnl0aGluZyBmcm9tIGA/YCB0aWxsIGAjYCBvciBlbmQgb2Ygc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICcoPzpcXFxcPyhbXiNdKikpPydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICdPUicgOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vb3B0aW9uYWwgcmVzdCAtIGV2ZXJ5dGhpbmcgaW4gYmV0d2VlbiBgOiAqOmBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLzooW146XSspXFwqOi9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKC4qKT8nIC8vIG9wdGlvbmFsIGdyb3VwIHRvIGF2b2lkIHBhc3NpbmcgZW1wdHkgc3RyaW5nIGFzIGNhcHR1cmVkXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAnUlInIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3Jlc3QgcGFyYW0gLSBldmVyeXRoaW5nIGluIGJldHdlZW4gYHsgKn1gXG4gICAgICAgICAgICAgICAgICAgIHJneCA6IC9cXHsoW159XSspXFwqXFx9L2csXG4gICAgICAgICAgICAgICAgICAgIHJlcyA6ICcoLispJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgLy8gcmVxdWlyZWQvb3B0aW9uYWwgcGFyYW1zIHNob3VsZCBjb21lIGFmdGVyIHJlc3Qgc2VnbWVudHNcbiAgICAgICAgICAgICAgICAnUlAnIDoge1xuICAgICAgICAgICAgICAgICAgICAvL3JlcXVpcmVkIHBhcmFtcyAtIGV2ZXJ5dGhpbmcgYmV0d2VlbiBgeyB9YFxuICAgICAgICAgICAgICAgICAgICByZ3ggOiAvXFx7KFtefV0rKVxcfS9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKFteXFxcXC8/XSspJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgJ09QJyA6IHtcbiAgICAgICAgICAgICAgICAgICAgLy9vcHRpb25hbCBwYXJhbXMgLSBldmVyeXRoaW5nIGJldHdlZW4gYDogOmBcbiAgICAgICAgICAgICAgICAgICAgcmd4IDogLzooW146XSspOi9nLFxuICAgICAgICAgICAgICAgICAgICByZXMgOiAnKFteXFxcXC8/XSspP1xcLz8nXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgTE9PU0VfU0xBU0ggPSAxLFxuICAgICAgICAgICAgU1RSSUNUX1NMQVNIID0gMixcbiAgICAgICAgICAgIExFR0FDWV9TTEFTSCA9IDMsXG5cbiAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMT09TRV9TTEFTSDtcblxuXG4gICAgICAgIGZ1bmN0aW9uIHByZWNvbXBpbGVUb2tlbnMoKXtcbiAgICAgICAgICAgIHZhciBrZXksIGN1cjtcbiAgICAgICAgICAgIGZvciAoa2V5IGluIFRPS0VOUykge1xuICAgICAgICAgICAgICAgIGlmIChUT0tFTlMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBjdXIgPSBUT0tFTlNba2V5XTtcbiAgICAgICAgICAgICAgICAgICAgY3VyLmlkID0gJ19fQ1JfJysga2V5ICsnX18nO1xuICAgICAgICAgICAgICAgICAgICBjdXIuc2F2ZSA9ICgnc2F2ZScgaW4gY3VyKT8gY3VyLnNhdmUucmVwbGFjZSgne3tpZH19JywgY3VyLmlkKSA6IGN1ci5pZDtcbiAgICAgICAgICAgICAgICAgICAgY3VyLnJSZXN0b3JlID0gbmV3IFJlZ0V4cChjdXIuaWQsICdnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHByZWNvbXBpbGVUb2tlbnMoKTtcblxuXG4gICAgICAgIGZ1bmN0aW9uIGNhcHR1cmVWYWxzKHJlZ2V4LCBwYXR0ZXJuKSB7XG4gICAgICAgICAgICB2YXIgdmFscyA9IFtdLCBtYXRjaDtcbiAgICAgICAgICAgIC8vIHZlcnkgaW1wb3J0YW50IHRvIHJlc2V0IGxhc3RJbmRleCBzaW5jZSBSZWdFeHAgY2FuIGhhdmUgXCJnXCIgZmxhZ1xuICAgICAgICAgICAgLy8gYW5kIG11bHRpcGxlIHJ1bnMgbWlnaHQgYWZmZWN0IHRoZSByZXN1bHQsIHNwZWNpYWxseSBpZiBtYXRjaGluZ1xuICAgICAgICAgICAgLy8gc2FtZSBzdHJpbmcgbXVsdGlwbGUgdGltZXMgb24gSUUgNy04XG4gICAgICAgICAgICByZWdleC5sYXN0SW5kZXggPSAwO1xuICAgICAgICAgICAgd2hpbGUgKG1hdGNoID0gcmVnZXguZXhlYyhwYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHZhbHMucHVzaChtYXRjaFsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFBhcmFtSWRzKHBhdHRlcm4pIHtcbiAgICAgICAgICAgIHJldHVybiBjYXB0dXJlVmFscyhQQVJBTVNfUkVHRVhQLCBwYXR0ZXJuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldE9wdGlvbmFsUGFyYW1zSWRzKHBhdHRlcm4pIHtcbiAgICAgICAgICAgIHJldHVybiBjYXB0dXJlVmFscyhUT0tFTlMuT1Aucmd4LCBwYXR0ZXJuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGNvbXBpbGVQYXR0ZXJuKHBhdHRlcm4sIGlnbm9yZUNhc2UpIHtcbiAgICAgICAgICAgIHBhdHRlcm4gPSBwYXR0ZXJuIHx8ICcnO1xuXG4gICAgICAgICAgICBpZihwYXR0ZXJuKXtcbiAgICAgICAgICAgICAgICBpZiAoX3NsYXNoTW9kZSA9PT0gTE9PU0VfU0xBU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShMT09TRV9TTEFTSEVTX1JFR0VYUCwgJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChfc2xhc2hNb2RlID09PSBMRUdBQ1lfU0xBU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShMRUdBQ1lfU0xBU0hFU19SRUdFWFAsICcnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL3NhdmUgdG9rZW5zXG4gICAgICAgICAgICAgICAgcGF0dGVybiA9IHJlcGxhY2VUb2tlbnMocGF0dGVybiwgJ3JneCcsICdzYXZlJyk7XG4gICAgICAgICAgICAgICAgLy9yZWdleHAgZXNjYXBlXG4gICAgICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZShFU0NBUEVfQ0hBUlNfUkVHRVhQLCAnXFxcXCQmJyk7XG4gICAgICAgICAgICAgICAgLy9yZXN0b3JlIHRva2Vuc1xuICAgICAgICAgICAgICAgIHBhdHRlcm4gPSByZXBsYWNlVG9rZW5zKHBhdHRlcm4sICdyUmVzdG9yZScsICdyZXMnKTtcblxuICAgICAgICAgICAgICAgIGlmIChfc2xhc2hNb2RlID09PSBMT09TRV9TTEFTSCkge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuID0gJ1xcXFwvPycrIHBhdHRlcm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoX3NsYXNoTW9kZSAhPT0gU1RSSUNUX1NMQVNIKSB7XG4gICAgICAgICAgICAgICAgLy9zaW5nbGUgc2xhc2ggaXMgdHJlYXRlZCBhcyBlbXB0eSBhbmQgZW5kIHNsYXNoIGlzIG9wdGlvbmFsXG4gICAgICAgICAgICAgICAgcGF0dGVybiArPSAnXFxcXC8/JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVnRXhwKCdeJysgcGF0dGVybiArICckJywgaWdub3JlQ2FzZT8gJ2knIDogJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcmVwbGFjZVRva2VucyhwYXR0ZXJuLCByZWdleHBOYW1lLCByZXBsYWNlTmFtZSkge1xuICAgICAgICAgICAgdmFyIGN1ciwga2V5O1xuICAgICAgICAgICAgZm9yIChrZXkgaW4gVE9LRU5TKSB7XG4gICAgICAgICAgICAgICAgaWYgKFRPS0VOUy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1ciA9IFRPS0VOU1trZXldO1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuID0gcGF0dGVybi5yZXBsYWNlKGN1cltyZWdleHBOYW1lXSwgY3VyW3JlcGxhY2VOYW1lXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHBhdHRlcm47XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBnZXRQYXJhbVZhbHVlcyhyZXF1ZXN0LCByZWdleHAsIHNob3VsZFR5cGVjYXN0KSB7XG4gICAgICAgICAgICB2YXIgdmFscyA9IHJlZ2V4cC5leGVjKHJlcXVlc3QpO1xuICAgICAgICAgICAgaWYgKHZhbHMpIHtcbiAgICAgICAgICAgICAgICB2YWxzLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFR5cGVjYXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHMgPSB0eXBlY2FzdEFycmF5VmFsdWVzKHZhbHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2YWxzO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gaW50ZXJwb2xhdGUocGF0dGVybiwgcmVwbGFjZW1lbnRzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhdHRlcm4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdSb3V0ZSBwYXR0ZXJuIHNob3VsZCBiZSBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJlcGxhY2VGbiA9IGZ1bmN0aW9uKG1hdGNoLCBwcm9wKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZhbDtcbiAgICAgICAgICAgICAgICAgICAgcHJvcCA9IChwcm9wLnN1YnN0cigwLCAxKSA9PT0gJz8nKT8gcHJvcC5zdWJzdHIoMSkgOiBwcm9wO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVwbGFjZW1lbnRzW3Byb3BdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcmVwbGFjZW1lbnRzW3Byb3BdID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBxdWVyeVBhcnRzID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gcmVwbGFjZW1lbnRzW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHF1ZXJ5UGFydHMucHVzaChlbmNvZGVVUkkoa2V5ICsgJz0nICsgcmVwbGFjZW1lbnRzW3Byb3BdW2tleV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gJz8nICsgcXVlcnlQYXJ0cy5qb2luKCcmJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB2YWx1ZSBpcyBhIHN0cmluZyBzZWUgI2doLTU0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsID0gU3RyaW5nKHJlcGxhY2VtZW50c1twcm9wXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaC5pbmRleE9mKCcqJykgPT09IC0xICYmIHZhbC5pbmRleE9mKCcvJykgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHZhbHVlIFwiJysgdmFsICsnXCIgZm9yIHNlZ21lbnQgXCInKyBtYXRjaCArJ1wiLicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoLmluZGV4T2YoJ3snKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlIHNlZ21lbnQgJysgbWF0Y2ggKycgaXMgcmVxdWlyZWQuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWwgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICghIFRPS0VOUy5PUy50cmFpbCkge1xuICAgICAgICAgICAgICAgIFRPS0VOUy5PUy50cmFpbCA9IG5ldyBSZWdFeHAoJyg/OicrIFRPS0VOUy5PUy5pZCArJykrJCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcGF0dGVyblxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoVE9LRU5TLk9TLnJneCwgVE9LRU5TLk9TLnNhdmUpXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShQQVJBTVNfUkVHRVhQLCByZXBsYWNlRm4pXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZShUT0tFTlMuT1MudHJhaWwsICcnKSAvLyByZW1vdmUgdHJhaWxpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKFRPS0VOUy5PUy5yUmVzdG9yZSwgJy8nKTsgLy8gYWRkIHNsYXNoIGJldHdlZW4gc2VnbWVudHNcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQVBJXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdHJpY3QgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBTVFJJQ1RfU0xBU0g7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbG9vc2UgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMT09TRV9TTEFTSDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsZWdhY3kgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIF9zbGFzaE1vZGUgPSBMRUdBQ1lfU0xBU0g7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0UGFyYW1JZHMgOiBnZXRQYXJhbUlkcyxcbiAgICAgICAgICAgIGdldE9wdGlvbmFsUGFyYW1zSWRzIDogZ2V0T3B0aW9uYWxQYXJhbXNJZHMsXG4gICAgICAgICAgICBnZXRQYXJhbVZhbHVlcyA6IGdldFBhcmFtVmFsdWVzLFxuICAgICAgICAgICAgY29tcGlsZVBhdHRlcm4gOiBjb21waWxlUGF0dGVybixcbiAgICAgICAgICAgIGludGVycG9sYXRlIDogaW50ZXJwb2xhdGVcbiAgICAgICAgfTtcblxuICAgIH0oKSk7XG5cblxuICAgIHJldHVybiBjcm9zc3JvYWRzO1xufTtcblxuaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbJ3NpZ25hbHMnXSwgZmFjdG9yeSk7XG59IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7IC8vTm9kZVxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKCdzaWduYWxzJykpO1xufSBlbHNlIHtcbiAgICAvKmpzaGludCBzdWI6dHJ1ZSAqL1xuICAgIHdpbmRvd1snY3Jvc3Nyb2FkcyddID0gZmFjdG9yeSh3aW5kb3dbJ3NpZ25hbHMnXSk7XG59XG5cbn0oKSk7XG5cbiIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBub29wXG5cbmZ1bmN0aW9uIG5vb3AoKSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdZb3Ugc2hvdWxkIGJ1bmRsZSB5b3VyIGNvZGUgJyArXG4gICAgICAndXNpbmcgYGdsc2xpZnlgIGFzIGEgdHJhbnNmb3JtLidcbiAgKVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBwcm9ncmFtaWZ5XG5cbmZ1bmN0aW9uIHByb2dyYW1pZnkodmVydGV4LCBmcmFnbWVudCwgdW5pZm9ybXMsIGF0dHJpYnV0ZXMpIHtcbiAgcmV0dXJuIHtcbiAgICB2ZXJ0ZXg6IHZlcnRleCwgXG4gICAgZnJhZ21lbnQ6IGZyYWdtZW50LFxuICAgIHVuaWZvcm1zOiB1bmlmb3JtcywgXG4gICAgYXR0cmlidXRlczogYXR0cmlidXRlc1xuICB9O1xufVxuIixudWxsLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5wcm9jZXNzLm5leHRUaWNrID0gKGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY2FuU2V0SW1tZWRpYXRlID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuc2V0SW1tZWRpYXRlO1xuICAgIHZhciBjYW5NdXRhdGlvbk9ic2VydmVyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCdcbiAgICAmJiB3aW5kb3cuTXV0YXRpb25PYnNlcnZlcjtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICB2YXIgcXVldWUgPSBbXTtcblxuICAgIGlmIChjYW5NdXRhdGlvbk9ic2VydmVyKSB7XG4gICAgICAgIHZhciBoaWRkZW5EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgICAgICB2YXIgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgcXVldWVMaXN0ID0gcXVldWUuc2xpY2UoKTtcbiAgICAgICAgICAgIHF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICBxdWV1ZUxpc3QuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9ic2VydmVyLm9ic2VydmUoaGlkZGVuRGl2LCB7IGF0dHJpYnV0ZXM6IHRydWUgfSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBpZiAoIXF1ZXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGhpZGRlbkRpdi5zZXRBdHRyaWJ1dGUoJ3llcycsICdubycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gSWYgb2JqLmhhc093blByb3BlcnR5IGhhcyBiZWVuIG92ZXJyaWRkZW4sIHRoZW4gY2FsbGluZ1xuLy8gb2JqLmhhc093blByb3BlcnR5KHByb3ApIHdpbGwgYnJlYWsuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9pc3N1ZXMvMTcwN1xuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihxcywgc2VwLCBlcSwgb3B0aW9ucykge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgdmFyIG9iaiA9IHt9O1xuXG4gIGlmICh0eXBlb2YgcXMgIT09ICdzdHJpbmcnIHx8IHFzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cblxuICB2YXIgcmVnZXhwID0gL1xcKy9nO1xuICBxcyA9IHFzLnNwbGl0KHNlcCk7XG5cbiAgdmFyIG1heEtleXMgPSAxMDAwO1xuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5tYXhLZXlzID09PSAnbnVtYmVyJykge1xuICAgIG1heEtleXMgPSBvcHRpb25zLm1heEtleXM7XG4gIH1cblxuICB2YXIgbGVuID0gcXMubGVuZ3RoO1xuICAvLyBtYXhLZXlzIDw9IDAgbWVhbnMgdGhhdCB3ZSBzaG91bGQgbm90IGxpbWl0IGtleXMgY291bnRcbiAgaWYgKG1heEtleXMgPiAwICYmIGxlbiA+IG1heEtleXMpIHtcbiAgICBsZW4gPSBtYXhLZXlzO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIHZhciB4ID0gcXNbaV0ucmVwbGFjZShyZWdleHAsICclMjAnKSxcbiAgICAgICAgaWR4ID0geC5pbmRleE9mKGVxKSxcbiAgICAgICAga3N0ciwgdnN0ciwgaywgdjtcblxuICAgIGlmIChpZHggPj0gMCkge1xuICAgICAga3N0ciA9IHguc3Vic3RyKDAsIGlkeCk7XG4gICAgICB2c3RyID0geC5zdWJzdHIoaWR4ICsgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGtzdHIgPSB4O1xuICAgICAgdnN0ciA9ICcnO1xuICAgIH1cblxuICAgIGsgPSBkZWNvZGVVUklDb21wb25lbnQoa3N0cik7XG4gICAgdiA9IGRlY29kZVVSSUNvbXBvbmVudCh2c3RyKTtcblxuICAgIGlmICghaGFzT3duUHJvcGVydHkob2JqLCBrKSkge1xuICAgICAgb2JqW2tdID0gdjtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgb2JqW2tdLnB1c2godik7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ialtrXSA9IFtvYmpba10sIHZdO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdpZnlQcmltaXRpdmUgPSBmdW5jdGlvbih2KSB7XG4gIHN3aXRjaCAodHlwZW9mIHYpIHtcbiAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgcmV0dXJuIHY7XG5cbiAgICBjYXNlICdib29sZWFuJzpcbiAgICAgIHJldHVybiB2ID8gJ3RydWUnIDogJ2ZhbHNlJztcblxuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gaXNGaW5pdGUodikgPyB2IDogJyc7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG9iaiwgc2VwLCBlcSwgbmFtZSkge1xuICBzZXAgPSBzZXAgfHwgJyYnO1xuICBlcSA9IGVxIHx8ICc9JztcbiAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgIG9iaiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBtYXAob2JqZWN0S2V5cyhvYmopLCBmdW5jdGlvbihrKSB7XG4gICAgICB2YXIga3MgPSBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKGspKSArIGVxO1xuICAgICAgaWYgKGlzQXJyYXkob2JqW2tdKSkge1xuICAgICAgICByZXR1cm4gbWFwKG9ialtrXSwgZnVuY3Rpb24odikge1xuICAgICAgICAgIHJldHVybiBrcyArIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUodikpO1xuICAgICAgICB9KS5qb2luKHNlcCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga3MgKyBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG9ialtrXSkpO1xuICAgICAgfVxuICAgIH0pLmpvaW4oc2VwKTtcblxuICB9XG5cbiAgaWYgKCFuYW1lKSByZXR1cm4gJyc7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoc3RyaW5naWZ5UHJpbWl0aXZlKG5hbWUpKSArIGVxICtcbiAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdpZnlQcmltaXRpdmUob2JqKSk7XG59O1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKHhzKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nO1xufTtcblxuZnVuY3Rpb24gbWFwICh4cywgZikge1xuICBpZiAoeHMubWFwKSByZXR1cm4geHMubWFwKGYpO1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICByZXMucHVzaChmKHhzW2ldLCBpKSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSByZXMucHVzaChrZXkpO1xuICB9XG4gIHJldHVybiByZXM7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLmRlY29kZSA9IGV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2RlY29kZScpO1xuZXhwb3J0cy5lbmNvZGUgPSBleHBvcnRzLnN0cmluZ2lmeSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG4iLCIvKiEhXG4gKiBIYXNoZXIgPGh0dHA6Ly9naXRodWIuY29tL21pbGxlcm1lZGVpcm9zL2hhc2hlcj5cbiAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gKiBAdmVyc2lvbiAxLjIuMCAoMjAxMy8xMS8xMSAwMzoxOCBQTSlcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZVxuICovXG5cbjsoZnVuY3Rpb24gKCkge1xudmFyIGZhY3RvcnkgPSBmdW5jdGlvbihzaWduYWxzKXtcblxuLypqc2hpbnQgd2hpdGU6ZmFsc2UqL1xuLypnbG9iYWwgc2lnbmFsczpmYWxzZSwgd2luZG93OmZhbHNlKi9cblxuLyoqXG4gKiBIYXNoZXJcbiAqIEBuYW1lc3BhY2UgSGlzdG9yeSBNYW5hZ2VyIGZvciByaWNoLW1lZGlhIGFwcGxpY2F0aW9ucy5cbiAqIEBuYW1lIGhhc2hlclxuICovXG52YXIgaGFzaGVyID0gKGZ1bmN0aW9uKHdpbmRvdyl7XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUHJpdmF0ZSBWYXJzXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgdmFyXG5cbiAgICAgICAgLy8gZnJlcXVlbmN5IHRoYXQgaXQgd2lsbCBjaGVjayBoYXNoIHZhbHVlIG9uIElFIDYtNyBzaW5jZSBpdCBkb2Vzbid0XG4gICAgICAgIC8vIHN1cHBvcnQgdGhlIGhhc2hjaGFuZ2UgZXZlbnRcbiAgICAgICAgUE9PTF9JTlRFUlZBTCA9IDI1LFxuXG4gICAgICAgIC8vIGxvY2FsIHN0b3JhZ2UgZm9yIGJyZXZpdHkgYW5kIGJldHRlciBjb21wcmVzc2lvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICAgIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50LFxuICAgICAgICBoaXN0b3J5ID0gd2luZG93Lmhpc3RvcnksXG4gICAgICAgIFNpZ25hbCA9IHNpZ25hbHMuU2lnbmFsLFxuXG4gICAgICAgIC8vIGxvY2FsIHZhcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgICAgIGhhc2hlcixcbiAgICAgICAgX2hhc2gsXG4gICAgICAgIF9jaGVja0ludGVydmFsLFxuICAgICAgICBfaXNBY3RpdmUsXG4gICAgICAgIF9mcmFtZSwgLy9pZnJhbWUgdXNlZCBmb3IgbGVnYWN5IElFICg2LTcpXG4gICAgICAgIF9jaGVja0hpc3RvcnksXG4gICAgICAgIF9oYXNoVmFsUmVnZXhwID0gLyMoLiopJC8sXG4gICAgICAgIF9iYXNlVXJsUmVnZXhwID0gLyhcXD8uKil8KFxcIy4qKS8sXG4gICAgICAgIF9oYXNoUmVnZXhwID0gL15cXCMvLFxuXG4gICAgICAgIC8vIHNuaWZmaW5nL2ZlYXR1cmUgZGV0ZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICAvL2hhY2sgYmFzZWQgb24gdGhpczogaHR0cDovL3dlYnJlZmxlY3Rpb24uYmxvZ3Nwb3QuY29tLzIwMDkvMDEvMzItYnl0ZXMtdG8ta25vdy1pZi15b3VyLWJyb3dzZXItaXMtaWUuaHRtbFxuICAgICAgICBfaXNJRSA9ICghK1wiXFx2MVwiKSxcbiAgICAgICAgLy8gaGFzaGNoYW5nZSBpcyBzdXBwb3J0ZWQgYnkgRkYzLjYrLCBJRTgrLCBDaHJvbWUgNSssIFNhZmFyaSA1KyBidXRcbiAgICAgICAgLy8gZmVhdHVyZSBkZXRlY3Rpb24gZmFpbHMgb24gSUUgY29tcGF0aWJpbGl0eSBtb2RlLCBzbyB3ZSBuZWVkIHRvXG4gICAgICAgIC8vIGNoZWNrIGRvY3VtZW50TW9kZVxuICAgICAgICBfaXNIYXNoQ2hhbmdlU3VwcG9ydGVkID0gKCdvbmhhc2hjaGFuZ2UnIGluIHdpbmRvdykgJiYgZG9jdW1lbnQuZG9jdW1lbnRNb2RlICE9PSA3LFxuICAgICAgICAvL2NoZWNrIGlmIGlzIElFNi03IHNpbmNlIGhhc2ggY2hhbmdlIGlzIG9ubHkgc3VwcG9ydGVkIG9uIElFOCsgYW5kXG4gICAgICAgIC8vY2hhbmdpbmcgaGFzaCB2YWx1ZSBvbiBJRTYtNyBkb2Vzbid0IGdlbmVyYXRlIGhpc3RvcnkgcmVjb3JkLlxuICAgICAgICBfaXNMZWdhY3lJRSA9IF9pc0lFICYmICFfaXNIYXNoQ2hhbmdlU3VwcG9ydGVkLFxuICAgICAgICBfaXNMb2NhbCA9IChsb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2ZpbGU6Jyk7XG5cblxuICAgIC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBQcml2YXRlIE1ldGhvZHNcbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICBmdW5jdGlvbiBfZXNjYXBlUmVnRXhwKHN0cil7XG4gICAgICAgIHJldHVybiBTdHJpbmcoc3RyIHx8ICcnKS5yZXBsYWNlKC9cXFcvZywgXCJcXFxcJCZcIik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3RyaW1IYXNoKGhhc2gpe1xuICAgICAgICBpZiAoIWhhc2gpIHJldHVybiAnJztcbiAgICAgICAgdmFyIHJlZ2V4cCA9IG5ldyBSZWdFeHAoJ14nICsgX2VzY2FwZVJlZ0V4cChoYXNoZXIucHJlcGVuZEhhc2gpICsgJ3wnICsgX2VzY2FwZVJlZ0V4cChoYXNoZXIuYXBwZW5kSGFzaCkgKyAnJCcsICdnJyk7XG4gICAgICAgIHJldHVybiBoYXNoLnJlcGxhY2UocmVnZXhwLCAnJyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2dldFdpbmRvd0hhc2goKXtcbiAgICAgICAgLy9wYXJzZWQgZnVsbCBVUkwgaW5zdGVhZCBvZiBnZXR0aW5nIHdpbmRvdy5sb2NhdGlvbi5oYXNoIGJlY2F1c2UgRmlyZWZveCBkZWNvZGUgaGFzaCB2YWx1ZSAoYW5kIGFsbCB0aGUgb3RoZXIgYnJvd3NlcnMgZG9uJ3QpXG4gICAgICAgIC8vYWxzbyBiZWNhdXNlIG9mIElFOCBidWcgd2l0aCBoYXNoIHF1ZXJ5IGluIGxvY2FsIGZpbGUgW2lzc3VlICM2XVxuICAgICAgICB2YXIgcmVzdWx0ID0gX2hhc2hWYWxSZWdleHAuZXhlYyggaGFzaGVyLmdldFVSTCgpICk7XG4gICAgICAgIHZhciBwYXRoID0gKHJlc3VsdCAmJiByZXN1bHRbMV0pIHx8ICcnO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBoYXNoZXIucmF3PyBwYXRoIDogZGVjb2RlVVJJQ29tcG9uZW50KHBhdGgpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gaW4gY2FzZSB1c2VyIGRpZCBub3Qgc2V0IGBoYXNoZXIucmF3YCBhbmQgZGVjb2RlVVJJQ29tcG9uZW50XG4gICAgICAgICAgLy8gdGhyb3dzIGFuIGVycm9yIChzZWUgIzU3KVxuICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2dldEZyYW1lSGFzaCgpe1xuICAgICAgICByZXR1cm4gKF9mcmFtZSk/IF9mcmFtZS5jb250ZW50V2luZG93LmZyYW1lSGFzaCA6IG51bGw7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2NyZWF0ZUZyYW1lKCl7XG4gICAgICAgIF9mcmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgICBfZnJhbWUuc3JjID0gJ2Fib3V0OmJsYW5rJztcbiAgICAgICAgX2ZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoX2ZyYW1lKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfdXBkYXRlRnJhbWUoKXtcbiAgICAgICAgaWYoX2ZyYW1lICYmIF9oYXNoICE9PSBfZ2V0RnJhbWVIYXNoKCkpe1xuICAgICAgICAgICAgdmFyIGZyYW1lRG9jID0gX2ZyYW1lLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ7XG4gICAgICAgICAgICBmcmFtZURvYy5vcGVuKCk7XG4gICAgICAgICAgICAvL3VwZGF0ZSBpZnJhbWUgY29udGVudCB0byBmb3JjZSBuZXcgaGlzdG9yeSByZWNvcmQuXG4gICAgICAgICAgICAvL2Jhc2VkIG9uIFJlYWxseSBTaW1wbGUgSGlzdG9yeSwgU1dGQWRkcmVzcyBhbmQgWVVJLmhpc3RvcnkuXG4gICAgICAgICAgICBmcmFtZURvYy53cml0ZSgnPGh0bWw+PGhlYWQ+PHRpdGxlPicgKyBkb2N1bWVudC50aXRsZSArICc8L3RpdGxlPjxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiPnZhciBmcmFtZUhhc2g9XCInICsgX2hhc2ggKyAnXCI7PC9zY3JpcHQ+PC9oZWFkPjxib2R5PiZuYnNwOzwvYm9keT48L2h0bWw+Jyk7XG4gICAgICAgICAgICBmcmFtZURvYy5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlZ2lzdGVyQ2hhbmdlKG5ld0hhc2gsIGlzUmVwbGFjZSl7XG4gICAgICAgIGlmKF9oYXNoICE9PSBuZXdIYXNoKXtcbiAgICAgICAgICAgIHZhciBvbGRIYXNoID0gX2hhc2g7XG4gICAgICAgICAgICBfaGFzaCA9IG5ld0hhc2g7IC8vc2hvdWxkIGNvbWUgYmVmb3JlIGV2ZW50IGRpc3BhdGNoIHRvIG1ha2Ugc3VyZSB1c2VyIGNhbiBnZXQgcHJvcGVyIHZhbHVlIGluc2lkZSBldmVudCBoYW5kbGVyXG4gICAgICAgICAgICBpZihfaXNMZWdhY3lJRSl7XG4gICAgICAgICAgICAgICAgaWYoIWlzUmVwbGFjZSl7XG4gICAgICAgICAgICAgICAgICAgIF91cGRhdGVGcmFtZSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF9mcmFtZS5jb250ZW50V2luZG93LmZyYW1lSGFzaCA9IG5ld0hhc2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaGFzaGVyLmNoYW5nZWQuZGlzcGF0Y2goX3RyaW1IYXNoKG5ld0hhc2gpLCBfdHJpbUhhc2gob2xkSGFzaCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKF9pc0xlZ2FjeUlFKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2NoZWNrSGlzdG9yeSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB2YXIgd2luZG93SGFzaCA9IF9nZXRXaW5kb3dIYXNoKCksXG4gICAgICAgICAgICAgICAgZnJhbWVIYXNoID0gX2dldEZyYW1lSGFzaCgpO1xuICAgICAgICAgICAgaWYoZnJhbWVIYXNoICE9PSBfaGFzaCAmJiBmcmFtZUhhc2ggIT09IHdpbmRvd0hhc2gpe1xuICAgICAgICAgICAgICAgIC8vZGV0ZWN0IGNoYW5nZXMgbWFkZSBwcmVzc2luZyBicm93c2VyIGhpc3RvcnkgYnV0dG9ucy5cbiAgICAgICAgICAgICAgICAvL1dvcmthcm91bmQgc2luY2UgaGlzdG9yeS5iYWNrKCkgYW5kIGhpc3RvcnkuZm9yd2FyZCgpIGRvZXNuJ3RcbiAgICAgICAgICAgICAgICAvL3VwZGF0ZSBoYXNoIHZhbHVlIG9uIElFNi83IGJ1dCB1cGRhdGVzIGNvbnRlbnQgb2YgdGhlIGlmcmFtZS5cbiAgICAgICAgICAgICAgICAvL25lZWRzIHRvIHRyaW0gaGFzaCBzaW5jZSB2YWx1ZSBzdG9yZWQgYWxyZWFkeSBoYXZlXG4gICAgICAgICAgICAgICAgLy9wcmVwZW5kSGFzaCArIGFwcGVuZEhhc2ggZm9yIGZhc3QgY2hlY2suXG4gICAgICAgICAgICAgICAgaGFzaGVyLnNldEhhc2goX3RyaW1IYXNoKGZyYW1lSGFzaCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh3aW5kb3dIYXNoICE9PSBfaGFzaCl7XG4gICAgICAgICAgICAgICAgLy9kZXRlY3QgaWYgaGFzaCBjaGFuZ2VkIChtYW51YWxseSBvciB1c2luZyBzZXRIYXNoKVxuICAgICAgICAgICAgICAgIF9yZWdpc3RlckNoYW5nZSh3aW5kb3dIYXNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvKipcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9jaGVja0hpc3RvcnkgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyIHdpbmRvd0hhc2ggPSBfZ2V0V2luZG93SGFzaCgpO1xuICAgICAgICAgICAgaWYod2luZG93SGFzaCAhPT0gX2hhc2gpe1xuICAgICAgICAgICAgICAgIF9yZWdpc3RlckNoYW5nZSh3aW5kb3dIYXNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfYWRkTGlzdGVuZXIoZWxtLCBlVHlwZSwgZm4pe1xuICAgICAgICBpZihlbG0uYWRkRXZlbnRMaXN0ZW5lcil7XG4gICAgICAgICAgICBlbG0uYWRkRXZlbnRMaXN0ZW5lcihlVHlwZSwgZm4sIGZhbHNlKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbG0uYXR0YWNoRXZlbnQpe1xuICAgICAgICAgICAgZWxtLmF0dGFjaEV2ZW50KCdvbicgKyBlVHlwZSwgZm4pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlbW92ZUxpc3RlbmVyKGVsbSwgZVR5cGUsIGZuKXtcbiAgICAgICAgaWYoZWxtLnJlbW92ZUV2ZW50TGlzdGVuZXIpe1xuICAgICAgICAgICAgZWxtLnJlbW92ZUV2ZW50TGlzdGVuZXIoZVR5cGUsIGZuLCBmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxtLmRldGFjaEV2ZW50KXtcbiAgICAgICAgICAgIGVsbS5kZXRhY2hFdmVudCgnb24nICsgZVR5cGUsIGZuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9tYWtlUGF0aChwYXRocyl7XG4gICAgICAgIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgICAgICB2YXIgcGF0aCA9IHBhdGhzLmpvaW4oaGFzaGVyLnNlcGFyYXRvcik7XG4gICAgICAgIHBhdGggPSBwYXRoPyBoYXNoZXIucHJlcGVuZEhhc2ggKyBwYXRoLnJlcGxhY2UoX2hhc2hSZWdleHAsICcnKSArIGhhc2hlci5hcHBlbmRIYXNoIDogcGF0aDtcbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2VuY29kZVBhdGgocGF0aCl7XG4gICAgICAgIC8vdXNlZCBlbmNvZGVVUkkgaW5zdGVhZCBvZiBlbmNvZGVVUklDb21wb25lbnQgdG8gcHJlc2VydmUgJz8nLCAnLycsXG4gICAgICAgIC8vJyMnLiBGaXhlcyBTYWZhcmkgYnVnIFtpc3N1ZSAjOF1cbiAgICAgICAgcGF0aCA9IGVuY29kZVVSSShwYXRoKTtcbiAgICAgICAgaWYoX2lzSUUgJiYgX2lzTG9jYWwpe1xuICAgICAgICAgICAgLy9maXggSUU4IGxvY2FsIGZpbGUgYnVnIFtpc3N1ZSAjNl1cbiAgICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcPy8sICclM0YnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG5cbiAgICAvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gUHVibGljIChBUEkpXG4gICAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgaGFzaGVyID0gLyoqIEBsZW5kcyBoYXNoZXIgKi8ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBoYXNoZXIgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgc3RyaW5nXG4gICAgICAgICAqIEBjb25zdGFudFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjIuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJvb2xlYW4gZGVjaWRpbmcgaWYgaGFzaGVyIGVuY29kZXMvZGVjb2RlcyB0aGUgaGFzaCBvciBub3QuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogPGxpPmRlZmF1bHQgdmFsdWU6IGZhbHNlOzwvbGk+XG4gICAgICAgICAqIDwvdWw+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIHJhdyA6IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdHJpbmcgdGhhdCBzaG91bGQgYWx3YXlzIGJlIGFkZGVkIHRvIHRoZSBlbmQgb2YgSGFzaCB2YWx1ZS5cbiAgICAgICAgICogPHVsPlxuICAgICAgICAgKiA8bGk+ZGVmYXVsdCB2YWx1ZTogJyc7PC9saT5cbiAgICAgICAgICogPGxpPndpbGwgYmUgYXV0b21hdGljYWxseSByZW1vdmVkIGZyb20gYGhhc2hlci5nZXRIYXNoKClgPC9saT5cbiAgICAgICAgICogPGxpPmF2b2lkIGNvbmZsaWN0cyB3aXRoIGVsZW1lbnRzIHRoYXQgY29udGFpbiBJRCBlcXVhbCB0byBoYXNoIHZhbHVlOzwvbGk+XG4gICAgICAgICAqIDwvdWw+XG4gICAgICAgICAqIEB0eXBlIHN0cmluZ1xuICAgICAgICAgKi9cbiAgICAgICAgYXBwZW5kSGFzaCA6ICcnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdHJpbmcgdGhhdCBzaG91bGQgYWx3YXlzIGJlIGFkZGVkIHRvIHRoZSBiZWdpbm5pbmcgb2YgSGFzaCB2YWx1ZS5cbiAgICAgICAgICogPHVsPlxuICAgICAgICAgKiA8bGk+ZGVmYXVsdCB2YWx1ZTogJy8nOzwvbGk+XG4gICAgICAgICAqIDxsaT53aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIGBoYXNoZXIuZ2V0SGFzaCgpYDwvbGk+XG4gICAgICAgICAqIDxsaT5hdm9pZCBjb25mbGljdHMgd2l0aCBlbGVtZW50cyB0aGF0IGNvbnRhaW4gSUQgZXF1YWwgdG8gaGFzaCB2YWx1ZTs8L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKiBAdHlwZSBzdHJpbmdcbiAgICAgICAgICovXG4gICAgICAgIHByZXBlbmRIYXNoIDogJy8nLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdHJpbmcgdXNlZCB0byBzcGxpdCBoYXNoIHBhdGhzOyB1c2VkIGJ5IGBoYXNoZXIuZ2V0SGFzaEFzQXJyYXkoKWAgdG8gc3BsaXQgcGF0aHMuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogPGxpPmRlZmF1bHQgdmFsdWU6ICcvJzs8L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKiBAdHlwZSBzdHJpbmdcbiAgICAgICAgICovXG4gICAgICAgIHNlcGFyYXRvciA6ICcvJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2lnbmFsIGRpc3BhdGNoZWQgd2hlbiBoYXNoIHZhbHVlIGNoYW5nZXMuXG4gICAgICAgICAqIC0gcGFzcyBjdXJyZW50IGhhc2ggYXMgMXN0IHBhcmFtZXRlciB0byBsaXN0ZW5lcnMgYW5kIHByZXZpb3VzIGhhc2ggdmFsdWUgYXMgMm5kIHBhcmFtZXRlci5cbiAgICAgICAgICogQHR5cGUgc2lnbmFscy5TaWduYWxcbiAgICAgICAgICovXG4gICAgICAgIGNoYW5nZWQgOiBuZXcgU2lnbmFsKCksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gaGFzaGVyIGlzIHN0b3BwZWQuXG4gICAgICAgICAqIC0gIHBhc3MgY3VycmVudCBoYXNoIGFzIGZpcnN0IHBhcmFtZXRlciB0byBsaXN0ZW5lcnNcbiAgICAgICAgICogQHR5cGUgc2lnbmFscy5TaWduYWxcbiAgICAgICAgICovXG4gICAgICAgIHN0b3BwZWQgOiBuZXcgU2lnbmFsKCksXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gaGFzaGVyIGlzIGluaXRpYWxpemVkLlxuICAgICAgICAgKiAtIHBhc3MgY3VycmVudCBoYXNoIGFzIGZpcnN0IHBhcmFtZXRlciB0byBsaXN0ZW5lcnMuXG4gICAgICAgICAqIEB0eXBlIHNpZ25hbHMuU2lnbmFsXG4gICAgICAgICAqL1xuICAgICAgICBpbml0aWFsaXplZCA6IG5ldyBTaWduYWwoKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgbGlzdGVuaW5nL2Rpc3BhdGNoaW5nIGNoYW5nZXMgaW4gdGhlIGhhc2gvaGlzdG9yeS5cbiAgICAgICAgICogPHVsPlxuICAgICAgICAgKiAgIDxsaT5oYXNoZXIgd29uJ3QgZGlzcGF0Y2ggQ0hBTkdFIGV2ZW50cyBieSBtYW51YWxseSB0eXBpbmcgYSBuZXcgdmFsdWUgb3IgcHJlc3NpbmcgdGhlIGJhY2svZm9yd2FyZCBidXR0b25zIGJlZm9yZSBjYWxsaW5nIHRoaXMgbWV0aG9kLjwvbGk+XG4gICAgICAgICAqIDwvdWw+XG4gICAgICAgICAqL1xuICAgICAgICBpbml0IDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGlmKF9pc0FjdGl2ZSkgcmV0dXJuO1xuXG4gICAgICAgICAgICBfaGFzaCA9IF9nZXRXaW5kb3dIYXNoKCk7XG5cbiAgICAgICAgICAgIC8vdGhvdWdodCBhYm91dCBicmFuY2hpbmcvb3ZlcmxvYWRpbmcgaGFzaGVyLmluaXQoKSB0byBhdm9pZCBjaGVja2luZyBtdWx0aXBsZSB0aW1lcyBidXRcbiAgICAgICAgICAgIC8vZG9uJ3QgdGhpbmsgd29ydGggZG9pbmcgaXQgc2luY2UgaXQgcHJvYmFibHkgd29uJ3QgYmUgY2FsbGVkIG11bHRpcGxlIHRpbWVzLlxuICAgICAgICAgICAgaWYoX2lzSGFzaENoYW5nZVN1cHBvcnRlZCl7XG4gICAgICAgICAgICAgICAgX2FkZExpc3RlbmVyKHdpbmRvdywgJ2hhc2hjaGFuZ2UnLCBfY2hlY2tIaXN0b3J5KTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgICBpZihfaXNMZWdhY3lJRSl7XG4gICAgICAgICAgICAgICAgICAgIGlmKCEgX2ZyYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9jcmVhdGVGcmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF91cGRhdGVGcmFtZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBfY2hlY2tJbnRlcnZhbCA9IHNldEludGVydmFsKF9jaGVja0hpc3RvcnksIFBPT0xfSU5URVJWQUwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfaXNBY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgaGFzaGVyLmluaXRpYWxpemVkLmRpc3BhdGNoKF90cmltSGFzaChfaGFzaCkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9wIGxpc3RlbmluZy9kaXNwYXRjaGluZyBjaGFuZ2VzIGluIHRoZSBoYXNoL2hpc3RvcnkuXG4gICAgICAgICAqIDx1bD5cbiAgICAgICAgICogICA8bGk+aGFzaGVyIHdvbid0IGRpc3BhdGNoIENIQU5HRSBldmVudHMgYnkgbWFudWFsbHkgdHlwaW5nIGEgbmV3IHZhbHVlIG9yIHByZXNzaW5nIHRoZSBiYWNrL2ZvcndhcmQgYnV0dG9ucyBhZnRlciBjYWxsaW5nIHRoaXMgbWV0aG9kLCB1bmxlc3MgeW91IGNhbGwgaGFzaGVyLmluaXQoKSBhZ2Fpbi48L2xpPlxuICAgICAgICAgKiAgIDxsaT5oYXNoZXIgd2lsbCBzdGlsbCBkaXNwYXRjaCBjaGFuZ2VzIG1hZGUgcHJvZ3JhbWF0aWNhbGx5IGJ5IGNhbGxpbmcgaGFzaGVyLnNldEhhc2goKTs8L2xpPlxuICAgICAgICAgKiA8L3VsPlxuICAgICAgICAgKi9cbiAgICAgICAgc3RvcCA6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBpZighIF9pc0FjdGl2ZSkgcmV0dXJuO1xuXG4gICAgICAgICAgICBpZihfaXNIYXNoQ2hhbmdlU3VwcG9ydGVkKXtcbiAgICAgICAgICAgICAgICBfcmVtb3ZlTGlzdGVuZXIod2luZG93LCAnaGFzaGNoYW5nZScsIF9jaGVja0hpc3RvcnkpO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChfY2hlY2tJbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgX2NoZWNrSW50ZXJ2YWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfaXNBY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIGhhc2hlci5zdG9wcGVkLmRpc3BhdGNoKF90cmltSGFzaChfaGFzaCkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSAgICBJZiBoYXNoZXIgaXMgbGlzdGVuaW5nIHRvIGNoYW5nZXMgb24gdGhlIGJyb3dzZXIgaGlzdG9yeSBhbmQvb3IgaGFzaCB2YWx1ZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzQWN0aXZlIDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHJldHVybiBfaXNBY3RpdmU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gRnVsbCBVUkwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRVUkwgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IFJldHJpZXZlIFVSTCB3aXRob3V0IHF1ZXJ5IHN0cmluZyBhbmQgaGFzaC5cbiAgICAgICAgICovXG4gICAgICAgIGdldEJhc2VVUkwgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuIGhhc2hlci5nZXRVUkwoKS5yZXBsYWNlKF9iYXNlVXJsUmVnZXhwLCAnJyk7IC8vcmVtb3ZlcyBldmVyeXRoaW5nIGFmdGVyICc/JyBhbmQvb3IgJyMnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBIYXNoIHZhbHVlLCBnZW5lcmF0aW5nIGEgbmV3IGhpc3RvcnkgcmVjb3JkLlxuICAgICAgICAgKiBAcGFyYW0gey4uLnN0cmluZ30gcGF0aCAgICBIYXNoIHZhbHVlIHdpdGhvdXQgJyMnLiBIYXNoZXIgd2lsbCBqb2luXG4gICAgICAgICAqIHBhdGggc2VnbWVudHMgdXNpbmcgYGhhc2hlci5zZXBhcmF0b3JgIGFuZCBwcmVwZW5kL2FwcGVuZCBoYXNoIHZhbHVlXG4gICAgICAgICAqIHdpdGggYGhhc2hlci5hcHBlbmRIYXNoYCBhbmQgYGhhc2hlci5wcmVwZW5kSGFzaGBcbiAgICAgICAgICogQGV4YW1wbGUgaGFzaGVyLnNldEhhc2goJ2xvcmVtJywgJ2lwc3VtJywgJ2RvbG9yJykgLT4gJyMvbG9yZW0vaXBzdW0vZG9sb3InXG4gICAgICAgICAqL1xuICAgICAgICBzZXRIYXNoIDogZnVuY3Rpb24ocGF0aCl7XG4gICAgICAgICAgICBwYXRoID0gX21ha2VQYXRoLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICBpZihwYXRoICE9PSBfaGFzaCl7XG4gICAgICAgICAgICAgICAgLy8gd2Ugc2hvdWxkIHN0b3JlIHJhdyB2YWx1ZVxuICAgICAgICAgICAgICAgIF9yZWdpc3RlckNoYW5nZShwYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAocGF0aCA9PT0gX2hhc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgY2hlY2sgaWYgcGF0aCBpcyBzdGlsbCA9PT0gX2hhc2ggdG8gYXZvaWQgZXJyb3IgaW5cbiAgICAgICAgICAgICAgICAgICAgLy8gY2FzZSBvZiBtdWx0aXBsZSBjb25zZWN1dGl2ZSByZWRpcmVjdHMgW2lzc3VlICMzOV1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCEgaGFzaGVyLnJhdykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCA9IF9lbmNvZGVQYXRoKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5oYXNoID0gJyMnICsgcGF0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBIYXNoIHZhbHVlIHdpdGhvdXQga2VlcGluZyBwcmV2aW91cyBoYXNoIG9uIHRoZSBoaXN0b3J5IHJlY29yZC5cbiAgICAgICAgICogU2ltaWxhciB0byBjYWxsaW5nIGB3aW5kb3cubG9jYXRpb24ucmVwbGFjZShcIiMvaGFzaFwiKWAgYnV0IHdpbGwgYWxzbyB3b3JrIG9uIElFNi03LlxuICAgICAgICAgKiBAcGFyYW0gey4uLnN0cmluZ30gcGF0aCAgICBIYXNoIHZhbHVlIHdpdGhvdXQgJyMnLiBIYXNoZXIgd2lsbCBqb2luXG4gICAgICAgICAqIHBhdGggc2VnbWVudHMgdXNpbmcgYGhhc2hlci5zZXBhcmF0b3JgIGFuZCBwcmVwZW5kL2FwcGVuZCBoYXNoIHZhbHVlXG4gICAgICAgICAqIHdpdGggYGhhc2hlci5hcHBlbmRIYXNoYCBhbmQgYGhhc2hlci5wcmVwZW5kSGFzaGBcbiAgICAgICAgICogQGV4YW1wbGUgaGFzaGVyLnJlcGxhY2VIYXNoKCdsb3JlbScsICdpcHN1bScsICdkb2xvcicpIC0+ICcjL2xvcmVtL2lwc3VtL2RvbG9yJ1xuICAgICAgICAgKi9cbiAgICAgICAgcmVwbGFjZUhhc2ggOiBmdW5jdGlvbihwYXRoKXtcbiAgICAgICAgICAgIHBhdGggPSBfbWFrZVBhdGguYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIGlmKHBhdGggIT09IF9oYXNoKXtcbiAgICAgICAgICAgICAgICAvLyB3ZSBzaG91bGQgc3RvcmUgcmF3IHZhbHVlXG4gICAgICAgICAgICAgICAgX3JlZ2lzdGVyQ2hhbmdlKHBhdGgsIHRydWUpO1xuICAgICAgICAgICAgICAgIGlmIChwYXRoID09PSBfaGFzaCkge1xuICAgICAgICAgICAgICAgICAgICAvLyB3ZSBjaGVjayBpZiBwYXRoIGlzIHN0aWxsID09PSBfaGFzaCB0byBhdm9pZCBlcnJvciBpblxuICAgICAgICAgICAgICAgICAgICAvLyBjYXNlIG9mIG11bHRpcGxlIGNvbnNlY3V0aXZlIHJlZGlyZWN0cyBbaXNzdWUgIzM5XVxuICAgICAgICAgICAgICAgICAgICBpZiAoISBoYXNoZXIucmF3KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoID0gX2VuY29kZVBhdGgocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLnJlcGxhY2UoJyMnICsgcGF0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IEhhc2ggdmFsdWUgd2l0aG91dCAnIycsIGBoYXNoZXIuYXBwZW5kSGFzaGAgYW5kIGBoYXNoZXIucHJlcGVuZEhhc2hgLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0SGFzaCA6IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAvL2RpZG4ndCB1c2VkIGFjdHVhbCB2YWx1ZSBvZiB0aGUgYHdpbmRvdy5sb2NhdGlvbi5oYXNoYCB0byBhdm9pZCBicmVha2luZyB0aGUgYXBwbGljYXRpb24gaW4gY2FzZSBgd2luZG93LmxvY2F0aW9uLmhhc2hgIGlzbid0IGF2YWlsYWJsZSBhbmQgYWxzbyBiZWNhdXNlIHZhbHVlIHNob3VsZCBhbHdheXMgYmUgc3luY2hlZC5cbiAgICAgICAgICAgIHJldHVybiBfdHJpbUhhc2goX2hhc2gpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheS48c3RyaW5nPn0gSGFzaCB2YWx1ZSBzcGxpdCBpbnRvIGFuIEFycmF5LlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0SGFzaEFzQXJyYXkgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuIGhhc2hlci5nZXRIYXNoKCkuc3BsaXQoaGFzaGVyLnNlcGFyYXRvcik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZXMgYWxsIGV2ZW50IGxpc3RlbmVycywgc3RvcHMgaGFzaGVyIGFuZCBkZXN0cm95IGhhc2hlciBvYmplY3QuXG4gICAgICAgICAqIC0gSU1QT1JUQU5UOiBoYXNoZXIgd29uJ3Qgd29yayBhZnRlciBjYWxsaW5nIHRoaXMgbWV0aG9kLCBoYXNoZXIgT2JqZWN0IHdpbGwgYmUgZGVsZXRlZC5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgaGFzaGVyLnN0b3AoKTtcbiAgICAgICAgICAgIGhhc2hlci5pbml0aWFsaXplZC5kaXNwb3NlKCk7XG4gICAgICAgICAgICBoYXNoZXIuc3RvcHBlZC5kaXNwb3NlKCk7XG4gICAgICAgICAgICBoYXNoZXIuY2hhbmdlZC5kaXNwb3NlKCk7XG4gICAgICAgICAgICBfZnJhbWUgPSBoYXNoZXIgPSB3aW5kb3cuaGFzaGVyID0gbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBBIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgb2JqZWN0LlxuICAgICAgICAgKi9cbiAgICAgICAgdG9TdHJpbmcgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgcmV0dXJuICdbaGFzaGVyIHZlcnNpb249XCInKyBoYXNoZXIuVkVSU0lPTiArJ1wiIGhhc2g9XCInKyBoYXNoZXIuZ2V0SGFzaCgpICsnXCJdJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIGhhc2hlci5pbml0aWFsaXplZC5tZW1vcml6ZSA9IHRydWU7IC8vc2VlICMzM1xuXG4gICAgcmV0dXJuIGhhc2hlcjtcblxufSh3aW5kb3cpKTtcblxuXG4gICAgcmV0dXJuIGhhc2hlcjtcbn07XG5cbmlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoWydzaWduYWxzJ10sIGZhY3RvcnkpO1xufSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnc2lnbmFscycpKTtcbn0gZWxzZSB7XG4gICAgLypqc2hpbnQgc3ViOnRydWUgKi9cbiAgICB3aW5kb3dbJ2hhc2hlciddID0gZmFjdG9yeSh3aW5kb3dbJ3NpZ25hbHMnXSk7XG59XG5cbn0oKSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhc2FwID0gcmVxdWlyZSgnYXNhcCcpXG5cbm1vZHVsZS5leHBvcnRzID0gUHJvbWlzZVxuZnVuY3Rpb24gUHJvbWlzZShmbikge1xuICBpZiAodHlwZW9mIHRoaXMgIT09ICdvYmplY3QnKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdQcm9taXNlcyBtdXN0IGJlIGNvbnN0cnVjdGVkIHZpYSBuZXcnKVxuICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdub3QgYSBmdW5jdGlvbicpXG4gIHZhciBzdGF0ZSA9IG51bGxcbiAgdmFyIHZhbHVlID0gbnVsbFxuICB2YXIgZGVmZXJyZWRzID0gW11cbiAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgdGhpcy50aGVuID0gZnVuY3Rpb24ob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBoYW5kbGUobmV3IEhhbmRsZXIob25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIHJlc29sdmUsIHJlamVjdCkpXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZShkZWZlcnJlZCkge1xuICAgIGlmIChzdGF0ZSA9PT0gbnVsbCkge1xuICAgICAgZGVmZXJyZWRzLnB1c2goZGVmZXJyZWQpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXNhcChmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjYiA9IHN0YXRlID8gZGVmZXJyZWQub25GdWxmaWxsZWQgOiBkZWZlcnJlZC5vblJlamVjdGVkXG4gICAgICBpZiAoY2IgPT09IG51bGwpIHtcbiAgICAgICAgKHN0YXRlID8gZGVmZXJyZWQucmVzb2x2ZSA6IGRlZmVycmVkLnJlamVjdCkodmFsdWUpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgdmFyIHJldFxuICAgICAgdHJ5IHtcbiAgICAgICAgcmV0ID0gY2IodmFsdWUpXG4gICAgICB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZSlcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBkZWZlcnJlZC5yZXNvbHZlKHJldClcbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZShuZXdWYWx1ZSkge1xuICAgIHRyeSB7IC8vUHJvbWlzZSBSZXNvbHV0aW9uIFByb2NlZHVyZTogaHR0cHM6Ly9naXRodWIuY29tL3Byb21pc2VzLWFwbHVzL3Byb21pc2VzLXNwZWMjdGhlLXByb21pc2UtcmVzb2x1dGlvbi1wcm9jZWR1cmVcbiAgICAgIGlmIChuZXdWYWx1ZSA9PT0gc2VsZikgdGhyb3cgbmV3IFR5cGVFcnJvcignQSBwcm9taXNlIGNhbm5vdCBiZSByZXNvbHZlZCB3aXRoIGl0c2VsZi4nKVxuICAgICAgaWYgKG5ld1ZhbHVlICYmICh0eXBlb2YgbmV3VmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBuZXdWYWx1ZSA9PT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgICAgdmFyIHRoZW4gPSBuZXdWYWx1ZS50aGVuXG4gICAgICAgIGlmICh0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGRvUmVzb2x2ZSh0aGVuLmJpbmQobmV3VmFsdWUpLCByZXNvbHZlLCByZWplY3QpXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHN0YXRlID0gdHJ1ZVxuICAgICAgdmFsdWUgPSBuZXdWYWx1ZVxuICAgICAgZmluYWxlKClcbiAgICB9IGNhdGNoIChlKSB7IHJlamVjdChlKSB9XG4gIH1cblxuICBmdW5jdGlvbiByZWplY3QobmV3VmFsdWUpIHtcbiAgICBzdGF0ZSA9IGZhbHNlXG4gICAgdmFsdWUgPSBuZXdWYWx1ZVxuICAgIGZpbmFsZSgpXG4gIH1cblxuICBmdW5jdGlvbiBmaW5hbGUoKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGRlZmVycmVkcy5sZW5ndGg7IGkgPCBsZW47IGkrKylcbiAgICAgIGhhbmRsZShkZWZlcnJlZHNbaV0pXG4gICAgZGVmZXJyZWRzID0gbnVsbFxuICB9XG5cbiAgZG9SZXNvbHZlKGZuLCByZXNvbHZlLCByZWplY3QpXG59XG5cblxuZnVuY3Rpb24gSGFuZGxlcihvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCwgcmVzb2x2ZSwgcmVqZWN0KXtcbiAgdGhpcy5vbkZ1bGZpbGxlZCA9IHR5cGVvZiBvbkZ1bGZpbGxlZCA9PT0gJ2Z1bmN0aW9uJyA/IG9uRnVsZmlsbGVkIDogbnVsbFxuICB0aGlzLm9uUmVqZWN0ZWQgPSB0eXBlb2Ygb25SZWplY3RlZCA9PT0gJ2Z1bmN0aW9uJyA/IG9uUmVqZWN0ZWQgOiBudWxsXG4gIHRoaXMucmVzb2x2ZSA9IHJlc29sdmVcbiAgdGhpcy5yZWplY3QgPSByZWplY3Rcbn1cblxuLyoqXG4gKiBUYWtlIGEgcG90ZW50aWFsbHkgbWlzYmVoYXZpbmcgcmVzb2x2ZXIgZnVuY3Rpb24gYW5kIG1ha2Ugc3VyZVxuICogb25GdWxmaWxsZWQgYW5kIG9uUmVqZWN0ZWQgYXJlIG9ubHkgY2FsbGVkIG9uY2UuXG4gKlxuICogTWFrZXMgbm8gZ3VhcmFudGVlcyBhYm91dCBhc3luY2hyb255LlxuICovXG5mdW5jdGlvbiBkb1Jlc29sdmUoZm4sIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkKSB7XG4gIHZhciBkb25lID0gZmFsc2U7XG4gIHRyeSB7XG4gICAgZm4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoZG9uZSkgcmV0dXJuXG4gICAgICBkb25lID0gdHJ1ZVxuICAgICAgb25GdWxmaWxsZWQodmFsdWUpXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgaWYgKGRvbmUpIHJldHVyblxuICAgICAgZG9uZSA9IHRydWVcbiAgICAgIG9uUmVqZWN0ZWQocmVhc29uKVxuICAgIH0pXG4gIH0gY2F0Y2ggKGV4KSB7XG4gICAgaWYgKGRvbmUpIHJldHVyblxuICAgIGRvbmUgPSB0cnVlXG4gICAgb25SZWplY3RlZChleClcbiAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vL1RoaXMgZmlsZSBjb250YWlucyB0aGVuL3Byb21pc2Ugc3BlY2lmaWMgZXh0ZW5zaW9ucyB0byB0aGUgY29yZSBwcm9taXNlIEFQSVxuXG52YXIgUHJvbWlzZSA9IHJlcXVpcmUoJy4vY29yZS5qcycpXG52YXIgYXNhcCA9IHJlcXVpcmUoJ2FzYXAnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb21pc2VcblxuLyogU3RhdGljIEZ1bmN0aW9ucyAqL1xuXG5mdW5jdGlvbiBWYWx1ZVByb21pc2UodmFsdWUpIHtcbiAgdGhpcy50aGVuID0gZnVuY3Rpb24gKG9uRnVsZmlsbGVkKSB7XG4gICAgaWYgKHR5cGVvZiBvbkZ1bGZpbGxlZCAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHRoaXNcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgYXNhcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmVzb2x2ZShvbkZ1bGZpbGxlZCh2YWx1ZSkpXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgcmVqZWN0KGV4KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuICB9XG59XG5WYWx1ZVByb21pc2UucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQcm9taXNlLnByb3RvdHlwZSlcblxudmFyIFRSVUUgPSBuZXcgVmFsdWVQcm9taXNlKHRydWUpXG52YXIgRkFMU0UgPSBuZXcgVmFsdWVQcm9taXNlKGZhbHNlKVxudmFyIE5VTEwgPSBuZXcgVmFsdWVQcm9taXNlKG51bGwpXG52YXIgVU5ERUZJTkVEID0gbmV3IFZhbHVlUHJvbWlzZSh1bmRlZmluZWQpXG52YXIgWkVSTyA9IG5ldyBWYWx1ZVByb21pc2UoMClcbnZhciBFTVBUWVNUUklORyA9IG5ldyBWYWx1ZVByb21pc2UoJycpXG5cblByb21pc2UucmVzb2x2ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSByZXR1cm4gdmFsdWVcblxuICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBOVUxMXG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gVU5ERUZJTkVEXG4gIGlmICh2YWx1ZSA9PT0gdHJ1ZSkgcmV0dXJuIFRSVUVcbiAgaWYgKHZhbHVlID09PSBmYWxzZSkgcmV0dXJuIEZBTFNFXG4gIGlmICh2YWx1ZSA9PT0gMCkgcmV0dXJuIFpFUk9cbiAgaWYgKHZhbHVlID09PSAnJykgcmV0dXJuIEVNUFRZU1RSSU5HXG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdHJ5IHtcbiAgICAgIHZhciB0aGVuID0gdmFsdWUudGhlblxuICAgICAgaWYgKHR5cGVvZiB0aGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSh0aGVuLmJpbmQodmFsdWUpKVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICByZWplY3QoZXgpXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXcgVmFsdWVQcm9taXNlKHZhbHVlKVxufVxuXG5Qcm9taXNlLmZyb20gPSBQcm9taXNlLmNhc3QgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdmFyIGVyciA9IG5ldyBFcnJvcignUHJvbWlzZS5mcm9tIGFuZCBQcm9taXNlLmNhc3QgYXJlIGRlcHJlY2F0ZWQsIHVzZSBQcm9taXNlLnJlc29sdmUgaW5zdGVhZCcpXG4gIGVyci5uYW1lID0gJ1dhcm5pbmcnXG4gIGNvbnNvbGUud2FybihlcnIuc3RhY2spXG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUodmFsdWUpXG59XG5cblByb21pc2UuZGVub2RlaWZ5ID0gZnVuY3Rpb24gKGZuLCBhcmd1bWVudENvdW50KSB7XG4gIGFyZ3VtZW50Q291bnQgPSBhcmd1bWVudENvdW50IHx8IEluZmluaXR5XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHdoaWxlIChhcmdzLmxlbmd0aCAmJiBhcmdzLmxlbmd0aCA+IGFyZ3VtZW50Q291bnQpIHtcbiAgICAgICAgYXJncy5wb3AoKVxuICAgICAgfVxuICAgICAgYXJncy5wdXNoKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKVxuICAgICAgICBlbHNlIHJlc29sdmUocmVzKVxuICAgICAgfSlcbiAgICAgIGZuLmFwcGx5KHNlbGYsIGFyZ3MpXG4gICAgfSlcbiAgfVxufVxuUHJvbWlzZS5ub2RlaWZ5ID0gZnVuY3Rpb24gKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpXG4gICAgdmFyIGNhbGxiYWNrID0gdHlwZW9mIGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gJ2Z1bmN0aW9uJyA/IGFyZ3MucG9wKCkgOiBudWxsXG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpLm5vZGVpZnkoY2FsbGJhY2spXG4gICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgIGlmIChjYWxsYmFjayA9PT0gbnVsbCB8fCB0eXBlb2YgY2FsbGJhY2sgPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgcmVqZWN0KGV4KSB9KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXNhcChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY2FsbGJhY2soZXgpXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cblByb21pc2UuYWxsID0gZnVuY3Rpb24gKCkge1xuICB2YXIgY2FsbGVkV2l0aEFycmF5ID0gYXJndW1lbnRzLmxlbmd0aCA9PT0gMSAmJiBBcnJheS5pc0FycmF5KGFyZ3VtZW50c1swXSlcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChjYWxsZWRXaXRoQXJyYXkgPyBhcmd1bWVudHNbMF0gOiBhcmd1bWVudHMpXG5cbiAgaWYgKCFjYWxsZWRXaXRoQXJyYXkpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKCdQcm9taXNlLmFsbCBzaG91bGQgYmUgY2FsbGVkIHdpdGggYSBzaW5nbGUgYXJyYXksIGNhbGxpbmcgaXQgd2l0aCBtdWx0aXBsZSBhcmd1bWVudHMgaXMgZGVwcmVjYXRlZCcpXG4gICAgZXJyLm5hbWUgPSAnV2FybmluZydcbiAgICBjb25zb2xlLndhcm4oZXJyLnN0YWNrKVxuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICBpZiAoYXJncy5sZW5ndGggPT09IDApIHJldHVybiByZXNvbHZlKFtdKVxuICAgIHZhciByZW1haW5pbmcgPSBhcmdzLmxlbmd0aFxuICAgIGZ1bmN0aW9uIHJlcyhpLCB2YWwpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICh2YWwgJiYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpKSB7XG4gICAgICAgICAgdmFyIHRoZW4gPSB2YWwudGhlblxuICAgICAgICAgIGlmICh0eXBlb2YgdGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhlbi5jYWxsKHZhbCwgZnVuY3Rpb24gKHZhbCkgeyByZXMoaSwgdmFsKSB9LCByZWplY3QpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXJnc1tpXSA9IHZhbFxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICByZXNvbHZlKGFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICByZWplY3QoZXgpXG4gICAgICB9XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVzKGksIGFyZ3NbaV0pXG4gICAgfVxuICB9KVxufVxuXG5Qcm9taXNlLnJlamVjdCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyBcbiAgICByZWplY3QodmFsdWUpO1xuICB9KTtcbn1cblxuUHJvbWlzZS5yYWNlID0gZnVuY3Rpb24gKHZhbHVlcykge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyBcbiAgICB2YWx1ZXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSl7XG4gICAgICBQcm9taXNlLnJlc29sdmUodmFsdWUpLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICB9KVxuICB9KTtcbn1cblxuLyogUHJvdG90eXBlIE1ldGhvZHMgKi9cblxuUHJvbWlzZS5wcm90b3R5cGUuZG9uZSA9IGZ1bmN0aW9uIChvbkZ1bGZpbGxlZCwgb25SZWplY3RlZCkge1xuICB2YXIgc2VsZiA9IGFyZ3VtZW50cy5sZW5ndGggPyB0aGlzLnRoZW4uYXBwbHkodGhpcywgYXJndW1lbnRzKSA6IHRoaXNcbiAgc2VsZi50aGVuKG51bGwsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgIHRocm93IGVyclxuICAgIH0pXG4gIH0pXG59XG5cblByb21pc2UucHJvdG90eXBlLm5vZGVpZnkgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSByZXR1cm4gdGhpc1xuXG4gIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHZhbHVlKVxuICAgIH0pXG4gIH0sIGZ1bmN0aW9uIChlcnIpIHtcbiAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKGVycilcbiAgICB9KVxuICB9KVxufVxuXG5Qcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uIChvblJlamVjdGVkKSB7XG4gIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3RlZCk7XG59XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuXG4vLyBVc2UgdGhlIGZhc3Rlc3QgcG9zc2libGUgbWVhbnMgdG8gZXhlY3V0ZSBhIHRhc2sgaW4gYSBmdXR1cmUgdHVyblxuLy8gb2YgdGhlIGV2ZW50IGxvb3AuXG5cbi8vIGxpbmtlZCBsaXN0IG9mIHRhc2tzIChzaW5nbGUsIHdpdGggaGVhZCBub2RlKVxudmFyIGhlYWQgPSB7dGFzazogdm9pZCAwLCBuZXh0OiBudWxsfTtcbnZhciB0YWlsID0gaGVhZDtcbnZhciBmbHVzaGluZyA9IGZhbHNlO1xudmFyIHJlcXVlc3RGbHVzaCA9IHZvaWQgMDtcbnZhciBpc05vZGVKUyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgICAvKiBqc2hpbnQgbG9vcGZ1bmM6IHRydWUgKi9cblxuICAgIHdoaWxlIChoZWFkLm5leHQpIHtcbiAgICAgICAgaGVhZCA9IGhlYWQubmV4dDtcbiAgICAgICAgdmFyIHRhc2sgPSBoZWFkLnRhc2s7XG4gICAgICAgIGhlYWQudGFzayA9IHZvaWQgMDtcbiAgICAgICAgdmFyIGRvbWFpbiA9IGhlYWQuZG9tYWluO1xuXG4gICAgICAgIGlmIChkb21haW4pIHtcbiAgICAgICAgICAgIGhlYWQuZG9tYWluID0gdm9pZCAwO1xuICAgICAgICAgICAgZG9tYWluLmVudGVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGFzaygpO1xuXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmIChpc05vZGVKUykge1xuICAgICAgICAgICAgICAgIC8vIEluIG5vZGUsIHVuY2F1Z2h0IGV4Y2VwdGlvbnMgYXJlIGNvbnNpZGVyZWQgZmF0YWwgZXJyb3JzLlxuICAgICAgICAgICAgICAgIC8vIFJlLXRocm93IHRoZW0gc3luY2hyb25vdXNseSB0byBpbnRlcnJ1cHQgZmx1c2hpbmchXG5cbiAgICAgICAgICAgICAgICAvLyBFbnN1cmUgY29udGludWF0aW9uIGlmIHRoZSB1bmNhdWdodCBleGNlcHRpb24gaXMgc3VwcHJlc3NlZFxuICAgICAgICAgICAgICAgIC8vIGxpc3RlbmluZyBcInVuY2F1Z2h0RXhjZXB0aW9uXCIgZXZlbnRzIChhcyBkb21haW5zIGRvZXMpLlxuICAgICAgICAgICAgICAgIC8vIENvbnRpbnVlIGluIG5leHQgZXZlbnQgdG8gYXZvaWQgdGljayByZWN1cnNpb24uXG4gICAgICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICBkb21haW4uZXhpdCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZsdXNoLCAwKTtcbiAgICAgICAgICAgICAgICBpZiAoZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbWFpbi5lbnRlcigpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRocm93IGU7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gYnJvd3NlcnMsIHVuY2F1Z2h0IGV4Y2VwdGlvbnMgYXJlIG5vdCBmYXRhbC5cbiAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIGFzeW5jaHJvbm91c2x5IHRvIGF2b2lkIHNsb3ctZG93bnMuXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgZG9tYWluLmV4aXQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZsdXNoaW5nID0gZmFsc2U7XG59XG5cbmlmICh0eXBlb2YgcHJvY2VzcyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBwcm9jZXNzLm5leHRUaWNrKSB7XG4gICAgLy8gTm9kZS5qcyBiZWZvcmUgMC45LiBOb3RlIHRoYXQgc29tZSBmYWtlLU5vZGUgZW52aXJvbm1lbnRzLCBsaWtlIHRoZVxuICAgIC8vIE1vY2hhIHRlc3QgcnVubmVyLCBpbnRyb2R1Y2UgYSBgcHJvY2Vzc2AgZ2xvYmFsIHdpdGhvdXQgYSBgbmV4dFRpY2tgLlxuICAgIGlzTm9kZUpTID0gdHJ1ZTtcblxuICAgIHJlcXVlc3RGbHVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gICAgfTtcblxufSBlbHNlIGlmICh0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAvLyBJbiBJRTEwLCBOb2RlLmpzIDAuOSssIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9Ob2JsZUpTL3NldEltbWVkaWF0ZVxuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHJlcXVlc3RGbHVzaCA9IHNldEltbWVkaWF0ZS5iaW5kKHdpbmRvdywgZmx1c2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVlc3RGbHVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldEltbWVkaWF0ZShmbHVzaCk7XG4gICAgICAgIH07XG4gICAgfVxuXG59IGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIC8vIG1vZGVybiBicm93c2Vyc1xuICAgIC8vIGh0dHA6Ly93d3cubm9uYmxvY2tpbmcuaW8vMjAxMS8wNi93aW5kb3duZXh0dGljay5odG1sXG4gICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZsdXNoO1xuICAgIHJlcXVlc3RGbHVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgICB9O1xuXG59IGVsc2Uge1xuICAgIC8vIG9sZCBicm93c2Vyc1xuICAgIHJlcXVlc3RGbHVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2V0VGltZW91dChmbHVzaCwgMCk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gYXNhcCh0YXNrKSB7XG4gICAgdGFpbCA9IHRhaWwubmV4dCA9IHtcbiAgICAgICAgdGFzazogdGFzayxcbiAgICAgICAgZG9tYWluOiBpc05vZGVKUyAmJiBwcm9jZXNzLmRvbWFpbixcbiAgICAgICAgbmV4dDogbnVsbFxuICAgIH07XG5cbiAgICBpZiAoIWZsdXNoaW5nKSB7XG4gICAgICAgIGZsdXNoaW5nID0gdHJ1ZTtcbiAgICAgICAgcmVxdWVzdEZsdXNoKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBhc2FwO1xuXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKSIsIi8vIFNvbWUgY29kZSBvcmlnaW5hbGx5IGZyb20gYXN5bmNfc3RvcmFnZS5qcyBpblxuLy8gW0dhaWFdKGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhLWIyZy9nYWlhKS5cbihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBPcmlnaW5hbGx5IGZvdW5kIGluIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhLWIyZy9nYWlhL2Jsb2IvZThmNjI0ZTRjYzllYTk0NTcyNzI3ODAzOWIzYmM5YmNiOWY4NjY3YS9zaGFyZWQvanMvYXN5bmNfc3RvcmFnZS5qc1xuXG4gICAgLy8gUHJvbWlzZXMhXG4gICAgdmFyIFByb21pc2UgPSAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpID9cbiAgICAgICAgICAgICAgICAgIHJlcXVpcmUoJ3Byb21pc2UnKSA6IHRoaXMuUHJvbWlzZTtcblxuICAgIC8vIEluaXRpYWxpemUgSW5kZXhlZERCOyBmYWxsIGJhY2sgdG8gdmVuZG9yLXByZWZpeGVkIHZlcnNpb25zIGlmIG5lZWRlZC5cbiAgICB2YXIgaW5kZXhlZERCID0gaW5kZXhlZERCIHx8IHRoaXMuaW5kZXhlZERCIHx8IHRoaXMud2Via2l0SW5kZXhlZERCIHx8XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW96SW5kZXhlZERCIHx8IHRoaXMuT0luZGV4ZWREQiB8fFxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1zSW5kZXhlZERCO1xuXG4gICAgLy8gSWYgSW5kZXhlZERCIGlzbid0IGF2YWlsYWJsZSwgd2UgZ2V0IG91dHRhIGhlcmUhXG4gICAgaWYgKCFpbmRleGVkREIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9wZW4gdGhlIEluZGV4ZWREQiBkYXRhYmFzZSAoYXV0b21hdGljYWxseSBjcmVhdGVzIG9uZSBpZiBvbmUgZGlkbid0XG4gICAgLy8gcHJldmlvdXNseSBleGlzdCksIHVzaW5nIGFueSBvcHRpb25zIHNldCBpbiB0aGUgY29uZmlnLlxuICAgIGZ1bmN0aW9uIF9pbml0U3RvcmFnZShvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGRiSW5mbyA9IHtcbiAgICAgICAgICAgIGRiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGRiSW5mb1tpXSA9IG9wdGlvbnNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICB2YXIgb3BlbnJlcSA9IGluZGV4ZWREQi5vcGVuKGRiSW5mby5uYW1lLCBkYkluZm8udmVyc2lvbik7XG4gICAgICAgICAgICBvcGVucmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICByZWplY3Qob3BlbnJlcS5lcnJvcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3BlbnJlcS5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAvLyBGaXJzdCB0aW1lIHNldHVwOiBjcmVhdGUgYW4gZW1wdHkgb2JqZWN0IHN0b3JlXG4gICAgICAgICAgICAgICAgb3BlbnJlcS5yZXN1bHQuY3JlYXRlT2JqZWN0U3RvcmUoZGJJbmZvLnN0b3JlTmFtZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3BlbnJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBkYkluZm8uZGIgPSBvcGVucmVxLnJlc3VsdDtcbiAgICAgICAgICAgICAgICBzZWxmLl9kYkluZm8gPSBkYkluZm87XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0SXRlbShrZXksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBDYXN0IHRoZSBrZXkgdG8gYSBzdHJpbmcsIGFzIHRoYXQncyBhbGwgd2UgY2FuIHNldCBhcyBhIGtleS5cbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB3aW5kb3cuY29uc29sZS53YXJuKGtleSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgdXNlZCBhcyBhIGtleSwgYnV0IGl0IGlzIG5vdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIGtleSA9IFN0cmluZyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gZGJJbmZvLmRiLnRyYW5zYWN0aW9uKGRiSW5mby5zdG9yZU5hbWUsICdyZWFkb25seScpXG4gICAgICAgICAgICAgICAgICAgIC5vYmplY3RTdG9yZShkYkluZm8uc3RvcmVOYW1lKTtcbiAgICAgICAgICAgICAgICB2YXIgcmVxID0gc3RvcmUuZ2V0KGtleSk7XG5cbiAgICAgICAgICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IHJlcS5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVEZWZlcmVkQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgYWxsIGl0ZW1zIHN0b3JlZCBpbiBkYXRhYmFzZS5cbiAgICBmdW5jdGlvbiBpdGVyYXRlKGl0ZXJhdG9yLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gZGJJbmZvLmRiLnRyYW5zYWN0aW9uKGRiSW5mby5zdG9yZU5hbWUsICdyZWFkb25seScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdFN0b3JlKGRiSW5mby5zdG9yZU5hbWUpO1xuXG4gICAgICAgICAgICAgICAgdmFyIHJlcSA9IHN0b3JlLm9wZW5DdXJzb3IoKTtcblxuICAgICAgICAgICAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1cnNvciA9IHJlcS5yZXN1bHQ7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnNvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGl0ZXJhdG9yKGN1cnNvci52YWx1ZSwgY3Vyc29yLmtleSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHZvaWQoMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvci5jb250aW51ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChyZXEuZXJyb3IpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgICAgICB9KTtcblxuICAgICAgICBleGVjdXRlRGVmZXJlZENhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRJdGVtKGtleSwgdmFsdWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBDYXN0IHRoZSBrZXkgdG8gYSBzdHJpbmcsIGFzIHRoYXQncyBhbGwgd2UgY2FuIHNldCBhcyBhIGtleS5cbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB3aW5kb3cuY29uc29sZS53YXJuKGtleSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgdXNlZCBhcyBhIGtleSwgYnV0IGl0IGlzIG5vdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIGtleSA9IFN0cmluZyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgdmFyIHN0b3JlID0gZGJJbmZvLmRiLnRyYW5zYWN0aW9uKGRiSW5mby5zdG9yZU5hbWUsICdyZWFkd3JpdGUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdFN0b3JlKGRiSW5mby5zdG9yZU5hbWUpO1xuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHJlYXNvbiB3ZSBkb24ndCBfc2F2ZV8gbnVsbCBpcyBiZWNhdXNlIElFIDEwIGRvZXNcbiAgICAgICAgICAgICAgICAvLyBub3Qgc3VwcG9ydCBzYXZpbmcgdGhlIGBudWxsYCB0eXBlIGluIEluZGV4ZWREQi4gSG93XG4gICAgICAgICAgICAgICAgLy8gaXJvbmljLCBnaXZlbiB0aGUgYnVnIGJlbG93IVxuICAgICAgICAgICAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21vemlsbGEvbG9jYWxGb3JhZ2UvaXNzdWVzLzE2MVxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgcmVxID0gc3RvcmUucHV0KHZhbHVlLCBrZXkpO1xuICAgICAgICAgICAgICAgIHJlcS5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2FzdCB0byB1bmRlZmluZWQgc28gdGhlIHZhbHVlIHBhc3NlZCB0b1xuICAgICAgICAgICAgICAgICAgICAvLyBjYWxsYmFjay9wcm9taXNlIGlzIHRoZSBzYW1lIGFzIHdoYXQgb25lIHdvdWxkIGdldCBvdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gb2YgYGdldEl0ZW0oKWAgbGF0ZXIuIFRoaXMgbGVhZHMgdG8gc29tZSB3ZWlyZG5lc3NcbiAgICAgICAgICAgICAgICAgICAgLy8gKHNldEl0ZW0oJ2ZvbycsIHVuZGVmaW5lZCkgd2lsbCByZXR1cm4gYG51bGxgKSwgYnV0XG4gICAgICAgICAgICAgICAgICAgIC8vIGl0J3Mgbm90IG15IGZhdWx0IGxvY2FsU3RvcmFnZSBpcyBvdXIgYmFzZWxpbmUgYW5kIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgLy8gaXQncyB3ZWlyZC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVEZWZlcmVkQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVJdGVtKGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIENhc3QgdGhlIGtleSB0byBhIHN0cmluZywgYXMgdGhhdCdzIGFsbCB3ZSBjYW4gc2V0IGFzIGEga2V5LlxuICAgICAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jb25zb2xlLndhcm4oa2V5ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyB1c2VkIGFzIGEga2V5LCBidXQgaXQgaXMgbm90IGEgc3RyaW5nLicpO1xuICAgICAgICAgICAga2V5ID0gU3RyaW5nKGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSBkYkluZm8uZGIudHJhbnNhY3Rpb24oZGJJbmZvLnN0b3JlTmFtZSwgJ3JlYWR3cml0ZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0U3RvcmUoZGJJbmZvLnN0b3JlTmFtZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSB1c2UgYSBHcnVudCB0YXNrIHRvIG1ha2UgdGhpcyBzYWZlIGZvciBJRSBhbmQgc29tZVxuICAgICAgICAgICAgICAgIC8vIHZlcnNpb25zIG9mIEFuZHJvaWQgKGluY2x1ZGluZyB0aG9zZSB1c2VkIGJ5IENvcmRvdmEpLlxuICAgICAgICAgICAgICAgIC8vIE5vcm1hbGx5IElFIHdvbid0IGxpa2UgYC5kZWxldGUoKWAgYW5kIHdpbGwgaW5zaXN0IG9uXG4gICAgICAgICAgICAgICAgLy8gdXNpbmcgYFsnZGVsZXRlJ10oKWAsIGJ1dCB3ZSBoYXZlIGEgYnVpbGQgc3RlcCB0aGF0XG4gICAgICAgICAgICAgICAgLy8gZml4ZXMgdGhpcyBmb3IgdXMgbm93LlxuICAgICAgICAgICAgICAgIHZhciByZXEgPSBzdG9yZS5kZWxldGUoa2V5KTtcbiAgICAgICAgICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIFRoZSByZXF1ZXN0IHdpbGwgYmUgYWJvcnRlZCBpZiB3ZSd2ZSBleGNlZWRlZCBvdXIgc3RvcmFnZVxuICAgICAgICAgICAgICAgIC8vIHNwYWNlLiBJbiB0aGlzIGNhc2UsIHdlIHdpbGwgcmVqZWN0IHdpdGggYSBzcGVjaWZpY1xuICAgICAgICAgICAgICAgIC8vIFwiUXVvdGFFeGNlZWRlZEVycm9yXCIuXG4gICAgICAgICAgICAgICAgcmVxLm9uYWJvcnQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBldmVudC50YXJnZXQuZXJyb3I7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnJvciA9PT0gJ1F1b3RhRXhjZWVkZWRFcnJvcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZURlZmVyZWRDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsZWFyKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSBkYkluZm8uZGIudHJhbnNhY3Rpb24oZGJJbmZvLnN0b3JlTmFtZSwgJ3JlYWR3cml0ZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAub2JqZWN0U3RvcmUoZGJJbmZvLnN0b3JlTmFtZSk7XG4gICAgICAgICAgICAgICAgdmFyIHJlcSA9IHN0b3JlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICByZXEub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVEZWZlcmVkQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsZW5ndGgoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIHZhciBzdG9yZSA9IGRiSW5mby5kYi50cmFuc2FjdGlvbihkYkluZm8uc3RvcmVOYW1lLCAncmVhZG9ubHknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdFN0b3JlKGRiSW5mby5zdG9yZU5hbWUpO1xuICAgICAgICAgICAgICAgIHZhciByZXEgPSBzdG9yZS5jb3VudCgpO1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlcS5yZXN1bHQpO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXEub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QocmVxLmVycm9yKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24ga2V5KG4sIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgaWYgKG4gPCAwKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICB2YXIgc3RvcmUgPSBkYkluZm8uZGIudHJhbnNhY3Rpb24oZGJJbmZvLnN0b3JlTmFtZSwgJ3JlYWRvbmx5JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vYmplY3RTdG9yZShkYkluZm8uc3RvcmVOYW1lKTtcblxuICAgICAgICAgICAgICAgIHZhciBhZHZhbmNlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHZhciByZXEgPSBzdG9yZS5vcGVuQ3Vyc29yKCk7XG4gICAgICAgICAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3Vyc29yID0gcmVxLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoaXMgbWVhbnMgdGhlcmUgd2VyZW4ndCBlbm91Z2gga2V5c1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG4gPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgdGhlIGZpcnN0IGtleSwgcmV0dXJuIGl0IGlmIHRoYXQncyB3aGF0IHRoZXlcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdhbnRlZC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoY3Vyc29yLmtleSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWFkdmFuY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBhc2sgdGhlIGN1cnNvciB0byBza2lwIGFoZWFkIG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZWNvcmRzLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkdmFuY2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3IuYWR2YW5jZShuKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2hlbiB3ZSBnZXQgaGVyZSwgd2UndmUgZ290IHRoZSBudGgga2V5LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoY3Vyc29yLmtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGtleXMoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIHZhciBzdG9yZSA9IGRiSW5mby5kYi50cmFuc2FjdGlvbihkYkluZm8uc3RvcmVOYW1lLCAncmVhZG9ubHknKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLm9iamVjdFN0b3JlKGRiSW5mby5zdG9yZU5hbWUpO1xuXG4gICAgICAgICAgICAgICAgdmFyIHJlcSA9IHN0b3JlLm9wZW5DdXJzb3IoKTtcbiAgICAgICAgICAgICAgICB2YXIga2V5cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgcmVxLm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY3Vyc29yID0gcmVxLnJlc3VsdDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWN1cnNvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShrZXlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChjdXJzb3Iua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJlcS5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChyZXEuZXJyb3IpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgICAgICB9KTtcblxuICAgICAgICBleGVjdXRlQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICBwcm9taXNlLnRoZW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleGVjdXRlRGVmZXJlZENhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGRlZmVyQ2FsbGJhY2soY2FsbGJhY2ssIHJlc3VsdCk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVW5kZXIgQ2hyb21lIHRoZSBjYWxsYmFjayBpcyBjYWxsZWQgYmVmb3JlIHRoZSBjaGFuZ2VzIChzYXZlLCBjbGVhcilcbiAgICAvLyBhcmUgYWN0dWFsbHkgbWFkZS4gU28gd2UgdXNlIGEgZGVmZXIgZnVuY3Rpb24gd2hpY2ggd2FpdCB0aGF0IHRoZVxuICAgIC8vIGNhbGwgc3RhY2sgdG8gYmUgZW1wdHkuXG4gICAgLy8gRm9yIG1vcmUgaW5mbyA6IGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL2xvY2FsRm9yYWdlL2lzc3Vlcy8xNzVcbiAgICAvLyBQdWxsIHJlcXVlc3QgOiBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9sb2NhbEZvcmFnZS9wdWxsLzE3OFxuICAgIGZ1bmN0aW9uIGRlZmVyQ2FsbGJhY2soY2FsbGJhY2ssIHJlc3VsdCkge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgYXN5bmNTdG9yYWdlID0ge1xuICAgICAgICBfZHJpdmVyOiAnYXN5bmNTdG9yYWdlJyxcbiAgICAgICAgX2luaXRTdG9yYWdlOiBfaW5pdFN0b3JhZ2UsXG4gICAgICAgIGl0ZXJhdGU6IGl0ZXJhdGUsXG4gICAgICAgIGdldEl0ZW06IGdldEl0ZW0sXG4gICAgICAgIHNldEl0ZW06IHNldEl0ZW0sXG4gICAgICAgIHJlbW92ZUl0ZW06IHJlbW92ZUl0ZW0sXG4gICAgICAgIGNsZWFyOiBjbGVhcixcbiAgICAgICAgbGVuZ3RoOiBsZW5ndGgsXG4gICAgICAgIGtleToga2V5LFxuICAgICAgICBrZXlzOiBrZXlzXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKCdhc3luY1N0b3JhZ2UnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBhc3luY1N0b3JhZ2U7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBhc3luY1N0b3JhZ2U7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hc3luY1N0b3JhZ2UgPSBhc3luY1N0b3JhZ2U7XG4gICAgfVxufSkuY2FsbCh3aW5kb3cpO1xuIiwiLy8gSWYgSW5kZXhlZERCIGlzbid0IGF2YWlsYWJsZSwgd2UnbGwgZmFsbCBiYWNrIHRvIGxvY2FsU3RvcmFnZS5cbi8vIE5vdGUgdGhhdCB0aGlzIHdpbGwgaGF2ZSBjb25zaWRlcmFibGUgcGVyZm9ybWFuY2UgYW5kIHN0b3JhZ2Vcbi8vIHNpZGUtZWZmZWN0cyAoYWxsIGRhdGEgd2lsbCBiZSBzZXJpYWxpemVkIG9uIHNhdmUgYW5kIG9ubHkgZGF0YSB0aGF0XG4vLyBjYW4gYmUgY29udmVydGVkIHRvIGEgc3RyaW5nIHZpYSBgSlNPTi5zdHJpbmdpZnkoKWAgd2lsbCBiZSBzYXZlZCkuXG4oZnVuY3Rpb24oKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gUHJvbWlzZXMhXG4gICAgdmFyIFByb21pc2UgPSAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpID9cbiAgICAgICAgICAgICAgICAgIHJlcXVpcmUoJ3Byb21pc2UnKSA6IHRoaXMuUHJvbWlzZTtcbiAgICB2YXIgbG9jYWxTdG9yYWdlID0gbnVsbDtcblxuICAgIC8vIElmIHRoZSBhcHAgaXMgcnVubmluZyBpbnNpZGUgYSBHb29nbGUgQ2hyb21lIHBhY2thZ2VkIHdlYmFwcCwgb3Igc29tZVxuICAgIC8vIG90aGVyIGNvbnRleHQgd2hlcmUgbG9jYWxTdG9yYWdlIGlzbid0IGF2YWlsYWJsZSwgd2UgZG9uJ3QgdXNlXG4gICAgLy8gbG9jYWxTdG9yYWdlLiBUaGlzIGZlYXR1cmUgZGV0ZWN0aW9uIGlzIHByZWZlcnJlZCBvdmVyIHRoZSBvbGRcbiAgICAvLyBgaWYgKHdpbmRvdy5jaHJvbWUgJiYgd2luZG93LmNocm9tZS5ydW50aW1lKWAgY29kZS5cbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL2xvY2FsRm9yYWdlL2lzc3Vlcy82OFxuICAgIHRyeSB7XG4gICAgICAgIC8vIElmIGxvY2FsU3RvcmFnZSBpc24ndCBhdmFpbGFibGUsIHdlIGdldCBvdXR0YSBoZXJlIVxuICAgICAgICAvLyBUaGlzIHNob3VsZCBiZSBpbnNpZGUgYSB0cnkgY2F0Y2hcbiAgICAgICAgaWYgKCF0aGlzLmxvY2FsU3RvcmFnZSB8fCAhKCdzZXRJdGVtJyBpbiB0aGlzLmxvY2FsU3RvcmFnZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBJbml0aWFsaXplIGxvY2FsU3RvcmFnZSBhbmQgY3JlYXRlIGEgdmFyaWFibGUgdG8gdXNlIHRocm91Z2hvdXRcbiAgICAgICAgLy8gdGhlIGNvZGUuXG4gICAgICAgIGxvY2FsU3RvcmFnZSA9IHRoaXMubG9jYWxTdG9yYWdlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENvbmZpZyB0aGUgbG9jYWxTdG9yYWdlIGJhY2tlbmQsIHVzaW5nIG9wdGlvbnMgc2V0IGluIHRoZSBjb25maWcuXG4gICAgZnVuY3Rpb24gX2luaXRTdG9yYWdlKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgZGJJbmZvID0ge307XG4gICAgICAgIGlmIChvcHRpb25zKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBkYkluZm9baV0gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZGJJbmZvLmtleVByZWZpeCA9IGRiSW5mby5uYW1lICsgJy8nO1xuXG4gICAgICAgIHNlbGYuX2RiSW5mbyA9IGRiSW5mbztcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIHZhciBTRVJJQUxJWkVEX01BUktFUiA9ICdfX2xmc2NfXzonO1xuICAgIHZhciBTRVJJQUxJWkVEX01BUktFUl9MRU5HVEggPSBTRVJJQUxJWkVEX01BUktFUi5sZW5ndGg7XG5cbiAgICAvLyBPTUcgdGhlIHNlcmlhbGl6YXRpb25zIVxuICAgIHZhciBUWVBFX0FSUkFZQlVGRkVSID0gJ2FyYmYnO1xuICAgIHZhciBUWVBFX0JMT0IgPSAnYmxvYic7XG4gICAgdmFyIFRZUEVfSU5UOEFSUkFZID0gJ3NpMDgnO1xuICAgIHZhciBUWVBFX1VJTlQ4QVJSQVkgPSAndWkwOCc7XG4gICAgdmFyIFRZUEVfVUlOVDhDTEFNUEVEQVJSQVkgPSAndWljOCc7XG4gICAgdmFyIFRZUEVfSU5UMTZBUlJBWSA9ICdzaTE2JztcbiAgICB2YXIgVFlQRV9JTlQzMkFSUkFZID0gJ3NpMzInO1xuICAgIHZhciBUWVBFX1VJTlQxNkFSUkFZID0gJ3VyMTYnO1xuICAgIHZhciBUWVBFX1VJTlQzMkFSUkFZID0gJ3VpMzInO1xuICAgIHZhciBUWVBFX0ZMT0FUMzJBUlJBWSA9ICdmbDMyJztcbiAgICB2YXIgVFlQRV9GTE9BVDY0QVJSQVkgPSAnZmw2NCc7XG4gICAgdmFyIFRZUEVfU0VSSUFMSVpFRF9NQVJLRVJfTEVOR1RIID0gU0VSSUFMSVpFRF9NQVJLRVJfTEVOR1RIICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUWVBFX0FSUkFZQlVGRkVSLmxlbmd0aDtcblxuICAgIC8vIFJlbW92ZSBhbGwga2V5cyBmcm9tIHRoZSBkYXRhc3RvcmUsIGVmZmVjdGl2ZWx5IGRlc3Ryb3lpbmcgYWxsIGRhdGEgaW5cbiAgICAvLyB0aGUgYXBwJ3Mga2V5L3ZhbHVlIHN0b3JlIVxuICAgIGZ1bmN0aW9uIGNsZWFyKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBrZXlQcmVmaXggPSBzZWxmLl9kYkluZm8ua2V5UHJlZml4O1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IGxvY2FsU3RvcmFnZS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gbG9jYWxTdG9yYWdlLmtleShpKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5LmluZGV4T2Yoa2V5UHJlZml4KSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIFJldHJpZXZlIGFuIGl0ZW0gZnJvbSB0aGUgc3RvcmUuIFVubGlrZSB0aGUgb3JpZ2luYWwgYXN5bmNfc3RvcmFnZVxuICAgIC8vIGxpYnJhcnkgaW4gR2FpYSwgd2UgZG9uJ3QgbW9kaWZ5IHJldHVybiB2YWx1ZXMgYXQgYWxsLiBJZiBhIGtleSdzIHZhbHVlXG4gICAgLy8gaXMgYHVuZGVmaW5lZGAsIHdlIHBhc3MgdGhhdCB2YWx1ZSB0byB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgZnVuY3Rpb24gZ2V0SXRlbShrZXksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBDYXN0IHRoZSBrZXkgdG8gYSBzdHJpbmcsIGFzIHRoYXQncyBhbGwgd2UgY2FuIHNldCBhcyBhIGtleS5cbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB3aW5kb3cuY29uc29sZS53YXJuKGtleSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgdXNlZCBhcyBhIGtleSwgYnV0IGl0IGlzIG5vdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIGtleSA9IFN0cmluZyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgICAgIHZhciByZXN1bHQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShkYkluZm8ua2V5UHJlZml4ICsga2V5KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBJZiBhIHJlc3VsdCB3YXMgZm91bmQsIHBhcnNlIGl0IGZyb20gdGhlIHNlcmlhbGl6ZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RyaW5nIGludG8gYSBKUyBvYmplY3QuIElmIHJlc3VsdCBpc24ndCB0cnV0aHksIHRoZSBrZXlcbiAgICAgICAgICAgICAgICAgICAgLy8gaXMgbGlrZWx5IHVuZGVmaW5lZCBhbmQgd2UnbGwgcGFzcyBpdCBzdHJhaWdodCB0byB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gY2FsbGJhY2suXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IF9kZXNlcmlhbGl6ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIEl0ZXJhdGUgb3ZlciBhbGwgaXRlbXMgaW4gdGhlIHN0b3JlLlxuICAgIGZ1bmN0aW9uIGl0ZXJhdGUoaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleVByZWZpeCA9IHNlbGYuX2RiSW5mby5rZXlQcmVmaXg7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXlQcmVmaXhMZW5ndGggPSBrZXlQcmVmaXgubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGVuZ3RoID0gbG9jYWxTdG9yYWdlLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gbG9jYWxTdG9yYWdlLmtleShpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2YWx1ZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGEgcmVzdWx0IHdhcyBmb3VuZCwgcGFyc2UgaXQgZnJvbSB0aGUgc2VyaWFsaXplZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RyaW5nIGludG8gYSBKUyBvYmplY3QuIElmIHJlc3VsdCBpc24ndCB0cnV0aHksIHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8ga2V5IGlzIGxpa2VseSB1bmRlZmluZWQgYW5kIHdlJ2xsIHBhc3MgaXQgc3RyYWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvIHRoZSBpdGVyYXRvci5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gX2Rlc2VyaWFsaXplKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBpdGVyYXRvcih2YWx1ZSwga2V5LnN1YnN0cmluZyhrZXlQcmVmaXhMZW5ndGgpKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSB2b2lkKDApKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIFNhbWUgYXMgbG9jYWxTdG9yYWdlJ3Mga2V5KCkgbWV0aG9kLCBleGNlcHQgdGFrZXMgYSBjYWxsYmFjay5cbiAgICBmdW5jdGlvbiBrZXkobiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0O1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGxvY2FsU3RvcmFnZS5rZXkobik7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgdGhlIHByZWZpeCBmcm9tIHRoZSBrZXksIGlmIGEga2V5IGlzIGZvdW5kLlxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnN1YnN0cmluZyhkYkluZm8ua2V5UHJlZml4Lmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24ga2V5cyhjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIHZhciBsZW5ndGggPSBsb2NhbFN0b3JhZ2UubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHZhciBrZXlzID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbFN0b3JhZ2Uua2V5KGkpLmluZGV4T2YoZGJJbmZvLmtleVByZWZpeCkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleXMucHVzaChsb2NhbFN0b3JhZ2Uua2V5KGkpLnN1YnN0cmluZyhkYkluZm8ua2V5UHJlZml4Lmxlbmd0aCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShrZXlzKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIFN1cHBseSB0aGUgbnVtYmVyIG9mIGtleXMgaW4gdGhlIGRhdGFzdG9yZSB0byB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgZnVuY3Rpb24gbGVuZ3RoKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYua2V5cygpLnRoZW4oZnVuY3Rpb24oa2V5cykge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoa2V5cy5sZW5ndGgpO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGFuIGl0ZW0gZnJvbSB0aGUgc3RvcmUsIG5pY2UgYW5kIHNpbXBsZS5cbiAgICBmdW5jdGlvbiByZW1vdmVJdGVtKGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIENhc3QgdGhlIGtleSB0byBhIHN0cmluZywgYXMgdGhhdCdzIGFsbCB3ZSBjYW4gc2V0IGFzIGEga2V5LlxuICAgICAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jb25zb2xlLndhcm4oa2V5ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyB1c2VkIGFzIGEga2V5LCBidXQgaXQgaXMgbm90IGEgc3RyaW5nLicpO1xuICAgICAgICAgICAga2V5ID0gU3RyaW5nKGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShkYkluZm8ua2V5UHJlZml4ICsga2V5KTtcblxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIERlc2VyaWFsaXplIGRhdGEgd2UndmUgaW5zZXJ0ZWQgaW50byBhIHZhbHVlIGNvbHVtbi9maWVsZC4gV2UgcGxhY2VcbiAgICAvLyBzcGVjaWFsIG1hcmtlcnMgaW50byBvdXIgc3RyaW5ncyB0byBtYXJrIHRoZW0gYXMgZW5jb2RlZDsgdGhpcyBpc24ndFxuICAgIC8vIGFzIG5pY2UgYXMgYSBtZXRhIGZpZWxkLCBidXQgaXQncyB0aGUgb25seSBzYW5lIHRoaW5nIHdlIGNhbiBkbyB3aGlsc3RcbiAgICAvLyBrZWVwaW5nIGxvY2FsU3RvcmFnZSBzdXBwb3J0IGludGFjdC5cbiAgICAvL1xuICAgIC8vIE9mdGVudGltZXMgdGhpcyB3aWxsIGp1c3QgZGVzZXJpYWxpemUgSlNPTiBjb250ZW50LCBidXQgaWYgd2UgaGF2ZSBhXG4gICAgLy8gc3BlY2lhbCBtYXJrZXIgKFNFUklBTElaRURfTUFSS0VSLCBkZWZpbmVkIGFib3ZlKSwgd2Ugd2lsbCBleHRyYWN0XG4gICAgLy8gc29tZSBraW5kIG9mIGFycmF5YnVmZmVyL2JpbmFyeSBkYXRhL3R5cGVkIGFycmF5IG91dCBvZiB0aGUgc3RyaW5nLlxuICAgIGZ1bmN0aW9uIF9kZXNlcmlhbGl6ZSh2YWx1ZSkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlbid0IG1hcmtlZCB0aGlzIHN0cmluZyBhcyBiZWluZyBzcGVjaWFsbHkgc2VyaWFsaXplZCAoaS5lLlxuICAgICAgICAvLyBzb21ldGhpbmcgb3RoZXIgdGhhbiBzZXJpYWxpemVkIEpTT04pLCB3ZSBjYW4ganVzdCByZXR1cm4gaXQgYW5kIGJlXG4gICAgICAgIC8vIGRvbmUgd2l0aCBpdC5cbiAgICAgICAgaWYgKHZhbHVlLnN1YnN0cmluZygwLFxuICAgICAgICAgICAgU0VSSUFMSVpFRF9NQVJLRVJfTEVOR1RIKSAhPT0gU0VSSUFMSVpFRF9NQVJLRVIpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgY29kZSBkZWFscyB3aXRoIGRlc2VyaWFsaXppbmcgc29tZSBraW5kIG9mIEJsb2Igb3JcbiAgICAgICAgLy8gVHlwZWRBcnJheS4gRmlyc3Qgd2Ugc2VwYXJhdGUgb3V0IHRoZSB0eXBlIG9mIGRhdGEgd2UncmUgZGVhbGluZ1xuICAgICAgICAvLyB3aXRoIGZyb20gdGhlIGRhdGEgaXRzZWxmLlxuICAgICAgICB2YXIgc2VyaWFsaXplZFN0cmluZyA9IHZhbHVlLnN1YnN0cmluZyhUWVBFX1NFUklBTElaRURfTUFSS0VSX0xFTkdUSCk7XG4gICAgICAgIHZhciB0eXBlID0gdmFsdWUuc3Vic3RyaW5nKFNFUklBTElaRURfTUFSS0VSX0xFTkdUSCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVFlQRV9TRVJJQUxJWkVEX01BUktFUl9MRU5HVEgpO1xuXG4gICAgICAgIC8vIEZpbGwgdGhlIHN0cmluZyBpbnRvIGEgQXJyYXlCdWZmZXIuXG4gICAgICAgIC8vIDIgYnl0ZXMgZm9yIGVhY2ggY2hhci5cbiAgICAgICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzZXJpYWxpemVkU3RyaW5nLmxlbmd0aCAqIDIpO1xuICAgICAgICB2YXIgYnVmZmVyVmlldyA9IG5ldyBVaW50MTZBcnJheShidWZmZXIpO1xuICAgICAgICBmb3IgKHZhciBpID0gc2VyaWFsaXplZFN0cmluZy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgYnVmZmVyVmlld1tpXSA9IHNlcmlhbGl6ZWRTdHJpbmcuY2hhckNvZGVBdChpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHVybiB0aGUgcmlnaHQgdHlwZSBiYXNlZCBvbiB0aGUgY29kZS90eXBlIHNldCBkdXJpbmdcbiAgICAgICAgLy8gc2VyaWFsaXphdGlvbi5cbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFRZUEVfQVJSQVlCVUZGRVI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9CTE9COlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQmxvYihbYnVmZmVyXSk7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UOEFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgSW50OEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDhBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UOENMQU1QRURBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UMTZBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEludDE2QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTZBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQxNkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UMzJBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEludDMyQXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMzJBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQzMkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfRkxPQVQzMkFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfRkxPQVQ2NEFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmxvYXQ2NEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rb3duIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIENvbnZlcnRzIGEgYnVmZmVyIHRvIGEgc3RyaW5nIHRvIHN0b3JlLCBzZXJpYWxpemVkLCBpbiB0aGUgYmFja2VuZFxuICAgIC8vIHN0b3JhZ2UgbGlicmFyeS5cbiAgICBmdW5jdGlvbiBfYnVmZmVyVG9TdHJpbmcoYnVmZmVyKSB7XG4gICAgICAgIHZhciBzdHIgPSAnJztcbiAgICAgICAgdmFyIHVpbnQxNkFycmF5ID0gbmV3IFVpbnQxNkFycmF5KGJ1ZmZlcik7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHN0ciA9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdWludDE2QXJyYXkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBUaGlzIGlzIGEgZmFsbGJhY2sgaW1wbGVtZW50YXRpb24gaW4gY2FzZSB0aGUgZmlyc3Qgb25lIGRvZXNcbiAgICAgICAgICAgIC8vIG5vdCB3b3JrLiBUaGlzIGlzIHJlcXVpcmVkIHRvIGdldCB0aGUgcGhhbnRvbWpzIHBhc3NpbmcuLi5cbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdWludDE2QXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1aW50MTZBcnJheVtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIC8vIFNlcmlhbGl6ZSBhIHZhbHVlLCBhZnRlcndhcmRzIGV4ZWN1dGluZyBhIGNhbGxiYWNrICh3aGljaCB1c3VhbGx5XG4gICAgLy8gaW5zdHJ1Y3RzIHRoZSBgc2V0SXRlbSgpYCBjYWxsYmFjay9wcm9taXNlIHRvIGJlIGV4ZWN1dGVkKS4gVGhpcyBpcyBob3dcbiAgICAvLyB3ZSBzdG9yZSBiaW5hcnkgZGF0YSB3aXRoIGxvY2FsU3RvcmFnZS5cbiAgICBmdW5jdGlvbiBfc2VyaWFsaXplKHZhbHVlLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgdmFsdWVTdHJpbmcgPSAnJztcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5ub3QgdXNlIGB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyYCBvciBzdWNoIGhlcmUsIGFzIHRoZXNlXG4gICAgICAgIC8vIGNoZWNrcyBmYWlsIHdoZW4gcnVubmluZyB0aGUgdGVzdHMgdXNpbmcgY2FzcGVyLmpzLi4uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRPRE86IFNlZSB3aHkgdGhvc2UgdGVzdHMgZmFpbCBhbmQgdXNlIGEgYmV0dGVyIHNvbHV0aW9uLlxuICAgICAgICBpZiAodmFsdWUgJiYgKHZhbHVlLnRvU3RyaW5nKCkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScgfHxcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5idWZmZXIgJiZcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5idWZmZXIudG9TdHJpbmcoKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykpIHtcbiAgICAgICAgICAgIC8vIENvbnZlcnQgYmluYXJ5IGFycmF5cyB0byBhIHN0cmluZyBhbmQgcHJlZml4IHRoZSBzdHJpbmcgd2l0aFxuICAgICAgICAgICAgLy8gYSBzcGVjaWFsIG1hcmtlci5cbiAgICAgICAgICAgIHZhciBidWZmZXI7XG4gICAgICAgICAgICB2YXIgbWFya2VyID0gU0VSSUFMSVpFRF9NQVJLRVI7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfQVJSQVlCVUZGRVI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1ZmZlciA9IHZhbHVlLmJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgSW50OEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfSU5UOEFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IFVpbnQ4QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9VSU5UOEFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IFVpbnQ4Q2xhbXBlZEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfVUlOVDhDTEFNUEVEQVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgSW50MTZBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX0lOVDE2QVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgVWludDE2QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9VSU5UMTZBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBJbnQzMkFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfSU5UMzJBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBVaW50MzJBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX1VJTlQzMkFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IEZsb2F0MzJBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX0ZMT0FUMzJBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBGbG9hdDY0QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9GTE9BVDY0QVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdGYWlsZWQgdG8gZ2V0IHR5cGUgZm9yIEJpbmFyeUFycmF5JykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FsbGJhY2sobWFya2VyICsgX2J1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBCbG9iXScpIHtcbiAgICAgICAgICAgIC8vIENvbnZlciB0aGUgYmxvYiB0byBhIGJpbmFyeUFycmF5IGFuZCB0aGVuIHRvIGEgc3RyaW5nLlxuICAgICAgICAgICAgdmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG4gICAgICAgICAgICBmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBzdHIgPSBfYnVmZmVyVG9TdHJpbmcodGhpcy5yZXN1bHQpO1xuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soU0VSSUFMSVpFRF9NQVJLRVIgKyBUWVBFX0JMT0IgKyBzdHIpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcih2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LmNvbnNvbGUuZXJyb3IoXCJDb3VsZG4ndCBjb252ZXJ0IHZhbHVlIGludG8gYSBKU09OIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3RyaW5nOiAnLCB2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNldCBhIGtleSdzIHZhbHVlIGFuZCBydW4gYW4gb3B0aW9uYWwgY2FsbGJhY2sgb25jZSB0aGUgdmFsdWUgaXMgc2V0LlxuICAgIC8vIFVubGlrZSBHYWlhJ3MgaW1wbGVtZW50YXRpb24sIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBpcyBwYXNzZWQgdGhlIHZhbHVlLFxuICAgIC8vIGluIGNhc2UgeW91IHdhbnQgdG8gb3BlcmF0ZSBvbiB0aGF0IHZhbHVlIG9ubHkgYWZ0ZXIgeW91J3JlIHN1cmUgaXRcbiAgICAvLyBzYXZlZCwgb3Igc29tZXRoaW5nIGxpa2UgdGhhdC5cbiAgICBmdW5jdGlvbiBzZXRJdGVtKGtleSwgdmFsdWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBDYXN0IHRoZSBrZXkgdG8gYSBzdHJpbmcsIGFzIHRoYXQncyBhbGwgd2UgY2FuIHNldCBhcyBhIGtleS5cbiAgICAgICAgaWYgKHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB3aW5kb3cuY29uc29sZS53YXJuKGtleSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgdXNlZCBhcyBhIGtleSwgYnV0IGl0IGlzIG5vdCBhIHN0cmluZy4nKTtcbiAgICAgICAgICAgIGtleSA9IFN0cmluZyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIC8vIENvbnZlcnQgdW5kZWZpbmVkIHZhbHVlcyB0byBudWxsLlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tb3ppbGxhL2xvY2FsRm9yYWdlL3B1bGwvNDJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgdmFsdWUgdG8gcGFzcyB0byB0aGUgY2FsbGJhY2suXG4gICAgICAgICAgICAgICAgdmFyIG9yaWdpbmFsVmFsdWUgPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgIF9zZXJpYWxpemUodmFsdWUsIGZ1bmN0aW9uKHZhbHVlLCBlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oZGJJbmZvLmtleVByZWZpeCArIGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvY2FsU3RvcmFnZSBjYXBhY2l0eSBleGNlZWRlZC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBNYWtlIHRoaXMgYSBzcGVjaWZpYyBlcnJvci9ldmVudC5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZS5uYW1lID09PSAnUXVvdGFFeGNlZWRlZEVycm9yJyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLm5hbWUgPT09ICdOU19FUlJPUl9ET01fUVVPVEFfUkVBQ0hFRCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShvcmlnaW5hbFZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxvY2FsU3RvcmFnZVdyYXBwZXIgPSB7XG4gICAgICAgIF9kcml2ZXI6ICdsb2NhbFN0b3JhZ2VXcmFwcGVyJyxcbiAgICAgICAgX2luaXRTdG9yYWdlOiBfaW5pdFN0b3JhZ2UsXG4gICAgICAgIC8vIERlZmF1bHQgQVBJLCBmcm9tIEdhaWEvbG9jYWxTdG9yYWdlLlxuICAgICAgICBpdGVyYXRlOiBpdGVyYXRlLFxuICAgICAgICBnZXRJdGVtOiBnZXRJdGVtLFxuICAgICAgICBzZXRJdGVtOiBzZXRJdGVtLFxuICAgICAgICByZW1vdmVJdGVtOiByZW1vdmVJdGVtLFxuICAgICAgICBjbGVhcjogY2xlYXIsXG4gICAgICAgIGxlbmd0aDogbGVuZ3RoLFxuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAga2V5czoga2V5c1xuICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZSgnbG9jYWxTdG9yYWdlV3JhcHBlcicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsU3RvcmFnZVdyYXBwZXI7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBsb2NhbFN0b3JhZ2VXcmFwcGVyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubG9jYWxTdG9yYWdlV3JhcHBlciA9IGxvY2FsU3RvcmFnZVdyYXBwZXI7XG4gICAgfVxufSkuY2FsbCh3aW5kb3cpO1xuIiwiLypcbiAqIEluY2x1ZGVzIGNvZGUgZnJvbTpcbiAqXG4gKiBiYXNlNjQtYXJyYXlidWZmZXJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9iYXNlNjQtYXJyYXlidWZmZXJcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTIgTmlrbGFzIHZvbiBIZXJ0emVuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cbihmdW5jdGlvbigpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBTYWRseSwgdGhlIGJlc3Qgd2F5IHRvIHNhdmUgYmluYXJ5IGRhdGEgaW4gV2ViU1FMIGlzIEJhc2U2NCBzZXJpYWxpemluZ1xuICAgIC8vIGl0LCBzbyB0aGlzIGlzIGhvdyB3ZSBzdG9yZSBpdCB0byBwcmV2ZW50IHZlcnkgc3RyYW5nZSBlcnJvcnMgd2l0aCBsZXNzXG4gICAgLy8gdmVyYm9zZSB3YXlzIG9mIGJpbmFyeSA8LT4gc3RyaW5nIGRhdGEgc3RvcmFnZS5cbiAgICB2YXIgQkFTRV9DSEFSUyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJztcblxuICAgIC8vIFByb21pc2VzIVxuICAgIHZhciBQcm9taXNlID0gKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSA/XG4gICAgICAgICAgICAgICAgICByZXF1aXJlKCdwcm9taXNlJykgOiB0aGlzLlByb21pc2U7XG5cbiAgICB2YXIgb3BlbkRhdGFiYXNlID0gdGhpcy5vcGVuRGF0YWJhc2U7XG5cbiAgICB2YXIgU0VSSUFMSVpFRF9NQVJLRVIgPSAnX19sZnNjX186JztcbiAgICB2YXIgU0VSSUFMSVpFRF9NQVJLRVJfTEVOR1RIID0gU0VSSUFMSVpFRF9NQVJLRVIubGVuZ3RoO1xuXG4gICAgLy8gT01HIHRoZSBzZXJpYWxpemF0aW9ucyFcbiAgICB2YXIgVFlQRV9BUlJBWUJVRkZFUiA9ICdhcmJmJztcbiAgICB2YXIgVFlQRV9CTE9CID0gJ2Jsb2InO1xuICAgIHZhciBUWVBFX0lOVDhBUlJBWSA9ICdzaTA4JztcbiAgICB2YXIgVFlQRV9VSU5UOEFSUkFZID0gJ3VpMDgnO1xuICAgIHZhciBUWVBFX1VJTlQ4Q0xBTVBFREFSUkFZID0gJ3VpYzgnO1xuICAgIHZhciBUWVBFX0lOVDE2QVJSQVkgPSAnc2kxNic7XG4gICAgdmFyIFRZUEVfSU5UMzJBUlJBWSA9ICdzaTMyJztcbiAgICB2YXIgVFlQRV9VSU5UMTZBUlJBWSA9ICd1cjE2JztcbiAgICB2YXIgVFlQRV9VSU5UMzJBUlJBWSA9ICd1aTMyJztcbiAgICB2YXIgVFlQRV9GTE9BVDMyQVJSQVkgPSAnZmwzMic7XG4gICAgdmFyIFRZUEVfRkxPQVQ2NEFSUkFZID0gJ2ZsNjQnO1xuICAgIHZhciBUWVBFX1NFUklBTElaRURfTUFSS0VSX0xFTkdUSCA9IFNFUklBTElaRURfTUFSS0VSX0xFTkdUSCArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVFlQRV9BUlJBWUJVRkZFUi5sZW5ndGg7XG5cbiAgICAvLyBJZiBXZWJTUUwgbWV0aG9kcyBhcmVuJ3QgYXZhaWxhYmxlLCB3ZSBjYW4gc3RvcCBub3cuXG4gICAgaWYgKCFvcGVuRGF0YWJhc2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9wZW4gdGhlIFdlYlNRTCBkYXRhYmFzZSAoYXV0b21hdGljYWxseSBjcmVhdGVzIG9uZSBpZiBvbmUgZGlkbid0XG4gICAgLy8gcHJldmlvdXNseSBleGlzdCksIHVzaW5nIGFueSBvcHRpb25zIHNldCBpbiB0aGUgY29uZmlnLlxuICAgIGZ1bmN0aW9uIF9pbml0U3RvcmFnZShvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGRiSW5mbyA9IHtcbiAgICAgICAgICAgIGRiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGRiSW5mb1tpXSA9IHR5cGVvZihvcHRpb25zW2ldKSAhPT0gJ3N0cmluZycgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnNbaV0udG9TdHJpbmcoKSA6IG9wdGlvbnNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAvLyBPcGVuIHRoZSBkYXRhYmFzZTsgdGhlIG9wZW5EYXRhYmFzZSBBUEkgd2lsbCBhdXRvbWF0aWNhbGx5XG4gICAgICAgICAgICAvLyBjcmVhdGUgaXQgZm9yIHVzIGlmIGl0IGRvZXNuJ3QgZXhpc3QuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGRiSW5mby5kYiA9IG9wZW5EYXRhYmFzZShkYkluZm8ubmFtZSwgU3RyaW5nKGRiSW5mby52ZXJzaW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGJJbmZvLmRlc2NyaXB0aW9uLCBkYkluZm8uc2l6ZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuc2V0RHJpdmVyKCdsb2NhbFN0b3JhZ2VXcmFwcGVyJylcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5faW5pdFN0b3JhZ2Uob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKHJlc29sdmUpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChyZWplY3QpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgb3VyIGtleS92YWx1ZSB0YWJsZSBpZiBpdCBkb2Vzbid0IGV4aXN0LlxuICAgICAgICAgICAgZGJJbmZvLmRiLnRyYW5zYWN0aW9uKGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgICAgICAgICB0LmV4ZWN1dGVTcWwoJ0NSRUFURSBUQUJMRSBJRiBOT1QgRVhJU1RTICcgKyBkYkluZm8uc3RvcmVOYW1lICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyAoaWQgSU5URUdFUiBQUklNQVJZIEtFWSwga2V5IHVuaXF1ZSwgdmFsdWUpJywgW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9kYkluZm8gPSBkYkluZm87XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbih0LCBlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEl0ZW0oa2V5LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy8gQ2FzdCB0aGUga2V5IHRvIGEgc3RyaW5nLCBhcyB0aGF0J3MgYWxsIHdlIGNhbiBzZXQgYXMgYSBrZXkuXG4gICAgICAgIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgd2luZG93LmNvbnNvbGUud2FybihrZXkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIHVzZWQgYXMgYSBrZXksIGJ1dCBpdCBpcyBub3QgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgICBrZXkgPSBTdHJpbmcoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIGRiSW5mby5kYi50cmFuc2FjdGlvbihmdW5jdGlvbih0KSB7XG4gICAgICAgICAgICAgICAgICAgIHQuZXhlY3V0ZVNxbCgnU0VMRUNUICogRlJPTSAnICsgZGJJbmZvLnN0b3JlTmFtZSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIFdIRVJFIGtleSA9ID8gTElNSVQgMScsIFtrZXldLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odCwgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHJlc3VsdHMucm93cy5sZW5ndGggP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucm93cy5pdGVtKDApLnZhbHVlIDogbnVsbDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgc2VyaWFsaXplZCBjb250ZW50IHdlIG5lZWQgdG9cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHVucGFjay5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBfZGVzZXJpYWxpemUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbih0LCBlcnJvcikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGl0ZXJhdGUoaXRlcmF0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcblxuICAgICAgICAgICAgICAgIGRiSW5mby5kYi50cmFuc2FjdGlvbihmdW5jdGlvbih0KSB7XG4gICAgICAgICAgICAgICAgICAgIHQuZXhlY3V0ZVNxbCgnU0VMRUNUICogRlJPTSAnICsgZGJJbmZvLnN0b3JlTmFtZSwgW10sXG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbih0LCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJvd3MgPSByZXN1bHRzLnJvd3M7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGxlbmd0aCA9IHJvd3MubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgaXRlbSA9IHJvd3MuaXRlbShpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGl0ZW0udmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgdG8gc2VlIGlmIHRoaXMgaXMgc2VyaWFsaXplZCBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8gdW5wYWNrLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBfZGVzZXJpYWxpemUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGl0ZXJhdG9yKHJlc3VsdCwgaXRlbS5rZXkpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZvaWQoMCkgcHJldmVudHMgcHJvYmxlbXMgd2l0aCByZWRlZmluaXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb2YgYHVuZGVmaW5lZGAuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgIT09IHZvaWQoMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHQsIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0SXRlbShrZXksIHZhbHVlLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy8gQ2FzdCB0aGUga2V5IHRvIGEgc3RyaW5nLCBhcyB0aGF0J3MgYWxsIHdlIGNhbiBzZXQgYXMgYSBrZXkuXG4gICAgICAgIGlmICh0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgd2luZG93LmNvbnNvbGUud2FybihrZXkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnIHVzZWQgYXMgYSBrZXksIGJ1dCBpdCBpcyBub3QgYSBzdHJpbmcuJyk7XG4gICAgICAgICAgICBrZXkgPSBTdHJpbmcoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgbG9jYWxTdG9yYWdlIEFQSSBkb2Vzbid0IHJldHVybiB1bmRlZmluZWQgdmFsdWVzIGluIGFuXG4gICAgICAgICAgICAgICAgLy8gXCJleHBlY3RlZFwiIHdheSwgc28gdW5kZWZpbmVkIGlzIGFsd2F5cyBjYXN0IHRvIG51bGwgaW4gYWxsXG4gICAgICAgICAgICAgICAgLy8gZHJpdmVycy4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9sb2NhbEZvcmFnZS9wdWxsLzQyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIHRvIHBhc3MgdG8gdGhlIGNhbGxiYWNrLlxuICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG5cbiAgICAgICAgICAgICAgICBfc2VyaWFsaXplKHZhbHVlLCBmdW5jdGlvbih2YWx1ZSwgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICAgICAgICAgIGRiSW5mby5kYi50cmFuc2FjdGlvbihmdW5jdGlvbih0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdC5leGVjdXRlU3FsKCdJTlNFUlQgT1IgUkVQTEFDRSBJTlRPICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYkluZm8uc3RvcmVOYW1lICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyAoa2V5LCB2YWx1ZSkgVkFMVUVTICg/LCA/KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtrZXksIHZhbHVlXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUob3JpZ2luYWxWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24odCwgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHNxbEVycm9yKSB7IC8vIFRoZSB0cmFuc2FjdGlvbiBmYWlsZWQ7IGNoZWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0byBzZWUgaWYgaXQncyBhIHF1b3RhIGVycm9yLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcWxFcnJvci5jb2RlID09PSBzcWxFcnJvci5RVU9UQV9FUlIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgcmVqZWN0IHRoZSBjYWxsYmFjayBvdXRyaWdodCBmb3Igbm93LCBidXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaXQncyB3b3J0aCB0cnlpbmcgdG8gcmUtcnVuIHRoZSB0cmFuc2FjdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXZlbiBpZiB0aGUgdXNlciBhY2NlcHRzIHRoZSBwcm9tcHQgdG8gdXNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vcmUgc3RvcmFnZSBvbiBTYWZhcmksIHRoaXMgZXJyb3Igd2lsbFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBiZSBjYWxsZWQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IFRyeSB0byByZS1ydW4gdGhlIHRyYW5zYWN0aW9uLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3Qoc3FsRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgICAgICB9KTtcblxuICAgICAgICBleGVjdXRlQ2FsbGJhY2socHJvbWlzZSwgY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZW1vdmVJdGVtKGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIENhc3QgdGhlIGtleSB0byBhIHN0cmluZywgYXMgdGhhdCdzIGFsbCB3ZSBjYW4gc2V0IGFzIGEga2V5LlxuICAgICAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jb25zb2xlLndhcm4oa2V5ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyB1c2VkIGFzIGEga2V5LCBidXQgaXQgaXMgbm90IGEgc3RyaW5nLicpO1xuICAgICAgICAgICAga2V5ID0gU3RyaW5nKGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICBkYkluZm8uZGIudHJhbnNhY3Rpb24oZnVuY3Rpb24odCkge1xuICAgICAgICAgICAgICAgICAgICB0LmV4ZWN1dGVTcWwoJ0RFTEVURSBGUk9NICcgKyBkYkluZm8uc3RvcmVOYW1lICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgV0hFUkUga2V5ID0gPycsIFtrZXldLCBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbih0LCBlcnJvcikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIERlbGV0ZXMgZXZlcnkgaXRlbSBpbiB0aGUgdGFibGUuXG4gICAgLy8gVE9ETzogRmluZCBvdXQgaWYgdGhpcyByZXNldHMgdGhlIEFVVE9fSU5DUkVNRU5UIG51bWJlci5cbiAgICBmdW5jdGlvbiBjbGVhcihjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHNlbGYucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYkluZm8gPSBzZWxmLl9kYkluZm87XG4gICAgICAgICAgICAgICAgZGJJbmZvLmRiLnRyYW5zYWN0aW9uKGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgICAgICAgICAgICAgdC5leGVjdXRlU3FsKCdERUxFVEUgRlJPTSAnICsgZGJJbmZvLnN0b3JlTmFtZSwgW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24odCwgZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gRG9lcyBhIHNpbXBsZSBgQ09VTlQoa2V5KWAgdG8gZ2V0IHRoZSBudW1iZXIgb2YgaXRlbXMgc3RvcmVkIGluXG4gICAgLy8gbG9jYWxGb3JhZ2UuXG4gICAgZnVuY3Rpb24gbGVuZ3RoKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRiSW5mbyA9IHNlbGYuX2RiSW5mbztcbiAgICAgICAgICAgICAgICBkYkluZm8uZGIudHJhbnNhY3Rpb24oZnVuY3Rpb24odCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBBaGhoLCBTUUwgbWFrZXMgdGhpcyBvbmUgc29vb29vbyBlYXN5LlxuICAgICAgICAgICAgICAgICAgICB0LmV4ZWN1dGVTcWwoJ1NFTEVDVCBDT1VOVChrZXkpIGFzIGMgRlJPTSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRiSW5mby5zdG9yZU5hbWUsIFtdLCBmdW5jdGlvbih0LCByZXN1bHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gcmVzdWx0cy5yb3dzLml0ZW0oMCkuYztcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbih0LCBlcnJvcikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIC8vIFJldHVybiB0aGUga2V5IGxvY2F0ZWQgYXQga2V5IGluZGV4IFg7IGVzc2VudGlhbGx5IGdldHMgdGhlIGtleSBmcm9tIGFcbiAgICAvLyBgV0hFUkUgaWQgPSA/YC4gVGhpcyBpcyB0aGUgbW9zdCBlZmZpY2llbnQgd2F5IEkgY2FuIHRoaW5rIHRvIGltcGxlbWVudFxuICAgIC8vIHRoaXMgcmFyZWx5LXVzZWQgKGluIG15IGV4cGVyaWVuY2UpIHBhcnQgb2YgdGhlIEFQSSwgYnV0IGl0IGNhbiBzZWVtXG4gICAgLy8gaW5jb25zaXN0ZW50LCBiZWNhdXNlIHdlIGRvIGBJTlNFUlQgT1IgUkVQTEFDRSBJTlRPYCBvbiBgc2V0SXRlbSgpYCwgc29cbiAgICAvLyB0aGUgSUQgb2YgZWFjaCBrZXkgd2lsbCBjaGFuZ2UgZXZlcnkgdGltZSBpdCdzIHVwZGF0ZWQuIFBlcmhhcHMgYSBzdG9yZWRcbiAgICAvLyBwcm9jZWR1cmUgZm9yIHRoZSBgc2V0SXRlbSgpYCBTUUwgd291bGQgc29sdmUgdGhpcyBwcm9ibGVtP1xuICAgIC8vIFRPRE86IERvbid0IGNoYW5nZSBJRCBvbiBgc2V0SXRlbSgpYC5cbiAgICBmdW5jdGlvbiBrZXkobiwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIGRiSW5mby5kYi50cmFuc2FjdGlvbihmdW5jdGlvbih0KSB7XG4gICAgICAgICAgICAgICAgICAgIHQuZXhlY3V0ZVNxbCgnU0VMRUNUIGtleSBGUk9NICcgKyBkYkluZm8uc3RvcmVOYW1lICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgV0hFUkUgaWQgPSA/IExJTUlUIDEnLCBbbiArIDFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24odCwgcmVzdWx0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IHJlc3VsdHMucm93cy5sZW5ndGggP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucm93cy5pdGVtKDApLmtleSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHQsIGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKHJlamVjdCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGtleXMoY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICBzZWxmLnJlYWR5KCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGJJbmZvID0gc2VsZi5fZGJJbmZvO1xuICAgICAgICAgICAgICAgIGRiSW5mby5kYi50cmFuc2FjdGlvbihmdW5jdGlvbih0KSB7XG4gICAgICAgICAgICAgICAgICAgIHQuZXhlY3V0ZVNxbCgnU0VMRUNUIGtleSBGUk9NICcgKyBkYkluZm8uc3RvcmVOYW1lLCBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKHQsIHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBrZXlzID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzdWx0cy5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5cy5wdXNoKHJlc3VsdHMucm93cy5pdGVtKGkpLmtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoa2V5cyk7XG4gICAgICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uKHQsIGVycm9yKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2gocmVqZWN0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZXhlY3V0ZUNhbGxiYWNrKHByb21pc2UsIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gQ29udmVydHMgYSBidWZmZXIgdG8gYSBzdHJpbmcgdG8gc3RvcmUsIHNlcmlhbGl6ZWQsIGluIHRoZSBiYWNrZW5kXG4gICAgLy8gc3RvcmFnZSBsaWJyYXJ5LlxuICAgIGZ1bmN0aW9uIF9idWZmZXJUb1N0cmluZyhidWZmZXIpIHtcbiAgICAgICAgLy8gYmFzZTY0LWFycmF5YnVmZmVyXG4gICAgICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gICAgICAgIHZhciBpO1xuICAgICAgICB2YXIgYmFzZTY0U3RyaW5nID0gJyc7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgICAgICAvKmpzbGludCBiaXR3aXNlOiB0cnVlICovXG4gICAgICAgICAgICBiYXNlNjRTdHJpbmcgKz0gQkFTRV9DSEFSU1tieXRlc1tpXSA+PiAyXTtcbiAgICAgICAgICAgIGJhc2U2NFN0cmluZyArPSBCQVNFX0NIQVJTWygoYnl0ZXNbaV0gJiAzKSA8PCA0KSB8IChieXRlc1tpICsgMV0gPj4gNCldO1xuICAgICAgICAgICAgYmFzZTY0U3RyaW5nICs9IEJBU0VfQ0hBUlNbKChieXRlc1tpICsgMV0gJiAxNSkgPDwgMikgfCAoYnl0ZXNbaSArIDJdID4+IDYpXTtcbiAgICAgICAgICAgIGJhc2U2NFN0cmluZyArPSBCQVNFX0NIQVJTW2J5dGVzW2kgKyAyXSAmIDYzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoYnl0ZXMubGVuZ3RoICUgMykgPT09IDIpIHtcbiAgICAgICAgICAgIGJhc2U2NFN0cmluZyA9IGJhc2U2NFN0cmluZy5zdWJzdHJpbmcoMCwgYmFzZTY0U3RyaW5nLmxlbmd0aCAtIDEpICsgJz0nO1xuICAgICAgICB9IGVsc2UgaWYgKGJ5dGVzLmxlbmd0aCAlIDMgPT09IDEpIHtcbiAgICAgICAgICAgIGJhc2U2NFN0cmluZyA9IGJhc2U2NFN0cmluZy5zdWJzdHJpbmcoMCwgYmFzZTY0U3RyaW5nLmxlbmd0aCAtIDIpICsgJz09JztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiYXNlNjRTdHJpbmc7XG4gICAgfVxuXG4gICAgLy8gRGVzZXJpYWxpemUgZGF0YSB3ZSd2ZSBpbnNlcnRlZCBpbnRvIGEgdmFsdWUgY29sdW1uL2ZpZWxkLiBXZSBwbGFjZVxuICAgIC8vIHNwZWNpYWwgbWFya2VycyBpbnRvIG91ciBzdHJpbmdzIHRvIG1hcmsgdGhlbSBhcyBlbmNvZGVkOyB0aGlzIGlzbid0XG4gICAgLy8gYXMgbmljZSBhcyBhIG1ldGEgZmllbGQsIGJ1dCBpdCdzIHRoZSBvbmx5IHNhbmUgdGhpbmcgd2UgY2FuIGRvIHdoaWxzdFxuICAgIC8vIGtlZXBpbmcgbG9jYWxTdG9yYWdlIHN1cHBvcnQgaW50YWN0LlxuICAgIC8vXG4gICAgLy8gT2Z0ZW50aW1lcyB0aGlzIHdpbGwganVzdCBkZXNlcmlhbGl6ZSBKU09OIGNvbnRlbnQsIGJ1dCBpZiB3ZSBoYXZlIGFcbiAgICAvLyBzcGVjaWFsIG1hcmtlciAoU0VSSUFMSVpFRF9NQVJLRVIsIGRlZmluZWQgYWJvdmUpLCB3ZSB3aWxsIGV4dHJhY3RcbiAgICAvLyBzb21lIGtpbmQgb2YgYXJyYXlidWZmZXIvYmluYXJ5IGRhdGEvdHlwZWQgYXJyYXkgb3V0IG9mIHRoZSBzdHJpbmcuXG4gICAgZnVuY3Rpb24gX2Rlc2VyaWFsaXplKHZhbHVlKSB7XG4gICAgICAgIC8vIElmIHdlIGhhdmVuJ3QgbWFya2VkIHRoaXMgc3RyaW5nIGFzIGJlaW5nIHNwZWNpYWxseSBzZXJpYWxpemVkIChpLmUuXG4gICAgICAgIC8vIHNvbWV0aGluZyBvdGhlciB0aGFuIHNlcmlhbGl6ZWQgSlNPTiksIHdlIGNhbiBqdXN0IHJldHVybiBpdCBhbmQgYmVcbiAgICAgICAgLy8gZG9uZSB3aXRoIGl0LlxuICAgICAgICBpZiAodmFsdWUuc3Vic3RyaW5nKDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgU0VSSUFMSVpFRF9NQVJLRVJfTEVOR1RIKSAhPT0gU0VSSUFMSVpFRF9NQVJLRVIpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgY29kZSBkZWFscyB3aXRoIGRlc2VyaWFsaXppbmcgc29tZSBraW5kIG9mIEJsb2Igb3JcbiAgICAgICAgLy8gVHlwZWRBcnJheS4gRmlyc3Qgd2Ugc2VwYXJhdGUgb3V0IHRoZSB0eXBlIG9mIGRhdGEgd2UncmUgZGVhbGluZ1xuICAgICAgICAvLyB3aXRoIGZyb20gdGhlIGRhdGEgaXRzZWxmLlxuICAgICAgICB2YXIgc2VyaWFsaXplZFN0cmluZyA9IHZhbHVlLnN1YnN0cmluZyhUWVBFX1NFUklBTElaRURfTUFSS0VSX0xFTkdUSCk7XG4gICAgICAgIHZhciB0eXBlID0gdmFsdWUuc3Vic3RyaW5nKFNFUklBTElaRURfTUFSS0VSX0xFTkdUSCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVFlQRV9TRVJJQUxJWkVEX01BUktFUl9MRU5HVEgpO1xuXG4gICAgICAgIC8vIEZpbGwgdGhlIHN0cmluZyBpbnRvIGEgQXJyYXlCdWZmZXIuXG4gICAgICAgIHZhciBidWZmZXJMZW5ndGggPSBzZXJpYWxpemVkU3RyaW5nLmxlbmd0aCAqIDAuNzU7XG4gICAgICAgIHZhciBsZW4gPSBzZXJpYWxpemVkU3RyaW5nLmxlbmd0aDtcbiAgICAgICAgdmFyIGk7XG4gICAgICAgIHZhciBwID0gMDtcbiAgICAgICAgdmFyIGVuY29kZWQxLCBlbmNvZGVkMiwgZW5jb2RlZDMsIGVuY29kZWQ0O1xuXG4gICAgICAgIGlmIChzZXJpYWxpemVkU3RyaW5nW3NlcmlhbGl6ZWRTdHJpbmcubGVuZ3RoIC0gMV0gPT09ICc9Jykge1xuICAgICAgICAgICAgYnVmZmVyTGVuZ3RoLS07XG4gICAgICAgICAgICBpZiAoc2VyaWFsaXplZFN0cmluZ1tzZXJpYWxpemVkU3RyaW5nLmxlbmd0aCAtIDJdID09PSAnPScpIHtcbiAgICAgICAgICAgICAgICBidWZmZXJMZW5ndGgtLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgdmFyIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKz00KSB7XG4gICAgICAgICAgICBlbmNvZGVkMSA9IEJBU0VfQ0hBUlMuaW5kZXhPZihzZXJpYWxpemVkU3RyaW5nW2ldKTtcbiAgICAgICAgICAgIGVuY29kZWQyID0gQkFTRV9DSEFSUy5pbmRleE9mKHNlcmlhbGl6ZWRTdHJpbmdbaSsxXSk7XG4gICAgICAgICAgICBlbmNvZGVkMyA9IEJBU0VfQ0hBUlMuaW5kZXhPZihzZXJpYWxpemVkU3RyaW5nW2krMl0pO1xuICAgICAgICAgICAgZW5jb2RlZDQgPSBCQVNFX0NIQVJTLmluZGV4T2Yoc2VyaWFsaXplZFN0cmluZ1tpKzNdKTtcblxuICAgICAgICAgICAgLypqc2xpbnQgYml0d2lzZTogdHJ1ZSAqL1xuICAgICAgICAgICAgYnl0ZXNbcCsrXSA9IChlbmNvZGVkMSA8PCAyKSB8IChlbmNvZGVkMiA+PiA0KTtcbiAgICAgICAgICAgIGJ5dGVzW3ArK10gPSAoKGVuY29kZWQyICYgMTUpIDw8IDQpIHwgKGVuY29kZWQzID4+IDIpO1xuICAgICAgICAgICAgYnl0ZXNbcCsrXSA9ICgoZW5jb2RlZDMgJiAzKSA8PCA2KSB8IChlbmNvZGVkNCAmIDYzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHVybiB0aGUgcmlnaHQgdHlwZSBiYXNlZCBvbiB0aGUgY29kZS90eXBlIHNldCBkdXJpbmdcbiAgICAgICAgLy8gc2VyaWFsaXphdGlvbi5cbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFRZUEVfQVJSQVlCVUZGRVI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9CTE9COlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQmxvYihbYnVmZmVyXSk7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UOEFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgSW50OEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDhBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UOENMQU1QRURBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UMTZBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEludDE2QXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTZBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQxNkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfSU5UMzJBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEludDMyQXJyYXkoYnVmZmVyKTtcbiAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMzJBUlJBWTpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQzMkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfRkxPQVQzMkFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBjYXNlIFRZUEVfRkxPQVQ2NEFSUkFZOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmxvYXQ2NEFycmF5KGJ1ZmZlcik7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5rb3duIHR5cGU6ICcgKyB0eXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlcmlhbGl6ZSBhIHZhbHVlLCBhZnRlcndhcmRzIGV4ZWN1dGluZyBhIGNhbGxiYWNrICh3aGljaCB1c3VhbGx5XG4gICAgLy8gaW5zdHJ1Y3RzIHRoZSBgc2V0SXRlbSgpYCBjYWxsYmFjay9wcm9taXNlIHRvIGJlIGV4ZWN1dGVkKS4gVGhpcyBpcyBob3dcbiAgICAvLyB3ZSBzdG9yZSBiaW5hcnkgZGF0YSB3aXRoIGxvY2FsU3RvcmFnZS5cbiAgICBmdW5jdGlvbiBfc2VyaWFsaXplKHZhbHVlLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgdmFsdWVTdHJpbmcgPSAnJztcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICB2YWx1ZVN0cmluZyA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5ub3QgdXNlIGB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyYCBvciBzdWNoIGhlcmUsIGFzIHRoZXNlXG4gICAgICAgIC8vIGNoZWNrcyBmYWlsIHdoZW4gcnVubmluZyB0aGUgdGVzdHMgdXNpbmcgY2FzcGVyLmpzLi4uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRPRE86IFNlZSB3aHkgdGhvc2UgdGVzdHMgZmFpbCBhbmQgdXNlIGEgYmV0dGVyIHNvbHV0aW9uLlxuICAgICAgICBpZiAodmFsdWUgJiYgKHZhbHVlLnRvU3RyaW5nKCkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScgfHxcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5idWZmZXIgJiZcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5idWZmZXIudG9TdHJpbmcoKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykpIHtcbiAgICAgICAgICAgIC8vIENvbnZlcnQgYmluYXJ5IGFycmF5cyB0byBhIHN0cmluZyBhbmQgcHJlZml4IHRoZSBzdHJpbmcgd2l0aFxuICAgICAgICAgICAgLy8gYSBzcGVjaWFsIG1hcmtlci5cbiAgICAgICAgICAgIHZhciBidWZmZXI7XG4gICAgICAgICAgICB2YXIgbWFya2VyID0gU0VSSUFMSVpFRF9NQVJLRVI7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfQVJSQVlCVUZGRVI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJ1ZmZlciA9IHZhbHVlLmJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgSW50OEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfSU5UOEFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IFVpbnQ4QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9VSU5UOEFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IFVpbnQ4Q2xhbXBlZEFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfVUlOVDhDTEFNUEVEQVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgSW50MTZBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX0lOVDE2QVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVN0cmluZyA9PT0gJ1tvYmplY3QgVWludDE2QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9VSU5UMTZBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBJbnQzMkFycmF5XScpIHtcbiAgICAgICAgICAgICAgICAgICAgbWFya2VyICs9IFRZUEVfSU5UMzJBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBVaW50MzJBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX1VJTlQzMkFSUkFZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVTdHJpbmcgPT09ICdbb2JqZWN0IEZsb2F0MzJBcnJheV0nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciArPSBUWVBFX0ZMT0FUMzJBUlJBWTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBGbG9hdDY0QXJyYXldJykge1xuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgKz0gVFlQRV9GTE9BVDY0QVJSQVk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdGYWlsZWQgdG8gZ2V0IHR5cGUgZm9yIEJpbmFyeUFycmF5JykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2FsbGJhY2sobWFya2VyICsgX2J1ZmZlclRvU3RyaW5nKGJ1ZmZlcikpO1xuICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyaW5nID09PSAnW29iamVjdCBCbG9iXScpIHtcbiAgICAgICAgICAgIC8vIENvbnZlciB0aGUgYmxvYiB0byBhIGJpbmFyeUFycmF5IGFuZCB0aGVuIHRvIGEgc3RyaW5nLlxuICAgICAgICAgICAgdmFyIGZpbGVSZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG4gICAgICAgICAgICBmaWxlUmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBzdHIgPSBfYnVmZmVyVG9TdHJpbmcodGhpcy5yZXN1bHQpO1xuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soU0VSSUFMSVpFRF9NQVJLRVIgKyBUWVBFX0JMT0IgKyBzdHIpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZmlsZVJlYWRlci5yZWFkQXNBcnJheUJ1ZmZlcih2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgd2luZG93LmNvbnNvbGUuZXJyb3IoXCJDb3VsZG4ndCBjb252ZXJ0IHZhbHVlIGludG8gYSBKU09OIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnc3RyaW5nOiAnLCB2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4ZWN1dGVDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciB3ZWJTUUxTdG9yYWdlID0ge1xuICAgICAgICBfZHJpdmVyOiAnd2ViU1FMU3RvcmFnZScsXG4gICAgICAgIF9pbml0U3RvcmFnZTogX2luaXRTdG9yYWdlLFxuICAgICAgICBpdGVyYXRlOiBpdGVyYXRlLFxuICAgICAgICBnZXRJdGVtOiBnZXRJdGVtLFxuICAgICAgICBzZXRJdGVtOiBzZXRJdGVtLFxuICAgICAgICByZW1vdmVJdGVtOiByZW1vdmVJdGVtLFxuICAgICAgICBjbGVhcjogY2xlYXIsXG4gICAgICAgIGxlbmd0aDogbGVuZ3RoLFxuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAga2V5czoga2V5c1xuICAgIH07XG5cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZSgnd2ViU1FMU3RvcmFnZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHdlYlNRTFN0b3JhZ2U7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSB3ZWJTUUxTdG9yYWdlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMud2ViU1FMU3RvcmFnZSA9IHdlYlNRTFN0b3JhZ2U7XG4gICAgfVxufSkuY2FsbCh3aW5kb3cpO1xuIiwiKGZ1bmN0aW9uKCkge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIFByb21pc2VzIVxuICAgIHZhciBQcm9taXNlID0gKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSA/XG4gICAgICAgICAgICAgICAgICByZXF1aXJlKCdwcm9taXNlJykgOiB0aGlzLlByb21pc2U7XG5cbiAgICAvLyBDdXN0b20gZHJpdmVycyBhcmUgc3RvcmVkIGhlcmUgd2hlbiBgZGVmaW5lRHJpdmVyKClgIGlzIGNhbGxlZC5cbiAgICAvLyBUaGV5IGFyZSBzaGFyZWQgYWNyb3NzIGFsbCBpbnN0YW5jZXMgb2YgbG9jYWxGb3JhZ2UuXG4gICAgdmFyIEN1c3RvbURyaXZlcnMgPSB7fTtcblxuICAgIHZhciBEcml2ZXJUeXBlID0ge1xuICAgICAgICBJTkRFWEVEREI6ICdhc3luY1N0b3JhZ2UnLFxuICAgICAgICBMT0NBTFNUT1JBR0U6ICdsb2NhbFN0b3JhZ2VXcmFwcGVyJyxcbiAgICAgICAgV0VCU1FMOiAnd2ViU1FMU3RvcmFnZSdcbiAgICB9O1xuXG4gICAgdmFyIERlZmF1bHREcml2ZXJPcmRlciA9IFtcbiAgICAgICAgRHJpdmVyVHlwZS5JTkRFWEVEREIsXG4gICAgICAgIERyaXZlclR5cGUuV0VCU1FMLFxuICAgICAgICBEcml2ZXJUeXBlLkxPQ0FMU1RPUkFHRVxuICAgIF07XG5cbiAgICB2YXIgTGlicmFyeU1ldGhvZHMgPSBbXG4gICAgICAgICdjbGVhcicsXG4gICAgICAgICdnZXRJdGVtJyxcbiAgICAgICAgJ2l0ZXJhdGUnLFxuICAgICAgICAna2V5JyxcbiAgICAgICAgJ2tleXMnLFxuICAgICAgICAnbGVuZ3RoJyxcbiAgICAgICAgJ3JlbW92ZUl0ZW0nLFxuICAgICAgICAnc2V0SXRlbSdcbiAgICBdO1xuXG4gICAgdmFyIE1vZHVsZVR5cGUgPSB7XG4gICAgICAgIERFRklORTogMSxcbiAgICAgICAgRVhQT1JUOiAyLFxuICAgICAgICBXSU5ET1c6IDNcbiAgICB9O1xuXG4gICAgdmFyIERlZmF1bHRDb25maWcgPSB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgZHJpdmVyOiBEZWZhdWx0RHJpdmVyT3JkZXIuc2xpY2UoKSxcbiAgICAgICAgbmFtZTogJ2xvY2FsZm9yYWdlJyxcbiAgICAgICAgLy8gRGVmYXVsdCBEQiBzaXplIGlzIF9KVVNUIFVOREVSXyA1TUIsIGFzIGl0J3MgdGhlIGhpZ2hlc3Qgc2l6ZVxuICAgICAgICAvLyB3ZSBjYW4gdXNlIHdpdGhvdXQgYSBwcm9tcHQuXG4gICAgICAgIHNpemU6IDQ5ODA3MzYsXG4gICAgICAgIHN0b3JlTmFtZTogJ2tleXZhbHVlcGFpcnMnLFxuICAgICAgICB2ZXJzaW9uOiAxLjBcbiAgICB9O1xuXG4gICAgLy8gQXR0YWNoaW5nIHRvIHdpbmRvdyAoaS5lLiBubyBtb2R1bGUgbG9hZGVyKSBpcyB0aGUgYXNzdW1lZCxcbiAgICAvLyBzaW1wbGUgZGVmYXVsdC5cbiAgICB2YXIgbW9kdWxlVHlwZSA9IE1vZHVsZVR5cGUuV0lORE9XO1xuXG4gICAgLy8gRmluZCBvdXQgd2hhdCBraW5kIG9mIG1vZHVsZSBzZXR1cCB3ZSBoYXZlOyBpZiBub25lLCB3ZSdsbCBqdXN0IGF0dGFjaFxuICAgIC8vIGxvY2FsRm9yYWdlIHRvIHRoZSBtYWluIHdpbmRvdy5cbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIG1vZHVsZVR5cGUgPSBNb2R1bGVUeXBlLkRFRklORTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICAgIG1vZHVsZVR5cGUgPSBNb2R1bGVUeXBlLkVYUE9SVDtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB0byBzZWUgaWYgSW5kZXhlZERCIGlzIGF2YWlsYWJsZSBhbmQgaWYgaXQgaXMgdGhlIGxhdGVzdFxuICAgIC8vIGltcGxlbWVudGF0aW9uOyBpdCdzIG91ciBwcmVmZXJyZWQgYmFja2VuZCBsaWJyYXJ5LiBXZSB1c2UgXCJfc3BlY190ZXN0XCJcbiAgICAvLyBhcyB0aGUgbmFtZSBvZiB0aGUgZGF0YWJhc2UgYmVjYXVzZSBpdCdzIG5vdCB0aGUgb25lIHdlJ2xsIG9wZXJhdGUgb24sXG4gICAgLy8gYnV0IGl0J3MgdXNlZnVsIHRvIG1ha2Ugc3VyZSBpdHMgdXNpbmcgdGhlIHJpZ2h0IHNwZWMuXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbW96aWxsYS9sb2NhbEZvcmFnZS9pc3N1ZXMvMTI4XG4gICAgdmFyIGRyaXZlclN1cHBvcnQgPSAoZnVuY3Rpb24oc2VsZikge1xuICAgICAgICAvLyBJbml0aWFsaXplIEluZGV4ZWREQjsgZmFsbCBiYWNrIHRvIHZlbmRvci1wcmVmaXhlZCB2ZXJzaW9uc1xuICAgICAgICAvLyBpZiBuZWVkZWQuXG4gICAgICAgIHZhciBpbmRleGVkREIgPSBpbmRleGVkREIgfHwgc2VsZi5pbmRleGVkREIgfHwgc2VsZi53ZWJraXRJbmRleGVkREIgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYubW96SW5kZXhlZERCIHx8IHNlbGYuT0luZGV4ZWREQiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5tc0luZGV4ZWREQjtcblxuICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgcmVzdWx0W0RyaXZlclR5cGUuV0VCU1FMXSA9ICEhc2VsZi5vcGVuRGF0YWJhc2U7XG4gICAgICAgIHJlc3VsdFtEcml2ZXJUeXBlLklOREVYRUREQl0gPSAhIShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIFdlIG1pbWljIFBvdWNoREIgaGVyZTsganVzdCBVQSB0ZXN0IGZvciBTYWZhcmkgKHdoaWNoLCBhcyBvZlxuICAgICAgICAgICAgLy8gaU9TIDgvWW9zZW1pdGUsIGRvZXNuJ3QgcHJvcGVybHkgc3VwcG9ydCBJbmRleGVkREIpLlxuICAgICAgICAgICAgLy8gSW5kZXhlZERCIHN1cHBvcnQgaXMgYnJva2VuIGFuZCBkaWZmZXJlbnQgZnJvbSBCbGluaydzLlxuICAgICAgICAgICAgLy8gVGhpcyBpcyBmYXN0ZXIgdGhhbiB0aGUgdGVzdCBjYXNlIChhbmQgaXQncyBzeW5jKSwgc28gd2UganVzdFxuICAgICAgICAgICAgLy8gZG8gdGhpcy4gKlNJR0gqXG4gICAgICAgICAgICAvLyBodHRwOi8vYmwub2Nrcy5vcmcvbm9sYW5sYXdzb24vcmF3L2M4M2U5MDM5ZWRmMjI3ODA0N2U5L1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIFdlIHRlc3QgZm9yIG9wZW5EYXRhYmFzZSBiZWNhdXNlIElFIE1vYmlsZSBpZGVudGlmaWVzIGl0c2VsZlxuICAgICAgICAgICAgLy8gYXMgU2FmYXJpLiBPaCB0aGUgbHVsei4uLlxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWxmLm9wZW5EYXRhYmFzZSAhPT0gJ3VuZGVmaW5lZCcgJiYgc2VsZi5uYXZpZ2F0b3IgJiZcbiAgICAgICAgICAgICAgICBzZWxmLm5hdmlnYXRvci51c2VyQWdlbnQgJiZcbiAgICAgICAgICAgICAgICAvU2FmYXJpLy50ZXN0KHNlbGYubmF2aWdhdG9yLnVzZXJBZ2VudCkgJiZcbiAgICAgICAgICAgICAgICAhL0Nocm9tZS8udGVzdChzZWxmLm5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5kZXhlZERCICYmXG4gICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBpbmRleGVkREIub3BlbiA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICAgICAgICAgICAgICAvLyBTb21lIFNhbXN1bmcvSFRDIEFuZHJvaWQgNC4wLTQuMyBkZXZpY2VzXG4gICAgICAgICAgICAgICAgICAgICAgIC8vIGhhdmUgb2xkZXIgSW5kZXhlZERCIHNwZWNzOyBpZiB0aGlzIGlzbid0IGF2YWlsYWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGVpciBJbmRleGVkREIgaXMgdG9vIG9sZCBmb3IgdXMgdG8gdXNlLlxuICAgICAgICAgICAgICAgICAgICAgICAvLyAoUmVwbGFjZXMgdGhlIG9udXBncmFkZW5lZWRlZCB0ZXN0LilcbiAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHNlbGYuSURCS2V5UmFuZ2UgIT09ICd1bmRlZmluZWQnO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcblxuICAgICAgICByZXN1bHRbRHJpdmVyVHlwZS5MT0NBTFNUT1JBR0VdID0gISEoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiAoc2VsZi5sb2NhbFN0b3JhZ2UgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICgnc2V0SXRlbScgaW4gc2VsZi5sb2NhbFN0b3JhZ2UpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAoc2VsZi5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pKHRoaXMpO1xuXG4gICAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGNhbGxXaGVuUmVhZHkobG9jYWxGb3JhZ2VJbnN0YW5jZSwgbGlicmFyeU1ldGhvZCkge1xuICAgICAgICBsb2NhbEZvcmFnZUluc3RhbmNlW2xpYnJhcnlNZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgX2FyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxGb3JhZ2VJbnN0YW5jZS5yZWFkeSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxvY2FsRm9yYWdlSW5zdGFuY2VbbGlicmFyeU1ldGhvZF0uYXBwbHkobG9jYWxGb3JhZ2VJbnN0YW5jZSwgX2FyZ3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXh0ZW5kKCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGFyZyA9IGFyZ3VtZW50c1tpXTtcblxuICAgICAgICAgICAgaWYgKGFyZykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBhcmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShhcmdba2V5XSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHNbMF1ba2V5XSA9IGFyZ1trZXldLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50c1swXVtrZXldID0gYXJnW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJndW1lbnRzWzBdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGlzTGlicmFyeURyaXZlcihkcml2ZXJOYW1lKSB7XG4gICAgICAgIGZvciAodmFyIGRyaXZlciBpbiBEcml2ZXJUeXBlKSB7XG4gICAgICAgICAgICBpZiAoRHJpdmVyVHlwZS5oYXNPd25Qcm9wZXJ0eShkcml2ZXIpICYmXG4gICAgICAgICAgICAgICAgRHJpdmVyVHlwZVtkcml2ZXJdID09PSBkcml2ZXJOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdmFyIGdsb2JhbE9iamVjdCA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBMb2NhbEZvcmFnZShvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuX2NvbmZpZyA9IGV4dGVuZCh7fSwgRGVmYXVsdENvbmZpZywgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMuX2RyaXZlclNldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3JlYWR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RiSW5mbyA9IG51bGw7XG5cbiAgICAgICAgLy8gQWRkIGEgc3R1YiBmb3IgZWFjaCBkcml2ZXIgQVBJIG1ldGhvZCB0aGF0IGRlbGF5cyB0aGUgY2FsbCB0byB0aGVcbiAgICAgICAgLy8gY29ycmVzcG9uZGluZyBkcml2ZXIgbWV0aG9kIHVudGlsIGxvY2FsRm9yYWdlIGlzIHJlYWR5LiBUaGVzZSBzdHVic1xuICAgICAgICAvLyB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBkcml2ZXIgbWV0aG9kcyBhcyBzb29uIGFzIHRoZSBkcml2ZXIgaXNcbiAgICAgICAgLy8gbG9hZGVkLCBzbyB0aGVyZSBpcyBubyBwZXJmb3JtYW5jZSBpbXBhY3QuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgTGlicmFyeU1ldGhvZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNhbGxXaGVuUmVhZHkodGhpcywgTGlicmFyeU1ldGhvZHNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXREcml2ZXIodGhpcy5fY29uZmlnLmRyaXZlcik7XG4gICAgfVxuXG4gICAgTG9jYWxGb3JhZ2UucHJvdG90eXBlLklOREVYRUREQiA9IERyaXZlclR5cGUuSU5ERVhFRERCO1xuICAgIExvY2FsRm9yYWdlLnByb3RvdHlwZS5MT0NBTFNUT1JBR0UgPSBEcml2ZXJUeXBlLkxPQ0FMU1RPUkFHRTtcbiAgICBMb2NhbEZvcmFnZS5wcm90b3R5cGUuV0VCU1FMID0gRHJpdmVyVHlwZS5XRUJTUUw7XG5cbiAgICAvLyBTZXQgYW55IGNvbmZpZyB2YWx1ZXMgZm9yIGxvY2FsRm9yYWdlOyBjYW4gYmUgY2FsbGVkIGFueXRpbWUgYmVmb3JlXG4gICAgLy8gdGhlIGZpcnN0IEFQSSBjYWxsIChlLmcuIGBnZXRJdGVtYCwgYHNldEl0ZW1gKS5cbiAgICAvLyBXZSBsb29wIHRocm91Z2ggb3B0aW9ucyBzbyB3ZSBkb24ndCBvdmVyd3JpdGUgZXhpc3RpbmcgY29uZmlnXG4gICAgLy8gdmFsdWVzLlxuICAgIExvY2FsRm9yYWdlLnByb3RvdHlwZS5jb25maWcgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIC8vIElmIHRoZSBvcHRpb25zIGFyZ3VtZW50IGlzIGFuIG9iamVjdCwgd2UgdXNlIGl0IHRvIHNldCB2YWx1ZXMuXG4gICAgICAgIC8vIE90aGVyd2lzZSwgd2UgcmV0dXJuIGVpdGhlciBhIHNwZWNpZmllZCBjb25maWcgdmFsdWUgb3IgYWxsXG4gICAgICAgIC8vIGNvbmZpZyB2YWx1ZXMuXG4gICAgICAgIGlmICh0eXBlb2Yob3B0aW9ucykgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBJZiBsb2NhbGZvcmFnZSBpcyByZWFkeSBhbmQgZnVsbHkgaW5pdGlhbGl6ZWQsIHdlIGNhbid0IHNldFxuICAgICAgICAgICAgLy8gYW55IG5ldyBjb25maWd1cmF0aW9uIHZhbHVlcy4gSW5zdGVhZCwgd2UgcmV0dXJuIGFuIGVycm9yLlxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlYWR5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBFcnJvcihcIkNhbid0IGNhbGwgY29uZmlnKCkgYWZ0ZXIgbG9jYWxmb3JhZ2UgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2hhcyBiZWVuIHVzZWQuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAodmFyIGkgaW4gb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmIChpID09PSAnc3RvcmVOYW1lJykge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zW2ldID0gb3B0aW9uc1tpXS5yZXBsYWNlKC9cXFcvZywgJ18nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9jb25maWdbaV0gPSBvcHRpb25zW2ldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhZnRlciBhbGwgY29uZmlnIG9wdGlvbnMgYXJlIHNldCBhbmRcbiAgICAgICAgICAgIC8vIHRoZSBkcml2ZXIgb3B0aW9uIGlzIHVzZWQsIHRyeSBzZXR0aW5nIGl0XG4gICAgICAgICAgICBpZiAoJ2RyaXZlcicgaW4gb3B0aW9ucyAmJiBvcHRpb25zLmRyaXZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RHJpdmVyKHRoaXMuX2NvbmZpZy5kcml2ZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Yob3B0aW9ucykgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY29uZmlnW29wdGlvbnNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbmZpZztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBVc2VkIHRvIGRlZmluZSBhIGN1c3RvbSBkcml2ZXIsIHNoYXJlZCBhY3Jvc3MgYWxsIGluc3RhbmNlcyBvZlxuICAgIC8vIGxvY2FsRm9yYWdlLlxuICAgIExvY2FsRm9yYWdlLnByb3RvdHlwZS5kZWZpbmVEcml2ZXIgPSBmdW5jdGlvbihkcml2ZXJPYmplY3QsIGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvckNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBkZWZpbmVEcml2ZXIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIGRyaXZlck5hbWUgPSBkcml2ZXJPYmplY3QuX2RyaXZlcjtcbiAgICAgICAgICAgICAgICB2YXIgY29tcGxpYW5jZUVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAnQ3VzdG9tIGRyaXZlciBub3QgY29tcGxpYW50OyBzZWUgJyArXG4gICAgICAgICAgICAgICAgICAgICdodHRwczovL21vemlsbGEuZ2l0aHViLmlvL2xvY2FsRm9yYWdlLyNkZWZpbmVkcml2ZXInXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB2YXIgbmFtaW5nRXJyb3IgPSBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICdDdXN0b20gZHJpdmVyIG5hbWUgYWxyZWFkeSBpbiB1c2U6ICcgKyBkcml2ZXJPYmplY3QuX2RyaXZlclxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAvLyBBIGRyaXZlciBuYW1lIHNob3VsZCBiZSBkZWZpbmVkIGFuZCBub3Qgb3ZlcmxhcCB3aXRoIHRoZVxuICAgICAgICAgICAgICAgIC8vIGxpYnJhcnktZGVmaW5lZCwgZGVmYXVsdCBkcml2ZXJzLlxuICAgICAgICAgICAgICAgIGlmICghZHJpdmVyT2JqZWN0Ll9kcml2ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGNvbXBsaWFuY2VFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGlzTGlicmFyeURyaXZlcihkcml2ZXJPYmplY3QuX2RyaXZlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5hbWluZ0Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBjdXN0b21Ecml2ZXJNZXRob2RzID0gTGlicmFyeU1ldGhvZHMuY29uY2F0KCdfaW5pdFN0b3JhZ2UnKTtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGN1c3RvbURyaXZlck1ldGhvZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGN1c3RvbURyaXZlck1ldGhvZCA9IGN1c3RvbURyaXZlck1ldGhvZHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmICghY3VzdG9tRHJpdmVyTWV0aG9kIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAhZHJpdmVyT2JqZWN0W2N1c3RvbURyaXZlck1ldGhvZF0gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiBkcml2ZXJPYmplY3RbY3VzdG9tRHJpdmVyTWV0aG9kXSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGNvbXBsaWFuY2VFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgc3VwcG9ydFByb21pc2UgPSBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKCdfc3VwcG9ydCcgIGluIGRyaXZlck9iamVjdCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHJpdmVyT2JqZWN0Ll9zdXBwb3J0ICYmIHR5cGVvZiBkcml2ZXJPYmplY3QuX3N1cHBvcnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1cHBvcnRQcm9taXNlID0gZHJpdmVyT2JqZWN0Ll9zdXBwb3J0KCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdXBwb3J0UHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSghIWRyaXZlck9iamVjdC5fc3VwcG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzdXBwb3J0UHJvbWlzZS50aGVuKGZ1bmN0aW9uKHN1cHBvcnRSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgZHJpdmVyU3VwcG9ydFtkcml2ZXJOYW1lXSA9IHN1cHBvcnRSZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIEN1c3RvbURyaXZlcnNbZHJpdmVyTmFtZV0gPSBkcml2ZXJPYmplY3Q7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9LCByZWplY3QpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIHJlamVjdChlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZGVmaW5lRHJpdmVyLnRoZW4oY2FsbGJhY2ssIGVycm9yQ2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gZGVmaW5lRHJpdmVyO1xuICAgIH07XG5cbiAgICBMb2NhbEZvcmFnZS5wcm90b3R5cGUuZHJpdmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcml2ZXIgfHwgbnVsbDtcbiAgICB9O1xuXG4gICAgTG9jYWxGb3JhZ2UucHJvdG90eXBlLnJlYWR5ID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciByZWFkeSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgc2VsZi5fZHJpdmVyU2V0LnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGYuX3JlYWR5ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX3JlYWR5ID0gc2VsZi5faW5pdFN0b3JhZ2Uoc2VsZi5fY29uZmlnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzZWxmLl9yZWFkeS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgICAgICB9KS5jYXRjaChyZWplY3QpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZWFkeS50aGVuKGNhbGxiYWNrLCBjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiByZWFkeTtcbiAgICB9O1xuXG4gICAgTG9jYWxGb3JhZ2UucHJvdG90eXBlLnNldERyaXZlciA9IGZ1bmN0aW9uKGRyaXZlcnMsIGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvckNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBpZiAodHlwZW9mIGRyaXZlcnMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkcml2ZXJzID0gW2RyaXZlcnNdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZHJpdmVyU2V0ID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICB2YXIgZHJpdmVyTmFtZSA9IHNlbGYuX2dldEZpcnN0U3VwcG9ydGVkRHJpdmVyKGRyaXZlcnMpO1xuICAgICAgICAgICAgdmFyIGVycm9yID0gbmV3IEVycm9yKCdObyBhdmFpbGFibGUgc3RvcmFnZSBtZXRob2QgZm91bmQuJyk7XG5cbiAgICAgICAgICAgIGlmICghZHJpdmVyTmFtZSkge1xuICAgICAgICAgICAgICAgIHNlbGYuX2RyaXZlclNldCA9IFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi5fZGJJbmZvID0gbnVsbDtcbiAgICAgICAgICAgIHNlbGYuX3JlYWR5ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKGlzTGlicmFyeURyaXZlcihkcml2ZXJOYW1lKSkge1xuICAgICAgICAgICAgICAgIC8vIFdlIGFsbG93IGxvY2FsRm9yYWdlIHRvIGJlIGRlY2xhcmVkIGFzIGEgbW9kdWxlIG9yIGFzIGFcbiAgICAgICAgICAgICAgICAvLyBsaWJyYXJ5IGF2YWlsYWJsZSB3aXRob3V0IEFNRC9yZXF1aXJlLmpzLlxuICAgICAgICAgICAgICAgIGlmIChtb2R1bGVUeXBlID09PSBNb2R1bGVUeXBlLkRFRklORSkge1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlKFtkcml2ZXJOYW1lXSwgZnVuY3Rpb24obGliKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9leHRlbmQobGliKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtb2R1bGVUeXBlID09PSBNb2R1bGVUeXBlLkVYUE9SVCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBNYWtpbmcgaXQgYnJvd3NlcmlmeSBmcmllbmRseVxuICAgICAgICAgICAgICAgICAgICB2YXIgZHJpdmVyO1xuICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGRyaXZlck5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Ugc2VsZi5JTkRFWEVEREI6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJpdmVyID0gcmVxdWlyZSgnLi9kcml2ZXJzL2luZGV4ZWRkYicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBzZWxmLkxPQ0FMU1RPUkFHRTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcml2ZXIgPSByZXF1aXJlKCcuL2RyaXZlcnMvbG9jYWxzdG9yYWdlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIHNlbGYuV0VCU1FMOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyaXZlciA9IHJlcXVpcmUoJy4vZHJpdmVycy93ZWJzcWwnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2V4dGVuZChkcml2ZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2V4dGVuZChnbG9iYWxPYmplY3RbZHJpdmVyTmFtZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoQ3VzdG9tRHJpdmVyc1tkcml2ZXJOYW1lXSkge1xuICAgICAgICAgICAgICAgIHNlbGYuX2V4dGVuZChDdXN0b21Ecml2ZXJzW2RyaXZlck5hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VsZi5fZHJpdmVyU2V0ID0gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZ1bmN0aW9uIHNldERyaXZlclRvQ29uZmlnKCkge1xuICAgICAgICAgICAgc2VsZi5fY29uZmlnLmRyaXZlciA9IHNlbGYuZHJpdmVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZHJpdmVyU2V0LnRoZW4oc2V0RHJpdmVyVG9Db25maWcsIHNldERyaXZlclRvQ29uZmlnKTtcblxuICAgICAgICB0aGlzLl9kcml2ZXJTZXQudGhlbihjYWxsYmFjaywgZXJyb3JDYWxsYmFjayk7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcml2ZXJTZXQ7XG4gICAgfTtcblxuICAgIExvY2FsRm9yYWdlLnByb3RvdHlwZS5zdXBwb3J0cyA9IGZ1bmN0aW9uKGRyaXZlck5hbWUpIHtcbiAgICAgICAgcmV0dXJuICEhZHJpdmVyU3VwcG9ydFtkcml2ZXJOYW1lXTtcbiAgICB9O1xuXG4gICAgTG9jYWxGb3JhZ2UucHJvdG90eXBlLl9leHRlbmQgPSBmdW5jdGlvbihsaWJyYXJ5TWV0aG9kc0FuZFByb3BlcnRpZXMpIHtcbiAgICAgICAgZXh0ZW5kKHRoaXMsIGxpYnJhcnlNZXRob2RzQW5kUHJvcGVydGllcyk7XG4gICAgfTtcblxuICAgIC8vIFVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGRyaXZlciB3ZSBzaG91bGQgdXNlIGFzIHRoZSBiYWNrZW5kIGZvciB0aGlzXG4gICAgLy8gaW5zdGFuY2Ugb2YgbG9jYWxGb3JhZ2UuXG4gICAgTG9jYWxGb3JhZ2UucHJvdG90eXBlLl9nZXRGaXJzdFN1cHBvcnRlZERyaXZlciA9IGZ1bmN0aW9uKGRyaXZlcnMpIHtcbiAgICAgICAgaWYgKGRyaXZlcnMgJiYgaXNBcnJheShkcml2ZXJzKSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBkcml2ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRyaXZlciA9IGRyaXZlcnNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zdXBwb3J0cyhkcml2ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBkcml2ZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfTtcblxuICAgIExvY2FsRm9yYWdlLnByb3RvdHlwZS5jcmVhdGVJbnN0YW5jZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBMb2NhbEZvcmFnZShvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLy8gVGhlIGFjdHVhbCBsb2NhbEZvcmFnZSBvYmplY3QgdGhhdCB3ZSBleHBvc2UgYXMgYSBtb2R1bGUgb3IgdmlhIGFcbiAgICAvLyBnbG9iYWwuIEl0J3MgZXh0ZW5kZWQgYnkgcHVsbGluZyBpbiBvbmUgb2Ygb3VyIG90aGVyIGxpYnJhcmllcy5cbiAgICB2YXIgbG9jYWxGb3JhZ2UgPSBuZXcgTG9jYWxGb3JhZ2UoKTtcblxuICAgIC8vIFdlIGFsbG93IGxvY2FsRm9yYWdlIHRvIGJlIGRlY2xhcmVkIGFzIGEgbW9kdWxlIG9yIGFzIGEgbGlicmFyeVxuICAgIC8vIGF2YWlsYWJsZSB3aXRob3V0IEFNRC9yZXF1aXJlLmpzLlxuICAgIGlmIChtb2R1bGVUeXBlID09PSBNb2R1bGVUeXBlLkRFRklORSkge1xuICAgICAgICBkZWZpbmUoJ2xvY2FsZm9yYWdlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxGb3JhZ2U7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAobW9kdWxlVHlwZSA9PT0gTW9kdWxlVHlwZS5FWFBPUlQpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBsb2NhbEZvcmFnZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxvY2FsZm9yYWdlID0gbG9jYWxGb3JhZ2U7XG4gICAgfVxufSkuY2FsbCh3aW5kb3cpO1xuIiwidmFyIHJlc29sdmUgPSByZXF1aXJlKCdzb3VuZGNsb3VkLXJlc29sdmUnKVxudmFyIGZvbnRzID0gcmVxdWlyZSgnZ29vZ2xlLWZvbnRzJylcbnZhciBtaW5zdGFjaGUgPSByZXF1aXJlKCdtaW5zdGFjaGUnKVxudmFyIGluc2VydCA9IHJlcXVpcmUoJ2luc2VydC1jc3MnKVxudmFyIGZzID0gcmVxdWlyZSgnZnMnKVxuXG52YXIgaWNvbnMgPSB7XG4gICAgYmxhY2s6ICdodHRwOi8vZGV2ZWxvcGVycy5zb3VuZGNsb3VkLmNvbS9hc3NldHMvbG9nb19ibGFjay5wbmcnXG4gICwgd2hpdGU6ICdodHRwOi8vZGV2ZWxvcGVycy5zb3VuZGNsb3VkLmNvbS9hc3NldHMvbG9nb193aGl0ZS5wbmcnXG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmFkZ2VcbmZ1bmN0aW9uIG5vb3AoZXJyKXsgaWYgKGVycikgdGhyb3cgZXJyIH1cblxudmFyIGluc2VydGVkID0gZmFsc2VcbnZhciBnd2ZhZGRlZCA9IGZhbHNlXG52YXIgdGVtcGxhdGUgPSBudWxsXG5cbmZ1bmN0aW9uIGJhZGdlKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gIGlmICghaW5zZXJ0ZWQpIGluc2VydChcIi5ucG0tc2NiLXdyYXAge1xcbiAgZm9udC1mYW1pbHk6ICdPcGVuIFNhbnMnLCAnSGVsdmV0aWNhIE5ldWUnLCBIZWx2ZXRpY2EsIEFyaWFsLCBzYW5zLXNlcmlmO1xcbiAgZm9udC13ZWlnaHQ6IDIwMDtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHRvcDogMDtcXG4gIGxlZnQ6IDA7XFxuICB6LWluZGV4OiA5OTk7XFxufVxcblxcbi5ucG0tc2NiLXdyYXAgYSB7XFxuICB0ZXh0LWRlY29yYXRpb246IG5vbmU7XFxuICBjb2xvcjogIzAwMDtcXG59XFxuLm5wbS1zY2Itd2hpdGVcXG4ubnBtLXNjYi13cmFwIGEge1xcbiAgY29sb3I6ICNmZmY7XFxufVxcblxcbi5ucG0tc2NiLWlubmVyIHtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHRvcDogLTEyMHB4OyBsZWZ0OiAwO1xcbiAgcGFkZGluZzogOHB4O1xcbiAgd2lkdGg6IDEwMCU7XFxuICBoZWlnaHQ6IDE1MHB4O1xcbiAgei1pbmRleDogMjtcXG4gIC13ZWJraXQtdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbiAgICAgLW1vei10cmFuc2l0aW9uOiB3aWR0aCAwLjVzIGN1YmljLWJlemllcigxLCAwLCAwLCAxKSwgdG9wIDAuNXM7XFxuICAgICAgLW1zLXRyYW5zaXRpb246IHdpZHRoIDAuNXMgY3ViaWMtYmV6aWVyKDEsIDAsIDAsIDEpLCB0b3AgMC41cztcXG4gICAgICAgLW8tdHJhbnNpdGlvbjogd2lkdGggMC41cyBjdWJpYy1iZXppZXIoMSwgMCwgMCwgMSksIHRvcCAwLjVzO1xcbiAgICAgICAgICB0cmFuc2l0aW9uOiB3aWR0aCAwLjVzIGN1YmljLWJlemllcigxLCAwLCAwLCAxKSwgdG9wIDAuNXM7XFxufVxcbi5ucG0tc2NiLXdyYXA6aG92ZXJcXG4ubnBtLXNjYi1pbm5lciB7XFxuICB0b3A6IDA7XFxufVxcblxcbi5ucG0tc2NiLWFydHdvcmsge1xcbiAgcG9zaXRpb246IGFic29sdXRlO1xcbiAgdG9wOiAxNnB4OyBsZWZ0OiAxNnB4O1xcbiAgd2lkdGg6IDEwNHB4OyBoZWlnaHQ6IDEwNHB4O1xcbiAgYm94LXNoYWRvdzogMCAwIDhweCAtM3B4ICMwMDA7XFxuICBvdXRsaW5lOiAxcHggc29saWQgcmdiYSgwLDAsMCwwLjEpO1xcbiAgei1pbmRleDogMjtcXG59XFxuLm5wbS1zY2Itd2hpdGVcXG4ubnBtLXNjYi1hcnR3b3JrIHtcXG4gIG91dGxpbmU6IDFweCBzb2xpZCByZ2JhKDI1NSwyNTUsMjU1LDAuMSk7XFxuICBib3gtc2hhZG93OiAwIDAgMTBweCAtMnB4IHJnYmEoMjU1LDI1NSwyNTUsMC45KTtcXG59XFxuXFxuLm5wbS1zY2ItaW5mbyB7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IDE2cHg7XFxuICBsZWZ0OiAxMjBweDtcXG4gIHdpZHRoOiAzMDBweDtcXG4gIHotaW5kZXg6IDE7XFxufVxcblxcbi5ucG0tc2NiLWluZm8gPiBhIHtcXG4gIGRpc3BsYXk6IGJsb2NrO1xcbn1cXG5cXG4ubnBtLXNjYi1ub3ctcGxheWluZyB7XFxuICBmb250LXNpemU6IDEycHg7XFxuICBsaW5lLWhlaWdodDogMTJweDtcXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcXG4gIHdpZHRoOiA1MDBweDtcXG4gIHotaW5kZXg6IDE7XFxuICBwYWRkaW5nOiAxNXB4IDA7XFxuICB0b3A6IDA7IGxlZnQ6IDEzOHB4O1xcbiAgb3BhY2l0eTogMTtcXG4gIC13ZWJraXQtdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgIC1tb3otdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAtbXMtdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAgLW8tdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG4gICAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjI1cztcXG59XFxuXFxuLm5wbS1zY2Itd3JhcDpob3Zlclxcbi5ucG0tc2NiLW5vdy1wbGF5aW5nIHtcXG4gIG9wYWNpdHk6IDA7XFxufVxcblxcbi5ucG0tc2NiLXdoaXRlXFxuLm5wbS1zY2Itbm93LXBsYXlpbmcge1xcbiAgY29sb3I6ICNmZmY7XFxufVxcbi5ucG0tc2NiLW5vdy1wbGF5aW5nID4gYSB7XFxuICBmb250LXdlaWdodDogYm9sZDtcXG59XFxuXFxuLm5wbS1zY2ItaW5mbyA+IGEgPiBwIHtcXG4gIG1hcmdpbjogMDtcXG4gIHBhZGRpbmctYm90dG9tOiAwLjI1ZW07XFxuICBsaW5lLWhlaWdodDogMS4zNWVtO1xcbiAgbWFyZ2luLWxlZnQ6IDFlbTtcXG4gIGZvbnQtc2l6ZTogMWVtO1xcbn1cXG5cXG4ubnBtLXNjYi10aXRsZSB7XFxuICBmb250LXdlaWdodDogYm9sZDtcXG59XFxuXFxuLm5wbS1zY2ItaWNvbiB7XFxuICBwb3NpdGlvbjogYWJzb2x1dGU7XFxuICB0b3A6IDEyMHB4O1xcbiAgcGFkZGluZy10b3A6IDAuNzVlbTtcXG4gIGxlZnQ6IDE2cHg7XFxufVxcblwiKSwgaW5zZXJ0ZWQgPSB0cnVlXG4gIGlmICghdGVtcGxhdGUpIHRlbXBsYXRlID0gbWluc3RhY2hlLmNvbXBpbGUoXCI8ZGl2IGNsYXNzPVxcXCJucG0tc2NiLXdyYXBcXFwiPlxcbiAgPGRpdiBjbGFzcz1cXFwibnBtLXNjYi1pbm5lclxcXCI+XFxuICAgIDxhIHRhcmdldD1cXFwiX2JsYW5rXFxcIiBocmVmPVxcXCJ7e3VybHMuc29uZ319XFxcIj5cXG4gICAgICA8aW1nIGNsYXNzPVxcXCJucG0tc2NiLWljb25cXFwiIHNyYz1cXFwie3tpY29ufX1cXFwiPlxcbiAgICAgIDxpbWcgY2xhc3M9XFxcIm5wbS1zY2ItYXJ0d29ya1xcXCIgc3JjPVxcXCJ7e2FydHdvcmt9fVxcXCI+XFxuICAgIDwvYT5cXG4gICAgPGRpdiBjbGFzcz1cXFwibnBtLXNjYi1pbmZvXFxcIj5cXG4gICAgICA8YSB0YXJnZXQ9XFxcIl9ibGFua1xcXCIgaHJlZj1cXFwie3t1cmxzLnNvbmd9fVxcXCI+XFxuICAgICAgICA8cCBjbGFzcz1cXFwibnBtLXNjYi10aXRsZVxcXCI+e3t0aXRsZX19PC9wPlxcbiAgICAgIDwvYT5cXG4gICAgICA8YSB0YXJnZXQ9XFxcIl9ibGFua1xcXCIgaHJlZj1cXFwie3t1cmxzLmFydGlzdH19XFxcIj5cXG4gICAgICAgIDxwIGNsYXNzPVxcXCJucG0tc2NiLWFydGlzdFxcXCI+e3thcnRpc3R9fTwvcD5cXG4gICAgICA8L2E+XFxuICAgIDwvZGl2PlxcbiAgPC9kaXY+XFxuICA8ZGl2IGNsYXNzPVxcXCJucG0tc2NiLW5vdy1wbGF5aW5nXFxcIj5cXG4gICAgTm93IFBsYXlpbmc6XFxuICAgIDxhIGhyZWY9XFxcInt7dXJscy5zb25nfX1cXFwiPnt7dGl0bGV9fTwvYT5cXG4gICAgYnlcXG4gICAgPGEgaHJlZj1cXFwie3t1cmxzLmFydGlzdH19XFxcIj57e2FydGlzdH19PC9hPlxcbiAgPC9kaXY+XFxuPC9kaXY+XFxuXCIpXG5cbiAgaWYgKCFnd2ZhZGRlZCAmJiBvcHRpb25zLmdldEZvbnRzKSB7XG4gICAgZm9udHMuYWRkKHsgJ09wZW4gU2Fucyc6IFszMDAsIDYwMF0gfSlcbiAgICBnd2ZhZGRlZCA9IHRydWVcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gIGNhbGxiYWNrID0gY2FsbGJhY2sgfHwgbm9vcFxuXG4gIHZhciBkaXYgICA9IG9wdGlvbnMuZWwgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgdmFyIGljb24gID0gISgnZGFyaycgaW4gb3B0aW9ucykgfHwgb3B0aW9ucy5kYXJrID8gJ2JsYWNrJyA6ICd3aGl0ZSdcbiAgdmFyIGlkICAgID0gb3B0aW9ucy5jbGllbnRfaWRcbiAgdmFyIHNvbmcgID0gb3B0aW9ucy5zb25nXG5cbiAgcmVzb2x2ZShpZCwgc29uZywgZnVuY3Rpb24oZXJyLCBqc29uKSB7XG4gICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycilcbiAgICBpZiAoanNvbi5raW5kICE9PSAndHJhY2snKSB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnc291bmRjbG91ZC1iYWRnZSBvbmx5IHN1cHBvcnRzIGluZGl2aWR1YWwgdHJhY2tzIGF0IHRoZSBtb21lbnQnXG4gICAgKVxuXG4gICAgZGl2LmNsYXNzTGlzdFtcbiAgICAgIGljb24gPT09ICdibGFjaycgPyAncmVtb3ZlJyA6ICdhZGQnXG4gICAgXSgnbnBtLXNjYi13aGl0ZScpXG5cbiAgICBkaXYuaW5uZXJIVE1MID0gdGVtcGxhdGUoe1xuICAgICAgICBhcnR3b3JrOiBqc29uLmFydHdvcmtfdXJsIHx8IGpzb24udXNlci5hdmF0YXJfdXJsXG4gICAgICAsIGFydGlzdDoganNvbi51c2VyLnVzZXJuYW1lXG4gICAgICAsIHRpdGxlOiBqc29uLnRpdGxlXG4gICAgICAsIGljb246IGljb25zW2ljb25dXG4gICAgICAsIHVybHM6IHtcbiAgICAgICAgICBzb25nOiBqc29uLnBlcm1hbGlua191cmxcbiAgICAgICAgLCBhcnRpc3Q6IGpzb24udXNlci5wZXJtYWxpbmtfdXJsXG4gICAgICB9XG4gICAgfSlcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KVxuXG4gICAgY2FsbGJhY2sobnVsbCwganNvbi5zdHJlYW1fdXJsICsgJz9jbGllbnRfaWQ9JyArIGlkLCBqc29uLCBkaXYpXG4gIH0pXG5cbiAgcmV0dXJuIGRpdlxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBhc1N0cmluZ1xubW9kdWxlLmV4cG9ydHMuYWRkID0gYXBwZW5kXG5cbmZ1bmN0aW9uIGFzU3RyaW5nKGZvbnRzKSB7XG4gIHZhciBocmVmID0gZ2V0SHJlZihmb250cylcbiAgcmV0dXJuICc8bGluayBocmVmPVwiJyArIGhyZWYgKyAnXCIgcmVsPVwic3R5bGVzaGVldFwiIHR5cGU9XCJ0ZXh0L2Nzc1wiPidcbn1cblxuZnVuY3Rpb24gYXNFbGVtZW50KGZvbnRzKSB7XG4gIHZhciBocmVmID0gZ2V0SHJlZihmb250cylcbiAgdmFyIGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJylcbiAgbGluay5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKVxuICBsaW5rLnNldEF0dHJpYnV0ZSgncmVsJywgJ3N0eWxlc2hlZXQnKVxuICBsaW5rLnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2NzcycpXG4gIHJldHVybiBsaW5rXG59XG5cbmZ1bmN0aW9uIGdldEhyZWYoZm9udHMpIHtcbiAgdmFyIGZhbWlseSA9IE9iamVjdC5rZXlzKGZvbnRzKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBkZXRhaWxzID0gZm9udHNbbmFtZV1cbiAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC9cXHMrLywgJysnKVxuICAgIHJldHVybiB0eXBlb2YgZGV0YWlscyA9PT0gJ2Jvb2xlYW4nXG4gICAgICA/IG5hbWVcbiAgICAgIDogbmFtZSArICc6JyArIG1ha2VBcnJheShkZXRhaWxzKS5qb2luKCcsJylcbiAgfSkuam9pbignfCcpXG5cbiAgcmV0dXJuICdodHRwOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzP2ZhbWlseT0nICsgZmFtaWx5XG59XG5cbmZ1bmN0aW9uIGFwcGVuZChmb250cykge1xuICB2YXIgbGluayA9IGFzRWxlbWVudChmb250cylcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChsaW5rKVxuICByZXR1cm4gbGlua1xufVxuXG5mdW5jdGlvbiBtYWtlQXJyYXkoYXJyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFycikgPyBhcnIgOiBbYXJyXVxufVxuIiwidmFyIGluc2VydGVkID0gW107XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNzcykge1xuICAgIGlmIChpbnNlcnRlZC5pbmRleE9mKGNzcykgPj0gMCkgcmV0dXJuO1xuICAgIGluc2VydGVkLnB1c2goY3NzKTtcbiAgICBcbiAgICB2YXIgZWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gICAgdmFyIHRleHQgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpO1xuICAgIGVsZW0uYXBwZW5kQ2hpbGQodGV4dCk7XG4gICAgXG4gICAgaWYgKGRvY3VtZW50LmhlYWQuY2hpbGROb2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgZG9jdW1lbnQuaGVhZC5pbnNlcnRCZWZvcmUoZWxlbSwgZG9jdW1lbnQuaGVhZC5jaGlsZE5vZGVzWzBdKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZWxlbSk7XG4gICAgfVxufTtcbiIsIlxuLyoqXG4gKiBFeHBvc2UgYHJlbmRlcigpYC5gXG4gKi9cblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gcmVuZGVyO1xuXG4vKipcbiAqIEV4cG9zZSBgY29tcGlsZSgpYC5cbiAqL1xuXG5leHBvcnRzLmNvbXBpbGUgPSBjb21waWxlO1xuXG4vKipcbiAqIFJlbmRlciB0aGUgZ2l2ZW4gbXVzdGFjaGUgYHN0cmAgd2l0aCBgb2JqYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHJlbmRlcihzdHIsIG9iaikge1xuICBvYmogPSBvYmogfHwge307XG4gIHZhciBmbiA9IGNvbXBpbGUoc3RyKTtcbiAgcmV0dXJuIGZuKG9iaik7XG59XG5cbi8qKlxuICogQ29tcGlsZSB0aGUgZ2l2ZW4gYHN0cmAgdG8gYSBgRnVuY3Rpb25gLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlKHN0cikge1xuICB2YXIganMgPSBbXTtcbiAgdmFyIHRva3MgPSBwYXJzZShzdHIpO1xuICB2YXIgdG9rO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rcy5sZW5ndGg7ICsraSkge1xuICAgIHRvayA9IHRva3NbaV07XG4gICAgaWYgKGkgJSAyID09IDApIHtcbiAgICAgIGpzLnB1c2goJ1wiJyArIHRvay5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJykgKyAnXCInKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoICh0b2tbMF0pIHtcbiAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGpzLnB1c2goJykgKyAnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGFzc2VydFByb3BlcnR5KHRvayk7XG4gICAgICAgICAganMucHVzaCgnICsgc2VjdGlvbihvYmosIFwiJyArIHRvayArICdcIiwgdHJ1ZSwgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJyMnOlxuICAgICAgICAgIHRvayA9IHRvay5zbGljZSgxKTtcbiAgICAgICAgICBhc3NlcnRQcm9wZXJ0eSh0b2spO1xuICAgICAgICAgIGpzLnB1c2goJyArIHNlY3Rpb24ob2JqLCBcIicgKyB0b2sgKyAnXCIsIGZhbHNlLCAnKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnISc6XG4gICAgICAgICAgdG9rID0gdG9rLnNsaWNlKDEpO1xuICAgICAgICAgIGFzc2VydFByb3BlcnR5KHRvayk7XG4gICAgICAgICAganMucHVzaCgnICsgb2JqLicgKyB0b2sgKyAnICsgJyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYXNzZXJ0UHJvcGVydHkodG9rKTtcbiAgICAgICAgICBqcy5wdXNoKCcgKyBlc2NhcGUob2JqLicgKyB0b2sgKyAnKSArICcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGpzID0gJ1xcbidcbiAgICArIGluZGVudChlc2NhcGUudG9TdHJpbmcoKSkgKyAnO1xcblxcbidcbiAgICArIGluZGVudChzZWN0aW9uLnRvU3RyaW5nKCkpICsgJztcXG5cXG4nXG4gICAgKyAnICByZXR1cm4gJyArIGpzLmpvaW4oJycpLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKTtcblxuICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdvYmonLCBqcyk7XG59XG5cbi8qKlxuICogQXNzZXJ0IHRoYXQgYHByb3BgIGlzIGEgdmFsaWQgcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGFzc2VydFByb3BlcnR5KHByb3ApIHtcbiAgaWYgKCFwcm9wLm1hdGNoKC9eW1xcdy5dKyQvKSkgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHByb3BlcnR5IFwiJyArIHByb3AgKyAnXCInKTtcbn1cblxuLyoqXG4gKiBQYXJzZSBgc3RyYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICByZXR1cm4gc3RyLnNwbGl0KC9cXHtcXHt8XFx9XFx9Lyk7XG59XG5cbi8qKlxuICogSW5kZW50IGBzdHJgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGluZGVudChzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eL2dtLCAnICAnKTtcbn1cblxuLyoqXG4gKiBTZWN0aW9uIGhhbmRsZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJvcFxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtCb29sZWFufSBuZWdhdGVcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHNlY3Rpb24ob2JqLCBwcm9wLCBuZWdhdGUsIHN0cikge1xuICB2YXIgdmFsID0gb2JqW3Byb3BdO1xuICBpZiAoJ2Z1bmN0aW9uJyA9PSB0eXBlb2YgdmFsKSByZXR1cm4gdmFsLmNhbGwob2JqLCBzdHIpO1xuICBpZiAobmVnYXRlKSB2YWwgPSAhdmFsO1xuICBpZiAodmFsKSByZXR1cm4gc3RyO1xuICByZXR1cm4gJyc7XG59XG5cbi8qKlxuICogRXNjYXBlIHRoZSBnaXZlbiBgaHRtbGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGh0bWxcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZShodG1sKSB7XG4gIHJldHVybiBTdHJpbmcoaHRtbClcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn1cbiIsInZhciBxcyAgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpXG52YXIgeGhyID0gcmVxdWlyZSgneGhyJylcblxubW9kdWxlLmV4cG9ydHMgPSByZXNvbHZlXG5cbmZ1bmN0aW9uIHJlc29sdmUoaWQsIGdvYWwsIGNhbGxiYWNrKSB7XG4gIHZhciB1cmkgPSAnaHR0cDovL2FwaS5zb3VuZGNsb3VkLmNvbS9yZXNvbHZlLmpzb24/JyArIHFzLnN0cmluZ2lmeSh7XG4gICAgICB1cmw6IGdvYWxcbiAgICAsIGNsaWVudF9pZDogaWRcbiAgfSlcblxuICB4aHIoe1xuICAgICAgdXJpOiB1cmlcbiAgICAsIG1ldGhvZDogJ0dFVCdcbiAgfSwgZnVuY3Rpb24oZXJyLCByZXMsIGJvZHkpIHtcbiAgICBpZiAoZXJyKSByZXR1cm4gY2FsbGJhY2soZXJyKVxuICAgIHRyeSB7XG4gICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgIH0gY2F0Y2goZSkge1xuICAgICAgcmV0dXJuIGNhbGxiYWNrKGUpXG4gICAgfVxuICAgIGlmIChib2R5LmVycm9ycykgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcihcbiAgICAgIGJvZHkuZXJyb3JzWzBdLmVycm9yX21lc3NhZ2VcbiAgICApKVxuICAgIHJldHVybiBjYWxsYmFjayhudWxsLCBib2R5KVxuICB9KVxufVxuIiwidmFyIHdpbmRvdyA9IHJlcXVpcmUoXCJnbG9iYWwvd2luZG93XCIpXG52YXIgb25jZSA9IHJlcXVpcmUoXCJvbmNlXCIpXG5cbnZhciBtZXNzYWdlcyA9IHtcbiAgICBcIjBcIjogXCJJbnRlcm5hbCBYTUxIdHRwUmVxdWVzdCBFcnJvclwiLFxuICAgIFwiNFwiOiBcIjR4eCBDbGllbnQgRXJyb3JcIixcbiAgICBcIjVcIjogXCI1eHggU2VydmVyIEVycm9yXCJcbn1cblxudmFyIFhIUiA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCB8fCBub29wXG52YXIgWERSID0gXCJ3aXRoQ3JlZGVudGlhbHNcIiBpbiAobmV3IFhIUigpKSA/XG4gICAgICAgIHdpbmRvdy5YTUxIdHRwUmVxdWVzdCA6IHdpbmRvdy5YRG9tYWluUmVxdWVzdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVhIUlxuXG5mdW5jdGlvbiBjcmVhdGVYSFIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgb3B0aW9ucyA9IHsgdXJpOiBvcHRpb25zIH1cbiAgICB9XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIGNhbGxiYWNrID0gb25jZShjYWxsYmFjaylcblxuICAgIHZhciB4aHJcblxuICAgIGlmIChvcHRpb25zLmNvcnMpIHtcbiAgICAgICAgeGhyID0gbmV3IFhEUigpXG4gICAgfSBlbHNlIHtcbiAgICAgICAgeGhyID0gbmV3IFhIUigpXG4gICAgfVxuXG4gICAgdmFyIHVyaSA9IHhoci51cmwgPSBvcHRpb25zLnVyaVxuICAgIHZhciBtZXRob2QgPSB4aHIubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgXCJHRVRcIlxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5IHx8IG9wdGlvbnMuZGF0YVxuICAgIHZhciBoZWFkZXJzID0geGhyLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgfHwge31cbiAgICB2YXIgaXNKc29uID0gZmFsc2VcblxuICAgIGlmIChcImpzb25cIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIGlzSnNvbiA9IHRydWVcbiAgICAgICAgaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSA9IFwiYXBwbGljYXRpb24vanNvblwiXG4gICAgICAgIGJvZHkgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmpzb24pXG4gICAgfVxuXG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IHJlYWR5c3RhdGVjaGFuZ2VcbiAgICB4aHIub25sb2FkID0gbG9hZFxuICAgIHhoci5vbmVycm9yID0gZXJyb3JcbiAgICAvLyBJRTkgbXVzdCBoYXZlIG9ucHJvZ3Jlc3MgYmUgc2V0IHRvIGEgdW5pcXVlIGZ1bmN0aW9uLlxuICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJRSBtdXN0IGRpZVxuICAgIH1cbiAgICAvLyBoYXRlIElFXG4gICAgeGhyLm9udGltZW91dCA9IG5vb3BcbiAgICB4aHIub3BlbihtZXRob2QsIHVyaSlcbiAgICBpZiAob3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgfVxuICAgIHhoci50aW1lb3V0ID0gXCJ0aW1lb3V0XCIgaW4gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dCA6IDUwMDBcblxuICAgIGlmICggeGhyLnNldFJlcXVlc3RIZWFkZXIpIHtcbiAgICAgICAgT2JqZWN0LmtleXMoaGVhZGVycykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGhlYWRlcnNba2V5XSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICB4aHIuc2VuZChib2R5KVxuXG4gICAgcmV0dXJuIHhoclxuXG4gICAgZnVuY3Rpb24gcmVhZHlzdGF0ZWNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBsb2FkKClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWQoKSB7XG4gICAgICAgIHZhciBlcnJvciA9IG51bGxcbiAgICAgICAgdmFyIHN0YXR1cyA9IHhoci5zdGF0dXNDb2RlID0geGhyLnN0YXR1c1xuICAgICAgICB2YXIgYm9keSA9IHhoci5ib2R5ID0geGhyLnJlc3BvbnNlIHx8XG4gICAgICAgICAgICB4aHIucmVzcG9uc2VUZXh0IHx8IHhoci5yZXNwb25zZVhNTFxuXG4gICAgICAgIGlmIChzdGF0dXMgPT09IDAgfHwgKHN0YXR1cyA+PSA0MDAgJiYgc3RhdHVzIDwgNjAwKSkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSB4aHIucmVzcG9uc2VUZXh0IHx8XG4gICAgICAgICAgICAgICAgbWVzc2FnZXNbU3RyaW5nKHhoci5zdGF0dXMpLmNoYXJBdCgwKV1cbiAgICAgICAgICAgIGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpXG5cbiAgICAgICAgICAgIGVycm9yLnN0YXR1c0NvZGUgPSB4aHIuc3RhdHVzXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNKc29uKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGJvZHkgPSB4aHIuYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cblxuICAgICAgICBjYWxsYmFjayhlcnJvciwgeGhyLCBib2R5KVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVycm9yKGV2dCkge1xuICAgICAgICBjYWxsYmFjayhldnQsIHhocilcbiAgICB9XG59XG5cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gd2luZG93XG59IGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGdsb2JhbFxufSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHt9XG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gb25jZVxuXG5vbmNlLnByb3RvID0gb25jZShmdW5jdGlvbiAoKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShGdW5jdGlvbi5wcm90b3R5cGUsICdvbmNlJywge1xuICAgIHZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gb25jZSh0aGlzKVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59KVxuXG5mdW5jdGlvbiBvbmNlIChmbikge1xuICB2YXIgY2FsbGVkID0gZmFsc2VcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoY2FsbGVkKSByZXR1cm5cbiAgICBjYWxsZWQgPSB0cnVlXG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgfVxufVxuIiwidmFyIGNyZWF0ZVR5cGVzID0gcmVxdWlyZSgnLi90eXBlcycpXG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihUSFJFRSkge1xuXG4gICAgdmFyIHR5cGVzID0gY3JlYXRlVHlwZXMoVEhSRUUpIFxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIGNyZWF0ZShnbFNoYWRlciwgb3B0cykge1xuICAgICAgICBvcHRzID0gb3B0c3x8e31cblxuICAgICAgICBpZiAodHlwZW9mIG9wdHMuY29sb3JzID09PSAnc3RyaW5nJylcbiAgICAgICAgICAgIG9wdHMuY29sb3JzID0gW29wdHMuY29sb3JzXVxuICAgICAgICBcbiAgICAgICAgdmFyIHRVbmlmb3JtcyA9IHR5cGVzKCBnbFNoYWRlci51bmlmb3Jtcywgb3B0cy5jb2xvcnMgKVxuICAgICAgICB2YXIgdEF0dHJpYnMgPSB0eXBlcyggZ2xTaGFkZXIuYXR0cmlidXRlcywgb3B0cy5jb2xvcnMgKVxuICAgICAgICAgICAgXG4gICAgICAgIC8vY2xlYXIgdGhlIGF0dHJpYnV0ZSBhcnJheXNcbiAgICAgICAgZm9yICh2YXIgayBpbiB0QXR0cmlicykge1xuICAgICAgICAgICAgdEF0dHJpYnNba10udmFsdWUgPSBbXVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZlcnRleFNoYWRlcjogZ2xTaGFkZXIudmVydGV4LFxuICAgICAgICAgICAgZnJhZ21lbnRTaGFkZXI6IGdsU2hhZGVyLmZyYWdtZW50LFxuICAgICAgICAgICAgdW5pZm9ybXM6IHRVbmlmb3JtcyxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHRBdHRyaWJzXG4gICAgICAgIH1cbiAgICB9XG59IiwidmFyIHR5cGVNYXAgPSB7XG4gICAgJ2ludCc6ICdpJyxcbiAgICAnZmxvYXQnOiAnZicsXG4gICAgJ2l2ZWMyJzogJ2kyJyxcbiAgICAnaXZlYzMnOiAnaTMnLFxuICAgICdpdmVjNCc6ICdpNCcsXG4gICAgJ3ZlYzInOiAndjInLFxuICAgICd2ZWMzJzogJ3YzJyxcbiAgICAndmVjNCc6ICd2NCcsXG4gICAgJ21hdDQnOiAnbTQnLFxuICAgICdtYXQzJzogJ20zJyxcbiAgICAnc2FtcGxlcjJEJzogJ3QnLFxuICAgICdzYW1wbGVyQ3ViZSc6ICd0J1xufVxuXG5mdW5jdGlvbiBjcmVhdGUoVEhSRUUpIHtcbiAgICBmdW5jdGlvbiBuZXdJbnN0YW5jZSh0eXBlLCBpc0FycmF5KSB7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnZmxvYXQnOiBcbiAgICAgICAgICAgIGNhc2UgJ2ludCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDBcbiAgICAgICAgICAgIGNhc2UgJ3ZlYzInOlxuICAgICAgICAgICAgY2FzZSAnaXZlYzInOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVEhSRUUuVmVjdG9yMigpXG4gICAgICAgICAgICBjYXNlICd2ZWMzJzpcbiAgICAgICAgICAgIGNhc2UgJ2l2ZWMzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFRIUkVFLlZlY3RvcjMoKVxuICAgICAgICAgICAgY2FzZSAndmVjNCc6XG4gICAgICAgICAgICBjYXNlICdpdmVjNCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBUSFJFRS5WZWN0b3I0KClcbiAgICAgICAgICAgIGNhc2UgJ21hdDQnOlxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVEhSRUUuTWF0cml4NCgpXG4gICAgICAgICAgICBjYXNlICdtYXQzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFRIUkVFLk1hdHJpeDMoKVxuICAgICAgICAgICAgY2FzZSAnc2FtcGxlckN1YmUnOlxuICAgICAgICAgICAgY2FzZSAnc2FtcGxlcjJEJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFRIUkVFLlRleHR1cmUoKVxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkZWZhdWx0VmFsdWUodHlwZSwgaXNBcnJheSwgYXJyYXlMZW4pIHtcbiAgICAgICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgICAgICAgIC8vVGhyZWVKUyBmbGF0dGVucyBpdmVjMyB0eXBlXG4gICAgICAgICAgICAvLyh3ZSBkb24ndCBzdXBwb3J0ICdmdicgdHlwZSlcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnaXZlYzMnKVxuICAgICAgICAgICAgICAgIGFycmF5TGVuICo9IDNcbiAgICAgICAgICAgIHZhciBhciA9IG5ldyBBcnJheShhcnJheUxlbilcbiAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaTxhci5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgICAgICBhcltpXSA9IG5ld0luc3RhbmNlKHR5cGUsIGlzQXJyYXkpXG4gICAgICAgICAgICByZXR1cm4gYXJcbiAgICAgICAgfSAgXG4gICAgICAgIHJldHVybiBuZXdJbnN0YW5jZSh0eXBlKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFR5cGUodHlwZSwgaXNBcnJheSkge1xuICAgICAgICBpZiAoIWlzQXJyYXkpXG4gICAgICAgICAgICByZXR1cm4gdHlwZU1hcFt0eXBlXVxuXG4gICAgICAgIGlmICh0eXBlID09PSAnaW50JylcbiAgICAgICAgICAgIHJldHVybiAnaXYxJ1xuICAgICAgICBlbHNlIGlmICh0eXBlID09PSAnZmxvYXQnKVxuICAgICAgICAgICAgcmV0dXJuICdmdjEnXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiB0eXBlTWFwW3R5cGVdKyd2J1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbiBzZXR1cFVuaWZvcm1zKGdsVW5pZm9ybXMsIGNvbG9yTmFtZXMpIHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGNvbG9yTmFtZXMpKVxuICAgICAgICAgICAgY29sb3JOYW1lcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcblxuICAgICAgICB2YXIgcmVzdWx0ID0ge31cbiAgICAgICAgdmFyIGFycmF5cyA9IHt9XG5cbiAgICAgICAgLy9tYXAgdW5pZm9ybSB0eXBlc1xuICAgICAgICBnbFVuaWZvcm1zLmZvckVhY2goZnVuY3Rpb24odW5pZm9ybSkge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSB1bmlmb3JtLm5hbWVcbiAgICAgICAgICAgIHZhciBpc0FycmF5ID0gLyguKylcXFtbMC05XStcXF0vLmV4ZWMobmFtZSlcblxuICAgICAgICAgICAgLy9zcGVjaWFsIGNhc2U6IGNvbG9ycy4uLlxuICAgICAgICAgICAgaWYgKGNvbG9yTmFtZXMgJiYgY29sb3JOYW1lcy5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJhcnJheSBvZiBjb2xvciB1bmlmb3JtcyBub3Qgc3VwcG9ydGVkXCIpXG4gICAgICAgICAgICAgICAgaWYgKHVuaWZvcm0udHlwZSAhPT0gJ3ZlYzMnKVxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaHJlZUpTIGV4cGVjdHMgdmVjMyBmb3IgQ29sb3IgdW5pZm9ybXNcIikgXG4gICAgICAgICAgICAgICAgcmVzdWx0W25hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYycsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gaXNBcnJheVsxXVxuICAgICAgICAgICAgICAgIGlmIChuYW1lIGluIGFycmF5cykgXG4gICAgICAgICAgICAgICAgICAgIGFycmF5c1tuYW1lXS5jb3VudCsrIFxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlzW25hbWVdID0geyBjb3VudDogMSwgdHlwZTogdW5pZm9ybS50eXBlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdFtuYW1lXSA9IHsgXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0VHlwZSh1bmlmb3JtLnR5cGUsIGlzQXJyYXkpLCBcbiAgICAgICAgICAgICAgICB2YWx1ZTogaXNBcnJheSA/IG51bGwgOiBkZWZhdWx0VmFsdWUodW5pZm9ybS50eXBlKSBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICAvL25vdyBjbGVhbiB1cCBhbnkgYXJyYXkgdmFsdWVzXG4gICAgICAgIGZvciAodmFyIGsgaW4gcmVzdWx0KSB7XG4gICAgICAgICAgICB2YXIgdSA9IHJlc3VsdFtrXVxuICAgICAgICAgICAgaWYgKGsgaW4gYXJyYXlzKSB7IC8vaXMgYW4gYXJyYXlcbiAgICAgICAgICAgICAgICB2YXIgYSA9IGFycmF5c1trXVxuICAgICAgICAgICAgICAgIHUudmFsdWUgPSBkZWZhdWx0VmFsdWUoYS50eXBlLCB0cnVlLCBhLmNvdW50KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlIiwiLy8gICAgIFVuZGVyc2NvcmUuanMgMS43LjBcbi8vICAgICBodHRwOi8vdW5kZXJzY29yZWpzLm9yZ1xuLy8gICAgIChjKSAyMDA5LTIwMTQgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbi8vICAgICBVbmRlcnNjb3JlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgLy8gQmFzZWxpbmUgc2V0dXBcbiAgLy8gLS0tLS0tLS0tLS0tLS1cblxuICAvLyBFc3RhYmxpc2ggdGhlIHJvb3Qgb2JqZWN0LCBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGV4cG9ydHNgIG9uIHRoZSBzZXJ2ZXIuXG4gIHZhciByb290ID0gdGhpcztcblxuICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgYF9gIHZhcmlhYmxlLlxuICB2YXIgcHJldmlvdXNVbmRlcnNjb3JlID0gcm9vdC5fO1xuXG4gIC8vIFNhdmUgYnl0ZXMgaW4gdGhlIG1pbmlmaWVkIChidXQgbm90IGd6aXBwZWQpIHZlcnNpb246XG4gIHZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlLCBPYmpQcm90byA9IE9iamVjdC5wcm90b3R5cGUsIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyXG4gICAgcHVzaCAgICAgICAgICAgICA9IEFycmF5UHJvdG8ucHVzaCxcbiAgICBzbGljZSAgICAgICAgICAgID0gQXJyYXlQcm90by5zbGljZSxcbiAgICBjb25jYXQgICAgICAgICAgID0gQXJyYXlQcm90by5jb25jYXQsXG4gICAgdG9TdHJpbmcgICAgICAgICA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgIGhhc093blByb3BlcnR5ICAgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBBbGwgKipFQ01BU2NyaXB0IDUqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhclxuICAgIG5hdGl2ZUlzQXJyYXkgICAgICA9IEFycmF5LmlzQXJyYXksXG4gICAgbmF0aXZlS2V5cyAgICAgICAgID0gT2JqZWN0LmtleXMsXG4gICAgbmF0aXZlQmluZCAgICAgICAgID0gRnVuY1Byb3RvLmJpbmQ7XG5cbiAgLy8gQ3JlYXRlIGEgc2FmZSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciB1c2UgYmVsb3cuXG4gIHZhciBfID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIF8pIHJldHVybiBvYmo7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIF8pKSByZXR1cm4gbmV3IF8ob2JqKTtcbiAgICB0aGlzLl93cmFwcGVkID0gb2JqO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbiAgLy8gdGhlIGJyb3dzZXIsIGFkZCBgX2AgYXMgYSBnbG9iYWwgb2JqZWN0LlxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBfO1xuICAgIH1cbiAgICBleHBvcnRzLl8gPSBfO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuXyA9IF87XG4gIH1cblxuICAvLyBDdXJyZW50IHZlcnNpb24uXG4gIF8uVkVSU0lPTiA9ICcxLjcuMCc7XG5cbiAgLy8gSW50ZXJuYWwgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIGVmZmljaWVudCAoZm9yIGN1cnJlbnQgZW5naW5lcykgdmVyc2lvblxuICAvLyBvZiB0aGUgcGFzc2VkLWluIGNhbGxiYWNrLCB0byBiZSByZXBlYXRlZGx5IGFwcGxpZWQgaW4gb3RoZXIgVW5kZXJzY29yZVxuICAvLyBmdW5jdGlvbnMuXG4gIHZhciBjcmVhdGVDYWxsYmFjayA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKGNvbnRleHQgPT09IHZvaWQgMCkgcmV0dXJuIGZ1bmM7XG4gICAgc3dpdGNoIChhcmdDb3VudCA9PSBudWxsID8gMyA6IGFyZ0NvdW50KSB7XG4gICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgb3RoZXIpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgb3RoZXIpO1xuICAgICAgfTtcbiAgICAgIGNhc2UgMzogcmV0dXJuIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XG4gICAgICB9O1xuICAgICAgY2FzZSA0OiByZXR1cm4gZnVuY3Rpb24oYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEEgbW9zdGx5LWludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGNhbGxiYWNrcyB0aGF0IGNhbiBiZSBhcHBsaWVkXG4gIC8vIHRvIGVhY2ggZWxlbWVudCBpbiBhIGNvbGxlY3Rpb24sIHJldHVybmluZyB0aGUgZGVzaXJlZCByZXN1bHQg4oCUIGVpdGhlclxuICAvLyBpZGVudGl0eSwgYW4gYXJiaXRyYXJ5IGNhbGxiYWNrLCBhIHByb3BlcnR5IG1hdGNoZXIsIG9yIGEgcHJvcGVydHkgYWNjZXNzb3IuXG4gIF8uaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpIHtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkgcmV0dXJuIF8uaWRlbnRpdHk7XG4gICAgaWYgKF8uaXNGdW5jdGlvbih2YWx1ZSkpIHJldHVybiBjcmVhdGVDYWxsYmFjayh2YWx1ZSwgY29udGV4dCwgYXJnQ291bnQpO1xuICAgIGlmIChfLmlzT2JqZWN0KHZhbHVlKSkgcmV0dXJuIF8ubWF0Y2hlcyh2YWx1ZSk7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xuICB9O1xuXG4gIC8vIENvbGxlY3Rpb24gRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lLCBhbiBgZWFjaGAgaW1wbGVtZW50YXRpb24sIGFrYSBgZm9yRWFjaGAuXG4gIC8vIEhhbmRsZXMgcmF3IG9iamVjdHMgaW4gYWRkaXRpb24gdG8gYXJyYXktbGlrZXMuIFRyZWF0cyBhbGxcbiAgLy8gc3BhcnNlIGFycmF5LWxpa2VzIGFzIGlmIHRoZXkgd2VyZSBkZW5zZS5cbiAgXy5lYWNoID0gXy5mb3JFYWNoID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIG9iajtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgaSwgbGVuZ3RoID0gb2JqLmxlbmd0aDtcbiAgICBpZiAobGVuZ3RoID09PSArbGVuZ3RoKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW2ldLCBpLCBvYmopO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgZm9yIChpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVyYXRlZShvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaik7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRlZSB0byBlYWNoIGVsZW1lbnQuXG4gIF8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpLFxuICAgICAgICBjdXJyZW50S2V5O1xuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIHJlc3VsdHNbaW5kZXhdID0gaXRlcmF0ZWUob2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICB2YXIgcmVkdWNlRXJyb3IgPSAnUmVkdWNlIG9mIGVtcHR5IGFycmF5IHdpdGggbm8gaW5pdGlhbCB2YWx1ZSc7XG5cbiAgLy8gKipSZWR1Y2UqKiBidWlsZHMgdXAgYSBzaW5nbGUgcmVzdWx0IGZyb20gYSBsaXN0IG9mIHZhbHVlcywgYWthIGBpbmplY3RgLFxuICAvLyBvciBgZm9sZGxgLlxuICBfLnJlZHVjZSA9IF8uZm9sZGwgPSBfLmluamVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIG1lbW8sIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBpbmRleCA9IDAsIGN1cnJlbnRLZXk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICBpZiAoIWxlbmd0aCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgICBtZW1vID0gb2JqW2tleXMgPyBrZXlzW2luZGV4KytdIDogaW5kZXgrK107XG4gICAgfVxuICAgIGZvciAoOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgbWVtbyA9IGl0ZXJhdGVlKG1lbW8sIG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lbW87XG4gIH07XG5cbiAgLy8gVGhlIHJpZ2h0LWFzc29jaWF0aXZlIHZlcnNpb24gb2YgcmVkdWNlLCBhbHNvIGtub3duIGFzIGBmb2xkcmAuXG4gIF8ucmVkdWNlUmlnaHQgPSBfLmZvbGRyID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgbWVtbywgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCwgNCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArIG9iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGluZGV4ID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIGN1cnJlbnRLZXk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICBpZiAoIWluZGV4KSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICAgIG1lbW8gPSBvYmpba2V5cyA/IGtleXNbLS1pbmRleF0gOiAtLWluZGV4XTtcbiAgICB9XG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIG1lbW8gPSBpdGVyYXRlZShtZW1vLCBvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgZmlyc3QgdmFsdWUgd2hpY2ggcGFzc2VzIGEgdHJ1dGggdGVzdC4gQWxpYXNlZCBhcyBgZGV0ZWN0YC5cbiAgXy5maW5kID0gXy5kZXRlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIF8uc29tZShvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZSh2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIEFsaWFzZWQgYXMgYHNlbGVjdGAuXG4gIF8uZmlsdGVyID0gXy5zZWxlY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocHJlZGljYXRlKHZhbHVlLCBpbmRleCwgbGlzdCkpIHJlc3VsdHMucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgZm9yIHdoaWNoIGEgdHJ1dGggdGVzdCBmYWlscy5cbiAgXy5yZWplY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubmVnYXRlKF8uaXRlcmF0ZWUocHJlZGljYXRlKSksIGNvbnRleHQpO1xuICB9O1xuXG4gIC8vIERldGVybWluZSB3aGV0aGVyIGFsbCBvZiB0aGUgZWxlbWVudHMgbWF0Y2ggYSB0cnV0aCB0ZXN0LlxuICAvLyBBbGlhc2VkIGFzIGBhbGxgLlxuICBfLmV2ZXJ5ID0gXy5hbGwgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBpbmRleCwgY3VycmVudEtleTtcbiAgICBmb3IgKGluZGV4ID0gMDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIGlmICghcHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgYXQgbGVhc3Qgb25lIGVsZW1lbnQgaW4gdGhlIG9iamVjdCBtYXRjaGVzIGEgdHJ1dGggdGVzdC5cbiAgLy8gQWxpYXNlZCBhcyBgYW55YC5cbiAgXy5zb21lID0gXy5hbnkgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBpZiAocHJlZGljYXRlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIGFycmF5IG9yIG9iamVjdCBjb250YWlucyBhIGdpdmVuIHZhbHVlICh1c2luZyBgPT09YCkuXG4gIC8vIEFsaWFzZWQgYXMgYGluY2x1ZGVgLlxuICBfLmNvbnRhaW5zID0gXy5pbmNsdWRlID0gZnVuY3Rpb24ob2JqLCB0YXJnZXQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBpZiAob2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGgpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgcmV0dXJuIF8uaW5kZXhPZihvYmosIHRhcmdldCkgPj0gMDtcbiAgfTtcblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgXy5pbnZva2UgPSBmdW5jdGlvbihvYmosIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHZhciBpc0Z1bmMgPSBfLmlzRnVuY3Rpb24obWV0aG9kKTtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIChpc0Z1bmMgPyBtZXRob2QgOiB2YWx1ZVttZXRob2RdKS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgXy5wbHVjayA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaWx0ZXJgOiBzZWxlY3Rpbmcgb25seSBvYmplY3RzXG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8ud2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0IG9iamVjdFxuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLmZpbmRXaGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy5maW5kKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtYXhpbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICBfLm1heCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0gLUluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSAtSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlID4gcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA+IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gLUluZmluaXR5ICYmIHJlc3VsdCA9PT0gLUluZmluaXR5KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5taW4gPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IEluZmluaXR5LCBsYXN0Q29tcHV0ZWQgPSBJbmZpbml0eSxcbiAgICAgICAgdmFsdWUsIGNvbXB1dGVkO1xuICAgIGlmIChpdGVyYXRlZSA9PSBudWxsICYmIG9iaiAhPSBudWxsKSB7XG4gICAgICBvYmogPSBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhbHVlID0gb2JqW2ldO1xuICAgICAgICBpZiAodmFsdWUgPCByZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICAgIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgICAgaWYgKGNvbXB1dGVkIDwgbGFzdENvbXB1dGVkIHx8IGNvbXB1dGVkID09PSBJbmZpbml0eSAmJiByZXN1bHQgPT09IEluZmluaXR5KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgICAgbGFzdENvbXB1dGVkID0gY29tcHV0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFNodWZmbGUgYSBjb2xsZWN0aW9uLCB1c2luZyB0aGUgbW9kZXJuIHZlcnNpb24gb2YgdGhlXG4gIC8vIFtGaXNoZXItWWF0ZXMgc2h1ZmZsZV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXLigJNZYXRlc19zaHVmZmxlKS5cbiAgXy5zaHVmZmxlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHNldCA9IG9iaiAmJiBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iaiA6IF8udmFsdWVzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IHNldC5sZW5ndGg7XG4gICAgdmFyIHNodWZmbGVkID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDAsIHJhbmQ7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICByYW5kID0gXy5yYW5kb20oMCwgaW5kZXgpO1xuICAgICAgaWYgKHJhbmQgIT09IGluZGV4KSBzaHVmZmxlZFtpbmRleF0gPSBzaHVmZmxlZFtyYW5kXTtcbiAgICAgIHNodWZmbGVkW3JhbmRdID0gc2V0W2luZGV4XTtcbiAgICB9XG4gICAgcmV0dXJuIHNodWZmbGVkO1xuICB9O1xuXG4gIC8vIFNhbXBsZSAqKm4qKiByYW5kb20gdmFsdWVzIGZyb20gYSBjb2xsZWN0aW9uLlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBtYXBgLlxuICBfLnNhbXBsZSA9IGZ1bmN0aW9uKG9iaiwgbiwgZ3VhcmQpIHtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSB7XG4gICAgICBpZiAob2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGgpIG9iaiA9IF8udmFsdWVzKG9iaik7XG4gICAgICByZXR1cm4gb2JqW18ucmFuZG9tKG9iai5sZW5ndGggLSAxKV07XG4gICAgfVxuICAgIHJldHVybiBfLnNodWZmbGUob2JqKS5zbGljZSgwLCBNYXRoLm1heCgwLCBuKSk7XG4gIH07XG5cbiAgLy8gU29ydCB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uIHByb2R1Y2VkIGJ5IGFuIGl0ZXJhdGVlLlxuICBfLnNvcnRCeSA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgIGlmIChhID4gYiB8fCBhID09PSB2b2lkIDApIHJldHVybiAxO1xuICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIHZhciBncm91cCA9IGZ1bmN0aW9uKGJlaGF2aW9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGtleSA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCB2YWx1ZSwga2V5KTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEdyb3VwcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLiBQYXNzIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGVcbiAgLy8gdG8gZ3JvdXAgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjcml0ZXJpb24uXG4gIF8uZ3JvdXBCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgIGlmIChfLmhhcyhyZXN1bHQsIGtleSkpIHJlc3VsdFtrZXldLnB1c2godmFsdWUpOyBlbHNlIHJlc3VsdFtrZXldID0gW3ZhbHVlXTtcbiAgfSk7XG5cbiAgLy8gSW5kZXhlcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLCBzaW1pbGFyIHRvIGBncm91cEJ5YCwgYnV0IGZvclxuICAvLyB3aGVuIHlvdSBrbm93IHRoYXQgeW91ciBpbmRleCB2YWx1ZXMgd2lsbCBiZSB1bmlxdWUuXG4gIF8uaW5kZXhCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xuICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gIH0pO1xuXG4gIC8vIENvdW50cyBpbnN0YW5jZXMgb2YgYW4gb2JqZWN0IHRoYXQgZ3JvdXAgYnkgYSBjZXJ0YWluIGNyaXRlcmlvbi4gUGFzc1xuICAvLyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlIHRvIGNvdW50IGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGVcbiAgLy8gY3JpdGVyaW9uLlxuICBfLmNvdW50QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoXy5oYXMocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XSsrOyBlbHNlIHJlc3VsdFtrZXldID0gMTtcbiAgfSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIF8uc29ydGVkSW5kZXggPSBmdW5jdGlvbihhcnJheSwgb2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0ZWUob2JqKTtcbiAgICB2YXIgbG93ID0gMCwgaGlnaCA9IGFycmF5Lmxlbmd0aDtcbiAgICB3aGlsZSAobG93IDwgaGlnaCkge1xuICAgICAgdmFyIG1pZCA9IGxvdyArIGhpZ2ggPj4+IDE7XG4gICAgICBpZiAoaXRlcmF0ZWUoYXJyYXlbbWlkXSkgPCB2YWx1ZSkgbG93ID0gbWlkICsgMTsgZWxzZSBoaWdoID0gbWlkO1xuICAgIH1cbiAgICByZXR1cm4gbG93O1xuICB9O1xuXG4gIC8vIFNhZmVseSBjcmVhdGUgYSByZWFsLCBsaXZlIGFycmF5IGZyb20gYW55dGhpbmcgaXRlcmFibGUuXG4gIF8udG9BcnJheSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghb2JqKSByZXR1cm4gW107XG4gICAgaWYgKF8uaXNBcnJheShvYmopKSByZXR1cm4gc2xpY2UuY2FsbChvYmopO1xuICAgIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgcmV0dXJuIF8ubWFwKG9iaiwgXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIF8udmFsdWVzKG9iaik7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gYW4gb2JqZWN0LlxuICBfLnNpemUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiAwO1xuICAgIHJldHVybiBvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCA/IG9iai5sZW5ndGggOiBfLmtleXMob2JqKS5sZW5ndGg7XG4gIH07XG5cbiAgLy8gU3BsaXQgYSBjb2xsZWN0aW9uIGludG8gdHdvIGFycmF5czogb25lIHdob3NlIGVsZW1lbnRzIGFsbCBzYXRpc2Z5IHRoZSBnaXZlblxuICAvLyBwcmVkaWNhdGUsIGFuZCBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIGRvIG5vdCBzYXRpc2Z5IHRoZSBwcmVkaWNhdGUuXG4gIF8ucGFydGl0aW9uID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIHBhc3MgPSBbXSwgZmFpbCA9IFtdO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iaikge1xuICAgICAgKHByZWRpY2F0ZSh2YWx1ZSwga2V5LCBvYmopID8gcGFzcyA6IGZhaWwpLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiBbcGFzcywgZmFpbF07XG4gIH07XG5cbiAgLy8gQXJyYXkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgZmlyc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBBbGlhc2VkIGFzIGBoZWFkYCBhbmQgYHRha2VgLiBUaGUgKipndWFyZCoqIGNoZWNrXG4gIC8vIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5maXJzdCA9IF8uaGVhZCA9IF8udGFrZSA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVswXTtcbiAgICBpZiAobiA8IDApIHJldHVybiBbXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgbik7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgbGFzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEVzcGVjaWFsbHkgdXNlZnVsIG9uXG4gIC8vIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIGFsbCB0aGUgdmFsdWVzIGluXG4gIC8vIHRoZSBhcnJheSwgZXhjbHVkaW5nIHRoZSBsYXN0IE4uIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aFxuICAvLyBgXy5tYXBgLlxuICBfLmluaXRpYWwgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgTWF0aC5tYXgoMCwgYXJyYXkubGVuZ3RoIC0gKG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKSkpO1xuICB9O1xuXG4gIC8vIEdldCB0aGUgbGFzdCBlbGVtZW50IG9mIGFuIGFycmF5LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIHRoZSBsYXN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKiBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ubGFzdCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIGlmIChuID09IG51bGwgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgTWF0aC5tYXgoYXJyYXkubGVuZ3RoIC0gbiwgMCkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgdGFpbGAgYW5kIGBkcm9wYC5cbiAgLy8gRXNwZWNpYWxseSB1c2VmdWwgb24gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgYW4gKipuKiogd2lsbCByZXR1cm5cbiAgLy8gdGhlIHJlc3QgTiB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqXG4gIC8vIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5yZXN0ID0gXy50YWlsID0gXy5kcm9wID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIG4gPT0gbnVsbCB8fCBndWFyZCA/IDEgOiBuKTtcbiAgfTtcblxuICAvLyBUcmltIG91dCBhbGwgZmFsc3kgdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gIF8uY29tcGFjdCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBfLmlkZW50aXR5KTtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiBhIHJlY3Vyc2l2ZSBgZmxhdHRlbmAgZnVuY3Rpb24uXG4gIHZhciBmbGF0dGVuID0gZnVuY3Rpb24oaW5wdXQsIHNoYWxsb3csIHN0cmljdCwgb3V0cHV0KSB7XG4gICAgaWYgKHNoYWxsb3cgJiYgXy5ldmVyeShpbnB1dCwgXy5pc0FycmF5KSkge1xuICAgICAgcmV0dXJuIGNvbmNhdC5hcHBseShvdXRwdXQsIGlucHV0KTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGlucHV0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdmFsdWUgPSBpbnB1dFtpXTtcbiAgICAgIGlmICghXy5pc0FycmF5KHZhbHVlKSAmJiAhXy5pc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgICAgaWYgKCFzdHJpY3QpIG91dHB1dC5wdXNoKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoc2hhbGxvdykge1xuICAgICAgICBwdXNoLmFwcGx5KG91dHB1dCwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmxhdHRlbih2YWx1ZSwgc2hhbGxvdywgc3RyaWN0LCBvdXRwdXQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9O1xuXG4gIC8vIEZsYXR0ZW4gb3V0IGFuIGFycmF5LCBlaXRoZXIgcmVjdXJzaXZlbHkgKGJ5IGRlZmF1bHQpLCBvciBqdXN0IG9uZSBsZXZlbC5cbiAgXy5mbGF0dGVuID0gZnVuY3Rpb24oYXJyYXksIHNoYWxsb3cpIHtcbiAgICByZXR1cm4gZmxhdHRlbihhcnJheSwgc2hhbGxvdywgZmFsc2UsIFtdKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSB2ZXJzaW9uIG9mIHRoZSBhcnJheSB0aGF0IGRvZXMgbm90IGNvbnRhaW4gdGhlIHNwZWNpZmllZCB2YWx1ZShzKS5cbiAgXy53aXRob3V0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5kaWZmZXJlbmNlKGFycmF5LCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYSBkdXBsaWNhdGUtZnJlZSB2ZXJzaW9uIG9mIHRoZSBhcnJheS4gSWYgdGhlIGFycmF5IGhhcyBhbHJlYWR5XG4gIC8vIGJlZW4gc29ydGVkLCB5b3UgaGF2ZSB0aGUgb3B0aW9uIG9mIHVzaW5nIGEgZmFzdGVyIGFsZ29yaXRobS5cbiAgLy8gQWxpYXNlZCBhcyBgdW5pcXVlYC5cbiAgXy51bmlxID0gXy51bmlxdWUgPSBmdW5jdGlvbihhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICBpZiAoIV8uaXNCb29sZWFuKGlzU29ydGVkKSkge1xuICAgICAgY29udGV4dCA9IGl0ZXJhdGVlO1xuICAgICAgaXRlcmF0ZWUgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChpdGVyYXRlZSAhPSBudWxsKSBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaV07XG4gICAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgICAgaWYgKCFpIHx8IHNlZW4gIT09IHZhbHVlKSByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIHNlZW4gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlcmF0ZWUpIHtcbiAgICAgICAgdmFyIGNvbXB1dGVkID0gaXRlcmF0ZWUodmFsdWUsIGksIGFycmF5KTtcbiAgICAgICAgaWYgKF8uaW5kZXhPZihzZWVuLCBjb21wdXRlZCkgPCAwKSB7XG4gICAgICAgICAgc2Vlbi5wdXNoKGNvbXB1dGVkKTtcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoXy5pbmRleE9mKHJlc3VsdCwgdmFsdWUpIDwgMCkge1xuICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB1bmlvbjogZWFjaCBkaXN0aW5jdCBlbGVtZW50IGZyb20gYWxsIG9mXG4gIC8vIHRoZSBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLnVuaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW5pcShmbGF0dGVuKGFyZ3VtZW50cywgdHJ1ZSwgdHJ1ZSwgW10pKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgZXZlcnkgaXRlbSBzaGFyZWQgYmV0d2VlbiBhbGwgdGhlXG4gIC8vIHBhc3NlZC1pbiBhcnJheXMuXG4gIF8uaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICB2YXIgYXJnc0xlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgICAgaWYgKF8uY29udGFpbnMocmVzdWx0LCBpdGVtKSkgY29udGludWU7XG4gICAgICBmb3IgKHZhciBqID0gMTsgaiA8IGFyZ3NMZW5ndGg7IGorKykge1xuICAgICAgICBpZiAoIV8uY29udGFpbnMoYXJndW1lbnRzW2pdLCBpdGVtKSkgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaiA9PT0gYXJnc0xlbmd0aCkgcmVzdWx0LnB1c2goaXRlbSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gVGFrZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIG9uZSBhcnJheSBhbmQgYSBudW1iZXIgb2Ygb3RoZXIgYXJyYXlzLlxuICAvLyBPbmx5IHRoZSBlbGVtZW50cyBwcmVzZW50IGluIGp1c3QgdGhlIGZpcnN0IGFycmF5IHdpbGwgcmVtYWluLlxuICBfLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gZmxhdHRlbihzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIHRydWUsIHRydWUsIFtdKTtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgIHJldHVybiAhXy5jb250YWlucyhyZXN0LCB2YWx1ZSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgXy56aXAgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KGFyZ3VtZW50cywgJ2xlbmd0aCcpLmxlbmd0aDtcbiAgICB2YXIgcmVzdWx0cyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0c1tpXSA9IF8ucGx1Y2soYXJndW1lbnRzLCBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gQ29udmVydHMgbGlzdHMgaW50byBvYmplY3RzLiBQYXNzIGVpdGhlciBhIHNpbmdsZSBhcnJheSBvZiBgW2tleSwgdmFsdWVdYFxuICAvLyBwYWlycywgb3IgdHdvIHBhcmFsbGVsIGFycmF5cyBvZiB0aGUgc2FtZSBsZW5ndGggLS0gb25lIG9mIGtleXMsIGFuZCBvbmUgb2ZcbiAgLy8gdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICBfLm9iamVjdCA9IGZ1bmN0aW9uKGxpc3QsIHZhbHVlcykge1xuICAgIGlmIChsaXN0ID09IG51bGwpIHJldHVybiB7fTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGxpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1dID0gdmFsdWVzW2ldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1bMF1dID0gbGlzdFtpXVsxXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFuIGl0ZW0gaW4gYW4gYXJyYXksXG4gIC8vIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIC8vIElmIHRoZSBhcnJheSBpcyBsYXJnZSBhbmQgYWxyZWFkeSBpbiBzb3J0IG9yZGVyLCBwYXNzIGB0cnVlYFxuICAvLyBmb3IgKippc1NvcnRlZCoqIHRvIHVzZSBiaW5hcnkgc2VhcmNoLlxuICBfLmluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgaXNTb3J0ZWQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpID0gaXNTb3J0ZWQgPCAwID8gTWF0aC5tYXgoMCwgbGVuZ3RoICsgaXNTb3J0ZWQpIDogaXNTb3J0ZWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpID0gXy5zb3J0ZWRJbmRleChhcnJheSwgaXRlbSk7XG4gICAgICAgIHJldHVybiBhcnJheVtpXSA9PT0gaXRlbSA/IGkgOiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yICg7IGkgPCBsZW5ndGg7IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgXy5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uKGFycmF5LCBpdGVtLCBmcm9tKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaWR4ID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmICh0eXBlb2YgZnJvbSA9PSAnbnVtYmVyJykge1xuICAgICAgaWR4ID0gZnJvbSA8IDAgPyBpZHggKyBmcm9tICsgMSA6IE1hdGgubWluKGlkeCwgZnJvbSArIDEpO1xuICAgIH1cbiAgICB3aGlsZSAoLS1pZHggPj0gMCkgaWYgKGFycmF5W2lkeF0gPT09IGl0ZW0pIHJldHVybiBpZHg7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGFuIGludGVnZXIgQXJyYXkgY29udGFpbmluZyBhbiBhcml0aG1ldGljIHByb2dyZXNzaW9uLiBBIHBvcnQgb2ZcbiAgLy8gdGhlIG5hdGl2ZSBQeXRob24gYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWVcbiAgLy8gW3RoZSBQeXRob24gZG9jdW1lbnRhdGlvbl0oaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlKS5cbiAgXy5yYW5nZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzdGVwKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPD0gMSkge1xuICAgICAgc3RvcCA9IHN0YXJ0IHx8IDA7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBzdGVwIHx8IDE7XG5cbiAgICB2YXIgbGVuZ3RoID0gTWF0aC5tYXgoTWF0aC5jZWlsKChzdG9wIC0gc3RhcnQpIC8gc3RlcCksIDApO1xuICAgIHZhciByYW5nZSA9IEFycmF5KGxlbmd0aCk7XG5cbiAgICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBsZW5ndGg7IGlkeCsrLCBzdGFydCArPSBzdGVwKSB7XG4gICAgICByYW5nZVtpZHhdID0gc3RhcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJhbmdlO1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIChhaGVtKSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUmV1c2FibGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHByb3RvdHlwZSBzZXR0aW5nLlxuICB2YXIgQ3RvciA9IGZ1bmN0aW9uKCl7fTtcblxuICAvLyBDcmVhdGUgYSBmdW5jdGlvbiBib3VuZCB0byBhIGdpdmVuIG9iamVjdCAoYXNzaWduaW5nIGB0aGlzYCwgYW5kIGFyZ3VtZW50cyxcbiAgLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuICAvLyBhdmFpbGFibGUuXG4gIF8uYmluZCA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQpIHtcbiAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgaWYgKG5hdGl2ZUJpbmQgJiYgZnVuYy5iaW5kID09PSBuYXRpdmVCaW5kKSByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdCaW5kIG11c3QgYmUgY2FsbGVkIG9uIGEgZnVuY3Rpb24nKTtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIGJvdW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIEN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICB2YXIgc2VsZiA9IG5ldyBDdG9yO1xuICAgICAgQ3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBpZiAoXy5pc09iamVjdChyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgICByZXR1cm4gYm91bmQ7XG4gIH07XG5cbiAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAvLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gXyBhY3RzXG4gIC8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbiAgXy5wYXJ0aWFsID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHZhciBib3VuZEFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBCaW5kIGEgbnVtYmVyIG9mIGFuIG9iamVjdCdzIG1ldGhvZHMgdG8gdGhhdCBvYmplY3QuIFJlbWFpbmluZyBhcmd1bWVudHNcbiAgLy8gYXJlIHRoZSBtZXRob2QgbmFtZXMgdG8gYmUgYm91bmQuIFVzZWZ1bCBmb3IgZW5zdXJpbmcgdGhhdCBhbGwgY2FsbGJhY2tzXG4gIC8vIGRlZmluZWQgb24gYW4gb2JqZWN0IGJlbG9uZyB0byBpdC5cbiAgXy5iaW5kQWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGksIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGgsIGtleTtcbiAgICBpZiAobGVuZ3RoIDw9IDEpIHRocm93IG5ldyBFcnJvcignYmluZEFsbCBtdXN0IGJlIHBhc3NlZCBmdW5jdGlvbiBuYW1lcycpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAga2V5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgb2JqW2tleV0gPSBfLmJpbmQob2JqW2tleV0sIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gTWVtb2l6ZSBhbiBleHBlbnNpdmUgZnVuY3Rpb24gYnkgc3RvcmluZyBpdHMgcmVzdWx0cy5cbiAgXy5tZW1vaXplID0gZnVuY3Rpb24oZnVuYywgaGFzaGVyKSB7XG4gICAgdmFyIG1lbW9pemUgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHZhciBjYWNoZSA9IG1lbW9pemUuY2FjaGU7XG4gICAgICB2YXIgYWRkcmVzcyA9IGhhc2hlciA/IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5O1xuICAgICAgaWYgKCFfLmhhcyhjYWNoZSwgYWRkcmVzcykpIGNhY2hlW2FkZHJlc3NdID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIGNhY2hlW2FkZHJlc3NdO1xuICAgIH07XG4gICAgbWVtb2l6ZS5jYWNoZSA9IHt9O1xuICAgIHJldHVybiBtZW1vaXplO1xuICB9O1xuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICBfLmRlbGF5ID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseShudWxsLCBhcmdzKTtcbiAgICB9LCB3YWl0KTtcbiAgfTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgXy5kZWZlciA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICByZXR1cm4gXy5kZWxheS5hcHBseShfLCBbZnVuYywgMV0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgd2hlbiBpbnZva2VkLCB3aWxsIG9ubHkgYmUgdHJpZ2dlcmVkIGF0IG1vc3Qgb25jZVxuICAvLyBkdXJpbmcgYSBnaXZlbiB3aW5kb3cgb2YgdGltZS4gTm9ybWFsbHksIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCBydW5cbiAgLy8gYXMgbXVjaCBhcyBpdCBjYW4sIHdpdGhvdXQgZXZlciBnb2luZyBtb3JlIHRoYW4gb25jZSBwZXIgYHdhaXRgIGR1cmF0aW9uO1xuICAvLyBidXQgaWYgeW91J2QgbGlrZSB0byBkaXNhYmxlIHRoZSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSwgcGFzc1xuICAvLyBge2xlYWRpbmc6IGZhbHNlfWAuIFRvIGRpc2FibGUgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlLCBkaXR0by5cbiAgXy50aHJvdHRsZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcbiAgICB2YXIgcHJldmlvdXMgPSAwO1xuICAgIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcHJldmlvdXMgPSBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlID8gMCA6IF8ubm93KCk7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9O1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBfLm5vdygpO1xuICAgICAgaWYgKCFwcmV2aW91cyAmJiBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlKSBwcmV2aW91cyA9IG5vdztcbiAgICAgIHZhciByZW1haW5pbmcgPSB3YWl0IC0gKG5vdyAtIHByZXZpb3VzKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGlmIChyZW1haW5pbmcgPD0gMCB8fCByZW1haW5pbmcgPiB3YWl0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIHByZXZpb3VzID0gbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH0gZWxzZSBpZiAoIXRpbWVvdXQgJiYgb3B0aW9ucy50cmFpbGluZyAhPT0gZmFsc2UpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHJlbWFpbmluZyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCBhcyBsb25nIGFzIGl0IGNvbnRpbnVlcyB0byBiZSBpbnZva2VkLCB3aWxsIG5vdFxuICAvLyBiZSB0cmlnZ2VyZWQuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCBhZnRlciBpdCBzdG9wcyBiZWluZyBjYWxsZWQgZm9yXG4gIC8vIE4gbWlsbGlzZWNvbmRzLiBJZiBgaW1tZWRpYXRlYCBpcyBwYXNzZWQsIHRyaWdnZXIgdGhlIGZ1bmN0aW9uIG9uIHRoZVxuICAvLyBsZWFkaW5nIGVkZ2UsIGluc3RlYWQgb2YgdGhlIHRyYWlsaW5nLlxuICBfLmRlYm91bmNlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgaW1tZWRpYXRlKSB7XG4gICAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcCwgcmVzdWx0O1xuXG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbGFzdCA9IF8ubm93KCkgLSB0aW1lc3RhbXA7XG5cbiAgICAgIGlmIChsYXN0IDwgd2FpdCAmJiBsYXN0ID4gMCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICBpZiAoIXRpbWVvdXQpIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aW1lc3RhbXAgPSBfLm5vdygpO1xuICAgICAgdmFyIGNhbGxOb3cgPSBpbW1lZGlhdGUgJiYgIXRpbWVvdXQ7XG4gICAgICBpZiAoIXRpbWVvdXQpIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgIGlmIChjYWxsTm93KSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgdGhlIGZpcnN0IGZ1bmN0aW9uIHBhc3NlZCBhcyBhbiBhcmd1bWVudCB0byB0aGUgc2Vjb25kLFxuICAvLyBhbGxvd2luZyB5b3UgdG8gYWRqdXN0IGFyZ3VtZW50cywgcnVuIGNvZGUgYmVmb3JlIGFuZCBhZnRlciwgYW5kXG4gIC8vIGNvbmRpdGlvbmFsbHkgZXhlY3V0ZSB0aGUgb3JpZ2luYWwgZnVuY3Rpb24uXG4gIF8ud3JhcCA9IGZ1bmN0aW9uKGZ1bmMsIHdyYXBwZXIpIHtcbiAgICByZXR1cm4gXy5wYXJ0aWFsKHdyYXBwZXIsIGZ1bmMpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBuZWdhdGVkIHZlcnNpb24gb2YgdGhlIHBhc3NlZC1pbiBwcmVkaWNhdGUuXG4gIF8ubmVnYXRlID0gZnVuY3Rpb24ocHJlZGljYXRlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICFwcmVkaWNhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBhIGxpc3Qgb2YgZnVuY3Rpb25zLCBlYWNoXG4gIC8vIGNvbnN1bWluZyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gIF8uY29tcG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgIHZhciBzdGFydCA9IGFyZ3MubGVuZ3RoIC0gMTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaSA9IHN0YXJ0O1xuICAgICAgdmFyIHJlc3VsdCA9IGFyZ3Nbc3RhcnRdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB3aGlsZSAoaS0tKSByZXN1bHQgPSBhcmdzW2ldLmNhbGwodGhpcywgcmVzdWx0KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgYWZ0ZXIgYmVpbmcgY2FsbGVkIE4gdGltZXMuXG4gIF8uYWZ0ZXIgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGJlZm9yZSBiZWluZyBjYWxsZWQgTiB0aW1lcy5cbiAgXy5iZWZvcmUgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHZhciBtZW1vO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzID4gMCkge1xuICAgICAgICBtZW1vID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVuYyA9IG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWVtbztcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYXQgbW9zdCBvbmUgdGltZSwgbm8gbWF0dGVyIGhvd1xuICAvLyBvZnRlbiB5b3UgY2FsbCBpdC4gVXNlZnVsIGZvciBsYXp5IGluaXRpYWxpemF0aW9uLlxuICBfLm9uY2UgPSBfLnBhcnRpYWwoXy5iZWZvcmUsIDIpO1xuXG4gIC8vIE9iamVjdCBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgT2JqZWN0LmtleXNgXG4gIF8ua2V5cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gW107XG4gICAgaWYgKG5hdGl2ZUtleXMpIHJldHVybiBuYXRpdmVLZXlzKG9iaik7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9O1xuXG4gIC8vIENvbnZlcnQgYW4gb2JqZWN0IGludG8gYSBsaXN0IG9mIGBba2V5LCB2YWx1ZV1gIHBhaXJzLlxuICBfLnBhaXJzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtrZXlzW2ldLCBvYmpba2V5c1tpXV1dO1xuICAgIH1cbiAgICByZXR1cm4gcGFpcnM7XG4gIH07XG5cbiAgLy8gSW52ZXJ0IHRoZSBrZXlzIGFuZCB2YWx1ZXMgb2YgYW4gb2JqZWN0LiBUaGUgdmFsdWVzIG11c3QgYmUgc2VyaWFsaXphYmxlLlxuICBfLmludmVydCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW2tleXNbaV1dXSA9IGtleXNbaV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgc29ydGVkIGxpc3Qgb2YgdGhlIGZ1bmN0aW9uIG5hbWVzIGF2YWlsYWJsZSBvbiB0aGUgb2JqZWN0LlxuICAvLyBBbGlhc2VkIGFzIGBtZXRob2RzYFxuICBfLmZ1bmN0aW9ucyA9IF8ubWV0aG9kcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChfLmlzRnVuY3Rpb24ob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH07XG5cbiAgLy8gRXh0ZW5kIGEgZ2l2ZW4gb2JqZWN0IHdpdGggYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHBhc3NlZC1pbiBvYmplY3QocykuXG4gIF8uZXh0ZW5kID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgdmFyIHNvdXJjZSwgcHJvcDtcbiAgICBmb3IgKHZhciBpID0gMSwgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwgcHJvcCkpIHtcbiAgICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCBvbmx5IGNvbnRhaW5pbmcgdGhlIHdoaXRlbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ucGljayA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0ID0ge30sIGtleTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IG9ialtrZXldO1xuICAgICAgICBpZiAoaXRlcmF0ZWUodmFsdWUsIGtleSwgb2JqKSkgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoW10sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICBpZiAoa2V5IGluIG9iaikgcmVzdWx0W2tleV0gPSBvYmpba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKGl0ZXJhdGVlKSkge1xuICAgICAgaXRlcmF0ZWUgPSBfLm5lZ2F0ZShpdGVyYXRlZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5tYXAoY29uY2F0LmFwcGx5KFtdLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpLCBTdHJpbmcpO1xuICAgICAgaXRlcmF0ZWUgPSBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgIHJldHVybiAhXy5jb250YWlucyhrZXlzLCBrZXkpO1xuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIF8ucGljayhvYmosIGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBGaWxsIGluIGEgZ2l2ZW4gb2JqZWN0IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzLlxuICBfLmRlZmF1bHRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHZvaWQgMCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYGlzRXF1YWxgLlxuICB2YXIgZXEgPSBmdW5jdGlvbihhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT09IDEgLyBiO1xuICAgIC8vIEEgc3RyaWN0IGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYG51bGwgPT0gdW5kZWZpbmVkYC5cbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGEgPT09IGI7XG4gICAgLy8gVW53cmFwIGFueSB3cmFwcGVkIG9iamVjdHMuXG4gICAgaWYgKGEgaW5zdGFuY2VvZiBfKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8pIGIgPSBiLl93cmFwcGVkO1xuICAgIC8vIENvbXBhcmUgYFtbQ2xhc3NdXWAgbmFtZXMuXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gICAgaWYgKGNsYXNzTmFtZSAhPT0gdG9TdHJpbmcuY2FsbChiKSkgcmV0dXJuIGZhbHNlO1xuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICAvLyBTdHJpbmdzLCBudW1iZXJzLCByZWd1bGFyIGV4cHJlc3Npb25zLCBkYXRlcywgYW5kIGJvb2xlYW5zIGFyZSBjb21wYXJlZCBieSB2YWx1ZS5cbiAgICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICAvLyBSZWdFeHBzIGFyZSBjb2VyY2VkIHRvIHN0cmluZ3MgZm9yIGNvbXBhcmlzb24gKE5vdGU6ICcnICsgL2EvaSA9PT0gJy9hL2knKVxuICAgICAgY2FzZSAnW29iamVjdCBTdHJpbmddJzpcbiAgICAgICAgLy8gUHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3Qgd3JhcHBlcnMgYXJlIGVxdWl2YWxlbnQ7IHRodXMsIGBcIjVcImAgaXNcbiAgICAgICAgLy8gZXF1aXZhbGVudCB0byBgbmV3IFN0cmluZyhcIjVcIilgLlxuICAgICAgICByZXR1cm4gJycgKyBhID09PSAnJyArIGI7XG4gICAgICBjYXNlICdbb2JqZWN0IE51bWJlcl0nOlxuICAgICAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLlxuICAgICAgICAvLyBPYmplY3QoTmFOKSBpcyBlcXVpdmFsZW50IHRvIE5hTlxuICAgICAgICBpZiAoK2EgIT09ICthKSByZXR1cm4gK2IgIT09ICtiO1xuICAgICAgICAvLyBBbiBgZWdhbGAgY29tcGFyaXNvbiBpcyBwZXJmb3JtZWQgZm9yIG90aGVyIG51bWVyaWMgdmFsdWVzLlxuICAgICAgICByZXR1cm4gK2EgPT09IDAgPyAxIC8gK2EgPT09IDEgLyBiIDogK2EgPT09ICtiO1xuICAgICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgICAgLy8gQ29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1lcmljIHByaW1pdGl2ZSB2YWx1ZXMuIERhdGVzIGFyZSBjb21wYXJlZCBieSB0aGVpclxuICAgICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgICAgcmV0dXJuICthID09PSArYjtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhICE9ICdvYmplY3QnIHx8IHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PT0gYjtcbiAgICB9XG4gICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gICAgLy8gZnJvbSBkaWZmZXJlbnQgZnJhbWVzIGFyZS5cbiAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgaWYgKFxuICAgICAgYUN0b3IgIT09IGJDdG9yICYmXG4gICAgICAvLyBIYW5kbGUgT2JqZWN0LmNyZWF0ZSh4KSBjYXNlc1xuICAgICAgJ2NvbnN0cnVjdG9yJyBpbiBhICYmICdjb25zdHJ1Y3RvcicgaW4gYiAmJlxuICAgICAgIShfLmlzRnVuY3Rpb24oYUN0b3IpICYmIGFDdG9yIGluc3RhbmNlb2YgYUN0b3IgJiZcbiAgICAgICAgXy5pc0Z1bmN0aW9uKGJDdG9yKSAmJiBiQ3RvciBpbnN0YW5jZW9mIGJDdG9yKVxuICAgICkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG4gICAgdmFyIHNpemUsIHJlc3VsdDtcbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoY2xhc3NOYW1lID09PSAnW29iamVjdCBBcnJheV0nKSB7XG4gICAgICAvLyBDb21wYXJlIGFycmF5IGxlbmd0aHMgdG8gZGV0ZXJtaW5lIGlmIGEgZGVlcCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeS5cbiAgICAgIHNpemUgPSBhLmxlbmd0aDtcbiAgICAgIHJlc3VsdCA9IHNpemUgPT09IGIubGVuZ3RoO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgdGhlIGNvbnRlbnRzLCBpZ25vcmluZyBub24tbnVtZXJpYyBwcm9wZXJ0aWVzLlxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gZXEoYVtzaXplXSwgYltzaXplXSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhhKSwga2V5O1xuICAgICAgc2l6ZSA9IGtleXMubGVuZ3RoO1xuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMgYmVmb3JlIGNvbXBhcmluZyBkZWVwIGVxdWFsaXR5LlxuICAgICAgcmVzdWx0ID0gXy5rZXlzKGIpLmxlbmd0aCA9PT0gc2l6ZTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIC8vIERlZXAgY29tcGFyZSBlYWNoIG1lbWJlclxuICAgICAgICAgIGtleSA9IGtleXNbc2l6ZV07XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gXy5oYXMoYiwga2V5KSAmJiBlcShhW2tleV0sIGJba2V5XSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gUmVtb3ZlIHRoZSBmaXJzdCBvYmplY3QgZnJvbSB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnBvcCgpO1xuICAgIGJTdGFjay5wb3AoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFBlcmZvcm0gYSBkZWVwIGNvbXBhcmlzb24gdG8gY2hlY2sgaWYgdHdvIG9iamVjdHMgYXJlIGVxdWFsLlxuICBfLmlzRXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIGVxKGEsIGIsIFtdLCBbXSk7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiBhcnJheSwgc3RyaW5nLCBvciBvYmplY3QgZW1wdHk/XG4gIC8vIEFuIFwiZW1wdHlcIiBvYmplY3QgaGFzIG5vIGVudW1lcmFibGUgb3duLXByb3BlcnRpZXMuXG4gIF8uaXNFbXB0eSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHRydWU7XG4gICAgaWYgKF8uaXNBcnJheShvYmopIHx8IF8uaXNTdHJpbmcob2JqKSB8fCBfLmlzQXJndW1lbnRzKG9iaikpIHJldHVybiBvYmoubGVuZ3RoID09PSAwO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChfLmhhcyhvYmosIGtleSkpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgRE9NIGVsZW1lbnQ/XG4gIF8uaXNFbGVtZW50ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYW4gYXJyYXk/XG4gIC8vIERlbGVnYXRlcyB0byBFQ01BNSdzIG5hdGl2ZSBBcnJheS5pc0FycmF5XG4gIF8uaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIGFuIG9iamVjdD9cbiAgXy5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIG9iajtcbiAgICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlID09PSAnb2JqZWN0JyAmJiAhIW9iajtcbiAgfTtcblxuICAvLyBBZGQgc29tZSBpc1R5cGUgbWV0aG9kczogaXNBcmd1bWVudHMsIGlzRnVuY3Rpb24sIGlzU3RyaW5nLCBpc051bWJlciwgaXNEYXRlLCBpc1JlZ0V4cC5cbiAgXy5lYWNoKFsnQXJndW1lbnRzJywgJ0Z1bmN0aW9uJywgJ1N0cmluZycsICdOdW1iZXInLCAnRGF0ZScsICdSZWdFeHAnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIF9bJ2lzJyArIG5hbWVdID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCAnICsgbmFtZSArICddJztcbiAgICB9O1xuICB9KTtcblxuICAvLyBEZWZpbmUgYSBmYWxsYmFjayB2ZXJzaW9uIG9mIHRoZSBtZXRob2QgaW4gYnJvd3NlcnMgKGFoZW0sIElFKSwgd2hlcmVcbiAgLy8gdGhlcmUgaXNuJ3QgYW55IGluc3BlY3RhYmxlIFwiQXJndW1lbnRzXCIgdHlwZS5cbiAgaWYgKCFfLmlzQXJndW1lbnRzKGFyZ3VtZW50cykpIHtcbiAgICBfLmlzQXJndW1lbnRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gXy5oYXMob2JqLCAnY2FsbGVlJyk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS4gV29yayBhcm91bmQgYW4gSUUgMTEgYnVnLlxuICBpZiAodHlwZW9mIC8uLyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIF8uaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT0gJ2Z1bmN0aW9uJyB8fCBmYWxzZTtcbiAgICB9O1xuICB9XG5cbiAgLy8gSXMgYSBnaXZlbiBvYmplY3QgYSBmaW5pdGUgbnVtYmVyP1xuICBfLmlzRmluaXRlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIGlzRmluaXRlKG9iaikgJiYgIWlzTmFOKHBhcnNlRmxvYXQob2JqKSk7XG4gIH07XG5cbiAgLy8gSXMgdGhlIGdpdmVuIHZhbHVlIGBOYU5gPyAoTmFOIGlzIHRoZSBvbmx5IG51bWJlciB3aGljaCBkb2VzIG5vdCBlcXVhbCBpdHNlbGYpLlxuICBfLmlzTmFOID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIF8uaXNOdW1iZXIob2JqKSAmJiBvYmogIT09ICtvYmo7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIGJvb2xlYW4/XG4gIF8uaXNCb29sZWFuID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgZXF1YWwgdG8gbnVsbD9cbiAgXy5pc051bGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgdW5kZWZpbmVkP1xuICBfLmlzVW5kZWZpbmVkID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdm9pZCAwO1xuICB9O1xuXG4gIC8vIFNob3J0Y3V0IGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gcHJvcGVydHkgZGlyZWN0bHlcbiAgLy8gb24gaXRzZWxmIChpbiBvdGhlciB3b3Jkcywgbm90IG9uIGEgcHJvdG90eXBlKS5cbiAgXy5oYXMgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBvYmogIT0gbnVsbCAmJiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbiAgfTtcblxuICAvLyBVdGlsaXR5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJ1biBVbmRlcnNjb3JlLmpzIGluICpub0NvbmZsaWN0KiBtb2RlLCByZXR1cm5pbmcgdGhlIGBfYCB2YXJpYWJsZSB0byBpdHNcbiAgLy8gcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290Ll8gPSBwcmV2aW91c1VuZGVyc2NvcmU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLy8gS2VlcCB0aGUgaWRlbnRpdHkgZnVuY3Rpb24gYXJvdW5kIGZvciBkZWZhdWx0IGl0ZXJhdGVlcy5cbiAgXy5pZGVudGl0eSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIF8uY29uc3RhbnQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuICB9O1xuXG4gIF8ubm9vcCA9IGZ1bmN0aW9uKCl7fTtcblxuICBfLnByb3BlcnR5ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9ialtrZXldO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIHByZWRpY2F0ZSBmb3IgY2hlY2tpbmcgd2hldGhlciBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gc2V0IG9mIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLm1hdGNoZXMgPSBmdW5jdGlvbihhdHRycykge1xuICAgIHZhciBwYWlycyA9IF8ucGFpcnMoYXR0cnMpLCBsZW5ndGggPSBwYWlycy5sZW5ndGg7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gIWxlbmd0aDtcbiAgICAgIG9iaiA9IG5ldyBPYmplY3Qob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHBhaXIgPSBwYWlyc1tpXSwga2V5ID0gcGFpclswXTtcbiAgICAgICAgaWYgKHBhaXJbMV0gIT09IG9ialtrZXldIHx8ICEoa2V5IGluIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIF8udGltZXMgPSBmdW5jdGlvbihuLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciBhY2N1bSA9IEFycmF5KE1hdGgubWF4KDAsIG4pKTtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCAxKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRlZShpKTtcbiAgICByZXR1cm4gYWNjdW07XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBtaW4gYW5kIG1heCAoaW5jbHVzaXZlKS5cbiAgXy5yYW5kb20gPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH07XG5cbiAgLy8gQSAocG9zc2libHkgZmFzdGVyKSB3YXkgdG8gZ2V0IHRoZSBjdXJyZW50IHRpbWVzdGFtcCBhcyBhbiBpbnRlZ2VyLlxuICBfLm5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgfTtcblxuICAgLy8gTGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciBlc2NhcGluZy5cbiAgdmFyIGVzY2FwZU1hcCA9IHtcbiAgICAnJic6ICcmYW1wOycsXG4gICAgJzwnOiAnJmx0OycsXG4gICAgJz4nOiAnJmd0OycsXG4gICAgJ1wiJzogJyZxdW90OycsXG4gICAgXCInXCI6ICcmI3gyNzsnLFxuICAgICdgJzogJyYjeDYwOydcbiAgfTtcbiAgdmFyIHVuZXNjYXBlTWFwID0gXy5pbnZlcnQoZXNjYXBlTWFwKTtcblxuICAvLyBGdW5jdGlvbnMgZm9yIGVzY2FwaW5nIGFuZCB1bmVzY2FwaW5nIHN0cmluZ3MgdG8vZnJvbSBIVE1MIGludGVycG9sYXRpb24uXG4gIHZhciBjcmVhdGVFc2NhcGVyID0gZnVuY3Rpb24obWFwKSB7XG4gICAgdmFyIGVzY2FwZXIgPSBmdW5jdGlvbihtYXRjaCkge1xuICAgICAgcmV0dXJuIG1hcFttYXRjaF07XG4gICAgfTtcbiAgICAvLyBSZWdleGVzIGZvciBpZGVudGlmeWluZyBhIGtleSB0aGF0IG5lZWRzIHRvIGJlIGVzY2FwZWRcbiAgICB2YXIgc291cmNlID0gJyg/OicgKyBfLmtleXMobWFwKS5qb2luKCd8JykgKyAnKSc7XG4gICAgdmFyIHRlc3RSZWdleHAgPSBSZWdFeHAoc291cmNlKTtcbiAgICB2YXIgcmVwbGFjZVJlZ2V4cCA9IFJlZ0V4cChzb3VyY2UsICdnJyk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgc3RyaW5nID0gc3RyaW5nID09IG51bGwgPyAnJyA6ICcnICsgc3RyaW5nO1xuICAgICAgcmV0dXJuIHRlc3RSZWdleHAudGVzdChzdHJpbmcpID8gc3RyaW5nLnJlcGxhY2UocmVwbGFjZVJlZ2V4cCwgZXNjYXBlcikgOiBzdHJpbmc7XG4gICAgfTtcbiAgfTtcbiAgXy5lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKGVzY2FwZU1hcCk7XG4gIF8udW5lc2NhcGUgPSBjcmVhdGVFc2NhcGVyKHVuZXNjYXBlTWFwKTtcblxuICAvLyBJZiB0aGUgdmFsdWUgb2YgdGhlIG5hbWVkIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvbiB0aGVuIGludm9rZSBpdCB3aXRoIHRoZVxuICAvLyBgb2JqZWN0YCBhcyBjb250ZXh0OyBvdGhlcndpc2UsIHJldHVybiBpdC5cbiAgXy5yZXN1bHQgPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIHZhciB2YWx1ZSA9IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgcmV0dXJuIF8uaXNGdW5jdGlvbih2YWx1ZSkgPyBvYmplY3RbcHJvcGVydHldKCkgOiB2YWx1ZTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhIHVuaXF1ZSBpbnRlZ2VyIGlkICh1bmlxdWUgd2l0aGluIHRoZSBlbnRpcmUgY2xpZW50IHNlc3Npb24pLlxuICAvLyBVc2VmdWwgZm9yIHRlbXBvcmFyeSBET00gaWRzLlxuICB2YXIgaWRDb3VudGVyID0gMDtcbiAgXy51bmlxdWVJZCA9IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgcmV0dXJuIHByZWZpeCA/IHByZWZpeCArIGlkIDogaWQ7XG4gIH07XG5cbiAgLy8gQnkgZGVmYXVsdCwgVW5kZXJzY29yZSB1c2VzIEVSQi1zdHlsZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzLCBjaGFuZ2UgdGhlXG4gIC8vIGZvbGxvd2luZyB0ZW1wbGF0ZSBzZXR0aW5ncyB0byB1c2UgYWx0ZXJuYXRpdmUgZGVsaW1pdGVycy5cbiAgXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xuICAgIGV2YWx1YXRlICAgIDogLzwlKFtcXHNcXFNdKz8pJT4vZyxcbiAgICBpbnRlcnBvbGF0ZSA6IC88JT0oW1xcc1xcU10rPyklPi9nLFxuICAgIGVzY2FwZSAgICAgIDogLzwlLShbXFxzXFxTXSs/KSU+L2dcbiAgfTtcblxuICAvLyBXaGVuIGN1c3RvbWl6aW5nIGB0ZW1wbGF0ZVNldHRpbmdzYCwgaWYgeW91IGRvbid0IHdhbnQgdG8gZGVmaW5lIGFuXG4gIC8vIGludGVycG9sYXRpb24sIGV2YWx1YXRpb24gb3IgZXNjYXBpbmcgcmVnZXgsIHdlIG5lZWQgb25lIHRoYXQgaXNcbiAgLy8gZ3VhcmFudGVlZCBub3QgdG8gbWF0Y2guXG4gIHZhciBub01hdGNoID0gLyguKV4vO1xuXG4gIC8vIENlcnRhaW4gY2hhcmFjdGVycyBuZWVkIHRvIGJlIGVzY2FwZWQgc28gdGhhdCB0aGV5IGNhbiBiZSBwdXQgaW50byBhXG4gIC8vIHN0cmluZyBsaXRlcmFsLlxuICB2YXIgZXNjYXBlcyA9IHtcbiAgICBcIidcIjogICAgICBcIidcIixcbiAgICAnXFxcXCc6ICAgICAnXFxcXCcsXG4gICAgJ1xccic6ICAgICAncicsXG4gICAgJ1xcbic6ICAgICAnbicsXG4gICAgJ1xcdTIwMjgnOiAndTIwMjgnLFxuICAgICdcXHUyMDI5JzogJ3UyMDI5J1xuICB9O1xuXG4gIHZhciBlc2NhcGVyID0gL1xcXFx8J3xcXHJ8XFxufFxcdTIwMjh8XFx1MjAyOS9nO1xuXG4gIHZhciBlc2NhcGVDaGFyID0gZnVuY3Rpb24obWF0Y2gpIHtcbiAgICByZXR1cm4gJ1xcXFwnICsgZXNjYXBlc1ttYXRjaF07XG4gIH07XG5cbiAgLy8gSmF2YVNjcmlwdCBtaWNyby10ZW1wbGF0aW5nLCBzaW1pbGFyIHRvIEpvaG4gUmVzaWcncyBpbXBsZW1lbnRhdGlvbi5cbiAgLy8gVW5kZXJzY29yZSB0ZW1wbGF0aW5nIGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlcyB3aGl0ZXNwYWNlLFxuICAvLyBhbmQgY29ycmVjdGx5IGVzY2FwZXMgcXVvdGVzIHdpdGhpbiBpbnRlcnBvbGF0ZWQgY29kZS5cbiAgLy8gTkI6IGBvbGRTZXR0aW5nc2Agb25seSBleGlzdHMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICBfLnRlbXBsYXRlID0gZnVuY3Rpb24odGV4dCwgc2V0dGluZ3MsIG9sZFNldHRpbmdzKSB7XG4gICAgaWYgKCFzZXR0aW5ncyAmJiBvbGRTZXR0aW5ncykgc2V0dGluZ3MgPSBvbGRTZXR0aW5ncztcbiAgICBzZXR0aW5ncyA9IF8uZGVmYXVsdHMoe30sIHNldHRpbmdzLCBfLnRlbXBsYXRlU2V0dGluZ3MpO1xuXG4gICAgLy8gQ29tYmluZSBkZWxpbWl0ZXJzIGludG8gb25lIHJlZ3VsYXIgZXhwcmVzc2lvbiB2aWEgYWx0ZXJuYXRpb24uXG4gICAgdmFyIG1hdGNoZXIgPSBSZWdFeHAoW1xuICAgICAgKHNldHRpbmdzLmVzY2FwZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuaW50ZXJwb2xhdGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmV2YWx1YXRlIHx8IG5vTWF0Y2gpLnNvdXJjZVxuICAgIF0uam9pbignfCcpICsgJ3wkJywgJ2cnKTtcblxuICAgIC8vIENvbXBpbGUgdGhlIHRlbXBsYXRlIHNvdXJjZSwgZXNjYXBpbmcgc3RyaW5nIGxpdGVyYWxzIGFwcHJvcHJpYXRlbHkuXG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc291cmNlID0gXCJfX3ArPSdcIjtcbiAgICB0ZXh0LnJlcGxhY2UobWF0Y2hlciwgZnVuY3Rpb24obWF0Y2gsIGVzY2FwZSwgaW50ZXJwb2xhdGUsIGV2YWx1YXRlLCBvZmZzZXQpIHtcbiAgICAgIHNvdXJjZSArPSB0ZXh0LnNsaWNlKGluZGV4LCBvZmZzZXQpLnJlcGxhY2UoZXNjYXBlciwgZXNjYXBlQ2hhcik7XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfSBlbHNlIGlmIChpbnRlcnBvbGF0ZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGludGVycG9sYXRlICsgXCIpKT09bnVsbD8nJzpfX3QpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cblxuICAgICAgLy8gQWRvYmUgVk1zIG5lZWQgdGhlIG1hdGNoIHJldHVybmVkIHRvIHByb2R1Y2UgdGhlIGNvcnJlY3Qgb2ZmZXN0LlxuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBJZiBhIHZhcmlhYmxlIGlzIG5vdCBzcGVjaWZpZWQsIHBsYWNlIGRhdGEgdmFsdWVzIGluIGxvY2FsIHNjb3BlLlxuICAgIGlmICghc2V0dGluZ3MudmFyaWFibGUpIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG5cbiAgICBzb3VyY2UgPSBcInZhciBfX3QsX19wPScnLF9faj1BcnJheS5wcm90b3R5cGUuam9pbixcIiArXG4gICAgICBcInByaW50PWZ1bmN0aW9uKCl7X19wKz1fX2ouY2FsbChhcmd1bWVudHMsJycpO307XFxuXCIgK1xuICAgICAgc291cmNlICsgJ3JldHVybiBfX3A7XFxuJztcblxuICAgIHRyeSB7XG4gICAgICB2YXIgcmVuZGVyID0gbmV3IEZ1bmN0aW9uKHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonLCAnXycsIHNvdXJjZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIHZhciB0ZW1wbGF0ZSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHJldHVybiByZW5kZXIuY2FsbCh0aGlzLCBkYXRhLCBfKTtcbiAgICB9O1xuXG4gICAgLy8gUHJvdmlkZSB0aGUgY29tcGlsZWQgc291cmNlIGFzIGEgY29udmVuaWVuY2UgZm9yIHByZWNvbXBpbGF0aW9uLlxuICAgIHZhciBhcmd1bWVudCA9IHNldHRpbmdzLnZhcmlhYmxlIHx8ICdvYmonO1xuICAgIHRlbXBsYXRlLnNvdXJjZSA9ICdmdW5jdGlvbignICsgYXJndW1lbnQgKyAnKXtcXG4nICsgc291cmNlICsgJ30nO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9O1xuXG4gIC8vIEFkZCBhIFwiY2hhaW5cIiBmdW5jdGlvbi4gU3RhcnQgY2hhaW5pbmcgYSB3cmFwcGVkIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLmNoYWluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGluc3RhbmNlID0gXyhvYmopO1xuICAgIGluc3RhbmNlLl9jaGFpbiA9IHRydWU7XG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9O1xuXG4gIC8vIE9PUFxuICAvLyAtLS0tLS0tLS0tLS0tLS1cbiAgLy8gSWYgVW5kZXJzY29yZSBpcyBjYWxsZWQgYXMgYSBmdW5jdGlvbiwgaXQgcmV0dXJucyBhIHdyYXBwZWQgb2JqZWN0IHRoYXRcbiAgLy8gY2FuIGJlIHVzZWQgT08tc3R5bGUuIFRoaXMgd3JhcHBlciBob2xkcyBhbHRlcmVkIHZlcnNpb25zIG9mIGFsbCB0aGVcbiAgLy8gdW5kZXJzY29yZSBmdW5jdGlvbnMuIFdyYXBwZWQgb2JqZWN0cyBtYXkgYmUgY2hhaW5lZC5cblxuICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gY29udGludWUgY2hhaW5pbmcgaW50ZXJtZWRpYXRlIHJlc3VsdHMuXG4gIHZhciByZXN1bHQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gdGhpcy5fY2hhaW4gPyBfKG9iaikuY2hhaW4oKSA6IG9iajtcbiAgfTtcblxuICAvLyBBZGQgeW91ciBvd24gY3VzdG9tIGZ1bmN0aW9ucyB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubWl4aW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICBfLmVhY2goXy5mdW5jdGlvbnMob2JqKSwgZnVuY3Rpb24obmFtZSkge1xuICAgICAgdmFyIGZ1bmMgPSBfW25hbWVdID0gb2JqW25hbWVdO1xuICAgICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBbdGhpcy5fd3JhcHBlZF07XG4gICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIGZ1bmMuYXBwbHkoXywgYXJncykpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBBZGQgYWxsIG9mIHRoZSBVbmRlcnNjb3JlIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlciBvYmplY3QuXG4gIF8ubWl4aW4oXyk7XG5cbiAgLy8gQWRkIGFsbCBtdXRhdG9yIEFycmF5IGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlci5cbiAgXy5lYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9iaiA9IHRoaXMuX3dyYXBwZWQ7XG4gICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKChuYW1lID09PSAnc2hpZnQnIHx8IG5hbWUgPT09ICdzcGxpY2UnKSAmJiBvYmoubGVuZ3RoID09PSAwKSBkZWxldGUgb2JqWzBdO1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGFsbCBhY2Nlc3NvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIF8uZWFjaChbJ2NvbmNhdCcsICdqb2luJywgJ3NsaWNlJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG1ldGhvZC5hcHBseSh0aGlzLl93cmFwcGVkLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBFeHRyYWN0cyB0aGUgcmVzdWx0IGZyb20gYSB3cmFwcGVkIGFuZCBjaGFpbmVkIG9iamVjdC5cbiAgXy5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fd3JhcHBlZDtcbiAgfTtcblxuICAvLyBBTUQgcmVnaXN0cmF0aW9uIGhhcHBlbnMgYXQgdGhlIGVuZCBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIEFNRCBsb2FkZXJzXG4gIC8vIHRoYXQgbWF5IG5vdCBlbmZvcmNlIG5leHQtdHVybiBzZW1hbnRpY3Mgb24gbW9kdWxlcy4gRXZlbiB0aG91Z2ggZ2VuZXJhbFxuICAvLyBwcmFjdGljZSBmb3IgQU1EIHJlZ2lzdHJhdGlvbiBpcyB0byBiZSBhbm9ueW1vdXMsIHVuZGVyc2NvcmUgcmVnaXN0ZXJzXG4gIC8vIGFzIGEgbmFtZWQgbW9kdWxlIGJlY2F1c2UsIGxpa2UgalF1ZXJ5LCBpdCBpcyBhIGJhc2UgbGlicmFyeSB0aGF0IGlzXG4gIC8vIHBvcHVsYXIgZW5vdWdoIHRvIGJlIGJ1bmRsZWQgaW4gYSB0aGlyZCBwYXJ0eSBsaWIsIGJ1dCBub3QgYmUgcGFydCBvZlxuICAvLyBhbiBBTUQgbG9hZCByZXF1ZXN0LiBUaG9zZSBjYXNlcyBjb3VsZCBnZW5lcmF0ZSBhbiBlcnJvciB3aGVuIGFuXG4gIC8vIGFub255bW91cyBkZWZpbmUoKSBpcyBjYWxsZWQgb3V0c2lkZSBvZiBhIGxvYWRlciByZXF1ZXN0LlxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKCd1bmRlcnNjb3JlJywgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIF87XG4gICAgfSk7XG4gIH1cbn0uY2FsbCh0aGlzKSk7XG4iXX0=
