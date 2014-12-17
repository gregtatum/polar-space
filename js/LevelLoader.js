var Poem = require('./Poem')
  , levels = require('./levels')
  , EventDispatcher = require('./utils/EventDispatcher');

var currentLevel = null;
var currentPoem = null;

var levelLoader = {
	
	load : function( name ) {
		
		if( !_.isObject(levels[name]) ) {
			return false;
		}
	
		if(currentPoem) currentPoem.destroy();
	
		currentLevel = levels[name];
		currentPoem = new Poem( currentLevel );
		
		this.dispatch({
			type: "newLevel",
			level: currentLevel,
			poem: currentPoem
		});
		
		window.poem = currentPoem;
	
		return true;
	}
	
};

EventDispatcher.prototype.apply( levelLoader );

module.exports = levelLoader;