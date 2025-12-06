import { destroyGameObject, getSingletonComponent } from "../objectSystem";
import { RespawnSystem } from "../respawnSystem";
import type { Level, GameObject } from "../types";
import { IsResettable, ResetGameObjects } from "../utilities";

export class BaseLevel implements Level {
    id: string = BaseLevel.name;
    protected gameObjects: Map<string, GameObject> = new Map();
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
}
