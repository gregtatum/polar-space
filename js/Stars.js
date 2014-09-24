var Stars = module.exports = function( poem ) {
	this.poem = poem;
	this.object = null;
	
	this.count = 20000;
	this.depth = 10;
	
	this.addObject();
};

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
				 color: 0x999999,
				 fog: false
			}
		) );
		
		
		
		this.poem.scene.add( this.object ) ;
		
	}
};