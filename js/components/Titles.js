var HID = require('../Components/Hid');

var Titles = function( poem, properties ) {
	this.poem = poem;
	
	this.poem.ship.disable();
	this.rotateStars();
	
	$('a[href=#keys]').click(this.handleKeysClick.bind(this));
	$('a[href=#tilt]').click(this.handleTiltClick.bind(this));
	
	$('#title').removeClass('hide').show();
	$('.score').css('opacity', 0);
	
	
	this.webglCheck();
};

module.exports = Titles;

Titles.prototype = {
	
	webglEnabled : ( function () { try { var canvas = document.createElement( 'canvas' ); return !! window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ); } catch( e ) { return false; } } )(),
	
	webglCheck : function() {
		
		if( !this.webglEnabled ) {
			$('a[href=#keys]').hide();
			$('a[href=#tilt]').hide();
			$('.title-webgl-error').show();
		}
		
	},
	
	handleKeysClick : function(e) {
		e.preventDefault();
		HID.prototype.setKeys();
		this.nextLevel();
	},
	
	handleTiltClick : function(e) {
		e.preventDefault();
		HID.prototype.setTilt();
		this.nextLevel();
	},
	
	nextLevel : function() {
		$('#title').addClass('hide');
		$('.score').css('opacity', 1);

		LevelLoader("intro");
		
		setTimeout(function() {
			
			$('#title').hide();
			
		}.bind(this), 1000);
	},
	
	rotateStars : function() {
		
		this.poem.on('update', function(e) {
			
			this.poem.stars.object.rotation.y -= 0.0001 * e.dt;
		
		}.bind(this) );
		
	}
	
};