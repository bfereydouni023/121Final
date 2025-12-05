import type { SingletonComponent } from "./types";

interface SerializedGameState {
    levelID: string;
    inventory: Record<string, number>;
}

export class SerializationSystem implements SingletonComponent {
    private static readonly DEBOUNCE_DELAY = 1000;
    private gameState: SerializedGameState | null = null;
    private debounceTimeout: number | null = null;

    create(): void {
        this.gameState = this.load();
        window.addEventListener("beforeunload", () => {
            if (this.gameState) {
                this.saveImmediate(this.gameState);
            }
        });
    }

    dispose(): void {
        if (this.gameState) {
            this.saveImmediate(this.gameState);
        }
    }

    private load(): SerializedGameState | null {
        const savedState = localStorage.getItem("gameState");
        if (savedState) {
            return JSON.parse(savedState) as SerializedGameState;
        }
        return null;
    }

    private save(state: SerializedGameState): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = setTimeout(
            () => this.saveImmediate(state),
            SerializationSystem.DEBOUNCE_DELAY,
        );
    }

    private saveImmediate(state: SerializedGameState): void {
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
        localStorage.setItem("gameState", JSON.stringify(state));
    }

    saveInventory(inventory: Record<string, number>): void {
        if (!this.gameState) {
            this.gameState = { levelID: "level1", inventory: {} };
        }
        this.gameState.inventory = inventory;
        this.save(this.gameState);
    }

    saveLevel(levelID: string): void {
        if (!this.gameState) {
            this.gameState = { levelID: levelID, inventory: {} };
        }
        this.gameState.levelID = levelID;
        this.save(this.gameState);
    }

    getInventoryMemento(): Record<string, number> {
        return this.gameState ? this.gameState.inventory : {};
    }

    getLevel(): string {
        return this.gameState ? this.gameState.levelID : "level1";
    }
}
