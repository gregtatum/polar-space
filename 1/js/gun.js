var Gun = function( poem ) {
	this.poem = poem;
	this.object = null;
	
	this.count = 200;
	this.bulletAge = 5000;
	this.liveBullets = [];
	this.deadBullets = [];
	this.bornAt = 0;

	this.addObject();
};

Gun.prototype = {
	
	fire : function(x, y, speed, theta) {
		var bullet;
		
		if( this.deadBullets.length === 0 ) return;
		
		bullet = this.deadBullets.pop();
		this.liveBullets.push( bullet );
		
		bullet.fire(x, y, speed, theta);
		
	},
	
	generateGeometry : function() {
		
		var vertex, bullet;
		
		geometry = new THREE.Geometry();
		
		for(var i=0; i < this.count; i++) {
			
			vertex = new THREE.Vector3();
			bullet = new Bullet( this.poem, this, vertex );
			
			geometry.vertices.push( vertex );
			this.deadBullets.push( bullet );
			
			bullet.kill();
					
		}
		
		return geometry;
	},
	
	reportDead : function( bullet ) {
		var i = this.liveBullets.indexOf( bullet );
		
		if( i >= 0 ) {
			this.liveBullets.splice( i, 1 );
		}
		
		this.deadBullets.push( bullet );
		
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
		
		for(var i=0, il=this.liveBullets.length; i<il; i++) {
			bullet = this.liveBullets[i];
			
			if(bullet.bornAt + this.bulletAge < now) {
				bullet.kill();
			} else {
				bullet.update( dt );
			}
		}
		if(this.liveBullets.length > 0) {
			this.object.geometry.verticesNeedUpdate = true;
			
		}
		
	}
};