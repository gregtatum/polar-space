var Poem = require('./Poem');
var levels = require('./levels');

var currentLevel = null;
var currentPoem = null;

window.levelLoader = function( name ) {

	if( !_.isObject(levels[name]) ) {
		return false;
	}
	
	if(currentPoem) currentPoem.destroy();
	
	currentLevel = levels[name];
	currentPoem = new Poem( currentLevel );
	window.poem = currentPoem;
	
	return true;
	
};
	
module.exports = levelLoader;