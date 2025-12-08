import { getSingletonComponent } from "./objectSystem";
import { SerializationSystem } from "./serialization";
import type { SingletonComponent } from "./types";

export class Inventory implements SingletonComponent {
    private items: Map<string, number> = new Map();
    create(): void {
        const serializationSystem = getSingletonComponent(SerializationSystem);
        const savedInventory = serializationSystem.getInventoryMemento();
        for (const [itemID, quantity] of Object.entries(savedInventory)) {
            this.items.set(itemID, quantity);
        }
    }

    addItem(itemID: string, quantity: number = 1): void {
        const currentQuantity = this.items.get(itemID) || 0;
        this.items.set(itemID, currentQuantity + quantity);
        getSingletonComponent(SerializationSystem).saveInventory(
            Object.fromEntries(this.items),
        );

        // If the added item is a key, trigger the UI animation
        try {
            if (itemID === "gold_key") {
                console.log("Gold key added to inventory");
                // call appearKeyEmoji if a UI manager instance is exposed on window
                // (safe no-op if not present)
                window.ui?.appearKeyEmoji?.();
            }
        } catch (err) {
            console.error("Error while triggering key UI animation:", err);
        }
    }

    removeItem(itemID: string, quantity: number = 1): void {
        const currentQuantity = this.items.get(itemID) || 0;
        const newQuantity = currentQuantity - quantity;
        if (newQuantity > 0) {
            this.items.set(itemID, newQuantity);
        } else {
            this.items.delete(itemID);
        }
        getSingletonComponent(SerializationSystem).saveInventory(
            Object.fromEntries(this.items),
        );

        // If the added item is a key, trigger the UI animation
        try {
            if (itemID === "gold_key") {
                // call appearKeyEmoji if a UI manager instance is exposed on window
                // (safe no-op if not present)
                window.ui?.disappearKeyEmoji?.();
            }
        } catch (err) {
            console.error("Error while triggering key UI animation:", err);
        }
    }

    hasItem(itemID: string): boolean {
        return this.items.has(itemID);
    }

    clear(): void {
        this.items.clear();
        getSingletonComponent(SerializationSystem).saveInventory({});
    }

    getItemQuantity(itemID: string): number {
        return this.items.get(itemID) || 0;
    }
}
