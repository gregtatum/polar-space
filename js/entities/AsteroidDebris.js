
var _createGeometry = _.once(function createGeometry() {
	return new THREE.TetrahedronGeometry()
})

function _createDebris( poem, config, asteroid ) {
	
	var geometry = _createGeometry()
	var numberOfDebris = asteroid.radius * config.piecesPerRadius
	
	var debris = []
	
	var material = asteroid.object.material.clone()
	material.transparent = true
	material.opacity = 1
	
	for( var i=0; i < numberOfDebris; i++ ) {
		
		var mesh = new THREE.Mesh( geometry, material )
		
		mesh.rotation.x = Math.random() * Math.PI * 2
		mesh.rotation.y = Math.random() * Math.PI * 2
		mesh.rotation.z = Math.random() * Math.PI * 2
		
		var scale = asteroid.radius * config.debrisRadius * (Math.random() + 0.1)
		mesh.scale.multiplyScalar( scale )
		
		poem.scene.add( mesh )
		
		var position = asteroid.position.clone()
		
		var radius = asteroid.radius * Math.random()
		var theta = Math.random() * Math.PI * 2
		
		position.x += Math.cos( theta ) * radius
		position.y += Math.sin( theta ) * radius
		
		debris.push({
			mesh : mesh,
			position : position,
			wanderSpeed : new THREE.Vector3(
				Math.random() * config.wanderSpeed,
				Math.random() * config.wanderSpeed,
				Math.random() * config.wanderSpeed
			),
			rotationSpeed : new THREE.Vector3(
				Math.random() * config.rotationSpeed,
				Math.random() * config.rotationSpeed,
				Math.random() * config.rotationSpeed
			)
		})
	}
	
	return debris
}

function _updateFn( poem, config, debris ) {

	var material = debris[0].mesh.material
	
	return function update( e ) {

		material.opacity -= config.opacityShrink * e.dt
		
		if( material.opacity <= 0 ) {
			for( var i=0; i < debris.length; i++ ) {
				var d = debris[i]
				poem.scene.remove( d.mesh )
				console.log('removed debris piece')
			}
			poem.off('update', update)
		}
				
		for( var i=0; i < debris.length; i++ ) {
			
			var d = debris[i]
			poem.coordinates.setVector( d.mesh.position, d.position );
			
			var x = d.mesh.rotation.x + d.rotationSpeed.x
			var y = d.mesh.rotation.y + d.rotationSpeed.y
			var z = d.mesh.rotation.z + d.rotationSpeed.z
			
			
			d.position.x += d.wanderSpeed.x
			d.position.y += d.wanderSpeed.y
			
			d.mesh.rotation.set(x,y,z)
			
		}
	}
}


module.exports = function createAsteroidDebris( poem, props, asteroid ) {
	
	var config = _.extend({
		debrisRadius : 0.4,
		piecesPerRadius : 2,
		rotationSpeed : 0.1,
		wanderSpeed : 1,
		scaleRange : [0.1,1],
		opacityShrink : 0.0002
	}, props)
	
	var debris = _createDebris( poem, config, asteroid )
	
	poem.on('update', _updateFn( poem, config, debris ))
	
	return debris
}