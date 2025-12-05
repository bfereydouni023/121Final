import { BaseLevel } from "./baselevel";

export class Level2 extends BaseLevel {
    constructor() {
        super();
        this.id = Level2.name;
        this.createObjects();
    }

    protected createObjects(): void {
        // Implementation for creating level 2 objects goes here
    }
}
