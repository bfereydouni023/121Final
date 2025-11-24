import { TransformComponent } from "./types";
import type { Component, GameObject } from "./types.ts";

class GameObjectImpl implements GameObject {
    // Cache for Transform component
    public transform: TransformComponent | null = null;
    constructor(public id: string, public components: Component[] = []) {}

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

const objects: Array<GameObject> = []

export function createGameObject(): GameObject {
    const obj = new GameObjectImpl(`gameObject_${objects.length}`);
    objects.push(obj);
    return obj;
}

export function getAllGameObjects(): Array<GameObject> {
    return Array.from(objects);
}

export function destroyGameObject(gameObject: GameObject): void {
    const index = objects.indexOf(gameObject);
    if (index !== -1) {
        objects.splice(index, 1);
        gameObject.destroy();
    }
}

