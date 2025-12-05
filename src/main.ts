import * as THREE from "three";
import "./style.css";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    renderer,
    mainCamera,
    setMainCamera,
    setRenderer,
    setWorld,
    world,
    scene,
    setScene,
    cameraMapViewTransform,
} from "./globals";
import {
    createGameObject,
    getActivePhysicsComponents,
    getActiveRenderComponents,
    getSingletonComponent,
} from "./objectSystem";
import { Input } from "./input";
import {
    CameraComponent,
    FollowComponent,
    ScriptComponent,
    TransformComponent,
    getGameObjectFromCollider,
} from "./components";
import { TweenManager } from "./tweenManager";
import { LevelManager } from "./levelManager";
import type { MainCamera } from "./types";
import { Level1 } from "./levels/level1";

// TUNABLE PARAMETERS]

// Ensure Rapier is loaded before proceeding
await RAPIER.init();

setWorld(new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
world.timestep = 1 / 60;
const physicsClock = new THREE.Clock();
physicsClock.autoStart = false;
const physicsEventQueue = new RAPIER.EventQueue(true);

let gamePaused = false;

function pauseGameForVictory() {
    if (gamePaused) return;
    gamePaused = true;
    // stop render loop
    if (typeof renderer?.setAnimationLoop === "function") {
        renderer.setAnimationLoop(null);
    }
    // show victory UI
    showVictoryOverlay();
}

// listen for the goal's victory event
window.addEventListener("game:victory", () => {
    pauseGameForVictory();
});

// create and show the fade-to-black + "You win!" overlay
function showVictoryOverlay() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.style.pointerEvents = "auto";
    overlay.style.background = "rgba(0,0,0,0)";
    overlay.style.transition = "background 600ms ease";

    const text = document.createElement("div");
    text.textContent = "You win!";
    text.style.color = "white";
    text.style.fontFamily = "system-ui, Arial, sans-serif";
    text.style.fontSize = "4rem";
    text.style.opacity = "0";
    text.style.transition = "opacity 800ms ease, transform 800ms ease";
    text.style.transform = "translateY(10px)";

    overlay.appendChild(text);
    document.body.appendChild(overlay);

    // force layout, then animate
    void overlay.offsetWidth;
    overlay.style.background = "rgba(0,0,0,0.9)";
    text.style.opacity = "1";
    text.style.transform = "translateY(0)";
}

function createFPSCounter(): void {
    fpsElement = document.createElement("div");
    fpsElement.style.position = "absolute";
    fpsElement.style.top = "10px";
    fpsElement.style.left = "10px";
    fpsElement.style.color = "white";
    fpsElement.style.fontFamily = "monospace";
    fpsElement.style.fontSize = "16px";
    fpsElement.style.zIndex = "1000";
    document.body.appendChild(fpsElement);
}

function updateFPSCounter(delta: number): void {
    fpsDeltas.push(delta);
    if (fpsDeltas.length > maxDeltas) fpsDeltas.shift();
    const avgDelta = fpsDeltas.reduce((a, b) => a + b, 0) / fpsDeltas.length;
    const fps = Math.round(1 / avgDelta);
    fpsElement.textContent = `FPS: ${fps}`;
}

const renderClock = new THREE.Clock();
setScene(new THREE.Scene());

// FPS counter variables
let fpsElement: HTMLDivElement;
const fpsDeltas: number[] = [];
const maxDeltas = 10;

// Physics accumulator for fixed timestep
let physicsAccumulator = 0;

// set a visible background color
scene.background = new THREE.Color(0x87ceeb);

// add some ambient lighting so dark/shadowed areas are visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
setMainCamera(setupCamera());

// Initialize renderer before creating the level so renderer.domElement exists
setRenderer(new THREE.WebGLRenderer());
renderer.setClearColor(0x87ceeb, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create FPS counter
createFPSCounter();

const input = getSingletonComponent(Input);
const tweenManager = getSingletonComponent(TweenManager);
const levelManager = getSingletonComponent(LevelManager);
input.setPointerElement(renderer.domElement);

// Todo: move camera setup to a helper function
setupCamera();

// update on window resize
window.addEventListener("resize", () => {
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Raycast click detection leverages the Input singleton + Rapier queries
input.addEventListener("mouseDown", (mouseEvent) => {
    const hit = input.raycastPhysics(
        renderer as THREE.WebGLRenderer,
        mainCamera,
        {
            predicate: (collider) =>
                getGameObjectFromCollider(collider)?.id === "ball",
        },
    );
    const go = hit?.gameObject;
    if (!go) return;

    const script = go.getComponent(ScriptComponent);
    script?.onClicked?.(mouseEvent);
});

levelManager.swapToLevel(typeof Level1);
renderer.setAnimationLoop(gameLoop);

function setupCamera(): MainCamera {
    const cameraObject = createGameObject("Main Camera");
    const transform = cameraObject.addComponent(TransformComponent);
    cameraObject.addComponent(FollowComponent);
    const cameraComponent = cameraObject.addComponent(CameraComponent);
    cameraComponent.camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
    );
    transform.position = cameraMapViewTransform.position;
    transform.rotation = cameraMapViewTransform.rotation;
    cameraComponent.camera.rotation.order = "YXZ"; // set rotation order to avoid gimbal lock
    const mainCam = cameraComponent.camera as MainCamera;
    mainCam.gameObject = cameraObject;
    return mainCam;
}

function gameLoop() {
    const delta = renderClock.getDelta();

    // Update FPS counter
    updateFPSCounter(delta);

    // Update physics with fixed timestep
    physicsAccumulator += delta;
    while (physicsAccumulator >= world.timestep) {
        physicsUpdate();
        physicsAccumulator -= world.timestep;
    }

    tweenManager.updateTweens(delta);

    renderUpdate(delta);
}

function renderUpdate(delta: number) {
    const components = getActiveRenderComponents();
    for (let i = 0; i < components.length; i++) {
        components[i].renderUpdate!(delta);
    }

    renderer.render(scene, mainCamera);
}

function physicsUpdate(delta: number = world.timestep) {
    world.step(physicsEventQueue);

    const components = getActivePhysicsComponents();
    for (let i = 0; i < components.length; i++) {
        components[i].physicsUpdate!(delta);
    }
}
