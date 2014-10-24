var HID = require('../Components/Hid')
//	LevelLoader = require('../LevelLoader');

var Titles = function( poem, properties ) {
	this.poem = poem;
	
	this.disableShip();
	this.rotateStars();
		
	$('a[href=#keys]').click(this.handleKeysClick.bind(this));
	$('a[href=#tilt]').click(this.handleTiltClick.bind(this));
};

module.exports = Titles;

Titles.prototype = {
	
	handleKeysClick : function(e) {
		e.preventDefault();
		HID.prototype.setKeys();
		this.nextLevel()
	},
	
	handleTiltClick : function(e) {
		e.preventDefault();
		HID.prototype.setTilt();
		this.nextLevel();
	},
	
	nextLevel : function() {
		$('#title').addClass('hide');

		LevelLoader("asteroidsJellies");
		
		setTimeout(function() {
			
			$('#title').hide();
			
		}.bind(this), 1000);
	},
	
	disableShip : function() {
		var ship = this.poem.ship;
		
		ship.invulnerable = false;
		ship.kill( false, true, true );
	},
	
	rotateStars : function() {
		
		this.poem.on('update', function(e) {
			
			this.poem.stars.object.rotation.y -= 0.0001 * e.dt;
		
		}.bind(this) );
		
	}
	
};