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
