import type { SingletonComponent, Vector3 } from './types.ts';
import { mainCamera, mouseInteractionGroup, world } from './globals.ts';
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

    getWorldMousePosition(): Vector3 | null {
        const cameraPosition = mainCamera.position;
        let directionFromCamera = new THREE.Vector3();
        mainCamera.getWorldDirection(directionFromCamera);
        const hit = world.castRay(new Ray(cameraPosition, directionFromCamera), 100, true, undefined, mouseInteractionGroup);
        return hit ? cameraPosition.add(directionFromCamera.multiplyScalar(hit.timeOfImpact)) : null;
    }
}
