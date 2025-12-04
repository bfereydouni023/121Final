import { Tween } from "@tweenjs/tween.js";
import { mainCamera } from "./globals";
import { Level1 } from "./levels/level1";
import { getSingletonComponent } from "./objectSystem";
import { TweenManager } from "./tweenManager";
import type { Level, SingletonComponent } from "./types";

export class LevelManager implements SingletonComponent {
    private levels: Map<string, Level> = new Map();
    private activeLevel: Level | null = null;

    create(): void {
        this.registerLevel(new Level1());
        this.swapToLevel(typeof Level1);
    }

    registerLevel(level: Level): void {
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
    }
}
