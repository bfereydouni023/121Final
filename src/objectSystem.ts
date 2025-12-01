import { TransformComponent } from "./components.ts";
import type { Component, GameObject, SingletonComponent } from "./types.ts";

class GameObjectImpl implements GameObject {
  // Cache for Transform component
  private transform: TransformComponent | null = null;
  private components: Component[] = [];
  private _active: boolean = true;
  set active(value: boolean) {
    if (this._active === false && value === true) {
      addComponentsToLists(this.components);
    } else if (this._active === true && value === false) {
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
  addComponent<T extends Component>(
    componentType: new (gameObject: GameObject) => T,
  ): T {
    // Check and resolve dependencies
    const component = new componentType(this);
    const deps = component.dependencies || [];
    for (const dep of deps) {
      if (!this.getComponent(dep)) {
        if (dep === componentType) {
          throw new Error(
            `Circular dependency detected for component ${componentType.name}`,
          );
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

  getComponent<T extends Component>(
    componentType: new (gameObject: GameObject) => T,
  ): T | null {
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

  getComponents<T extends Component>(
    componentType: new (gameObject: GameObject) => T,
  ): T[] {
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
  removeComponent<T extends Component>(
    componentType: new (gameObject: GameObject) => T,
  ): void {
    const removedComponents = this.components.filter(
      (component) => component instanceof componentType,
    );
    this.components = this.components.filter(
      (component) => !(component instanceof componentType),
    );
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

const objects: Array<GameObject> = [];
const components = {
  physics: new Array<Component>(),
  render: new Array<Component>(),
  singleton: new Map<new () => SingletonComponent, SingletonComponent>(),
};

export function getActivePhysicsComponents(): Array<Component> {
  return components.physics;
}

export function getActiveRenderComponents(): Array<Component> {
  return components.render;
}

export function createGameObject(id: string | null = null): GameObject {
  const obj = new GameObjectImpl(id ? id.toLowerCase() : `game_object_${objects.length}`);
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
  components.physics.push(...componentsToAdd.filter((c) => c.physicsUpdate));
  components.render.push(...componentsToAdd.filter((c) => c.renderUpdate));
}

function removeComponentsFromLists(componentsToRemove: Array<Component>): void {
  const physicsSet = new Set(componentsToRemove.filter((c) => c.physicsUpdate));
  const renderSet = new Set(componentsToRemove.filter((c) => c.renderUpdate));
  components.physics = components.physics.filter((c) => !physicsSet.has(c));
  components.render = components.render.filter((c) => !renderSet.has(c));
}

function getOrCreateSingletonComponent<T extends SingletonComponent>(
  component: new () => T,
): T {
  if (components.singleton.has(component)) {
    return components.singleton.get(component) as T;
  }
  const componentInstance = new component();
  componentInstance.create?.();
  components.singleton.set(component, componentInstance);
  if (componentInstance.physicsUpdate) {
    components.physics.push(componentInstance as any as Component);
  }
  if (componentInstance.renderUpdate) {
    components.render.push(componentInstance as any as Component);
  }
  return componentInstance;
}

export function destroySingletonComponent<T extends SingletonComponent>(
  component: new () => T,
): void {
  if (!components.singleton.has(component)) return;
  const componentInstance = components.singleton.get(component) as T;
  componentInstance.dispose?.();
  components.singleton.delete(component);
  if (componentInstance.physicsUpdate) {
    const index = components.physics.indexOf(
      componentInstance as any as Component,
    );
    if (index !== -1) {
      components.physics.splice(index, 1);
    }
  }
  if (componentInstance.renderUpdate) {
    const index = components.render.indexOf(
      componentInstance as any as Component,
    );
    if (index !== -1) {
      components.render.splice(index, 1);
    }
  }
}

export function getSingletonComponent<T extends SingletonComponent>(
  componentType: new () => T,
): T {
  return getOrCreateSingletonComponent(componentType);
}

// Warning: Slow operation, avoid using in performance-critical code
export function getObjectByID(id: string): GameObject | null {
  id = id.toLowerCase();
  for (let i = 0; i < objects.length; i++) {
    if (objects[i].id === id) {
      return objects[i];
    }
  }
  return null;
}

// Warning: Slow operation, avoid using in performance-critical code
export function getObjectWithComponent<T extends Component>(
  componentType: new (gameObject: GameObject) => T,
): GameObject | null {
  for (let i = 0; i < objects.length; i++) {
    if (objects[i].getComponent(componentType)) {
      return objects[i];
    }
  }
  return null;
}