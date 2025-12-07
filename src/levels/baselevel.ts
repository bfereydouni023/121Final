import { destroyGameObject, getSingletonComponent } from "../objectSystem";
import { Inventory } from "../inventory";
import { RespawnSystem } from "../respawnSystem";
import type { Level, GameObject } from "../types";
import { IsResettable, ResetGameObjects } from "../utilities";

export class BaseLevel implements Level {
    id: string = BaseLevel.name;
    protected gameObjects: Map<string, GameObject> = new Map();
    private respawnableFactories: Map<string, () => GameObject> = new Map();
    protected isActive: boolean = false;
    get active(): boolean {
        return this.isActive;
    }
    set active(value: boolean) {
        if (value && !this.isActive) {
            this.onActivate();
        } else if (!value && this.isActive) {
            this.onDeactivate();
        }
        this.isActive = value;
    }

    destroy(): void {
        destroyGameObject(...this.gameObjects.values());
        this.gameObjects.clear();
    }

    reset(): void {
        getSingletonComponent(Inventory).clear();
        this.respawnRegisteredObjects();
        ResetGameObjects(
            ...Array.from(this.gameObjects.values()).filter((go) =>
                IsResettable(go),
            ),
        );
        getSingletonComponent(RespawnSystem).respawn();
    }

    protected createObjects(): void {}
    protected onActivate(): void {}
    protected onDeactivate(): void {}

    protected registerRespawnable(
        name: string,
        factory: () => GameObject,
    ): GameObject {
        this.respawnableFactories.set(name, factory);
        return this.replaceRespawnable(name, factory);
    }

    private respawnRegisteredObjects(): void {
        for (const [name, factory] of this.respawnableFactories.entries()) {
            this.replaceRespawnable(name, factory);
        }
    }

    private replaceRespawnable(
        name: string,
        factory: () => GameObject,
    ): GameObject {
        const existing = this.gameObjects.get(name);
        if (existing) {
            destroyGameObject(existing);
            this.gameObjects.delete(name);
        }
        const created = factory();
        this.gameObjects.set(name, created);
        return created;
    }
}
