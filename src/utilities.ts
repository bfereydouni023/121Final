import {
    FollowComponent,
    TransformComponent,
    setFollowRotationOffset,
} from "./components";
import { mainCamera } from "./globals";
import { getObjectByName } from "./objectSystem";
import type { Resettable } from "./types";
import * as THREE from "three";

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
    const ball = getObjectByName("ball");
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

/**
 * Adjust the FollowComponent.rotationOffset.y by deltaRad (radians).
 * This keeps pitch/roll untouched and simply changes the yaw value stored in rotationOffset.y.
 */
export function adjustFollowRotationYaw(deltaRad: number): void {
    try {
        const followComponent =
            mainCamera.gameObject.getComponent(FollowComponent);
        if (!followComponent) {
            console.warn(
                "adjustFollowRotationYaw: Main Camera does not have a FollowComponent",
            );
            return;
        }

        // Debug: print current stored rotationOffset (formatted to 2 decimals)
        const curRo = followComponent.rotationOffset ?? {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
        };
        const fmtNum = (n: number | undefined) =>
            typeof n === "number" ? n.toFixed(2) : "n/a";
        console.debug(
            "[utilities] before adjustFollowRotationYaw rotationOffset:",
            `x:${fmtNum(curRo.x)} y:${fmtNum(curRo.y)} z:${fmtNum(curRo.z)} w:${fmtNum(curRo.w)}`,
        );

        // Read current rotationOffset (treat as quaternion if present), adjust yaw only,
        // then write back using the component helper so systems observe the change.
        const ro = followComponent.rotationOffset ?? { x: 0, y: 0, z: 0, w: 1 };
        const qCurrent = new THREE.Quaternion(
            ro.x ?? 0,
            ro.y ?? 0,
            ro.z ?? 0,
            typeof ro.w === "number" ? ro.w : 1,
        );
        const euler = new THREE.Euler().setFromQuaternion(qCurrent, "XYZ");
        const oldYaw = euler.y;
        euler.y = oldYaw + deltaRad;
        const qNew = new THREE.Quaternion().setFromEuler(euler);

        // Write quaternion form
        setFollowRotationOffset(followComponent, {
            x: qNew.x,
            y: qNew.y,
            z: qNew.z,
            w: qNew.w,
        });

        // Also write Euler form if other systems expect it (safe no-op if ignored)
        try {
            // attach optional debug/euler view in a type-safe way
            (
                followComponent as unknown as Record<string, unknown>
            ).rotationOffsetEuler = {
                x: euler.x,
                y: euler.y,
                z: euler.z,
            };
        } catch (err) {
            console.debug("could not set rotationOffsetEuler:", err);
        }

        // Persist a user yaw in a typed-safe way
        try {
            const fm = followComponent as unknown as Record<string, unknown>;
            const prevRaw = fm.__userYaw;
            const prev = typeof prevRaw === "number" ? (prevRaw as number) : 0;
            fm.__userYaw = prev + deltaRad;
        } catch (err) {
            console.debug("could not set __userYaw:", err);
        }

        // Debug: print key values with 2-decimal precision
        const fmt = (v: number | undefined) =>
            typeof v === "number" ? v.toFixed(2) : "n/a";
        const roOut = followComponent.rotationOffset ?? {
            x: 0,
            y: 0,
            z: 0,
            w: 1,
        };
        const roeRaw = (followComponent as unknown as Record<string, unknown>)
            .rotationOffsetEuler;
        const roe = (roeRaw as
            | { x?: number; y?: number; z?: number }
            | undefined) ?? {
            x: undefined,
            y: undefined,
            z: undefined,
        };
        const userYawRaw = (
            followComponent as unknown as Record<string, unknown>
        ).__userYaw;
        const userYaw =
            typeof userYawRaw === "number" ? (userYawRaw as number) : undefined;

        console.debug(
            "[utilities] adjustFollowRotationYaw\n",
            `oldYaw:${fmt(oldYaw)}\n deltaRad:${fmt(deltaRad)}\n newYaw:${fmt(euler.y)}\n`,
            `rotationOffset(x,y,z,w): ${fmt(roOut.x)} ${fmt(roOut.y)} ${fmt(roOut.z)} ${fmt(roOut.w)}\n`,
            `rotationOffsetEuler(x,y,z): ${fmt(roe.x)} ${fmt(roe.y)} ${fmt(roe.z)}\n`,
            `userYaw: ${typeof userYaw === "number" ? userYaw.toFixed(2) : "n/a"}\n`,
        );
    } catch (err) {
        console.warn("adjustFollowRotationYaw failed:", err);
    }
}

/** Convenience: rotate left (negative yaw) and right (positive yaw) by a step (default 15°) */
export function rotateFollowLeft(stepRad = Math.PI / 12): void {
    adjustFollowRotationYaw(-Math.abs(stepRad));
}
export function rotateFollowRight(stepRad = Math.PI / 12): void {
    adjustFollowRotationYaw(Math.abs(stepRad));
}

export function printToScreen(
    message: string,
    key: string = "default",
    durationMs = 3000,
) {
    // Lazy initialize console div
    let consoleDiv = document.getElementById("consoleOutput");
    if (!consoleDiv) {
        consoleDiv = document.createElement("div");
        consoleDiv.id = "consoleOutput";
        consoleDiv.style.position = "absolute";
        consoleDiv.style.bottom = "10px";
        consoleDiv.style.left = "10px";
        consoleDiv.style.padding = "10px";
        consoleDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        consoleDiv.style.color = "white";
        consoleDiv.style.fontFamily = "monospace";
        consoleDiv.style.zIndex = "1000";
        document.body.appendChild(consoleDiv);
    }
    let textDiv = document.getElementById(`printToScreen-${key}`);
    if (!textDiv) {
        textDiv = document.createElement("div");
        textDiv.id = `printToScreen-${key}`;
        consoleDiv.appendChild(textDiv);
    } else {
        // clear existing timeout if present
        const timeoutRaw = textDiv.dataset.timeout;
        if (timeoutRaw) {
            const timeoutId = parseInt(timeoutRaw, 10);
            clearTimeout(timeoutId);
        }
    }
    textDiv.innerText = message;
    textDiv.dataset.timeout = setTimeout(
        () => consoleDiv!.removeChild(textDiv),
        durationMs,
    ).toString();
}
