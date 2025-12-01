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
    this._collider = Globals.world.createCollider(colliderDesc, this.rigidbody);
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
    // If this GameObject has a RigidbodyComponent, prefer the rigidbody transform
    // (colliders follow the rigidbody). Otherwise fall back to the TransformComponent.
    const rb = this.gameObject.getComponent(RigidbodyComponent);
    if (rb && rb.rigidbody) {
      const t = rb.rigidbody.translation();
      this.mesh.position.set(t.x, t.y, t.z);
      // Rapier rotation() returns a quaternion-like object { x,y,z,w }
      const r = rb.rigidbody.rotation();
      if (r && typeof (this.mesh as any).quaternion?.set === "function") {
        this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    } else {
      //For meshes without rigidbodies, use TransformComponent
      const transform = this.gameObject.getComponent(TransformComponent)!;
      this.mesh.position.set(
        transform.position.x,
        transform.position.y,
        transform.position.z,
      );
      const rot = transform.rotation;
      this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }

    const transform = this.gameObject.getComponent(TransformComponent)!;
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
  public rotationOffset: Rotation = { x: 0, y: 0, z: 0, w: 1 };
  public smoothFactor: number = 0.1;
  public rotationMode: "lookAt" | "fixed" = "fixed";

  constructor(gameObject: GameObject) {
    super(gameObject);
  }

  renderUpdate(_deltaTime: number): void {
    if (!this.target) return;
    const transform = this.gameObject.getComponent(TransformComponent)!;

    const desiredPosition = {
      x: this.target.position.x + this.positionOffset.x,
      y: this.target.position.y + this.positionOffset.y,
      z: this.target.position.z + this.positionOffset.z,
    };

    // Smoothly interpolate to the desired position
    transform.position.x +=
      (desiredPosition.x - transform.position.x) * this.smoothFactor;
    transform.position.y +=
      (desiredPosition.y - transform.position.y) * this.smoothFactor;
    transform.position.z +=
      (desiredPosition.z - transform.position.z) * this.smoothFactor;
    if (this.rotationMode == "lookAt") {
      this.pointAt(this.target.position, transform);
    } else {
      transform.rotation = this.rotationOffset;
    }
  }

  private pointAt(targetPos: Vector3, transform: TransformComponent) {
    // Compute direction vector from camera to target
    const dirX = targetPos.x - transform.position.x;
    const dirY = targetPos.y - transform.position.y;
    const dirZ = targetPos.z - transform.position.z;

    // Compute Euler angles from direction vector
    const horizontalDist = Math.sqrt(dirX * dirX + dirZ * dirZ);
    // Yaw: rotation around Y axis (horizontal look direction)
    const yaw = Math.atan2(dirX, dirZ);
    // Pitch: rotation around X axis (vertical look direction)
    const pitch = -Math.atan2(dirY, horizontalDist);

    // Convert Euler angles (pitch, yaw, 0) to quaternion (XYZ order)
    const halfPitch = pitch * 0.5;
    const halfYaw = yaw * 0.5;
    const cosPitch = Math.cos(halfPitch);
    const sinPitch = Math.sin(halfPitch);
    const cosYaw = Math.cos(halfYaw);
    const sinYaw = Math.sin(halfYaw);

    // Quaternion from Euler angles (X then Y rotation)
    const desiredRotation = {
      x: sinPitch * cosYaw,
      y: cosPitch * sinYaw,
      z: -sinPitch * sinYaw,
      w: cosPitch * cosYaw,
    };

    // Smoothly interpolate (slerp) to the desired rotation
    const current = transform.rotation;
    // Compute dot product to check if we need to negate for shortest path
    let dot =
      current.x * desiredRotation.x +
      current.y * desiredRotation.y +
      current.z * desiredRotation.z +
      current.w * desiredRotation.w;

    // Negate one quaternion if dot product is negative (take shortest path)
    const sign = dot < 0 ? -1 : 1;
    dot = Math.abs(dot);

    // Clamp dot for acos
    const theta = Math.acos(Math.min(1, dot));
    const sinTheta = Math.sin(theta);

    let scale0: number, scale1: number;
    if (sinTheta > 0.001) {
      // Standard slerp
      scale0 = Math.sin((1 - this.smoothFactor) * theta) / sinTheta;
      scale1 = Math.sin(this.smoothFactor * theta) / sinTheta;
    } else {
      // Use linear interpolation for small angles
      scale0 = 1 - this.smoothFactor;
      scale1 = this.smoothFactor;
    }

    transform.rotation.x =
      scale0 * current.x + scale1 * sign * desiredRotation.x;
    transform.rotation.y =
      scale0 * current.y + scale1 * sign * desiredRotation.y;
    transform.rotation.z =
      scale0 * current.z + scale1 * sign * desiredRotation.z;
    transform.rotation.w =
      scale0 * current.w + scale1 * sign * desiredRotation.w;

    // Normalize the resulting quaternion
    const len = Math.sqrt(
      transform.rotation.x ** 2 +
        transform.rotation.y ** 2 +
        transform.rotation.z ** 2 +
        transform.rotation.w ** 2,
    );
    if (len > 0) {
      transform.rotation.x /= len;
      transform.rotation.y /= len;
      transform.rotation.z /= len;
      transform.rotation.w /= len;
    }
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
