import { RigidBody, RigidBodyDesc, RigidBodyType} from "@dimforge/rapier3d-compat";
import * as Globals from './globals.ts';
import { Material, Mesh } from "three";

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export class GameObject {
    // Cache for Transform component
    private transform: TransformComponent | null = null;
    constructor(private id: string, private components: Component[] = []) {}

    /**
     * @returns The added component
     * @throws Error if there is a circular dependency detected
     */
    addComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T {
        // Check and resolve dependencies
        const component = new componentType(this);
        const deps = component.dependencies || [];
        for (const dep of deps) {
            if (!this.getComponent(dep)) {
                if (dep === componentType) {
                    throw new Error(`Circular dependency detected for component ${componentType.name}`);
                }
                this.addComponent(dep);
            }
        }

        this.components.push(component);
        if (component instanceof TransformComponent) {
            this.transform = component;
        }
        return component;
    }

    getComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T | null {
        if ((componentType as any) === TransformComponent && this.transform) {
            return this.transform as any as T;
        }
        for (const component of this.components) {
            if (component instanceof componentType) {
                return component as T;
            }
        }
        return null;
    }

    getComponents<T extends Component>(componentType: new (gameObject: GameObject) => T): T[] {
        const foundComponents: T[] = [];
        for (const component of this.components) {
            if (component instanceof componentType) {
                foundComponents.push(component as T);
            }
        }
        return foundComponents;
    }

    /**
     * Removes all components of the specified component class from this game object.
     * Note: This method does not check for dependencies between components.
     */
    removeComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): void {
        const removedComponents = this.components.filter(component => (component instanceof componentType));
        this.components = this.components.filter(component => !(component instanceof componentType));
        for (const component of removedComponents) {
            component.dispose?.();
        }
    }

    destroy() {
        for (const component of this.components) {
            component.dispose?.();
        }
        this.components = [];
        this.transform = null;
    }
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
        this._rigidbodyInstance = Globals.world.createRigidBody(desc); // Rigidbody initialization
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