import type { Collider } from "@dimforge/rapier3d-compat";
import type { PerspectiveCamera } from "three";

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Rotation extends Vector3 {
    w: number;
}

export interface Transform {
    position: Vector3;
    scale: Vector3;
    rotation: Rotation;
}

export interface Level extends Resettable {
    id: string;
    get active(): boolean;
    set active(value: boolean);
    destroy(): void;
    reset(): void;
}

export interface GameObject {
    name: string;
    id: number;
    set active(value: boolean);
    get active(): boolean;
    addComponent<T extends Component>(
        componentType: new (gameObject: GameObject) => T,
    ): T;
    getComponent<T extends Component>(
        componentType: new (gameObject: GameObject) => T,
    ): T | null;
    getComponents<T extends Component>(
        componentType: new (gameObject: GameObject) => T,
    ): T[];
    removeComponent<T extends Component>(
        componentType: new (gameObject: GameObject) => T,
    ): void;
    dispose(): void;
}

export interface Component {
    dependencies: (new (gameObject: GameObject) => Component)[];
    get gameObject(): GameObject;
    create?(): void;
    renderUpdate?(deltaTime: number): void;
    physicsUpdate?(deltaTime: number): void;
    dispose?(): void;
}

export interface SingletonComponent {
    create?(): void;
    renderUpdate?(deltaTime: number): void;
    physicsUpdate?(deltaTime: number): void;
    dispose?(): void;
}

export interface RaycastHit {
    point: Vector3;
    normal: Vector3;
    distance: number;
    collider: Collider;
    gameObject: GameObject | null;
}

export interface Resettable {
    reset(): void;
}

export type MainCamera = PerspectiveCamera & {
    gameObject: GameObject;
};
