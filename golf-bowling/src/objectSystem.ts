import { TransformComponent } from "./components.ts";
import type { Component, GameObject } from "./types.ts";

class GameObjectImpl implements GameObject {
    // Cache for Transform component
    private transform: TransformComponent | null = null;
    private components: Component[] = [];
    private _active: boolean = true;
    set active(value: boolean) {
        if (this._active === false && value === true) {
            addComponentsToLists(this.components);
        }
        else if (this._active === true && value === false) {
            removeComponentsFromLists(this.components);
        }
        this._active = value;
    }
    get active(): boolean {
        return this._active;
    }
    constructor(public id: string) {}

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
        addComponentToLists(component);
        component.create?.();
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
            removeComponentFromLists(component);
        }
    }

    dispose() {
        for (const component of this.components) {
            component.dispose?.();
        }
        this.components = [];
        this.transform = null;
    }
}

const objects: Array<GameObject> = []
const components = {
    physics: new Array<Component>(),
    render: new Array<Component>(),
}

export function getActivePhysicsComponents(): Array<Component> {
    return components.physics;
}

export function getActiveRenderComponents(): Array<Component> {
    return components.render;
}

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
        gameObject.dispose();
    }
}

function addComponentToLists<T extends Component>(component: T): void {
    if (component.physicsUpdate) {
        components.physics.push(component);
    }
    if (component.renderUpdate) {
        components.render.push(component);
    }
}

function removeComponentFromLists<T extends Component>(component: T): void {
    if (component.physicsUpdate) {
        const index = components.physics.indexOf(component);
        if (index !== -1) {
            components.physics.splice(index, 1);
        }
    }
    if (component.renderUpdate) {
        const index = components.render.indexOf(component);
        if (index !== -1) {
            components.render.splice(index, 1);
        }
    }
}

function addComponentsToLists(componentsToAdd: Array<Component>): void {
    components.physics.push(...componentsToAdd.filter(c => c.physicsUpdate));
    components.render.push(...componentsToAdd.filter(c => c.renderUpdate));
}

function removeComponentsFromLists(componentsToRemove: Array<Component>): void {
    const physicsSet = new Set(componentsToRemove.filter(c => c.physicsUpdate));
    const renderSet = new Set(componentsToRemove.filter(c => c.renderUpdate));
    components.physics = components.physics.filter(c => !physicsSet.has(c));
    components.render = components.render.filter(c => !renderSet.has(c));
}