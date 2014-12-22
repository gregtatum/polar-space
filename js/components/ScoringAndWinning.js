/*
	Set the win conditions in the level manifest as below

		properties: {
			conditions: [
				{
					component: "jellyManager",
					properties: null
				}
			]
		}

	Psuedo-code gets called:

		jellyManager.watchForCompletion( winCheck, properties );

	Then in the jellyManager component, call the following when condition is completed:

		scoringAndWinning.reportConditionCompleted();

*/
var hasher = require('hasher');
var scores = require('./scores');

var ScoringAndWinning = function( poem, properties ) {
	
	properties = _.isObject( properties ) ? properties : {};
	
	this.poem = poem;
	
	this.$score = $('#score-value');
	this.$enemiesCount = $('#enemies-count');
	this.$win = $('#win');
	this.$winScore = $('#win-score');
	this.$winText = this.$win.find('h1:first');
	this.$scoreMessage = $('#score-message');
	this.$nextLevel = $('#next-level');
	this.$canvas = $( this.poem.getCanvas() );
	
	this.score = 0;
	this.enemiesCount = 0;
	this.scoreMessageId = 0;
	this.message = _.isString( properties.message ) ? properties.message : "You Win";
	this.nextLevel = properties.nextLevel ? properties.nextLevel : null;
	this.won = false;
	
	this.conditionsCount = _.isArray( properties.conditions ) ? properties.conditions.length : 0;
	this.conditionsRemaining = this.conditionsCount;
	
	this.poem.on('levelParsed', function() {
		this.setConditions( properties.conditions );
	}.bind(this));
	
};

module.exports = ScoringAndWinning;

ScoringAndWinning.prototype = {
	
	setConditions : function( conditions ) {
		
		// Start watching for completion for all components
		
		_.each( conditions, function( condition ) {
		
			var component = this.poem[condition.component];
			var args = _.union( this, condition.properties );
		
			component.watchForCompletion.apply( component, args );
		
		}.bind(this));
		
	},
	
	reportConditionCompleted : function() {
		
		_.defer(function() {
			
			this.conditionsRemaining--;
		
			if( this.conditionsRemaining === 0 ) {
			
				this.poem.ship.disable();
				this.won = true;
				this.conditionsCompleted();
			
			}
			
		}.bind(this));		
	},
	
	adjustEnemies : function( count ) {
		
		// if(this.won) return;
		
		this.enemiesCount += count;
		this.$enemiesCount.text( this.enemiesCount );
		
		return this.enemiesCount;
	},
	
	adjustScore : function( count, message, style ) {
		
		if(this.won) return;
		
		this.score += count;
		this.$score.text( this.score );
		
		if( message ) {
			this.showMessage( message, style );
		}
		
		return this.score;
	},
	
	showMessage : function( message, style ) {
		
		var $span = $('<span></span>').text( message );
		
		if( style ) $span.css( style );
		
		this.$scoreMessage.hide();
		this.$scoreMessage.empty().append( $span );
		this.$scoreMessage.removeClass('fadeout');
		this.$scoreMessage.addClass('fadein');
		this.$scoreMessage.show();
		this.$scoreMessage.removeClass('fadein');
		
		var id = ++this.scoreMessageId;
		
		setTimeout(function() {
			
			if( id === this.scoreMessageId ) {
				this.$scoreMessage.addClass('fadeout');
			}
			
		}.bind(this), 2000);
		
	},
	
	conditionsCompleted : function() {
				
		this.$winScore.text( this.score );
		this.$winText.html( this.message );
		
		this.showWinScreen();
		
		this.$nextLevel.one( 'click', function( e ) {
			
			e.preventDefault();
			
			hasher.setHash("level/" + this.nextLevel );
			
			this.hideWinScreen();
			
			
		}.bind(this));
	},
	
	showWinScreen : function() {
		
		this.$win
			.removeClass('transform-transition')
			.addClass('hide')
			.addClass('transform-transition')
			.show();
		
		this.$canvas.css('opacity', 0.3);
		
		scores.set( this.poem.slug, this.score );
		
		setTimeout(function() {
			this.$win.removeClass('hide');
		}.bind(this), 1);
		
		this.poem.on( 'destroy', this.hideWinScreen.bind(this) );
		
	},
	
	hideWinScreen : function() {
		
		this.$win.addClass('hide');
		this.$canvas.css('opacity', 1);
		
		setTimeout(function() {
			this.$win.hide();
		}.bind(this), 1000);
		
	},
	
};