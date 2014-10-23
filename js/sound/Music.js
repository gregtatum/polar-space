var soundcloud = require('soundcloud-badge');

var Music = function( poem, properties ) {

	soundcloud({
		client_id: '6057c9af862bf245d4c402179e317f52',
		song: properties.url,
		dark: false,
		getFonts: false
	}, function(err, src, data, div) {

		if (err) throw err

		var audio = new Audio();
		audio.src = src;
		audio.play();
		audio.loop = true;
		audio.volume = 0.6;
		
		
		var playing = true;
		
		$(window).on('keydown', function(e) {
			console.log(e.keyCode);
			if( e.keyCode != 83 ) return;
			if( playing ) {
				audio.pause();
				playing = false;
			} else {
				audio.play();
				playing = true;
			}
		});
		
	})
	
};

module.exports = Music;