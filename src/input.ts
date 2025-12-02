import type { SingletonComponent } from "./types.ts";
import * as THREE from "three";

export class Input implements SingletonComponent {
    private lastFrameKeysPressed: Set<string> = new Set();
    private areKeysPressed: Set<string> = new Set();
    private screenMousePosition: { x: number; y: number } = { x: 0, y: 0 };

    constructor() {}

    create() {
        globalThis.window.addEventListener("keydown", (event) => {
            this.areKeysPressed.add(event.key);
        });
        globalThis.window.addEventListener("keyup", (event) => {
            this.areKeysPressed.delete(event.key);
        });
        globalThis.window.addEventListener("mousedown", (event) => {
            this.areKeysPressed.add(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener("mouseup", (event) => {
            this.areKeysPressed.delete(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener("mousemove", (event) => {
            this.screenMousePosition.x = event.x;
            this.screenMousePosition.y = event.y;
        });
    }

    update() {
        this.lastFrameKeysPressed = new Set(this.areKeysPressed);
        this.areKeysPressed.clear();
    }

    isKeyPressed(key: string): boolean {
        return this.areKeysPressed.has(key);
    }

    isKeyJustPressed(key: string): boolean {
        return (
            this.areKeysPressed.has(key) && !this.lastFrameKeysPressed.has(key)
        );
    }

    isKeyJustReleased(key: string): boolean {
        return (
            this.lastFrameKeysPressed.has(key) && !this.areKeysPressed.has(key)
        );
    }

    getScreenMousePosition(): { x: number; y: number } {
        return { ...this.screenMousePosition };
    }
}

/**
 * Perform a raycast from the given MouseEvent into the provided scene using the renderer/camera.
 * Returns the sorted intersection list (may be empty).
 */
export function performRaycastFromMouse(
    ev: MouseEvent,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
): THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[] {
    const raycaster = new THREE.Raycaster();
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseNDC = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouseNDC, camera);
    return raycaster.intersectObjects(scene.children, true);
}

/**
 * Walks a hit object's parent chain looking for userData.type === tag and returns that object (or null).
 */
export function findFirstTaggedHit(
    hits: THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[],
    tag: string,
): THREE.Object3D<THREE.Object3DEventMap> | null {
    for (const hit of hits) {
        let obj: THREE.Object3D<THREE.Object3DEventMap> | null = hit.object;
        while (obj) {
            const type = obj.userData?.type;
            if (type === tag) return obj;
            obj = obj.parent;
        }
    }
    return null;
}
