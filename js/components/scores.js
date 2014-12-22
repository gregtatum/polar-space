var localforage = require('localforage');
var levels = require('../levels');
var scores = {};
var EventDispatcher = require('../utils/EventDispatcher');

function dispatchChange() {
	
	exports.dispatch({
		type: "change",
		scores: scores
	});
	
}

var exports = {
	
	get : function( slug ) {
		
		var value = _.isNumber( scores[slug] ) ? scores[slug] : 0;
		var total = _.isNumber( levels[slug].maxScore ) ? levels[slug].maxScore : 1;
		var unitI = 1;
		
		if( total > 0 ) {
			unitI = value / total;
		}
		
		var percent = Math.round(unitI * 100);
		
		return {
			value	: value,
			total	: total,
			unitI	: unitI,
			percent	: percent
		};
		
	},
	
	set : function( slug, score ) {
		
		//Only save the higher score
		scores[slug] = Math.max( scores[slug], score );
		localforage.setItem( 'scores', scores );
		dispatchChange();
		
	},
	
	reset : function() {
		
		scores = {};
		localforage.setItem( 'scores', scores );
		dispatchChange();
		
	}
		
};

EventDispatcher.prototype.apply( exports );

(function() {
	
	localforage.getItem('scores', function( err, value ) {
	
		if(err) return;
		scores = _.isObject( value ) ? value : {};
		
		dispatchChange();
		
	});	
	
})();


module.exports = exports;