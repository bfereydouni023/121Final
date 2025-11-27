import * as THREE from 'three';
import './style.css';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { renderer, setRenderer, setWorld, world } from './globals';
import { getActivePhysicsComponents, getActiveRenderComponents } from './objectSystem';
import { createLevel } from './levels/level1';


// Ensure Rapier is loaded before proceeding
await RAPIER.init();

setWorld(new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
world.timestep = 1 / 60;
const physicsClock = new THREE.Clock();
const physicsEventQueue = new RAPIER.EventQueue(true);

// Start the physics update loop
setInterval(physicsUpdate, world.timestep * 1000);

const renderClock = new THREE.Clock();
const scene = new THREE.Scene();

// set a visible background color
scene.background = new THREE.Color(0x87ceeb);

// add some ambient lighting so dark/shadowed areas are visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
//Seems to be undeclared?
//setMainCamera(camera);

// set up camera position and target
//camera.position.set(0, -35, 20);
camera.position.set(0, 15, 30);
// Tilt camera down 15 degrees (pitch) — rotate around the X axis:
camera.rotation.set(THREE.MathUtils.degToRad(-25), 0, 0);

// update on window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

createLevel(scene);

setRenderer(new THREE.WebGLRenderer());
// make sure the WebGL clear color matches the scene background
renderer.setClearColor(0x87ceeb, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(renderUpdate);
document.body.appendChild(renderer.domElement);

function renderUpdate() {
    const _delta = renderClock.getDelta();
    let components = getActiveRenderComponents();
    for (let i = 0; i < components.length; i++) {
        components[i].renderUpdate!(_delta);
    }
    renderer.render(scene, camera);
}

function physicsUpdate() {
    //Try world.step going first
    world.step(physicsEventQueue);

    // Physics update logic goes here
    const _delta = physicsClock.getDelta();
    let components = getActivePhysicsComponents();
    for (let i = 0; i < components.length; i++) {
        components[i].physicsUpdate!(_delta);
    }
   
}

