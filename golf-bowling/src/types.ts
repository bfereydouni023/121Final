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

export interface GameObject {
  id: string;
  set active(value: boolean);
  get active(): boolean;
  addComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T;
  getComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): T | null;
  getComponents<T extends Component>(componentType: new (gameObject: GameObject) => T): T[];
  removeComponent<T extends Component>(componentType: new (gameObject: GameObject) => T): void;
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