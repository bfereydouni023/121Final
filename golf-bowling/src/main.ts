import * as THREE from 'three';
import './style.css';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { renderer, setRenderer, setWorld, world } from './globals';
import { getActivePhysicsComponents, getActiveRenderComponents } from './objectSystem';

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
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

setRenderer(new THREE.WebGLRenderer());
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
    // Physics update logic goes here
    const _delta = physicsClock.getDelta();
    let components = getActivePhysicsComponents();
    for (let i = 0; i < components.length; i++) {
        components[i].physicsUpdate!(_delta);
    }
    world.step(physicsEventQueue);
}

