var numberOfJellies = 100;

module.exports = {
	name : "Stuck in the Web",
	description : "Free the stuck alliance ships",
	maxScore : 13 * numberOfJellies,
	config : {
		// r : 200,
		// height : 60,
		// circumference : 900,
		// cameraMultiplier : 2,
		scoringAndWinning: {
			message: "You saved this sector<br/>on to the next level.",
			nextLevel: "intro",
			conditions: [
				{
					//Jelly manager has 0 live ships
					component: "jellyManager",
					properties: null
				}
			]
		},
		// stars: {
		// 	count: 3000
		// }
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
		jellyManager : {
			object: require("../managers/EntityManager"),
			properties: {
				entityType: require('../entities/Jellyship'),
				count: numberOfJellies
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/the-sun-is-rising-chip-music"
			}
		}
	}
};