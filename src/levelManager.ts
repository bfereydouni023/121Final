import { FollowComponent, TransformComponent } from "./components";
import { cameraMapViewTransform, mainCamera } from "./globals";
import { Level1 } from "./levels/level1";
import { Level2 } from "./levels/level2";
import { Level3 } from "./levels/level3";
import { getSingletonComponent } from "./objectSystem";
import { SerializationSystem } from "./serialization";
import { TweenManager } from "./tweenManager";
import type { Level, SingletonComponent } from "./types";
import { setupCameraTracking } from "./utilities";

export class LevelManager implements SingletonComponent {
    private levels: Map<string, Level> = new Map();
    private activeLevel: Level | null = null;

    create(): void {
        this.registerLevel(new Level1());
        this.registerLevel(new Level2());
        this.registerLevel(new Level3());
    }

    private registerLevel(level: Level): void {
        this.levels.set(level.id.toLowerCase(), level);
    }

    swapToLevel(targetId: string) {
        console.debug("[LevelManager] swapToLevel requested:", targetId);
        if (this.activeLevel) {
            this.activeLevel.active = false;
            this.doMapZoomOutIn();
        } else {
            setTimeout(() => setupCameraTracking(), 1000);
        }
        const newLevel = this.levels.get(targetId.toLowerCase());
        if (!newLevel) {
            throw new Error(`Level with ID ${targetId} not found.`);
        }
        newLevel.active = true;
        this.activeLevel = newLevel;
        const serializationSystem = getSingletonComponent(SerializationSystem);
        serializationSystem.saveLevel(targetId);

        //camera is currently broken
    }

    resetCurrentLevel(): void {
        if (this.activeLevel) {
            this.activeLevel.reset();
        }
    }

    private doMapZoomOutIn(): void {
        mainCamera.gameObject.getComponent(FollowComponent)!.target = null;

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

    // Expose the active level (read-only) and its id for other systems
    public get currentLevel(): Level | null {
        return this.activeLevel;
    }

    public get currentLevelId(): string | null {
        return this.activeLevel?.id ?? null;
    }
}
