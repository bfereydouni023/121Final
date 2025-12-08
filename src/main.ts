import * as THREE from "three";
import "./style.css";
import "./console.ts";
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
//import { Level1 } from "./levels/level1";
import { Level3 } from "./levels/level3";
import { createUIManager } from "./uiManager";

const ui = createUIManager();
// expose for other modules (Inventory, tests, etc.)
window.ui = ui;

// TUNABLE PARAMETERS]

// Ensure Rapier is loaded before proceeding
await RAPIER.init();

setWorld(new RAPIER.World({ x: 0, y: -9.81, z: 0 }));
world.timestep = 1 / 60;
const maxPhysicsStepsPerFrame = 1;
const physicsClock = new THREE.Clock();
physicsClock.autoStart = false;
physicsClock.start();
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

// --- UI: bottom-center arrow buttons (left / right) ---
ui.container.style.left = "50%";
ui.container.style.right = "auto";
ui.container.style.top = "auto";
ui.container.style.bottom = "24px";
ui.container.style.transform = "translateX(-50%)";
ui.container.style.flexDirection = "row";
ui.container.style.alignItems = "center";
ui.container.style.justifyContent = "center";
ui.container.style.gap = "12px";

// const btnStyle: Partial<CSSStyleDeclaration> = {
//     width: "56px",
//     height: "56px",
//     borderRadius: "28px",
//     fontSize: "24px",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     background: "rgba(32,32,32,0.95)", // darker fill for better contrast
//     color: "#ffffff",
//     border: "1px solid rgba(0,0,0,0.6)",
//     boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
// };

// ui.createButton(
//     "btn-left",
//     "◀",
//     () => {
//         console.debug("UI: left button clicked");
//         rotateFollowLeft();
//     },
//     { ariaLabel: "Move Left", style: btnStyle },
// );
// ui.createButton(
//     "btn-right",
//     "▶",
//     () => {
//         console.debug("UI: right button clicked");
//         rotateFollowRight();
//     },
//     { ariaLabel: "Move Right", style: btnStyle },
// );

//Escape menu: restart + light/dark toggle
const escapeMenuOverlay = document.createElement("div");
escapeMenuOverlay.style.position = "fixed";
escapeMenuOverlay.style.left = "0";
escapeMenuOverlay.style.top = "0";
escapeMenuOverlay.style.width = "100%";
escapeMenuOverlay.style.height = "100%";
escapeMenuOverlay.style.display = "none";
escapeMenuOverlay.style.alignItems = "center";
escapeMenuOverlay.style.justifyContent = "center";
escapeMenuOverlay.style.background = "rgba(0,0,0,0.6)";
escapeMenuOverlay.style.backdropFilter = "blur(6px)";
escapeMenuOverlay.style.zIndex = "30000";
escapeMenuOverlay.style.pointerEvents = "auto";

const escapeMenuPanel = document.createElement("div");
escapeMenuPanel.style.minWidth = "280px";
escapeMenuPanel.style.maxWidth = "420px";
escapeMenuPanel.style.background = "rgba(17,24,39,0.92)";
escapeMenuPanel.style.color = "#f8fafc";
escapeMenuPanel.style.padding = "24px";
escapeMenuPanel.style.borderRadius = "14px";
escapeMenuPanel.style.display = "flex";
escapeMenuPanel.style.flexDirection = "column";
escapeMenuPanel.style.gap = "16px";
escapeMenuPanel.style.boxShadow = "0 24px 60px rgba(0,0,0,0.45)";

const escapeMenuTitle = document.createElement("div");
escapeMenuTitle.textContent = "Pause Menu";
escapeMenuTitle.style.fontSize = "1.5rem";
escapeMenuTitle.style.fontWeight = "bold";

const escapeMenuDescription = document.createElement("div");
escapeMenuDescription.textContent = "Press Escape again to resume.";
escapeMenuDescription.style.opacity = "0.85";
escapeMenuDescription.style.fontSize = "0.95rem";

const escapeMenuButtons = document.createElement("div");
escapeMenuButtons.style.display = "flex";
escapeMenuButtons.style.flexDirection = "column";
escapeMenuButtons.style.gap = "12px";

