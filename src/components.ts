import * as Globals from "./globals.ts";
import {
    ColliderDesc,
    RigidBodyDesc,
    RigidBodyType,
    type Collider,
    type RigidBody,
} from "@dimforge/rapier3d-compat";
import type {
    Component,
    GameObject,
    Vector3,
    Rotation,
    Transform,
} from "./types";
import {
    Camera,
    Light,
    Material,
    Matrix4,
    Mesh,
    PointLight,
    Quaternion,
    Vector3 as ThreeVector3,
} from "three";

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

/**
 * Component that encapsulates an entity's local transform: position, rotation, and scale.
 *
 * @remarks
 * The `dirty` flag indicates whether the transform has been modified and may need to be reconciled
 * with rendering, physics, or other systems.
 */
export class TransformComponent extends BaseComponent {
    private transform: Transform = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
    };
    public dirty: boolean = false;

    public get position(): Vector3 {
        return this.transform.position;
    }
    public set position(value: Vector3) {
        this.transform.position = value;
        this.dirty = true;
    }
    public get rotation(): Rotation {
        return this.transform.rotation;
    }
    public set rotation(value: Rotation) {
        this.transform.rotation = value;
        this.dirty = true;
    }
    public get scale(): Vector3 {
        return this.transform.scale;
    }
    public set scale(value: Vector3) {
        this.transform.scale = value;
        this.dirty = true;
    }

    constructor(gameObject: GameObject) {
        super(gameObject);
    }

    setTranslation(transform: Transform) {
        this.transform = transform;
        this.dirty = true;
    }
}

export class RigidbodyComponent extends BaseComponent {
    static readonly DEFAULT_GROUP = Globals.mouseInteractionGroup | 0x1;
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
        this._collider = Globals.world.createCollider(
            ColliderDesc.ball(5),
            this.rigidbody,
        );
    }

    dispose() {
        Globals.world.removeRigidBody(this.rigidbody);
    }

    physicsUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        if (transform.dirty) {
            this.rigidbody.setTranslation(transform.position, true);
            this.rigidbody.setRotation(transform.rotation, true);
            transform.dirty = false;
        } else {
            const translation = this.rigidbody.translation();
            transform.position = { ...translation };
            transform.rotation = this.rigidbody.rotation();
        }
    }

    addCollider(
        colliderDesc: ColliderDesc,
        useDefaultCollisionGroup: boolean = true,
    ) {
        this.removeCollider();
        this._collider = Globals.world.createCollider(
            colliderDesc,
            this.rigidbody,
        );
        if (useDefaultCollisionGroup)
            this._collider.setCollisionGroups(RigidbodyComponent.DEFAULT_GROUP);
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
        this.mesh.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
        const rot = transform.rotation;
        this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        this.mesh.scale.set(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z,
        );
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
        this.light.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
        this.light.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z,
        );
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
        this.camera.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
        this.camera.rotation.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z,
        );
    }
}

export class FollowComponent extends BaseComponent {
    dependencies = [TransformComponent];
    public target: TransformComponent | null = null;
    public positionOffset: Vector3 = { x: 0, y: 5, z: -10 };
    public rotationOffset: Rotation = { x: 0, y: 0, z: 0, w: 0 };
    public positionSmoothFactor: number = 0.1;
    public rotationSmoothFactor: number = 0.1;
    public positionMode: "follow" | "fixed" = "follow";
    public rotationMode: "lookAt" | "fixed" = "fixed";

    constructor(gameObject: GameObject) {
        super(gameObject);
    }

    renderUpdate(_deltaTime: number): void {
        if (!this.target) return;
        const transform = this.gameObject.getComponent(TransformComponent)!;
        if (this.positionMode === "follow") {
            this.moveTo(this.target.position, transform);
        }
        else {
            this.moveTo(this.positionOffset, transform);
        }
        if (this.rotationMode === "lookAt") {
            const targetQuat = this.getRotationToward(this.target.position, transform);
            this.smoothRotateTo(targetQuat, transform);
        } else {
            const targetQuat = new Quaternion(
                this.rotationOffset.x,
                this.rotationOffset.y,
                this.rotationOffset.z,
                this.rotationOffset.w,
            );
            this.smoothRotateTo(targetQuat, transform);
        }
    }
    
    private moveTo(
        targetPos: Vector3,
        transform: TransformComponent,)
        {
        const desiredPosition = {
            x: targetPos.x + this.positionOffset.x,
            y: targetPos.y + this.positionOffset.y,
            z: targetPos.z + this.positionOffset.z,
        };
    
        // Smoothly interpolate to the desired position
        transform.position.x +=
            (desiredPosition.x - transform.position.x) *
            this.positionSmoothFactor;
        transform.position.y +=
            (desiredPosition.y - transform.position.y) *
            this.positionSmoothFactor;
        transform.position.z +=
            (desiredPosition.z - transform.position.z) *
            this.positionSmoothFactor;
    }

    private getRotationToward(
        targetPos: Vector3,
        transform: TransformComponent,
    ): Quaternion {
        const direction = new ThreeVector3(
            targetPos.x - transform.position.x,
            targetPos.y - transform.position.y,
            targetPos.z - transform.position.z,
        ).normalize();

        const up = new ThreeVector3(0, 1, 0);
        const right = new ThreeVector3()
            .crossVectors(up, direction)
            .normalize();
        const correctedUp = new ThreeVector3()
            .crossVectors(direction, right)
            .normalize();

        // Create rotation matrix from basis vectors
        const matrix = new Matrix4();
        matrix.makeBasis(right, correctedUp, direction);

        // Set quaternion from matrix
        const quaternion = new Quaternion();
        quaternion.setFromRotationMatrix(matrix);

        // Apply rotation offset
        const offsetQuat = new Quaternion(
            this.rotationOffset.x,
            this.rotationOffset.y,
            this.rotationOffset.z,
            this.rotationOffset.w,
        );
        quaternion.multiply(offsetQuat);

        return quaternion;
    }

    private smoothRotateTo(
        targetQuat: Quaternion,
        transform: TransformComponent,
    ) {
        const currentQuat = new Quaternion(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z,
            transform.rotation.w,
        );
        currentQuat.slerp(targetQuat, this.rotationSmoothFactor);
        transform.rotation = {
            x: currentQuat.x,
            y: currentQuat.y,
            z: currentQuat.z,
            w: currentQuat.w,
        };
    }
}

export class ScriptComponent extends BaseComponent {
    public onCreate?(): void;
    public onStart?(): void;
    public onUpdate?(_deltaTime: number): void;
    public onPhysicsUpdate?(_deltaTime: number): void;
    public onDispose?(): void;
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
    dispose(): void {
        this.onDispose?.();
    }
}
