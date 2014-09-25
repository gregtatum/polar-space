// Translates 2d points into 3d polar space

var PolarConverter = module.exports = function( poem ) {
	this.poem = poem;
	this.twoRSquared = 2 * (this.poem.r * this.poem.r);
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
		
	},
	
	keepInRangeX : function( x ) {
		if( x >= 0 ) {
			return x % this.poem.width;
		} else {
			return x + (x % this.poem.width)
		}
	},
	
	keepInRangeY : function( y ) {
		if( y >= 0 ) {
			return y % this.poem.height;
		} else {
			return y + (y % this.poem.height)
		}
	},
	
	keepInRange : function( vector ) {
		vector.x = this.keepInRangeX( vector.x );
		vector.y = this.keepInRangeX( vector.y );
		return vector;
	}
	
	
};