//restart current level button
const restartButton = ui.createButton(
    "btn-restart-level",
    "Restart Level",
    () => {
        levelManager.resetCurrentLevel();
        escapeMenuOverlay.style.display = "none";
        isEscapeMenuOpen = false;
    },
    {
        ariaLabel: "Restart current level",
        style: {
            width: "100%",
            fontSize: "16px",
            fontWeight: "bold",
            justifyContent: "center",
        },
    },
    escapeMenuButtons,
);
restartButton.style.display = "flex";

// Level Select button (placed below Restart)
const levelSelectButton = ui.createButton(
    "btn-level-select",
    "Level Select",
    () => {
        // toggle the level-popout but keep the pause menu visible
        const pop = ensureLevelPopout();
        pop.style.display = pop.style.display === "none" ? "flex" : "none";
    },
    {
        ariaLabel: "Open level select",
        style: {
            width: "100%",
            fontSize: "16px",
            fontWeight: "bold",
            justifyContent: "center",
        },
    },
    escapeMenuButtons,
);
levelSelectButton.style.display = "flex";

// Level select popout: creates three square level buttons under restart
const LEVEL_POPOUT_ID = "level-select-popout";
function ensureLevelPopout(): HTMLDivElement {
    let pop = document.getElementById(LEVEL_POPOUT_ID) as HTMLDivElement | null;
    if (!pop) {
        pop = document.createElement("div");
        pop.id = LEVEL_POPOUT_ID;
        pop.style.display = "flex";
        pop.style.flexDirection = "row";
        pop.style.gap = "8px";
        pop.style.justifyContent = "center";
        pop.style.marginTop = "8px";

        const makeLevelButton = (label: string, levelId: string) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.style.width = "64px";
            b.style.height = "64px";
            b.style.borderRadius = "8px";
            b.style.cursor = "pointer";
            b.style.fontWeight = "600";
            b.style.fontSize = "13px";
            b.addEventListener("click", () => {
                // swap and close pause menu
                try {
                    levelManager.swapToLevel(levelId);
                } catch (err) {
                    console.warn("swapToLevel failed:", err);
                }
                setEscapeMenuVisible(false);
            });
            return b;
        };

        pop.appendChild(makeLevelButton("Level 1", "level1"));
        pop.appendChild(makeLevelButton("Level 2", "level2"));
        pop.appendChild(makeLevelButton("Level 3", "level3"));
        // initially hidden until user toggles
        pop.style.display = "none";
        escapeMenuButtons.appendChild(pop);
    }
    return pop;
}

// toggle popout when Level Select is requested
window.addEventListener("ui:levelSelect", () => {
    // keep behavior consistent if other code dispatches ui:levelSelect
    const pop = ensureLevelPopout();
    pop.style.display = pop.style.display === "none" ? "flex" : "none";
});

const modeToggleButton = ui.createModeToggleButton(escapeMenuButtons);
modeToggleButton.style.alignSelf = "center";

ui.onThemeChange((_mode, colors) => {
    escapeMenuPanel.style.background = colors.background;
    escapeMenuPanel.style.color = colors.foreground;
    escapeMenuPanel.style.border = `1px solid ${colors.border}`;
    escapeMenuPanel.style.boxShadow = colors.shadow;
    escapeMenuTitle.style.color = colors.foreground;
    escapeMenuDescription.style.color = colors.foreground;
    restartButton.style.background = colors.buttonBg;
    restartButton.style.color = colors.buttonText;
    restartButton.style.border = `1px solid ${colors.border}`;
    (restartButton.style as CSSStyleDeclaration).boxShadow = colors.shadow;

    // style the Level Select button to match
    levelSelectButton.style.background = colors.buttonBg;
    levelSelectButton.style.color = colors.buttonText;
    levelSelectButton.style.border = `1px solid ${colors.border}`;
    (levelSelectButton.style as CSSStyleDeclaration).boxShadow = colors.shadow;

    // style popout level buttons if present
    const pop = document.getElementById(
        LEVEL_POPOUT_ID,
    ) as HTMLDivElement | null;
    if (pop) {
        const btns = Array.from(pop.querySelectorAll("button"));
        for (const b of btns) {
            b.style.background = colors.buttonBg;
            b.style.color = colors.buttonText;
            b.style.border = `1px solid ${colors.border}`;
            (b.style as CSSStyleDeclaration).boxShadow = colors.shadow;
        }
    }
});

