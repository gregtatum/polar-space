var scores = require('../components/scores');
var levelKeyPairs = sortAndFilterLevels( require('../levels') );

function sortAndFilterLevels( levels ) {
		
	return _.chain(levels)
		.pairs()
		.filter(function( keypair ) {
			return keypair[1].order;
		})
		.sortBy(function( keypair ) {
			return keypair[1].order;
		})
	.value();
	
}

function reactiveLevels( $scope, template ) {
	
	$scope.children().remove();
	
	var templateData = _.map( levelKeyPairs, function( keypair ) {
		
		var slug = keypair[0];
		var level = keypair[1];
		
		var score = scores.get( slug );
		return {
			name : level.name,
			description : level.description,
			slug : slug,
			percent : score.percent,
			score : score.value,
			total : score.total,
			leftOrRight : score.unitI < 0.5 ? "right" : "left"
		};
		
	});
	
	$scope.append( _.reduce( templateData, function( memo, text) {
		
		return memo + template( text );
		
	}, "") );
}

(function init() {
	
	var template = _.template( $('#menu-level-template').text() );
	var $scope = $('#menu-levels');
	
	function updateReactiveLevels() {
		reactiveLevels( $scope, template );
	};
	
	scores.on( 'change', updateReactiveLevels );
	updateReactiveLevels();
	
})();
