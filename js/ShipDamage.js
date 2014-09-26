var _ = require('underscore');
var random = require('./utils/random.js');
var Bullet = require('./Bullet');

ShipDamage = function( poem, ship ) {
	
	this.poem = poem;
	this.ship = ship;
	this.perExplosion = 100;
	this.retainExplosionsCount = 3;
	this.count = this.perExplosion * this.retainExplosionsCount;
	this.bullets = [];
	this.explodeSpeed = 3;
	
	this.explosionCount = 0;
	
	
	this.addObject();
};
	
ShipDamage.prototype = {
	
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
				 color: this.ship.color
			}
		));
		this.object.frustumCulled = false;
		this.poem.scene.add( this.object ) ;
		
	},
	
	reset : function() {
		
		_.each( this.bullets, function( bullet ) {
			bullet.kill();
		});
		
	},
	
	explode : function() {
		
		_.each( _.sample( this.bullets, this.perExplosion ), function( bullet) {

			var theta = random.range(0, 2 * Math.PI);
			var r = random.rangeLow( 0, this.explodeSpeed );
			
			bullet.alive = true;
			bullet.position.copy( this.ship.position );
			
			bullet.speed.x = r * Math.cos( theta );
			bullet.speed.y = r * Math.sin( theta );
						
		}.bind(this));
		
	},
	
	update : function( dt )  {
		
		_.each( this.bullets, function( bullet ) {
			bullet.update( dt );
			bullet.speed.multiplyScalar(0.999);
		});
		
		this.object.geometry.verticesNeedUpdate = true;
		
	},
	
};

module.exports = ShipDamage;