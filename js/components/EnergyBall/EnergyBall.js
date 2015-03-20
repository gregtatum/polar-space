var random = require('../../utils/random');
var SoundGenerator = require('../../sound/SoundGenerator');

var internals = {
	
	moveToWorld : function( state, config, mesh ) {
		
		var position = mesh.getWorldPosition();
		var rotation = mesh.getWorldRotation();
		var quaternion = mesh.getWorldQuaternion();
		var scale = mesh.getWorldScale();
	
		mesh.velocity = new THREE.Vector3();
		mesh.velocity.subVectors( mesh.position, mesh.prevPosition );
		mesh.velocity.applyMatrix4( mesh.matrixWorld );
		mesh.velocity.subVectors( position, mesh.velocity );
		mesh.velocityLength = config.speed;
		
		mesh.parent.remove( mesh );
		state.poem.scene.add( mesh );
	
		mesh.position.copy( position );
		mesh.rotation.copy( rotation );
		mesh.quaternion.copy( quaternion );
		mesh.scale.copy( scale );
			
	},
	
	seekTowardsTarget : (function() {
		
		var pointer = new THREE.Vector3();
		
		return function( state, config, e ) {
		
			for( var i=0; i < state.entities.length; i++ ) {
				
				var entity = state.entities[i];
				var target = state.targets[i];
				
				pointer.subVectors( target, entity.position );
				pointer.normalize();
				pointer.x += random.range(0,0.2);
				pointer.y += random.range(0,0.2);
				pointer.z += random.range(0,0.2);
				pointer.multiplyScalar( entity.velocityLength );
				
				entity.velocity.lerp( pointer, config.turnSpeed );
				
				entity.position.add( entity.velocity );
			}
		};
	})(),
	
	checkCollisionWithPlayer : (function() {
		
		var difference = new THREE.Vector3();
		
		return function( state, config, sound, e ) {
			
			for( var i=0; i < state.entities.length; i++ ) {
				
				var entity = state.entities[i];
				var target = state.targets[i];
				
				difference.subVectors( entity.position, state.poem.ship.position3d );
				
				if( !entity.collected && difference.lengthSq() < config.catchDistanceSq ) {
					
					entity.collected = true;
					internals.collect( state, entity, target, i );
					
					internals.playSound( sound );
				}
			}
	
		};
	})(),
	
	collect : (function() {
		
		var blueMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffff,
			linewidth : 2,
			transparent : true,
			opacity: 0.3,
			blending: THREE.AdditiveBlending
		});
		
		return function( state, entity, target, preliminaryIndex ) {
			console.log('collected!');
		
			//Make it track the ship's current position
			state.targets.splice( preliminaryIndex, 1, state.poem.ship.position3d );
			entity.material = blueMaterial;
			
			var shrink = function(e) {
				entity.scale.multiplyScalar( 0.95 );
				
				if( entity.scale.x < 0.7 ) {
					state.poem.off( 'update', shrink );
				}
			};
		
			state.poem.on( 'update', shrink );
			
		};
		
	})(),
	
	addEntity : function( state, config, material, entity ) {
		
		internals.moveToWorld( state, config, entity );
		state.entities.push( entity );
		
		entity.material = material;
		
		//Add a target from 2d space to 3d
		state.targets.push(
			state.poem.coordinates.setVector(
				new THREE.Vector3(),
				Math.random() * state.poem.circumference,
				random.range( -state.poem.height, state.poem.height ) * 0.5
			)
		);
	},
	
	createSound : function() {
		var sound = new SoundGenerator();
		
		sound.connectNodes([
			sound.makeOscillator( "sine" ),
			sound.makeGain(),
			sound.getDestination()
		]);
		
		sound.setGain(0,0,0);
		sound.start();
		
		return sound;
	},
	
	playSound : function( sound ) {
		
		var freq = 900;
		var length = 0.1
		//Start 
		sound.setGain(0, 0, 0.001);
		sound.setFrequency(freq * 0.3, 0, 0);
		
		//Middle
		sound.setGain(1,			0.001, length);
		sound.setFrequency(freq,	0.001, length);

		//End 
		sound.setGain(0,				length, length * 0.5);
		sound.setFrequency(freq * 0.9,	length, length * 0.5);
		
	}
};

function EnergyBall( poem, properties ) {
	
	var config = _.extend({
		turnSpeed : 0.01,
		catchDistanceSq : 50,
		speed : 2
	}, properties);
	
	var state = {
		poem : poem,
		entities : [],
		targets : []
	};
	
	var material = new THREE.LineBasicMaterial({
		color: 0x00ff66,
		linewidth : 2,
		transparent : true,
		opacity: 0.3,
		blending: THREE.AdditiveBlending
	});
	var sound = internals.createSound();
	
	poem.on('update', _.partial( internals.seekTowardsTarget, state, config ) );
	poem.on('update', _.partial( internals.checkCollisionWithPlayer, state, config, sound ) );
		
	return {
		add : _.partial( internals.addEntity, state, config, material )
	};
	
}

module.exports = EnergyBall;