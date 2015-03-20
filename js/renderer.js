require('./postprocessing');
require('./shaders/CopyShader');
require('./shaders/FilmShader');
require('./shaders/ConvolutionShader');
require('./shaders/FXAAShader');
var chromaticAberrationShader = require('./postprocessing/chromaticAberration');

//Singletons
var _ratio = _.isNumber( window.devicePixelRatio ) ? window.devicePixelRatio : 1;
var _renderer = addRenderer();
var _rendererPass = new THREE.RenderPass();
var _composer = addEffectsComposer( _rendererPass );

function addEffectsComposer( renderPass ) {
	
	var bloom = new THREE.BloomPass( 4, 10, 16, 512 );
	var copy = new THREE.ShaderPass( THREE.CopyShader );
	var antialias = new THREE.ShaderPass( THREE.FXAAShader );
	var chromaticAberration = new THREE.ShaderPass( chromaticAberrationShader );
	
	antialias.uniforms.resolution.value.set(
		1 / (window.innerWidth * _ratio),
		1 / (window.innerHeight * _ratio)
	);
	copy.renderToScreen = true;

	var composer = new THREE.EffectComposer( _renderer );
	composer.renderTarget1.setSize( window.innerWidth * _ratio, window.innerHeight * _ratio );
	composer.renderTarget2.setSize( window.innerWidth * _ratio, window.innerHeight * _ratio );

	composer.addPass( renderPass );
	composer.addPass( antialias );
	composer.addPass( chromaticAberration );
	composer.addPass( bloom );
	composer.addPass( copy );
	
	return composer;
	
}

function addSceneAndCameraToEffects( scene, camera ) {
	
	_rendererPass.scene = scene;
	_rendererPass.camera = camera;
	
}

var newResizeHandler = (function() {
	
	var handler;
	var $window = $(window);
	
	return function( camera ) {
		
		var newHandler = function() {
			
			_renderer.setSize(
				window.innerWidth,
				window.innerHeight
			);
			
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			
		};
		
		if( handler ) {
			$(window).off('resize', handler);
		}
		
		$window.on('resize', newHandler);
		
		handler = newHandler;
		
	};
		
})();

function addRenderer() {
	
	_renderer = new THREE.WebGLRenderer();
	_renderer.setPixelRatio( _ratio );
	_renderer.setSize(
		window.innerWidth,
		window.innerHeight
	);
	_renderer.setClearColor( 0x111111 );
	document.getElementById( 'container' ).appendChild( _renderer.domElement );
	
	_renderer.autoClear = false;
	
	return _renderer;
	
}

function handleNewPoem( poem ) {
		
	var scene = poem.scene;
	var camera = poem.camera.object;
	
	addSceneAndCameraToEffects( scene, camera );
	newResizeHandler( camera );
	
	poem.on( 'draw', function() {
		_composer.render( scene, camera );
	});

}

module.exports = handleNewPoem;