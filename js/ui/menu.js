var EventDispatcher = require('../utils/EventDispatcher');
var levelLoader = require('../levelLoader');

var poem;
var isOpen = false;
var $body;

levelLoader.on( 'newLevel', function( e ) {

	poem = e.poem;
	
});


var menu = {
	
	setHandlers : function() {
		
		$body = $('body');
		
		$('#menu-button').click( this.toggleMenu );
		
	},
	
	toggleMenu : function( e ) {
		
		e.preventDefault();

		if( isOpen ) {
			
			$body.removeClass('menu-open');
			if( poem ) poem.loop();
			
		} else {
			
			$body.addClass('menu-open');
			if( poem ) poem.pause();
			
		}
		
		isOpen = !isOpen;
		
	}
	
}

EventDispatcher.prototype.apply( menu );

module.exports = menu;