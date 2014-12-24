var random = require('../utils/random');
var destroyMesh = require('../utils/destroyMesh');
var twoπ = Math.PI * 2;
var color = 0xBC492A;

var Arachnid = function( poem, manager, x, y ) {

	this.poem = poem;
	this.manager = manager;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;

	this.name = "Arachnid";
	this.color = 0xBC492A;
	this.cssColor = "#BC492A";
	this.linewidth = 2 * this.poem.ratio;
	this.scoreValue = 23;

	this.spawnPoint = new THREE.Vector2(x,y);
	this.position = new THREE.Vector2(x,y);
	
	this.dead = false;

	this.speed = 0;

	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;

	this.thrustSpeed = 0.5;
	this.thrust = 0;

	this.bankSpeed = 0.03;
	this.bank = 0;
	this.maxSpeed = 1000;
	
	this.radius = 3;

	this.addObject();
	
	this.handleUpdate = this.update.bind(this);
	this.manager.on('update', this.handleUpdate );
	
	if( !_.isObject( this.poem.spiderlings ) ) {
		throw new Error("Arachnids require spiderlings");
	}
	
	
};

module.exports = Arachnid;

Arachnid.prototype = {
	
	damageSettings : {
		color: 0xBC492A,
		transparent: true,
		opacity: 0.5,
		retainExplosionsCount: 3,
		perExplosion: 20
	},
	
	initSharedAssets : function( manager ) {
		
		var geometry = this.createGeometry();
		
		manager.shared.geometry = geometry;
		
		manager.on('update', Arachnid.prototype.updateGeometry( geometry ) );
	},
	
	updateGeometry : function( geometry ) {

		return function( e ) {
			
			_.each( geometry.waveyVerts, function( vec ) {
				vec.y = 0.8 * Math.sin( e.time / 100 + vec.x ) + vec.original.y;
			});
			
			
			
		};
	},

	createGeometry : function() {

		var geometry, verts, manhattanLength, center;
	
		geometry = new THREE.Geometry();
		
		verts = [[373.900,249.200], [466.000,191.600], [556.700,314.200], [556.600,254.000], [454.900,138.800], [361.400,203.200], [354.800,187.600], [344.300,176.800], [332.800,170.900], [319.000,168.700], [303.300,171.600], [291.400,178.600], [282.600,188.600], [276.600,203.500], [182.800,138.800], [81.000,254.000], [80.900,314.200], [171.600,191.600], [263.700,249.200], [163.600,247.300], [91.600,354.600], [117.600,423.300], [169.000,290.000], [252.300,286.700], [186.400,321.400], [149.700,444.700], [183.000,498.700], [207.300,345.900], [252.300,326.100], [231.700,372.800], [259.000,417.400], [294.000,428.700], [261.100,376.500], [295.000,322.600], [319.000,316.100], [319.000,316.100], [342.800,322.600], [376.500,376.500], [343.600,428.700], [378.600,417.400], [405.900,372.800], [385.300,326.000], [430.300,345.800], [454.600,498.600], [487.900,444.600], [451.200,321.300], [385.300,286.600], [468.600,289.900], [519.900,423.200], [545.900,354.500], [473.900,247.200], [373.900,249.200]];

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
		
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
		
		}, [ 0, 0 ]);
	
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.waveyVerts = [];
	
		geometry.vertices = _.map( verts, function( vec2 ) {
			
			var scale = 1 / 32;
			var vec3 = new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
			
			vec3.original = new THREE.Vector3().copy( vec3 );
			
			if( vec2[0] > 400 || vec2[0] < 200 ) {
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
		this.object.scale.multiplyScalar( 0.6 );
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

		var spiderlings = random.rangeInt( 2, 5 );
		var shipTheta = Math.atan2(
			this.poem.ship.position.y - this.position.y,
			this.poem.coordinates.keepDiffInRange(
				this.poem.ship.position.x - this.position.x
			)
		);
		
		
		var spiderlingTheta;
		
		var thetaSpread = Math.PI * 0.25;
		var thetaStep = thetaSpread / spiderlings;
		var reverseShipTheta = shipTheta + Math.PI;

		for( var i=0; i < spiderlings; i++ ) {
			
			this.poem.spiderlings.add(
				this.position.x,
				this.position.y,
				reverseShipTheta + random.range(0, 1) * (i * thetaStep - (thetaSpread / 2) )
			);
			
		}
	},

	reset : function() {
		this.position.copy( this.spawnPoint );
		this.speed = 0.2;
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},

	update : function( e ) {
		
		if( this.dead ) {
		
			this.damage.update( e );
			
		} else {
			
			this.bank *= 0.9;
			this.thrust = 0.01;
			this.bank += random.range(-0.01, 0.01);
		
			this.object.geometry.verticesNeedUpdate = true;
		
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
		
		}

	},
	
	updateEdgeAvoidance : function( e ) {
	
		var nearEdge, farEdge, position, normalizedEdgePosition, bankDirection, absPosition;
	
		farEdge = this.poem.height / 2;
		nearEdge = 4 / 5 * farEdge;
		position = this.object.position.y;
		absPosition = Math.abs( position );

		var rotation = this.object.rotation.z / Math.PI;

		this.object.rotation.z %= 2 * Math.PI;
	
		if( this.object.rotation.z < 0 ) {
			this.object.rotation.z += 2 * Math.PI;
		}
	
		if( Math.abs( position ) > nearEdge ) {
		
			var isPointingLeft = this.object.rotation.z >= Math.PI * 0.5 && this.object.rotation.z < Math.PI * 1.5;
		
			if( position > 0 ) {
			
				if( isPointingLeft ) {
					bankDirection = 1;
				} else {
					bankDirection = -1;
				}
			} else {
				if( isPointingLeft ) {
					bankDirection = -1;
				} else {
					bankDirection = 1;
				}
			}
		
			normalizedEdgePosition = (absPosition - nearEdge) / (farEdge - nearEdge);
			this.thrust += normalizedEdgePosition * this.edgeAvoidanceThrustSpeed;
			this.object.rotation.z += bankDirection * normalizedEdgePosition * this.edgeAvoidanceBankSpeed;
		
		}
	
	},

	updatePosition : function( e ) {
	
		var movement = new THREE.Vector3();
	
		return function() {
	
			var theta, x, y;
		
			this.object.rotation.z += this.bank;
			
			theta = this.object.rotation.z;
		
			this.speed *= 0.98;
			this.speed += this.thrust;
			this.speed = Math.min( this.maxSpeed, this.speed );
			this.speed = Math.max( 0, this.speed );
					
			this.position.x += this.speed * Math.cos( theta );
			this.position.y += this.speed * Math.sin( theta );
		
			this.object.position.y = this.position.y;
		
			//Polar coordinates
			// this.object.position.x = Math.cos( this.position.x * this.poem.circumferenceRatio ) * this.poem.r;
			// this.object.position.z = Math.sin( this.position.x * this.poem.circumferenceRatio ) * this.poem.r;
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
		
		};
	
	}()	


};