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

type MouseEventName = "mouseDown" | "mouseUp" | "mouseMove";
type PointerEventName =
    | "pointerDown"
    | "pointerUp"
    | "pointerMove"
    | "pointerCancel"
    | "pointerLeave";
type KeyEventName = "keyDown" | "keyUp";

export type InputEventName = KeyEventName | MouseEventName | PointerEventName;

export interface InputModifierState {
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

export interface KeyInputEvent {
    key: string;
    code: string;
    repeat: boolean;
    timestamp: number;
    modifiers: InputModifierState;
}

export interface PointerMotionInfo {
    velocity: { x: number; y: number };
    direction: { x: number; y: number };
    speed: number;
}

export interface PointerInputEvent extends PointerMotionInfo {
    pointerId: number;
    pointerType: string;
    button: number;
    buttons: number;
    width: number;
    height: number;
    screenPosition: { x: number; y: number };
    normalizedPosition: { x: number; y: number };
    // added DOM coordinates so consumers can access clientX/clientY directly
    clientX: number;
    clientY: number;
    // optional more familiar names (match many code expectations)
    screenX: number;
    screenY: number;
    timestamp: number;
    modifiers: InputModifierState;
}

export type MouseInputEvent = PointerInputEvent & { pointerType: "mouse" };

export interface InputEventMap {
    keyDown: KeyInputEvent;
    keyUp: KeyInputEvent;
    mouseDown: MouseInputEvent;
    mouseUp: MouseInputEvent;
    mouseMove: MouseInputEvent;
    pointerDown: PointerInputEvent;
    pointerUp: PointerInputEvent;
    pointerMove: PointerInputEvent;
    pointerCancel: PointerInputEvent;
    pointerLeave: PointerInputEvent;
}

export type InputEventHandler<T extends InputEventName> = (
    payload: InputEventMap[T],
) => void;

interface PointerSample {
    time: number;
    x: number;
    y: number;
}

export class Input implements SingletonComponent {
    private keysDown: Set<string> = new Set();
    private keysJustPressed: Set<string> = new Set();
    private keysJustReleased: Set<string> = new Set();
    private listeners: Map<InputEventName, Set<(payload: unknown) => void>> =
        new Map();
    private screenMousePosition: { x: number; y: number } = { x: 0, y: 0 };
    private pointerElement: HTMLElement | null = null;
    private pointerHistories: Map<number, PointerSample[]> = new Map();
    private pointerHistoryWindowMs = 80;
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
    private isDisposed = false;

    private handleKeyDown = (event: KeyboardEvent) => {
        if (!this.keysDown.has(event.key)) {
            this.keysJustPressed.add(event.key);
        }
        this.keysDown.add(event.key);
        this.emit("keyDown", this.buildKeyPayload(event));
    };

    private handleKeyUp = (event: KeyboardEvent) => {
        if (this.keysDown.has(event.key)) {
            this.keysDown.delete(event.key);
            this.keysJustReleased.add(event.key);
        }
        this.emit("keyUp", this.buildKeyPayload(event));
    };

    private handlePointerDown = (event: PointerEvent) => {
        this.pointerHistories.delete(event.pointerId);
        const payload = this.buildPointerPayload(event);
        if (payload.pointerType === "mouse") {
            this.updateMouseButtonState(event.button, true);
        }
        this.emit("pointerDown", payload);
        this.emitMouseEventFromPointer("pointerDown", payload);
    };

    private handlePointerMove = (event: PointerEvent) => {
        const payload = this.buildPointerPayload(event);
        this.emit("pointerMove", payload);
        this.emitMouseEventFromPointer("pointerMove", payload);
    };

    private handlePointerUp = (event: PointerEvent) => {
        const payload = this.buildPointerPayload(event);
        if (payload.pointerType === "mouse") {
            this.updateMouseButtonState(event.button, false);
        }
        this.emit("pointerUp", payload);
        this.emitMouseEventFromPointer("pointerUp", payload);
        this.clearPointerHistory(event.pointerId);
    };

    private handlePointerCancel = (event: PointerEvent) => {
        const payload = this.buildPointerPayload(event);
        if (payload.pointerType === "mouse") {
            this.releaseAllMouseButtons();
        }
        this.emit("pointerCancel", payload);
        this.emitMouseEventFromPointer("pointerUp", payload);
        this.clearPointerHistory(event.pointerId);
    };

