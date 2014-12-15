var twoπ = Math.PI * 2;
var cos = Math.cos;
var sin = Math.sin;
var random = require('../utils/random.js');
var destroyMesh = require('../utils/destroyMesh');

var CylinderLines = function( poem, properties ) {
	
	// console.warn("remove title hiding hack");
	// $('#title').hide();
	// $('.score').css('opacity', 1);
	
	
	this.poem = poem;
	
	var h = 0.5;
	var l = 0.5;
	var s = 0.5;
	
	var geometry		= new THREE.Geometry();
	var height			= poem.r * (_.isNumber( properties.heightPercentage ) ? properties.radiusPercentage : 0.8);
	var radius			= poem.r * (_.isNumber( properties.radiusPercentage ) ? properties.radiusPercentage : 0.8);
	var sides			= _.isNumber( properties.sides ) ? properties.sides : 15;
	var eccentricity	= _.isNumber( properties.eccentricity ) ? properties.eccentricity : 0.05;
	var iterations		= _.isNumber( properties.iterations ) ? properties.iterations : 10;
	
	_multipleCylinderWaveVertices(
		iterations,
		geometry.vertices,
		sides,
		radius,
		poem.height,
		eccentricity
	);

	var material = new THREE.LineBasicMaterial({
		color: this.color,
		linewidth : this.linewidth,
		fog: true
	});

	this.object = new THREE.Line(
		geometry,
		material,
		THREE.LinePieces
	);
	
	this.poem.scene.add( this.object );
	this.poem.on('destroy', destroyMesh( this.object) );
	
	this.poem.on('update', function( e ) {

		h = (h + 0.0002 * e.dt) % 1;
		material.color.setHSL( h, s, l );

	}.bind(this));
};


function _multipleCylinderWaveVertices( iterations, vertices, sides, radius, height, eccentricity ) {
	
	var ratio1, ratio2;
	
	for( var i=0; i < iterations; i++ ) {
		
		ratio1 = i / iterations;
		ratio2 = 1 - ratio1;
		
		_cylinderWaveVertices(
			vertices,
			Math.floor( (sides - 3) * ratio2 ) + 3,
			radius * ratio2,
			height * ratio2 * ratio2,
			eccentricity
		);
		
	}
}

function _cylinderWaveVertices( vertices, sides, radius, height, eccentricity ) {

	var x1,z1,x2,z2,h1,h2,xPrime,zPrime,hPrime;
	var ecc1 = 1 - eccentricity;
	var ecc2 = 1 + eccentricity;
	var radiansPerSide = twoπ / sides;
	var waves = 3;
	var waveHeight;

	for( var i=0; i <= sides; i++ ) {

		waveHeight = height * Math.sin( radiansPerSide * i * waves ) * 0.4;

		x1 = cos( radiansPerSide * i ) * radius * random.range( ecc1, ecc2 );
		z1 = sin( radiansPerSide * i ) * radius * random.range( ecc1, ecc2 );
		h1 = height								* random.range( ecc1, ecc2 ) + waveHeight;
		
		if( i > 0 ) {
			
			if( i === sides ) {
				x1 = xPrime;
				z1 = zPrime;
				h1 = hPrime;
			}

			//Vertical line
			vertices.push( new THREE.Vector3( x1, h1 *  0.5, z1 ) );
			vertices.push( new THREE.Vector3( x1, h1 * -0.5, z1 ) );

			//Top horiz line
			vertices.push( new THREE.Vector3( x1, h1 * 0.5, z1 ) );
			vertices.push( new THREE.Vector3( x2, h2 * 0.5, z2 ) );

			//Bottom horiz line
			vertices.push( new THREE.Vector3( x1, h1 * -0.5, z1 ) );
			vertices.push( new THREE.Vector3( x2, h2 * -0.5, z2 ) );
			
		} else {
			
			xPrime = x1;
			zPrime = z1;
			hPrime = h1;
			
		}

		x2 = x1;
		z2 = z1;
		h2 = h1;

	}
	
	return geometry;

};

module.exports = CylinderLines;