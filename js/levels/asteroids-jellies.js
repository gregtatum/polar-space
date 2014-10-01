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
			shipType: require('../entities/Jellyship'),
			count: 25
		}
	},
}