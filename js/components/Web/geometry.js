var twoπ = Math.PI * 2;

module.exports = function createWebGeometry( sides, levels, radius, height ) {
	
	var geometry = new THREE.Geometry();
	var vertices = geometry.vertices;
	var faces = geometry.faces;
	var sideLength = twoπ / sides;
	var levelHeight = height / levels;

	var a,b,c,d;
	var ai,bi,ci,di;
	var an,bn,cn,dn;
	
	var sideOffset, offset = 0;

	for( var level=0; level < levels; level++ ) {
		
		offset += 0.5;
		
		for( var side=0; side < sides; side++ ) {

			// Vertices and faces like so:
			//     c ______ d
			//      /\    /
			//     /  \  /
			//  a /____\/ b
			
			sideOffset = side + offset;
			
			a = new THREE.Vector3(
				Math.cos( sideLength * sideOffset ) * radius,
				level * levelHeight - height / 2,
				Math.sin( sideLength * sideOffset ) * radius
			);
			
			b = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 1) ) * radius,
				level * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 1) ) * radius
			);
			
			c = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 0.5) ) * radius,
				(level + 1) * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 0.5) ) * radius
			);
			
			d = new THREE.Vector3(
				Math.cos( sideLength * (sideOffset + 1.5) ) * radius,
				(level + 1) * levelHeight - height / 2,
				Math.sin( sideLength * (sideOffset + 1.5) ) * radius
			);
			
			//Push and get index
			ai = vertices.push( a ) - 1;
			bi = vertices.push( b ) - 1;
			ci = vertices.push( c ) - 1;
			di = vertices.push( d ) - 1;
			
			faces.push(
				new THREE.Face3( ci, ai, bi ),
				new THREE.Face3( ci, bi, di )
			);
			
		}
		
	}
	
	
	geometry.mergeVertices();
	geometry.computeVertexNormals();
	geometry.computeFaceNormals();
	
	return geometry;
	
};