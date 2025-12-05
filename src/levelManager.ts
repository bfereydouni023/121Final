import { TransformComponent } from "./components";
import { mainCamera } from "./globals";
import { Level1 } from "./levels/level1";
import { getSingletonComponent } from "./objectSystem";
import { TweenManager } from "./tweenManager";
import type { Level, SingletonComponent } from "./types";
import { setupCameraTracking } from "./utilities";

export class LevelManager implements SingletonComponent {
    private levels: Map<string, Level> = new Map();
    private activeLevel: Level | null = null;

    create(): void {
        this.registerLevel(new Level1());
    }

    private registerLevel(level: Level): void {
        this.levels.set(level.id, level);
    }

    swapToLevel(levelID: string): void {
        if (this.activeLevel) {
            this.activeLevel.active = false;
        }
        const newLevel = this.levels.get(levelID);
        if (!newLevel) {
            throw new Error(`Level with ID ${levelID} not found.`);
        }
        newLevel.active = true;
        this.activeLevel = newLevel;
        const cameraTransform =
            mainCamera.gameObject.getComponent(TransformComponent)!;
        const tm = getSingletonComponent(TweenManager);
        tm.createTween(cameraTransform.position)
            .to({ x: 0, y: 150, z: 10 }, 2000)
            .onComplete(() => setupCameraTracking())
            .start();
        tm.createTween(cameraTransform.rotation)
            .to({ x: -Math.PI / 2, y: 0, z: 0, w: 0 }, 2000)
            .start();
    }
}
