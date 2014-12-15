var EventDispatcher = require('../utils/EventDispatcher');

var Muter = function() {
	this.muted = false;
};

EventDispatcher.prototype.apply( Muter.prototype );

var muter = new Muter();

$(window).on('keydown', function muteAudioOnHittingS( e ) {
	
	if( e.keyCode !== 83 ) return;
	
	muter.muted = !muter.muted;
	
	if( muter.muted ) {
		
		muter.dispatch({
			type: 'mute'
		});
		
	} else {
		
		muter.dispatch({
			type: 'unmute'
		});
		
	}
	
});

module.exports = muter;
