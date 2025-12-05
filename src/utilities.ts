import { FollowComponent, TransformComponent } from "./components";
import { mainCamera } from "./globals";
import { getObjectByID } from "./objectSystem";
import type { Resettable } from "./types";

export function IsResettable(obj: unknown): obj is Resettable {
    return typeof (obj as Partial<Resettable>).reset === "function";
}

export function ResetGameObjects(...objects: Resettable[]): void {
    for (const obj of objects) {
        obj.reset();
    }
}

export function setupCameraTracking() {
    const followComponent = mainCamera.gameObject.getComponent(FollowComponent);
    if (!followComponent) {
        console.warn("Main Camera does not have a FollowComponent");
        return;
    }
    const ball = getObjectByID("ball");
    if (ball == null) {
        console.warn("Could not find ball for camera follow");
    } else {
        followComponent.target = ball.getComponent(TransformComponent)!;
    }
    followComponent.positionOffset = { x: 0, y: 15, z: 10 };
    followComponent.rotationOffset = { x: -0.08, y: 0, z: 0, w: 0 };
    followComponent.updateMode = "physics";
    followComponent.rotationMode = "fixed";
    followComponent.positionMode = "follow";
    followComponent.positionSmoothFactor = 0.1;
}
