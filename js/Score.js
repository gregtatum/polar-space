var Score = function() {
	this.$score = $('#score');
	this.$enemiesCount = $('#enemies-count');
	this.$win = $('.win');
	this.$winScore = $('#win-score');
	this.score = 0;
	this.enemiesCount = 0;
	
	this.won = false;
};

module.exports = Score;

Score.prototype = {
	
	adjustEnemies : function( count ) {
		if(this.won) return;
		this.enemiesCount += count;
		this.$enemiesCount.text( this.enemiesCount );
		
		if( this.enemiesCount === 0 ) {
			this.showWin();
		}
		return this.enemiesCount;
	},
	
	adjustScore : function( count ) {
		if(this.won) return;
		this.score += count;
		this.$score.text( this.score );
		return this.score;
	},
	
	showWin : function() {
		
		this.won = true;
		
		this.$winScore.text( this.score );
		this.$win.show();
		this.$win.css({
			opacity: 1
		});
	}
	
};