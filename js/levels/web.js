var numberOfArachnids = 20;

module.exports = {
	name : "Stuck in the Web",
	description : "Don't hurt the babies",
	maxScore : 23 * numberOfArachnids,
	order: 3,
	config : {
		r : 110,
		// height : 60,
		// circumference : 900,
		cameraMultiplier : 2,
		scoringAndWinning: {
			message: "You saved this sector<br/>on to the next level.",
			nextLevel: "intro",
			conditions: [
				{
					//No arachnids left
					component: "arachnids",
					properties: null
				}
			]
		},
		stars: {
	 		 count: 3000
		}
	},
	objects : {
		web : {
			object: require("../components/Web"),
			properties: {}
		},
		// cameraIntro : {
		// 	object: require("../components/CameraIntro"),
		// 	properties: {
		// 		speed : 0.989
		// 	}
		// },
		spiderlings : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Spiderlings'),
				count: 0
			}
		},
		arachnids : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Arachnid'),
				count: numberOfArachnids
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/electrochip-artillery"
			}
		}
	}
};