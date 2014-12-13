var Poem = require('./Poem');
var levels = require('./levels');

var currentLevel = null;
var currentPoem = null;

window.LevelLoader = function( name ) {
	
	//Track this, but exclude first load
	if( currentLevel ) {
		_gaq.push(['_trackPageview', '/polar/'+name]);
	}
	
	if(currentPoem) currentPoem.destroy();
	
	currentLevel = levels[name];
	currentPoem = new Poem( currentLevel );
	window.poem = currentPoem;
	
};
	
module.exports = LevelLoader;