var random = require('../utils/random.js');
var ClosedSplineCurve3 = require('../utils/ClosedSplineCurve3.js');

function createCurve( count ) {
	
	return new ClosedSplineCurve3(
	
		_.map( _.range( count ), function createRandomPoints( i ) {
			return new THREE.Vector3(
				random.range( -1, 1 ),
				random.range( -1, 1 ),
				random.range( -1, 1 )
			);
		})
	
	);
	
}

function createMaterial( pixelRatio ) {
	
	return new THREE.LineBasicMaterial({
		color: 0x00ff00,
		linewidth : 2 * pixelRatio,
		transparent : true,
		opacity: 0.1,
		blending: THREE.AdditiveBlending
	});
	
}

function createEntities( count, geometry, material, scene ) {
	
	return _.map( _.range( count ), function(i) {
		
		var mesh = new THREE.Line(
			geometry,
			material,
			THREE.LineStrip
		);
		
		mesh.rotation.set(
			random.range( 0, Math.PI * 2 ),
			random.range( 0, Math.PI * 2 ),
			random.range( 0, Math.PI * 2 )
		);
		
		mesh.scale.multiplyScalar(
			random.range( 4, 6 )
		);
		
		scene.add( mesh );
		
		return mesh;
	});
	
}

function createGeometry() {
	
	var geometry = new THREE.Geometry();
	
	geometry.vertices = _.map( _.range( 30 ), function() {
		return new THREE.Vector3();
	});
	
	return geometry;
}

function geometryUpdater( curve, geometry ) {
	
	var jitters = _.map( geometry.vertices, function() {
		return new THREE.Vector3(
			random.range(-0.3, 0.3),
			random.range(-0.3, 0.3),
			random.range(-0.3, 0.3)
		);
	});
	
	var timeScaler = 0.003 / curve.points.length;
	
	return function( e ) {
		
		var vertices = geometry.vertices;
		var timeOffset = (e.time * timeScaler);
		var step = 1 / vertices.length;
		var unitI;
		
		for( var i=0, il = vertices.length; i < il; i++ ) {
		
			unitI = ( timeOffset + i * step ) % 1;
			
			curve.getPoint( unitI, vertices[i] );
			
			vertices[i].add( jitters[i] );
			
		}
		
		geometry.verticesNeedUpdate = true;
		
	};
	
}

function entityUpdater( curve, entities, curveScale ) {
	
	var timeScaler = 0.0003 / curve.points.length;
	
	return function( e ) {
		
		var timeOffset = (e.time * timeScaler);
		var step = 1 / entities.length;
		var unitI;
		
		for( var i=0, il = entities.length; i < il; i++ ) {

			unitI = ( timeOffset + i * step ) % 1;
		
			curve.getPoint( unitI, entities[i].position );
			
			entities[i].position.multiplyScalar( curveScale );
		}
		
	};
	
}


var SplinePathCenter = function( poem, properties ) {
	
	var config = _.extend({
		entitiesCount : 150,
		curvePoints : 20
	}, properties);
	
	var curve = createCurve( config.curvePoints );
	var geometry = createGeometry();
	var material = createMaterial( poem.ratio );
	var entities = createEntities( config.entitiesCount, geometry, material, poem.scene );
	
	poem.on('update', geometryUpdater( curve, geometry ) );
	poem.on('update', entityUpdater( curve, entities, poem.r * 0.5 ) );
	
};

module.exports = SplinePathCenter;
