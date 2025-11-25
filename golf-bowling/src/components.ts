import * as Globals from './globals.ts';
import { ColliderDesc, RigidBodyDesc, RigidBodyType, type Collider, type RigidBody } from "@dimforge/rapier3d-compat";
import type { Component, GameObject, Vector3 } from "./types";
import { Camera, Light, Material, Mesh, PointLight } from "three";

class BaseComponent implements Component {
    dependencies: (new (gameObject: GameObject) => Component)[] = [];
    private _gameObject: GameObject;
    constructor(gameObject: GameObject) {
        this._gameObject = gameObject;
    }
    get gameObject(): GameObject {
        return this._gameObject;
    }
}

export class TransformComponent extends BaseComponent {
    public position: Vector3;
    public rotation: Vector3;
    public scale: Vector3;

    constructor(gameObject: GameObject) {
        super(gameObject);
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1 };
    }
}

export class RigidbodyComponent extends BaseComponent {
    dependencies = [TransformComponent];
    mass: number = 1;
    velocity: Vector3 = { x: 0, y: 0, z: 0 };
    public rigidbody: RigidBody;
    private _collider: Collider;
    get collider(): Collider {
        return this._collider;
    }

    constructor(gameObject: GameObject) {
        super(gameObject);
        const desc = new RigidBodyDesc(RigidBodyType.Dynamic);
        this.rigidbody = Globals.world.createRigidBody(desc);
        this._collider = Globals.world.createCollider(ColliderDesc.ball(5), this.rigidbody);
    }

    dispose() {
        Globals.world.removeRigidBody(this.rigidbody);
    }

    physicsUpdate(_deltaTime: number): void {
        const translation = this.rigidbody.translation();
        this.gameObject.getComponent(TransformComponent)!.position = { ...translation };
    }

    addCollider(colliderDesc: ColliderDesc) {
        this.removeCollider();
        this._collider = Globals.world.createCollider(colliderDesc, this.rigidbody);
    }

    removeCollider() {
        if (this._collider) {
            Globals.world.removeCollider(this._collider, true);
            this._collider = undefined!;
        }
    }
}

export class MeshComponent extends BaseComponent {
    dependencies = [TransformComponent];
    public mesh: Mesh;

    public get material(): Material {
        return this.mesh.material as Material;
    }

    constructor(gameObject: GameObject) {
        super(gameObject);
        this.mesh = new Mesh();
    }

    renderUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
        this.mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        this.mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }
}

export class LightComponent extends BaseComponent {
    dependencies = [TransformComponent];
    public light: Light;
    constructor(gameObject: GameObject) {
        super(gameObject);
        this.light = new PointLight();
    }

    renderUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.light.position.set(transform.position.x, transform.position.y, transform.position.z);
        this.light.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }
}

export class CameraComponent extends BaseComponent {
    dependencies = [TransformComponent];
    public camera: Camera;
    constructor(gameObject: GameObject) {
        super(gameObject);
        this.camera = new Camera();
    }
    renderUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.camera.position.set(transform.position.x, transform.position.y, transform.position.z);
        this.camera.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }
}

export class ScriptComponent extends BaseComponent {
    public onCreate?(): void;
    public onStart?(): void;
    public onUpdate?(_deltaTime: number): void;
    public onPhysicsUpdate?(_deltaTime: number): void;
    private hasStarted: boolean = false;

    create(): void {
        this.onCreate?.();
    }
    renderUpdate(_deltaTime: number): void {
        if (!this.hasStarted) {
            this.onStart?.();
            this.hasStarted = true;
        }
        this.onUpdate?.(_deltaTime);
    }
    physicsUpdate(_deltaTime: number): void {
        this.onPhysicsUpdate?.(_deltaTime);
    }
}