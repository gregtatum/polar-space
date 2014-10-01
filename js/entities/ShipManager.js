var Collider = require('../utils/Collider');

var ShipManager = function( poem, shipType, count ) {
	
	this.poem = poem;
	this.shipType = shipType;
	this.ships = [];
	this.liveShips = [];
	this.originClearance = 300;
	
	this.generate( count );
	this.configureCollider();
	
	this.poem.on('update', this.update.bind(this) );
};

module.exports = ShipManager;

ShipManager.prototype = {
	
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