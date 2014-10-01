var Poem = require('./Poem');
var asteroidJelliesLevel = require('./levels/asteroids-jellies');

$(function() {
	window.poem = new Poem( asteroidJelliesLevel );
});

