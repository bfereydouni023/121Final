import type { UIManager } from "../uiManager";

declare global {
    interface Window {
        ui?: UIManager;
    }
}

export {};
