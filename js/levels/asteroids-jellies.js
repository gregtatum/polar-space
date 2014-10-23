module.exports = {
	asteroidField : {
		object: require("../managers/AsteroidField"),
		properties: {
			count : 20
		} 
	},
	jellyManager : {
		object: require("../managers/EntityManager"),
		properties: {
			entityType: require('../entities/Jellyship'),
			count: 25
		}
	},
	music : {
		object: require("../sound/Music"),
		properties: {
			url: "https://soundcloud.com/thecarrotfreak-1/the-end-of-our-journey"
		}
	}
}