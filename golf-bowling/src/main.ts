import * as THREE from 'three';
import './style.css';
import * as RAPIER from '@dimforge/rapier3d-compat';

// Ensure Rapier is loaded before proceeding
await RAPIER.init();

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60;
const physicsClock = new THREE.Clock();
const physicsEventQueue = new RAPIER.EventQueue(true);

// Start the physics update loop
setInterval(physicsUpdate, world.timestep * 1000);

const renderClock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(renderUpdate);
document.body.appendChild(renderer.domElement);

//#region Test scene
// TEST INTERFACE - REPLACE
interface GameObject {
    mesh: THREE.Mesh;
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
}
const sphere = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
scene.add(sphere);

camera.position.z = 5;

const ball = new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Dynamic)
.setTranslation(0, 5, 0)
.setLinvel(1, 0, 0);
const ballBody = world.createRigidBody(ball);
const ballColliderDesc = RAPIER.ColliderDesc.ball(0.5).setRestitution(0.7);
const ballCollider = world.createCollider(ballColliderDesc, ballBody);
const object: GameObject = {
    mesh: sphere,
    body: ballBody,
    collider: ballCollider,
};

const ground = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), new THREE.MeshBasicMaterial({ color: 0x888888 }));
ground.position.y = -0.5;
scene.add(ground);

const groundBody = world.createRigidBody(new RAPIER.RigidBodyDesc(RAPIER.RigidBodyType.Fixed));
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(5, 0.5, 5).setFriction(0.8);
const groundCollider = world.createCollider(groundColliderDesc, groundBody);
//#endregion


function renderUpdate() {
    const _delta = renderClock.getDelta();
    // Manual mesh update from physics bodies example
    object.mesh.position.copy(object.body.translation() as THREE.Vector3);
    object.mesh.quaternion.copy(object.body.rotation() as THREE.Quaternion);
    renderer.render(scene, camera);
}

function physicsUpdate() {
    // Physics update logic goes here
    const _delta = physicsClock.getDelta();
    world.step(physicsEventQueue);
}

