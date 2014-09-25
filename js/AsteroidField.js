var Asteroid = require('./Asteroid');

var AsteroidField = module.exports = function( poem, count ) {
	
	this.poem = poem;
	this.asteroids = []
	this.maxRadius = 50;
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
	
	checkCollision : function( xRaw, yRaw, radius ) {
		
		var x = this.poem.polarConverter.keepInRangeX( x );
		var y = this.poem.polarConverter.keepInRangeY( y );
		
		var collision = _.find( this.asteroids, function( asteroid ) {
			
			var dx, dy, distance;
			
			dx = x - this.poem.polarConverter.keepInRangeX( asteroid.position.x );
			dy = y - this.poem.polarConverter.keepInRangeY( asteroid.position.y );
			distance = Math.sqrt(dx * dx + dy * dy);

			return distance < radius + asteroid.radius;
			
		}, this);
		
		return !!collision;
	}
};