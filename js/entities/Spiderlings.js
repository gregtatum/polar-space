var random = require('../utils/random');
var destroyMesh = require('../utils/destroyMesh');
var color = 0xff0000;

var Spiderling = function( poem, manager, x, y, theta ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Spiderling";
	this.color = color;
	this.cssColor = "#ff0000";
	this.linewidth = 2;
	this.scoreValue = -5;

	this.spawnPoint = new THREE.Vector2(x,y);
	this.position = new THREE.Vector2(x,y);
	this.unitDirection = new THREE.Vector2(
		Math.cos( theta ),
		Math.sin( theta )
	);
	this.list = random.range( -Math.PI / 8, Math.PI / 8 );
	
	this.dead = false;

	

	this.speed = 0.02;
	
	this.radius = 1.5;
	this.thetaJitter = random.range( -Math.PI * 0.2, Math.PI * 0.2 );

	this.addObject();
	this.damage = manager.damage;
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
};

module.exports = Spiderling;

Spiderling.prototype = {
	
	damageSettings : {
		color: color,
		transparent: true,
		opacity: 0.5,
		retainExplosionsCount: 3,
		perExplosion: 5
	},
	
	initSharedAssets : function( manager ) {
		
		var geometry = this.createGeometry();
		
		manager.shared.geometry = geometry;
		
		manager.on('update', Spiderling.prototype.updateGeometry( geometry ) );
	},
	
	updateGeometry : function( geometry ) {

		return function( e ) {

			var time = (e.time / 100);
			var interval = Math.PI * 6 / geometry.waveyVerts.length;
			_.each( geometry.waveyVerts, function( vec, i ) {
				
				var unitI = Math.sin( i * interval + time ) * 0.8 + 0.2;
				
				vec.x = unitI * vec.original.x;
				vec.y = unitI * vec.original.y;
				
			});
			
		};
	},

	createGeometry : function() {

		var geometry, verts, manhattanLength, center;
	
		geometry = new THREE.Geometry();
		
		var sides = 16;
		
		var increment = Math.PI * 2 / (sides-1);
		
		/* jshint ignore:start */
		verts = _.map( _.range(sides), function( i ) {
			return [
				Math.cos( i * increment ) * 2,
				Math.sin( i * increment ) * 2
			];
		});
		/* jshint ignore:end */
		
		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [ 0, 0 ]);
	
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2, i ) {
			
			var scale = 1;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( i % 2 === 0 ) {
				geometry.waveyVerts.push( vec3 );
			}
			
			return vec3;
			
		}, this);
	
		return geometry;
	
	},

	addObject : function() {
	
		var geometry, lineMaterial;
	
		geometry = this.manager.shared.geometry;
			
		lineMaterial = new THREE.LineBasicMaterial({
			color: this.color,
			linewidth : this.linewidth
		});
	
		this.object = new THREE.Line(
			geometry,
			lineMaterial,
			THREE.LineStrip
		);
		this.object.scale.multiplyScalar( random.range( 0.3, 0.8 ) );
		this.object.position.z += this.poem.r;
	
		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
		this.poem.on( 'destroy', destroyMesh( this.object ) );
	},

	kill : function() {
		this.dead = true;
		this.object.visible = false;
		this.damage.explode( this.position );
	},

	reset : function() {
		this.position.copy( this.spawnPoint );
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},

	update : function( e ) {
		
		if( this.dead ) {
			this.damage.update( e );
		} else {
			this.object.geometry.verticesNeedUpdate = true;
			this.updatePosition( e );
		}

	},

	updatePosition : function() {
	
		var unitSeek = new THREE.Vector2();
		var velocity = new THREE.Vector2();
	
		return function( e ) {

			var theta = Math.atan2(
				this.poem.ship.position.y - this.position.y,
				this.poem.coordinates.keepDiffInRange(
					this.poem.ship.position.x - this.position.x
				)
			);
			
			unitSeek.x = Math.cos( theta + this.list );
			unitSeek.y = Math.sin( theta + this.list );
			
			velocity
				.copy( this.unitDirection )
				.lerp( unitSeek, 0.02 )
				.normalize()
			;
			
			this.unitDirection.copy( velocity );
			
			velocity.multiplyScalar( this.speed * e.dt );
			
			this.position.add( velocity );
			
			this.object.position.y = this.position.y;
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
			
		};
	
	}()	


};