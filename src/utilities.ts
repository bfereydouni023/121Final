import type { Resettable } from "./types";

export function IsResettable(obj: unknown): obj is Resettable {
    return typeof (obj as Partial<Resettable>).reset === "function";
}

export function ResetGameObjects(...objects: Resettable[]): void {
    for (const obj of objects) {
        obj.reset();
    }
}
