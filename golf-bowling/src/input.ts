import type { SingletonComponent } from './types.ts';

class Input implements SingletonComponent {
    private lastFrameKeysPressed: Set<string> = new Set();
    private areKeysPressed: Set<string> = new Set();
    private mousePosition: { x: number; y: number } = { x: 0, y: 0 };

    constructor() { }

    create() {
        globalThis.window.addEventListener('keydown', (event) => {
            this.areKeysPressed.add(event.key);
        });
        globalThis.window.addEventListener('keyup', (event) => {
            this.areKeysPressed.delete(event.key);
        });
        globalThis.window.addEventListener('mousedown', (event) => {
            this.areKeysPressed.add(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener('mouseup', (event) => {
            this.areKeysPressed.delete(`Mouse${event.button}`);
        });
        globalThis.window.addEventListener('mousemove', (event) => {
            this.mousePosition.x = event.x;
            this.mousePosition.y = event.y;
        });
    }

    update() {
        this.lastFrameKeysPressed = new Set(this.areKeysPressed);
        this.areKeysPressed.clear();
    }

    isKeyPressed(key: string): boolean {
        return this.areKeysPressed.has(key);
    }

    isKeyJustPressed(key: string): boolean {
        return this.areKeysPressed.has(key) && !this.lastFrameKeysPressed.has(key);
    }

    isKeyJustReleased(key: string): boolean {
        return this.lastFrameKeysPressed.has(key) && !this.areKeysPressed.has(key);
    }
}