    private handlePointerLeave = (event: PointerEvent) => {
        const payload = this.buildPointerPayload(event);
        if (payload.pointerType === "mouse") {
            this.releaseAllMouseButtons();
        }
        this.emit("pointerLeave", payload);
        this.emitMouseEventFromPointer("pointerUp", payload);
        this.clearPointerHistory(event.pointerId);
    };

    constructor() {}

    create() {
        const win = globalThis.window;
        if (!win) return;
        win.addEventListener("keydown", this.handleKeyDown);
        win.addEventListener("keyup", this.handleKeyUp);
        win.addEventListener("pointerdown", this.handlePointerDown);
        win.addEventListener("pointermove", this.handlePointerMove);
        win.addEventListener("pointerup", this.handlePointerUp);
        win.addEventListener("pointercancel", this.handlePointerCancel);
        win.addEventListener("pointerleave", this.handlePointerLeave);
        if (!this.pointerElement && globalThis.document) {
            this.pointerElement = globalThis.document.body;
        }
    }

    dispose() {
        if (this.isDisposed) return;
        const win = globalThis.window;
        if (win) {
            win.removeEventListener("keydown", this.handleKeyDown);
            win.removeEventListener("keyup", this.handleKeyUp);
            win.removeEventListener("pointerdown", this.handlePointerDown);
            win.removeEventListener("pointermove", this.handlePointerMove);
            win.removeEventListener("pointerup", this.handlePointerUp);
            win.removeEventListener("pointercancel", this.handlePointerCancel);
            win.removeEventListener("pointerleave", this.handlePointerLeave);
        }
        this.listeners.clear();
        this.isDisposed = true;
    }

    renderUpdate(): void {
        this.keysJustPressed.clear();
        this.keysJustReleased.clear();
    }

    setPointerElement(element: HTMLElement | null) {
        this.pointerElement = element;
    }

    addEventListener<T extends InputEventName>(
        type: T,
        handler: InputEventHandler<T>,
    ): () => void {
        const handlers = this.listeners.get(type) ?? new Set();
        handlers.add(handler as (payload: unknown) => void);
        this.listeners.set(type, handlers);
        return () => this.removeEventListener(type, handler);
    }

    removeEventListener<T extends InputEventName>(
        type: T,
        handler: InputEventHandler<T>,
    ): void {
        const handlers = this.listeners.get(type);
        if (!handlers) return;
        handlers.delete(handler as (payload: unknown) => void);
        if (handlers.size === 0) {
            this.listeners.delete(type);
        }
    }

    isKeyPressed(key: string): boolean {
        return this.keysDown.has(key);
    }

    isKeyJustPressed(key: string): boolean {
        return this.keysJustPressed.has(key);
    }

    isKeyJustReleased(key: string): boolean {
        return this.keysJustReleased.has(key);
    }

    getScreenMousePosition(): { x: number; y: number } {
        return { ...this.screenMousePosition };
    }

    private emit<T extends InputEventName>(type: T, payload: InputEventMap[T]) {
        const handlers = this.listeners.get(type);
        if (!handlers) return;
        handlers.forEach((handler) => {
            (handler as InputEventHandler<T>)(payload);
        });
    }

    private buildKeyPayload(event: KeyboardEvent): KeyInputEvent {
        return {
            key: event.key,
            code: event.code,
            repeat: event.repeat,
            timestamp: this.now(),
            modifiers: this.extractModifierState(event),
        };
    }

    private buildPointerPayload(event: PointerEvent): PointerInputEvent {
        this.updatePointerTracking(event);
        const motion = this.recordPointerSample(
            event.pointerId,
            this.screenMousePosition.x,
            this.screenMousePosition.y,
        );
        const rect = this.getPointerRect();
        const ndcX =
            rect.width === 0
                ? 0
                : ((this.screenMousePosition.x - rect.left) / rect.width) * 2 -
                  1;
        const ndcY =
            rect.height === 0
                ? 0
                : -(
                      ((this.screenMousePosition.y - rect.top) / rect.height) *
                          2 -
                      1
                  );
        const timestamp = this.now();
        return {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            button: event.button,
            buttons: event.buttons,
            width: event.width ?? 1,
            height: event.height ?? 1,
            // screenPosition / normalizedPosition kept for backwards compatibility
            screenPosition: { ...this.screenMousePosition },
            normalizedPosition: { x: ndcX, y: ndcY },
            // expose raw DOM coordinates that some handlers expect
            clientX: event.clientX,
            clientY: event.clientY,
            screenX: event.screenX ?? event.clientX,
            screenY: event.screenY ?? event.clientY,
            timestamp,
            modifiers: this.extractModifierState(event),
            velocity: motion.velocity,
            direction: motion.direction,
            speed: motion.speed,
        };
    }

