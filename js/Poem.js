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
	this.camera = new Camera( this );
	this.scene.fog = new THREE.Fog( 0x222222, this.camera.object.position.z / 2, this.camera.object.position.z * 2 );
	
	this.score = new Score( this );
	this.gun = new Gun( this );
	this.ship = new Ship( this );
	this.stars = new Stars( this );
	
	this.parseLevel( level );
	
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