var numberOfJellies = 25;

module.exports = {
	name : "Polar Rocks",
	description : "Flight into the asteroid field",
	order : 2,
	maxScore : numberOfJellies * 13,
	config : {
		scoringAndWinning: {
			message: "Arachnids detected in the next sector.<br/>Please spare their babies.<br/>",
			nextLevel: "web",
			conditions: [
				{
					//Jelly manager has 0 live ships
					component: "jellyManager",
					properties: null
				}		
			]
		},
		fog : {
			nearFactor : 0.25,
			farFactor : 1.7,
		}
	},
	objects : {
		rails : {
			object: require("../components/Rails"),
			properties : {}
		},
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
				count: numberOfJellies
			}
		},
		cameraIntro : {
			object: require("../components/CameraIntro"),
			properties: {
				speed : 0.975,
				heightMultiplier : 2
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/the-end-of-our-journey"
			}
		}
	}
};