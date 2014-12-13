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