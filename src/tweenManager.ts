import { Group, Tween } from "@tweenjs/tween.js";
import type { SingletonComponent } from "./types.ts";

type AnyTweenTarget = Record<string, unknown>;
type AnyTween = Tween<AnyTweenTarget>;

interface TrackedTween {
    tween: AnyTween;
    completed: boolean;
}

export class TweenManager implements SingletonComponent {
    private readonly group = new Group();
    private tweens: TrackedTween[] = [];

    /**
     * Warning: changing the tween's group will cause it to no longer be updated automatically.
     * @param target
     * @returns
     */
    createTween<T extends AnyTweenTarget>(target: T): Tween<T> {
        const tween = new Tween(target);
        this.group.add(tween);

        const tracked: TrackedTween = {
            tween: tween as unknown as AnyTween,
            completed: false,
        };

        const markComplete = () => {
            if (tracked.completed) return;
            tracked.completed = true;
            this.group.remove(tween);
        };

        tween.onComplete(markComplete);
        tween.onStop(markComplete);

        this.tweens.push(tracked);
        return tween;
    }

    updateTweens(time?: number): void {
        if (this.tweens.length === 0) return;

        const timestamp = time ?? this.now();
        this.group.update(timestamp);
        this.removeCompletedTweens();
    }

    renderUpdate(_deltaTime: number): void {
        this.updateTweens();
    }

    dispose(): void {
        for (const entry of this.tweens) {
            entry.tween.stop();
        }
        this.group.removeAll();
        this.tweens = [];
    }

    get activeTweenCount(): number {
        return this.tweens.length;
    }

    private removeCompletedTweens(): void {
        if (this.tweens.length === 0) return;
        this.tweens = this.tweens.filter((entry) => !entry.completed);
    }

    private now(): number {
        return typeof performance !== "undefined"
            ? performance.now()
            : Date.now();
    }
}
