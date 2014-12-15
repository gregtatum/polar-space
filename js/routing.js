var crossroads = require('crossroads');
var hasher = require('hasher');
var levelLoader = require('./levelLoader');

var baseUrl = '/polar';
var defaultLevel = "titles";
var currentLevel = "";

crossroads.addRoute( '/', function showMainTitles() {
	
	_gaq.push( [ '_trackPageview', baseUrl ] );
	
	levelLoader( defaultLevel );
	
});

crossroads.addRoute( 'level/{name}', function loadUpALevel( levelName ) {
	
	_gaq.push( [ '_trackPageview', baseUrl+'/#level/'+levelName ] );
	
	var levelFound = levelLoader( levelName );
	
	if( !levelFound ) {
		levelLoader( defaultLevel );
	}
	
});

crossroads.addRoute( /.*/, function reRouteToMainTitlesIfNoMatch() {
	
	hasher.replaceHash('');
	
});

$(function startWatchingRoutes() {
	
	function parseHash(newHash, oldHash){
		crossroads.parse(newHash);
	}
	
	hasher.initialized.add(parseHash); // parse initial hash
	hasher.changed.add(parseHash); //parse hash changes
	
	hasher.init(); //start listening for history change
	
});