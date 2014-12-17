var muter = require('../sound/muter');

var mutedSrc = 'assets/images/sound-mute.png';
var unMutedSrc = 'assets/images/sound-unmute.png';
var mutedSrcHover = 'assets/images/sound-mute-hover.png';
var unMutedSrcHover = 'assets/images/sound-unmute-hover.png';

new Image().src = mutedSrc;
new Image().src = unMutedSrc;
new Image().src = mutedSrcHover;
new Image().src = unMutedSrcHover;


var $mute;
var $img;

module.exports = {
	
	setHandlers : function() {
		
		$mute = $('#mute');
		$img = $mute.find('img');
		
		$mute.click( function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
			
				$img.attr('src', unMutedSrcHover);
				muter.unmute();
			
			} else {
			
				$img.attr('src', mutedSrcHover);
				muter.mute();
			
			}
		
		});

		$mute.on('mouseover', function( e ) {
			
			e.preventDefault();
		
			if( muter.muted ) {
				$img.attr('src', mutedSrcHover);
			} else {
				$img.attr('src', unMutedSrcHover);
			}
		
		});
		
		$mute.on('mouseout', function( e ) {
			
			if( muter.muted ) {
				$img.attr('src', mutedSrc);
			} else {
				$img.attr('src', unMutedSrc);
			}		
		});
		
		

		
		$img.attr( 'src', muter.muted ? mutedSrc : unMutedSrc );
	}
	
}