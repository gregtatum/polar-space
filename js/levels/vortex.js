var numberOfGoodies = 20;
var numberOfBaddies = 20;

module.exports = {
	name : "The Polar Vortex",
	description : "Swirlies",
	maxScore : 10 * numberOfGoodies,
	order: 4,
	config : {
		r : 110,
		// height : 60,
		// circumference : 900,
		camera: {
			multiplier : 2,
			farFrustum : 10000
		},
		fog : {
			color: 0x223322,
			nearFactor : 0.5,
			farFactor : 1.3
		},
		scoringAndWinning: {
			// message: "Hopefully the spiderlings will grow into pleasant individuals. Follow me on <a href='https://twitter.com/tatumcreative'>Twitter</a> for updates on new levels.",
			nextLevel: "titles",
			conditions: []
		},
		stars: {
	 		 count: 4000
		}
	},
	objects : {
		sky : {
			object: require("../components/Sky"),
			properties: {}
		},
		cloudsBottom : {
			object: require("../components/Clouds"),
			properties: {
				height: -200,
				rotation: Math.PI / 2
			}
		},
		rails : {
			object: require("../components/Rails"),
			properties : {}
		},
		// cloudsTop : {
		// 	object: require("../components/Clouds"),
		// 	properties: {
		// 		height: 200,
		// 		rotation: Math.PI / 2,
		// 		offset: new THREE.Vector2(0.5,0.8)
		// 	}
		// },
		splinePathCenter : {
			object: require("../components/SplinePathCenter"),
			properties: {}
		},
		asteroidField : {
			object: require("../managers/AsteroidField"),
			properties: {
				count : 5,
				maxRadius : 60,
				range : [0.5,1.0]
			}
		},
		music : {
			object: require("../sound/Music"),
			properties: {
				url: "https://soundcloud.com/theelectrochippers/game-track-2",
				// startTime: 12,
				volume: 0.75
			}
		},
		cameraIntro : {
			object: require("../components/CameraIntro"),
			properties: {
				speed : 0.985,
				heightMultiplier : 1.1
			}
		}
	}
};