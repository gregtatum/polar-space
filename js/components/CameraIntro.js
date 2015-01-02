var CameraIntro = function( poem, properties ) {
	
	this.poem = poem;
	
	var height = properties.heightMultiplier ? properties.heightMultiplier : 5;
	
	this.poem.camera.object.position.y = this.poem.height * height;
	this.origin = properties.origin ? properties.origin : new THREE.Vector3();
	this.speed = properties.speed ? properties.speed : 0.98;
	
	this.boundUpdate = this.update.bind(this);
	
	this.poem.on('update', this.boundUpdate );
	
};


CameraIntro.prototype = {
	
	update: function( e ) {
		
		this.poem.camera.object.position.y *= this.speed;
		this.poem.camera.object.lookAt( this.origin );
		
		if( this.poem.camera.object.position.y < 0.1 ) {
			this.poem.off('update', this.boundUpdate );
		}
		
	}
	
};

module.exports = CameraIntro;