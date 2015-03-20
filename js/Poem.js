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
var renderer = require('./renderer');

function createFog( config, cameraPositionZ ) {

	var fog = _.extend({
		color : 0x222222,
		nearFactor : 0.5,
		farFactor : 2
	}, config );

	return new THREE.Fog(
		fog.color,
		cameraPositionZ * fog.nearFactor,
		cameraPositionZ * fog.farFactor
	);

}

var Poem = function( level, slug ) {

	this.circumference = level.config.circumference || 750;
	this.height = level.config.height || 120;
	this.r = level.config.r || 240;
	this.circumferenceRatio = (2 * Math.PI) / this.circumference; //Map 2d X coordinates to polar coordinates
	this.ratio = _.isNumber( window.devicePixelRatio ) ? window.devicePixelRatio : 1;
	this.slug = slug;

	this.controls = undefined;
	this.scene = new THREE.Scene();
	this.requestedFrame = undefined;
	this.started = false;

	this.clock = new Clock();
	this.coordinates = new Coordinates( this );
	this.camera = new Camera( this, level.config.camera || {} );
	this.scene.fog = createFog( level.config.fog, this.camera.object.position.z );

	this.gun = new Gun( this );
	this.ship = new Ship( this );
	this.stars = new Stars( this, level.config.stars );
	this.scoringAndWinning = new ScoringAndWinning( this, level.config.scoringAndWinning );

	this.parseLevel( level );

	this.dispatch({
		type: 'levelParsed'
	});


	this.addStats();

	this.start();

	renderer( this );
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

	addStats : function() {
		this.stats = new Stats();
		this.stats.domElement.style.position = 'absolute';
		this.stats.domElement.style.top = '0px';
		$("#container").append( this.stats.domElement );
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

		this.dispatch({
			type: "draw"
		});




	},

	destroy : function() {

		window.cancelAnimationFrame( this.requestedFrame );

		this.dispatch({
			type: "destroy"
		});
	}
};

EventDispatcher.prototype.apply( Poem.prototype );
