import { Inventory } from "./inventory";
import { LevelManager } from "./levelManager";
import { getSingletonComponent } from "./objectSystem";
import { SerializationSystem } from "./serialization";

declare global {
    interface Window {
        goToLevel: (levelID: string) => void;
        addItemToInventory: (itemID: string, quantity?: number) => void;
        removeItemFromInventory: (itemID: string, quantity?: number) => void;
        getItemQuantity: (itemID: string) => number;
        getInventoryContents: () => Record<string, number>;
        resetLevel: () => void;
        getSerializedGameState: () => string;
    }
}

if (globalThis.window === undefined) {
    throw new Error("console.ts can only be used with a window.");
}

globalThis.window.goToLevel = (levelID: string): void => {
    getSingletonComponent(LevelManager).swapToLevel(levelID);
};

globalThis.window.resetLevel = (): void => {
    const levelManager = getSingletonComponent(LevelManager);
    levelManager.resetCurrentLevel();
};

globalThis.window.addItemToInventory = (
    itemID: string,
    quantity?: number,
): Record<string, number> => {
    const inventory = getSingletonComponent(Inventory);
    inventory.addItem(itemID, quantity);
    return globalThis.window.getInventoryContents();
};

globalThis.window.removeItemFromInventory = (
    itemID: string,
    quantity?: number,
): Record<string, number> => {
    const inventory = getSingletonComponent(Inventory);
    inventory.removeItem(itemID, quantity);
    return globalThis.window.getInventoryContents();
};

globalThis.window.getItemQuantity = (itemID: string): number => {
    const inventory = getSingletonComponent(Inventory);
    return inventory.getItemQuantity(itemID);
};

globalThis.window.getInventoryContents = (): Record<string, number> => {
    const inventory = getSingletonComponent(Inventory);
    const contents: Record<string, number> = {};
    for (const [itemID, quantity] of inventory["items"]) {
        contents[itemID] = quantity;
    }
    return contents;
};

globalThis.window.getSerializedGameState = (): string => {
    const serializationSystem = getSingletonComponent(SerializationSystem);
    const levelID = serializationSystem.getLevel();
    const inventory = serializationSystem.getInventoryMemento();
    return JSON.stringify({ levelID, inventory }, null, 2);
};
