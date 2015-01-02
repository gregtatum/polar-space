var glslify = require('glslify');
var createShader = require('three-glslify')(THREE);

var Sky = function( poem, properties ) {
	
	var geometry = new THREE.SphereGeometry( poem.r * 2, 32, 15 );
	
	var shader = createShader( glslify({
		vertex: './sky.vert',
		fragment: './sky.frag',
		sourceOnly: true
	}));
	
	shader.side = THREE.BackSide;
	shader.uniforms = {
		time:	 { type: "f", value:0 },
	};
	
	var material = new THREE.ShaderMaterial( shader );
	material.transparent = true;
	material.blending = THREE.AdditiveBlending;
	
	var mesh = new THREE.Mesh( geometry, material );
	poem.scene.add( mesh );
	
	poem.on('update', function( e ) {
		shader.uniforms.time.value = e.time;
	});
};

module.exports = Sky;
