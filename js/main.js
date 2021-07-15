import * as THREE from '../build/three.module.js';

import { MapControls } from './jsm/controls/OrbitControls.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import { Interaction } from './src/interaction.js';
import { UserInterface } from './src/UserInterface.js';

import {Loader} from './src/loader.js';

let camera, controls, scene, renderer;

let raycaster;

let loadGroup;

let animationMixer;

var container = document.getElementById("container");

const clock = new THREE.Clock();

let newObjects = [];

var loader;
var interaction;

var userInterface;

init();
animate();

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xcccccc);
	//scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	container.appendChild(renderer.domElement);

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 1, 10000);
	scene.add(camera);
	camera.position.set(400, 200, 0);

	// controls

	controls = new MapControls(camera, renderer.domElement);

	//controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

	controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
	controls.dampingFactor = 0.05;

	controls.screenSpacePanning = false;

	controls.minDistance = 5;
	controls.maxDistance = 500;

	controls.maxPolarAngle = Math.PI / 2;



	raycaster = new THREE.Raycaster();


	//CONTENT
	loadGroup = new THREE.Group();
	scene.add(loadGroup);

	loader = new Loader(loadGroup, camera);
	interaction = new Interaction(loader.getObjects(), renderer.domElement, camera, controls, scene);
	userInterface = new UserInterface(document.getElementById("settings-panel"), interaction);
	interaction.setUserInterface(userInterface);

	//LIGHTS
	const light = new THREE.DirectionalLight(0xffffff, 1.3, 100);
	light.position.set(1, 1, 1); //default; light shining from top
	light.castShadow = true; // default false
	light.shadow.camera.near = 0.5; // default
	light.shadow.camera.far = 5000;
	light.shadow.mapSize.width = 1024 * 4;
	light.shadow.mapSize.height = 1024 * 4;

	const d = 300;

	light.shadow.camera.left = - d;
	light.shadow.camera.right = d;
	light.shadow.camera.top = d;
	light.shadow.camera.bottom = - d;
	scene.add(light);

	const light2 = new THREE.DirectionalLight(0xffcccc, 0.5, 100);
	light2.position.set(-100, 100, -100); //default; light shining from top
	light2.castShadow = true; // default false
	light2.shadow.camera.near = 0.5; // default
	light2.shadow.camera.far = 5000;
	light2.shadow.mapSize.width = 1024 * 4;
	light2.shadow.mapSize.height = 1024 * 4;

	light2.shadow.camera.left = - d;
	light2.shadow.camera.right = d;
	light2.shadow.camera.top = d;
	light2.shadow.camera.bottom = - d;
	scene.add(light2);
	const light3 = new THREE.AmbientLight(0xffffff, 0.7); // soft white light
	scene.add( light3 );


	window.addEventListener('resize', onWindowResize, false);

	window.addEventListener( 'dragover', onDragOver, false );
	
	window.addEventListener( 'dragend', onDragEnd, false );
	window.addEventListener( 'dragleave', onDragEnd, false );
	window.addEventListener( 'dragexit', onDragEnd, false );

	window.addEventListener( 'drop', onDrop, true );

	renderer.domElement.addEventListener('click', onClick, false);
	userInterface.init();
}

function onClick(event) {
	interaction.select(new THREE.Vector2(event.clientX, event.clientY));
	console.log("hello");
}

function onMouseUp(event) {
	interaction.onAfterInteraction(new THREE.Vector2(event.clientX, event.clientY));
}

function onDrop(event) {
	console.log(event);
	event.preventDefault();
	
	document.getElementById("progress-bar1").style.width = 0;
	document.getElementById("progress").classList.remove("hidden");
	var totalFilesRead = 0;
	var files = event.dataTransfer.files;
	loader.addObjectsNbTotal(files.length);
	for(var i = 0; i < event.dataTransfer.files.length; i++) {
		var processFile = function(file) {
			var reader = new FileReader();
			reader.onload = function(event) {
				loader.addFromUrl(event.target.result, file.name);
				totalFilesRead++;
				document.getElementById("progress-bar1").style.width = (totalFilesRead / files.length) * 100 + "%";
			}
			reader.readAsDataURL(file);
		}
		processFile(event.dataTransfer.files[i]);
	}
	controls.enabled = true;
	document.getElementById("drop-start").classList.add("hidden");
}

function hideProgressBar() {
	document.getElementById("progress").classList.add("hidden");
}


function onDragEnd(event) {
	if ((event.srcElement === renderer.domElement && event.fromElement === null) || (event.srcElement === document.getElementById("drop-start") && event.fromElement === null)) {
		controls.enabled = true;
		document.getElementById("drop-start").classList.add("hidden");
	}
}

function onDragOver(event) {
	event.preventDefault();
	controls.enabled = false;
	document.getElementById("drop-start").classList.remove("hidden");
} 

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

	requestAnimationFrame(animate);

	controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
	render();
	loader.tick();
	interaction.tick(clock.getDelta());
}

function render() {
	renderer.render(scene, camera);
}