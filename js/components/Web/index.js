var glslify = require('glslify');
var createShader = require('three-glslify')(THREE);
var createWebGeometry = require('./geometry');
var Coordinates = require('../../utils/Coordinates');


function worldPositionVelocityUpdater( poem, fromPolarPosition, toWorldPosition, toVelocity ) {
	
	var newWorldPosition = new THREE.Vector3();
	var newVelocity = new THREE.Vector3();
	var coordinates = new Coordinates( poem );
	coordinates.setVector( toWorldPosition, fromPolarPosition );
	
	return function() {
		
		//Calculate the new values
		coordinates.setVector( newWorldPosition, fromPolarPosition );
		newVelocity.subVectors( newWorldPosition, toWorldPosition );
		
		//Ease the changes in
		newWorldPosition.lerp( toWorldPosition, 0.5 );
		newVelocity.lerp( toVelocity, 0.95 );
		
		//Save them
		toVelocity.copy( newVelocity );		
		toWorldPosition.copy( newWorldPosition );
		
	};
}

function shipPositionUniforms( poem, shader, shipPosition ) {
		
	var shipWorldPosition = new THREE.Vector3();
	var shipWorldVelocity = new THREE.Vector3();
	
	shader.uniforms.shipPosition = { type: "v3", value: shipWorldPosition };
	shader.uniforms.shipVelocity = { type: "v3", value: shipWorldVelocity };
	shader.uniforms.time = { type: "f", value: 0 };
	
	poem.on( 'update', worldPositionVelocityUpdater(
		poem,
		poem.ship.position,
		shipWorldPosition,
		shipWorldVelocity
	));
	
}


var Web = function( poem, properties ) {
	
	this.poem = poem;
	
	var shader = createShader( glslify({
		vertex: './web.vert',
		fragment: './web.frag',
		sourceOnly: true
	}));
	
	shipPositionUniforms( poem, shader, poem.ship.position );
	
	var material = new THREE.ShaderMaterial( shader );
	var geometry = createWebGeometry(
		64,				//sides
		12,				//levels
		poem.r,			//radius
		poem.height		//height
	);
	var mesh = new THREE.Mesh( geometry, material );
	material.wireframe = true;
	material.transparent = true;

	poem.scene.add( mesh );
	
	
};

module.exports = Web;

Web.prototype = {
	
	
};