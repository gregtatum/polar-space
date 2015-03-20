var menu = require('./menu');
var mute = require('./mute');
var menuLevels = require('./menuLevels');

jQuery(function($) {
	
	menu.setHandlers();
	mute.setHandlers();
	
	setTimeout(function() {
		window.scrollTo(0, 1);
	}, 1000);
});