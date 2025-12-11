import * as Globals from "./globals.ts";
import {
    ActiveEvents,
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
import type { MouseInputEvent } from "./input";
import {
    BufferGeometry,
    Camera,
    CanvasTexture,
    ClampToEdgeWrapping,
    Color,
    Float32BufferAttribute,
    Light,
    Line,
    LineBasicMaterial,
    LinearFilter,
    Material,
    Matrix4,
    Mesh,
    PointLight,
    Quaternion,
    Sprite,
    SpriteMaterial,
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

const colliderOwners = new WeakMap<Collider, GameObject>();

export function getGameObjectFromCollider(
    collider: Collider,
): GameObject | null {
    return colliderOwners.get(collider) ?? null;
}

function registerColliderOwner(collider: Collider, owner: GameObject) {
    colliderOwners.set(collider, owner);
}

function unregisterColliderOwner(collider?: Collider) {
    if (!collider) return;
    colliderOwners.delete(collider);
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
}

export class RigidbodyComponent extends BaseComponent {
    static readonly DEFAULT_GROUP = Globals.mouseInteractionGroup | 0x1;
    dependencies = [TransformComponent];
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
        registerColliderOwner(this._collider, this.gameObject);
    }

    create(): void {
        // Initialize rigidbody position from TransformComponent
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.rigidbody.setTranslation(
            {
                x: transform.position.x,
                y: transform.position.y,
                z: transform.position.z,
            },
            false,
        );
        this.rigidbody.setRotation(
            {
                x: transform.rotation.x,
                y: transform.rotation.y,
                z: transform.rotation.z,
                w: transform.rotation.w,
            },
            false,
        );
        this.rigidbody.setLinvel(
            {
                x: 0,
                y: 0,
                z: 0,
            },
            false,
        );
    }

    dispose() {
        unregisterColliderOwner(this._collider);
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
            const rotation = this.rigidbody.rotation();
            const position = transform.position;
            position.x = translation.x;
            position.y = translation.y;
            position.z = translation.z;
            const rot = transform.rotation;
            rot.x = rotation.x;
            rot.y = rotation.y;
            rot.z = rotation.z;
            rot.w = rotation.w;
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
        registerColliderOwner(this._collider, this.gameObject);
    }

    removeCollider() {
        if (this._collider) {
            unregisterColliderOwner(this._collider);
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

    dispose(): void {
        Globals.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        if (Array.isArray(this.mesh.material)) {
            this.mesh.material.forEach((mat) => mat.dispose());
        } else {
            this.mesh.material.dispose();
        }
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
    public updateMode: "render" | "physics" = "render";
    public target: TransformComponent | null = null;
    public enabled: boolean = true;
    public positionOffset: Vector3 = { x: 0, y: 0, z: 0 };
    public rotationOffset: Rotation = { x: 0, y: 0, z: 0, w: 0 };
    public positionSmoothFactor: number = 0.1;
    public rotationSmoothFactor: number = 0.1;
    public positionMode: "follow" | "fixed" = "follow";
    public rotationMode: "lookAt" | "fixed" = "fixed";

    constructor(gameObject: GameObject) {
        super(gameObject);
    }

    renderUpdate(_deltaTime: number): void {
        if (this.updateMode === "render") {
            this.update();
        }
    }

    physicsUpdate(_deltaTime: number): void {
        if (this.updateMode === "physics") {
            this.update();
        }
    }

    update() {
        if (!this.enabled) return;
        if (!this.target) return;
        const transform = this.gameObject.getComponent(TransformComponent)!;
        if (this.positionMode === "follow") {
            this.moveTo(this.target.position, transform);
        } else {
            this.moveTo(this.positionOffset, transform);
        }
        if (this.rotationMode === "lookAt") {
            const targetQuat = this.getRotationToward(
                this.target.position,
                transform,
            );
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

    private moveTo(targetPos: Vector3, transform: TransformComponent) {
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
        transform.dirty = true;
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
    private variables: Map<string, unknown> = new Map<string, unknown>();
    public onCreate?(): void;
    public onStart?(): void;
    public onUpdate?(deltaTime: number): void;
    public onPhysicsUpdate?(deltaTime: number): void;
    /**
     * @requires Requires a {@link RigidbodyComponent} or {@link MeshComponent} to be present on the same GameObject.
     */
    public onClicked?(event: MouseInputEvent): void;
    public onDispose?(): void;
    public onCollisionEnter?(other: GameObject): void;
    public onCollisionExit?(other: GameObject): void;
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

    public storeVar<T>(key: string, value: T): void {
        this.variables.set(key, value);
    }

    public getVar<T>(key: string): T | undefined {
        return this.variables.get(key) as T | undefined;
    }
}

/**
 * Utility: allow safely updating a FollowComponent's rotationOffset at runtime.
 * This is a minimal, non-invasive helper so callers can replace/modify the stored
 * quaternion without depending on internal implementation details.
 */
export function setFollowRotationOffset(
    follow: FollowComponent | null | undefined,
    q: { x: number; y: number; z: number; w: number },
): void {
    if (!follow) return;

    // ensure there's an object we can assign to (some code paths may expect an Euler-like object)
    follow.rotationOffset = { x: q.x, y: q.y, z: q.z, w: q.w };

    // If the component/system exposes a hook to mark the component dirty / notify systems,
    // call it. This call is guarded so it's safe if not present.
    try {
        (follow as unknown as { markDirty?: () => void }).markDirty?.();
    } catch {
        // ignore if the component doesn't provide such a method
    }
}

export class PickupComponent extends ScriptComponent {
    dependencies = [TransformComponent, RigidbodyComponent];
    private triggers: Set<GameObject> = new Set<GameObject>();
    private pickedUp: boolean = false;
    public get isPickedUp(): boolean {
        return this.pickedUp;
    }
    public onPickup?(other: GameObject): void;

    create(): void {
        const rb = this.gameObject.getComponent(RigidbodyComponent)!;
        rb.collider.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
    }

    onCollisionEnter(other: GameObject): void {
        if (this.pickedUp) return;
        if (!this.triggers.has(other)) return;
        this.pickedUp = true;
        this.onPickup?.(other);
    }

    addTriggerObject(gameObject: GameObject): void {
        this.triggers.add(gameObject);
        if (gameObject.getComponent(RigidbodyComponent)?.collider) {
            const rb = gameObject.getComponent(RigidbodyComponent)!;
            rb.collider.setActiveEvents(ActiveEvents.COLLISION_EVENTS);
        } else {
            console.warn(
                `PickupComponent: Trigger object ${gameObject.name} does not have a RigidbodyComponent with a collider.`,
            );
        }
    }

    removeTriggerObject(gameObject: GameObject): void {
        this.triggers.delete(gameObject);
    }
}

export class BillboardUIComponent extends BaseComponent {
    dependencies = [TransformComponent];
    private canvas: HTMLCanvasElement;
    private texture: CanvasTexture | null = null;
    private sprite: Sprite;
    public set size(value: { width: number; height: number }) {
        this.canvas.width = value.width;
        this.canvas.height = value.height;
        this.texture?.dispose();
        Globals.scene.remove(this.sprite);
        this.sprite = this.render()!;
        Globals.scene.add(this.sprite);
    }
    public get size(): { width: number; height: number } {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
        };
    }
    draw?(canvas: CanvasRenderingContext2D): void;

    constructor(gameObject: GameObject) {
        super(gameObject);
        this.canvas = document.createElement("canvas");
        this.canvas.width = 256;
        this.canvas.height = 256;
        this.sprite = this.render()!;
        Globals.scene.add(this.sprite);
    }

    renderUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.draw?.(this.canvas.getContext("2d")!);
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
        this.sprite.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
    }

    dispose(): void {
        Globals.scene.remove(this.sprite);
        this.texture?.dispose();
    }

    private render(): Sprite | null {
        const ctx = this.canvas.getContext("2d");
        const transform = this.gameObject.getComponent(TransformComponent)!;
        if (!ctx) return null;
        this.texture = new CanvasTexture(this.canvas);
        this.texture.minFilter = LinearFilter;
        this.texture.wrapS = ClampToEdgeWrapping;
        this.texture.wrapT = ClampToEdgeWrapping;
        this.texture.needsUpdate = true;
        const material = new SpriteMaterial({
            map: this.texture,
            transparent: true,
        });
        const sprite = new Sprite(material);
        sprite.scale.set(this.canvas.width / 100, this.canvas.height / 100, 1);
        sprite.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
        return sprite;
    }
}

export class LineRendererComponent extends BaseComponent {
    dependencies = [TransformComponent];
    private line: Line;
    private geometry: BufferGeometry;
    private material: LineBasicMaterial;
    private _points: Vector3[] = [];
    private _lineWidth: number = 1;
    private _linecap: "butt" | "round" | "square" = "round";
    private _linejoin: "round" | "bevel" | "miter" = "round";

    /**
     * Function that provides color for the line based on position along the line.
     * Parameter t ranges from 0 (start) to 1 (end).
     * Returns a Color object.
     */
    private colorFunction: (t: number) => Color = () => new Color(0xffffff);

    public set colorFunc(func: (t: number) => Color) {
        this.colorFunction = func;
        this.updateColors();
    }

    public get colorFunc(): (t: number) => Color {
        return this.colorFunction;
    }

    constructor(gameObject: GameObject) {
        super(gameObject);
        this.geometry = new BufferGeometry();
        this.material = new LineBasicMaterial({
            color: 0xffffff,
            linewidth: this._lineWidth,
            linecap: this._linecap,
            linejoin: this._linejoin,
            vertexColors: true,
        });
        this.line = new Line(this.geometry, this.material);
        Globals.scene.add(this.line);
    }

    /**
     * Set the points that define the line in world space (relative to the transform).
     */
    public set points(value: Vector3[]) {
        this._points = value;
        this.updateGeometry();
    }

    public get points(): Vector3[] {
        return this._points;
    }

    /**
     * Set the line width (note: linewidth > 1 only works with WebGLRenderer if using Line2).
     */
    public set thickness(value: number) {
        this._lineWidth = value;
        this.material.linewidth = value;
        this.material.needsUpdate = true;
    }

    public get thickness(): number {
        return this._lineWidth;
    }

    /**
     * Set the line cap style.
     */
    public set linecap(value: "butt" | "round" | "square") {
        this._linecap = value;
        this.material.linecap = value;
        this.material.needsUpdate = true;
    }

    public get linecap(): "butt" | "round" | "square" {
        return this._linecap;
    }

    /**
     * Set the line join style.
     */
    public set linejoin(value: "round" | "bevel" | "miter") {
        this._linejoin = value;
        this.material.linejoin = value;
        this.material.needsUpdate = true;
    }

    public get linejoin(): "round" | "bevel" | "miter" {
        return this._linejoin;
    }

    renderUpdate(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        // Update line position to match transform
        this.line.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z,
        );
        const rot = transform.rotation;
        this.line.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        this.line.scale.set(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z,
        );
    }

    dispose(): void {
        Globals.scene.remove(this.line);
        this.geometry.dispose();
        this.material.dispose();
    }

    /**
     * Update the geometry with current points and colors from the color function.
     */
    private updateGeometry(): void {
        if (this._points.length < 2) {
            // Need at least 2 points to draw a line
            this.geometry.setFromPoints([]);
            return;
        }

        // Convert Vector3 points to Three.js Vector3
        const threePoints = this._points.map(
            (p) => new ThreeVector3(p.x, p.y, p.z),
        );
        this.geometry.setFromPoints(threePoints);

        // Generate colors based on the color function
        const colors: number[] = [];
        const numPoints = this._points.length;
        for (let i = 0; i < numPoints; i++) {
            const t = numPoints > 1 ? i / (numPoints - 1) : 0;
            const color = this.colorFunction(t);
            colors.push(color.r, color.g, color.b);
        }

        // Set color attribute
        this.geometry.setAttribute(
            "color",
            new Float32BufferAttribute(colors, 3),
        );
        this.geometry.attributes.color.needsUpdate = true;
    }

    private updateColors(): void {
        if (this._points.length < 2) return;

        const colors: number[] = [];
        const numPoints = this._points.length;
        for (let i = 0; i < numPoints; i++) {
            const t = numPoints > 1 ? i / (numPoints - 1) : 0;
            const color = this.colorFunction(t);
            colors.push(color.r, color.g, color.b);
        }

        this.geometry.setAttribute(
            "color",
            new Float32BufferAttribute(colors, 3),
        );
        this.geometry.attributes.color.needsUpdate = true;
    }
}
