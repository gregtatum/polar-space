var Bullet = function( poem, gun, vertex ) {
	this.poem = poem;
	this.gun = gun;
	this.vertex = vertex;
	
	this.speed = new THREE.Vector2(0,0);
	this.position = new THREE.Vector2(0,0);
	
	this.bornAt = 0;
};

Bullet.prototype = {
	
	kill : function() {
		this.vertex.set(0, 0 ,1000);
		this.gun.reportDead( this );
	},
	
	update : function( dt ) {
		
		var x,y,z;
		
		this.position.x += this.speed.x;
		this.position.y += this.speed.y;
		
		this.vertex.z = Math.cos( this.position.x * this.poem.rSpeed ) * this.poem.r;
		this.vertex.x = Math.sin( this.position.x * this.poem.rSpeed ) * this.poem.r;
		this.vertex.y = this.position.y;
		
	},
	
	fire : function(x, y, speed, theta) {
		
		console.log('bullet fired', x, y, speed, theta);
				
		this.vertex.z = Math.cos( x * this.poem.rSpeed ) * this.poem.r;
		this.vertex.x = Math.sin( x * this.poem.rSpeed ) * this.poem.r;
		this.vertex.y = y;
		
		this.position.set(x,y);
		
		this.speed.x = Math.cos( theta ) * speed;
		this.speed.y = Math.sin( theta ) * speed;
		
		this.bornAt = new Date().getTime();

	}
};