uniform vec3 shipPosition;
uniform vec3 shipVelocity;

attribute float time;

varying vec4 vColor;

void main() {
	
	float shipDistance = max( distance( shipPosition, position ), 10.0 );
	
	vColor =
		vec4( 1.0, 0.0, 0.0, 1.0 )
		* 5.0 * length( shipVelocity ) / shipDistance;
	
	
	gl_Position = projectionMatrix *
		modelViewMatrix *
		vec4( position - shipVelocity * 50.0 / (shipDistance * 0.3 ), 1.0);
}
