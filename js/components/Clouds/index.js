var glslify = require('glslify');
var createShader = require('three-glslify')(THREE);

function setupTexture( mesh, scene ) {
	
	var img = new Image();
	var texture = new THREE.Texture( img );
	img.src = 'assets/images/cloud1024.png';
	
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	
	$(img).on('load', function() {
		texture.needsUpdate = true;
		scene.add( mesh );
	});
	
	return texture;
	
}

var Clouds = function( poem, properties ) {
	
	var geometry = new THREE.PlaneGeometry(
		poem.r * 3,
		poem.r * 3
	);
	
	
	var shader = createShader( glslify({
		vertex: './clouds.vert',
		fragment: './clouds.frag',
		sourceOnly: true
	}));
		
	shader.side = THREE.BackSide;
	shader.uniforms = {
		time:	 	{ type: "f", value:0 },
		texture:	{ type: "t", value: null },
		offset:		{ type: "v2", value: properties.offset ? properties.offset : new THREE.Vector2(1,1)  },
		color: 		{ type: "v4", value: new THREE.Vector4( 0.5, 1.0, 0.7, 1 ) }
	};
	
	var material = new THREE.ShaderMaterial( shader );
	material.transparent = true;
	material.blending = THREE.AdditiveBlending;
	material.side = THREE.DoubleSide;
	
	var mesh = new THREE.Mesh( geometry, material );
	
	mesh.rotation.x = properties.rotation;
	mesh.position.y = properties.height;
	mesh.scale.multiplyScalar( 10 );
	
	shader.uniforms.texture.value = setupTexture( mesh, poem.scene );
	
	poem.on('update', function( e ) {
		shader.uniforms.time.value = e.time;
	});
};

module.exports = Clouds;
