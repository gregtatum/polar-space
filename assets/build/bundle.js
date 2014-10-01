(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./js/Main.js":[function(require,module,exports){
var Poem = require('./Poem');
var asteroidJelliesLevel = require('./levels/asteroids-jellies');

$(function() {
	window.poem = new Poem( asteroidJelliesLevel );
});


},{"./Poem":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js","./levels/asteroids-jellies":"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/asteroids-jellies.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Poem.js":[function(require,module,exports){
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
var Score = require('./components/Score');
var Clock = require('./utils/Clock');

var Poem = function( levelObject ) {

	this.circumference = 750;
	this.height = 120;
	this.r = 240;
	this.circumferenceRatio = (2 * Math.PI) / this.circumference; //Map 2d X coordinates to polar coordinates
	this.ratio = window.devicePixelRatio >= 1 ? window.devicePixelRatio : 1;
	
	this.renderer = undefined;
	this.controls = undefined;
	this.div = document.getElementById( 'container' );
	this.scene = new THREE.Scene();

	this.clock = new Clock();
	this.coordinates = new Coordinates( this );
	this.camera = new Camera( this );
	this.scene.fog = new THREE.Fog( 0x222222, this.camera.object.position.z / 2, this.camera.object.position.z * 2 );
	
	this.score = new Score();
	this.gun = new Gun( this );
	this.ship = new Ship( this );
	this.stars = new Stars( this );
	
	this.parseLevel( levelObject );
	
	this.addRenderer();
	this.addStats();
	this.addEventListeners();
	
	this.loop();
	
	
};

module.exports = Poem;

Poem.prototype = {
	
	parseLevel : function( levelObject ) {
		
		
		_.each( levelObject, function( value, key ) {
			
			if(_.isObject( value )) {
				this[ key ] = new value.object( this, value.properties );
			} else {
				this[ key ] = value;
			}
			
		}, this);
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
		
		this.stats.update();
		
		this.dispatch({
			type: "update",
			dt: this.clock.getDelta(),
			time: this.clock.time
		});
		
		this.renderer.render( this.scene, this.camera.object );
	},
	
};

EventDispatcher.prototype.apply( Poem.prototype );
},{"./Ship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js","./components/Camera":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Camera.js","./components/Score":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Score.js","./components/Stars":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Stars.js","./entities/JellyShip":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js","./managers/AsteroidField":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js","./managers/EntityManager":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js","./managers/Gun":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/Gun.js","./utils/Clock":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Clock.js","./utils/Coordinates":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Coordinates.js","./utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js","./utils/Stats":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Stats.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/Ship.js":[function(require,module,exports){
var HID = require('./components/Hid');
var Damage = require('./components/Damage');

var Ship = function( poem ) {
	
	this.poem = poem;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;
	this.hid = new HID();
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
	this.maxSpeed = 1000;

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
	
	kill : function( force ) {
		
		if( !force && !this.dead && !this.invulnerable ) {
			this.dead = true;
			this.object.visible = false;
			this.damage.explode();
			
			this.poem.score.adjustScore(
				Math.ceil( this.poem.score.score / -2 )
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
		var pressed = this.hid.pressed;
			
		this.bank *= 0.9;
		this.thrust = 0;
			
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
var Camera = function( poem ) {
	
	this.poem = poem;
	
	this.polarObj = new THREE.Object3D();
	
	this.speed = 0.032;
	
	this.object = new THREE.PerspectiveCamera(
		50,										// fov
		window.innerWidth / window.innerHeight,	// aspect ratio
		3,										// near frustum
		1000									// far frustum
	);
	this.object.position.z = this.poem.r * 1.5;
	
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
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js":[function(require,module,exports){
var _ = require('underscore');
var random = require('../utils/random.js');
var Bullet = require('../entities/Bullet');
var SoundGenerator = require('../sound/SoundGenerator');

Damage = function( poem, ship, settings ) {
	
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
		var sound = this.explosionSound

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
var EventDispatcher = require('../utils/EventDispatcher');

var HID = function() {
	
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

module.exports = HID;

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
},{"../utils/EventDispatcher":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/EventDispatcher.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Score.js":[function(require,module,exports){
var Score = function() {
	this.$score = $('#score');
	this.$enemiesCount = $('#enemies-count');
	this.$win = $('.win');
	this.$winScore = $('#win-score');
	this.score = 0;
	this.enemiesCount = 0;
	
	this.won = false;
};

module.exports = Score;

Score.prototype = {
	
	adjustEnemies : function( count ) {
		if(this.won) return;
		this.enemiesCount += count;
		this.$enemiesCount.text( this.enemiesCount );
		
		if( this.enemiesCount === 0 ) {
			this.showWin();
		}
		return this.enemiesCount;
	},
	
	adjustScore : function( count ) {
		if(this.won) return;
		this.score += count;
		this.$score.text( this.score );
		return this.score;
	},
	
	showWin : function() {
		
		this.won = true;
		
		this.$winScore.text( this.score );
		this.$win.show();
		this.$win.css({
			opacity: 1
		});
	}
	
};
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Stars.js":[function(require,module,exports){
var Stars = function( poem ) {
	this.poem = poem;
	this.object = null;
	
	this.count = 40000;
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
},{}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Asteroid.js":[function(require,module,exports){
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

		//console.log(this.speed.x, this.speed.y);
		
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

	this.color = 0xcb36ea;
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
};

module.exports = Jellyship;

Jellyship.prototype = {

	createGeometry : function() {
		
		//TODO - Share geometry
	
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
		
		this.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2 ) {
			
			var scale = 1 / 32;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( vec2[1] > 330.8 ) {
				this.waveyVerts.push( vec3 )
			}
			
			return vec3;
			
		}, this);
	
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
		
		//TODO CLEAN ME UP!!!
		
		this.bank *= 0.9;
		this.thrust = 0.01;
		
		this.bank += random.range(-0.01, 0.01);
		
		//this.bank += this.bankSpeed * Math.sin( e.dt / 500 );
		
		_.each( this.waveyVerts, function( vec ) {
			//TODO - Share this with all objects
			vec.y = 0.8 * Math.sin( e.time / 100 + vec.x ) + vec.original.y;
		});
		
		this.object.geometry.verticesNeedUpdate = true;
		
		if( this.dead ) {
		
		
		} else {
		
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
		
		}
		this.damage.update( e );

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
var Damage = require('../components/Damage');
var random = require('../utils/random');

var Jellyship = function( poem, manager, x, y ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.color = 0xcb36ea;
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
};

module.exports = Jellyship;

Jellyship.prototype = {

	createGeometry : function() {
		
		//TODO - Share geometry
	
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
		
		this.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2 ) {
			
			var scale = 1 / 32;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( vec2[1] > 330.8 ) {
				this.waveyVerts.push( vec3 )
			}
			
			return vec3;
			
		}, this);
	
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
		
		//TODO CLEAN ME UP!!!
		
		this.bank *= 0.9;
		this.thrust = 0.01;
		
		this.bank += random.range(-0.01, 0.01);
		
		//this.bank += this.bankSpeed * Math.sin( e.dt / 500 );
		
		_.each( this.waveyVerts, function( vec ) {
			//TODO - Share this with all objects
			vec.y = 0.8 * Math.sin( e.time / 100 + vec.x ) + vec.original.y;
		});
		
		this.object.geometry.verticesNeedUpdate = true;
		
		if( this.dead ) {
		
		
		} else {
		
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
		
		}
		this.damage.update( e );

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
},{"../components/Damage":"/Users/gregtatum/Dropbox/greg-sites/polar/js/components/Damage.js","../utils/random":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/random.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/levels/asteroids-jellies.js":[function(require,module,exports){
module.exports = {
	asteroidField : {
		object: require("../managers/AsteroidField"),
		properties: {
			count : 20
		} 
	},
	jellyManager : {
		object: require("../managers/EntityManager"),
		properties: {
			shipType: require('../entities/Jellyship'),
			count: 25
		}
	},
}
},{"../entities/Jellyship":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Jellyship.js","../managers/AsteroidField":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js","../managers/EntityManager":"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/EntityManager.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/AsteroidField.js":[function(require,module,exports){
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

var EntityManager = function( poem, properties ) {
	
	this.poem = poem;
	this.shipType = DefaultJellyShip;
	this.count = 20;
	this.ships = [];
	this.liveShips = [];
	this.originClearance = 300;
	
	_.extend( this, properties ) ;
	
	this.generate( this.count );
	this.configureCollider();
	
	this.poem.on('update', this.update.bind(this) );
};

module.exports = EntityManager;

EntityManager.prototype = {
	
	generate : function( count ) {
		
		var i, x, y, height, width, ship;
		
		height = this.poem.height * 4;
		width = this.poem.circumference;
		
		for( i=0; i < count; i++ ) {
			
			x = Math.random() * width;
			y = Math.random() * height - (height / 2)
			
			ship = new this.shipType( this.poem, this, x, y );
			
			this.ships.push( ship );
			this.liveShips.push( ship );
		
		}
		
		this.poem.score.adjustEnemies( count );
		
	},
	
	update : function( e ) {
		
		_.each( this.ships, function(ship) {
			
			ship.update( e );
			
		}, this);
		
	},
	
	killShip : function( ship ) {
		
		var i = this.liveShips.indexOf( ship );
		
		if( i >= 0 ) {
			this.liveShips.splice( i, 1 );
		}
		
		ship.kill();		
	},
	
	configureCollider : function() {
		
		new Collider(
			
			this.poem,
			
			function() {
				return this.liveShips;
			}.bind(this),
			
			function() {
				return this.poem.gun.liveBullets;
			}.bind(this),
			
			function(ship, bullet) {
				
				this.killShip( ship );
				this.poem.gun.killBullet( bullet );
				
				this.poem.score.adjustScore( ship.scoreValue );
				this.poem.score.adjustEnemies( -1 );
				
			}.bind(this)
			
		);
		
		new Collider(
			
			this.poem,
			
			function() {
				return this.liveShips;
			}.bind(this),
			
			function() {
				return [this.poem.ship];
			}.bind(this),
			
			function(ship, bullet) {
				
				if( !this.poem.ship.dead && !this.poem.ship.invulnerable ) {
					
					this.killShip( ship );
					this.poem.ship.kill();
					
					this.poem.score.adjustEnemies( -1 );
					
				}
				
				
			}.bind(this)
			
		);
		
	},
	
	
};
},{"../entities/JellyShip":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/JellyShip.js","../utils/Collider":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/managers/Gun.js":[function(require,module,exports){
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
	this.configureCollider();
	this.addSound();
	
	console.log('update');
	this.poem.on('update', this.update.bind(this) );
};

module.exports = Gun;

Gun.prototype = {
	
	fire : function() {
		
		var isDead = function( bullet ) {
			return !bullet.alive;
		}
		
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
	
	configureCollider : function() {
		
		//Collide bullets with asteroids
		new Collider(
			
			this.poem,
			
			function() {
				return this.poem.asteroidField.asteroids;
			}.bind(this),
			
			function() {
				return this.liveBullets;
			}.bind(this),
			
			function(asteroid, bullet) {
				this.killBullet( bullet )
			}.bind(this)
			
		);
	},
	
	addSound : function() {
		
		var sound = this.sound = new SoundGenerator()
		
		sound.connectNodes([
			sound.makeOscillator( "square" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
	}
};
},{"../entities/Bullet":"/Users/gregtatum/Dropbox/greg-sites/polar/js/entities/Bullet.js","../sound/SoundGenerator":"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js","../utils/Collider":"/Users/gregtatum/Dropbox/greg-sites/polar/js/utils/Collider.js"}],"/Users/gregtatum/Dropbox/greg-sites/polar/js/sound/SoundGenerator.js":[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL2pzL01haW4uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9Qb2VtLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvU2hpcC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvQ2FtZXJhLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvY29tcG9uZW50cy9EYW1hZ2UuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL0hpZC5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL2NvbXBvbmVudHMvU2NvcmUuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9jb21wb25lbnRzL1N0YXJzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvZW50aXRpZXMvQXN0ZXJvaWQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9CdWxsZXQuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9KZWxseVNoaXAuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9lbnRpdGllcy9KZWxseXNoaXAuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9sZXZlbHMvYXN0ZXJvaWRzLWplbGxpZXMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy9tYW5hZ2Vycy9Bc3Rlcm9pZEZpZWxkLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvbWFuYWdlcnMvRW50aXR5TWFuYWdlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL21hbmFnZXJzL0d1bi5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3NvdW5kL1NvdW5kR2VuZXJhdG9yLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvQ2xvY2suanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9Db2xsaWRlci5qcyIsIi9Vc2Vycy9ncmVndGF0dW0vRHJvcGJveC9ncmVnLXNpdGVzL3BvbGFyL2pzL3V0aWxzL0Nvb3JkaW5hdGVzLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvRXZlbnREaXNwYXRjaGVyLmpzIiwiL1VzZXJzL2dyZWd0YXR1bS9Ecm9wYm94L2dyZWctc2l0ZXMvcG9sYXIvanMvdXRpbHMvU3RhdHMuanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9qcy91dGlscy9yYW5kb20uanMiLCIvVXNlcnMvZ3JlZ3RhdHVtL0Ryb3Bib3gvZ3JlZy1zaXRlcy9wb2xhci9ub2RlX21vZHVsZXMvdW5kZXJzY29yZS91bmRlcnNjb3JlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgUG9lbSA9IHJlcXVpcmUoJy4vUG9lbScpO1xudmFyIGFzdGVyb2lkSmVsbGllc0xldmVsID0gcmVxdWlyZSgnLi9sZXZlbHMvYXN0ZXJvaWRzLWplbGxpZXMnKTtcblxuJChmdW5jdGlvbigpIHtcblx0d2luZG93LnBvZW0gPSBuZXcgUG9lbSggYXN0ZXJvaWRKZWxsaWVzTGV2ZWwgKTtcbn0pO1xuXG4iLCJ2YXIgQ29vcmRpbmF0ZXMgPSByZXF1aXJlKCcuL3V0aWxzL0Nvb3JkaW5hdGVzJyk7XG52YXIgQ2FtZXJhID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0NhbWVyYScpO1xudmFyIEd1biA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvR3VuJyk7XG52YXIgU2hpcCA9IHJlcXVpcmUoJy4vU2hpcCcpO1xudmFyIFN0YXJzID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL1N0YXJzJyk7XG52YXIgQXN0ZXJvaWRGaWVsZCA9IHJlcXVpcmUoJy4vbWFuYWdlcnMvQXN0ZXJvaWRGaWVsZCcpO1xudmFyIFN0YXRzID0gcmVxdWlyZSgnLi91dGlscy9TdGF0cycpO1xudmFyIEV2ZW50RGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vdXRpbHMvRXZlbnREaXNwYXRjaGVyJyk7XG52YXIgSmVsbHlTaGlwID0gcmVxdWlyZSgnLi9lbnRpdGllcy9KZWxseVNoaXAnKTtcbnZhciBFbnRpdHlNYW5hZ2VyID0gcmVxdWlyZSgnLi9tYW5hZ2Vycy9FbnRpdHlNYW5hZ2VyJyk7XG52YXIgU2NvcmUgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvU2NvcmUnKTtcbnZhciBDbG9jayA9IHJlcXVpcmUoJy4vdXRpbHMvQ2xvY2snKTtcblxudmFyIFBvZW0gPSBmdW5jdGlvbiggbGV2ZWxPYmplY3QgKSB7XG5cblx0dGhpcy5jaXJjdW1mZXJlbmNlID0gNzUwO1xuXHR0aGlzLmhlaWdodCA9IDEyMDtcblx0dGhpcy5yID0gMjQwO1xuXHR0aGlzLmNpcmN1bWZlcmVuY2VSYXRpbyA9ICgyICogTWF0aC5QSSkgLyB0aGlzLmNpcmN1bWZlcmVuY2U7IC8vTWFwIDJkIFggY29vcmRpbmF0ZXMgdG8gcG9sYXIgY29vcmRpbmF0ZXNcblx0dGhpcy5yYXRpbyA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvID49IDEgPyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA6IDE7XG5cdFxuXHR0aGlzLnJlbmRlcmVyID0gdW5kZWZpbmVkO1xuXHR0aGlzLmNvbnRyb2xzID0gdW5kZWZpbmVkO1xuXHR0aGlzLmRpdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY29udGFpbmVyJyApO1xuXHR0aGlzLnNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5cblx0dGhpcy5jbG9jayA9IG5ldyBDbG9jaygpO1xuXHR0aGlzLmNvb3JkaW5hdGVzID0gbmV3IENvb3JkaW5hdGVzKCB0aGlzICk7XG5cdHRoaXMuY2FtZXJhID0gbmV3IENhbWVyYSggdGhpcyApO1xuXHR0aGlzLnNjZW5lLmZvZyA9IG5ldyBUSFJFRS5Gb2coIDB4MjIyMjIyLCB0aGlzLmNhbWVyYS5vYmplY3QucG9zaXRpb24ueiAvIDIsIHRoaXMuY2FtZXJhLm9iamVjdC5wb3NpdGlvbi56ICogMiApO1xuXHRcblx0dGhpcy5zY29yZSA9IG5ldyBTY29yZSgpO1xuXHR0aGlzLmd1biA9IG5ldyBHdW4oIHRoaXMgKTtcblx0dGhpcy5zaGlwID0gbmV3IFNoaXAoIHRoaXMgKTtcblx0dGhpcy5zdGFycyA9IG5ldyBTdGFycyggdGhpcyApO1xuXHRcblx0dGhpcy5wYXJzZUxldmVsKCBsZXZlbE9iamVjdCApO1xuXHRcblx0dGhpcy5hZGRSZW5kZXJlcigpO1xuXHR0aGlzLmFkZFN0YXRzKCk7XG5cdHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcblx0XG5cdHRoaXMubG9vcCgpO1xuXHRcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvZW07XG5cblBvZW0ucHJvdG90eXBlID0ge1xuXHRcblx0cGFyc2VMZXZlbCA6IGZ1bmN0aW9uKCBsZXZlbE9iamVjdCApIHtcblx0XHRcblx0XHRcblx0XHRfLmVhY2goIGxldmVsT2JqZWN0LCBmdW5jdGlvbiggdmFsdWUsIGtleSApIHtcblx0XHRcdFxuXHRcdFx0aWYoXy5pc09iamVjdCggdmFsdWUgKSkge1xuXHRcdFx0XHR0aGlzWyBrZXkgXSA9IG5ldyB2YWx1ZS5vYmplY3QoIHRoaXMsIHZhbHVlLnByb3BlcnRpZXMgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXNbIGtleSBdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0fSxcblx0XG5cdGFkZFJlbmRlcmVyIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5yZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKHtcblx0XHRcdGFscGhhIDogdHJ1ZVxuXHRcdH0pO1xuXHRcdHRoaXMucmVuZGVyZXIuc2V0U2l6ZSggd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCApO1xuXHRcdHRoaXMuZGl2LmFwcGVuZENoaWxkKCB0aGlzLnJlbmRlcmVyLmRvbUVsZW1lbnQgKTtcblx0fSxcblx0XG5cdGFkZFN0YXRzIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zdGF0cyA9IG5ldyBTdGF0cygpO1xuXHRcdHRoaXMuc3RhdHMuZG9tRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dGhpcy5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnRvcCA9ICcwcHgnO1xuXHRcdCQoXCIjY29udGFpbmVyXCIpLmFwcGVuZCggdGhpcy5zdGF0cy5kb21FbGVtZW50ICk7XG5cdH0sXG5cdFxuXHRhZGRHcmlkIDogZnVuY3Rpb24oKSB7XG5cblx0XHR2YXIgbGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKCB7IGNvbG9yOiAweDMwMzAzMCB9ICksXG5cdFx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpLFxuXHRcdFx0Zmxvb3IgPSAtNzUsIHN0ZXAgPSAyNTtcblxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8PSA0MDsgaSArKyApIHtcblxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoIC0gNTAwLCBmbG9vciwgaSAqIHN0ZXAgLSA1MDAgKSApO1xuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggbmV3IFRIUkVFLlZlY3RvcjMoICAgNTAwLCBmbG9vciwgaSAqIHN0ZXAgLSA1MDAgKSApO1xuXG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyggaSAqIHN0ZXAgLSA1MDAsIGZsb29yLCAtNTAwICkgKTtcblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIG5ldyBUSFJFRS5WZWN0b3IzKCBpICogc3RlcCAtIDUwMCwgZmxvb3IsICA1MDAgKSApO1xuXG5cdFx0fVxuXG5cdFx0dGhpcy5ncmlkID0gbmV3IFRIUkVFLkxpbmUoIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWwsIFRIUkVFLkxpbmVQaWVjZXMgKTtcblx0XHR0aGlzLnNjZW5lLmFkZCggdGhpcy5ncmlkICk7XG5cblx0fSxcblx0XG5cdGFkZEV2ZW50TGlzdGVuZXJzIDogZnVuY3Rpb24oKSB7XG5cdFx0JCh3aW5kb3cpLm9uKCdyZXNpemUnLCB0aGlzLnJlc2l6ZUhhbmRsZXIuYmluZCh0aGlzKSk7XG5cdH0sXG5cdFxuXHRyZXNpemVIYW5kbGVyIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jYW1lcmEucmVzaXplKCk7XG5cdFx0dGhpcy5yZW5kZXJlci5zZXRTaXplKCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0ICk7XG5cblx0fSxcblx0XHRcdFxuXHRsb29wIDogZnVuY3Rpb24oKSB7XG5cblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoIHRoaXMubG9vcC5iaW5kKHRoaXMpICk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblxuXHR9LFxuXHRcdFx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHRoaXMuc3RhdHMudXBkYXRlKCk7XG5cdFx0XG5cdFx0dGhpcy5kaXNwYXRjaCh7XG5cdFx0XHR0eXBlOiBcInVwZGF0ZVwiLFxuXHRcdFx0ZHQ6IHRoaXMuY2xvY2suZ2V0RGVsdGEoKSxcblx0XHRcdHRpbWU6IHRoaXMuY2xvY2sudGltZVxuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCB0aGlzLnNjZW5lLCB0aGlzLmNhbWVyYS5vYmplY3QgKTtcblx0fSxcblx0XG59O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBQb2VtLnByb3RvdHlwZSApOyIsInZhciBISUQgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvSGlkJyk7XG52YXIgRGFtYWdlID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL0RhbWFnZScpO1xuXG52YXIgU2hpcCA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHRcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLmhpZCA9IG5ldyBISUQoKTtcblx0dGhpcy5jb2xvciA9IDB4NEE5REU3O1xuXHR0aGlzLmxpbmV3aWR0aCA9IDIgKiB0aGlzLnBvZW0ucmF0aW87XG5cdHRoaXMucmFkaXVzID0gMztcblx0XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHRcblx0dGhpcy5kZWFkID0gZmFsc2U7XG5cdHRoaXMubGl2ZXMgPSAzO1xuXHR0aGlzLmludnVsbmVyYWJsZSA9IHRydWU7XG5cdHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoID0gMzAwMDtcblx0dGhpcy5pbnZ1bG5lcmFibGVUaW1lID0gMCArIHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoO1xuXHR0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wID0gZmFsc2U7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BMZW5ndGggPSAxMDA7XG5cdHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BUaW1lID0gMDtcblx0XG5cdHRoaXMuc3BlZWQgPSAwO1xuXHRcblx0dGhpcy5lZGdlQXZvaWRhbmNlQmFua1NwZWVkID0gMC4wNDtcblx0dGhpcy5lZGdlQXZvaWRhbmNlVGhydXN0U3BlZWQgPSAwLjAwMTtcblx0XG5cdHRoaXMudGhydXN0U3BlZWQgPSAwLjAwMTtcblx0dGhpcy50aHJ1c3QgPSAwO1xuXHRcblx0dGhpcy5iYW5rU3BlZWQgPSAwLjA2O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gMTAwMDtcblxuXHR0aGlzLmFkZE9iamVjdCgpO1xuXHR0aGlzLmRhbWFnZSA9IG5ldyBEYW1hZ2UodGhpcy5wb2VtLCB0aGlzKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2hpcDtcblxuU2hpcC5wcm90b3R5cGUgPSB7XG5cdFxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBnZW9tZXRyeSwgdmVydHMsIG1hbmhhdHRhbkxlbmd0aCwgY2VudGVyO1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCksXG5cdFx0XG5cdFx0dmVydHMgPSBbWzUwLDM2LjldLCBbMzkuOCw1OS42XSwgWzQ3LjEsNTMuOV0sIFs1MCw1Ny41XSwgWzUzLDUzLjldLCBbNjAuMiw1OS42XSwgWzUwLDM2LjldXTtcblxuXHRcdG1hbmhhdHRhbkxlbmd0aCA9IF8ucmVkdWNlKCB2ZXJ0cywgZnVuY3Rpb24oIG1lbW8sIHZlcnQyZCApIHtcblx0XHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcdFxuXHRcdH0sIFswLDBdKTtcblx0XHRcblx0XHRjZW50ZXIgPSBbXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMF0gLyB2ZXJ0cy5sZW5ndGgsXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMV0gLyB2ZXJ0cy5sZW5ndGhcblx0XHRdO1xuXHRcdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiApIHtcblx0XHRcdHZhciBzY2FsZSA9IDEgLyA0O1xuXHRcdFx0cmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKFxuXHRcdFx0XHQodmVjMlsxXSAtIGNlbnRlclsxXSkgKiBzY2FsZSAqIC0xLFxuXHRcdFx0XHQodmVjMlswXSAtIGNlbnRlclswXSkgKiBzY2FsZSxcblx0XHRcdFx0MFxuXHRcdFx0KTtcblx0XHR9KTtcblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFx0XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuY3JlYXRlR2VvbWV0cnkoKTtcblx0XHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogKz0gdGhpcy5wb2VtLnI7XG5cdFx0XG5cdFx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdFx0dGhpcy5yZXNldCgpO1xuXHRcdHRoaXMuc2NlbmUuYWRkKCB0aGlzLnBvbGFyT2JqICk7XG5cdH0sXG5cdFxuXHRraWxsIDogZnVuY3Rpb24oIGZvcmNlICkge1xuXHRcdFxuXHRcdGlmKCAhZm9yY2UgJiYgIXRoaXMuZGVhZCAmJiAhdGhpcy5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHR0aGlzLmRlYWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5kYW1hZ2UuZXhwbG9kZSgpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnBvZW0uc2NvcmUuYWRqdXN0U2NvcmUoXG5cdFx0XHRcdE1hdGguY2VpbCggdGhpcy5wb2VtLnNjb3JlLnNjb3JlIC8gLTIgKVxuXHRcdFx0KTtcblx0XHRcdFxuXHRcdFxuXHRcdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFxuXHRcdFx0XHR0aGlzLmRlYWQgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGUgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZVRpbWUgPSB0aGlzLnBvZW0uY2xvY2sudGltZSArIHRoaXMuaW52dWxuZXJhYmxlTGVuZ3RoO1xuXHRcdFx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5yZXNldCgpO1xuXHRcdFx0XG5cdFx0XHR9LmJpbmQodGhpcyksIDIwMDApO1xuXHRcdH1cblx0fSxcblx0XG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi54ID0gMDtcblx0XHR0aGlzLnBvc2l0aW9uLnkgPSAwO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFx0XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZVRocnVzdEFuZEJhbmsoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlRWRnZUF2b2lkYW5jZSggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVQb3NpdGlvbiggZSApO1xuXHRcdFx0dGhpcy51cGRhdGVGaXJpbmcoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlSW52dWxuZXJhYmlsaXR5KCBlICk7XG5cdFx0XHRcblx0XHR9XG5cdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cdFx0dGhpcy5oaWQudXBkYXRlKCBlICk7XG5cblx0fSxcblx0XG5cdHVwZGF0ZUludnVsbmVyYWJpbGl0eSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdGlmKCB0aGlzLmludnVsbmVyYWJsZSApIHtcblx0XHRcdFxuXHRcdFx0aWYoIGUudGltZSA8IHRoaXMuaW52dWxuZXJhYmxlVGltZSApIHtcblx0XHRcdFx0XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggZS50aW1lID4gdGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcFRpbWUgKSB7XG5cblx0XHRcdFx0XHR0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wVGltZSA9IGUudGltZSArIHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3BMZW5ndGg7XG5cdFx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGVmbGlwRmxvcCA9ICF0aGlzLmludnVsbmVyYWJsZWZsaXBGbG9wO1x0XG5cdFx0XHRcdFx0dGhpcy5vYmplY3QudmlzaWJsZSA9IHRoaXMuaW52dWxuZXJhYmxlZmxpcEZsb3A7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdH1cblx0XHRcdFx0XHRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFxuXHRcdFx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5pbnZ1bG5lcmFibGUgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdH1cblx0XHRcblx0fSxcblx0XG5cdHVwZGF0ZVRocnVzdEFuZEJhbmsgOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgcHJlc3NlZCA9IHRoaXMuaGlkLnByZXNzZWQ7XG5cdFx0XHRcblx0XHR0aGlzLmJhbmsgKj0gMC45O1xuXHRcdHRoaXMudGhydXN0ID0gMDtcblx0XHRcdFxuXHRcdGlmKCBwcmVzc2VkLnVwICkge1xuXHRcdFx0dGhpcy50aHJ1c3QgKz0gdGhpcy50aHJ1c3RTcGVlZCAqIGUuZHQ7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKCBwcmVzc2VkLmRvd24gKSB7XG5cdFx0XHR0aGlzLnRocnVzdCAtPSB0aGlzLnRocnVzdFNwZWVkICogZS5kdDtcdFxuXHRcdH1cblx0XHRcblx0XHRpZiggcHJlc3NlZC5sZWZ0ICkge1xuXHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQ7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKCBwcmVzc2VkLnJpZ2h0ICkge1xuXHRcdFx0dGhpcy5iYW5rID0gdGhpcy5iYW5rU3BlZWQgKiAtMTtcblx0XHR9XG5cdH0sXG5cdFxuXHR1cGRhdGVFZGdlQXZvaWRhbmNlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0dmFyIG5lYXJFZGdlLCBmYXJFZGdlLCBwb3NpdGlvbiwgbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiwgYmFua0RpcmVjdGlvbiwgYWJzUG9zaXRpb247XG5cdFx0XG5cdFx0ZmFyRWRnZSA9IHRoaXMucG9lbS5oZWlnaHQgLyAyO1xuXHRcdG5lYXJFZGdlID0gNCAvIDUgKiBmYXJFZGdlO1xuXHRcdHBvc2l0aW9uID0gdGhpcy5vYmplY3QucG9zaXRpb24ueTtcblx0XHRhYnNQb3NpdGlvbiA9IE1hdGguYWJzKCBwb3NpdGlvbiApO1xuXG5cdFx0dmFyIHJvdGF0aW9uID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiAvIE1hdGguUEk7XG5cblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICU9IDIgKiBNYXRoLlBJO1xuXHRcdFxuXHRcdGlmKCB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgMCApIHtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gMiAqIE1hdGguUEk7XG5cdFx0fVxuXHRcdFxuXHRcdGlmKCBNYXRoLmFicyggcG9zaXRpb24gKSA+IG5lYXJFZGdlICkge1xuXHRcdFx0XG5cdFx0XHR2YXIgaXNQb2ludGluZ0xlZnQgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56ID49IE1hdGguUEkgKiAwLjUgJiYgdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IE1hdGguUEkgKiAxLjU7XG5cdFx0XHRcblx0XHRcdGlmKCBwb3NpdGlvbiA+IDAgKSB7XG5cdFx0XHRcdFxuXHRcdFx0XHRpZiggaXNQb2ludGluZ0xlZnQgKSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IC0xO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiggaXNQb2ludGluZ0xlZnQgKSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IC0xO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gPSAoYWJzUG9zaXRpb24gLSBuZWFyRWRnZSkgLyAoZmFyRWRnZSAtIG5lYXJFZGdlKTtcblx0XHRcdHRoaXMudGhydXN0ICs9IG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZDtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gYmFua0RpcmVjdGlvbiAqIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQ7XG5cdFx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGVGaXJpbmcgOiBmdW5jdGlvbiggZSApIHtcblx0XHRpZiggdGhpcy5oaWQucHJlc3NlZC5zcGFjZWJhciApIHtcblx0XHRcdHRoaXMucG9lbS5ndW4uZmlyZSggdGhpcy5wb3NpdGlvbi54LCB0aGlzLnBvc2l0aW9uLnksIDIsIHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKTtcblx0XHR9XG5cdH0sXG5cdFxuXHR1cGRhdGVQb3NpdGlvbiA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBtb3ZlbWVudCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdFx0dmFyIHRoZXRhLCB4LCB5O1xuXHRcdFx0XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IHRoaXMuYmFuaztcblx0XHRcdFxuXHRcdFx0dGhldGEgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcdFx0XG5cdFx0XHR0aGlzLnNwZWVkICo9IDAuOTg7XG5cdFx0XHR0aGlzLnNwZWVkICs9IHRoaXMudGhydXN0O1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWluKCB0aGlzLm1heFNwZWVkLCB0aGlzLnNwZWVkICk7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5tYXgoIDAsIHRoaXMuc3BlZWQgKTtcblx0XHRcdFx0XHRcdFxuXHRcdFx0dGhpcy5wb3NpdGlvbi54ICs9IHRoaXMuc3BlZWQgKiBNYXRoLmNvcyggdGhldGEgKTtcblx0XHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkICogTWF0aC5zaW4oIHRoZXRhICk7XG5cdFx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnk7XG5cdFx0XHRcblx0XHRcdC8vUG9sYXIgY29vcmRpbmF0ZXNcblx0XHRcdHRoaXMucG9sYXJPYmoucm90YXRpb24ueSA9IHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdFx0XHRcblx0XHR9O1xuXHRcdFxuXHR9KClcblx0XG5cdFxufTsiLCJ2YXIgQ2FtZXJhID0gZnVuY3Rpb24oIHBvZW0gKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dGhpcy5wb2xhck9iaiA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xuXHRcblx0dGhpcy5zcGVlZCA9IDAuMDMyO1xuXHRcblx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoXG5cdFx0NTAsXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBmb3Zcblx0XHR3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodCxcdC8vIGFzcGVjdCByYXRpb1xuXHRcdDMsXHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBuZWFyIGZydXN0dW1cblx0XHQxMDAwXHRcdFx0XHRcdFx0XHRcdFx0Ly8gZmFyIGZydXN0dW1cblx0KTtcblx0dGhpcy5vYmplY3QucG9zaXRpb24ueiA9IHRoaXMucG9lbS5yICogMS41O1xuXHRcblx0dGhpcy5wb2xhck9iai5hZGQoIHRoaXMub2JqZWN0ICk7XG5cdHRoaXMucG9lbS5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW1lcmE7XG5cbkNhbWVyYS5wcm90b3R5cGUgPSB7XG5cdFxuXHRyZXNpemUgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLm9iamVjdC5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0XHR0aGlzLm9iamVjdC51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHR2YXIgdGhpc1RoZXRhID0gdGhpcy5wb2xhck9iai5yb3RhdGlvbi55O1xuXHRcdHZhciB0aGF0VGhldGEgPSB0aGlzLnBvZW0uc2hpcC5wb2xhck9iai5yb3RhdGlvbi55O1xuXHRcdHZhciB0aGV0YURpZmYgPSBNYXRoLmFicyh0aGlzVGhldGEgLSB0aGF0VGhldGEpO1xuXHRcdFxuXHRcdC8vIGlmKCB0aGV0YURpZmYgPiAwLjIgKSB7XG5cdFx0XG5cdFx0XHR0aGlzLnBvbGFyT2JqLnJvdGF0aW9uLnkgPVxuXHRcdFx0XHR0aGF0VGhldGEgKiAodGhpcy5zcGVlZCkgK1xuXHRcdFx0XHR0aGlzVGhldGEgKiAoMSAtIHRoaXMuc3BlZWQpO1xuXHRcdFx0XHRcblx0XHQvLyB9XG5cdFx0XG5cdH1cbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG52YXIgcmFuZG9tID0gcmVxdWlyZSgnLi4vdXRpbHMvcmFuZG9tLmpzJyk7XG52YXIgQnVsbGV0ID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvQnVsbGV0Jyk7XG52YXIgU291bmRHZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9zb3VuZC9Tb3VuZEdlbmVyYXRvcicpO1xuXG5EYW1hZ2UgPSBmdW5jdGlvbiggcG9lbSwgc2hpcCwgc2V0dGluZ3MgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLnNoaXAgPSBzaGlwO1xuXHR0aGlzLnBlckV4cGxvc2lvbiA9IDEwMDtcblx0dGhpcy5yZXRhaW5FeHBsb3Npb25zQ291bnQgPSAzO1xuXHR0aGlzLmJ1bGxldHMgPSBbXTtcblx0dGhpcy5leHBsb2RlU3BlZWQgPSAzO1xuXHR0aGlzLnRyYW5zcGFyZW50ID0gZmFsc2U7XG5cdHRoaXMub3BhY2l0eSA9IDE7XG5cdFxuXHR0aGlzLmV4cGxvc2lvbkNvdW50ID0gMDtcblx0dGhpcy5leHBsb3Npb25Tb3VuZCA9IG51bGw7XG5cdFxuXHRpZiggXy5pc09iamVjdCggc2V0dGluZ3MgKSApIHtcblx0XHRfLmV4dGVuZCggdGhpcywgc2V0dGluZ3MgKTtcblx0fVxuXHRcblx0dGhpcy5jb3VudCA9IHRoaXMucGVyRXhwbG9zaW9uICogdGhpcy5yZXRhaW5FeHBsb3Npb25zQ291bnQ7XG5cdFxuXHR0aGlzLmFkZE9iamVjdCgpO1xuXHR0aGlzLmFkZFNvdW5kKCk7XG59O1xuXHRcbkRhbWFnZS5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIHZlcnRleCwgYnVsbGV0O1xuXHRcdFxuXHRcdGdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0XG5cdFx0Zm9yKHZhciBpPTA7IGkgPCB0aGlzLmNvdW50OyBpKyspIHtcblx0XHRcdFxuXHRcdFx0dmVydGV4ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XHRcdGJ1bGxldCA9IG5ldyBCdWxsZXQoIHRoaXMucG9lbSwgdGhpcywgdmVydGV4ICk7XG5cdFx0XHRcblx0XHRcdGdlb21ldHJ5LnZlcnRpY2VzLnB1c2goIHZlcnRleCApO1xuXHRcdFx0dGhpcy5idWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFx0XG5cdFx0XHRidWxsZXQua2lsbCgpO1xuXHRcdFx0YnVsbGV0LnBvc2l0aW9uLnkgPSAxMDAwO1xuXHRcdFx0XHRcdFxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdH0sXG5cdFxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XHRcblx0XHRnZW9tZXRyeSA9IHRoaXMuZ2VuZXJhdGVHZW9tZXRyeSgpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLlBvaW50Q2xvdWQoXG5cdFx0XHRnZW9tZXRyeSxcblx0XHRcdG5ldyBUSFJFRS5Qb2ludENsb3VkTWF0ZXJpYWwoe1xuXHRcdFx0XHQgc2l6ZTogMSAqIHRoaXMucG9lbS5yYXRpbyxcblx0XHRcdFx0IGNvbG9yOiB0aGlzLnNoaXAuY29sb3IsXG5cdFx0XHRcdCB0cmFuc3BhcmVudDogdGhpcy50cmFuc3BhcmVudCxcblx0XHRcdFx0IG9wYWNpdHk6IHRoaXMub3BhY2l0eVxuXHRcdFx0fVxuXHRcdCkpO1xuXHRcdHRoaXMub2JqZWN0LmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcblx0XHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApIDtcblx0XHRcblx0fSxcblx0XG5cdGFkZFNvdW5kIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIHNvdW5kID0gdGhpcy5leHBsb3Npb25Tb3VuZCA9IG5ldyBTb3VuZEdlbmVyYXRvcigpO1xuXHRcdFxuXHRcdHNvdW5kLmNvbm5lY3ROb2RlcyhbXG5cdFx0XHRzb3VuZC5tYWtlT3NjaWxsYXRvciggXCJzYXd0b290aFwiICksXG5cdFx0XHRzb3VuZC5tYWtlR2FpbigpLFxuXHRcdFx0c291bmQuZ2V0RGVzdGluYXRpb24oKVxuXHRcdF0pO1xuXHRcdFxuXHRcdHNvdW5kLnNldEdhaW4oMCwwLDApO1xuXHRcdHNvdW5kLnN0YXJ0KCk7XG5cdFx0XG5cdH0sXG5cdFxuXHRyZXNldCA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy5idWxsZXRzLCBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0YnVsbGV0LmtpbGwoKTtcblx0XHR9KTtcblx0XHRcblx0fSxcblx0XG5cdGV4cGxvZGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLnBsYXlFeHBsb3Npb25Tb3VuZCgpO1xuXHRcdFxuXHRcdF8uZWFjaCggXy5zYW1wbGUoIHRoaXMuYnVsbGV0cywgdGhpcy5wZXJFeHBsb3Npb24gKSwgZnVuY3Rpb24oIGJ1bGxldCkge1xuXG5cdFx0XHR2YXIgdGhldGEgPSByYW5kb20ucmFuZ2UoMCwgMiAqIE1hdGguUEkpO1xuXHRcdFx0dmFyIHIgPSByYW5kb20ucmFuZ2VMb3coIDAsIHRoaXMuZXhwbG9kZVNwZWVkICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5hbGl2ZSA9IHRydWU7XG5cdFx0XHRidWxsZXQucG9zaXRpb24uY29weSggdGhpcy5zaGlwLnBvc2l0aW9uICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5zcGVlZC54ID0gciAqIE1hdGguY29zKCB0aGV0YSApO1xuXHRcdFx0YnVsbGV0LnNwZWVkLnkgPSByICogTWF0aC5zaW4oIHRoZXRhICk7XG5cdFx0XHRcdFx0XHRcblx0XHR9LmJpbmQodGhpcykpO1xuXHRcdFxuXHR9LFxuXHRcblx0cGxheUV4cGxvc2lvblNvdW5kIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGZyZXEgPSA1MDA7XG5cdFx0dmFyIHNvdW5kID0gdGhpcy5leHBsb3Npb25Tb3VuZFxuXG5cdFx0Ly9TdGFydCBzb3VuZFxuXHRcdHNvdW5kLnNldEdhaW4oMC41LCAwLCAwLjAwMSk7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBzdGVwID0gMC4wMjtcblx0XHR2YXIgdGltZXMgPSA2O1xuXHRcdHZhciBpPTE7XG5cdFx0XG5cdFx0Zm9yKGk9MTsgaSA8IHRpbWVzOyBpKyspIHtcblx0XHRcdHNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogTWF0aC5yYW5kb20oKSwgc3RlcCAqIGksIHN0ZXApO1xuXHRcdH1cblxuXHRcdC8vRW5kIHNvdW5kXG5cdFx0c291bmQuc2V0R2FpbigwLCBzdGVwICogdGltZXMsIDAuMik7XG5cdFx0c291bmQuc2V0RnJlcXVlbmN5KGZyZXEgKiAwLjIxLCBzdGVwICogdGltZXMsIDAuMDUpO1xuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSAge1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy5idWxsZXRzLCBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0YnVsbGV0LnVwZGF0ZSggZSApO1xuXHRcdFx0YnVsbGV0LnNwZWVkLm11bHRpcGx5U2NhbGFyKDAuOTk5KTtcblx0XHR9KTtcblx0XHRcblx0XHR0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGFtYWdlOyIsInZhciBFdmVudERpc3BhdGNoZXIgPSByZXF1aXJlKCcuLi91dGlscy9FdmVudERpc3BhdGNoZXInKTtcblxudmFyIEhJRCA9IGZ1bmN0aW9uKCkge1xuXHRcblx0dmFyIHN0YXRlcyA9IHtcblx0XHR1cDogZmFsc2UsXG5cdFx0ZG93bjogZmFsc2UsXG5cdFx0bGVmdDogZmFsc2UsXG5cdFx0cmlnaHQ6IGZhbHNlLFxuXHRcdHNwYWNlYmFyOiBmYWxzZVxuXHR9O1xuXHRcblx0dGhpcy5rZXlDb2RlcyA9IHtcblx0XHRcImszOFwiIDogXCJ1cFwiLFxuXHRcdFwiazQwXCIgOiBcImRvd25cIixcblx0XHRcImszN1wiIDogXCJsZWZ0XCIsXG5cdFx0XCJrMzlcIiA6IFwicmlnaHRcIixcblx0XHRcImszMlwiIDogXCJzcGFjZWJhclwiXG5cdH1cblx0XG5cdHRoaXMucHJlc3NlZCA9IF8uY2xvbmUoc3RhdGVzKTtcblx0dGhpcy5kb3duID0gXy5jbG9uZShzdGF0ZXMpO1xuXHR0aGlzLnVwID0gXy5jbG9uZShzdGF0ZXMpO1xuXHRcblx0JCh3aW5kb3cpLm9uKCdrZXlkb3duJywgdGhpcy5rZXlkb3duLmJpbmQodGhpcykpO1xuXHQkKHdpbmRvdykub24oJ2tleXVwJywgdGhpcy5rZXl1cC5iaW5kKHRoaXMpKTtcblx0XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhJRDtcblxuSElELnByb3RvdHlwZSA9IHtcblx0XG5cdGtleWRvd24gOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgY29kZSA9IHRoaXMua2V5Q29kZXNbIFwia1wiICsgZS5rZXlDb2RlIF07XG5cdFx0XG5cdFx0aWYoY29kZSkge1xuXHRcdFx0dGhpcy5kb3duW2NvZGVdID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJlc3NlZFtjb2RlXSA9IHRydWU7XG5cdFx0fVxuXHR9LFxuXHRcblx0a2V5dXAgOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgY29kZSA9IHRoaXMua2V5Q29kZXNbIFwia1wiICsgZS5rZXlDb2RlIF07XG5cdFx0XG5cdFx0aWYoY29kZSkge1xuXHRcdFx0dGhpcy5wcmVzc2VkW2NvZGVdID0gZmFsc2U7XG5cdFx0XHR0aGlzLnVwW2NvZGVdID0gdHJ1ZTtcblx0XHR9XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZmFsc2lmeSA9IGZ1bmN0aW9uICh2YWx1ZSwga2V5LCBsaXN0KSB7XG5cdFx0XHRsaXN0W2tleV0gPSBmYWxzZVxuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFx0XHRfLmVhY2goIHRoaXMuZG93biwgZmFsc2lmeSApO1xuXHRcdFx0Xy5lYWNoKCB0aGlzLnVwLCBmYWxzaWZ5ICk7XG5cdFx0fTtcblx0XHRcblx0fSgpXG5cdFxufTtcblxuRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5hcHBseSggSElELnByb3RvdHlwZSApOyIsInZhciBTY29yZSA9IGZ1bmN0aW9uKCkge1xuXHR0aGlzLiRzY29yZSA9ICQoJyNzY29yZScpO1xuXHR0aGlzLiRlbmVtaWVzQ291bnQgPSAkKCcjZW5lbWllcy1jb3VudCcpO1xuXHR0aGlzLiR3aW4gPSAkKCcud2luJyk7XG5cdHRoaXMuJHdpblNjb3JlID0gJCgnI3dpbi1zY29yZScpO1xuXHR0aGlzLnNjb3JlID0gMDtcblx0dGhpcy5lbmVtaWVzQ291bnQgPSAwO1xuXHRcblx0dGhpcy53b24gPSBmYWxzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2NvcmU7XG5cblNjb3JlLnByb3RvdHlwZSA9IHtcblx0XG5cdGFkanVzdEVuZW1pZXMgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0aWYodGhpcy53b24pIHJldHVybjtcblx0XHR0aGlzLmVuZW1pZXNDb3VudCArPSBjb3VudDtcblx0XHR0aGlzLiRlbmVtaWVzQ291bnQudGV4dCggdGhpcy5lbmVtaWVzQ291bnQgKTtcblx0XHRcblx0XHRpZiggdGhpcy5lbmVtaWVzQ291bnQgPT09IDAgKSB7XG5cdFx0XHR0aGlzLnNob3dXaW4oKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZW5lbWllc0NvdW50O1xuXHR9LFxuXHRcblx0YWRqdXN0U2NvcmUgOiBmdW5jdGlvbiggY291bnQgKSB7XG5cdFx0aWYodGhpcy53b24pIHJldHVybjtcblx0XHR0aGlzLnNjb3JlICs9IGNvdW50O1xuXHRcdHRoaXMuJHNjb3JlLnRleHQoIHRoaXMuc2NvcmUgKTtcblx0XHRyZXR1cm4gdGhpcy5zY29yZTtcblx0fSxcblx0XG5cdHNob3dXaW4gOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR0aGlzLndvbiA9IHRydWU7XG5cdFx0XG5cdFx0dGhpcy4kd2luU2NvcmUudGV4dCggdGhpcy5zY29yZSApO1xuXHRcdHRoaXMuJHdpbi5zaG93KCk7XG5cdFx0dGhpcy4kd2luLmNzcyh7XG5cdFx0XHRvcGFjaXR5OiAxXG5cdFx0fSk7XG5cdH1cblx0XG59OyIsInZhciBTdGFycyA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLm9iamVjdCA9IG51bGw7XG5cdFxuXHR0aGlzLmNvdW50ID0gNDAwMDA7XG5cdHRoaXMuZGVwdGggPSA3LjU7XG5cdHRoaXMuY29sb3IgPSAweGFhYWFhYTtcblx0XG5cdHRoaXMuYWRkT2JqZWN0KCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXJzO1xuXG5TdGFycy5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZUdlb21ldHJ5IDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHIsIHRoZXRhLCB4LCB5LCB6LCBnZW9tZXRyeTtcblx0XHRcblx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRcdFxuXHRcdGZvcih2YXIgaT0wOyBpIDwgdGhpcy5jb3VudDsgaSsrKSB7XG5cdFx0XHRcblx0XHRcdHIgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0aWYoIHIgPCB0aGlzLnBvZW0uciApIHtcblx0XHRcdFx0ciA9IE1hdGgucmFuZG9tKCkgKiB0aGlzLmRlcHRoICogdGhpcy5wb2VtLnI7XG5cdFx0XHR9XG5cdFx0XHR0aGV0YSA9IE1hdGgucmFuZG9tKCkgKiAyICogTWF0aC5QSTtcblx0XHRcdFxuXHRcdFx0eCA9IE1hdGguY29zKCB0aGV0YSApICogcjtcblx0XHRcdHogPSBNYXRoLnNpbiggdGhldGEgKSAqIHI7XG5cdFx0XHR5ID0gKDAuNSAtIE1hdGgucmFuZG9tKCkpICogdGhpcy5kZXB0aCAqIHRoaXMucG9lbS5yO1xuXHRcdFx0XG5cdFx0XHRnZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKCBuZXcgVEhSRUUuVmVjdG9yMyh4LHkseikgKTtcblx0XHRcdFx0XHRcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHR9LFxuXHRcblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmdlbmVyYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRuZXcgVEhSRUUuUG9pbnRDbG91ZE1hdGVyaWFsKHtcblx0XHRcdFx0IHNpemU6IDAuNSAqIHRoaXMucG9lbS5yYXRpbyxcblx0XHRcdFx0IGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0XHQgZm9nOiBmYWxzZVxuXHRcdFx0fVxuXHRcdCkgKTtcblx0XHRcblx0XHR0aGlzLnBvZW0uc2NlbmUuYWRkKCB0aGlzLm9iamVjdCApIDtcblx0XHRcblx0fVxufTsiLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxudmFyIEFzdGVyb2lkID0gZnVuY3Rpb24oIHBvZW0sIHgsIHksIHJhZGl1cyApIHtcblx0XG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMub2JqZWN0ID0gbnVsbDtcblx0XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHR0aGlzLnBvc2l0aW9uLnggPSB4IHx8IDA7XG5cdHRoaXMucG9zaXRpb24ueSA9IHkgfHwgMDtcblx0dGhpcy5vc2NpbGxhdGlvbiA9IDA7XG5cdHRoaXMucmFkaXVzID0gcmFkaXVzIHx8IDU7XG5cdHRoaXMuc3BlZWQgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXHR0aGlzLnJvdGF0aW9uU3BlZWQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHR0aGlzLm1heFNwZWVkID0gMC41O1xuXHR0aGlzLm1heFJvdGF0aW9uU3BlZWQgPSAwLjE7XG5cdHRoaXMub3NjaWxsYXRpb25TcGVlZCA9IDUwO1xuXHR0aGlzLnN0cm9rZUNvbG9yID0gMHhkZGRkZGQ7XG5cdHRoaXMuZmlsbENvbG9yID0gMHhmZmZmZmY7XG5cdHRoaXMuYWRkT2JqZWN0KHgsIHkpO1xuXHR0aGlzLnVwZGF0ZSgpO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXN0ZXJvaWQ7XG5cbkFzdGVyb2lkLnByb3RvdHlwZSA9IHtcblxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuT2N0YWhlZHJvbkdlb21ldHJ5KHRoaXMucmFkaXVzLCAxKTtcblx0XHRcblx0XHQvL0Rpc2Zvcm1cblx0XHRfLmVhY2goZ2VvbWV0cnkudmVydGljZXMsIGZ1bmN0aW9uKCB2ZXJ0ZXggKSB7XG5cdFx0XHR2ZXJ0ZXgueCArPSAodGhpcy5yYWRpdXMgLyAyKSAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcblx0XHRcdHZlcnRleC55ICs9ICh0aGlzLnJhZGl1cyAvIDIpICogKE1hdGgucmFuZG9tKCkgLSAwLjUpO1xuXHRcdFx0dmVydGV4LnogKz0gKHRoaXMucmFkaXVzIC8gMikgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XG5cdFx0fSwgdGhpcyk7XG5cdFx0XG5cdFx0dmFyIG1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtjb2xvcjp0aGlzLnN0cm9rZUNvbG9yfSk7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTWVzaCggZ2VvbWV0cnksIG1hdGVyaWFsICk7XG5cdFx0XG5cdFx0dmFyIG91dGxpbmVNYXQgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe2NvbG9yOnRoaXMuZmlsbENvbG9yLCBzaWRlOiBUSFJFRS5CYWNrU2lkZX0pO1xuXHRcdHZhciBvdXRsaW5lT2JqID0gbmV3IFRIUkVFLk1lc2goIGdlb21ldHJ5LCBvdXRsaW5lTWF0ICk7XG5cdFx0b3V0bGluZU9iai5zY2FsZS5tdWx0aXBseVNjYWxhciggMS4wNSk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QuYWRkKCBvdXRsaW5lT2JqICk7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHRcblx0XHR0aGlzLnNwZWVkLnggPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFNwZWVkO1xuXHRcdHRoaXMuc3BlZWQueSA9ICgwLjUgLSBNYXRoLnJhbmRvbSgpKSAqIHRoaXMubWF4U3BlZWQ7XG5cdFx0XG5cdFx0dGhpcy5yb3RhdGlvblNwZWVkLnggPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFJvdGF0aW9uU3BlZWQ7XG5cdFx0dGhpcy5yb3RhdGlvblNwZWVkLnkgPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFJvdGF0aW9uU3BlZWQ7XG5cdFx0dGhpcy5yb3RhdGlvblNwZWVkLnogPSAoMC41IC0gTWF0aC5yYW5kb20oKSkgKiB0aGlzLm1heFJvdGF0aW9uU3BlZWQ7XG5cdFx0XG5cdFx0dGhpcy5vc2NpbGxhdGlvbiA9IE1hdGgucmFuZG9tKCkgKiBNYXRoLlBJICogMiAqIHRoaXMub3NjaWxsYXRpb25TcGVlZDtcblx0fSxcblx0XG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdHRoaXMub3NjaWxsYXRpb24gKz0gdGhpcy5zcGVlZC55O1xuXHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkLng7XG5cdFx0dGhpcy5wb3NpdGlvbi55ID0gTWF0aC5zaW4oIHRoaXMub3NjaWxsYXRpb24gLyB0aGlzLm9zY2lsbGF0aW9uU3BlZWQgKSAqIHRoaXMucG9lbS5oZWlnaHQ7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueCArPSB0aGlzLnJvdGF0aW9uU3BlZWQueDtcdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnkgKz0gdGhpcy5yb3RhdGlvblNwZWVkLnk7XHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IHRoaXMucm90YXRpb25TcGVlZC56O1x0XG5cdFx0XG5cdFx0dGhpcy5wb2VtLmNvb3JkaW5hdGVzLnNldFZlY3RvciggdGhpcy5vYmplY3QucG9zaXRpb24sIHRoaXMucG9zaXRpb24gKTtcblx0fVxuXHRcbn07IiwidmFyIEJ1bGxldCA9IGZ1bmN0aW9uKCBwb2VtLCBndW4sIHZlcnRleCApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5ndW4gPSBndW47XG5cdHRoaXMudmVydGV4ID0gdmVydGV4O1xuXHRcblx0dGhpcy5zcGVlZCA9IG5ldyBUSFJFRS5WZWN0b3IyKDAsMCk7XG5cdHRoaXMucG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMigwLDApO1xuXHR0aGlzLnJhZGl1cyA9IDE7XG5cdFxuXHR0aGlzLmJvcm5BdCA9IDA7XG5cdHRoaXMuYWxpdmUgPSBmYWxzZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQnVsbGV0O1xuXG5CdWxsZXQucHJvdG90eXBlID0ge1xuXHRcblx0a2lsbCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudmVydGV4LnNldCgwLCAwICwxMDAwKTtcblx0XHR0aGlzLmFsaXZlID0gZmFsc2U7XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHR2YXIgeCx5LHo7XG5cblx0XHQvL2NvbnNvbGUubG9nKHRoaXMuc3BlZWQueCwgdGhpcy5zcGVlZC55KTtcblx0XHRcblx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZC54O1xuXHRcdHRoaXMucG9zaXRpb24ueSArPSB0aGlzLnNwZWVkLnk7XG5cdFx0XG5cdFx0dGhpcy5wb2VtLmNvb3JkaW5hdGVzLnNldFZlY3RvciggdGhpcy52ZXJ0ZXgsIHRoaXMucG9zaXRpb24gKTtcblx0XHRcblx0fSxcblx0XG5cdGZpcmUgOiBmdW5jdGlvbih4LCB5LCBzcGVlZCwgdGhldGEpIHtcblx0XHRcdFx0XG5cdFx0dGhpcy5wb2VtLmNvb3JkaW5hdGVzLnNldFZlY3RvciggdGhpcy52ZXJ0ZXgsIHgsIHkgKTtcblx0XHRcblx0XHR0aGlzLnBvc2l0aW9uLnNldCh4LHkpO1xuXHRcdFxuXHRcdHRoaXMuc3BlZWQueCA9IE1hdGguY29zKCB0aGV0YSApICogc3BlZWQ7XG5cdFx0dGhpcy5zcGVlZC55ID0gTWF0aC5zaW4oIHRoZXRhICkgKiBzcGVlZDtcblx0XHRcblx0XHR0aGlzLmJvcm5BdCA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHRcdHRoaXMuYWxpdmUgPSB0cnVlO1xuXHR9XG59OyIsInZhciBEYW1hZ2UgPSByZXF1aXJlKCcuLi9jb21wb25lbnRzL0RhbWFnZScpO1xudmFyIHJhbmRvbSA9IHJlcXVpcmUoJy4uL3V0aWxzL3JhbmRvbScpO1xuXG52YXIgSmVsbHlzaGlwID0gZnVuY3Rpb24oIHBvZW0sIG1hbmFnZXIsIHgsIHkgKSB7XG5cblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblx0dGhpcy5zY2VuZSA9IHBvZW0uc2NlbmU7XG5cdHRoaXMucG9sYXJPYmogPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXG5cdHRoaXMuY29sb3IgPSAweGNiMzZlYTtcblx0dGhpcy5saW5ld2lkdGggPSAyICogdGhpcy5wb2VtLnJhdGlvO1xuXHR0aGlzLnNjb3JlVmFsdWUgPSAxMztcblxuXHR0aGlzLnNwYXduUG9pbnQgPSBuZXcgVEhSRUUuVmVjdG9yMih4LHkpO1xuXHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjIoeCx5KTtcblx0XG5cdHRoaXMuZGVhZCA9IGZhbHNlO1xuXG5cdHRoaXMuc3BlZWQgPSAwO1xuXG5cdHRoaXMuZWRnZUF2b2lkYW5jZUJhbmtTcGVlZCA9IDAuMDQ7XG5cdHRoaXMuZWRnZUF2b2lkYW5jZVRocnVzdFNwZWVkID0gMC4wMDE7XG5cblx0dGhpcy50aHJ1c3RTcGVlZCA9IDE7XG5cdHRoaXMudGhydXN0ID0gMDtcblxuXHR0aGlzLmJhbmtTcGVlZCA9IDAuMDY7XG5cdHRoaXMuYmFuayA9IDA7XG5cdHRoaXMubWF4U3BlZWQgPSAxMDAwO1xuXHRcblx0dGhpcy5yYWRpdXMgPSAzO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuZGFtYWdlID0gbmV3IERhbWFnZSh0aGlzLnBvZW0sIHRoaXMsIHtcblx0XHR0cmFuc3BhcmVudDogdHJ1ZSxcblx0XHRvcGFjaXR5OiAwLjUsXG5cdFx0cmV0YWluRXhwbG9zaW9uc0NvdW50OiAzLFxuXHRcdHBlckV4cGxvc2lvbjogNTBcblx0fSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEplbGx5c2hpcDtcblxuSmVsbHlzaGlwLnByb3RvdHlwZSA9IHtcblxuXHRjcmVhdGVHZW9tZXRyeSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdC8vVE9ETyAtIFNoYXJlIGdlb21ldHJ5XG5cdFxuXHRcdHZhciBnZW9tZXRyeSwgdmVydHMsIG1hbmhhdHRhbkxlbmd0aCwgY2VudGVyO1xuXHRcblx0XHRnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpLFxuXHRcblx0XHQvL3ZlcnRzID0gW1szNTUuNywyMTEuN10sIFszNzUuOCwxOTUuOV0sIFszNjguNSwxNTUuNF0sIFszNjEuNCwxOTAuOF0sIFszNDEuMywyMDUuOV0sIFszMjAuNCwyMDEuOF0sIFsyOTguOSwyMDZdLCBbMjc4LjYsMTkwLjhdLCBbMjcxLjUsMTU1LjRdLCBbMjY0LjIsMTk1LjldLCBbMjg0LjcsMjEyXSwgWzI1OC4zLDIzOS4yXSwgWzI0Mi4zLDIyOC41XSwgWzIzOC4zLDE2OC45XSwgWzIyNi4xLDIzNy4xXSwgWzI0Ni43LDI2Ni4yXSwgWzIzMy43LDMxNi40XSwgWzI1OS4yLDMyMS4yXSwgWzIzNy40LDQyOS42XSwgWzI1My4xLDQzMi43XSwgWzI3NC45LDMyNC4yXSwgWzI5MywzMjcuNl0sIFsyODYuNiw0ODRdLCBbMzAyLjYsNDg0LjZdLCBbMzA4LjksMzMwLjZdLCBbMzIwLjQsMzMyLjhdLCBbMzMxLjEsMzMwLjhdLCBbMzM3LjQsNDg0LjZdLCBbMzUzLjQsNDg0XSwgWzM0NywzMjcuOF0sIFszNjUuMSwzMjQuM10sIFszODYuOSw0MzIuN10sIFs0MDIuNiw0MjkuNl0sIFszODAuOSwzMjEuNF0sIFs0MDcsMzE2LjRdLCBbMzkzLjgsMjY1LjVdLCBbNDEzLjksMjM3LjFdLCBbNDAxLjcsMTY4LjldLCBbMzk3LjcsMjI4LjVdLCBbMzgyLjEsMjM4LjldLCBbMzU1LjksMjExLjhdIF07XG5cdFx0XG5cdFx0dmVydHMgPSBbIFszNTUuNywyMTEuN10sIFszNzUuOCwxOTUuOV0sIFszNjguNSwxNTUuNF0sIFszNjEuNCwxOTAuOF0sIFszNDEuMywyMDUuOV0sIFszMjAuNCwyMDEuOF0sIFsyOTguOSwyMDZdLCBbMjc4LjYsMTkwLjhdLCBcblx0XHRcdFsyNzEuNSwxNTUuNF0sIFsyNjQuMiwxOTUuOV0sIFsyODQuNywyMTJdLCBbMjU4LjMsMjM5LjJdLCBbMjQyLjMsMjI4LjVdLCBbMjM4LjMsMTY4LjldLCBbMjI2LjEsMjM3LjFdLCBbMjQ2LjcsMjY2LjJdLCBbMjMzLjcsMzE2LjRdLCBbMjU5LjIsMzIxLjJdLCBcblx0XHRcdFsyNTcuMSwzMzEuM10sIFsyNTQuOSwzNDIuM10sIFsyNTIuOCwzNTIuOV0sIFsyNTAuNSwzNjQuNV0sIFsyNDguMiwzNzUuN10sIFsyNDYuMSwzODYuMl0sIFsyNDMuOCwzOTcuN10sIFsyNDEuMyw0MTAuM10sIFsyMzkuNSw0MTkuM10sIFsyMzcuNCw0MjkuNl0sIFxuXHRcdFx0WzI1My4xLDQzMi43XSwgWzI1NC45LDQyMy43XSwgWzI1Ni45LDQxNC4xXSwgWzI1OS4zLDQwMS44XSwgWzI2MS42LDM5MC4yXSwgWzI2My43LDM4MC4xXSwgWzI2Ni4xLDM2Ny44XSwgWzI2OC4zLDM1Ni45XSwgWzI3MC42LDM0NS42XSwgWzI3Mi43LDMzNS4xXSwgXG5cdFx0XHRbMjc0LjksMzI0LjJdLCBbMjkzLDMyNy42XSwgWzI5Mi42LDMzNi41XSwgWzI5Mi4yLDM0OF0sIFsyOTEuNywzNTkuNl0sIFsyOTEuMiwzNzEuNV0sIFsyOTAuNywzODIuNV0sIFsyOTAuMywzOTMuNl0sIFsyODkuOCw0MDUuMV0sIFsyODkuNSw0MTQuMV0sIFsyODksNDI1LjZdLCBcblx0XHRcdFsyODguNSw0MzddLCBbMjg4LjEsNDQ4LjVdLCBbMjg3LjYsNDU5LjVdLCBbMjg3LjEsNDcxLjVdLCBbMjg2LjYsNDg0XSwgWzMwMi42LDQ4NC42XSwgWzMwMy4xLDQ3My41XSwgWzMwMy42LDQ2MS41XSwgWzMwNC4xLDQ0OC41XSwgWzMwNC41LDQzOC41XSwgWzMwNSw0MjUuMV0sIFxuXHRcdFx0WzMwNS40LDQxNi4xXSwgWzMwNS45LDQwNV0sIFszMDYuMiwzOTUuNV0sIFszMDYuNiwzODZdLCBbMzA3LjEsMzczXSwgWzMwNy42LDM2MV0sIFszMDguMiwzNDcuNV0sIFszMDguNSwzMzguNV0sIFszMDguOSwzMzAuNl0sIFszMzEuMSwzMzAuOF0sIFszMzEuNCwzMzYuNV0sIFxuXHRcdFx0WzMzMS43LDM0NF0sIFszMzIsMzUzXSwgWzMzMi41LDM2NC41XSwgWzMzMywzNzZdLCBbMzMzLjQsMzg3LjVdLCBbMzMzLjksMzk4LjVdLCBbMzM0LjQsNDEwLjVdLCBbMzM0LjksNDIyLjRdLCBbMzM1LjQsNDM3XSwgWzMzNiw0NTBdLCBbMzM2LjQsNDYwXSwgWzMzNi44LDQ3MV0sIFxuXHRcdFx0WzMzNy40LDQ4NC42XSwgWzM1My40LDQ4NF0sIFszNTIuOCw0NzFdLCBbMzUyLjMsNDU3LjVdLCBbMzUxLjksNDQ4XSwgWzM1MS41LDQzNy41XSwgWzM1MC45LDQyM10sIFszNTAuNCw0MTAuNV0sIFszNDkuOCwzOTYuNV0sIFszNDkuNCwzODUuNV0sIFszNDguOSwzNzQuNF0sIFxuXHRcdFx0WzM0OC41LDM2My40XSwgWzM0OCwzNTJdLCBbMzQ3LjYsMzQzXSwgWzM0Ny4zLDMzNF0sIFszNDcsMzI3LjhdLCBbMzY1LjEsMzI0LjNdLCBbMzY2LjYsMzMxLjddLCBbMzY4LjIsMzM5LjZdLCBbMzcwLjIsMzQ5LjVdLCBbMzcxLjksMzU3LjhdLCBbMzczLjYsMzY2LjhdLCBcblx0XHRcdFszNzUuNCwzNzUuNF0sIFszNzcuMSwzODRdLCBbMzc5LDM5My41XSwgWzM4MS4yLDQwNC42XSwgWzM4My4xLDQxNF0sIFszODQuOSw0MjIuOF0sIFszODYuOSw0MzIuN10sIFs0MDIuNiw0MjkuNl0sIFs0MDAuNiw0MTkuNl0sIFszOTkuMSw0MTIuNV0sIFszOTcuMSw0MDIuNV0sIFxuXHRcdFx0WzM5NC43LDM5MC4yXSwgWzM5My4xLDM4Mi42XSwgWzM5MS40LDM3NF0sIFszODkuNiwzNjVdLCBbMzg3LjYsMzU1LjFdLCBbMzg2LDM0Ny4yXSwgWzM4NC4xLDMzNy43XSwgWzM4Mi43LDMzMC42XSwgWzM4MC45LDMyMS40XSwgWzQwNywzMTYuNF0sIFszOTMuOCwyNjUuNV0sIFxuXHRcdFx0WzQxMy45LDIzNy4xXSwgWzQwMS43LDE2OC45XSwgWzM5Ny43LDIyOC41XSwgWzM4Mi4xLDIzOC45XSwgWzM1NS45LDIxMS44XSBdO1xuXHRcdFxuXG5cdFx0bWFuaGF0dGFuTGVuZ3RoID0gXy5yZWR1Y2UoIHZlcnRzLCBmdW5jdGlvbiggbWVtbywgdmVydDJkICkge1xuXHRcdFxuXHRcdFx0cmV0dXJuIFttZW1vWzBdICsgdmVydDJkWzBdLCBtZW1vWzFdICsgdmVydDJkWzFdXTtcblx0XHRcblx0XHR9LCBbMCwwXSk7XG5cdFxuXHRcdGNlbnRlciA9IFtcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFswXSAvIHZlcnRzLmxlbmd0aCxcblx0XHRcdG1hbmhhdHRhbkxlbmd0aFsxXSAvIHZlcnRzLmxlbmd0aFxuXHRcdF07XG5cdFx0XG5cdFx0dGhpcy53YXZleVZlcnRzID0gW107XG5cdFxuXHRcdGdlb21ldHJ5LnZlcnRpY2VzID0gXy5tYXAoIHZlcnRzLCBmdW5jdGlvbiggdmVjMiApIHtcblx0XHRcdFxuXHRcdFx0dmFyIHNjYWxlID0gMSAvIDMyO1xuXHRcdFx0dmFyIHZlYzMgPSBuZXcgVEhSRUUuVmVjdG9yMyhcblx0XHRcdFx0KHZlYzJbMV0gLSBjZW50ZXJbMV0pICogc2NhbGUgKiAtMSxcblx0XHRcdFx0KHZlYzJbMF0gLSBjZW50ZXJbMF0pICogc2NhbGUsXG5cdFx0XHRcdDBcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdHZlYzMub3JpZ2luYWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkoIHZlYzMgKTtcblx0XHRcdFxuXHRcdFx0aWYoIHZlYzJbMV0gPiAzMzAuOCApIHtcblx0XHRcdFx0dGhpcy53YXZleVZlcnRzLnB1c2goIHZlYzMgKVxuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdmVjMztcblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcblx0XHRyZXR1cm4gZ2VvbWV0cnk7XG5cdFxuXHR9LFxuXG5cdGFkZE9iamVjdCA6IGZ1bmN0aW9uKCkge1xuXHRcblx0XHR2YXIgZ2VvbWV0cnksIGxpbmVNYXRlcmlhbDtcblx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmNyZWF0ZUdlb21ldHJ5KCk7XG5cdFx0XHRcblx0XHRsaW5lTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTGluZUJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IHRoaXMuY29sb3IsXG5cdFx0XHRsaW5ld2lkdGggOiB0aGlzLmxpbmV3aWR0aFxuXHRcdH0pO1xuXHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5MaW5lKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRsaW5lTWF0ZXJpYWwsXG5cdFx0XHRUSFJFRS5MaW5lU3RyaXBcblx0XHQpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnogKz0gdGhpcy5wb2VtLnI7XG5cdFxuXHRcdHRoaXMucG9sYXJPYmouYWRkKCB0aGlzLm9iamVjdCApO1xuXHRcdHRoaXMucmVzZXQoKTtcblx0XHR0aGlzLnNjZW5lLmFkZCggdGhpcy5wb2xhck9iaiApO1xuXHR9LFxuXG5cdGtpbGwgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmRlYWQgPSB0cnVlO1xuXHRcdHRoaXMub2JqZWN0LnZpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLmRhbWFnZS5leHBsb2RlKCk7XG5cdH0sXG5cblx0cmVzZXQgOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnBvc2l0aW9uLmNvcHkoIHRoaXMuc3Bhd25Qb2ludCApO1xuXHRcdHRoaXMuc3BlZWQgPSAwLjI7XG5cdFx0dGhpcy5iYW5rID0gMDtcblx0XHQvL3RoaXMub2JqZWN0LnJvdGF0aW9uLnogPSBNYXRoLlBJICogMC4yNTtcdFx0XG5cdH0sXG5cblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0Ly9UT0RPIENMRUFOIE1FIFVQISEhXG5cdFx0XG5cdFx0dGhpcy5iYW5rICo9IDAuOTtcblx0XHR0aGlzLnRocnVzdCA9IDAuMDE7XG5cdFx0XG5cdFx0dGhpcy5iYW5rICs9IHJhbmRvbS5yYW5nZSgtMC4wMSwgMC4wMSk7XG5cdFx0XG5cdFx0Ly90aGlzLmJhbmsgKz0gdGhpcy5iYW5rU3BlZWQgKiBNYXRoLnNpbiggZS5kdCAvIDUwMCApO1xuXHRcdFxuXHRcdF8uZWFjaCggdGhpcy53YXZleVZlcnRzLCBmdW5jdGlvbiggdmVjICkge1xuXHRcdFx0Ly9UT0RPIC0gU2hhcmUgdGhpcyB3aXRoIGFsbCBvYmplY3RzXG5cdFx0XHR2ZWMueSA9IDAuOCAqIE1hdGguc2luKCBlLnRpbWUgLyAxMDAgKyB2ZWMueCApICsgdmVjLm9yaWdpbmFsLnk7XG5cdFx0fSk7XG5cdFx0XG5cdFx0dGhpcy5vYmplY3QuZ2VvbWV0cnkudmVydGljZXNOZWVkVXBkYXRlID0gdHJ1ZTtcblx0XHRcblx0XHRpZiggdGhpcy5kZWFkICkge1xuXHRcdFxuXHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XG5cdFx0XHR0aGlzLnVwZGF0ZUVkZ2VBdm9pZGFuY2UoIGUgKTtcblx0XHRcdHRoaXMudXBkYXRlUG9zaXRpb24oIGUgKTtcblx0XHRcblx0XHR9XG5cdFx0dGhpcy5kYW1hZ2UudXBkYXRlKCBlICk7XG5cblx0fSxcblxuXHR1cGRhdGVFZGdlQXZvaWRhbmNlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFxuXHRcdHZhciBuZWFyRWRnZSwgZmFyRWRnZSwgcG9zaXRpb24sIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24sIGJhbmtEaXJlY3Rpb24sIGFic1Bvc2l0aW9uO1xuXHRcblx0XHRmYXJFZGdlID0gdGhpcy5wb2VtLmhlaWdodCAvIDI7XG5cdFx0bmVhckVkZ2UgPSA0IC8gNSAqIGZhckVkZ2U7XG5cdFx0cG9zaXRpb24gPSB0aGlzLm9iamVjdC5wb3NpdGlvbi55O1xuXHRcdGFic1Bvc2l0aW9uID0gTWF0aC5hYnMoIHBvc2l0aW9uICk7XG5cblx0XHR2YXIgcm90YXRpb24gPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56IC8gTWF0aC5QSTtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogJT0gMiAqIE1hdGguUEk7XG5cdFxuXHRcdGlmKCB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgMCApIHtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gMiAqIE1hdGguUEk7XG5cdFx0fVxuXHRcblx0XHRpZiggTWF0aC5hYnMoIHBvc2l0aW9uICkgPiBuZWFyRWRnZSApIHtcblx0XHRcblx0XHRcdHZhciBpc1BvaW50aW5nTGVmdCA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLnogPj0gTWF0aC5QSSAqIDAuNSAmJiB0aGlzLm9iamVjdC5yb3RhdGlvbi56IDwgTWF0aC5QSSAqIDEuNTtcblx0XHRcblx0XHRcdGlmKCBwb3NpdGlvbiA+IDAgKSB7XG5cdFx0XHRcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAxO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYoIGlzUG9pbnRpbmdMZWZ0ICkge1xuXHRcdFx0XHRcdGJhbmtEaXJlY3Rpb24gPSAtMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFxuXHRcdFx0bm9ybWFsaXplZEVkZ2VQb3NpdGlvbiA9IChhYnNQb3NpdGlvbiAtIG5lYXJFZGdlKSAvIChmYXJFZGdlIC0gbmVhckVkZ2UpO1xuXHRcdFx0dGhpcy50aHJ1c3QgKz0gbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZVRocnVzdFNwZWVkO1xuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSBiYW5rRGlyZWN0aW9uICogbm9ybWFsaXplZEVkZ2VQb3NpdGlvbiAqIHRoaXMuZWRnZUF2b2lkYW5jZUJhbmtTcGVlZDtcblx0XHRcblx0XHR9XG5cdFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLno7XG5cdFxuXHRcblx0fSxcblxuXHR1cGRhdGVQb3NpdGlvbiA6IGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgbW92ZW1lbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcblx0XHRyZXR1cm4gZnVuY3Rpb24oKSB7XG5cdFxuXHRcdFx0dmFyIHRoZXRhLCB4LCB5O1xuXHRcdFxuXHRcdFx0dGhpcy5vYmplY3Qucm90YXRpb24ueiArPSB0aGlzLmJhbms7XG5cdFx0XG5cdFx0XHR0aGV0YSA9IHRoaXMub2JqZWN0LnJvdGF0aW9uLno7XG5cdFx0XG5cdFx0XHR0aGlzLnNwZWVkICo9IDAuOTg7XG5cdFx0XHR0aGlzLnNwZWVkICs9IHRoaXMudGhydXN0O1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWluKCB0aGlzLm1heFNwZWVkLCB0aGlzLnNwZWVkICk7XG5cdFx0XHR0aGlzLnNwZWVkID0gTWF0aC5tYXgoIDAsIHRoaXMuc3BlZWQgKTtcblx0XHRcdFx0XHRcblx0XHRcdHRoaXMucG9zaXRpb24ueCArPSB0aGlzLnNwZWVkICogTWF0aC5jb3MoIHRoZXRhICk7XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnkgKz0gdGhpcy5zcGVlZCAqIE1hdGguc2luKCB0aGV0YSApO1xuXHRcdFxuXHRcdFx0dGhpcy5vYmplY3QucG9zaXRpb24ueSA9IHRoaXMucG9zaXRpb24ueTtcblx0XHRcblx0XHRcdC8vUG9sYXIgY29vcmRpbmF0ZXNcblx0XHRcdC8vIHRoaXMub2JqZWN0LnBvc2l0aW9uLnggPSBNYXRoLmNvcyggdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbyApICogdGhpcy5wb2VtLnI7XG5cdFx0XHQvLyB0aGlzLm9iamVjdC5wb3NpdGlvbi56ID0gTWF0aC5zaW4oIHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW8gKSAqIHRoaXMucG9lbS5yO1xuXHRcdFx0dGhpcy5wb2xhck9iai5yb3RhdGlvbi55ID0gdGhpcy5wb3NpdGlvbi54ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbztcblx0XHRcblx0XHR9O1xuXHRcblx0fSgpXG5cblxufTsiLCJ2YXIgRGFtYWdlID0gcmVxdWlyZSgnLi4vY29tcG9uZW50cy9EYW1hZ2UnKTtcbnZhciByYW5kb20gPSByZXF1aXJlKCcuLi91dGlscy9yYW5kb20nKTtcblxudmFyIEplbGx5c2hpcCA9IGZ1bmN0aW9uKCBwb2VtLCBtYW5hZ2VyLCB4LCB5ICkge1xuXG5cdHRoaXMucG9lbSA9IHBvZW07XG5cdHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XG5cdHRoaXMuc2NlbmUgPSBwb2VtLnNjZW5lO1xuXHR0aGlzLnBvbGFyT2JqID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdHRoaXMub2JqZWN0ID0gbnVsbDtcblxuXHR0aGlzLmNvbG9yID0gMHhjYjM2ZWE7XG5cdHRoaXMubGluZXdpZHRoID0gMiAqIHRoaXMucG9lbS5yYXRpbztcblx0dGhpcy5zY29yZVZhbHVlID0gMTM7XG5cblx0dGhpcy5zcGF3blBvaW50ID0gbmV3IFRIUkVFLlZlY3RvcjIoeCx5KTtcblx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IyKHgseSk7XG5cdFxuXHR0aGlzLmRlYWQgPSBmYWxzZTtcblxuXHR0aGlzLnNwZWVkID0gMDtcblxuXHR0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQgPSAwLjA0O1xuXHR0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZCA9IDAuMDAxO1xuXG5cdHRoaXMudGhydXN0U3BlZWQgPSAxO1xuXHR0aGlzLnRocnVzdCA9IDA7XG5cblx0dGhpcy5iYW5rU3BlZWQgPSAwLjA2O1xuXHR0aGlzLmJhbmsgPSAwO1xuXHR0aGlzLm1heFNwZWVkID0gMTAwMDtcblx0XG5cdHRoaXMucmFkaXVzID0gMztcblxuXHR0aGlzLmFkZE9iamVjdCgpO1xuXHR0aGlzLmRhbWFnZSA9IG5ldyBEYW1hZ2UodGhpcy5wb2VtLCB0aGlzLCB7XG5cdFx0dHJhbnNwYXJlbnQ6IHRydWUsXG5cdFx0b3BhY2l0eTogMC41LFxuXHRcdHJldGFpbkV4cGxvc2lvbnNDb3VudDogMyxcblx0XHRwZXJFeHBsb3Npb246IDUwXG5cdH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBKZWxseXNoaXA7XG5cbkplbGx5c2hpcC5wcm90b3R5cGUgPSB7XG5cblx0Y3JlYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHQvL1RPRE8gLSBTaGFyZSBnZW9tZXRyeVxuXHRcblx0XHR2YXIgZ2VvbWV0cnksIHZlcnRzLCBtYW5oYXR0YW5MZW5ndGgsIGNlbnRlcjtcblx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKSxcblx0XG5cdFx0Ly92ZXJ0cyA9IFtbMzU1LjcsMjExLjddLCBbMzc1LjgsMTk1LjldLCBbMzY4LjUsMTU1LjRdLCBbMzYxLjQsMTkwLjhdLCBbMzQxLjMsMjA1LjldLCBbMzIwLjQsMjAxLjhdLCBbMjk4LjksMjA2XSwgWzI3OC42LDE5MC44XSwgWzI3MS41LDE1NS40XSwgWzI2NC4yLDE5NS45XSwgWzI4NC43LDIxMl0sIFsyNTguMywyMzkuMl0sIFsyNDIuMywyMjguNV0sIFsyMzguMywxNjguOV0sIFsyMjYuMSwyMzcuMV0sIFsyNDYuNywyNjYuMl0sIFsyMzMuNywzMTYuNF0sIFsyNTkuMiwzMjEuMl0sIFsyMzcuNCw0MjkuNl0sIFsyNTMuMSw0MzIuN10sIFsyNzQuOSwzMjQuMl0sIFsyOTMsMzI3LjZdLCBbMjg2LjYsNDg0XSwgWzMwMi42LDQ4NC42XSwgWzMwOC45LDMzMC42XSwgWzMyMC40LDMzMi44XSwgWzMzMS4xLDMzMC44XSwgWzMzNy40LDQ4NC42XSwgWzM1My40LDQ4NF0sIFszNDcsMzI3LjhdLCBbMzY1LjEsMzI0LjNdLCBbMzg2LjksNDMyLjddLCBbNDAyLjYsNDI5LjZdLCBbMzgwLjksMzIxLjRdLCBbNDA3LDMxNi40XSwgWzM5My44LDI2NS41XSwgWzQxMy45LDIzNy4xXSwgWzQwMS43LDE2OC45XSwgWzM5Ny43LDIyOC41XSwgWzM4Mi4xLDIzOC45XSwgWzM1NS45LDIxMS44XSBdO1xuXHRcdFxuXHRcdHZlcnRzID0gWyBbMzU1LjcsMjExLjddLCBbMzc1LjgsMTk1LjldLCBbMzY4LjUsMTU1LjRdLCBbMzYxLjQsMTkwLjhdLCBbMzQxLjMsMjA1LjldLCBbMzIwLjQsMjAxLjhdLCBbMjk4LjksMjA2XSwgWzI3OC42LDE5MC44XSwgXG5cdFx0XHRbMjcxLjUsMTU1LjRdLCBbMjY0LjIsMTk1LjldLCBbMjg0LjcsMjEyXSwgWzI1OC4zLDIzOS4yXSwgWzI0Mi4zLDIyOC41XSwgWzIzOC4zLDE2OC45XSwgWzIyNi4xLDIzNy4xXSwgWzI0Ni43LDI2Ni4yXSwgWzIzMy43LDMxNi40XSwgWzI1OS4yLDMyMS4yXSwgXG5cdFx0XHRbMjU3LjEsMzMxLjNdLCBbMjU0LjksMzQyLjNdLCBbMjUyLjgsMzUyLjldLCBbMjUwLjUsMzY0LjVdLCBbMjQ4LjIsMzc1LjddLCBbMjQ2LjEsMzg2LjJdLCBbMjQzLjgsMzk3LjddLCBbMjQxLjMsNDEwLjNdLCBbMjM5LjUsNDE5LjNdLCBbMjM3LjQsNDI5LjZdLCBcblx0XHRcdFsyNTMuMSw0MzIuN10sIFsyNTQuOSw0MjMuN10sIFsyNTYuOSw0MTQuMV0sIFsyNTkuMyw0MDEuOF0sIFsyNjEuNiwzOTAuMl0sIFsyNjMuNywzODAuMV0sIFsyNjYuMSwzNjcuOF0sIFsyNjguMywzNTYuOV0sIFsyNzAuNiwzNDUuNl0sIFsyNzIuNywzMzUuMV0sIFxuXHRcdFx0WzI3NC45LDMyNC4yXSwgWzI5MywzMjcuNl0sIFsyOTIuNiwzMzYuNV0sIFsyOTIuMiwzNDhdLCBbMjkxLjcsMzU5LjZdLCBbMjkxLjIsMzcxLjVdLCBbMjkwLjcsMzgyLjVdLCBbMjkwLjMsMzkzLjZdLCBbMjg5LjgsNDA1LjFdLCBbMjg5LjUsNDE0LjFdLCBbMjg5LDQyNS42XSwgXG5cdFx0XHRbMjg4LjUsNDM3XSwgWzI4OC4xLDQ0OC41XSwgWzI4Ny42LDQ1OS41XSwgWzI4Ny4xLDQ3MS41XSwgWzI4Ni42LDQ4NF0sIFszMDIuNiw0ODQuNl0sIFszMDMuMSw0NzMuNV0sIFszMDMuNiw0NjEuNV0sIFszMDQuMSw0NDguNV0sIFszMDQuNSw0MzguNV0sIFszMDUsNDI1LjFdLCBcblx0XHRcdFszMDUuNCw0MTYuMV0sIFszMDUuOSw0MDVdLCBbMzA2LjIsMzk1LjVdLCBbMzA2LjYsMzg2XSwgWzMwNy4xLDM3M10sIFszMDcuNiwzNjFdLCBbMzA4LjIsMzQ3LjVdLCBbMzA4LjUsMzM4LjVdLCBbMzA4LjksMzMwLjZdLCBbMzMxLjEsMzMwLjhdLCBbMzMxLjQsMzM2LjVdLCBcblx0XHRcdFszMzEuNywzNDRdLCBbMzMyLDM1M10sIFszMzIuNSwzNjQuNV0sIFszMzMsMzc2XSwgWzMzMy40LDM4Ny41XSwgWzMzMy45LDM5OC41XSwgWzMzNC40LDQxMC41XSwgWzMzNC45LDQyMi40XSwgWzMzNS40LDQzN10sIFszMzYsNDUwXSwgWzMzNi40LDQ2MF0sIFszMzYuOCw0NzFdLCBcblx0XHRcdFszMzcuNCw0ODQuNl0sIFszNTMuNCw0ODRdLCBbMzUyLjgsNDcxXSwgWzM1Mi4zLDQ1Ny41XSwgWzM1MS45LDQ0OF0sIFszNTEuNSw0MzcuNV0sIFszNTAuOSw0MjNdLCBbMzUwLjQsNDEwLjVdLCBbMzQ5LjgsMzk2LjVdLCBbMzQ5LjQsMzg1LjVdLCBbMzQ4LjksMzc0LjRdLCBcblx0XHRcdFszNDguNSwzNjMuNF0sIFszNDgsMzUyXSwgWzM0Ny42LDM0M10sIFszNDcuMywzMzRdLCBbMzQ3LDMyNy44XSwgWzM2NS4xLDMyNC4zXSwgWzM2Ni42LDMzMS43XSwgWzM2OC4yLDMzOS42XSwgWzM3MC4yLDM0OS41XSwgWzM3MS45LDM1Ny44XSwgWzM3My42LDM2Ni44XSwgXG5cdFx0XHRbMzc1LjQsMzc1LjRdLCBbMzc3LjEsMzg0XSwgWzM3OSwzOTMuNV0sIFszODEuMiw0MDQuNl0sIFszODMuMSw0MTRdLCBbMzg0LjksNDIyLjhdLCBbMzg2LjksNDMyLjddLCBbNDAyLjYsNDI5LjZdLCBbNDAwLjYsNDE5LjZdLCBbMzk5LjEsNDEyLjVdLCBbMzk3LjEsNDAyLjVdLCBcblx0XHRcdFszOTQuNywzOTAuMl0sIFszOTMuMSwzODIuNl0sIFszOTEuNCwzNzRdLCBbMzg5LjYsMzY1XSwgWzM4Ny42LDM1NS4xXSwgWzM4NiwzNDcuMl0sIFszODQuMSwzMzcuN10sIFszODIuNywzMzAuNl0sIFszODAuOSwzMjEuNF0sIFs0MDcsMzE2LjRdLCBbMzkzLjgsMjY1LjVdLCBcblx0XHRcdFs0MTMuOSwyMzcuMV0sIFs0MDEuNywxNjguOV0sIFszOTcuNywyMjguNV0sIFszODIuMSwyMzguOV0sIFszNTUuOSwyMTEuOF0gXTtcblx0XHRcblxuXHRcdG1hbmhhdHRhbkxlbmd0aCA9IF8ucmVkdWNlKCB2ZXJ0cywgZnVuY3Rpb24oIG1lbW8sIHZlcnQyZCApIHtcblx0XHRcblx0XHRcdHJldHVybiBbbWVtb1swXSArIHZlcnQyZFswXSwgbWVtb1sxXSArIHZlcnQyZFsxXV07XG5cdFx0XG5cdFx0fSwgWzAsMF0pO1xuXHRcblx0XHRjZW50ZXIgPSBbXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMF0gLyB2ZXJ0cy5sZW5ndGgsXG5cdFx0XHRtYW5oYXR0YW5MZW5ndGhbMV0gLyB2ZXJ0cy5sZW5ndGhcblx0XHRdO1xuXHRcdFxuXHRcdHRoaXMud2F2ZXlWZXJ0cyA9IFtdO1xuXHRcblx0XHRnZW9tZXRyeS52ZXJ0aWNlcyA9IF8ubWFwKCB2ZXJ0cywgZnVuY3Rpb24oIHZlYzIgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBzY2FsZSA9IDEgLyAzMjtcblx0XHRcdHZhciB2ZWMzID0gbmV3IFRIUkVFLlZlY3RvcjMoXG5cdFx0XHRcdCh2ZWMyWzFdIC0gY2VudGVyWzFdKSAqIHNjYWxlICogLTEsXG5cdFx0XHRcdCh2ZWMyWzBdIC0gY2VudGVyWzBdKSAqIHNjYWxlLFxuXHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdFx0XG5cdFx0XHR2ZWMzLm9yaWdpbmFsID0gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KCB2ZWMzICk7XG5cdFx0XHRcblx0XHRcdGlmKCB2ZWMyWzFdID4gMzMwLjggKSB7XG5cdFx0XHRcdHRoaXMud2F2ZXlWZXJ0cy5wdXNoKCB2ZWMzIClcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0cmV0dXJuIHZlYzM7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XG5cdFx0cmV0dXJuIGdlb21ldHJ5O1xuXHRcblx0fSxcblxuXHRhZGRPYmplY3QgOiBmdW5jdGlvbigpIHtcblx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFxuXHRcdGdlb21ldHJ5ID0gdGhpcy5jcmVhdGVHZW9tZXRyeSgpO1xuXHRcdFx0XG5cdFx0bGluZU1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiB0aGlzLmNvbG9yLFxuXHRcdFx0bGluZXdpZHRoIDogdGhpcy5saW5ld2lkdGhcblx0XHR9KTtcblx0XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTGluZShcblx0XHRcdGdlb21ldHJ5LFxuXHRcdFx0bGluZU1hdGVyaWFsLFxuXHRcdFx0VEhSRUUuTGluZVN0cmlwXG5cdFx0KTtcblx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi56ICs9IHRoaXMucG9lbS5yO1xuXHRcblx0XHR0aGlzLnBvbGFyT2JqLmFkZCggdGhpcy5vYmplY3QgKTtcblx0XHR0aGlzLnJlc2V0KCk7XG5cdFx0dGhpcy5zY2VuZS5hZGQoIHRoaXMucG9sYXJPYmogKTtcblx0fSxcblxuXHRraWxsIDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5kZWFkID0gdHJ1ZTtcblx0XHR0aGlzLm9iamVjdC52aXNpYmxlID0gZmFsc2U7XG5cdFx0dGhpcy5kYW1hZ2UuZXhwbG9kZSgpO1xuXHR9LFxuXG5cdHJlc2V0IDogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5wb3NpdGlvbi5jb3B5KCB0aGlzLnNwYXduUG9pbnQgKTtcblx0XHR0aGlzLnNwZWVkID0gMC4yO1xuXHRcdHRoaXMuYmFuayA9IDA7XG5cdFx0Ly90aGlzLm9iamVjdC5yb3RhdGlvbi56ID0gTWF0aC5QSSAqIDAuMjU7XHRcdFxuXHR9LFxuXG5cdHVwZGF0ZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcdFxuXHRcdC8vVE9ETyBDTEVBTiBNRSBVUCEhIVxuXHRcdFxuXHRcdHRoaXMuYmFuayAqPSAwLjk7XG5cdFx0dGhpcy50aHJ1c3QgPSAwLjAxO1xuXHRcdFxuXHRcdHRoaXMuYmFuayArPSByYW5kb20ucmFuZ2UoLTAuMDEsIDAuMDEpO1xuXHRcdFxuXHRcdC8vdGhpcy5iYW5rICs9IHRoaXMuYmFua1NwZWVkICogTWF0aC5zaW4oIGUuZHQgLyA1MDAgKTtcblx0XHRcblx0XHRfLmVhY2goIHRoaXMud2F2ZXlWZXJ0cywgZnVuY3Rpb24oIHZlYyApIHtcblx0XHRcdC8vVE9ETyAtIFNoYXJlIHRoaXMgd2l0aCBhbGwgb2JqZWN0c1xuXHRcdFx0dmVjLnkgPSAwLjggKiBNYXRoLnNpbiggZS50aW1lIC8gMTAwICsgdmVjLnggKSArIHZlYy5vcmlnaW5hbC55O1xuXHRcdH0pO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0XG5cdFx0aWYoIHRoaXMuZGVhZCApIHtcblx0XHRcblx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFxuXHRcdFx0dGhpcy51cGRhdGVFZGdlQXZvaWRhbmNlKCBlICk7XG5cdFx0XHR0aGlzLnVwZGF0ZVBvc2l0aW9uKCBlICk7XG5cdFx0XG5cdFx0fVxuXHRcdHRoaXMuZGFtYWdlLnVwZGF0ZSggZSApO1xuXG5cdH0sXG5cblx0dXBkYXRlRWRnZUF2b2lkYW5jZSA6IGZ1bmN0aW9uKCBlICkge1xuXHRcblx0XHR2YXIgbmVhckVkZ2UsIGZhckVkZ2UsIHBvc2l0aW9uLCBub3JtYWxpemVkRWRnZVBvc2l0aW9uLCBiYW5rRGlyZWN0aW9uLCBhYnNQb3NpdGlvbjtcblx0XG5cdFx0ZmFyRWRnZSA9IHRoaXMucG9lbS5oZWlnaHQgLyAyO1xuXHRcdG5lYXJFZGdlID0gNCAvIDUgKiBmYXJFZGdlO1xuXHRcdHBvc2l0aW9uID0gdGhpcy5vYmplY3QucG9zaXRpb24ueTtcblx0XHRhYnNQb3NpdGlvbiA9IE1hdGguYWJzKCBwb3NpdGlvbiApO1xuXG5cdFx0dmFyIHJvdGF0aW9uID0gdGhpcy5vYmplY3Qucm90YXRpb24ueiAvIE1hdGguUEk7XG5cblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICU9IDIgKiBNYXRoLlBJO1xuXHRcblx0XHRpZiggdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IDAgKSB7XG5cdFx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IDIgKiBNYXRoLlBJO1xuXHRcdH1cblx0XG5cdFx0aWYoIE1hdGguYWJzKCBwb3NpdGlvbiApID4gbmVhckVkZ2UgKSB7XG5cdFx0XG5cdFx0XHR2YXIgaXNQb2ludGluZ0xlZnQgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56ID49IE1hdGguUEkgKiAwLjUgJiYgdGhpcy5vYmplY3Qucm90YXRpb24ueiA8IE1hdGguUEkgKiAxLjU7XG5cdFx0XG5cdFx0XHRpZiggcG9zaXRpb24gPiAwICkge1xuXHRcdFx0XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gMTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmKCBpc1BvaW50aW5nTGVmdCApIHtcblx0XHRcdFx0XHRiYW5rRGlyZWN0aW9uID0gLTE7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YmFua0RpcmVjdGlvbiA9IDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcblx0XHRcdG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gPSAoYWJzUG9zaXRpb24gLSBuZWFyRWRnZSkgLyAoZmFyRWRnZSAtIG5lYXJFZGdlKTtcblx0XHRcdHRoaXMudGhydXN0ICs9IG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VUaHJ1c3RTcGVlZDtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gYmFua0RpcmVjdGlvbiAqIG5vcm1hbGl6ZWRFZGdlUG9zaXRpb24gKiB0aGlzLmVkZ2VBdm9pZGFuY2VCYW5rU3BlZWQ7XG5cdFx0XG5cdFx0fVxuXHRcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcblx0XG5cdH0sXG5cblx0dXBkYXRlUG9zaXRpb24gOiBmdW5jdGlvbiggZSApIHtcblx0XG5cdFx0dmFyIG1vdmVtZW50ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcblx0XHRcdHZhciB0aGV0YSwgeCwgeTtcblx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gdGhpcy5iYW5rO1xuXHRcdFxuXHRcdFx0dGhldGEgPSB0aGlzLm9iamVjdC5yb3RhdGlvbi56O1xuXHRcdFxuXHRcdFx0dGhpcy5zcGVlZCAqPSAwLjk4O1xuXHRcdFx0dGhpcy5zcGVlZCArPSB0aGlzLnRocnVzdDtcblx0XHRcdHRoaXMuc3BlZWQgPSBNYXRoLm1pbiggdGhpcy5tYXhTcGVlZCwgdGhpcy5zcGVlZCApO1xuXHRcdFx0dGhpcy5zcGVlZCA9IE1hdGgubWF4KCAwLCB0aGlzLnNwZWVkICk7XG5cdFx0XHRcdFx0XG5cdFx0XHR0aGlzLnBvc2l0aW9uLnggKz0gdGhpcy5zcGVlZCAqIE1hdGguY29zKCB0aGV0YSApO1xuXHRcdFx0dGhpcy5wb3NpdGlvbi55ICs9IHRoaXMuc3BlZWQgKiBNYXRoLnNpbiggdGhldGEgKTtcblx0XHRcblx0XHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLnkgPSB0aGlzLnBvc2l0aW9uLnk7XG5cdFx0XG5cdFx0XHQvL1BvbGFyIGNvb3JkaW5hdGVzXG5cdFx0XHQvLyB0aGlzLm9iamVjdC5wb3NpdGlvbi54ID0gTWF0aC5jb3MoIHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW8gKSAqIHRoaXMucG9lbS5yO1xuXHRcdFx0Ly8gdGhpcy5vYmplY3QucG9zaXRpb24ueiA9IE1hdGguc2luKCB0aGlzLnBvc2l0aW9uLnggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0XHRcdHRoaXMucG9sYXJPYmoucm90YXRpb24ueSA9IHRoaXMucG9zaXRpb24ueCAqIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlUmF0aW87XG5cdFx0XG5cdFx0fTtcblx0XG5cdH0oKVxuXG5cbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG5cdGFzdGVyb2lkRmllbGQgOiB7XG5cdFx0b2JqZWN0OiByZXF1aXJlKFwiLi4vbWFuYWdlcnMvQXN0ZXJvaWRGaWVsZFwiKSxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRjb3VudCA6IDIwXG5cdFx0fSBcblx0fSxcblx0amVsbHlNYW5hZ2VyIDoge1xuXHRcdG9iamVjdDogcmVxdWlyZShcIi4uL21hbmFnZXJzL0VudGl0eU1hbmFnZXJcIiksXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0c2hpcFR5cGU6IHJlcXVpcmUoJy4uL2VudGl0aWVzL0plbGx5c2hpcCcpLFxuXHRcdFx0Y291bnQ6IDI1XG5cdFx0fVxuXHR9LFxufSIsInZhciBBc3Rlcm9pZCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0FzdGVyb2lkJyk7XG5cbnZhciBBc3Rlcm9pZEZpZWxkID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLmFzdGVyb2lkcyA9IFtdO1xuXHR0aGlzLm1heFJhZGl1cyA9IDUwO1xuXHR0aGlzLm9yaWdpbkNsZWFyYW5jZSA9IDMwO1xuXHR0aGlzLmNvdW50ID0gMjA7XG5cdFxuXHRfLmV4dGVuZCggdGhpcywgcHJvcGVydGllcyApIDtcblx0XG5cdHRoaXMuZ2VuZXJhdGUoIHRoaXMuY291bnQgKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXN0ZXJvaWRGaWVsZDtcblxuQXN0ZXJvaWRGaWVsZC5wcm90b3R5cGUgPSB7XG5cdFxuXHRnZW5lcmF0ZSA6IGZ1bmN0aW9uKCBjb3VudCApIHtcblx0XHRcblx0XHR2YXIgaSwgeCwgeSwgaGVpZ2h0LCB3aWR0aCwgcmFkaXVzO1xuXHRcdFxuXHRcdGhlaWdodCA9IHRoaXMucG9lbS5oZWlnaHQgKiA0O1xuXHRcdHdpZHRoID0gdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2U7XG5cdFx0XG5cdFx0Zm9yKCBpPTA7IGkgPCBjb3VudDsgaSsrICkge1xuXHRcdFx0XG5cdFx0XHRkbyB7XG5cdFx0XHRcdFxuXHRcdFx0XHR4ID0gTWF0aC5yYW5kb20oKSAqIHdpZHRoO1xuXHRcdFx0XHR5ID0gTWF0aC5yYW5kb20oKSAqIGhlaWdodCAtIChoZWlnaHQgLyAyKTtcblx0XHRcdFxuXHRcdFx0XHRyYWRpdXMgPSBNYXRoLnJhbmRvbSgpICogdGhpcy5tYXhSYWRpdXM7XG5cdFx0XHRcdFxuXHRcdFx0fSB3aGlsZShcblx0XHRcdFx0dGhpcy5jaGVja0NvbGxpc2lvbiggeCwgeSwgcmFkaXVzICkgJiZcblx0XHRcdFx0dGhpcy5jaGVja0ZyZWVPZk9yaWdpbiggeCwgeSwgcmFkaXVzIClcblx0XHRcdCk7XG5cdFx0XHRcblx0XHRcdHRoaXMuYXN0ZXJvaWRzLnB1c2goXG5cdFx0XHRcdG5ldyBBc3Rlcm9pZCggdGhpcy5wb2VtLCB4LCB5LCByYWRpdXMgKVxuXHRcdFx0KTtcblx0XHRcblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApIHtcblx0XHRcblx0XHRfLmVhY2goIHRoaXMuYXN0ZXJvaWRzLCBmdW5jdGlvbihhc3Rlcm9pZCkge1xuXHRcdFx0XG5cdFx0XHRhc3Rlcm9pZC51cGRhdGUoIGUgKTtcblx0XHRcdFxuXHRcdH0sIHRoaXMpO1xuXHRcdFxuXHRcdGlmKCAhdGhpcy5wb2VtLnNoaXAuZGVhZCAmJiAhdGhpcy5wb2VtLnNoaXAuaW52dWxuZXJhYmxlICkge1xuXHRcdFx0dmFyIHNoaXBDb2xsaXNpb24gPSB0aGlzLmNoZWNrQ29sbGlzaW9uKFxuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5wb3NpdGlvbi54LFxuXHRcdFx0XHR0aGlzLnBvZW0uc2hpcC5wb3NpdGlvbi55LFxuXHRcdFx0XHQyXG5cdFx0XHQpO1xuXHRcdFxuXHRcdFx0aWYoIHNoaXBDb2xsaXNpb24gKSB7XG5cdFx0XHRcdHRoaXMucG9lbS5zaGlwLmtpbGwoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0XG5cdH0sXG5cdFxuXHRjaGVja0ZyZWVPZk9yaWdpbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0cmV0dXJuIE1hdGguc3FydCh4KnggKyB5KnkpID4gcmFkaXVzICsgdGhpcy5vcmlnaW5DbGVhcmFuY2U7XG5cdH0sXG5cdFxuXHRjaGVja0NvbGxpc2lvbiA6IGZ1bmN0aW9uKCB4LCB5LCByYWRpdXMgKSB7XG5cdFx0XG5cdFx0dmFyIGNvbGxpc2lvbiA9IF8uZmluZCggdGhpcy5hc3Rlcm9pZHMsIGZ1bmN0aW9uKCBhc3Rlcm9pZCApIHtcblx0XHRcdFxuXHRcdFx0dmFyIGR4LCBkeSwgZGlzdGFuY2U7XG5cdFx0XHRcblx0XHRcdGR4ID0gdGhpcy5wb2VtLmNvb3JkaW5hdGVzLmNpcmN1bWZlcmVuY2VEaXN0YW5jZSggeCwgYXN0ZXJvaWQucG9zaXRpb24ueCApO1xuXHRcdFx0ZHkgPSB5IC0gYXN0ZXJvaWQucG9zaXRpb24ueTtcblx0XHRcdFxuXHRcdFx0ZGlzdGFuY2UgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXG5cdFx0XHRyZXR1cm4gZGlzdGFuY2UgPCByYWRpdXMgKyBhc3Rlcm9pZC5yYWRpdXM7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHRyZXR1cm4gISFjb2xsaXNpb247XG5cdH1cbn07IiwidmFyIENvbGxpZGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvQ29sbGlkZXInKTtcbnZhciBEZWZhdWx0SmVsbHlTaGlwID0gcmVxdWlyZSgnLi4vZW50aXRpZXMvSmVsbHlTaGlwJyk7XG5cbnZhciBFbnRpdHlNYW5hZ2VyID0gZnVuY3Rpb24oIHBvZW0sIHByb3BlcnRpZXMgKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLnNoaXBUeXBlID0gRGVmYXVsdEplbGx5U2hpcDtcblx0dGhpcy5jb3VudCA9IDIwO1xuXHR0aGlzLnNoaXBzID0gW107XG5cdHRoaXMubGl2ZVNoaXBzID0gW107XG5cdHRoaXMub3JpZ2luQ2xlYXJhbmNlID0gMzAwO1xuXHRcblx0Xy5leHRlbmQoIHRoaXMsIHByb3BlcnRpZXMgKSA7XG5cdFxuXHR0aGlzLmdlbmVyYXRlKCB0aGlzLmNvdW50ICk7XG5cdHRoaXMuY29uZmlndXJlQ29sbGlkZXIoKTtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbnRpdHlNYW5hZ2VyO1xuXG5FbnRpdHlNYW5hZ2VyLnByb3RvdHlwZSA9IHtcblx0XG5cdGdlbmVyYXRlIDogZnVuY3Rpb24oIGNvdW50ICkge1xuXHRcdFxuXHRcdHZhciBpLCB4LCB5LCBoZWlnaHQsIHdpZHRoLCBzaGlwO1xuXHRcdFxuXHRcdGhlaWdodCA9IHRoaXMucG9lbS5oZWlnaHQgKiA0O1xuXHRcdHdpZHRoID0gdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2U7XG5cdFx0XG5cdFx0Zm9yKCBpPTA7IGkgPCBjb3VudDsgaSsrICkge1xuXHRcdFx0XG5cdFx0XHR4ID0gTWF0aC5yYW5kb20oKSAqIHdpZHRoO1xuXHRcdFx0eSA9IE1hdGgucmFuZG9tKCkgKiBoZWlnaHQgLSAoaGVpZ2h0IC8gMilcblx0XHRcdFxuXHRcdFx0c2hpcCA9IG5ldyB0aGlzLnNoaXBUeXBlKCB0aGlzLnBvZW0sIHRoaXMsIHgsIHkgKTtcblx0XHRcdFxuXHRcdFx0dGhpcy5zaGlwcy5wdXNoKCBzaGlwICk7XG5cdFx0XHR0aGlzLmxpdmVTaGlwcy5wdXNoKCBzaGlwICk7XG5cdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHRoaXMucG9lbS5zY29yZS5hZGp1c3RFbmVtaWVzKCBjb3VudCApO1xuXHRcdFxuXHR9LFxuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cdFx0XG5cdFx0Xy5lYWNoKCB0aGlzLnNoaXBzLCBmdW5jdGlvbihzaGlwKSB7XG5cdFx0XHRcblx0XHRcdHNoaXAudXBkYXRlKCBlICk7XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0fSxcblx0XG5cdGtpbGxTaGlwIDogZnVuY3Rpb24oIHNoaXAgKSB7XG5cdFx0XG5cdFx0dmFyIGkgPSB0aGlzLmxpdmVTaGlwcy5pbmRleE9mKCBzaGlwICk7XG5cdFx0XG5cdFx0aWYoIGkgPj0gMCApIHtcblx0XHRcdHRoaXMubGl2ZVNoaXBzLnNwbGljZSggaSwgMSApO1xuXHRcdH1cblx0XHRcblx0XHRzaGlwLmtpbGwoKTtcdFx0XG5cdH0sXG5cdFxuXHRjb25maWd1cmVDb2xsaWRlciA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZVNoaXBzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucG9lbS5ndW4ubGl2ZUJ1bGxldHM7XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKHNoaXAsIGJ1bGxldCkge1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5raWxsU2hpcCggc2hpcCApO1xuXHRcdFx0XHR0aGlzLnBvZW0uZ3VuLmtpbGxCdWxsZXQoIGJ1bGxldCApO1xuXHRcdFx0XHRcblx0XHRcdFx0dGhpcy5wb2VtLnNjb3JlLmFkanVzdFNjb3JlKCBzaGlwLnNjb3JlVmFsdWUgKTtcblx0XHRcdFx0dGhpcy5wb2VtLnNjb3JlLmFkanVzdEVuZW1pZXMoIC0xICk7XG5cdFx0XHRcdFxuXHRcdFx0fS5iaW5kKHRoaXMpXG5cdFx0XHRcblx0XHQpO1xuXHRcdFxuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGl2ZVNoaXBzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIFt0aGlzLnBvZW0uc2hpcF07XG5cdFx0XHR9LmJpbmQodGhpcyksXG5cdFx0XHRcblx0XHRcdGZ1bmN0aW9uKHNoaXAsIGJ1bGxldCkge1xuXHRcdFx0XHRcblx0XHRcdFx0aWYoICF0aGlzLnBvZW0uc2hpcC5kZWFkICYmICF0aGlzLnBvZW0uc2hpcC5pbnZ1bG5lcmFibGUgKSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0dGhpcy5raWxsU2hpcCggc2hpcCApO1xuXHRcdFx0XHRcdHRoaXMucG9lbS5zaGlwLmtpbGwoKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0XHR0aGlzLnBvZW0uc2NvcmUuYWRqdXN0RW5lbWllcyggLTEgKTtcblx0XHRcdFx0XHRcblx0XHRcdFx0fVxuXHRcdFx0XHRcblx0XHRcdFx0XG5cdFx0XHR9LmJpbmQodGhpcylcblx0XHRcdFxuXHRcdCk7XG5cdFx0XG5cdH0sXG5cdFxuXHRcbn07IiwidmFyIEJ1bGxldCA9IHJlcXVpcmUoJy4uL2VudGl0aWVzL0J1bGxldCcpO1xudmFyIENvbGxpZGVyID0gcmVxdWlyZSgnLi4vdXRpbHMvQ29sbGlkZXInKTtcbnZhciBTb3VuZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4uL3NvdW5kL1NvdW5kR2VuZXJhdG9yJyk7XG5cbnZhciBHdW4gPSBmdW5jdGlvbiggcG9lbSApIHtcblx0dGhpcy5wb2VtID0gcG9lbTtcblx0dGhpcy5vYmplY3QgPSBudWxsO1xuXHR0aGlzLnNvdW5kID0gbnVsbDtcblx0XG5cdHRoaXMuY291bnQgPSAzNTA7XG5cdHRoaXMuYnVsbGV0QWdlID0gNTAwMDtcblx0dGhpcy5maXJlRGVsYXlNaWxsaXNlY29uZHMgPSAxMDA7XG5cdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSB0aGlzLnBvZW0uY2xvY2sudGltZTtcblx0dGhpcy5saXZlQnVsbGV0cyA9IFtdO1xuXHR0aGlzLmJ1bGxldHMgPSBbXTtcblx0dGhpcy5ib3JuQXQgPSAwO1xuXG5cdHRoaXMuYWRkT2JqZWN0KCk7XG5cdHRoaXMuY29uZmlndXJlQ29sbGlkZXIoKTtcblx0dGhpcy5hZGRTb3VuZCgpO1xuXHRcblx0Y29uc29sZS5sb2coJ3VwZGF0ZScpO1xuXHR0aGlzLnBvZW0ub24oJ3VwZGF0ZScsIHRoaXMudXBkYXRlLmJpbmQodGhpcykgKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gR3VuO1xuXG5HdW4ucHJvdG90eXBlID0ge1xuXHRcblx0ZmlyZSA6IGZ1bmN0aW9uKCkge1xuXHRcdFxuXHRcdHZhciBpc0RlYWQgPSBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFx0cmV0dXJuICFidWxsZXQuYWxpdmU7XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBmdW5jdGlvbih4LCB5LCBzcGVlZCwgdGhldGEpIHtcblx0XHRcdFxuXHRcdFx0dmFyIG5vdyA9IHRoaXMucG9lbS5jbG9jay50aW1lO1xuXHRcdFx0XG5cdFx0XHRpZiggbm93IC0gdGhpcy5sYXN0RmlyZVRpbWVzdGFtcCA8IHRoaXMuZmlyZURlbGF5TWlsbGlzZWNvbmRzICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRcblx0XHRcdHRoaXMubGFzdEZpcmVUaW1lc3RhbXAgPSBub3c7XG5cdFx0XG5cdFx0XHR2YXIgYnVsbGV0ID0gXy5maW5kKCB0aGlzLmJ1bGxldHMsIGlzRGVhZCApO1xuXHRcdFxuXHRcdFx0aWYoICFidWxsZXQgKSByZXR1cm47XG5cdFx0XG5cdFx0XHR0aGlzLmxpdmVCdWxsZXRzLnB1c2goIGJ1bGxldCApO1xuXHRcdFxuXHRcdFx0YnVsbGV0LmZpcmUoeCwgeSwgc3BlZWQsIHRoZXRhKTtcblxuXG5cdFx0XHR2YXIgZnJlcSA9IDE5MDA7XG5cdFx0XHRcblx0XHRcdC8vU3RhcnQgc291bmRcblx0XHRcdHRoaXMuc291bmQuc2V0R2FpbigwLjEsIDAsIDAuMDAxKTtcblx0XHRcdHRoaXMuc291bmQuc2V0RnJlcXVlbmN5KGZyZXEsIDAsIDApO1xuXHRcdFx0XG5cblx0XHRcdC8vRW5kIHNvdW5kXG5cdFx0XHR0aGlzLnNvdW5kLnNldEdhaW4oMCwgMC4wMSwgMC4wNSk7XG5cdFx0XHR0aGlzLnNvdW5kLnNldEZyZXF1ZW5jeShmcmVxICogMC4xLCAwLjAxLCAwLjA1KTtcblx0XHRcdFxuXHRcdH07XG5cdH0oKSxcblx0XG5cdGdlbmVyYXRlR2VvbWV0cnkgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHR2YXIgdmVydGV4LCBidWxsZXQ7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSBuZXcgVEhSRUUuR2VvbWV0cnkoKTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaSA8IHRoaXMuY291bnQ7IGkrKykge1xuXHRcdFx0XG5cdFx0XHR2ZXJ0ZXggPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdFx0YnVsbGV0ID0gbmV3IEJ1bGxldCggdGhpcy5wb2VtLCB0aGlzLCB2ZXJ0ZXggKTtcblx0XHRcdFxuXHRcdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaCggdmVydGV4ICk7XG5cdFx0XHR0aGlzLmJ1bGxldHMucHVzaCggYnVsbGV0ICk7XG5cdFx0XHRcblx0XHRcdGJ1bGxldC5raWxsKCk7XG5cdFx0XHRcdFx0XG5cdFx0fVxuXHRcdFxuXHRcdHJldHVybiBnZW9tZXRyeTtcblx0fSxcblx0XG5cdGtpbGxCdWxsZXQgOiBmdW5jdGlvbiggYnVsbGV0ICkge1xuXHRcdFxuXHRcdHZhciBpID0gdGhpcy5saXZlQnVsbGV0cy5pbmRleE9mKCBidWxsZXQgKTtcblx0XHRcblx0XHRpZiggaSA+PSAwICkge1xuXHRcdFx0dGhpcy5saXZlQnVsbGV0cy5zcGxpY2UoIGksIDEgKTtcblx0XHR9XG5cdFx0XG5cdFx0YnVsbGV0LmtpbGwoKTtcblx0XHRcblx0XHRpZiggdGhpcy5vYmplY3QgKSB0aGlzLm9iamVjdC5nZW9tZXRyeS52ZXJ0aWNlc05lZWRVcGRhdGUgPSB0cnVlO1xuXHRcdFxuXHR9LFxuXHRcblx0YWRkT2JqZWN0IDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIGdlb21ldHJ5LCBsaW5lTWF0ZXJpYWw7XG5cdFx0XG5cdFx0Z2VvbWV0cnkgPSB0aGlzLmdlbmVyYXRlR2VvbWV0cnkoKTtcblx0XHRcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5Qb2ludENsb3VkKFxuXHRcdFx0Z2VvbWV0cnksXG5cdFx0XHRuZXcgVEhSRUUuUG9pbnRDbG91ZE1hdGVyaWFsKHtcblx0XHRcdFx0IHNpemU6IDEgKiB0aGlzLnBvZW0ucmF0aW8sXG5cdFx0XHRcdCBjb2xvcjogMHhmZjAwMDBcblx0XHRcdH1cblx0XHQpKTtcblx0XHR0aGlzLm9iamVjdC5mcnVzdHVtQ3VsbGVkID0gZmFsc2U7XG5cdFx0dGhpcy5wb2VtLnNjZW5lLmFkZCggdGhpcy5vYmplY3QgKSA7XG5cdFx0XG5cdH0sXG5cdFxuXHR1cGRhdGUgOiBmdW5jdGlvbiggZSApICB7XG5cdFx0dmFyIGJ1bGxldCwgdGltZTtcblx0XHRcblx0XHRmb3IodmFyIGk9MDsgaTx0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRidWxsZXQgPSB0aGlzLmxpdmVCdWxsZXRzW2ldO1xuXHRcdFx0XG5cdFx0XHRpZihidWxsZXQuYm9ybkF0ICsgdGhpcy5idWxsZXRBZ2UgPCBlLnRpbWUpIHtcblx0XHRcdFx0dGhpcy5raWxsQnVsbGV0KCBidWxsZXQgKTtcblx0XHRcdFx0aS0tO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVsbGV0LnVwZGF0ZSggZS5kdCApO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZih0aGlzLmxpdmVCdWxsZXRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMub2JqZWN0Lmdlb21ldHJ5LnZlcnRpY2VzTmVlZFVwZGF0ZSA9IHRydWU7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0Y29uZmlndXJlQ29sbGlkZXIgOiBmdW5jdGlvbigpIHtcblx0XHRcblx0XHQvL0NvbGxpZGUgYnVsbGV0cyB3aXRoIGFzdGVyb2lkc1xuXHRcdG5ldyBDb2xsaWRlcihcblx0XHRcdFxuXHRcdFx0dGhpcy5wb2VtLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucG9lbS5hc3Rlcm9pZEZpZWxkLmFzdGVyb2lkcztcblx0XHRcdH0uYmluZCh0aGlzKSxcblx0XHRcdFxuXHRcdFx0ZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmxpdmVCdWxsZXRzO1xuXHRcdFx0fS5iaW5kKHRoaXMpLFxuXHRcdFx0XG5cdFx0XHRmdW5jdGlvbihhc3Rlcm9pZCwgYnVsbGV0KSB7XG5cdFx0XHRcdHRoaXMua2lsbEJ1bGxldCggYnVsbGV0IClcblx0XHRcdH0uYmluZCh0aGlzKVxuXHRcdFx0XG5cdFx0KTtcblx0fSxcblx0XG5cdGFkZFNvdW5kIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dmFyIHNvdW5kID0gdGhpcy5zb3VuZCA9IG5ldyBTb3VuZEdlbmVyYXRvcigpXG5cdFx0XG5cdFx0c291bmQuY29ubmVjdE5vZGVzKFtcblx0XHRcdHNvdW5kLm1ha2VPc2NpbGxhdG9yKCBcInNxdWFyZVwiICksXG5cdFx0XHRzb3VuZC5tYWtlR2FpbigpLFxuXHRcdFx0c291bmQuZ2V0RGVzdGluYXRpb24oKVxuXHRcdF0pO1xuXHRcdFxuXHRcdHNvdW5kLnNldEdhaW4oMCwwLDApO1xuXHRcdHNvdW5kLnN0YXJ0KCk7XG5cdFx0XG5cdH1cbn07IiwidmFyIF8gPSByZXF1aXJlKCd1bmRlcnNjb3JlJyk7XG52YXIgY29udGV4dCA9IHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dCB8fCBudWxsO1xuXG52YXIgU291bmRHZW5lcmF0b3IgPSBmdW5jdGlvbigpIHtcblx0XG5cdHRoaXMuZW5hYmxlZCA9IGNvbnRleHQgIT09IHVuZGVmaW5lZDtcblx0XG5cdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XG5cdHRoaXMudG90YWxDcmVhdGVkKys7XG5cdHRoaXMudG90YWxDcmVhdGVkU3EgPSB0aGlzLnRvdGFsQ3JlYXRlZCAqIHRoaXMudG90YWxDcmVhdGVkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTb3VuZEdlbmVyYXRvcjtcblxuU291bmRHZW5lcmF0b3IucHJvdG90eXBlID0ge1xuXHRcblx0Y29udGV4dCA6IGNvbnRleHQgPyBuZXcgY29udGV4dCgpIDogdW5kZWZpbmVkLFxuXHRcblx0bWFrZVBpbmtOb2lzZSA6IGZ1bmN0aW9uKCBidWZmZXJTaXplICkge1xuXHRcblx0XHR2YXIgYjAsIGIxLCBiMiwgYjMsIGI0LCBiNSwgYjYsIG5vZGU7IFxuXHRcdFxuXHRcdGIwID0gYjEgPSBiMiA9IGIzID0gYjQgPSBiNSA9IGI2ID0gMC4wO1xuXHRcdG5vZGUgPSB0aGlzLnBpbmtOb2lzZSA9IHRoaXMuY29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoYnVmZmVyU2l6ZSwgMSwgMSk7XG5cdFx0XG5cdFx0bm9kZS5vbmF1ZGlvcHJvY2VzcyA9IGZ1bmN0aW9uKGUpIHtcblx0XHRcdFxuXHRcdFx0Ly8gaHR0cDovL25vaXNlaGFjay5jb20vZ2VuZXJhdGUtbm9pc2Utd2ViLWF1ZGlvLWFwaS9cblx0XHRcdHZhciBvdXRwdXQgPSBlLm91dHB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKTtcblx0XHRcdFxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJTaXplOyBpKyspIHtcblx0XHRcdFx0dmFyIHdoaXRlID0gTWF0aC5yYW5kb20oKSAqIDIgLSAxO1xuXHRcdFx0XHRiMCA9IDAuOTk4ODYgKiBiMCArIHdoaXRlICogMC4wNTU1MTc5O1xuXHRcdFx0XHRiMSA9IDAuOTkzMzIgKiBiMSArIHdoaXRlICogMC4wNzUwNzU5O1xuXHRcdFx0XHRiMiA9IDAuOTY5MDAgKiBiMiArIHdoaXRlICogMC4xNTM4NTIwO1xuXHRcdFx0XHRiMyA9IDAuODY2NTAgKiBiMyArIHdoaXRlICogMC4zMTA0ODU2O1xuXHRcdFx0XHRiNCA9IDAuNTUwMDAgKiBiNCArIHdoaXRlICogMC41MzI5NTIyO1xuXHRcdFx0XHRiNSA9IC0wLjc2MTYgKiBiNSAtIHdoaXRlICogMC4wMTY4OTgwO1xuXHRcdFx0XHRvdXRwdXRbaV0gPSBiMCArIGIxICsgYjIgKyBiMyArIGI0ICsgYjUgKyBiNiArIHdoaXRlICogMC41MzYyO1xuXHRcdFx0XHRvdXRwdXRbaV0gKj0gMC4xMTsgLy8gKHJvdWdobHkpIGNvbXBlbnNhdGUgZm9yIGdhaW5cblx0XHRcdFx0YjYgPSB3aGl0ZSAqIDAuMTE1OTI2O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdFxuXHR9LFxuXHRcblx0bWFrZU9zY2lsbGF0b3IgOiBmdW5jdGlvbiggdHlwZSwgZnJlcXVlbmN5ICkge1xuXHRcdC8qXG5cdFx0XHRlbnVtIE9zY2lsbGF0b3JUeXBlIHtcblx0XHRcdCAgXCJzaW5lXCIsXG5cdFx0XHQgIFwic3F1YXJlXCIsXG5cdFx0XHQgIFwic2F3dG9vdGhcIixcblx0XHRcdCAgXCJ0cmlhbmdsZVwiLFxuXHRcdFx0ICBcImN1c3RvbVwiXG5cdFx0XHR9XG5cdFx0Ki9cblx0XHRcblx0XHR2YXIgbm9kZSA9IHRoaXMub3NjaWxsYXRvciA9IHRoaXMuY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG5cdFx0XG5cdFx0bm9kZS50eXBlID0gdHlwZSB8fCBcInNhd3Rvb3RoXCI7XG5cdFx0bm9kZS5mcmVxdWVuY3kudmFsdWUgPSBmcmVxdWVuY3kgfHwgMjAwMDtcblx0XHRcblx0XHRyZXR1cm4gbm9kZTtcblx0fSxcblx0XG5cdG1ha2VHYWluIDogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIG5vZGUgPSB0aGlzLmdhaW4gPSB0aGlzLmNvbnRleHQuY3JlYXRlR2FpbigpO1xuXHRcdFxuXHRcdG5vZGUuZ2Fpbi52YWx1ZSA9IDE7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdFxuXHRtYWtlUGFubmVyIDogZnVuY3Rpb24oKSB7XG5cdFx0XG5cdFx0dGhpcy5jb250ZXh0Lmxpc3RlbmVyLnNldFBvc2l0aW9uKDAsIDAsIDApO1xuXHRcdFxuXHRcdHZhciBub2RlID0gdGhpcy5wYW5uZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlUGFubmVyKCk7XG5cdFx0XG5cdFx0bm9kZS5wYW5uaW5nTW9kZWwgPSAnZXF1YWxwb3dlcic7XG5cdFx0bm9kZS5jb25lT3V0ZXJHYWluID0gMC4xO1xuXHRcdG5vZGUuY29uZU91dGVyQW5nbGUgPSAxODA7XG5cdFx0bm9kZS5jb25lSW5uZXJBbmdsZSA9IDA7XG5cdFx0XG5cdFx0cmV0dXJuIG5vZGU7XG5cdH0sXG5cdFxuXHRtYWtlQmFuZHBhc3MgOiBmdW5jdGlvbigpIHtcblxuXHRcdHZhciBub2RlID0gdGhpcy5iYW5kcGFzcyA9IHRoaXMuY29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcblx0XHRcblx0XHRub2RlLnR5cGUgPSBcImJhbmRwYXNzXCI7XG5cdFx0bm9kZS5mcmVxdWVuY3kudmFsdWUgPSA0NDA7XG5cdFx0bm9kZS5RLnZhbHVlID0gMC41O1xuXHRcdFxuXHRcdHJldHVybiBub2RlO1xuXG5cdH0sXG5cdFxuXHRnZXREZXN0aW5hdGlvbiA6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmNvbnRleHQuZGVzdGluYXRpb247XG5cdH0sXG5cdFxuXHRjb25uZWN0Tm9kZXMgOiBmdW5jdGlvbiggbm9kZXMgKSB7XG5cdFx0Xy5lYWNoKCBfLnJlc3QoIG5vZGVzICksIGZ1bmN0aW9uKG5vZGUsIGksIGxpc3QpIHtcblx0XHRcdHZhciBwcmV2Tm9kZSA9IG5vZGVzW2ldO1xuXHRcdFx0XG5cdFx0XHRwcmV2Tm9kZS5jb25uZWN0KCBub2RlICk7XG5cdFx0fSk7XG5cdH0sXG5cdFxuXHRzdGFydCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMub3NjaWxsYXRvci5zdGFydCgwKTtcblx0fSxcblx0XG5cdHRvdGFsQ3JlYXRlZCA6IDAsXG5cdFxuXHRzZXRGcmVxdWVuY3kgOiBmdW5jdGlvbiAoIGZyZXF1ZW5jeSwgZGVsYXksIHNwZWVkICkge1xuXHRcdGlmKCF0aGlzLmVuYWJsZWQpIHJldHVybjtcblx0XHRcblx0XHR0aGlzLm9zY2lsbGF0b3IuZnJlcXVlbmN5LnNldFRhcmdldEF0VGltZShmcmVxdWVuY3ksIHRoaXMuY29udGV4dC5jdXJyZW50VGltZSArIGRlbGF5LCBzcGVlZCk7XG5cdH0sXG5cdFxuXHRzZXRQb3NpdGlvbiA6IGZ1bmN0aW9uICggeCwgeSwgeiApIHtcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0dGhpcy5wYW5uZXIuc2V0UG9zaXRpb24oIHgsIHksIHogKTtcblx0fSxcblx0XG5cdHNldEdhaW4gOiBmdW5jdGlvbiAoIGdhaW4sIGRlbGF5LCBzcGVlZCApIHtcblx0XHRcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0XG5cdFx0Ly8gTWF0aC5tYXgoIE1hdGguYWJzKCBnYWluICksIDEpO1xuXHRcdC8vIGdhaW4gLyB0aGlzLnRvdGFsQ3JlYXRlZFNxO1xuXHRcdFx0XHRcblx0XHR0aGlzLmdhaW4uZ2Fpbi5zZXRUYXJnZXRBdFRpbWUoXG5cdFx0XHRnYWluLFxuXHRcdFx0dGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lICsgZGVsYXksXG5cdFx0XHRzcGVlZFxuXHRcdCk7XG5cdH0sXG5cdFxuXHRzZXRCYW5kcGFzc1EgOiBmdW5jdGlvbiAoIFEgKSB7XG5cdFx0aWYoIXRoaXMuZW5hYmxlZCkgcmV0dXJuO1xuXHRcdHRoaXMuYmFuZHBhc3MuUS5zZXRUYXJnZXRBdFRpbWUoUSwgdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lLCAwLjEpO1xuXHR9LFxuXHRcblx0c2V0QmFuZHBhc3NGcmVxdWVuY3kgOiBmdW5jdGlvbiAoIGZyZXF1ZW5jeSApIHtcblx0XHRpZighdGhpcy5lbmFibGVkKSByZXR1cm47XG5cdFx0dGhpcy5iYW5kcGFzcy5mcmVxdWVuY3kuc2V0VGFyZ2V0QXRUaW1lKGZyZXF1ZW5jeSwgdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lLCAwLjEpO1xuXHR9XG59OyIsInZhciBDbG9jayA9IGZ1bmN0aW9uKCBhdXRvc3RhcnQgKSB7XG5cblx0dGhpcy5tYXhEdCA9IDYwO1xuXHR0aGlzLm1pbkR0ID0gMTY7XG5cdHRoaXMucFRpbWUgPSAwO1xuXHR0aGlzLnRpbWUgPSAwO1xuXHRcblx0aWYoYXV0b3N0YXJ0ICE9PSBmYWxzZSkge1xuXHRcdHRoaXMuc3RhcnQoKTtcblx0fVxuXHRcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xvY2s7XG5cbkNsb2NrLnByb3RvdHlwZSA9IHtcblxuXHRzdGFydCA6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMucFRpbWUgPSBEYXRlLm5vdygpO1xuXHR9LFxuXHRcblx0Z2V0RGVsdGEgOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgbm93LCBkdDtcblx0XHRcblx0XHRub3cgPSBEYXRlLm5vdygpO1xuXHRcdGR0ID0gbm93IC0gdGhpcy5wVGltZTtcblx0XHRcblx0XHRkdCA9IE1hdGgubWluKCBkdCwgdGhpcy5tYXhEdCApO1xuXHRcdGR0ID0gTWF0aC5tYXgoIGR0LCB0aGlzLm1pbkR0ICk7XG5cdFx0XG5cdFx0dGhpcy50aW1lICs9IGR0O1xuXHRcdHRoaXMucFRpbWUgPSBub3c7XG5cdFx0XG5cdFx0cmV0dXJuIGR0O1xuXHR9XG5cdFxufTsiLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxudmFyIENvbGxpZGVyID0gZnVuY3Rpb24oIHBvZW0sIGdldENvbGxlY3Rpb25BLCBnZXRDb2xsZWN0aW9uQiwgb25Db2xsaXNpb24gKSB7XG5cdFxuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHRcblx0dGhpcy5nZXRDb2xsZWN0aW9uQSA9IGdldENvbGxlY3Rpb25BO1xuXHR0aGlzLmdldENvbGxlY3Rpb25CID0gZ2V0Q29sbGVjdGlvbkI7XG5cdHRoaXMub25Db2xsaXNpb24gPSBvbkNvbGxpc2lvbjtcblx0XG5cdHRoaXMucG9lbS5vbigndXBkYXRlJywgdGhpcy51cGRhdGUuYmluZCh0aGlzKSApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2xsaWRlcjtcblxuQ29sbGlkZXIucHJvdG90eXBlID0ge1xuXHRcblx0dXBkYXRlIDogZnVuY3Rpb24oIGUgKSB7XG5cblx0XHR2YXIgY29sbGlzaW9ucyA9IFtdO1xuXG5cdFx0Xy5lYWNoKCB0aGlzLmdldENvbGxlY3Rpb25BKCksIGZ1bmN0aW9uKCBpdGVtRnJvbUEgKSB7XG5cdFx0XHRcblx0XHRcdHZhciBjb2xsaWRlZEl0ZW1Gcm9tQiA9IF8uZmluZCggdGhpcy5nZXRDb2xsZWN0aW9uQigpLCBmdW5jdGlvbiggaXRlbUZyb21CICkge1xuXHRcdFx0XHRcblx0XHRcdFx0XG5cdFx0XHRcdHZhciBkeCwgZHksIGRpc3RhbmNlO1xuXHRcdFx0XG5cdFx0XHRcdGR4ID0gdGhpcy5wb2VtLmNvb3JkaW5hdGVzLmNpcmN1bWZlcmVuY2VEaXN0YW5jZSggaXRlbUZyb21BLnBvc2l0aW9uLngsIGl0ZW1Gcm9tQi5wb3NpdGlvbi54ICk7XG5cdFx0XHRcdGR5ID0gaXRlbUZyb21BLnBvc2l0aW9uLnkgLSBpdGVtRnJvbUIucG9zaXRpb24ueTtcblx0XHRcdFxuXHRcdFx0XHRkaXN0YW5jZSA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XG5cdFx0XHRcdFxuXHRcdFx0XG5cdFx0XHRcdHJldHVybiBkaXN0YW5jZSA8IGl0ZW1Gcm9tQS5yYWRpdXMgKyBpdGVtRnJvbUIucmFkaXVzO1xuXHRcdFx0XHRcblx0XHRcdH0sIHRoaXMpO1xuXHRcdFx0XG5cdFx0XHRcblx0XHRcdGlmKCBjb2xsaWRlZEl0ZW1Gcm9tQiApIHtcblx0XHRcdFx0Y29sbGlzaW9ucy5wdXNoKFtpdGVtRnJvbUEsIGNvbGxpZGVkSXRlbUZyb21CXSk7XG5cdFx0XHR9XG5cdFx0XHRcblx0XHR9LCB0aGlzKTtcblx0XHRcblx0XHRfLmVhY2goIGNvbGxpc2lvbnMsIGZ1bmN0aW9uKCBpdGVtcyApIHtcblx0XHRcdHRoaXMub25Db2xsaXNpb24oIGl0ZW1zWzBdLCBpdGVtc1sxXSApO1xuXHRcdH0sIHRoaXMpO1xuXHR9XG5cdFxufTsiLCIvLyBUcmFuc2xhdGVzIDJkIHBvaW50cyBpbnRvIDNkIHBvbGFyIHNwYWNlXG5cbnZhciBDb29yZGluYXRlcyA9IGZ1bmN0aW9uKCBwb2VtICkge1xuXHR0aGlzLnBvZW0gPSBwb2VtO1xuXHR0aGlzLnR3b1JTcXVhcmVkID0gMiAqICh0aGlzLnBvZW0uciAqIHRoaXMucG9lbS5yKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29vcmRpbmF0ZXM7XG5cbkNvb3JkaW5hdGVzLnByb3RvdHlwZSA9IHtcblx0XG5cdHggOiBmdW5jdGlvbiggeCApIHtcblx0XHRyZXR1cm4gTWF0aC5zaW4oIHggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0fSxcblx0XG5cdHkgOiBmdW5jdGlvbiggeSApIHtcblx0XHRyZXR1cm4geTtcblx0fSxcblx0XG5cdHogOiBmdW5jdGlvbiggeCApIHtcblx0XHRyZXR1cm4gTWF0aC5jb3MoIHggKiB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvICkgKiB0aGlzLnBvZW0ucjtcblx0fSxcblx0XG5cdHIgOiBmdW5jdGlvbih4LCB6KSB7XG5cdFx0cmV0dXJuIE1hdGguc3FydCh4KnggKyB6KnopO1xuXHR9LFxuXHRcblx0dGhldGEgOiBmdW5jdGlvbih4LCB6KSB7XG5cdFx0cmV0dXJuIE1hdGguYXRhbiggeiAvIHggKTtcblx0fSxcblx0XG5cdHNldFZlY3RvciA6IGZ1bmN0aW9uKCB2ZWN0b3IgKSB7XG5cdFx0XG5cdFx0dmFyIHgsIHksIHZlY3RvcjI7XG5cdFx0XG5cdFx0aWYoIHR5cGVvZiBhcmd1bWVudHNbMV0gPT09IFwibnVtYmVyXCIgKSB7XG5cdFx0XHRcblx0XHRcdHggPSBhcmd1bWVudHNbMV07XG5cdFx0XHR5ID0gYXJndW1lbnRzWzJdO1xuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdmVjdG9yLnNldChcblx0XHRcdFx0dGhpcy54KHgpLFxuXHRcdFx0XHR5LFxuXHRcdFx0XHR0aGlzLnooeClcblx0XHRcdCk7XG5cdFx0XHRcblx0XHR9IGVsc2Uge1xuXHRcdFx0XG5cdFx0XHR2ZWN0b3IyID0gYXJndW1lbnRzWzFdO1xuXHRcdFx0XG5cdFx0XHRyZXR1cm4gdmVjdG9yLnNldChcblx0XHRcdFx0dGhpcy54KHZlY3RvcjIueCksXG5cdFx0XHRcdHZlY3RvcjIueSxcblx0XHRcdFx0dGhpcy56KHZlY3RvcjIueClcblx0XHRcdCk7XG5cdFx0fVxuXHRcdFxuXHR9LFxuXHRcblx0Z2V0VmVjdG9yIDogZnVuY3Rpb24oIHgsIHkgKSB7XG5cdFx0XG5cdFx0dmFyIHZlY3RvciA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdFx0cmV0dXJuIHRoaXMuc2V0VmVjdG9yKCB2ZWN0b3IsIHgsIHkgKTtcblx0XHRcblx0fSxcblx0XG5cdGtlZXBJblJhbmdlWCA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdGlmKCB4ID49IDAgKSB7XG5cdFx0XHRyZXR1cm4geCAlIHRoaXMucG9lbS5jaXJjdW1mZXJlbmNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4geCArICh4ICUgdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2UpO1xuXHRcdH1cblx0fSxcblx0XG5cdGtlZXBJblJhbmdlWSA6IGZ1bmN0aW9uKCB5ICkge1xuXHRcdGlmKCB5ID49IDAgKSB7XG5cdFx0XHRyZXR1cm4geSAlIHRoaXMucG9lbS5oZWlnaHQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB5ICsgKHkgJSB0aGlzLnBvZW0uaGVpZ2h0KTtcblx0XHR9XG5cdH0sXG5cdFxuXHRrZWVwSW5SYW5nZSA6IGZ1bmN0aW9uKCB2ZWN0b3IgKSB7XG5cdFx0dmVjdG9yLnggPSB0aGlzLmtlZXBJblJhbmdlWCggdmVjdG9yLnggKTtcblx0XHR2ZWN0b3IueSA9IHRoaXMua2VlcEluUmFuZ2VYKCB2ZWN0b3IueSApO1xuXHRcdHJldHVybiB2ZWN0b3I7XG5cdH0sXG5cdFxuXHR0d29YVG9UaGV0YSA6IGZ1bmN0aW9uKCB4ICkge1xuXHRcdHJldHVybiB4ICogdGhpcy5wb2VtLmNpcmN1bWZlcmVuY2VSYXRpbztcblx0fSxcblx0XG5cdGNpcmN1bWZlcmVuY2VEaXN0YW5jZSA6IGZ1bmN0aW9uICh4MSwgeDIpIHtcblx0XHRcblx0XHR2YXIgcmF0aW8gPSB0aGlzLnBvZW0uY2lyY3VtZmVyZW5jZVJhdGlvO1xuXHRcdFxuXHRcdHJldHVybiB0aGlzLnR3b1JTcXVhcmVkIC0gdGhpcy50d29SU3F1YXJlZCAqIE1hdGguY29zKCB4MSAqIHJhdGlvIC0geDIgKiByYXRpbyApO1xuXHRcdFxuXHR9XG5cdFxufTtcbiIsIi8qKlxuICogQGF1dGhvciBtcmRvb2IgLyBodHRwOi8vbXJkb29iLmNvbS9cbiAqXG4gKiBNb2RpZmljYXRpb25zOiBHcmVnIFRhdHVtXG4gKlxuICogdXNhZ2U6XG4gKiBcbiAqIFx0XHRFdmVudERpc3BhdGNoZXIucHJvdG90eXBlLmFwcGx5KCBNeU9iamVjdC5wcm90b3R5cGUgKTtcbiAqIFxuICogXHRcdE15T2JqZWN0LmRpc3BhdGNoKHtcbiAqIFx0XHRcdHR5cGU6IFwiY2xpY2tcIixcbiAqIFx0XHRcdGRhdHVtMTogXCJmb29cIixcbiAqIFx0XHRcdGRhdHVtMjogXCJiYXJcIlxuICogXHRcdH0pO1xuICogXG4gKiBcdFx0TXlPYmplY3Qub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oIGV2ZW50ICkge1xuICogXHRcdFx0ZXZlbnQuZGF0dW0xOyAvL0Zvb1xuICogXHRcdFx0ZXZlbnQudGFyZ2V0OyAvL015T2JqZWN0XG4gKiBcdFx0fSk7XG4gKiBcbiAqXG4gKi9cblxudmFyIEV2ZW50RGlzcGF0Y2hlciA9IGZ1bmN0aW9uICgpIHt9O1xuXG5FdmVudERpc3BhdGNoZXIucHJvdG90eXBlID0ge1xuXG5cdGNvbnN0cnVjdG9yOiBFdmVudERpc3BhdGNoZXIsXG5cblx0YXBwbHk6IGZ1bmN0aW9uICggb2JqZWN0ICkge1xuXG5cdFx0b2JqZWN0Lm9uXHRcdFx0XHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5vbjtcblx0XHRvYmplY3QuaGFzRXZlbnRMaXN0ZW5lclx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuaGFzRXZlbnRMaXN0ZW5lcjtcblx0XHRvYmplY3Qub2ZmXHRcdFx0XHRcdD0gRXZlbnREaXNwYXRjaGVyLnByb3RvdHlwZS5vZmY7XG5cdFx0b2JqZWN0LmRpc3BhdGNoXHRcdFx0XHQ9IEV2ZW50RGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2g7XG5cblx0fSxcblxuXHRvbjogZnVuY3Rpb24gKCB0eXBlLCBsaXN0ZW5lciApIHtcblxuXHRcdGlmICggdGhpcy5fbGlzdGVuZXJzID09PSB1bmRlZmluZWQgKSB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdID09PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGxpc3RlbmVyc1sgdHlwZSBdID0gW107XG5cblx0XHR9XG5cblx0XHRpZiAoIGxpc3RlbmVyc1sgdHlwZSBdLmluZGV4T2YoIGxpc3RlbmVyICkgPT09IC0gMSApIHtcblxuXHRcdFx0bGlzdGVuZXJzWyB0eXBlIF0ucHVzaCggbGlzdGVuZXIgKTtcblxuXHRcdH1cblxuXHR9LFxuXG5cdGhhc0V2ZW50TGlzdGVuZXI6IGZ1bmN0aW9uICggdHlwZSwgbGlzdGVuZXIgKSB7XG5cblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblxuXHRcdGlmICggbGlzdGVuZXJzWyB0eXBlIF0gIT09IHVuZGVmaW5lZCAmJiBsaXN0ZW5lcnNbIHR5cGUgXS5pbmRleE9mKCBsaXN0ZW5lciApICE9PSAtIDEgKSB7XG5cblx0XHRcdHJldHVybiB0cnVlO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXG5cdH0sXG5cblx0b2ZmOiBmdW5jdGlvbiAoIHR5cGUsIGxpc3RlbmVyICkge1xuXG5cdFx0aWYgKCB0aGlzLl9saXN0ZW5lcnMgPT09IHVuZGVmaW5lZCApIHJldHVybjtcblxuXHRcdHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnM7XG5cdFx0dmFyIGxpc3RlbmVyQXJyYXkgPSBsaXN0ZW5lcnNbIHR5cGUgXTtcblxuXHRcdGlmICggbGlzdGVuZXJBcnJheSAhPT0gdW5kZWZpbmVkICkge1xuXG5cdFx0XHR2YXIgaW5kZXggPSBsaXN0ZW5lckFycmF5LmluZGV4T2YoIGxpc3RlbmVyICk7XG5cblx0XHRcdGlmICggaW5kZXggIT09IC0gMSApIHtcblxuXHRcdFx0XHRsaXN0ZW5lckFycmF5LnNwbGljZSggaW5kZXgsIDEgKTtcblxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdH0sXG5cblx0ZGlzcGF0Y2g6IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcblx0XHRpZiAoIHRoaXMuX2xpc3RlbmVycyA9PT0gdW5kZWZpbmVkICkgcmV0dXJuO1xuXG5cdFx0dmFyIGxpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycztcblx0XHR2YXIgbGlzdGVuZXJBcnJheSA9IGxpc3RlbmVyc1sgZXZlbnQudHlwZSBdO1xuXG5cdFx0aWYgKCBsaXN0ZW5lckFycmF5ICE9PSB1bmRlZmluZWQgKSB7XG5cblx0XHRcdGV2ZW50LnRhcmdldCA9IHRoaXM7XG5cblx0XHRcdHZhciBhcnJheSA9IFtdO1xuXHRcdFx0dmFyIGxlbmd0aCA9IGxpc3RlbmVyQXJyYXkubGVuZ3RoO1xuXHRcdFx0dmFyIGk7XG5cblx0XHRcdGZvciAoIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICsrICkge1xuXG5cdFx0XHRcdGFycmF5WyBpIF0gPSBsaXN0ZW5lckFycmF5WyBpIF07XG5cblx0XHRcdH1cblxuXHRcdFx0Zm9yICggaSA9IDA7IGkgPCBsZW5ndGg7IGkgKysgKSB7XG5cblx0XHRcdFx0YXJyYXlbIGkgXS5jYWxsKCB0aGlzLCBldmVudCApO1xuXG5cdFx0XHR9XG5cblx0XHR9XG5cblx0fVxuXG59O1xuXG5pZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICkge1xuXG5cdG1vZHVsZS5leHBvcnRzID0gRXZlbnREaXNwYXRjaGVyO1xuXG59IiwiLyoqXG4gKiBAYXV0aG9yIG1yZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xuICovXG5cbnZhciBTdGF0cyA9IGZ1bmN0aW9uICgpIHtcblxuXHR2YXIgc3RhcnRUaW1lID0gRGF0ZS5ub3coKSwgcHJldlRpbWUgPSBzdGFydFRpbWU7XG5cdHZhciBtcyA9IDAsIG1zTWluID0gSW5maW5pdHksIG1zTWF4ID0gMDtcblx0dmFyIGZwcyA9IDAsIGZwc01pbiA9IEluZmluaXR5LCBmcHNNYXggPSAwO1xuXHR2YXIgZnJhbWVzID0gMCwgbW9kZSA9IDA7XG5cblx0dmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGNvbnRhaW5lci5pZCA9ICdzdGF0cyc7XG5cdGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHsgZXZlbnQucHJldmVudERlZmF1bHQoKTsgc2V0TW9kZSggKysgbW9kZSAlIDIgKTsgfSwgZmFsc2UgKTtcblx0Y29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6ODBweDtvcGFjaXR5OjAuOTtjdXJzb3I6cG9pbnRlcic7XG5cblx0dmFyIGZwc0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdGZwc0Rpdi5pZCA9ICdmcHMnO1xuXHRmcHNEaXYuc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjAgMCAzcHggM3B4O3RleHQtYWxpZ246bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMwMDInO1xuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIGZwc0RpdiApO1xuXG5cdHZhciBmcHNUZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0ZnBzVGV4dC5pZCA9ICdmcHNUZXh0Jztcblx0ZnBzVGV4dC5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOiMwZmY7Zm9udC1mYW1pbHk6SGVsdmV0aWNhLEFyaWFsLHNhbnMtc2VyaWY7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDpib2xkO2xpbmUtaGVpZ2h0OjE1cHgnO1xuXHRmcHNUZXh0LmlubmVySFRNTCA9ICdGUFMnO1xuXHRmcHNEaXYuYXBwZW5kQ2hpbGQoIGZwc1RleHQgKTtcblxuXHR2YXIgZnBzR3JhcGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRmcHNHcmFwaC5pZCA9ICdmcHNHcmFwaCc7XG5cdGZwc0dyYXBoLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246cmVsYXRpdmU7d2lkdGg6NzRweDtoZWlnaHQ6MzBweDtiYWNrZ3JvdW5kLWNvbG9yOiMwZmYnO1xuXHRmcHNEaXYuYXBwZW5kQ2hpbGQoIGZwc0dyYXBoICk7XG5cblx0d2hpbGUgKCBmcHNHcmFwaC5jaGlsZHJlbi5sZW5ndGggPCA3NCApIHtcblxuXHRcdHZhciBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRiYXIuc3R5bGUuY3NzVGV4dCA9ICd3aWR0aDoxcHg7aGVpZ2h0OjMwcHg7ZmxvYXQ6bGVmdDtiYWNrZ3JvdW5kLWNvbG9yOiMxMTMnO1xuXHRcdGZwc0dyYXBoLmFwcGVuZENoaWxkKCBiYXIgKTtcblxuXHR9XG5cblx0dmFyIG1zRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0bXNEaXYuaWQgPSAnbXMnO1xuXHRtc0Rpdi5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6MCAwIDNweCAzcHg7dGV4dC1hbGlnbjpsZWZ0O2JhY2tncm91bmQtY29sb3I6IzAyMDtkaXNwbGF5Om5vbmUnO1xuXHRjb250YWluZXIuYXBwZW5kQ2hpbGQoIG1zRGl2ICk7XG5cblx0dmFyIG1zVGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdG1zVGV4dC5pZCA9ICdtc1RleHQnO1xuXHRtc1RleHQuc3R5bGUuY3NzVGV4dCA9ICdjb2xvcjojMGYwO2ZvbnQtZmFtaWx5OkhlbHZldGljYSxBcmlhbCxzYW5zLXNlcmlmO2ZvbnQtc2l6ZTo5cHg7Zm9udC13ZWlnaHQ6Ym9sZDtsaW5lLWhlaWdodDoxNXB4Jztcblx0bXNUZXh0LmlubmVySFRNTCA9ICdNUyc7XG5cdG1zRGl2LmFwcGVuZENoaWxkKCBtc1RleHQgKTtcblxuXHR2YXIgbXNHcmFwaCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdG1zR3JhcGguaWQgPSAnbXNHcmFwaCc7XG5cdG1zR3JhcGguc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDo3NHB4O2hlaWdodDozMHB4O2JhY2tncm91bmQtY29sb3I6IzBmMCc7XG5cdG1zRGl2LmFwcGVuZENoaWxkKCBtc0dyYXBoICk7XG5cblx0d2hpbGUgKCBtc0dyYXBoLmNoaWxkcmVuLmxlbmd0aCA8IDc0ICkge1xuXG5cdFx0dmFyIGJhcjIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcblx0XHRiYXIyLnN0eWxlLmNzc1RleHQgPSAnd2lkdGg6MXB4O2hlaWdodDozMHB4O2Zsb2F0OmxlZnQ7YmFja2dyb3VuZC1jb2xvcjojMTMxJztcblx0XHRtc0dyYXBoLmFwcGVuZENoaWxkKCBiYXIyICk7XG5cblx0fVxuXG5cdHZhciBzZXRNb2RlID0gZnVuY3Rpb24gKCB2YWx1ZSApIHtcblxuXHRcdG1vZGUgPSB2YWx1ZTtcblxuXHRcdHN3aXRjaCAoIG1vZGUgKSB7XG5cblx0XHRcdGNhc2UgMDpcblx0XHRcdFx0ZnBzRGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHRtc0Rpdi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0ZnBzRGl2LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRcdG1zRGl2LnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0fTtcblxuXHR2YXIgdXBkYXRlR3JhcGggPSBmdW5jdGlvbiAoIGRvbSwgdmFsdWUgKSB7XG5cblx0XHR2YXIgY2hpbGQgPSBkb20uYXBwZW5kQ2hpbGQoIGRvbS5maXJzdENoaWxkICk7XG5cdFx0Y2hpbGQuc3R5bGUuaGVpZ2h0ID0gdmFsdWUgKyAncHgnO1xuXG5cdH07XG5cblx0cmV0dXJuIHtcblxuXHRcdFJFVklTSU9OOiAxMixcblxuXHRcdGRvbUVsZW1lbnQ6IGNvbnRhaW5lcixcblxuXHRcdHNldE1vZGU6IHNldE1vZGUsXG5cblx0XHRiZWdpbjogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0fSxcblxuXHRcdGVuZDogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHR2YXIgdGltZSA9IERhdGUubm93KCk7XG5cblx0XHRcdG1zID0gdGltZSAtIHN0YXJ0VGltZTtcblx0XHRcdG1zTWluID0gTWF0aC5taW4oIG1zTWluLCBtcyApO1xuXHRcdFx0bXNNYXggPSBNYXRoLm1heCggbXNNYXgsIG1zICk7XG5cblx0XHRcdG1zVGV4dC50ZXh0Q29udGVudCA9IG1zICsgJyBNUyAoJyArIG1zTWluICsgJy0nICsgbXNNYXggKyAnKSc7XG5cdFx0XHR1cGRhdGVHcmFwaCggbXNHcmFwaCwgTWF0aC5taW4oIDMwLCAzMCAtICggbXMgLyAyMDAgKSAqIDMwICkgKTtcblxuXHRcdFx0ZnJhbWVzICsrO1xuXG5cdFx0XHRpZiAoIHRpbWUgPiBwcmV2VGltZSArIDEwMDAgKSB7XG5cblx0XHRcdFx0ZnBzID0gTWF0aC5yb3VuZCggKCBmcmFtZXMgKiAxMDAwICkgLyAoIHRpbWUgLSBwcmV2VGltZSApICk7XG5cdFx0XHRcdGZwc01pbiA9IE1hdGgubWluKCBmcHNNaW4sIGZwcyApO1xuXHRcdFx0XHRmcHNNYXggPSBNYXRoLm1heCggZnBzTWF4LCBmcHMgKTtcblxuXHRcdFx0XHRmcHNUZXh0LnRleHRDb250ZW50ID0gZnBzICsgJyBGUFMgKCcgKyBmcHNNaW4gKyAnLScgKyBmcHNNYXggKyAnKSc7XG5cdFx0XHRcdHVwZGF0ZUdyYXBoKCBmcHNHcmFwaCwgTWF0aC5taW4oIDMwLCAzMCAtICggZnBzIC8gMTAwICkgKiAzMCApICk7XG5cblx0XHRcdFx0cHJldlRpbWUgPSB0aW1lO1xuXHRcdFx0XHRmcmFtZXMgPSAwO1xuXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aW1lO1xuXG5cdFx0fSxcblxuXHRcdHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRzdGFydFRpbWUgPSB0aGlzLmVuZCgpO1xuXG5cdFx0fVxuXG5cdH07XG5cbn07XG5cbmlmICggdHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgKSB7XG5cblx0bW9kdWxlLmV4cG9ydHMgPSBTdGF0cztcblxufSIsInZhciByYW5kb20gPSB7XG5cdFxuXHRmbGlwIDogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIE1hdGgucmFuZG9tKCkgPiAwLjUgPyB0cnVlOiBmYWxzZTtcblx0fSxcblx0XG5cdHJhbmdlIDogZnVuY3Rpb24obWluLCBtYXgpIHtcblx0XHRyZXR1cm4gTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pICsgbWluO1xuXHR9LFxuXHRcblx0cmFuZ2VJbnQgOiBmdW5jdGlvbihtaW4sIG1heCkge1xuXHRcdHJldHVybiBNYXRoLmZsb29yKCB0aGlzLnJhbmdlKG1pbiwgbWF4ICsgMSkgKTtcblx0fSxcblx0XG5cdHJhbmdlTG93IDogZnVuY3Rpb24obWluLCBtYXgpIHtcblx0XHQvL01vcmUgbGlrZWx5IHRvIHJldHVybiBhIGxvdyB2YWx1ZVxuXHQgIHJldHVybiBNYXRoLnJhbmRvbSgpICogTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pICsgbWluO1xuXHR9LFxuXHRcblx0cmFuZ2VIaWdoIDogZnVuY3Rpb24obWluLCBtYXgpIHtcblx0XHQvL01vcmUgbGlrZWx5IHRvIHJldHVybiBhIGhpZ2ggdmFsdWVcblx0XHRyZXR1cm4gKDEgLSBNYXRoLnJhbmRvbSgpICogTWF0aC5yYW5kb20oKSkgKiAobWF4IC0gbWluKSArIG1pbjtcblx0fVxuXHQgXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmRvbTtcbiIsIi8vICAgICBVbmRlcnNjb3JlLmpzIDEuNy4wXG4vLyAgICAgaHR0cDovL3VuZGVyc2NvcmVqcy5vcmdcbi8vICAgICAoYykgMjAwOS0yMDE0IEplcmVteSBBc2hrZW5hcywgRG9jdW1lbnRDbG91ZCBhbmQgSW52ZXN0aWdhdGl2ZSBSZXBvcnRlcnMgJiBFZGl0b3JzXG4vLyAgICAgVW5kZXJzY29yZSBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKGZ1bmN0aW9uKCkge1xuXG4gIC8vIEJhc2VsaW5lIHNldHVwXG4gIC8vIC0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gRXN0YWJsaXNoIHRoZSByb290IG9iamVjdCwgYHdpbmRvd2AgaW4gdGhlIGJyb3dzZXIsIG9yIGBleHBvcnRzYCBvbiB0aGUgc2VydmVyLlxuICB2YXIgcm9vdCA9IHRoaXM7XG5cbiAgLy8gU2F2ZSB0aGUgcHJldmlvdXMgdmFsdWUgb2YgdGhlIGBfYCB2YXJpYWJsZS5cbiAgdmFyIHByZXZpb3VzVW5kZXJzY29yZSA9IHJvb3QuXztcblxuICAvLyBTYXZlIGJ5dGVzIGluIHRoZSBtaW5pZmllZCAoYnV0IG5vdCBnemlwcGVkKSB2ZXJzaW9uOlxuICB2YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSwgT2JqUHJvdG8gPSBPYmplY3QucHJvdG90eXBlLCBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgLy8gQ3JlYXRlIHF1aWNrIHJlZmVyZW5jZSB2YXJpYWJsZXMgZm9yIHNwZWVkIGFjY2VzcyB0byBjb3JlIHByb3RvdHlwZXMuXG4gIHZhclxuICAgIHB1c2ggICAgICAgICAgICAgPSBBcnJheVByb3RvLnB1c2gsXG4gICAgc2xpY2UgICAgICAgICAgICA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgY29uY2F0ICAgICAgICAgICA9IEFycmF5UHJvdG8uY29uY2F0LFxuICAgIHRvU3RyaW5nICAgICAgICAgPSBPYmpQcm90by50b1N0cmluZyxcbiAgICBoYXNPd25Qcm9wZXJ0eSAgID0gT2JqUHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbiAgLy8gQWxsICoqRUNNQVNjcmlwdCA1KiogbmF0aXZlIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9ucyB0aGF0IHdlIGhvcGUgdG8gdXNlXG4gIC8vIGFyZSBkZWNsYXJlZCBoZXJlLlxuICB2YXJcbiAgICBuYXRpdmVJc0FycmF5ICAgICAgPSBBcnJheS5pc0FycmF5LFxuICAgIG5hdGl2ZUtleXMgICAgICAgICA9IE9iamVjdC5rZXlzLFxuICAgIG5hdGl2ZUJpbmQgICAgICAgICA9IEZ1bmNQcm90by5iaW5kO1xuXG4gIC8vIENyZWF0ZSBhIHNhZmUgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgdXNlIGJlbG93LlxuICB2YXIgXyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBfKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfKSkgcmV0dXJuIG5ldyBfKG9iaik7XG4gICAgdGhpcy5fd3JhcHBlZCA9IG9iajtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuICAvLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4gIC8vIHRoZSBicm93c2VyLCBhZGQgYF9gIGFzIGEgZ2xvYmFsIG9iamVjdC5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gXztcbiAgICB9XG4gICAgZXhwb3J0cy5fID0gXztcbiAgfSBlbHNlIHtcbiAgICByb290Ll8gPSBfO1xuICB9XG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICBfLlZFUlNJT04gPSAnMS43LjAnO1xuXG4gIC8vIEludGVybmFsIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBlZmZpY2llbnQgKGZvciBjdXJyZW50IGVuZ2luZXMpIHZlcnNpb25cbiAgLy8gb2YgdGhlIHBhc3NlZC1pbiBjYWxsYmFjaywgdG8gYmUgcmVwZWF0ZWRseSBhcHBsaWVkIGluIG90aGVyIFVuZGVyc2NvcmVcbiAgLy8gZnVuY3Rpb25zLlxuICB2YXIgY3JlYXRlQ2FsbGJhY2sgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0LCBhcmdDb3VudCkge1xuICAgIGlmIChjb250ZXh0ID09PSB2b2lkIDApIHJldHVybiBmdW5jO1xuICAgIHN3aXRjaCAoYXJnQ291bnQgPT0gbnVsbCA/IDMgOiBhcmdDb3VudCkge1xuICAgICAgY2FzZSAxOiByZXR1cm4gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgICAgY2FzZSAyOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIG90aGVyKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmNhbGwoY29udGV4dCwgdmFsdWUsIG90aGVyKTtcbiAgICAgIH07XG4gICAgICBjYXNlIDM6IHJldHVybiBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xuICAgICAgfTtcbiAgICAgIGNhc2UgNDogcmV0dXJuIGZ1bmN0aW9uKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbChjb250ZXh0LCBhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBBIG1vc3RseS1pbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBjYWxsYmFja3MgdGhhdCBjYW4gYmUgYXBwbGllZFxuICAvLyB0byBlYWNoIGVsZW1lbnQgaW4gYSBjb2xsZWN0aW9uLCByZXR1cm5pbmcgdGhlIGRlc2lyZWQgcmVzdWx0IOKAlCBlaXRoZXJcbiAgLy8gaWRlbnRpdHksIGFuIGFyYml0cmFyeSBjYWxsYmFjaywgYSBwcm9wZXJ0eSBtYXRjaGVyLCBvciBhIHByb3BlcnR5IGFjY2Vzc29yLlxuICBfLml0ZXJhdGVlID0gZnVuY3Rpb24odmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gY3JlYXRlQ2FsbGJhY2sodmFsdWUsIGNvbnRleHQsIGFyZ0NvdW50KTtcbiAgICBpZiAoXy5pc09iamVjdCh2YWx1ZSkpIHJldHVybiBfLm1hdGNoZXModmFsdWUpO1xuICAgIHJldHVybiBfLnByb3BlcnR5KHZhbHVlKTtcbiAgfTtcblxuICAvLyBDb2xsZWN0aW9uIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFRoZSBjb3JuZXJzdG9uZSwgYW4gYGVhY2hgIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIHJhdyBvYmplY3RzIGluIGFkZGl0aW9uIHRvIGFycmF5LWxpa2VzLiBUcmVhdHMgYWxsXG4gIC8vIHNwYXJzZSBhcnJheS1saWtlcyBhcyBpZiB0aGV5IHdlcmUgZGVuc2UuXG4gIF8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBvYmo7XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgdmFyIGksIGxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCA9PT0gK2xlbmd0aCkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZXJhdGVlKG9ialtpXSwgaSwgb2JqKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgIGZvciAoaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaXRlcmF0ZWUob2JqW2tleXNbaV1dLCBrZXlzW2ldLCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0ZWUgdG8gZWFjaCBlbGVtZW50LlxuICBfLm1hcCA9IF8uY29sbGVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBbXTtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gK29iai5sZW5ndGggJiYgXy5rZXlzKG9iaiksXG4gICAgICAgIGxlbmd0aCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICByZXN1bHRzID0gQXJyYXkobGVuZ3RoKSxcbiAgICAgICAgY3VycmVudEtleTtcbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICByZXN1bHRzW2luZGV4XSA9IGl0ZXJhdGVlKG9ialtjdXJyZW50S2V5XSwgY3VycmVudEtleSwgb2JqKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgdmFyIHJlZHVjZUVycm9yID0gJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnO1xuXG4gIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgLy8gb3IgYGZvbGRsYC5cbiAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0LCA0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXggPSAwLCBjdXJyZW50S2V5O1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgaWYgKCFsZW5ndGgpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgICAgbWVtbyA9IG9ialtrZXlzID8ga2V5c1tpbmRleCsrXSA6IGluZGV4KytdO1xuICAgIH1cbiAgICBmb3IgKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGN1cnJlbnRLZXkgPSBrZXlzID8ga2V5c1tpbmRleF0gOiBpbmRleDtcbiAgICAgIG1lbW8gPSBpdGVyYXRlZShtZW1vLCBvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaik7XG4gICAgfVxuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIHJlZHVjZSwgYWxzbyBrbm93biBhcyBgZm9sZHJgLlxuICBfLnJlZHVjZVJpZ2h0ID0gXy5mb2xkciA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0ZWUsIG1lbW8sIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGl0ZXJhdGVlID0gY3JlYXRlQ2FsbGJhY2soaXRlcmF0ZWUsIGNvbnRleHQsIDQpO1xuICAgIHZhciBrZXlzID0gb2JqLmxlbmd0aCAhPT0gKyBvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBpbmRleCA9IChrZXlzIHx8IG9iaikubGVuZ3RoLFxuICAgICAgICBjdXJyZW50S2V5O1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgaWYgKCFpbmRleCkgdGhyb3cgbmV3IFR5cGVFcnJvcihyZWR1Y2VFcnJvcik7XG4gICAgICBtZW1vID0gb2JqW2tleXMgPyBrZXlzWy0taW5kZXhdIDogLS1pbmRleF07XG4gICAgfVxuICAgIHdoaWxlIChpbmRleC0tKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBtZW1vID0gaXRlcmF0ZWUobWVtbywgb2JqW2N1cnJlbnRLZXldLCBjdXJyZW50S2V5LCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuIEFsaWFzZWQgYXMgYGRldGVjdGAuXG4gIF8uZmluZCA9IF8uZGV0ZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICBfLnNvbWUob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChwcmVkaWNhdGUodmFsdWUsIGluZGV4LCBsaXN0KSkge1xuICAgICAgICByZXN1bHQgPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYWxsIHRoZSBlbGVtZW50cyB0aGF0IHBhc3MgYSB0cnV0aCB0ZXN0LlxuICAvLyBBbGlhc2VkIGFzIGBzZWxlY3RgLlxuICBfLmZpbHRlciA9IF8uc2VsZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZSh2YWx1ZSwgaW5kZXgsIGxpc3QpKSByZXN1bHRzLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIF8ucmVqZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIob2JqLCBfLm5lZ2F0ZShfLml0ZXJhdGVlKHByZWRpY2F0ZSkpLCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgd2hldGhlciBhbGwgb2YgdGhlIGVsZW1lbnRzIG1hdGNoIGEgdHJ1dGggdGVzdC5cbiAgLy8gQWxpYXNlZCBhcyBgYWxsYC5cbiAgXy5ldmVyeSA9IF8uYWxsID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIHByZWRpY2F0ZSA9IF8uaXRlcmF0ZWUocHJlZGljYXRlLCBjb250ZXh0KTtcbiAgICB2YXIga2V5cyA9IG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoICYmIF8ua2V5cyhvYmopLFxuICAgICAgICBsZW5ndGggPSAoa2V5cyB8fCBvYmopLmxlbmd0aCxcbiAgICAgICAgaW5kZXgsIGN1cnJlbnRLZXk7XG4gICAgZm9yIChpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjdXJyZW50S2V5ID0ga2V5cyA/IGtleXNbaW5kZXhdIDogaW5kZXg7XG4gICAgICBpZiAoIXByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIGF0IGxlYXN0IG9uZSBlbGVtZW50IGluIHRoZSBvYmplY3QgbWF0Y2hlcyBhIHRydXRoIHRlc3QuXG4gIC8vIEFsaWFzZWQgYXMgYGFueWAuXG4gIF8uc29tZSA9IF8uYW55ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBwcmVkaWNhdGUgPSBfLml0ZXJhdGVlKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgdmFyIGtleXMgPSBvYmoubGVuZ3RoICE9PSArb2JqLmxlbmd0aCAmJiBfLmtleXMob2JqKSxcbiAgICAgICAgbGVuZ3RoID0gKGtleXMgfHwgb2JqKS5sZW5ndGgsXG4gICAgICAgIGluZGV4LCBjdXJyZW50S2V5O1xuICAgIGZvciAoaW5kZXggPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY3VycmVudEtleSA9IGtleXMgPyBrZXlzW2luZGV4XSA6IGluZGV4O1xuICAgICAgaWYgKHByZWRpY2F0ZShvYmpbY3VycmVudEtleV0sIGN1cnJlbnRLZXksIG9iaikpIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiB2YWx1ZSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZSA9IGZ1bmN0aW9uKG9iaiwgdGFyZ2V0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoKSBvYmogPSBfLnZhbHVlcyhvYmopO1xuICAgIHJldHVybiBfLmluZGV4T2Yob2JqLCB0YXJnZXQpID49IDA7XG4gIH07XG5cbiAgLy8gSW52b2tlIGEgbWV0aG9kICh3aXRoIGFyZ3VtZW50cykgb24gZXZlcnkgaXRlbSBpbiBhIGNvbGxlY3Rpb24uXG4gIF8uaW52b2tlID0gZnVuY3Rpb24ob2JqLCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgaXNGdW5jID0gXy5pc0Z1bmN0aW9uKG1ldGhvZCk7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiAoaXNGdW5jID8gbWV0aG9kIDogdmFsdWVbbWV0aG9kXSkuYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gIF8ucGx1Y2sgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIF8ucHJvcGVydHkoa2V5KSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmlsdGVyYDogc2VsZWN0aW5nIG9ubHkgb2JqZWN0c1xuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLndoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbmRgOiBnZXR0aW5nIHRoZSBmaXJzdCBvYmplY3RcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5maW5kV2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmluZChvYmosIF8ubWF0Y2hlcyhhdHRycykpO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5tYXggPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IC1JbmZpbml0eSwgbGFzdENvbXB1dGVkID0gLUluZmluaXR5LFxuICAgICAgICB2YWx1ZSwgY29tcHV0ZWQ7XG4gICAgaWYgKGl0ZXJhdGVlID09IG51bGwgJiYgb2JqICE9IG51bGwpIHtcbiAgICAgIG9iaiA9IG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoID8gb2JqIDogXy52YWx1ZXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBvYmpbaV07XG4gICAgICAgIGlmICh2YWx1ZSA+IHJlc3VsdCkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZXJhdGVlID0gXy5pdGVyYXRlZShpdGVyYXRlZSwgY29udGV4dCk7XG4gICAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgICAgY29tcHV0ZWQgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQgfHwgY29tcHV0ZWQgPT09IC1JbmZpbml0eSAmJiByZXN1bHQgPT09IC1JbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1pbmltdW0gZWxlbWVudCAob3IgZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIF8ubWluID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQgPSBJbmZpbml0eSwgbGFzdENvbXB1dGVkID0gSW5maW5pdHksXG4gICAgICAgIHZhbHVlLCBjb21wdXRlZDtcbiAgICBpZiAoaXRlcmF0ZWUgPT0gbnVsbCAmJiBvYmogIT0gbnVsbCkge1xuICAgICAgb2JqID0gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICB2YWx1ZSA9IG9ialtpXTtcbiAgICAgICAgaWYgKHZhbHVlIDwgcmVzdWx0KSB7XG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIF8uZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgICBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICAgIGlmIChjb21wdXRlZCA8IGxhc3RDb21wdXRlZCB8fCBjb21wdXRlZCA9PT0gSW5maW5pdHkgJiYgcmVzdWx0ID09PSBJbmZpbml0eSkge1xuICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBTaHVmZmxlIGEgY29sbGVjdGlvbiwgdXNpbmcgdGhlIG1vZGVybiB2ZXJzaW9uIG9mIHRoZVxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVy4oCTWWF0ZXNfc2h1ZmZsZSkuXG4gIF8uc2h1ZmZsZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBzZXQgPSBvYmogJiYgb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmogOiBfLnZhbHVlcyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBzZXQubGVuZ3RoO1xuICAgIHZhciBzaHVmZmxlZCA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaW5kZXggPSAwLCByYW5kOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgcmFuZCA9IF8ucmFuZG9tKDAsIGluZGV4KTtcbiAgICAgIGlmIChyYW5kICE9PSBpbmRleCkgc2h1ZmZsZWRbaW5kZXhdID0gc2h1ZmZsZWRbcmFuZF07XG4gICAgICBzaHVmZmxlZFtyYW5kXSA9IHNldFtpbmRleF07XG4gICAgfVxuICAgIHJldHVybiBzaHVmZmxlZDtcbiAgfTtcblxuICAvLyBTYW1wbGUgKipuKiogcmFuZG9tIHZhbHVlcyBmcm9tIGEgY29sbGVjdGlvbi5cbiAgLy8gSWYgKipuKiogaXMgbm90IHNwZWNpZmllZCwgcmV0dXJucyBhIHNpbmdsZSByYW5kb20gZWxlbWVudC5cbiAgLy8gVGhlIGludGVybmFsIGBndWFyZGAgYXJndW1lbnQgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgbWFwYC5cbiAgXy5zYW1wbGUgPSBmdW5jdGlvbihvYmosIG4sIGd1YXJkKSB7XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xuICAgICAgaWYgKG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoKSBvYmogPSBfLnZhbHVlcyhvYmopO1xuICAgICAgcmV0dXJuIG9ialtfLnJhbmRvbShvYmoubGVuZ3RoIC0gMSldO1xuICAgIH1cbiAgICByZXR1cm4gXy5zaHVmZmxlKG9iaikuc2xpY2UoMCwgTWF0aC5tYXgoMCwgbikpO1xuICB9O1xuXG4gIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRlZS5cbiAgXy5zb3J0QnkgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIGNyaXRlcmlhOiBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdXNlZCBmb3IgYWdncmVnYXRlIFwiZ3JvdXAgYnlcIiBvcGVyYXRpb25zLlxuICB2YXIgZ3JvdXAgPSBmdW5jdGlvbihiZWhhdmlvcikge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQpO1xuICAgICAgXy5lYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBrZXkgPSBpdGVyYXRlZSh2YWx1ZSwgaW5kZXgsIG9iaik7XG4gICAgICAgIGJlaGF2aW9yKHJlc3VsdCwgdmFsdWUsIGtleSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBHcm91cHMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbi4gUGFzcyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlXG4gIC8vIHRvIGdyb3VwIGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY3JpdGVyaW9uLlxuICBfLmdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICBpZiAoXy5oYXMocmVzdWx0LCBrZXkpKSByZXN1bHRba2V5XS5wdXNoKHZhbHVlKTsgZWxzZSByZXN1bHRba2V5XSA9IFt2YWx1ZV07XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgZ3JvdXBCeWAsIGJ1dCBmb3JcbiAgLy8gd2hlbiB5b3Uga25vdyB0aGF0IHlvdXIgaW5kZXggdmFsdWVzIHdpbGwgYmUgdW5pcXVlLlxuICBfLmluZGV4QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIHZhbHVlLCBrZXkpIHtcbiAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICB9KTtcblxuICAvLyBDb3VudHMgaW5zdGFuY2VzIG9mIGFuIG9iamVjdCB0aGF0IGdyb3VwIGJ5IGEgY2VydGFpbiBjcml0ZXJpb24uIFBhc3NcbiAgLy8gZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZSB0byBjb3VudCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlXG4gIC8vIGNyaXRlcmlvbi5cbiAgXy5jb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XG4gICAgaWYgKF8uaGFzKHJlc3VsdCwga2V5KSkgcmVzdWx0W2tleV0rKzsgZWxzZSByZXN1bHRba2V5XSA9IDE7XG4gIH0pO1xuXG4gIC8vIFVzZSBhIGNvbXBhcmF0b3IgZnVuY3Rpb24gdG8gZmlndXJlIG91dCB0aGUgc21hbGxlc3QgaW5kZXggYXQgd2hpY2hcbiAgLy8gYW4gb2JqZWN0IHNob3VsZCBiZSBpbnNlcnRlZCBzbyBhcyB0byBtYWludGFpbiBvcmRlci4gVXNlcyBiaW5hcnkgc2VhcmNoLlxuICBfLnNvcnRlZEluZGV4ID0gZnVuY3Rpb24oYXJyYXksIG9iaiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRlZSA9IF8uaXRlcmF0ZWUoaXRlcmF0ZWUsIGNvbnRleHQsIDEpO1xuICAgIHZhciB2YWx1ZSA9IGl0ZXJhdGVlKG9iaik7XG4gICAgdmFyIGxvdyA9IDAsIGhpZ2ggPSBhcnJheS5sZW5ndGg7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSBsb3cgKyBoaWdoID4+PiAxO1xuICAgICAgaWYgKGl0ZXJhdGVlKGFycmF5W21pZF0pIDwgdmFsdWUpIGxvdyA9IG1pZCArIDE7IGVsc2UgaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfTtcblxuICAvLyBTYWZlbHkgY3JlYXRlIGEgcmVhbCwgbGl2ZSBhcnJheSBmcm9tIGFueXRoaW5nIGl0ZXJhYmxlLlxuICBfLnRvQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIW9iaikgcmV0dXJuIFtdO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHJldHVybiBfLm1hcChvYmosIF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBfLnZhbHVlcyhvYmopO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGFuIG9iamVjdC5cbiAgXy5zaXplID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICByZXR1cm4gb2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGggPyBvYmoubGVuZ3RoIDogXy5rZXlzKG9iaikubGVuZ3RoO1xuICB9O1xuXG4gIC8vIFNwbGl0IGEgY29sbGVjdGlvbiBpbnRvIHR3byBhcnJheXM6IG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgc2F0aXNmeSB0aGUgZ2l2ZW5cbiAgLy8gcHJlZGljYXRlLCBhbmQgb25lIHdob3NlIGVsZW1lbnRzIGFsbCBkbyBub3Qgc2F0aXNmeSB0aGUgcHJlZGljYXRlLlxuICBfLnBhcnRpdGlvbiA9IGZ1bmN0aW9uKG9iaiwgcHJlZGljYXRlLCBjb250ZXh0KSB7XG4gICAgcHJlZGljYXRlID0gXy5pdGVyYXRlZShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIHZhciBwYXNzID0gW10sIGZhaWwgPSBbXTtcbiAgICBfLmVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBvYmopIHtcbiAgICAgIChwcmVkaWNhdGUodmFsdWUsIGtleSwgb2JqKSA/IHBhc3MgOiBmYWlsKS5wdXNoKHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gW3Bhc3MsIGZhaWxdO1xuICB9O1xuXG4gIC8vIEFycmF5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS1cblxuICAvLyBHZXQgdGhlIGZpcnN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGZpcnN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgaGVhZGAgYW5kIGB0YWtlYC4gVGhlICoqZ3VhcmQqKiBjaGVja1xuICAvLyBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8uZmlyc3QgPSBfLmhlYWQgPSBfLnRha2UgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbMF07XG4gICAgaWYgKG4gPCAwKSByZXR1cm4gW107XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGxhc3QgZW50cnkgb2YgdGhlIGFycmF5LiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiBhbGwgdGhlIHZhbHVlcyBpblxuICAvLyB0aGUgYXJyYXksIGV4Y2x1ZGluZyB0aGUgbGFzdCBOLiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGhcbiAgLy8gYF8ubWFwYC5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIE1hdGgubWF4KDAsIGFycmF5Lmxlbmd0aCAtIChuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbikpKTtcbiAgfTtcblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmxhc3QgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAobiA9PSBudWxsIHx8IGd1YXJkKSByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIE1hdGgubWF4KGFycmF5Lmxlbmd0aCAtIG4sIDApKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGV2ZXJ5dGhpbmcgYnV0IHRoZSBmaXJzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEFsaWFzZWQgYXMgYHRhaWxgIGFuZCBgZHJvcGAuXG4gIC8vIEVzcGVjaWFsbHkgdXNlZnVsIG9uIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nIGFuICoqbioqIHdpbGwgcmV0dXJuXG4gIC8vIHRoZSByZXN0IE4gdmFsdWVzIGluIHRoZSBhcnJheS4gVGhlICoqZ3VhcmQqKlxuICAvLyBjaGVjayBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8ucmVzdCA9IF8udGFpbCA9IF8uZHJvcCA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBuID09IG51bGwgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH07XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBfLmNvbXBhY3QgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgXy5pZGVudGl0eSk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgYSByZWN1cnNpdmUgYGZsYXR0ZW5gIGZ1bmN0aW9uLlxuICB2YXIgZmxhdHRlbiA9IGZ1bmN0aW9uKGlucHV0LCBzaGFsbG93LCBzdHJpY3QsIG91dHB1dCkge1xuICAgIGlmIChzaGFsbG93ICYmIF8uZXZlcnkoaW5wdXQsIF8uaXNBcnJheSkpIHtcbiAgICAgIHJldHVybiBjb25jYXQuYXBwbHkob3V0cHV0LCBpbnB1dCk7XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBpbnB1dC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHZhbHVlID0gaW5wdXRbaV07XG4gICAgICBpZiAoIV8uaXNBcnJheSh2YWx1ZSkgJiYgIV8uaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICAgIGlmICghc3RyaWN0KSBvdXRwdXQucHVzaCh2YWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHNoYWxsb3cpIHtcbiAgICAgICAgcHVzaC5hcHBseShvdXRwdXQsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZsYXR0ZW4odmFsdWUsIHNoYWxsb3csIHN0cmljdCwgb3V0cHV0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfTtcblxuICAvLyBGbGF0dGVuIG91dCBhbiBhcnJheSwgZWl0aGVyIHJlY3Vyc2l2ZWx5IChieSBkZWZhdWx0KSwgb3IganVzdCBvbmUgbGV2ZWwuXG4gIF8uZmxhdHRlbiA9IGZ1bmN0aW9uKGFycmF5LCBzaGFsbG93KSB7XG4gICAgcmV0dXJuIGZsYXR0ZW4oYXJyYXksIHNoYWxsb3csIGZhbHNlLCBbXSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIF8ud2l0aG91dCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZGlmZmVyZW5jZShhcnJheSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIEFsaWFzZWQgYXMgYHVuaXF1ZWAuXG4gIF8udW5pcSA9IF8udW5pcXVlID0gZnVuY3Rpb24oYXJyYXksIGlzU29ydGVkLCBpdGVyYXRlZSwgY29udGV4dCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gW107XG4gICAgaWYgKCFfLmlzQm9vbGVhbihpc1NvcnRlZCkpIHtcbiAgICAgIGNvbnRleHQgPSBpdGVyYXRlZTtcbiAgICAgIGl0ZXJhdGVlID0gaXNTb3J0ZWQ7XG4gICAgICBpc1NvcnRlZCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoaXRlcmF0ZWUgIT0gbnVsbCkgaXRlcmF0ZWUgPSBfLml0ZXJhdGVlKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIHNlZW4gPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2ldO1xuICAgICAgaWYgKGlzU29ydGVkKSB7XG4gICAgICAgIGlmICghaSB8fCBzZWVuICE9PSB2YWx1ZSkgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICBzZWVuID0gdmFsdWU7XG4gICAgICB9IGVsc2UgaWYgKGl0ZXJhdGVlKSB7XG4gICAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdGVlKHZhbHVlLCBpLCBhcnJheSk7XG4gICAgICAgIGlmIChfLmluZGV4T2Yoc2VlbiwgY29tcHV0ZWQpIDwgMCkge1xuICAgICAgICAgIHNlZW4ucHVzaChjb21wdXRlZCk7XG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKF8uaW5kZXhPZihyZXN1bHQsIHZhbHVlKSA8IDApIHtcbiAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgXy51bmlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLnVuaXEoZmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUsIFtdKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIGV2ZXJ5IGl0ZW0gc2hhcmVkIGJldHdlZW4gYWxsIHRoZVxuICAvLyBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiBbXTtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgdmFyIGFyZ3NMZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGl0ZW0gPSBhcnJheVtpXTtcbiAgICAgIGlmIChfLmNvbnRhaW5zKHJlc3VsdCwgaXRlbSkpIGNvbnRpbnVlO1xuICAgICAgZm9yICh2YXIgaiA9IDE7IGogPCBhcmdzTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKCFfLmNvbnRhaW5zKGFyZ3VtZW50c1tqXSwgaXRlbSkpIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGogPT09IGFyZ3NMZW5ndGgpIHJlc3VsdC5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFRha2UgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiBvbmUgYXJyYXkgYW5kIGEgbnVtYmVyIG9mIG90aGVyIGFycmF5cy5cbiAgLy8gT25seSB0aGUgZWxlbWVudHMgcHJlc2VudCBpbiBqdXN0IHRoZSBmaXJzdCBhcnJheSB3aWxsIHJlbWFpbi5cbiAgXy5kaWZmZXJlbmNlID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdCA9IGZsYXR0ZW4oc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLCB0cnVlLCB0cnVlLCBbXSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICByZXR1cm4gIV8uY29udGFpbnMocmVzdCwgdmFsdWUpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIFppcCB0b2dldGhlciBtdWx0aXBsZSBsaXN0cyBpbnRvIGEgc2luZ2xlIGFycmF5IC0tIGVsZW1lbnRzIHRoYXQgc2hhcmVcbiAgLy8gYW4gaW5kZXggZ28gdG9nZXRoZXIuXG4gIF8uemlwID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIFtdO1xuICAgIHZhciBsZW5ndGggPSBfLm1heChhcmd1bWVudHMsICdsZW5ndGgnKS5sZW5ndGg7XG4gICAgdmFyIHJlc3VsdHMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICBpZiAobGlzdCA9PSBudWxsKSByZXR1cm4ge307XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBhbiBpdGVtIGluIGFuIGFycmF5LFxuICAvLyBvciAtMSBpZiB0aGUgaXRlbSBpcyBub3QgaW5jbHVkZWQgaW4gdGhlIGFycmF5LlxuICAvLyBJZiB0aGUgYXJyYXkgaXMgbGFyZ2UgYW5kIGFscmVhZHkgaW4gc29ydCBvcmRlciwgcGFzcyBgdHJ1ZWBcbiAgLy8gZm9yICoqaXNTb3J0ZWQqKiB0byB1c2UgYmluYXJ5IHNlYXJjaC5cbiAgXy5pbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGlzU29ydGVkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ251bWJlcicpIHtcbiAgICAgICAgaSA9IGlzU29ydGVkIDwgMCA/IE1hdGgubWF4KDAsIGxlbmd0aCArIGlzU29ydGVkKSA6IGlzU29ydGVkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaSA9IF8uc29ydGVkSW5kZXgoYXJyYXksIGl0ZW0pO1xuICAgICAgICByZXR1cm4gYXJyYXlbaV0gPT09IGl0ZW0gPyBpIDogLTE7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIF8ubGFzdEluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgZnJvbSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGlkeCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAodHlwZW9mIGZyb20gPT0gJ251bWJlcicpIHtcbiAgICAgIGlkeCA9IGZyb20gPCAwID8gaWR4ICsgZnJvbSArIDEgOiBNYXRoLm1pbihpZHgsIGZyb20gKyAxKTtcbiAgICB9XG4gICAgd2hpbGUgKC0taWR4ID49IDApIGlmIChhcnJheVtpZHhdID09PSBpdGVtKSByZXR1cm4gaWR4O1xuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhbiBpbnRlZ2VyIEFycmF5IGNvbnRhaW5pbmcgYW4gYXJpdGhtZXRpYyBwcm9ncmVzc2lvbi4gQSBwb3J0IG9mXG4gIC8vIHRoZSBuYXRpdmUgUHl0aG9uIGByYW5nZSgpYCBmdW5jdGlvbi4gU2VlXG4gIC8vIFt0aGUgUHl0aG9uIGRvY3VtZW50YXRpb25dKGh0dHA6Ly9kb2NzLnB5dGhvbi5vcmcvbGlicmFyeS9mdW5jdGlvbnMuaHRtbCNyYW5nZSkuXG4gIF8ucmFuZ2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc3RlcCkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDw9IDEpIHtcbiAgICAgIHN0b3AgPSBzdGFydCB8fCAwO1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH1cbiAgICBzdGVwID0gc3RlcCB8fCAxO1xuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgcmFuZ2UgPSBBcnJheShsZW5ndGgpO1xuXG4gICAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgbGVuZ3RoOyBpZHgrKywgc3RhcnQgKz0gc3RlcCkge1xuICAgICAgcmFuZ2VbaWR4XSA9IHN0YXJ0O1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfTtcblxuICAvLyBGdW5jdGlvbiAoYWhlbSkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldXNhYmxlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciBwcm90b3R5cGUgc2V0dGluZy5cbiAgdmFyIEN0b3IgPSBmdW5jdGlvbigpe307XG5cbiAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgLy8gYXZhaWxhYmxlLlxuICBfLmJpbmQgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQmluZCBtdXN0IGJlIGNhbGxlZCBvbiBhIGZ1bmN0aW9uJyk7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBDdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgdmFyIHNlbGYgPSBuZXcgQ3RvcjtcbiAgICAgIEN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgaWYgKF8uaXNPYmplY3QocmVzdWx0KSkgcmV0dXJuIHJlc3VsdDtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG4gICAgcmV0dXJuIGJvdW5kO1xuICB9O1xuXG4gIC8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbiAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuIF8gYWN0c1xuICAvLyBhcyBhIHBsYWNlaG9sZGVyLCBhbGxvd2luZyBhbnkgY29tYmluYXRpb24gb2YgYXJndW1lbnRzIHRvIGJlIHByZS1maWxsZWQuXG4gIF8ucGFydGlhbCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgYm91bmRBcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBwb3NpdGlvbiA9IDA7XG4gICAgICB2YXIgYXJncyA9IGJvdW5kQXJncy5zbGljZSgpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGFyZ3MubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGFyZ3NbaV0gPT09IF8pIGFyZ3NbaV0gPSBhcmd1bWVudHNbcG9zaXRpb24rK107XG4gICAgICB9XG4gICAgICB3aGlsZSAocG9zaXRpb24gPCBhcmd1bWVudHMubGVuZ3RoKSBhcmdzLnB1c2goYXJndW1lbnRzW3Bvc2l0aW9uKytdKTtcbiAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gQmluZCBhIG51bWJlciBvZiBhbiBvYmplY3QncyBtZXRob2RzIHRvIHRoYXQgb2JqZWN0LiBSZW1haW5pbmcgYXJndW1lbnRzXG4gIC8vIGFyZSB0aGUgbWV0aG9kIG5hbWVzIHRvIGJlIGJvdW5kLiBVc2VmdWwgZm9yIGVuc3VyaW5nIHRoYXQgYWxsIGNhbGxiYWNrc1xuICAvLyBkZWZpbmVkIG9uIGFuIG9iamVjdCBiZWxvbmcgdG8gaXQuXG4gIF8uYmluZEFsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBpLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoLCBrZXk7XG4gICAgaWYgKGxlbmd0aCA8PSAxKSB0aHJvdyBuZXcgRXJyb3IoJ2JpbmRBbGwgbXVzdCBiZSBwYXNzZWQgZnVuY3Rpb24gbmFtZXMnKTtcbiAgICBmb3IgKGkgPSAxOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGtleSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgIG9ialtrZXldID0gXy5iaW5kKG9ialtrZXldLCBvYmopO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIF8ubWVtb2l6ZSA9IGZ1bmN0aW9uKGZ1bmMsIGhhc2hlcikge1xuICAgIHZhciBtZW1vaXplID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICB2YXIgY2FjaGUgPSBtZW1vaXplLmNhY2hlO1xuICAgICAgdmFyIGFkZHJlc3MgPSBoYXNoZXIgPyBoYXNoZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKSA6IGtleTtcbiAgICAgIGlmICghXy5oYXMoY2FjaGUsIGFkZHJlc3MpKSBjYWNoZVthZGRyZXNzXSA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiBjYWNoZVthZGRyZXNzXTtcbiAgICB9O1xuICAgIG1lbW9pemUuY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gbWVtb2l6ZTtcbiAgfTtcblxuICAvLyBEZWxheXMgYSBmdW5jdGlvbiBmb3IgdGhlIGdpdmVuIG51bWJlciBvZiBtaWxsaXNlY29uZHMsIGFuZCB0aGVuIGNhbGxzXG4gIC8vIGl0IHdpdGggdGhlIGFyZ3VtZW50cyBzdXBwbGllZC5cbiAgXy5kZWxheSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJncyk7XG4gICAgfSwgd2FpdCk7XG4gIH07XG5cbiAgLy8gRGVmZXJzIGEgZnVuY3Rpb24sIHNjaGVkdWxpbmcgaXQgdG8gcnVuIGFmdGVyIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzXG4gIC8vIGNsZWFyZWQuXG4gIF8uZGVmZXIgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgcmV0dXJuIF8uZGVsYXkuYXBwbHkoXywgW2Z1bmMsIDFdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIHdoZW4gaW52b2tlZCwgd2lsbCBvbmx5IGJlIHRyaWdnZXJlZCBhdCBtb3N0IG9uY2VcbiAgLy8gZHVyaW5nIGEgZ2l2ZW4gd2luZG93IG9mIHRpbWUuIE5vcm1hbGx5LCB0aGUgdGhyb3R0bGVkIGZ1bmN0aW9uIHdpbGwgcnVuXG4gIC8vIGFzIG11Y2ggYXMgaXQgY2FuLCB3aXRob3V0IGV2ZXIgZ29pbmcgbW9yZSB0aGFuIG9uY2UgcGVyIGB3YWl0YCBkdXJhdGlvbjtcbiAgLy8gYnV0IGlmIHlvdSdkIGxpa2UgdG8gZGlzYWJsZSB0aGUgZXhlY3V0aW9uIG9uIHRoZSBsZWFkaW5nIGVkZ2UsIHBhc3NcbiAgLy8gYHtsZWFkaW5nOiBmYWxzZX1gLiBUbyBkaXNhYmxlIGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSwgZGl0dG8uXG4gIF8udGhyb3R0bGUgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBvcHRpb25zKSB7XG4gICAgdmFyIGNvbnRleHQsIGFyZ3MsIHJlc3VsdDtcbiAgICB2YXIgdGltZW91dCA9IG51bGw7XG4gICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBfLm5vdygpO1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gXy5ub3coKTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDAgfHwgcmVtYWluaW5nID4gd2FpdCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBwcmV2aW91cyA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAgLy8gYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICAvLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbiAgLy8gbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy5cbiAgXy5kZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcblxuICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGxhc3QgPSBfLm5vdygpIC0gdGltZXN0YW1wO1xuXG4gICAgICBpZiAobGFzdCA8IHdhaXQgJiYgbGFzdCA+IDApIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBpZiAoIWltbWVkaWF0ZSkge1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGltZXN0YW1wID0gXy5ub3coKTtcbiAgICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgICAgaWYgKCF0aW1lb3V0KSB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICBpZiAoY2FsbE5vdykge1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXNzZWQgYXMgYW4gYXJndW1lbnQgdG8gdGhlIHNlY29uZCxcbiAgLy8gYWxsb3dpbmcgeW91IHRvIGFkanVzdCBhcmd1bWVudHMsIHJ1biBjb2RlIGJlZm9yZSBhbmQgYWZ0ZXIsIGFuZFxuICAvLyBjb25kaXRpb25hbGx5IGV4ZWN1dGUgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uLlxuICBfLndyYXAgPSBmdW5jdGlvbihmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIF8ucGFydGlhbCh3cmFwcGVyLCBmdW5jKTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgbmVnYXRlZCB2ZXJzaW9uIG9mIHRoZSBwYXNzZWQtaW4gcHJlZGljYXRlLlxuICBfLm5lZ2F0ZSA9IGZ1bmN0aW9uKHByZWRpY2F0ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAhcHJlZGljYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBpcyB0aGUgY29tcG9zaXRpb24gb2YgYSBsaXN0IG9mIGZ1bmN0aW9ucywgZWFjaFxuICAvLyBjb25zdW1pbmcgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBmb2xsb3dzLlxuICBfLmNvbXBvc2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICB2YXIgc3RhcnQgPSBhcmdzLmxlbmd0aCAtIDE7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGkgPSBzdGFydDtcbiAgICAgIHZhciByZXN1bHQgPSBhcmdzW3N0YXJ0XS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgd2hpbGUgKGktLSkgcmVzdWx0ID0gYXJnc1tpXS5jYWxsKHRoaXMsIHJlc3VsdCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGFmdGVyIGJlaW5nIGNhbGxlZCBOIHRpbWVzLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCBiZWZvcmUgYmVpbmcgY2FsbGVkIE4gdGltZXMuXG4gIF8uYmVmb3JlID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICB2YXIgbWVtbztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA+IDApIHtcbiAgICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bmMgPSBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIGF0IG1vc3Qgb25lIHRpbWUsIG5vIG1hdHRlciBob3dcbiAgLy8gb2Z0ZW4geW91IGNhbGwgaXQuIFVzZWZ1bCBmb3IgbGF6eSBpbml0aWFsaXphdGlvbi5cbiAgXy5vbmNlID0gXy5wYXJ0aWFsKF8uYmVmb3JlLCAyKTtcblxuICAvLyBPYmplY3QgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXRyaWV2ZSB0aGUgbmFtZXMgb2YgYW4gb2JqZWN0J3MgcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYFxuICBfLmtleXMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIFtdO1xuICAgIGlmIChuYXRpdmVLZXlzKSByZXR1cm4gbmF0aXZlS2V5cyhvYmopO1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBfLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciB2YWx1ZXMgPSBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlc1tpXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xuICB9O1xuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgXy5pbnZlcnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0W29ialtrZXlzW2ldXV0gPSBrZXlzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgLy8gQWxpYXNlZCBhcyBgbWV0aG9kc2BcbiAgXy5mdW5jdGlvbnMgPSBfLm1ldGhvZHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoXy5pc0Z1bmN0aW9uKG9ialtrZXldKSkgbmFtZXMucHVzaChrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZXMuc29ydCgpO1xuICB9O1xuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICBfLmV4dGVuZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHZhciBzb3VyY2UsIHByb3A7XG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbmd0aCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgc291cmNlID0gYXJndW1lbnRzW2ldO1xuICAgICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIHByb3ApKSB7XG4gICAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9LCBrZXk7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChfLmlzRnVuY3Rpb24oaXRlcmF0ZWUpKSB7XG4gICAgICBpdGVyYXRlZSA9IGNyZWF0ZUNhbGxiYWNrKGl0ZXJhdGVlLCBjb250ZXh0KTtcbiAgICAgIGZvciAoa2V5IGluIG9iaikge1xuICAgICAgICB2YXIgdmFsdWUgPSBvYmpba2V5XTtcbiAgICAgICAgaWYgKGl0ZXJhdGVlKHZhbHVlLCBrZXksIG9iaikpIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KFtdLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgICAgb2JqID0gbmV3IE9iamVjdChvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgaWYgKGtleSBpbiBvYmopIHJlc3VsdFtrZXldID0gb2JqW2tleV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCB3aXRob3V0IHRoZSBibGFja2xpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLm9taXQgPSBmdW5jdGlvbihvYmosIGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihpdGVyYXRlZSkpIHtcbiAgICAgIGl0ZXJhdGVlID0gXy5uZWdhdGUoaXRlcmF0ZWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ubWFwKGNvbmNhdC5hcHBseShbXSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSwgU3RyaW5nKTtcbiAgICAgIGl0ZXJhdGVlID0gZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICByZXR1cm4gIV8uY29udGFpbnMoa2V5cywga2V5KTtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBfLnBpY2sob2JqLCBpdGVyYXRlZSwgY29udGV4dCk7XG4gIH07XG5cbiAgLy8gRmlsbCBpbiBhIGdpdmVuIG9iamVjdCB3aXRoIGRlZmF1bHQgcHJvcGVydGllcy5cbiAgXy5kZWZhdWx0cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIGZvciAodmFyIGkgPSAxLCBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICBpZiAob2JqW3Byb3BdID09PSB2b2lkIDApIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBDcmVhdGUgYSAoc2hhbGxvdy1jbG9uZWQpIGR1cGxpY2F0ZSBvZiBhbiBvYmplY3QuXG4gIF8uY2xvbmUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICByZXR1cm4gXy5pc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IF8uZXh0ZW5kKHt9LCBvYmopO1xuICB9O1xuXG4gIC8vIEludm9rZXMgaW50ZXJjZXB0b3Igd2l0aCB0aGUgb2JqLCBhbmQgdGhlbiByZXR1cm5zIG9iai5cbiAgLy8gVGhlIHByaW1hcnkgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sIGluXG4gIC8vIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICBfLnRhcCA9IGZ1bmN0aW9uKG9iaiwgaW50ZXJjZXB0b3IpIHtcbiAgICBpbnRlcmNlcHRvcihvYmopO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgcmVjdXJzaXZlIGNvbXBhcmlzb24gZnVuY3Rpb24gZm9yIGBpc0VxdWFsYC5cbiAgdmFyIGVxID0gZnVuY3Rpb24oYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbCkuXG4gICAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09PSAxIC8gYjtcbiAgICAvLyBBIHN0cmljdCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGBudWxsID09IHVuZGVmaW5lZGAuXG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBhID09PSBiO1xuICAgIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAgIGlmIChhIGluc3RhbmNlb2YgXykgYSA9IGEuX3dyYXBwZWQ7XG4gICAgaWYgKGIgaW5zdGFuY2VvZiBfKSBiID0gYi5fd3JhcHBlZDtcbiAgICAvLyBDb21wYXJlIGBbW0NsYXNzXV1gIG5hbWVzLlxuICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKGEpO1xuICAgIGlmIChjbGFzc05hbWUgIT09IHRvU3RyaW5nLmNhbGwoYikpIHJldHVybiBmYWxzZTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gU3RyaW5ncywgbnVtYmVycywgcmVndWxhciBleHByZXNzaW9ucywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgICBjYXNlICdbb2JqZWN0IFJlZ0V4cF0nOlxuICAgICAgLy8gUmVnRXhwcyBhcmUgY29lcmNlZCB0byBzdHJpbmdzIGZvciBjb21wYXJpc29uIChOb3RlOiAnJyArIC9hL2kgPT09ICcvYS9pJylcbiAgICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gYG5ldyBTdHJpbmcoXCI1XCIpYC5cbiAgICAgICAgcmV0dXJuICcnICsgYSA9PT0gJycgKyBiO1xuICAgICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgICAgLy8gYE5hTmBzIGFyZSBlcXVpdmFsZW50LCBidXQgbm9uLXJlZmxleGl2ZS5cbiAgICAgICAgLy8gT2JqZWN0KE5hTikgaXMgZXF1aXZhbGVudCB0byBOYU5cbiAgICAgICAgaWYgKCthICE9PSArYSkgcmV0dXJuICtiICE9PSArYjtcbiAgICAgICAgLy8gQW4gYGVnYWxgIGNvbXBhcmlzb24gaXMgcGVyZm9ybWVkIGZvciBvdGhlciBudW1lcmljIHZhbHVlcy5cbiAgICAgICAgcmV0dXJuICthID09PSAwID8gMSAvICthID09PSAxIC8gYiA6ICthID09PSArYjtcbiAgICAgIGNhc2UgJ1tvYmplY3QgRGF0ZV0nOlxuICAgICAgY2FzZSAnW29iamVjdCBCb29sZWFuXSc6XG4gICAgICAgIC8vIENvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtZXJpYyBwcmltaXRpdmUgdmFsdWVzLiBEYXRlcyBhcmUgY29tcGFyZWQgYnkgdGhlaXJcbiAgICAgICAgLy8gbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zLiBOb3RlIHRoYXQgaW52YWxpZCBkYXRlcyB3aXRoIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9uc1xuICAgICAgICAvLyBvZiBgTmFOYCBhcmUgbm90IGVxdWl2YWxlbnQuXG4gICAgICAgIHJldHVybiArYSA9PT0gK2I7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSAhPSAnb2JqZWN0JyB8fCB0eXBlb2YgYiAhPSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIEFzc3VtZSBlcXVhbGl0eSBmb3IgY3ljbGljIHN0cnVjdHVyZXMuIFRoZSBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBjeWNsaWNcbiAgICAvLyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjEgc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYC5cbiAgICB2YXIgbGVuZ3RoID0gYVN0YWNrLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIC8vIExpbmVhciBzZWFyY2guIFBlcmZvcm1hbmNlIGlzIGludmVyc2VseSBwcm9wb3J0aW9uYWwgdG8gdGhlIG51bWJlciBvZlxuICAgICAgLy8gdW5pcXVlIG5lc3RlZCBzdHJ1Y3R1cmVzLlxuICAgICAgaWYgKGFTdGFja1tsZW5ndGhdID09PSBhKSByZXR1cm4gYlN0YWNrW2xlbmd0aF0gPT09IGI7XG4gICAgfVxuICAgIC8vIE9iamVjdHMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1aXZhbGVudCwgYnV0IGBPYmplY3Rgc1xuICAgIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgIGlmIChcbiAgICAgIGFDdG9yICE9PSBiQ3RvciAmJlxuICAgICAgLy8gSGFuZGxlIE9iamVjdC5jcmVhdGUoeCkgY2FzZXNcbiAgICAgICdjb25zdHJ1Y3RvcicgaW4gYSAmJiAnY29uc3RydWN0b3InIGluIGIgJiZcbiAgICAgICEoXy5pc0Z1bmN0aW9uKGFDdG9yKSAmJiBhQ3RvciBpbnN0YW5jZW9mIGFDdG9yICYmXG4gICAgICAgIF8uaXNGdW5jdGlvbihiQ3RvcikgJiYgYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcilcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gQWRkIHRoZSBmaXJzdCBvYmplY3QgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wdXNoKGEpO1xuICAgIGJTdGFjay5wdXNoKGIpO1xuICAgIHZhciBzaXplLCByZXN1bHQ7XG4gICAgLy8gUmVjdXJzaXZlbHkgY29tcGFyZSBvYmplY3RzIGFuZCBhcnJheXMuXG4gICAgaWYgKGNsYXNzTmFtZSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgLy8gQ29tcGFyZSBhcnJheSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkuXG4gICAgICBzaXplID0gYS5sZW5ndGg7XG4gICAgICByZXN1bHQgPSBzaXplID09PSBiLmxlbmd0aDtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgLy8gRGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllcy5cbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGVxKGFbc2l6ZV0sIGJbc2l6ZV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgdmFyIGtleXMgPSBfLmtleXMoYSksIGtleTtcbiAgICAgIHNpemUgPSBrZXlzLmxlbmd0aDtcbiAgICAgIC8vIEVuc3VyZSB0aGF0IGJvdGggb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzIGJlZm9yZSBjb21wYXJpbmcgZGVlcCBlcXVhbGl0eS5cbiAgICAgIHJlc3VsdCA9IF8ua2V5cyhiKS5sZW5ndGggPT09IHNpemU7XG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHdoaWxlIChzaXplLS0pIHtcbiAgICAgICAgICAvLyBEZWVwIGNvbXBhcmUgZWFjaCBtZW1iZXJcbiAgICAgICAgICBrZXkgPSBrZXlzW3NpemVdO1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IF8uaGFzKGIsIGtleSkgJiYgZXEoYVtrZXldLCBiW2tleV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFJlbW92ZSB0aGUgZmlyc3Qgb2JqZWN0IGZyb20gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wb3AoKTtcbiAgICBiU3RhY2sucG9wKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBQZXJmb3JtIGEgZGVlcCBjb21wYXJpc29uIHRvIGNoZWNrIGlmIHR3byBvYmplY3RzIGFyZSBlcXVhbC5cbiAgXy5pc0VxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiLCBbXSwgW10pO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gYXJyYXksIHN0cmluZywgb3Igb2JqZWN0IGVtcHR5P1xuICAvLyBBbiBcImVtcHR5XCIgb2JqZWN0IGhhcyBubyBlbnVtZXJhYmxlIG93bi1wcm9wZXJ0aWVzLlxuICBfLmlzRW1wdHkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSB8fCBfLmlzU3RyaW5nKG9iaikgfHwgXy5pc0FyZ3VtZW50cyhvYmopKSByZXR1cm4gb2JqLmxlbmd0aCA9PT0gMDtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBfLmlzRWxlbWVudCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiAhIShvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgQXJyYXkuaXNBcnJheVxuICBfLmlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSBhbiBvYmplY3Q/XG4gIF8uaXNPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBvYmo7XG4gICAgcmV0dXJuIHR5cGUgPT09ICdmdW5jdGlvbicgfHwgdHlwZSA9PT0gJ29iamVjdCcgJiYgISFvYmo7XG4gIH07XG5cbiAgLy8gQWRkIHNvbWUgaXNUeXBlIG1ldGhvZHM6IGlzQXJndW1lbnRzLCBpc0Z1bmN0aW9uLCBpc1N0cmluZywgaXNOdW1iZXIsIGlzRGF0ZSwgaXNSZWdFeHAuXG4gIF8uZWFjaChbJ0FyZ3VtZW50cycsICdGdW5jdGlvbicsICdTdHJpbmcnLCAnTnVtYmVyJywgJ0RhdGUnLCAnUmVnRXhwJ10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBfWydpcycgKyBuYW1lXSA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRGVmaW5lIGEgZmFsbGJhY2sgdmVyc2lvbiBvZiB0aGUgbWV0aG9kIGluIGJyb3dzZXJzIChhaGVtLCBJRSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIGlmICghXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpKSB7XG4gICAgXy5pc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIF8uaGFzKG9iaiwgJ2NhbGxlZScpO1xuICAgIH07XG4gIH1cblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuIFdvcmsgYXJvdW5kIGFuIElFIDExIGJ1Zy5cbiAgaWYgKHR5cGVvZiAvLi8gIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09ICdmdW5jdGlvbicgfHwgZmFsc2U7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gb2JqZWN0IGEgZmluaXRlIG51bWJlcj9cbiAgXy5pc0Zpbml0ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBpc0Zpbml0ZShvYmopICYmICFpc05hTihwYXJzZUZsb2F0KG9iaikpO1xuICB9O1xuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD8gKE5hTiBpcyB0aGUgb25seSBudW1iZXIgd2hpY2ggZG9lcyBub3QgZXF1YWwgaXRzZWxmKS5cbiAgXy5pc05hTiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfLmlzTnVtYmVyKG9iaikgJiYgb2JqICE9PSArb2JqO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBfLmlzQm9vbGVhbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHRydWUgfHwgb2JqID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEJvb2xlYW5dJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGVxdWFsIHRvIG51bGw/XG4gIF8uaXNOdWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gbnVsbDtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIHVuZGVmaW5lZD9cbiAgXy5pc1VuZGVmaW5lZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHZvaWQgMDtcbiAgfTtcblxuICAvLyBTaG9ydGN1dCBmdW5jdGlvbiBmb3IgY2hlY2tpbmcgaWYgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHByb3BlcnR5IGRpcmVjdGx5XG4gIC8vIG9uIGl0c2VsZiAoaW4gb3RoZXIgd29yZHMsIG5vdCBvbiBhIHByb3RvdHlwZSkuXG4gIF8uaGFzID0gZnVuY3Rpb24ob2JqLCBrZXkpIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gIH07XG5cbiAgLy8gVXRpbGl0eSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSdW4gVW5kZXJzY29yZS5qcyBpbiAqbm9Db25mbGljdCogbW9kZSwgcmV0dXJuaW5nIHRoZSBgX2AgdmFyaWFibGUgdG8gaXRzXG4gIC8vIHByZXZpb3VzIG93bmVyLiBSZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcm9vdC5fID0gcHJldmlvdXNVbmRlcnNjb3JlO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8vIEtlZXAgdGhlIGlkZW50aXR5IGZ1bmN0aW9uIGFyb3VuZCBmb3IgZGVmYXVsdCBpdGVyYXRlZXMuXG4gIF8uaWRlbnRpdHkgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcblxuICBfLmNvbnN0YW50ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgfTtcblxuICBfLm5vb3AgPSBmdW5jdGlvbigpe307XG5cbiAgXy5wcm9wZXJ0eSA9IGZ1bmN0aW9uKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiBvYmpba2V5XTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBwcmVkaWNhdGUgZm9yIGNoZWNraW5nIHdoZXRoZXIgYW4gb2JqZWN0IGhhcyBhIGdpdmVuIHNldCBvZiBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy5tYXRjaGVzID0gZnVuY3Rpb24oYXR0cnMpIHtcbiAgICB2YXIgcGFpcnMgPSBfLnBhaXJzKGF0dHJzKSwgbGVuZ3RoID0gcGFpcnMubGVuZ3RoO1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuICFsZW5ndGg7XG4gICAgICBvYmogPSBuZXcgT2JqZWN0KG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBwYWlyID0gcGFpcnNbaV0sIGtleSA9IHBhaXJbMF07XG4gICAgICAgIGlmIChwYWlyWzFdICE9PSBvYmpba2V5XSB8fCAhKGtleSBpbiBvYmopKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJ1biBhIGZ1bmN0aW9uICoqbioqIHRpbWVzLlxuICBfLnRpbWVzID0gZnVuY3Rpb24obiwgaXRlcmF0ZWUsIGNvbnRleHQpIHtcbiAgICB2YXIgYWNjdW0gPSBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgaXRlcmF0ZWUgPSBjcmVhdGVDYWxsYmFjayhpdGVyYXRlZSwgY29udGV4dCwgMSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0ZWUoaSk7XG4gICAgcmV0dXJuIGFjY3VtO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHJhbmRvbSBpbnRlZ2VyIGJldHdlZW4gbWluIGFuZCBtYXggKGluY2x1c2l2ZSkuXG4gIF8ucmFuZG9tID0gZnVuY3Rpb24obWluLCBtYXgpIHtcbiAgICBpZiAobWF4ID09IG51bGwpIHtcbiAgICAgIG1heCA9IG1pbjtcbiAgICAgIG1pbiA9IDA7XG4gICAgfVxuICAgIHJldHVybiBtaW4gKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpO1xuICB9O1xuXG4gIC8vIEEgKHBvc3NpYmx5IGZhc3Rlcikgd2F5IHRvIGdldCB0aGUgY3VycmVudCB0aW1lc3RhbXAgYXMgYW4gaW50ZWdlci5cbiAgXy5ub3cgPSBEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH07XG5cbiAgIC8vIExpc3Qgb2YgSFRNTCBlbnRpdGllcyBmb3IgZXNjYXBpbmcuXG4gIHZhciBlc2NhcGVNYXAgPSB7XG4gICAgJyYnOiAnJmFtcDsnLFxuICAgICc8JzogJyZsdDsnLFxuICAgICc+JzogJyZndDsnLFxuICAgICdcIic6ICcmcXVvdDsnLFxuICAgIFwiJ1wiOiAnJiN4Mjc7JyxcbiAgICAnYCc6ICcmI3g2MDsnXG4gIH07XG4gIHZhciB1bmVzY2FwZU1hcCA9IF8uaW52ZXJ0KGVzY2FwZU1hcCk7XG5cbiAgLy8gRnVuY3Rpb25zIGZvciBlc2NhcGluZyBhbmQgdW5lc2NhcGluZyBzdHJpbmdzIHRvL2Zyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICB2YXIgY3JlYXRlRXNjYXBlciA9IGZ1bmN0aW9uKG1hcCkge1xuICAgIHZhciBlc2NhcGVyID0gZnVuY3Rpb24obWF0Y2gpIHtcbiAgICAgIHJldHVybiBtYXBbbWF0Y2hdO1xuICAgIH07XG4gICAgLy8gUmVnZXhlcyBmb3IgaWRlbnRpZnlpbmcgYSBrZXkgdGhhdCBuZWVkcyB0byBiZSBlc2NhcGVkXG4gICAgdmFyIHNvdXJjZSA9ICcoPzonICsgXy5rZXlzKG1hcCkuam9pbignfCcpICsgJyknO1xuICAgIHZhciB0ZXN0UmVnZXhwID0gUmVnRXhwKHNvdXJjZSk7XG4gICAgdmFyIHJlcGxhY2VSZWdleHAgPSBSZWdFeHAoc291cmNlLCAnZycpO1xuICAgIHJldHVybiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIHN0cmluZyA9IHN0cmluZyA9PSBudWxsID8gJycgOiAnJyArIHN0cmluZztcbiAgICAgIHJldHVybiB0ZXN0UmVnZXhwLnRlc3Qoc3RyaW5nKSA/IHN0cmluZy5yZXBsYWNlKHJlcGxhY2VSZWdleHAsIGVzY2FwZXIpIDogc3RyaW5nO1xuICAgIH07XG4gIH07XG4gIF8uZXNjYXBlID0gY3JlYXRlRXNjYXBlcihlc2NhcGVNYXApO1xuICBfLnVuZXNjYXBlID0gY3JlYXRlRXNjYXBlcih1bmVzY2FwZU1hcCk7XG5cbiAgLy8gSWYgdGhlIHZhbHVlIG9mIHRoZSBuYW1lZCBgcHJvcGVydHlgIGlzIGEgZnVuY3Rpb24gdGhlbiBpbnZva2UgaXQgd2l0aCB0aGVcbiAgLy8gYG9iamVjdGAgYXMgY29udGV4dDsgb3RoZXJ3aXNlLCByZXR1cm4gaXQuXG4gIF8ucmVzdWx0ID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIGlmIChvYmplY3QgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3RbcHJvcGVydHldO1xuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gb2JqZWN0W3Byb3BlcnR5XSgpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIF8udW5pcXVlSWQgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIFVuZGVyc2NvcmUgdXNlcyBFUkItc3R5bGUgdGVtcGxhdGUgZGVsaW1pdGVycywgY2hhbmdlIHRoZVxuICAvLyBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlIGRlbGltaXRlcnMuXG4gIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZSAgICA6IC88JShbXFxzXFxTXSs/KSU+L2csXG4gICAgaW50ZXJwb2xhdGUgOiAvPCU9KFtcXHNcXFNdKz8pJT4vZyxcbiAgICBlc2NhcGUgICAgICA6IC88JS0oW1xcc1xcU10rPyklPi9nXG4gIH07XG5cbiAgLy8gV2hlbiBjdXN0b21pemluZyBgdGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6ICAgICAgXCInXCIsXG4gICAgJ1xcXFwnOiAgICAgJ1xcXFwnLFxuICAgICdcXHInOiAgICAgJ3InLFxuICAgICdcXG4nOiAgICAgJ24nLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICB2YXIgZXNjYXBlciA9IC9cXFxcfCd8XFxyfFxcbnxcXHUyMDI4fFxcdTIwMjkvZztcblxuICB2YXIgZXNjYXBlQ2hhciA9IGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdO1xuICB9O1xuXG4gIC8vIEphdmFTY3JpcHQgbWljcm8tdGVtcGxhdGluZywgc2ltaWxhciB0byBKb2huIFJlc2lnJ3MgaW1wbGVtZW50YXRpb24uXG4gIC8vIFVuZGVyc2NvcmUgdGVtcGxhdGluZyBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXMgd2hpdGVzcGFjZSxcbiAgLy8gYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gIC8vIE5COiBgb2xkU2V0dGluZ3NgIG9ubHkgZXhpc3RzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgXy50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHRleHQsIHNldHRpbmdzLCBvbGRTZXR0aW5ncykge1xuICAgIGlmICghc2V0dGluZ3MgJiYgb2xkU2V0dGluZ3MpIHNldHRpbmdzID0gb2xkU2V0dGluZ3M7XG4gICAgc2V0dGluZ3MgPSBfLmRlZmF1bHRzKHt9LCBzZXR0aW5ncywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KS5yZXBsYWNlKGVzY2FwZXIsIGVzY2FwZUNoYXIpO1xuICAgICAgaW5kZXggPSBvZmZzZXQgKyBtYXRjaC5sZW5ndGg7XG5cbiAgICAgIGlmIChlc2NhcGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBlc2NhcGUgKyBcIikpPT1udWxsPycnOl8uZXNjYXBlKF9fdCkpK1xcbidcIjtcbiAgICAgIH0gZWxzZSBpZiAoaW50ZXJwb2xhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBpbnRlcnBvbGF0ZSArIFwiKSk9PW51bGw/Jyc6X190KStcXG4nXCI7XG4gICAgICB9IGVsc2UgaWYgKGV2YWx1YXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZSArIFwiXFxuX19wKz0nXCI7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkb2JlIFZNcyBuZWVkIHRoZSBtYXRjaCByZXR1cm5lZCB0byBwcm9kdWNlIHRoZSBjb3JyZWN0IG9mZmVzdC5cbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICBpZiAoIXNldHRpbmdzLnZhcmlhYmxlKSBzb3VyY2UgPSAnd2l0aChvYmp8fHt9KXtcXG4nICsgc291cmNlICsgJ31cXG4nO1xuXG4gICAgc291cmNlID0gXCJ2YXIgX190LF9fcD0nJyxfX2o9QXJyYXkucHJvdG90eXBlLmpvaW4sXCIgK1xuICAgICAgXCJwcmludD1mdW5jdGlvbigpe19fcCs9X19qLmNhbGwoYXJndW1lbnRzLCcnKTt9O1xcblwiICtcbiAgICAgIHNvdXJjZSArICdyZXR1cm4gX19wO1xcbic7XG5cbiAgICB0cnkge1xuICAgICAgdmFyIHJlbmRlciA9IG5ldyBGdW5jdGlvbihzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJywgJ18nLCBzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB2YXIgdGVtcGxhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gcmVuZGVyLmNhbGwodGhpcywgZGF0YSwgXyk7XG4gICAgfTtcblxuICAgIC8vIFByb3ZpZGUgdGhlIGNvbXBpbGVkIHNvdXJjZSBhcyBhIGNvbnZlbmllbmNlIGZvciBwcmVjb21waWxhdGlvbi5cbiAgICB2YXIgYXJndW1lbnQgPSBzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJztcbiAgICB0ZW1wbGF0ZS5zb3VyY2UgPSAnZnVuY3Rpb24oJyArIGFyZ3VtZW50ICsgJyl7XFxuJyArIHNvdXJjZSArICd9JztcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYSBcImNoYWluXCIgZnVuY3Rpb24uIFN0YXJ0IGNoYWluaW5nIGEgd3JhcHBlZCBVbmRlcnNjb3JlIG9iamVjdC5cbiAgXy5jaGFpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBpbnN0YW5jZSA9IF8ob2JqKTtcbiAgICBpbnN0YW5jZS5fY2hhaW4gPSB0cnVlO1xuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfTtcblxuICAvLyBPT1BcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0XG4gIC8vIGNhbiBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgdGhlXG4gIC8vIHVuZGVyc2NvcmUgZnVuY3Rpb25zLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnRpbnVlIGNoYWluaW5nIGludGVybWVkaWF0ZSByZXN1bHRzLlxuICB2YXIgcmVzdWx0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NoYWluID8gXyhvYmopLmNoYWluKCkgOiBvYmo7XG4gIH07XG5cbiAgLy8gQWRkIHlvdXIgb3duIGN1c3RvbSBmdW5jdGlvbnMgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm1peGluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgXy5lYWNoKF8uZnVuY3Rpb25zKG9iaiksIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gX1tuYW1lXSA9IG9ialtuYW1lXTtcbiAgICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBmdW5jLmFwcGx5KF8sIGFyZ3MpKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICBfLm1peGluKF8pO1xuXG4gIC8vIEFkZCBhbGwgbXV0YXRvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIF8uZWFjaChbJ3BvcCcsICdwdXNoJywgJ3JldmVyc2UnLCAnc2hpZnQnLCAnc29ydCcsICdzcGxpY2UnLCAndW5zaGlmdCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBvYmogPSB0aGlzLl93cmFwcGVkO1xuICAgICAgbWV0aG9kLmFwcGx5KG9iaiwgYXJndW1lbnRzKTtcbiAgICAgIGlmICgobmFtZSA9PT0gJ3NoaWZ0JyB8fCBuYW1lID09PSAnc3BsaWNlJykgJiYgb2JqLmxlbmd0aCA9PT0gMCkgZGVsZXRlIG9ialswXTtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBvYmopO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFkZCBhbGwgYWNjZXNzb3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBfLmVhY2goWydjb25jYXQnLCAnam9pbicsICdzbGljZSddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBtZXRob2QuYXBwbHkodGhpcy5fd3JhcHBlZCwgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gIF8ucHJvdG90eXBlLnZhbHVlID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3dyYXBwZWQ7XG4gIH07XG5cbiAgLy8gQU1EIHJlZ2lzdHJhdGlvbiBoYXBwZW5zIGF0IHRoZSBlbmQgZm9yIGNvbXBhdGliaWxpdHkgd2l0aCBBTUQgbG9hZGVyc1xuICAvLyB0aGF0IG1heSBub3QgZW5mb3JjZSBuZXh0LXR1cm4gc2VtYW50aWNzIG9uIG1vZHVsZXMuIEV2ZW4gdGhvdWdoIGdlbmVyYWxcbiAgLy8gcHJhY3RpY2UgZm9yIEFNRCByZWdpc3RyYXRpb24gaXMgdG8gYmUgYW5vbnltb3VzLCB1bmRlcnNjb3JlIHJlZ2lzdGVyc1xuICAvLyBhcyBhIG5hbWVkIG1vZHVsZSBiZWNhdXNlLCBsaWtlIGpRdWVyeSwgaXQgaXMgYSBiYXNlIGxpYnJhcnkgdGhhdCBpc1xuICAvLyBwb3B1bGFyIGVub3VnaCB0byBiZSBidW5kbGVkIGluIGEgdGhpcmQgcGFydHkgbGliLCBidXQgbm90IGJlIHBhcnQgb2ZcbiAgLy8gYW4gQU1EIGxvYWQgcmVxdWVzdC4gVGhvc2UgY2FzZXMgY291bGQgZ2VuZXJhdGUgYW4gZXJyb3Igd2hlbiBhblxuICAvLyBhbm9ueW1vdXMgZGVmaW5lKCkgaXMgY2FsbGVkIG91dHNpZGUgb2YgYSBsb2FkZXIgcmVxdWVzdC5cbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZSgndW5kZXJzY29yZScsIFtdLCBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfO1xuICAgIH0pO1xuICB9XG59LmNhbGwodGhpcykpO1xuIl19
