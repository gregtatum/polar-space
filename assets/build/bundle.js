(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./js/poem.js":[function(require,module,exports){
var PolarConverter = require('./utils/PolarConverter');
var Camera = require('./Camera');
var Gun = require('./Gun');
var Ship = require('./Ship');
var Stars = require('./Stars');
var AsteroidField = require('./AsteroidField');
var Stats = require('./utils/Stats')

var Poem = module.exports = function() {
	
	//The current selected material saved to the hash
	var selectedMaterial = window.location.hash.substring(1) || "MeshPhongMaterial";

	this.r = 240;
	this.rSpeed = 1 / 120; //Map 2d X coordinates to polar coordinates
	this.width = 2 * Math.PI / this.rSpeed;
	this.height = 120;
	this.ratio = window.devicePixelRatio >= 1 ? window.devicePixelRatio : 1;
	
	this.renderer = undefined;
	this.controls = undefined;
	this.div = document.getElementById( 'container' );
	this.scene = new THREE.Scene();

	this.polarConverter = new PolarConverter( this );
	this.camera = new Camera( this );
	this.scene.fog = new THREE.Fog( 0x222222, this.camera.object.position.z / 2, this.camera.object.position.z * 2.5 );
	
	this.gun = new Gun( this );
	this.ship = new Ship( this );
	this.stars = new Stars( this );
	this.asteroidField = new AsteroidField( this, 50 );
	

	this.addRenderer();
	//this.addLights();

	// this.addGrid();
	this.addStats();
	this.addEventListeners();
	
	this.loop();
	
};
		
Poem.prototype = {
	
	addLights : function() {
		this.lights = [];
		this.lights[0] = new THREE.AmbientLight( 0xffffff );
		this.lights[1] = new THREE.PointLight( 0xffffff, 1, 0 );
		this.lights[2] = new THREE.PointLight( 0xffffff, 1, 0 );
		this.lights[3] = new THREE.PointLight( 0xffffff, 1, 0 );
		
		this.lights[1].position.set(0, 200, 0);
		this.lights[2].position.set(100, 200, 100);
		this.lights[3].position.set(-100, -200, -100);
		
		//this.scene.add( this.lights[0] );
		this.scene.add( this.lights[1] );
		this.scene.add( this.lights[2] );
		this.scene.add( this.lights[3] );
	},
	
	addRenderer : function() {
		this.renderer = new THREE.WebGLRenderer({
			alpha : true
		});
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.div.appendChild( this.renderer.domElement );
	},
	
	addStats : function() {
		this.stats = new Stats();
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.top = '0px';
		$("#container").append( this.stats.domElement );
	},
	
	addGrid : function() {

		var lineMaterial = new THREE.LineBasicMaterial( { color: 0x303030 } ),
			geometry = new THREE.Geometry(),
			floor = -75, step = 25;

		for ( var i = 0; i <= 40; i ++ ) {

			geometry.vertices.push( new THREE.Vector3( - 500, floor, i * step - 500 ) );
			geometry.vertices.push( new THREE.Vector3(   500, floor, i * step - 500 ) );

			geometry.vertices.push( new THREE.Vector3( i * step - 500, floor, -500 ) );
			geometry.vertices.push( new THREE.Vector3( i * step - 500, floor,  500 ) );

		}

		this.grid = new THREE.Line( geometry, lineMaterial, THREE.LinePieces );
		this.scene.add( this.grid );

	},
	
	addEventListeners : function() {
		$(window).on('resize', this.resizeHandler.bind(this));
	},
	
	resizeHandler : function() {
		
		this.camera.resize();
		this.renderer.setSize( window.innerWidth, window.innerHeight );

	},
			
	loop : function() {

		requestAnimationFrame( this.loop.bind(this) );
		this.update();

	},
			
	update : function() {
		//this.controls.update();
		this.stats.update();
		
		this.ship.update( 16.666 );
		this.gun.update( 16.666 );
		this.camera.update( 16.666 );
		this.asteroidField.update( 16.666 );
		
		this.renderer.render( this.scene, this.camera.object );
	},
	
};

var poem;

$(function() {
	poem = new Poem();
});
},{"./AsteroidField":"/Users/gregtatum/Dropbox/greg-sites/polar/js/AsteroidField.js","./Camera":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Camera.js","./Gun":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Gun.js","./Ship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js","./Stars":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Stars.js","./utils/PolarConverter":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/PolarConverter.js","./utils/Stats":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Stats.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Asteroid.js":[function(require,module,exports){
var Asteroid = module.exports = function( poem, x, y, radius ) {
	
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
	
	
	this.addObject(x, y);
	this.update();
	
};

Asteroid.prototype = {

	addObject : function() {
		
		var geometry = new THREE.OctahedronGeometry(this.radius, 1);
		
		//Disform
		_.each(geometry.vertices, function( vertex ) {
			vertex.x += (this.radius / 2) * (Math.random() - 0.5);
			vertex.y += (this.radius / 2) * (Math.random() - 0.5);
			vertex.z += (this.radius / 2) * (Math.random() - 0.5);
		}, this);
		
		var material = new THREE.MeshBasicMaterial({color:0x111111});
		this.object = new THREE.Mesh( geometry, material );
		
		var outlineMat = new THREE.MeshBasicMaterial({color:0xffffff, side: THREE.BackSide});
		var outlineObj = new THREE.Mesh( geometry, outlineMat );
		outlineObj.scale.multiplyScalar( 1.05);
		
		this.object.add( outlineObj );
		
		this.poem.scene.add( this.object );
		
		this.speed.x = (0.5 - Math.random()) * this.maxSpeed;
		this.speed.y = (0.5 - Math.random()) * this.maxSpeed;
		
		this.rotationSpeed.x = (0.5 - Math.random()) * this.maxRotationSpeed;
		this.rotationSpeed.y = (0.5 - Math.random()) * this.maxRotationSpeed;
		this.rotationSpeed.z = (0.5 - Math.random()) * this.maxRotationSpeed;
		
		this.oscillation = Math.random() * Math.PI * 2;
	},
	
	update : function() {
		
		this.oscillation += this.speed.y;
		this.position.x += this.speed.x;
		this.position.y = Math.sin( this.oscillation / 50 ) * this.poem.height;
		
		this.object.rotation.x += this.rotationSpeed.x;	
		this.object.rotation.y += this.rotationSpeed.y;	
		this.object.rotation.z += this.rotationSpeed.z;	
		
		this.poem.polarConverter.setVector( this.object.position, this.position );
	}
	
}
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/AsteroidField.js":[function(require,module,exports){
var Asteroid = require('./Asteroid');

var AsteroidField = module.exports = function( poem, count ) {
	
	this.poem = poem;
	this.asteroids = []
	this.maxRadius = 20;
	this.originClearance = 30;
	
	this.generate( count );
	
};

AsteroidField.prototype = {
	
	generate : function( count ) {
		
		var i, x, y, height, width;
		
		height = this.poem.height * 4;
		width = this.poem.width;
		

		for( i=0; i < count; i++ ) {
			
			do {
				
				x = Math.random() * width;
				y = Math.random() * height - (height / 2)
			
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
	
	update : function() {
		
		_.each( this.asteroids, function(asteroid) {
			
			asteroid.update();
			
		}, this);
		
		var shipCollision = this.checkCollision(
			this.poem.ship.position.x,
			this.poem.ship.position.y,
			2
		);
		
		if( shipCollision ) {
			this.poem.ship.reset();
		}
		
	},
	
	checkFreeOfOrigin : function( x, y, radius ) {
		return Math.sqrt(x*x + y*y) > radius + this.originClearance;
	},
	
	checkCollision : function( x, y, radius ) {
		
		var collision = _.find( this.asteroids, function( asteroid ) {
			
			var dx, dy, distance;
			
			dx = x - asteroid.position.x;
			dy = y - asteroid.position.y;
			distance = Math.sqrt(dx * dx + dy * dy);

			return distance < radius + asteroid.radius;
			
		});
		
		return !!collision;
	}
};
},{"./Asteroid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Asteroid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Bullet.js":[function(require,module,exports){
var Bullet = module.exports = function( poem, gun, vertex ) {
	this.poem = poem;
	this.gun = gun;
	this.vertex = vertex;
	
	this.speed = new THREE.Vector2(0,0);
	this.position = new THREE.Vector2(0,0);
	
	this.bornAt = 0;
	this.alive = false;
};

Bullet.prototype = {
	
	kill : function() {
		this.vertex.set(0, 0 ,1000);
		this.alive = false;
	},
	
	update : function( dt ) {
		
		var x,y,z;
		
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
		
		this.poem.polarConverter.setVector( this.vertex, this.position );
		
	},
	
	fire : function(x, y, speed, theta) {
				
		this.poem.polarConverter.setVector( this.vertex, x, y );
		
		this.position.set(x,y);
		
		this.speed.x = Math.cos( theta ) * speed;
		this.speed.y = Math.sin( theta ) * speed;
		
		this.bornAt = new Date().getTime();
		this.alive = true;
	}
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Camera.js":[function(require,module,exports){
var Camera = module.exports = function( poem ) {
	
	this.poem = poem;
	
	this.polarObj = new THREE.Object3D();
	
	this.speed = 0.016;
	
	this.object = new THREE.PerspectiveCamera(
		50,										// fov
		window.innerWidth / window.innerHeight,	// aspect ratio
		3,										// near frustum
		1000									// far frustum
	);
	this.object.position.z = this.poem.r * 1.5;
	
	this.polarObj.add( this.object );
	this.poem.scene.add( this.polarObj );
	
};

Camera.prototype = {
	
	resize : function() {
		this.object.aspect = window.innerWidth / window.innerHeight;
		this.object.updateProjectionMatrix();
	},
	
	update : function( dt ) {
		
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
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Gun.js":[function(require,module,exports){
var Bullet = require('./Bullet');

var Gun = module.exports = function( poem ) {
	this.poem = poem;
	this.object = null;
	
	this.count = 350;
	this.bulletAge = 5000;
	this.liveBullets = [];
	this.bullets = [];
	this.bornAt = 0;

	this.addObject();
};

Gun.prototype = {
	
	fire : function() {
		
		var isDead = function( bullet ) {
			return !bullet.alive;
		}
		
		return function(x, y, speed, theta) {
		
			var bullet = _.find( this.bullets, isDead );
		
			if( !bullet ) return;
		
			this.liveBullets.push( bullet );
		
			bullet.fire(x, y, speed, theta);
		};
	}(),
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		geometry = new THREE.Geometry();
		
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
	
	update : function( dt )  {
		var bullet, time;
		
		now = new Date().getTime();
		
		for(var i=0; i<this.liveBullets.length; i++) {
			bullet = this.liveBullets[i];
			
			if(bullet.bornAt + this.bulletAge < now) {
				this.killBullet( bullet );
				i--;
			} else {
				bullet.update( dt );
			}
		}
		if(this.liveBullets.length > 0) {
			this.object.geometry.verticesNeedUpdate = true;
		}
		
	}
};
},{"./Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Bullet.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Hid.js":[function(require,module,exports){
var EventDispatcher = require('./utils/EventDispatcher');

var HID = module.exports = function() {
	
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
	}
	
	this.pressed = _.clone(states);
	this.down = _.clone(states);
	this.up = _.clone(states);
	
	$(window).on('keydown', this.keydown.bind(this));
	$(window).on('keyup', this.keyup.bind(this));
	
};

HID.prototype = {
	
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
	
	update : function() {
		
		var falsify = function (value, key, list) {
			list[key] = false
		}
		
		return function() {
			_.each( this.down, falsify );
			_.each( this.up, falsify );
		};
		
	}()
	
};

EventDispatcher.prototype.apply( HID.prototype );
},{"./utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js":[function(require,module,exports){
var HID = require('./Hid');

var Ship = module.exports = function( poem ) {
	
	this.poem = poem;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;
	this.hid = new HID();
	this.color = 0x4A9DE7;
	this.linewidth = 2 * this.poem.ratio;
	
	this.position = new THREE.Vector2();
	
	
	
	this.speed = 0;
	
	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;
	
	this.thrustSpeed = 0.001;
	this.thrust = 0;
	
	this.bankSpeed = 0.06;
	this.bank = 0;
	this.maxSpeed = 1000;

	this.addObject();

};


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
	
	reset : function() {
		this.position.x = 0;
		this.position.y = 0;
		this.speed = 0.2;
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},
	
	update : function( dt ) {
		
		this.updateThrustAndBank( dt );
		this.updateEdgeAvoidance( dt );
		this.updatePosition( dt );
		this.updateFiring( dt );
		this.hid.update( dt );
		
	},
	
	updateThrustAndBank : function( dt ) {
		var pressed = this.hid.pressed;
			
		this.bank *= 0.9;
		this.thrust = 0;
			
		if( pressed.up ) {
			this.thrust += this.thrustSpeed * dt;
			}
		
		if( pressed.down ) {
			this.thrust -= this.thrustSpeed * dt;	
		}
		
		if( pressed.left ) {
			this.bank = this.bankSpeed;
		}
		
		if( pressed.right ) {
			this.bank = this.bankSpeed * -1;
		}
	},
	
	updateEdgeAvoidance : function( dt ) {
		
		var nearEdge, farEdge, position, normalizedEdgePosition, bankDirection, absPosition;
		
		farEdge = this.poem.height / 2;
		nearEdge = 4/5 * farEdge;
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
	
	updateFiring : function() {
		if( this.hid.pressed.spacebar ) {
			this.poem.gun.fire( this.position.x, this.position.y, 2, this.object.rotation.z );
		}
	},
	
	updatePosition : function( dt ) {
		
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
			// this.object.position.x = Math.cos( this.position.x * this.poem.rSpeed ) * this.poem.r;
			// this.object.position.z = Math.sin( this.position.x * this.poem.rSpeed ) * this.poem.r;
			this.polarObj.rotation.y = this.position.x * this.poem.rSpeed;
			
		};
		
	}()
	
	
};
},{"./Hid":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Hid.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Stars.js":[function(require,module,exports){
var Stars = module.exports = function( poem ) {
	this.poem = poem;
	this.object = null;
	
	this.count = 20000;
	this.depth = 10;
	
	this.addObject();
};

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
				 color: 0x999999,
				 fog: false
			}
		) );
		
		
		
		this.poem.scene.add( this.object ) ;
		
	}
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js":[function(require,module,exports){
/**
 * @author mrdoob / http://mrdoob.com/
 */

var EventDispatcher = function () {}

EventDispatcher.prototype = {

	constructor: EventDispatcher,

	apply: function ( object ) {

		object.addEventListener = EventDispatcher.prototype.addEventListener;
		object.hasEventListener = EventDispatcher.prototype.hasEventListener;
		object.removeEventListener = EventDispatcher.prototype.removeEventListener;
		object.dispatchEvent = EventDispatcher.prototype.dispatchEvent;

	},

	addEventListener: function ( type, listener ) {

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

	removeEventListener: function ( type, listener ) {

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

	dispatchEvent: function ( event ) {
			
		if ( this._listeners === undefined ) return;

		var listeners = this._listeners;
		var listenerArray = listeners[ event.type ];

		if ( listenerArray !== undefined ) {

			event.target = this;

			var array = [];
			var length = listenerArray.length;

			for ( var i = 0; i < length; i ++ ) {

				array[ i ] = listenerArray[ i ];

			}

			for ( var i = 0; i < length; i ++ ) {

				array[ i ].call( this, event );

			}

		}

	}

};

if ( typeof module === 'object' ) {

	module.exports = EventDispatcher;

}
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/PolarConverter.js":[function(require,module,exports){
// Translates 2d points into 3d polar space

var PolarConverter = module.exports = function( poem ) {
	this.poem = poem;
};

PolarConverter.prototype = {
	
	x : function( x ) {
		return Math.sin( x * this.poem.rSpeed ) * this.poem.r;
	},
	
	y : function( y ) {
		return y;
	},
	
	z : function( x ) {
		return Math.cos( x * this.poem.rSpeed ) * this.poem.r;
	},
	
	r : function(x, z) {
		return Math.sqrt(x*x + z*z);
	},
	
	theta : function(x, z) {
		return Math.atan( z / x );
	},
	
	setVector : function( vector /* x, y OR vector */) {
		
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
		
	}
	
};

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
	container.addEventListener( 'mousedown', function ( event ) { event.preventDefault(); setMode( ++ mode % 2 ) }, false );
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

		var bar = document.createElement( 'span' );
		bar.style.cssText = 'width:1px;height:30px;float:left;background-color:#131';
		msGraph.appendChild( bar );

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

	}

};

if ( typeof module === 'object' ) {

	module.exports = Stats;

}
},{}]},{},["./js/poem.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2pzL3BvZW0uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9Bc3Rlcm9pZC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL0FzdGVyb2lkRmllbGQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9CdWxsZXQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9DYW1lcmEuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9HdW4uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9IaWQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9TaGlwLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvU3RhcnMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9FdmVudERpc3BhdGNoZXIuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9Qb2xhckNvbnZlcnRlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL1N0YXRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgUG9sYXJDb252ZXJ0ZXIgPSByZXF1aXJlKCcuL3V0aWxzL1BvbGFyQ29udmVydGVyJyk7XG52YXIgQ2FtZXJhID0gcmVxdWlyZSgnLi9DYW1lcmEnKTtcbnZhciBHdW4gPSByZXF1aXJlKCcuL0d1bicpO1xudmFyIFNoaXAgPSByZXF1aXJlKCcuL1NoaXAnKTtcbnZhciBTdGFycyA9IHJlcXVpcmUoJy4vU3RhcnMnKTtcbnZhciBBc3Rlcm9pZEZpZWxkID0gcmVxdWlyZSgnLi9Bc3Rlcm9pZEZpZWxkJyk7XG52YXIgU3RhdHMgPSByZXF1aXJlKCcuL3V0aWxzL1N0YXRzJylcblxudmFyIFBvZW0gPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuXHRcblx0Ly9UaGUgY3VycmVudCBzZWxlY3RlZCBtYXRlcmlhbCBzYXZlZCB0byB0aGUgaGFzaFxuXHR2YXIgc2VsZWN0ZWRNYXRlcmlhbCA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnN1YnN0cmluZygxKSB8fCBcIk1lc2hQaG9uZ01hdGVyaWFsXCI7XG5cblx0dGhpcy5yID0gMjQwO1xuXHR0aGlzLnJTcGVlZCA9IDEgLyAxMjA7IC8vTWFwIDJkIFggY29vcmRpbmF0ZXMgdG8gcG9sYXIgY29vcmRpbmF0ZXNcblx0dGhpcy53aWR0aCA9IDIgKiBNYXRoLlBJIC8gdGhpcy5yU3BlZWQ7XG5cdHRoaXMuaGVpZ2h0ID0gMTIwO1xuXHR0aGlzLnJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gPj0gMSA/IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIDogMTtcblx0XG5cdHRoaXMucmVuZGVyZXIgPSB1bmRlZmluZWQ7XG5cdHRoaXMuY29udHJvbHMgPSB1bmRlZmluZWQ7XG5cdHRoaXMuZGl2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjb250YWluZXInICk7XG5cdHRoaXMuc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcblxuXHR0aGlzLnBvbGFyQ29udmVydGVyID0gbmV3IFBvbGFyQ29udmVydGVyKCB0aGlzICk7XG5cdHRoaXMuY2FtZXJhID0gbmV3IENhbWVyYSggdGhpcyApO1xuXHR0aGlzLnNjZW5lLmZvZyA9IG5ldyBUSFJFRS5Gb2coIDB4MjIyMjIyLCB0aGlzLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueiAvIDIsIHRoaXMuY2FtZXJhLm9iamVjdC5wb3NpdGlvbi56ICogMi41ICk7XG5cdFxuXHR0aGlzLmd1biA9IG5ldyBHdW4oIHRoaXMgKTtcblx0dGhpcy5zaGlwID0gbmV3IFNoaXAoIHRoaXMgKTtcblx0dGhpcy5zdGFycyA9IG5ldyBTdGFycyggdGhpcyApO1xuXHR0aGlzLmFzdGVyb2lkRmllbGQgPSBuZXcgQXN0ZXJvaWRGaWVsZCggdGhpcywgNTAgKTtcblx0XG5cblx0dGhpcy5hZGRSZW5kZXJlcigpO1xuXHQvL3RoaXMuYWRkTGlnaHRzKCk7XG5cblx0Ly8gdGhpcy5hZGRHcmlkKCk7XG5cdHRoaXMuYWRkU3RhdHMoKTtcblx0dGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuXHRcblx0dGhpcy5sb29wKCk7XG5cdFxufTtcblx0XHRcblBvZW0ucHJvdG90eXBlID0ge1xuXHRcblx0YWRkTGlnaHRzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5saWdodHMgPSBbXTtcblx0XHR0aGlzLmxpZ2h0c1swXSA9IG5ldyBUSFJFRS5BbWJpZW50TGlnaHQoIDB4ZmZmZmZmICk7XG5cdFx0dGhpcy5saWdodHNbMV0gPSBuZXcgVEhSRUUuUG9pbnRMaWdodCggMHhmZmZmZmYsIDEsIDAgKTtcblx0XHR0aGlzLmxpZ2h0c1syXSA9IG5ldyBUSFJFRS5Qb2ludExpZ2h0KCAweGZmZmZmZiwgMSwgMCApO1xuXHRcdHRoaXMubGlnaHRzWzNdID0gbmV3IFRIUkVFLlBvaW50TGlnaHQoIDB4ZmZmZmZmLCAxLCAwICk7XG5cdFx0XG5cdFx0dGhpcy5saWdodHNbMV0ucG9zaXRpb24uc2V0KDAsIDIwMCwgMCk7XG5cdFx0dGhpcy5saWdodHNbMl0ucG9zaXRpb24uc2V0KDEwMCwgMjAwLCAxMDApO1xuXHRcdHRoaXMubGlnaHRzWzNdLnBvc2l0aW9uLnNldCgtMTAwLCAtMjAwLCAtMTAwKTtcblx0XHRcblx0XHQvL3RoaXMuc2NlbmUuYWRkKCB0aGlzLmxpZ2h0c1swXSApO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLmxpZ2h0c1sxXSApO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLmxpZ2h0c1syXSApO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLmxpZ2h0c1szXSApO1xuXHR9LFxuXHRcblx0YWRkUmVuZGVyZXIgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoe1xuXHRcdFx0YWxwaGEgOiB0cnVlXG5cdFx0fSk7XG5cdFx0dGhpcy5yZW5kZXJlci5zZXRTaXplKCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XG5cdFx0dGhpcy5kaXYuYXBwZW5kQ2hpbGQoIHRoaXMucmVuZGVyZXIuZG9tRWxlbWVudCApO1xuXHR9LFxuXHRcblx0YWRkU3RhdHMgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnN0YXRzID0gbmV3IFN0YXRzKCk7XG5cdFx0dGhpcy5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcblx0XHR0aGlzLnN0YXRzLmRvbUVsZW1lbnQuc3R5bGUudG9wID0gJzBweCc7XG5cdFx0JChcIiNjb250YWluZXJcIikuYXBwZW5kKCB0aGlzLnN0YXRzLmRvbUVsZW1lbnQgKTtcblx0fSxcblx0XG5cdGFkZEdyaWQgOiBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoIHsgY29sb3I6IDB4MzAzMDMwIH0gKSxcblx0XHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCksXG5cdFx0XHRmbG9vciA9IC03NSwgc3RlcCA9IDI1O1xuXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDw9IDQwOyBpICsrICkge1xuXG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyggLSA1MDAsIGZsb29yLCBpICogc3RlcCAtIDUwMCApICk7XG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyggICA1MDAsIGZsb29yLCBpICogc3RlcCAtIDUwMCApICk7XG5cblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCBpICogc3RlcCAtIDUwMCwgZmxvb3IsIC01MDAgKSApO1xuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIGkgKiBzdGVwIC0gNTAwLCBmbG9vciwgIDUwMCApICk7XG5cblx0XHR9XG5cblx0XHR0aGlzLmdyaWQgPSBuZXcgVEhSRUUuTGluZSggZ2VvbWV0cnksIGxpbmVNYXRlcmlhbCwgVEhSRUUuTGluZVBpZWNlcyApO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLmdyaWQgKTtcblxuXHR9LFxuXHRcblx0YWRkRXZlbnRMaXN0ZW5lcnMgOiBmdW5jdGlvbigpIHtcblx0XHQkKHdpbmRvdykub24oJ3Jlc2l6ZScsIHRoaXMucmVzaXplSGFuZGxlci5iaW5kKHRoaXMpKTtcblx0fSxcblx0XG5cdHJlc2l6ZUhhbmRsZXIgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLmNhbWVyYS5yZXNpemUoKTtcblx0XHR0aGlzLnJlbmRlcmVyLnNldFNpemUoIHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQgKTtcblxuXHR9LFxuXHRcdFx0XG5cdGxvb3AgOiBmdW5jdGlvbigpIHtcblxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSggdGhpcy5sb29wLmJpbmQodGhpcykgKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdH0sXG5cdFx0XHRcblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0Ly90aGlzLmNvbnRyb2xzLnVwZGF0ZSgpO1xuXHRcdHRoaXMuc3RhdHMudXBkYXRlKCk7XG5cdFx0XG5cdFx0dGhpcy5zaGlwLnVwZGF0ZSggMTYuNjY2ICk7XG5cdFx0dGhpcy5ndW4udXBkYXRlKCAxNi42NjYgKTtcblx0XHR0aGlzLmNhbWVyYS51cGRhdGUoIDE2LjY2NiApO1xuXHRcdHRoaXMuYXN0ZXJvaWRGaWVsZC51cGRhdGUoIDE2LjY2NiApO1xuXHRcdFxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYS5vYmplY3QgKTtcblx0fSxcblx0XG59O1xuXG52YXIgcG9lbTtcblxuJChmdW5jdGlvbigpIHtcblx0cG9lbSA9IG5ldyBQb2VtKCk7XG59KTsiLCJ2YXIgQXN0ZXJvaWQgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBwb2VtLCB4LCB5LCByYWRpdXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdFxuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5wb3NpdGlvbi54ID0geCB8fCAwO1xuXHR0aGlzLnBvc2l0aW9uLnkgPSB5IHx8IDA7XG5cdHRoaXMub3NjaWxsYXRpb24gPSAwO1xuXHR0aGlzLnJhZGl1cyA9IHJhZGl1cyB8fCA1O1xuXHR0aGlzLnNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0dGhpcy5yb3RhdGlvblNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0dGhpcy5tYXhTcGVlZCA9IDAuNTtcblx0dGhpcy5tYXhSb3RhdGlvblNwZWVkID0gMC4xO1xuXHRcblx0XG5cdHRoaXMuYWRkT2JqZWN0KHgsIHkpO1xuXHR0aGlzLnVwZGF0ZSgpO1xuXHRcbn07XG5cbkFzdGVyb2lkLnByb3RvdHlwZSA9IHtcblxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuT2N0YWhlZHJvbkdlb21ldHJ5KHRoaXMucmFkaXVzLCAxKTtcblx0XHRcblx0XHQvL0Rpc2Zvcm1cblx0XHRfLmVhY2goZ2VvbWV0cnkudmVydGljZXMsIGZ1bmN0aW9uKCB2ZXJ0ZXggKSB7XG5cdFx0XHR2ZXJ0ZXgueCArPSAodGhpcy5yYWRpdXMgLyAyKSAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcblx0XHRcdHZlcnRleC55ICs9ICh0aGlzLnJhZGl1cyAvIDIpICogKE1hdGgucmFuZG9tKCkgLSAwLjUpO1xuXHRcdFx0dmVydGV4LnogKz0gKHRoaXMucmFkaXVzIC8gMikgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0dmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjoweDExMTExMX0pO1xuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBtYXRlcmlhbCApO1xuXHRcdFxuXHRcdHZhciBvdXRsaW5lTWF0ID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjoweGZmZmZmZiwgc2lkZTogVEhSRUUuQmFja1NpZGV9KTtcblx0XHR2YXIgb3V0bGluZU9iaiA9IG5ldyBUSFJFRS5NZXNoKCBnZW9tZXRyeSwgb3V0bGluZU1hdCApO1xuXHRcdG91dGxpbmVPYmouc2NhbGUubXVsdGlwbHlTY2FsYXIoIDEuMDUpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0LmFkZCggb3V0bGluZU9iaiApO1xuXHRcdFxuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0XG5cdFx0dGhpcy5zcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhTcGVlZDtcblx0XHR0aGlzLnNwZWVkLnkgPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFNwZWVkO1xuXHRcdFxuXHRcdHRoaXMucm90YXRpb25TcGVlZC54ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC55ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdHRoaXMucm90YXRpb25TcGVlZC56ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5tYXhSb3RhdGlvblNwZWVkO1xuXHRcdFxuXHRcdHRoaXMub3NjaWxsYXRpb24gPSBNYXRoLnJhbmRvbSgpICogTWF0aC5QSSAqIDI7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0aW9uICs9IHRoaXMuc3BlZWQueTtcblx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZC54O1xuXHRcdHRoaXMucG9zaXRpb24ueSA9IE1hdGguc2luKCB0aGlzLm9zY2lsbGF0aW9uIC8gNTAgKSAqIHRoaXMucG9lbS5oZWlnaHQ7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueCArPSB0aGlzLnJvdGF0aW9uU3BlZWQueDtcdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnkgKz0gdGhpcy5yb3RhdGlvblNwZWVkLnk7XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IHRoaXMucm90YXRpb25TcGVlZC56O1x0XG5cdFx0XG5cdFx0dGhpcy5wb2VtLnBvbGFyQ29udmVydGVyLnNldFZlY3RvciggdGhpcy5vYmplY3QucG9zaXRpb24sIHRoaXMucG9zaXRpb24gKTtcblx0fVxuXHRcbn0iLCJ2YXIgQXN0ZXJvaWQgPSByZXF1aXJlKCcuL0FzdGVyb2lkJyk7XG5cbnZhciBBc3Rlcm9pZEZpZWxkID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggcG9lbSwgY291bnQgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmFzdGVyb2lkcyA9IFtdXG5cdHRoaXMubWF4UmFkaXVzID0gMjA7XG5cdHRoaXMub3JpZ2luQ2xlYXJhbmNlID0gMzA7XG5cdFxuXHR0aGlzLmdlbmVyYXRlKCBjb3VudCApO1xuXHRcbn07XG5cbkFzdGVyb2lkRmllbGQucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0XG5cdFx0dmFyIGksIHgsIHksIGhlaWdodCwgd2lkdGg7XG5cdFx0XG5cdFx0aGVpZ2h0ID0gdGhpcy5wb2VtLmhlaWdodCAqIDQ7XG5cdFx0d2lkdGggPSB0aGlzLnBvZW0ud2lkdGg7XG5cdFx0XG5cblx0XHRmb3IoIGk9MDsgaSA8IGNvdW50OyBpKysgKSB7XG5cdFx0XHRcblx0XHRcdGRvIHtcblx0XHRcdFx0XG5cdFx0XHRcdHggPSBNYXRoLnJhbmRvbSgpICogd2lkdGg7XG5cdFx0XHRcdHkgPSBNYXRoLnJhbmRvbSgpICogaGVpZ2h0IC0gKGhlaWdodCAvIDIpXG5cdFx0XHRcblx0XHRcdFx0cmFkaXVzID0gTWF0aC5yYW5kb20oKSAqIHRoaXMubWF4UmFkaXVzO1xuXHRcdFx0XHRcblx0XHRcdH0gd2hpbGUoXG5cdFx0XHRcdHRoaXMuY2hlY2tDb2xsaXNpb24oIHgsIHksIHJhZGl1cyApICYmXG5cdFx0XHRcdHRoaXMuY2hlY2tGcmVlT2ZPcmlnaW4oIHgsIHksIHJhZGl1cyApXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmFzdGVyb2lkcy5wdXNoKFxuXHRcdFx0XHRuZXcgQXN0ZXJvaWQoIHRoaXMucG9lbSwgeCwgeSwgcmFkaXVzIClcblx0XHRcdCk7XG5cdFx0XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLmFzdGVyb2lkcywgZnVuY3Rpb24oYXN0ZXJvaWQpIHtcblx0XHRcdFxuXHRcdFx0YXN0ZXJvaWQudXBkYXRlKCk7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHR2YXIgc2hpcENvbGxpc2lvbiA9IHRoaXMuY2hlY2tDb2xsaXNpb24oXG5cdFx0XHR0aGlzLnBvZW0uc2hpcC5wb3NpdGlvbi54LFxuXHRcdFx0dGhpcy5wb2VtLnNoaXAucG9zaXRpb24ueSxcblx0XHRcdDJcblx0XHQpO1xuXHRcdFxuXHRcdGlmKCBzaGlwQ29sbGlzaW9uICkge1xuXHRcdFx0dGhpcy5wb2VtLnNoaXAucmVzZXQoKTtcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRjaGVja0ZyZWVPZk9yaWdpbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0cmV0dXJuIE1hdGguc3FydCh4KnggKyB5KnkpID4gcmFkaXVzICsgdGhpcy5vcmlnaW5DbGVhcmFuY2U7XG5cdH0sXG5cdFxuXHRjaGVja0NvbGxpc2lvbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0XG5cdFx0dmFyIGNvbGxpc2lvbiA9IF8uZmluZCggdGhpcy5hc3Rlcm9pZHMsIGZ1bmN0aW9uKCBhc3Rlcm9pZCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGR4LCBkeSwgZGlzdGFuY2U7XG5cdFx0XHRcblx0XHRcdGR4ID0geCAtIGFzdGVyb2lkLnBvc2l0aW9uLng7XG5cdFx0XHRkeSA9IHkgLSBhc3Rlcm9pZC5wb3NpdGlvbi55O1xuXHRcdFx0ZGlzdGFuY2UgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXG5cdFx0XHRyZXR1cm4gZGlzdGFuY2UgPCByYWRpdXMgKyBhc3Rlcm9pZC5yYWRpdXM7XG5cdFx0XHRcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gISFjb2xsaXNpb247XG5cdH1cbn07IiwidmFyIEJ1bGxldCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oIHBvZW0sIGd1biwgdmVydGV4ICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmd1biA9IGd1bjtcblx0dGhpcy52ZXJ0ZXggPSB2ZXJ0ZXg7XG5cdFxuXHR0aGlzLnNwZWVkID0gbmV3IFRIUkVFLlZlY3RvcjIoMCwwKTtcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKDAsMCk7XG5cdFxuXHR0aGlzLmJvcm5BdCA9IDA7XG5cdHRoaXMuYWxpdmUgPSBmYWxzZTtcbn07XG5cbkJ1bGxldC5wcm90b3R5cGUgPSB7XG5cdFxuXHRraWxsIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy52ZXJ0ZXguc2V0KDAsIDAgLDEwMDApO1xuXHRcdHRoaXMuYWxpdmUgPSBmYWxzZTtcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBkdCApIHtcblx0XHRcblx0XHR2YXIgeCx5LHo7XG5cdFx0XG5cdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQueDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgKz0gdGhpcy5zcGVlZC55O1xuXHRcdFxuXHRcdHRoaXMucG9lbS5wb2xhckNvbnZlcnRlci5zZXRWZWN0b3IoIHRoaXMudmVydGV4LCB0aGlzLnBvc2l0aW9uICk7XG5cdFx0XG5cdH0sXG5cdFxuXHRmaXJlIDogZnVuY3Rpb24oeCwgeSwgc3BlZWQsIHRoZXRhKSB7XG5cdFx0XHRcdFxuXHRcdHRoaXMucG9lbS5wb2xhckNvbnZlcnRlci5zZXRWZWN0b3IoIHRoaXMudmVydGV4LCB4LCB5ICk7XG5cdFx0XG5cdFx0dGhpcy5wb3NpdGlvbi5zZXQoeCx5KTtcblx0XHRcblx0XHR0aGlzLnNwZWVkLnggPSBNYXRoLmNvcyggdGhldGEgKSAqIHNwZWVkO1xuXHRcdHRoaXMuc3BlZWQueSA9IE1hdGguc2luKCB0aGV0YSApICogc3BlZWQ7XG5cdFx0XG5cdFx0dGhpcy5ib3JuQXQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHR0aGlzLmFsaXZlID0gdHJ1ZTtcblx0fVxufTsiLCJ2YXIgQ2FtZXJhID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdFxuXHR0aGlzLnBvbGFyT2JqID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdFxuXHR0aGlzLnNwZWVkID0gMC4wMTY7XG5cdFxuXHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYShcblx0XHQ1MCxcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGZvdlxuXHRcdHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LFx0Ly8gYXNwZWN0IHJhdGlvXG5cdFx0MyxcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIG5lYXIgZnJ1c3R1bVxuXHRcdDEwMDBcdFx0XHRcdFx0XHRcdFx0XHQvLyBmYXIgZnJ1c3R1bVxuXHQpO1xuXHR0aGlzLm9iamVjdC5wb3NpdGlvbi56ID0gdGhpcy5wb2VtLnIgKiAxLjU7XG5cdFxuXHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5wb2xhck9iaiApO1xuXHRcbn07XG5cbkNhbWVyYS5wcm90b3R5cGUgPSB7XG5cdFxuXHRyZXNpemUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm9iamVjdC5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0XHR0aGlzLm9iamVjdC51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZHQgKSB7XG5cdFx0XG5cdFx0dmFyIHRoaXNUaGV0YSA9IHRoaXMucG9sYXJPYmoucm90YXRpb24ueTtcblx0XHR2YXIgdGhhdFRoZXRhID0gdGhpcy5wb2VtLnNoaXAucG9sYXJPYmoucm90YXRpb24ueTtcblx0XHR2YXIgdGhldGFEaWZmID0gTWF0aC5hYnModGhpc1RoZXRhIC0gdGhhdFRoZXRhKTtcblx0XHRcblx0XHQvLyBpZiggdGhldGFEaWZmID4gMC4yICkge1xuXHRcdFxuXHRcdFx0dGhpcy5wb2xhck9iai5yb3RhdGlvbi55ID1cblx0XHRcdFx0dGhhdFRoZXRhICogKHRoaXMuc3BlZWQpICtcblx0XHRcdFx0dGhpc1RoZXRhICogKDEgLSB0aGlzLnNwZWVkKTtcblx0XHRcdFx0XG5cdFx0Ly8gfVxuXHRcdFxuXHR9XG59OyIsInZhciBCdWxsZXQgPSByZXF1aXJlKCcuL0J1bGxldCcpO1xuXG52YXIgR3VuID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHRcblx0dGhpcy5jb3VudCA9IDM1MDtcblx0dGhpcy5idWxsZXRBZ2UgPSA1MDAwO1xuXHR0aGlzLmxpdmVCdWxsZXRzID0gW107XG5cdHRoaXMuYnVsbGV0cyA9IFtdO1xuXHR0aGlzLmJvcm5BdCA9IDA7XG5cblx0dGhpcy5hZGRPYmplY3QoKTtcbn07XG5cbkd1bi5wcm90b3R5cGUgPSB7XG5cdFxuXHRmaXJlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGlzRGVhZCA9IGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XHRyZXR1cm4gIWJ1bGxldC5hbGl2ZTtcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKHgsIHksIHNwZWVkLCB0aGV0YSkge1xuXHRcdFxuXHRcdFx0dmFyIGJ1bGxldCA9IF8uZmluZCggdGhpcy5idWxsZXRzLCBpc0RlYWQgKTtcblx0XHRcblx0XHRcdGlmKCAhYnVsbGV0ICkgcmV0dXJuO1xuXHRcdFxuXHRcdFx0dGhpcy5saXZlQnVsbGV0cy5wdXNoKCBidWxsZXQgKTtcblx0XHRcblx0XHRcdGJ1bGxldC5maXJlKHgsIHksIHNwZWVkLCB0aGV0YSk7XG5cdFx0fTtcblx0fSgpLFxuXHRcblx0Z2VuZXJhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciB2ZXJ0ZXgsIGJ1bGxldDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRcdFxuXHRcdGZvcih2YXIgaT0wOyBpIDwgdGhpcy5jb3VudDsgaSsrKSB7XG5cdFx0XHRcblx0XHRcdHZlcnRleCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0XHRidWxsZXQgPSBuZXcgQnVsbGV0KCB0aGlzLnBvZW0sIHRoaXMsIHZlcnRleCApO1xuXHRcdFx0XG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCB2ZXJ0ZXggKTtcblx0XHRcdHRoaXMuYnVsbGV0cy5wdXNoKCBidWxsZXQgKTtcblx0XHRcdFxuXHRcdFx0YnVsbGV0LmtpbGwoKTtcblx0XHRcdFx0XHRcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHR9LFxuXHRcblx0a2lsbEJ1bGxldCA6IGZ1bmN0aW9uKCBidWxsZXQgKSB7XG5cdFx0XG5cdFx0dmFyIGkgPSB0aGlzLmxpdmVCdWxsZXRzLmluZGV4T2YoIGJ1bGxldCApO1xuXHRcdFxuXHRcdGlmKCBpID49IDAgKSB7XG5cdFx0XHR0aGlzLmxpdmVCdWxsZXRzLnNwbGljZSggaSwgMSApO1xuXHRcdH1cblx0XHRcblx0XHRidWxsZXQua2lsbCgpO1xuXHRcdFxuXHRcdGlmKCB0aGlzLm9iamVjdCApIHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuZ2VuZXJhdGVHZW9tZXRyeSgpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLlBvaW50Q2xvdWQoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdG5ldyBUSFJFRS5Qb2ludENsb3VkTWF0ZXJpYWwoe1xuXHRcdFx0XHQgc2l6ZTogMSAqIHRoaXMucG9lbS5yYXRpbyxcblx0XHRcdFx0IGNvbG9yOiAweGZmMDAwMFxuXHRcdFx0fVxuXHRcdCkpO1xuXHRcdHRoaXMub2JqZWN0LmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcblx0XHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApIDtcblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBkdCApICB7XG5cdFx0dmFyIGJ1bGxldCwgdGltZTtcblx0XHRcblx0XHRub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaTx0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWxsZXQgPSB0aGlzLmxpdmVCdWxsZXRzW2ldO1xuXHRcdFx0XG5cdFx0XHRpZihidWxsZXQuYm9ybkF0ICsgdGhpcy5idWxsZXRBZ2UgPCBub3cpIHtcblx0XHRcdFx0dGhpcy5raWxsQnVsbGV0KCBidWxsZXQgKTtcblx0XHRcdFx0aS0tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVsbGV0LnVwZGF0ZSggZHQgKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYodGhpcy5saXZlQnVsbGV0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdH1cblx0XHRcblx0fVxufTsiLCJ2YXIgRXZlbnREaXNwYXRjaGVyID0gcmVxdWlyZSgnLi91dGlscy9FdmVudERpc3BhdGNoZXInKTtcblxudmFyIEhJRCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG5cdFxuXHR2YXIgc3RhdGVzID0ge1xuXHRcdHVwOiBmYWxzZSxcblx0XHRkb3duOiBmYWxzZSxcblx0XHRsZWZ0OiBmYWxzZSxcblx0XHRyaWdodDogZmFsc2UsXG5cdFx0c3BhY2ViYXI6IGZhbHNlXG5cdH07XG5cdFxuXHR0aGlzLmtleUNvZGVzID0ge1xuXHRcdFwiazM4XCIgOiBcInVwXCIsXG5cdFx0XCJrNDBcIiA6IFwiZG93blwiLFxuXHRcdFwiazM3XCIgOiBcImxlZnRcIixcblx0XHRcImszOVwiIDogXCJyaWdodFwiLFxuXHRcdFwiazMyXCIgOiBcInNwYWNlYmFyXCJcblx0fVxuXHRcblx0dGhpcy5wcmVzc2VkID0gXy5jbG9uZShzdGF0ZXMpO1xuXHR0aGlzLmRvd24gPSBfLmNsb25lKHN0YXRlcyk7XG5cdHRoaXMudXAgPSBfLmNsb25lKHN0YXRlcyk7XG5cdFxuXHQkKHdpbmRvdykub24oJ2tleWRvd24nLCB0aGlzLmtleWRvd24uYmluZCh0aGlzKSk7XG5cdCQod2luZG93KS5vbigna2V5dXAnLCB0aGlzLmtleXVwLmJpbmQodGhpcykpO1xuXHRcbn07XG5cbkhJRC5wcm90b3R5cGUgPSB7XG5cdFxuXHRrZXlkb3duIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMuZG93bltjb2RlXSA9IHRydWU7XG5cdFx0XHR0aGlzLnByZXNzZWRbY29kZV0gPSB0cnVlO1xuXHRcdH1cblx0fSxcblx0XG5cdGtleXVwIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0dmFyIGNvZGUgPSB0aGlzLmtleUNvZGVzWyBcImtcIiArIGUua2V5Q29kZSBdO1xuXHRcdFxuXHRcdGlmKGNvZGUpIHtcblx0XHRcdHRoaXMucHJlc3NlZFtjb2RlXSA9IGZhbHNlO1xuXHRcdFx0dGhpcy51cFtjb2RlXSA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGZhbHNpZnkgPSBmdW5jdGlvbiAodmFsdWUsIGtleSwgbGlzdCkge1xuXHRcdFx0bGlzdFtrZXldID0gZmFsc2Vcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0Xy5lYWNoKCB0aGlzLmRvd24sIGZhbHNpZnkgKTtcblx0XHRcdF8uZWFjaCggdGhpcy51cCwgZmFsc2lmeSApO1xuXHRcdH07XG5cdFx0XG5cdH0oKVxuXHRcbn07XG5cbkV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuYXBwbHkoIEhJRC5wcm90b3R5cGUgKTsiLCJ2YXIgSElEID0gcmVxdWlyZSgnLi9IaWQnKTtcblxudmFyIFNoaXAgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLmhpZCA9IG5ldyBISUQoKTtcblx0dGhpcy5jb2xvciA9IDB4NEE5REU3O1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdFxuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblx0XG5cdFxuXHRcblx0dGhpcy5zcGVlZCA9IDA7XG5cdFxuXHR0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQgPSAwLjA0O1xuXHR0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZCA9IDAuMDAxO1xuXHRcblx0dGhpcy50aHJ1c3RTcGVlZCA9IDAuMDAxO1xuXHR0aGlzLnRocnVzdCA9IDA7XG5cdFxuXHR0aGlzLmJhbmtTcGVlZCA9IDAuMDY7XG5cdHRoaXMuYmFuayA9IDA7XG5cdHRoaXMubWF4U3BlZWQgPSAxMDAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cbn07XG5cblxuU2hpcC5wcm90b3R5cGUgPSB7XG5cdFxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgdmVydHMsIG1hbmhhdHRhbkxlbmd0aCwgY2VudGVyO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCksXG5cdFx0XG5cdFx0dmVydHMgPSBbWzUwLDM2LjldLCBbMzkuOCw1OS42XSwgWzQ3LjEsNTMuOV0sIFs1MCw1Ny41XSwgWzUzLDUzLjldLCBbNjAuMiw1OS42XSwgWzUwLDM2LjldXTtcblxuXHRcdG1hbmhhdHRhbkxlbmd0aCA9IF8ucmVkdWNlKCB2ZXJ0cywgZnVuY3Rpb24oIG1lbW8sIHZlcnQyZCApIHtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcdFxuXHRcdH0sIFswLDBdKTtcblx0XHRcblx0XHRjZW50ZXIgPSBbXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMF0gLyB2ZXJ0cy5sZW5ndGgsXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMV0gLyB2ZXJ0cy5sZW5ndGhcblx0XHRdO1xuXHRcdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiApIHtcblx0XHRcdHZhciBzY2FsZSA9IDEgLyA0O1xuXHRcdFx0cmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKFxuXHRcdFx0XHQodmVjMlsxXSAtIGNlbnRlclsxXSkgKiBzY2FsZSAqIC0xLFxuXHRcdFx0XHQodmVjMlswXSAtIGNlbnRlclswXSkgKiBzY2FsZSxcblx0XHRcdFx0MFxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuY3JlYXRlR2VvbWV0cnkoKTtcblx0XHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogKz0gdGhpcy5wb2VtLnI7XG5cdFx0XG5cdFx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0dGhpcy5yZXNldCgpO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLnBvbGFyT2JqICk7XG5cdH0sXG5cdFxuXHRyZXNldCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucG9zaXRpb24ueCA9IDA7XG5cdFx0dGhpcy5wb3NpdGlvbi55ID0gMDtcblx0XHR0aGlzLnNwZWVkID0gMC4yO1xuXHRcdHRoaXMuYmFuayA9IDA7XG5cdFx0Ly90aGlzLm9iamVjdC5yb3RhdGlvbi56ID0gTWF0aC5QSSAqIDAuMjU7XHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGR0ICkge1xuXHRcdFxuXHRcdHRoaXMudXBkYXRlVGhydXN0QW5kQmFuayggZHQgKTtcblx0XHR0aGlzLnVwZGF0ZUVkZ2VBdm9pZGFuY2UoIGR0ICk7XG5cdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZHQgKTtcblx0XHR0aGlzLnVwZGF0ZUZpcmluZyggZHQgKTtcblx0XHR0aGlzLmhpZC51cGRhdGUoIGR0ICk7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGVUaHJ1c3RBbmRCYW5rIDogZnVuY3Rpb24oIGR0ICkge1xuXHRcdHZhciBwcmVzc2VkID0gdGhpcy5oaWQucHJlc3NlZDtcblx0XHRcdFxuXHRcdHRoaXMuYmFuayAqPSAwLjk7XG5cdFx0dGhpcy50aHJ1c3QgPSAwO1xuXHRcdFx0XG5cdFx0aWYoIHByZXNzZWQudXAgKSB7XG5cdFx0XHR0aGlzLnRocnVzdCArPSB0aGlzLnRocnVzdFNwZWVkICogZHQ7XG5cdFx0XHR9XG5cdFx0XG5cdFx0aWYoIHByZXNzZWQuZG93biApIHtcblx0XHRcdHRoaXMudGhydXN0IC09IHRoaXMudGhydXN0U3BlZWQgKiBkdDtcdFxuXHRcdH1cblx0XHRcblx0XHRpZiggcHJlc3NlZC5sZWZ0ICkge1xuXHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQ7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKCBwcmVzc2VkLnJpZ2h0ICkge1xuXHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQgKiAtMTtcblx0XHR9XG5cdH0sXG5cdFxuXHR1cGRhdGVFZGdlQXZvaWRhbmNlIDogZnVuY3Rpb24oIGR0ICkge1xuXHRcdFxuXHRcdHZhciBuZWFyRWRnZSwgZmFyRWRnZSwgcG9zaXRpb24sIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24sIGJhbmtEaXJlY3Rpb24sIGFic1Bvc2l0aW9uO1xuXHRcdFxuXHRcdGZhckVkZ2UgPSB0aGlzLnBvZW0uaGVpZ2h0IC8gMjtcblx0XHRuZWFyRWRnZSA9IDQvNSAqIGZhckVkZ2U7XG5cdFx0cG9zaXRpb24gPSB0aGlzLm9iamVjdC5wb3NpdGlvbi55O1xuXHRcdGFic1Bvc2l0aW9uID0gTWF0aC5hYnMoIHBvc2l0aW9uICk7XG5cblx0XHR2YXIgcm90YXRpb24gPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56IC8gTWF0aC5QSTtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogJT0gMiAqIE1hdGguUEk7XG5cdFx0XG5cdFx0aWYoIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPCAwICkge1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSAyICogTWF0aC5QSTtcblx0XHR9XG5cdFx0XG5cdFx0aWYoIE1hdGguYWJzKCBwb3NpdGlvbiApID4gbmVhckVkZ2UgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBpc1BvaW50aW5nTGVmdCA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPj0gTWF0aC5QSSAqIDAuNSAmJiB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgTWF0aC5QSSAqIDEuNTtcblx0XHRcdFxuXHRcdFx0aWYoIHBvc2l0aW9uID4gMCApIHtcblx0XHRcdFx0XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0bm9ybWFsaXplZEVkZ2VQb3NpdGlvbiA9IChhYnNQb3NpdGlvbiAtIG5lYXJFZGdlKSAvIChmYXJFZGdlIC0gbmVhckVkZ2UpO1xuXHRcdFx0dGhpcy50aHJ1c3QgKz0gbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZVRocnVzdFNwZWVkO1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSBiYW5rRGlyZWN0aW9uICogbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZUJhbmtTcGVlZDtcblx0XHRcdFxuXHRcdH1cblx0XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcdFxuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlRmlyaW5nIDogZnVuY3Rpb24oKSB7XG5cdFx0aWYoIHRoaXMuaGlkLnByZXNzZWQuc3BhY2ViYXIgKSB7XG5cdFx0XHR0aGlzLnBvZW0uZ3VuLmZpcmUoIHRoaXMucG9zaXRpb24ueCwgdGhpcy5wb3NpdGlvbi55LCAyLCB0aGlzLm9iamVjdC5yb3RhdGlvbi56ICk7XG5cdFx0fVxuXHR9LFxuXHRcblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbiggZHQgKSB7XG5cdFx0XG5cdFx0dmFyIG1vdmVtZW50ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0XHR2YXIgdGhldGEsIHgsIHk7XG5cdFx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gdGhpcy5iYW5rO1xuXHRcdFx0XG5cdFx0XHR0aGV0YSA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLno7XG5cdFx0XHRcblx0XHRcdHRoaXMuc3BlZWQgKj0gMC45ODtcblx0XHRcdHRoaXMuc3BlZWQgKz0gdGhpcy50aHJ1c3Q7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5taW4oIHRoaXMubWF4U3BlZWQsIHRoaXMuc3BlZWQgKTtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1heCggMCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0XHRcdFx0XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZCAqIE1hdGguY29zKCB0aGV0YSApO1xuXHRcdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueSA9IHRoaXMucG9zaXRpb24ueTtcblx0XHRcdFxuXHRcdFx0Ly9Qb2xhciBjb29yZGluYXRlc1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueCA9IE1hdGguY29zKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uclNwZWVkICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdC8vIHRoaXMub2JqZWN0LnBvc2l0aW9uLnogPSBNYXRoLnNpbiggdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLnJTcGVlZCApICogdGhpcy5wb2VtLnI7XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uclNwZWVkO1xuXHRcdFx0XG5cdFx0fTtcblx0XHRcblx0fSgpXG5cdFxuXHRcbn07IiwidmFyIFN0YXJzID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHRcblx0dGhpcy5jb3VudCA9IDIwMDAwO1xuXHR0aGlzLmRlcHRoID0gMTA7XG5cdFxuXHR0aGlzLmFkZE9iamVjdCgpO1xufTtcblxuU3RhcnMucHJvdG90eXBlID0ge1xuXHRcblx0Z2VuZXJhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciByLCB0aGV0YSwgeCwgeSwgeiwgZ2VvbWV0cnk7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHRyID0gTWF0aC5yYW5kb20oKSAqIHRoaXMuZGVwdGggKiB0aGlzLnBvZW0ucjtcblx0XHRcdGlmKCByIDwgdGhpcy5wb2VtLnIgKSB7XG5cdFx0XHRcdHIgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0fVxuXHRcdFx0dGhldGEgPSBNYXRoLnJhbmRvbSgpICogMiAqIE1hdGguUEk7XG5cdFx0XHRcblx0XHRcdHggPSBNYXRoLmNvcyggdGhldGEgKSAqIHI7XG5cdFx0XHR6ID0gTWF0aC5zaW4oIHRoZXRhICkgKiByO1xuXHRcdFx0eSA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMuZGVwdGggKiB0aGlzLnBvZW0ucjtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoeCx5LHopICk7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgbGluZU1hdGVyaWFsO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5nZW5lcmF0ZUdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUG9pbnRDbG91ZChcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bmV3IFRIUkVFLlBvaW50Q2xvdWRNYXRlcmlhbCh7XG5cdFx0XHRcdCBzaXplOiAwLjUgKiB0aGlzLnBvZW0ucmF0aW8sXG5cdFx0XHRcdCBjb2xvcjogMHg5OTk5OTksXG5cdFx0XHRcdCBmb2c6IGZhbHNlXG5cdFx0XHR9XG5cdFx0KSApO1xuXHRcdFxuXHRcdFxuXHRcdFxuXHRcdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMub2JqZWN0ICkgO1xuXHRcdFxuXHR9XG59OyIsIi8qKlxuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqL1xuXG52YXIgRXZlbnREaXNwYXRjaGVyID0gZnVuY3Rpb24gKCkge31cblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZSA9IHtcblxuXHRjb25zdHJ1Y3RvcjogRXZlbnREaXNwYXRjaGVyLFxuXG5cdGFwcGx5OiBmdW5jdGlvbiAoIG9iamVjdCApIHtcblxuXHRcdG9iamVjdC5hZGRFdmVudExpc3RlbmVyID0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyO1xuXHRcdG9iamVjdC5oYXNFdmVudExpc3RlbmVyID0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5oYXNFdmVudExpc3RlbmVyO1xuXHRcdG9iamVjdC5yZW1vdmVFdmVudExpc3RlbmVyID0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyO1xuXHRcdG9iamVjdC5kaXNwYXRjaEV2ZW50ID0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5kaXNwYXRjaEV2ZW50O1xuXG5cdH0sXG5cblx0YWRkRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdID09PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGxpc3RlbmVyc1sgdHlwZSBdID0gW107XG5cblx0XHR9XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICkgPT09IC0gMSApIHtcblxuXHRcdFx0bGlzdGVuZXJzWyB0eXBlIF0ucHVzaCggbGlzdGVuZXIgKTtcblxuXHRcdH1cblxuXHR9LFxuXG5cdGhhc0V2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblxuXHRcdGlmICggbGlzdGVuZXJzWyB0eXBlIF0gIT09IHVuZGVmaW5lZCAmJiBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApICE9PSAtIDEgKSB7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXG5cdH0sXG5cblx0cmVtb3ZlRXZlbnRMaXN0ZW5lcjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSByZXR1cm47XG5cblx0XHR2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuXHRcdHZhciBsaXN0ZW5lckFycmF5ID0gbGlzdGVuZXJzWyB0eXBlIF07XG5cblx0XHRpZiAoIGxpc3RlbmVyQXJyYXkgIT09IHVuZGVmaW5lZCApIHtcblxuXHRcdFx0dmFyIGluZGV4ID0gbGlzdGVuZXJBcnJheS5pbmRleE9mKCBsaXN0ZW5lciApO1xuXG5cdFx0XHRpZiAoIGluZGV4ICE9PSAtIDEgKSB7XG5cblx0XHRcdFx0bGlzdGVuZXJBcnJheS5zcGxpY2UoIGluZGV4LCAxICk7XG5cblx0XHRcdH1cblxuXHRcdH1cblxuXHR9LFxuXG5cdGRpc3BhdGNoRXZlbnQ6IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblx0XHR2YXIgbGlzdGVuZXJBcnJheSA9IGxpc3RlbmVyc1sgZXZlbnQudHlwZSBdO1xuXG5cdFx0aWYgKCBsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGV2ZW50LnRhcmdldCA9IHRoaXM7XG5cblx0XHRcdHZhciBhcnJheSA9IFtdO1xuXHRcdFx0dmFyIGxlbmd0aCA9IGxpc3RlbmVyQXJyYXkubGVuZ3RoO1xuXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0YXJyYXlbIGkgXSA9IGxpc3RlbmVyQXJyYXlbIGkgXTtcblxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0YXJyYXlbIGkgXS5jYWxsKCB0aGlzLCBldmVudCApO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0fVxuXG59O1xuXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICkge1xuXG5cdG1vZHVsZS5leHBvcnRzID0gRXZlbnREaXNwYXRjaGVyO1xuXG59IiwiLy8gVHJhbnNsYXRlcyAyZCBwb2ludHMgaW50byAzZCBwb2xhciBzcGFjZVxuXG52YXIgUG9sYXJDb252ZXJ0ZXIgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xufTtcblxuUG9sYXJDb252ZXJ0ZXIucHJvdG90eXBlID0ge1xuXHRcblx0eCA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiBNYXRoLnNpbiggeCAqIHRoaXMucG9lbS5yU3BlZWQgKSAqIHRoaXMucG9lbS5yO1xuXHR9LFxuXHRcblx0eSA6IGZ1bmN0aW9uKCB5ICkge1xuXHRcdHJldHVybiB5O1xuXHR9LFxuXHRcblx0eiA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiBNYXRoLmNvcyggeCAqIHRoaXMucG9lbS5yU3BlZWQgKSAqIHRoaXMucG9lbS5yO1xuXHR9LFxuXHRcblx0ciA6IGZ1bmN0aW9uKHgsIHopIHtcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KHgqeCArIHoqeik7XG5cdH0sXG5cdFxuXHR0aGV0YSA6IGZ1bmN0aW9uKHgsIHopIHtcblx0XHRyZXR1cm4gTWF0aC5hdGFuKCB6IC8geCApO1xuXHR9LFxuXHRcblx0c2V0VmVjdG9yIDogZnVuY3Rpb24oIHZlY3RvciAvKiB4LCB5IE9SIHZlY3RvciAqLykge1xuXHRcdFxuXHRcdHZhciB4LCB5LCB2ZWN0b3IyO1xuXHRcdFxuXHRcdGlmKCB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcIm51bWJlclwiICkge1xuXHRcdFx0XG5cdFx0XHR4ID0gYXJndW1lbnRzWzFdO1xuXHRcdFx0eSA9IGFyZ3VtZW50c1syXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh4KSxcblx0XHRcdFx0eSxcblx0XHRcdFx0dGhpcy56KHgpXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0fSBlbHNlIHtcblx0XHRcdFxuXHRcdFx0dmVjdG9yMiA9IGFyZ3VtZW50c1sxXTtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlY3Rvci5zZXQoXG5cdFx0XHRcdHRoaXMueCh2ZWN0b3IyLngpLFxuXHRcdFx0XHR2ZWN0b3IyLnksXG5cdFx0XHRcdHRoaXMueih2ZWN0b3IyLngpXG5cdFx0XHQpO1xuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdGdldFZlY3RvciA6IGZ1bmN0aW9uKCB4LCB5ICkge1xuXHRcdFxuXHRcdHZhciB2ZWN0b3IgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdHJldHVybiB0aGlzLnNldFZlY3RvciggdmVjdG9yLCB4LCB5ICk7XG5cdFx0XG5cdH1cblx0XG59O1xuIiwiLyoqXG4gKiBAYXV0aG9yIG1yZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBTdGF0cyA9IGZ1bmN0aW9uICgpIHtcblxuXHR2YXIgc3RhcnRUaW1lID0gRGF0ZS5ub3coKSwgcHJldlRpbWUgPSBzdGFydFRpbWU7XG5cdHZhciBtcyA9IDAsIG1zTWluID0gSW5maW5pdHksIG1zTWF4ID0gMDtcblx0dmFyIGZwcyA9IDAsIGZwc01pbiA9IEluZmluaXR5LCBmcHNNYXggPSAwO1xuXHR2YXIgZnJhbWVzID0gMCwgbW9kZSA9IDA7XG5cblx0dmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGNvbnRhaW5lci5pZCA9ICdzdGF0cyc7XG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgc2V0TW9kZSggKysgbW9kZSAlIDIgKSB9LCBmYWxzZSApO1xuXHRjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9ICd3aWR0aDo4MHB4O29wYWNpdHk6MC45O2N1cnNvcjpwb2ludGVyJztcblxuXHR2YXIgZnBzRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ZnBzRGl2LmlkID0gJ2Zwcyc7XG5cdGZwc0Rpdi5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6MCAwIDNweCAzcHg7dGV4dC1hbGlnbjpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzAwMic7XG5cdGNvbnRhaW5lci5hcHBlbmRDaGlsZCggZnBzRGl2ICk7XG5cblx0dmFyIGZwc1RleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRmcHNUZXh0LmlkID0gJ2Zwc1RleHQnO1xuXHRmcHNUZXh0LnN0eWxlLmNzc1RleHQgPSAnY29sb3I6IzBmZjtmb250LWZhbWlseTpIZWx2ZXRpY2EsQXJpYWwsc2Fucy1zZXJpZjtmb250LXNpemU6OXB4O2ZvbnQtd2VpZ2h0OmJvbGQ7bGluZS1oZWlnaHQ6MTVweCc7XG5cdGZwc1RleHQuaW5uZXJIVE1MID0gJ0ZQUyc7XG5cdGZwc0Rpdi5hcHBlbmRDaGlsZCggZnBzVGV4dCApO1xuXG5cdHZhciBmcHNHcmFwaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGZwc0dyYXBoLmlkID0gJ2Zwc0dyYXBoJztcblx0ZnBzR3JhcGguc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDo3NHB4O2hlaWdodDozMHB4O2JhY2tncm91bmQtY29sb3I6IzBmZic7XG5cdGZwc0Rpdi5hcHBlbmRDaGlsZCggZnBzR3JhcGggKTtcblxuXHR3aGlsZSAoIGZwc0dyYXBoLmNoaWxkcmVuLmxlbmd0aCA8IDc0ICkge1xuXG5cdFx0dmFyIGJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdzcGFuJyApO1xuXHRcdGJhci5zdHlsZS5jc3NUZXh0ID0gJ3dpZHRoOjFweDtoZWlnaHQ6MzBweDtmbG9hdDpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzExMyc7XG5cdFx0ZnBzR3JhcGguYXBwZW5kQ2hpbGQoIGJhciApO1xuXG5cdH1cblxuXHR2YXIgbXNEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRtc0Rpdi5pZCA9ICdtcyc7XG5cdG1zRGl2LnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzowIDAgM3B4IDNweDt0ZXh0LWFsaWduOmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMDIwO2Rpc3BsYXk6bm9uZSc7XG5cdGNvbnRhaW5lci5hcHBlbmRDaGlsZCggbXNEaXYgKTtcblxuXHR2YXIgbXNUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNUZXh0LmlkID0gJ21zVGV4dCc7XG5cdG1zVGV4dC5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOiMwZjA7Zm9udC1mYW1pbHk6SGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWY7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDpib2xkO2xpbmUtaGVpZ2h0OjE1cHgnO1xuXHRtc1RleHQuaW5uZXJIVE1MID0gJ01TJztcblx0bXNEaXYuYXBwZW5kQ2hpbGQoIG1zVGV4dCApO1xuXG5cdHZhciBtc0dyYXBoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNHcmFwaC5pZCA9ICdtc0dyYXBoJztcblx0bXNHcmFwaC5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOjc0cHg7aGVpZ2h0OjMwcHg7YmFja2dyb3VuZC1jb2xvcjojMGYwJztcblx0bXNEaXYuYXBwZW5kQ2hpbGQoIG1zR3JhcGggKTtcblxuXHR3aGlsZSAoIG1zR3JhcGguY2hpbGRyZW4ubGVuZ3RoIDwgNzQgKSB7XG5cblx0XHR2YXIgYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3NwYW4nICk7XG5cdFx0YmFyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6MXB4O2hlaWdodDozMHB4O2Zsb2F0OmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMTMxJztcblx0XHRtc0dyYXBoLmFwcGVuZENoaWxkKCBiYXIgKTtcblxuXHR9XG5cblx0dmFyIHNldE1vZGUgPSBmdW5jdGlvbiAoIHZhbHVlICkge1xuXG5cdFx0bW9kZSA9IHZhbHVlO1xuXG5cdFx0c3dpdGNoICggbW9kZSApIHtcblxuXHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRmcHNEaXYuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdG1zRGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRmcHNEaXYuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdFx0bXNEaXYuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHR9O1xuXG5cdHZhciB1cGRhdGVHcmFwaCA9IGZ1bmN0aW9uICggZG9tLCB2YWx1ZSApIHtcblxuXHRcdHZhciBjaGlsZCA9IGRvbS5hcHBlbmRDaGlsZCggZG9tLmZpcnN0Q2hpbGQgKTtcblx0XHRjaGlsZC5zdHlsZS5oZWlnaHQgPSB2YWx1ZSArICdweCc7XG5cblx0fTtcblxuXHRyZXR1cm4ge1xuXG5cdFx0UkVWSVNJT046IDEyLFxuXG5cdFx0ZG9tRWxlbWVudDogY29udGFpbmVyLFxuXG5cdFx0c2V0TW9kZTogc2V0TW9kZSxcblxuXHRcdGJlZ2luOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG5cblx0XHR9LFxuXG5cdFx0ZW5kOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHZhciB0aW1lID0gRGF0ZS5ub3coKTtcblxuXHRcdFx0bXMgPSB0aW1lIC0gc3RhcnRUaW1lO1xuXHRcdFx0bXNNaW4gPSBNYXRoLm1pbiggbXNNaW4sIG1zICk7XG5cdFx0XHRtc01heCA9IE1hdGgubWF4KCBtc01heCwgbXMgKTtcblxuXHRcdFx0bXNUZXh0LnRleHRDb250ZW50ID0gbXMgKyAnIE1TICgnICsgbXNNaW4gKyAnLScgKyBtc01heCArICcpJztcblx0XHRcdHVwZGF0ZUdyYXBoKCBtc0dyYXBoLCBNYXRoLm1pbiggMzAsIDMwIC0gKCBtcyAvIDIwMCApICogMzAgKSApO1xuXG5cdFx0XHRmcmFtZXMgKys7XG5cblx0XHRcdGlmICggdGltZSA+IHByZXZUaW1lICsgMTAwMCApIHtcblxuXHRcdFx0XHRmcHMgPSBNYXRoLnJvdW5kKCAoIGZyYW1lcyAqIDEwMDAgKSAvICggdGltZSAtIHByZXZUaW1lICkgKTtcblx0XHRcdFx0ZnBzTWluID0gTWF0aC5taW4oIGZwc01pbiwgZnBzICk7XG5cdFx0XHRcdGZwc01heCA9IE1hdGgubWF4KCBmcHNNYXgsIGZwcyApO1xuXG5cdFx0XHRcdGZwc1RleHQudGV4dENvbnRlbnQgPSBmcHMgKyAnIEZQUyAoJyArIGZwc01pbiArICctJyArIGZwc01heCArICcpJztcblx0XHRcdFx0dXBkYXRlR3JhcGgoIGZwc0dyYXBoLCBNYXRoLm1pbiggMzAsIDMwIC0gKCBmcHMgLyAxMDAgKSAqIDMwICkgKTtcblxuXHRcdFx0XHRwcmV2VGltZSA9IHRpbWU7XG5cdFx0XHRcdGZyYW1lcyA9IDA7XG5cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRpbWU7XG5cblx0XHR9LFxuXG5cdFx0dXBkYXRlOiBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdHN0YXJ0VGltZSA9IHRoaXMuZW5kKCk7XG5cblx0XHR9XG5cblx0fVxuXG59O1xuXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICkge1xuXG5cdG1vZHVsZS5leHBvcnRzID0gU3RhdHM7XG5cbn0iXX0=
