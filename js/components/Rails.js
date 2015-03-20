function generateCylinder( vertices, sides, radius, height, wobbleAmount ) {

	var radiansPerSide = 2 * Math.PI / sides;
	var wobble = radiansPerSide * 6;

	for( var i=0; i <= sides; i++ ) {

		vertices.push( new THREE.Vector3(
			Math.cos( radiansPerSide * i ) * radius,
			wobbleAmount * Math.sin( wobble * i ) + height,
			Math.sin( radiansPerSide * i ) * radius
		));
		
		vertices.push( new THREE.Vector3(
			Math.cos( radiansPerSide * (i+1) ) * radius,
			wobbleAmount * Math.sin( wobble * (i+1) ) + height,
			Math.sin( radiansPerSide * (i+1) ) * radius
		));
	}
	
	return vertices;

}

function createGeometry( radius, poemHeight ) {
	var geometry = new THREE.Geometry();
	
	var wobble = poemHeight / 20;
	
	generateCylinder( geometry.vertices, 64, radius, poemHeight * -0.775, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * +0.775, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * -0.75, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * +0.75, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * -0.7, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * +0.7, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * -0.6, wobble );
	generateCylinder( geometry.vertices, 64, radius, poemHeight * +0.6, wobble );
	
	return geometry;
}

function createMaterial( color ) {
	
	return new THREE.LineBasicMaterial({
		color: color,
		linewidth : 2
	});
		
}

function createAndAddObject( geometry, material, scene ) {
	
	var mesh = new THREE.Line(
		geometry,
		material,
		THREE.LinePieces
	);
	
	scene.add( mesh );
	
	return mesh;
	
}

var Rails = function( poem, properties ) {
	
	createAndAddObject(
		createGeometry( poem.r, poem.height ),
		createMaterial( 0x445555 ),
		poem.scene
	);
	
};

module.exports = Rails;