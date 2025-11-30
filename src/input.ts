import type { SingletonComponent, Vector3 } from './types.ts';
import { mainCamera, mouseInteractionGroup, renderer, world } from './globals.ts';
import { Ray } from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class Input implements SingletonComponent {
    private lastFrameKeysPressed: Set<string> = new Set();
    private areKeysPressed: Set<string> = new Set();
    private screenMousePosition: { x: number; y: number } = { x: 0, y: 0 };

    constructor() { }

    create() {
        globalThis.window.addEventListener('keydown', (event) => {
            this.areKeysPressed.add(event.key);
        });
        globalThis.window.addEventListener('keyup', (event) => {
            this.areKeysPressed.delete(event.key);
        });
        globalThis.window.addEventListener('mousedown', (event) => {
            this.areKeysPressed.add(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener('mouseup', (event) => {
            this.areKeysPressed.delete(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener('mousemove', (event) => {
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
        return this.areKeysPressed.has(key) && !this.lastFrameKeysPressed.has(key);
    }

    isKeyJustReleased(key: string): boolean {
        return this.lastFrameKeysPressed.has(key) && !this.areKeysPressed.has(key);
    }

    getScreenMousePosition(): { x: number; y: number } {
        return { ...this.screenMousePosition };
    }

    /** NOT IMPLEMENTED FULLY
     * Computes the world-space intersection point of a ray cast from the active camera
     * in its forward direction, intended to represent the mouse's position in the world.
     * Important notes:
     * - This implementation uses and depends on global objects: `mainCamera`, `world`, and `mouseInteractionGroup`.
     * - The computation mutates the camera position and the temporary direction vector because
     *   it performs in-place `Vector3` operations (`add`, `multiplyScalar`). Clone inputs if mutation is undesirable.
     *
     * @returns {THREE.Vector3 | null} The world-space position of the mouse intersection, or `null` if no intersection was found.
     */
    getWorldMousePosition(): Vector3 | null {
        const cameraPosition = mainCamera.position;
        let directionFromCamera = new THREE.Vector3();
        mainCamera.getWorldDirection(directionFromCamera);
        const hit = world.castRay(new Ray(cameraPosition, directionFromCamera), 100, true, undefined, mouseInteractionGroup);
        return hit ? cameraPosition.add(directionFromCamera.multiplyScalar(hit.timeOfImpact)) : null;
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
  scene: THREE.Scene
): THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[] {
  const raycaster = new THREE.Raycaster();
  const rect = renderer.domElement.getBoundingClientRect();
  const mouseNDC = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouseNDC, camera);
  return raycaster.intersectObjects(scene.children, true);
}

/**
 * Walks a hit object's parent chain looking for userData.type === tag and returns that object (or null).
 */
export function findFirstTaggedHit(
  hits: THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[],
  tag: string
): THREE.Object3D<THREE.Object3DEventMap> | null {
  for (const hit of hits) {
    let obj: THREE.Object3D<THREE.Object3DEventMap> | null = hit.object;
    while (obj) {
      const type = (obj as any).userData?.type;
      if (type === tag) return obj;
      obj = obj.parent;
    }
  }
  return null;
}
