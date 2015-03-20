var random = require('../../utils/random.js');
var ClosedSplineCurve3 = require('../../utils/ClosedSplineCurve3.js');
var CreateEnergyBall = require('./EnergyBall');

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

function createMaterial() {
	
	return new THREE.LineBasicMaterial({
		color: 0x00ff00,
		linewidth : 2,
		transparent : true,
		opacity: 0.1,
		blending: THREE.AdditiveBlending
	});
	
}

function createEntities( count, geometry, material, parentObj ) {
	
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
		
		mesh.prevPosition = new THREE.Vector3();
		
		parentObj.add( mesh );
		
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

function updateGeometry( config, curve, geometry ) {
	
	var jitters = _.map( geometry.vertices, function() {
		return new THREE.Vector3(
			random.range(-0.3, 0.3),
			random.range(-0.3, 0.3),
			random.range(-0.3, 0.3)
		);
	});
	
	var timeScaler = config.jitterTimeScale / curve.points.length;
	
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

function updateEntities( curve, entities, curveScale ) {
	
	var timeScaler = 0.0003 / curve.points.length;
	
	return function( e ) {
		
		var timeOffset = (e.time * timeScaler);
		var step = 1 / entities.length;
		var unitI;
		
		for( var i=0, il = entities.length; i < il; i++ ) {
			
			var entity = entities[i];
			if( !entity ) continue;

			unitI = ( timeOffset + i * step ) % 1;
		
			entity.prevPosition.copy( entities[i].position );
			curve.getPoint( unitI, entities[i].position );
			
			entity.position.multiplyScalar( curveScale );
		}
		
	};
	
}

function updateRotation( group ) {
	return function( e ) {
		group.rotation.x += e.dt * 0.0005;
	};
}

function updateEnergyRelease( state, energyBall, stopListeners, entities, releasePeriod ) {
	
	return function( e ) {
		
		if( e.time - state.lastRelease > releasePeriod ) {
						
			var i=0, entity;
			
			do {
				entity = entities[i];
				i++;
			} while ( !entity && i <= entities.length );
			
			state.lastRelease = e.time;
			entities[ entities.indexOf(entity) ] = null;
			energyBall.add( entity );
			if( entities.length === i ) stopListeners();
			
		}
		
	};
	
}

var Swarm = function( poem, properties ) {
	
	var config = _.extend({
		entitiesCount : 200,
		curvePoints : 20,
		releasePeriod : 1000,
		jitterTimeScale : 0.006
	}, properties);
	
	var state = {
		lastRelease : 0
	};
	
	var group = new THREE.Object3D();
	group.scale.multiplyScalar( 0.7 );
	
	var curve = createCurve( config.curvePoints );
	var geometry = createGeometry();
	var material = createMaterial();
	var entities = createEntities( config.entitiesCount, geometry, material, group );
	var energyBall = CreateEnergyBall( poem, properties );
	
	poem.scene.add( group );
	
	var listenersToStop;
	var stopListeners = function() {
		_.each( listenersToStop, function( listener ) {
			poem.off( 'update', listener );
		});
	};
		
	listenersToStop = [
		poem.on('update', updateEntities( curve, entities, poem.r * 0.5 ) ),
		poem.on('update', updateRotation( group ) ),
		poem.on('update', updateEnergyRelease( state, energyBall, stopListeners, entities, config.releasePeriod ) )
	];
	
	//Do not stop updating the geometry
	poem.on('update', updateGeometry( config, curve, geometry ) );
	
	
};

module.exports = Swarm;
