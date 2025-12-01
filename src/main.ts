import * as THREE from "three";
import "./style.css";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
  renderer,
  setMainCamera,
  setRenderer,
  setWorld,
  world,
} from "./globals";
import {
  createGameObject,
  getActivePhysicsComponents,
  getActiveRenderComponents,
  getObjectByID,
  getObjectWithComponent,
} from "./objectSystem";
import { createLevel } from "./levels/level1";
import { performRaycastFromMouse, findFirstTaggedHit } from "./input";
import {
  CameraComponent,
  FollowComponent,
  ScriptComponent,
  TransformComponent,
} from "./components";

// TUNABLE PARAMETERS]

// Ensure Rapier is loaded before proceeding
await RAPIER.init();

setWorld(new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
world.timestep = 1 / 60;
const physicsClock = new THREE.Clock();
const physicsEventQueue = new RAPIER.EventQueue(true);

// Start the physics update loop
// keep the interval id so we can stop physics on victory
let physicsInterval: number | null = window.setInterval(
  physicsUpdate,
  world.timestep * 1000,
);
let gamePaused = false;

function pauseGameForVictory() {
  if (gamePaused) return;
  gamePaused = true;
  // stop physics
  if (physicsInterval !== null) {
    clearInterval(physicsInterval);
    physicsInterval = null;
  }
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

const renderClock = new THREE.Clock();
const scene = new THREE.Scene();

// set a visible background color
scene.background = new THREE.Color(0x87ceeb);

// add some ambient lighting so dark/shadowed areas are visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
setMainCamera(camera);

// Initialize renderer before creating the level so renderer.domElement exists
setRenderer(new THREE.WebGLRenderer());
renderer.setClearColor(0x87ceeb, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// create the level (pass the renderer DOM element for input listeners, etc.)
const created = createLevel(scene, camera, renderer.domElement);

// Todo: move camera setup to a helper function
{
  const cameraObject = createGameObject("Main Camera");
  cameraObject.addComponent(TransformComponent);
  const cameraComponent = cameraObject.addComponent(CameraComponent);
  const followComponent = cameraObject.addComponent(FollowComponent);
  cameraComponent.camera = camera;
  followComponent.target =
    getObjectByID("ball")!.getComponent(TransformComponent)!;
  followComponent.positionOffset = { x: 0, y: 15, z: 15 };
  followComponent.rotationOffset = { x: -Math.PI / 4, y: 0, z: 0, w: 0 };
}

// update on window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Raycast click detection: delegate logic to input helpers and invoke ball script onClicked
window.addEventListener("mousedown", async (ev: MouseEvent) => {
  ev.preventDefault();
  const hits = performRaycastFromMouse(
    ev,
    renderer as THREE.WebGLRenderer,
    camera,
    scene,
  );
  if (hits.length === 0) return;
  const tagged = findFirstTaggedHit(hits, "ball");
  if (!tagged) return;

  const go = (tagged as any).userData?.gameObject;
  if (!go) return;

  // Prefer calling a script hook on the ball if present
  const script = go.getComponent ? go.getComponent(ScriptComponent) : null;
  if (script && (script as any).onClicked) {
    try {
      (script as any).onClicked(ev);
    } catch (e) {
      console.error("onClicked error", e);
    }
    return;
  }

  // Fallback: try to apply impulse directly if no script is present (keeps previous behavior)
  const rbComp = go.getComponent
    ? go.getComponent((await import("./components")).RigidbodyComponent)
    : null;
  if (
    rbComp &&
    rbComp.rigidbody &&
    typeof (rbComp.rigidbody as any).applyImpulse === "function"
  ) {
    // apply a small random impulse as a fallback
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 0.8 + 0.2,
      Math.random() * 2 - 1,
    ).normalize();
    const strength = 5 + Math.random() * 10;
    const impulse = {
      x: dir.x * strength,
      y: dir.y * strength,
      z: dir.z * strength,
    };
    (rbComp.rigidbody as any).applyImpulse(impulse, true);
  }
});

renderer.setAnimationLoop(renderUpdate);

function renderUpdate() {
  const _delta = renderClock.getDelta();
  const components = getActiveRenderComponents();
  for (let i = 0; i < components.length; i++) {
    components[i].renderUpdate!(_delta);
  }

  renderer.render(scene, camera);
}

function physicsUpdate() {
  world.step(physicsEventQueue);

  const _delta = physicsClock.getDelta();
  const components = getActivePhysicsComponents();
  for (let i = 0; i < components.length; i++) {
    components[i].physicsUpdate!(_delta);
  }
}