escapeMenuPanel.append(
    escapeMenuTitle,
    escapeMenuDescription,
    escapeMenuButtons,
);
escapeMenuOverlay.appendChild(escapeMenuPanel);
document.body.appendChild(escapeMenuOverlay);

let isEscapeMenuOpen = false;
function setEscapeMenuVisible(visible: boolean) {
    escapeMenuOverlay.style.display = visible ? "flex" : "none";
    isEscapeMenuOpen = visible;
}

escapeMenuOverlay.addEventListener("click", (event) => {
    if (event.target === escapeMenuOverlay) setEscapeMenuVisible(false);
});

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        setEscapeMenuVisible(!isEscapeMenuOpen);
    }
});

// Todo: move camera setup to a helper function
setupCamera();

// update on window resize
window.addEventListener("resize", () => {
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.onfocus = () => {
    physicsClock.start();
};

window.onblur = () => {
    physicsClock.stop();
};

// Raycast click detection leverages the Input singleton + Rapier queries
input.addEventListener("mouseDown", (mouseEvent) => {
    const hit = input.raycastPhysics(
        renderer as THREE.WebGLRenderer,
        mainCamera,
        {
            predicate: (collider) =>
                getGameObjectFromCollider(collider)?.name === "ball",
        },
    );
    const go = hit?.gameObject;
    if (!go) return;

    const script = go.getComponent(ScriptComponent);
    script?.onClicked?.(mouseEvent);
});

// perform actual swap outside physics loop when requested by game logic
window.addEventListener("request:level-swap", (ev: Event) => {
    const id = (ev as CustomEvent).detail?.id;
    if (!id) return;
    // defer to next macrotask so we are not inside physics iteration
    setTimeout(() => {
        try {
            levelManager.swapToLevel(id);
            console.debug(`[Main] swapped to ${id} (deferred)`);
        } catch (err) {
            console.warn(`[Main] deferred swapToLevel(${id}) failed:`, err);
        }
    }, 0);
});

levelManager.swapToLevel(Level3.name);
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

//Eslint told me this code was unused
// find ball mesh/object (adjust to your API - example finds mesh with userData.type === 'ball')
// let ballObject: THREE.Object3D | null = null;
// scene.traverse((o) => {
//     const ud = (o as unknown as { userData?: Record<string, unknown> })
//         .userData;
//     if (ud && ud.type === "ball") ballObject = o;
// });

function gameLoop() {
    const delta = renderClock.getDelta();

    // Update FPS counter
    updateFPSCounter(delta);

    // Update physics with fixed timestep
    physicsAccumulator += physicsClock.getDelta();
    // Cap the accumulator to avoid spiral of death after tab switch
    if (physicsAccumulator > maxPhysicsStepsPerFrame * world.timestep) {
        physicsAccumulator = maxPhysicsStepsPerFrame * world.timestep;
    }
    let steps = 0;
    while (physicsAccumulator >= world.timestep) {
        physicsUpdate();
        physicsAccumulator -= world.timestep;
        steps++;
    }
    if (steps > 1) {
        console.debug(`Physics steps this frame: ${steps}`);
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

    physicsEventQueue.drainCollisionEvents((handle1, handle2, started) => {
        const obj1 = getGameObjectFromCollider(world.getCollider(handle1));
        const obj2 = getGameObjectFromCollider(world.getCollider(handle2));
        if (!obj1 || !obj2) return;

        for (const script of obj1.getComponents(ScriptComponent)) {
            if (started) {
                script.onCollisionEnter?.(obj2);
            } else {
                script.onCollisionExit?.(obj2);
            }
        }
        for (const script of obj2.getComponents(ScriptComponent)) {
            if (started) {
                script.onCollisionEnter?.(obj1);
            } else {
                script.onCollisionExit?.(obj1);
            }
        }
    });
}

// Quick keys to swap levels: 1 -> Level1, 2 -> Level2, 3 -> Level3 (if registered)
window.addEventListener("keydown", (ev: KeyboardEvent) => {
    // ignore if typing in an input
    const active = document.activeElement;
    if (
        active &&
        (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable)
    )
        return;

    const k = ev.key;
    if (k === "1" || k === "2" || k === "3") {
        const id = `level${k}`;
        try {
            levelManager.swapToLevel(id);
            console.debug(`[Main] swapped to ${id}`);
        } catch (err) {
            console.warn(`[Main] swapToLevel(${id}) failed:`, err);
        }
    }
});
