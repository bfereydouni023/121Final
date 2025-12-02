import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import type { SingletonComponent, RaycastHit } from "./types.ts";
import { world } from "./globals";
import { getGameObjectFromCollider } from "./components";
import { getSingletonComponent } from "./objectSystem";

export interface PhysicsRaycastOptions {
    maxDistance?: number;
    solid?: boolean;
    collisionGroups?: RAPIER.InteractionGroups;
    filterFlags?: RAPIER.QueryFilterFlags;
    excludeCollider?: RAPIER.Collider;
    excludeRigidBody?: RAPIER.RigidBody;
    predicate?: (collider: RAPIER.Collider) => boolean;
    startOffset?: number;
}

export class Input implements SingletonComponent {
    private lastFrameKeysPressed: Set<string> = new Set();
    private areKeysPressed: Set<string> = new Set();
    private screenMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private lastPointerRayOrigin: THREE.Vector3 = new THREE.Vector3();
    private lastPointerRayDirection: THREE.Vector3 = new THREE.Vector3(
        0,
        0,
        -1,
    );
    private hasPointerRay: boolean = false;
    private tmpRayOrigin: THREE.Vector3 = new THREE.Vector3();

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
            this.updatePointerTracking(event);
        });
        globalThis.window.addEventListener("mouseup", (event) => {
            this.areKeysPressed.delete(`Mouse${event.button}`);
            this.updatePointerTracking(event);
        });
        globalThis.window.addEventListener("mousemove", (event) => {
            this.updatePointerTracking(event);
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

    raycastSceneFromMouse(
        ev: MouseEvent,
        renderer: THREE.WebGLRenderer,
        camera: THREE.Camera,
        scene: THREE.Scene,
    ): THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[] {
        if (!this.updatePointerRayFromMouse(ev, renderer, camera)) {
            return [];
        }
        return this.raycaster.intersectObjects(scene.children, true);
    }

    raycastPhysicsFromMouse(
        ev: MouseEvent,
        renderer: THREE.WebGLRenderer,
        camera: THREE.Camera,
        options?: PhysicsRaycastOptions,
    ): RaycastHit | null {
        if (!this.updatePointerRayFromMouse(ev, renderer, camera)) {
            return null;
        }
        return this.castPhysicsRay(options);
    }

    raycastPhysics(
        renderer: THREE.WebGLRenderer,
        camera: THREE.Camera,
        options?: PhysicsRaycastOptions,
    ): RaycastHit | null {
        if (!this.hasPointerRay) {
            if (!this.updatePointerRayFromStoredPosition(renderer, camera)) {
                return null;
            }
        }
        return this.castPhysicsRay(options);
    }

    private castPhysicsRay(options?: PhysicsRaycastOptions): RaycastHit | null {
        if (!world) {
            console.warn("Input.raycastPhysics: world is not initialized yet");
            return null;
        }
        if (!this.hasPointerRay) return null;

        const maxDistance = options?.maxDistance ?? 1000;
        const solid = options?.solid ?? true;
        const startOffset = options?.startOffset ?? 0;
        if (startOffset >= maxDistance) {
            return null;
        }
        this.tmpRayOrigin
            .copy(this.lastPointerRayOrigin)
            .addScaledVector(this.lastPointerRayDirection, startOffset);
        const ray = new RAPIER.Ray(
            {
                x: this.tmpRayOrigin.x,
                y: this.tmpRayOrigin.y,
                z: this.tmpRayOrigin.z,
            },
            {
                x: this.lastPointerRayDirection.x,
                y: this.lastPointerRayDirection.y,
                z: this.lastPointerRayDirection.z,
            },
        );

        const hit = world.castRayAndGetNormal(
            ray,
            maxDistance - startOffset,
            solid,
            options?.filterFlags,
            options?.collisionGroups,
            options?.excludeCollider,
            options?.excludeRigidBody,
            options?.predicate,
        );

        if (!hit) return null;

        const pointVec = ray.pointAt(hit.timeOfImpact);
        const point = { x: pointVec.x, y: pointVec.y, z: pointVec.z };
        const normal = {
            x: hit.normal.x,
            y: hit.normal.y,
            z: hit.normal.z,
        };
        const collider = hit.collider;
        const gameObject = getGameObjectFromCollider(collider);
        return {
            point,
            normal,
            distance: startOffset + hit.timeOfImpact,
            collider,
            gameObject,
        };
    }

    private updatePointerTracking(event: MouseEvent | PointerEvent) {
        this.screenMousePosition.x = event.clientX;
        this.screenMousePosition.y = event.clientY;
    }

    private updatePointerRayFromMouse(
        ev: MouseEvent,
        renderer: THREE.WebGLRenderer,
        camera: THREE.Camera,
    ): boolean {
        this.updatePointerTracking(ev);
        return this.updatePointerRayFromStoredPosition(renderer, camera);
    }

    private updatePointerRayFromStoredPosition(
        renderer: THREE.WebGLRenderer,
        camera: THREE.Camera,
    ): boolean {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }
        this.pointerNDC.set(
            ((this.screenMousePosition.x - rect.left) / rect.width) * 2 - 1,
            -((this.screenMousePosition.y - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointerNDC, camera);
        this.lastPointerRayOrigin.copy(this.raycaster.ray.origin);
        this.lastPointerRayDirection.copy(this.raycaster.ray.direction);
        this.hasPointerRay = true;
        return true;
    }
}

/**
 * @deprecated Prefer using the Input singleton methods directly.
 */
export function performRaycastFromMouse(
    ev: MouseEvent,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
): THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>>[] {
    const input = getSingletonComponent(Input);
    return input.raycastSceneFromMouse(ev, renderer, camera, scene);
}
