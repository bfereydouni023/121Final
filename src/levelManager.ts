import { TransformComponent } from "./components";
import { cameraMapViewTransform, mainCamera } from "./globals";
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
            this.doMapZoomOutIn();
        } else {
            setTimeout(() => setupCameraTracking(), 1000);
        }
        const newLevel = this.levels.get(levelID);
        if (!newLevel) {
            throw new Error(`Level with ID ${levelID} not found.`);
        }
        newLevel.active = true;
        this.activeLevel = newLevel;
    }

    private doMapZoomOutIn(): void {
        const cameraTransform =
            mainCamera.gameObject.getComponent(TransformComponent)!;
        const tm = getSingletonComponent(TweenManager);
        tm.createTween(cameraTransform.position)
            .to(cameraMapViewTransform.position, 2000)
            .onComplete(() => setupCameraTracking())
            .start();
        tm.createTween(cameraTransform.rotation)
            .to(cameraMapViewTransform.rotation, 2000)
            .start();
    }
}
