var EventDispatcher = require('./utils/EventDispatcher');

var HID = module.exports = function() {
	
	var states = {
		up: false,
		down: false,
		left: false,
		right: false,
		spacebar: false
	};
	
	this.keyCodes = {
		"k38" : "up",
		"k40" : "down",
		"k37" : "left",
		"k39" : "right",
		"k32" : "spacebar"
	}
	
	this.pressed = _.clone(states);
	this.down = _.clone(states);
	this.up = _.clone(states);
	
	$(window).on('keydown', this.keydown.bind(this));
	$(window).on('keyup', this.keyup.bind(this));
	
};

HID.prototype = {
	
	keydown : function( e ) {
		var code = this.keyCodes[ "k" + e.keyCode ];
		
		if(code) {
			this.down[code] = true;
			this.pressed[code] = true;
		}
	},
	
	keyup : function( e ) {
		var code = this.keyCodes[ "k" + e.keyCode ];
		
		if(code) {
			this.pressed[code] = false;
			this.up[code] = true;
		}
	},
	
	update : function() {
		
		var falsify = function (value, key, list) {
			list[key] = false
		}
		
		return function() {
			_.each( this.down, falsify );
			_.each( this.up, falsify );
		};
		
	}()
	
};

EventDispatcher.prototype.apply( HID.prototype );