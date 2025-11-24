import { Collider, ColliderDesc, RigidBody, RigidBodyDesc, RigidBodyType} from "@dimforge/rapier3d-compat";
import * as Globals from './globals.ts';
import { Material, Mesh } from "three";

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface GameObject {
    id: string;
    transform: TransformComponent | null;
    components: Component[];
    addComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T;
    getComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T | null;
    getComponents<T extends Component>(componentType: new (gameObject: GameObject) => T): T[];
    removeComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): void;
    destroy(): void;
}



export interface Component {
    dependencies: (new (gameObject: GameObject) => Component)[];
    get gameObject(): GameObject;
    update?(deltaTime: number): void;
    dispose?(): void;
}

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
    private _rigidbodyInstance: RigidBody;
    private _collider: Collider;

    get rigidbodyType(): "dynamic" | "static" | "kinematic" {
        switch (this._rigidbodyInstance.bodyType()) {
            case RigidBodyType.Dynamic:
                return 'dynamic';
            case RigidBodyType.Fixed:
                return 'static';
            case RigidBodyType.KinematicPositionBased:
                return 'kinematic';
            default:
                throw new Error("Unknown rigidbody type");
        }
    }

    set rigidbodyType(value: "dynamic" | "static" | "kinematic") {
        let bodyType: RigidBodyType;
        switch (value) {
            case 'dynamic':
                bodyType = RigidBodyType.Dynamic;
                break;
            case 'static':
                bodyType = RigidBodyType.Fixed;
                break;
            case 'kinematic':
                bodyType = RigidBodyType.KinematicPositionBased;
                break;
        }
        this._rigidbodyInstance.setBodyType(bodyType, true);
    }

    constructor(gameObject: GameObject) {
        super(gameObject);
        const desc = new RigidBodyDesc(RigidBodyType.Dynamic);
        this._rigidbodyInstance = Globals.world.createRigidBody(desc);
        this._collider = Globals.world.createCollider(ColliderDesc.ball(5), this._rigidbodyInstance);
    }

    dispose() {
        Globals.world.removeRigidBody(this._rigidbodyInstance);
    }

    update(_deltaTime: number): void {
        const translation = this._rigidbodyInstance.translation();
        this.gameObject.getComponent(TransformComponent)!.position = { ...translation };
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

    update(_deltaTime: number): void {
        const transform = this.gameObject.getComponent(TransformComponent)!;
        this.mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
        this.mesh.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
        this.mesh.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }
}