    private emitMouseEventFromPointer(
        type: PointerEventName,
        payload: PointerInputEvent,
    ) {
        if (payload.pointerType !== "mouse") return;
        const mapped = this.mapPointerToMouseEvent(type);
        if (!mapped) return;
        this.emit(mapped, payload as MouseInputEvent);
    }

    private mapPointerToMouseEvent(
        type: PointerEventName,
    ): MouseEventName | null {
        switch (type) {
            case "pointerDown":
                return "mouseDown";
            case "pointerMove":
                return "mouseMove";
            case "pointerUp":
            case "pointerCancel":
            case "pointerLeave":
                return "mouseUp";
            default:
                return null;
        }
    }

    private recordPointerSample(
        pointerId: number,
        x: number,
        y: number,
    ): PointerMotionInfo {
        const now = this.now();
        const history = this.pointerHistories.get(pointerId) ?? [];
        history.push({ time: now, x, y });
        while (
            history.length > 2 &&
            now - history[0].time > this.pointerHistoryWindowMs
        ) {
            history.shift();
        }
        this.pointerHistories.set(pointerId, history);
        return this.computePointerMotion(history);
    }

    private computePointerMotion(samples: PointerSample[]): PointerMotionInfo {
        if (samples.length < 2) {
            return {
                velocity: { x: 0, y: 0 },
                direction: { x: 0, y: 0 },
                speed: 0,
            };
        }
        const first = samples[0];
        const last = samples[samples.length - 1];
        const deltaTime = Math.max((last.time - first.time) / 1000, 1e-6);
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const vx = dx / deltaTime;
        const vy = dy / deltaTime;
        const len = Math.hypot(dx, dy);
        return {
            velocity: { x: vx, y: vy },
            direction: len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 },
            speed: Math.hypot(vx, vy),
        };
    }

    private extractModifierState(
        event: KeyboardEvent | MouseEvent | PointerEvent,
    ): InputModifierState {
        return {
            altKey: !!event.altKey,
            ctrlKey: !!event.ctrlKey,
            metaKey: !!event.metaKey,
            shiftKey: !!event.shiftKey,
        };
    }

    private getPointerRect(): {
        left: number;
        top: number;
        width: number;
        height: number;
    } {
        if (this.pointerElement) {
            return this.pointerElement.getBoundingClientRect();
        }
        const fallbackWidth =
            globalThis.innerWidth ??
            globalThis.document?.documentElement?.clientWidth ??
            1;
        const fallbackHeight =
            globalThis.innerHeight ??
            globalThis.document?.documentElement?.clientHeight ??
            1;
        return {
            left: 0,
            top: 0,
            width: fallbackWidth,
            height: fallbackHeight,
        };
    }

    private now(): number {
        if (typeof performance !== "undefined" && performance.now) {
            return performance.now();
        }
        return Date.now();
    }

    private clearPointerHistory(pointerId: number) {
        this.pointerHistories.delete(pointerId);
    }

    private updateMouseButtonState(button: number, pressed: boolean) {
        const key = `Mouse${button}`;
        if (pressed) {
            if (!this.keysDown.has(key)) {
                this.keysJustPressed.add(key);
            }
            this.keysDown.add(key);
            return;
        }
        if (this.keysDown.has(key)) {
            this.keysDown.delete(key);
            this.keysJustReleased.add(key);
        }
    }

    private releaseAllMouseButtons() {
        for (const key of Array.from(this.keysDown)) {
            if (!key.startsWith("Mouse")) continue;
            this.keysDown.delete(key);
            this.keysJustReleased.add(key);
        }
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
        ev: { clientX: number; clientY: number },
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

    private updatePointerTracking(event: { clientX: number; clientY: number }) {
        this.screenMousePosition.x = event.clientX;
        this.screenMousePosition.y = event.clientY;
    }

    private updatePointerRayFromMouse(
        ev: { clientX: number; clientY: number },
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
