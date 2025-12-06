import * as THREE from "three";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Input } from "../input";
import type { PointerInputEvent } from "../input";
import { createGameObject, getSingletonComponent } from "../objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "../components";
import { mainCamera } from "../globals";
import { world } from "../globals";

/**
 * Create a ball GameObject, add mesh + physics, and attach a ScriptComponent
 * that supports click-drag-release to launch the ball in the opposite direction.
 *
 * NOTE: This function now requires the active camera. Pointer interactions are wired through the
 * global Input event bus so individual objects no longer need direct DOM access.
 */
export function createBall(
    scene: THREE.Scene,
    x?: number,
    y?: number,
    z?: number,
) {
    // validate camera early to give a clear error
    if (!mainCamera) {
        throw new Error(
            "createBall: invalid camera passed. Ensure you pass a valid THREE.Camera and call createBall after creating the camera.",
        );
    }
    const input = getSingletonComponent(Input);
    const ball = createGameObject("ball");

    // Transform
    const t = ball.addComponent(TransformComponent);
    t.position = { x: x ?? 0, y: y ?? 10, z: z ?? 0 };

    // Visual mesh
    const meshComp = ball.addComponent(MeshComponent);
    const radius = 1.5;
    meshComp.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 24),
        new THREE.MeshStandardMaterial({
            color: 0xff5500,
            metalness: 0.2,
            roughness: 0.6,
        }),
    );
    meshComp.mesh.userData = meshComp.mesh.userData || {};
    meshComp.mesh.userData.type = "ball";
    meshComp.mesh.userData.gameObject = ball;
    scene.add(meshComp.mesh);

    // Physics
    const rbComp = ball.addComponent(RigidbodyComponent);
    rbComp.rigidbody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    rbComp.mass = 1;
    rbComp.addCollider(RAPIER.ColliderDesc.ball(radius), false);

    // Script / behavior component - adds drag-to-launch interactions
    const script = ball.addComponent(ScriptComponent);

    // Raycaster + plane helpers for mapping pointer -> world at the ball depth
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    const tmpVec = new THREE.Vector3();

    let dragging = false;
    const dragStartWorld = new THREE.Vector3();
    let activePointerId: number | null = null;

    // Trajectory indicator (fat line using three/examples Line2)
    const TRAJ_POINTS = 40;
    const TRAJ_DT = 0.02; // seconds between samples
    let trajLine: Line2 | null = null;
    let trajGeometry: LineGeometry | null = null;
    let trajMaterial: LineMaterial | null = null;

    function createTrajectoryLine() {
        // positions array: x,y,z repeated
        const positions = new Float32Array(TRAJ_POINTS * 3);
        trajGeometry = new LineGeometry();
        // LineGeometry#setPositions expects a flat array of numbers
        trajGeometry.setPositions(Array.from(positions));

        // try to pick accent color from UI CSS var if available (fallback to hex)

        const accentHex = 0xff8800; // orange
        trajMaterial = new LineMaterial({
            color: accentHex,
            linewidth: 6, // thickness in pixels (adjust to taste)
            transparent: true,
            opacity: 0.95,
        });
        // material needs screen resolution to compute linewidth
        try {
            trajMaterial.resolution.set(window.innerWidth, window.innerHeight);
        } catch {
            // ignore in non-browser envs
        }

        trajLine = new Line2(trajGeometry, trajMaterial);
        trajLine.computeLineDistances();
        trajLine.frustumCulled = false;
        scene.add(trajLine);

        // keep resolution updated on resize
        const onResize = () => {
            try {
                trajMaterial?.resolution.set(
                    window.innerWidth,
                    window.innerHeight,
                );
            } catch (err) {
                console.warn("trajLine onResize failed:", err);
            }
        };
        window.addEventListener("resize", onResize);
        // store as property for cleanup in dispose handler
        (trajLine as unknown as { __onResize?: () => void }).__onResize =
            onResize;
    }

    function updateTrajectory(
        position: THREE.Vector3,
        initialVelocity: THREE.Vector3,
    ) {
        if (!trajLine || !trajGeometry) createTrajectoryLine();
        if (!trajLine || !trajGeometry) return;
        const gVec = (() => {
            // try to read world gravity, fallback to -9.81 on Y
            try {
                const g = (
                    world as { gravity?: { x: number; y: number; z: number } }
                )?.gravity;
                if (g) return new THREE.Vector3(g.x, g.y, g.z);
            } catch (err) {
                console.warn(
                    "updateTrajectory: read world.gravity failed:",
                    err,
                );
            }
            return new THREE.Vector3(0, -9.81, 0);
        })();

        const ptsArray: number[] = [];
        const tmp = new THREE.Vector3();
        for (let i = 0; i < TRAJ_POINTS; i++) {
            const t = i * TRAJ_DT;
            // p = p0 + v0*t + 0.5*g*t^2
            tmp.copy(initialVelocity).multiplyScalar(t);
            const gterm = gVec.clone().multiplyScalar(0.5 * t * t);
            tmp.add(gterm).add(position);
            ptsArray.push(tmp.x, tmp.y, tmp.z);
        }
        // update geometry positions
        trajGeometry.setPositions(ptsArray);
        trajLine.computeLineDistances();
        trajLine.visible = true;
    }

    function hideTrajectory() {
        if (!trajLine) return;
        trajLine.visible = false;
    }

    function pointerToWorldOnBallPlane(
        event: PointerInputEvent,
        out: THREE.Vector3,
    ) {
        pointer.set(event.normalizedPosition.x, event.normalizedPosition.y);
        // guard the camera before calling into Three.js
        if (!mainCamera) {
            console.error(
                "pointerToWorldOnBallPlane: invalid camera, aborting raycast",
            );
            return false;
        }
        raycaster.setFromCamera(pointer, mainCamera);

        // Use a horizontal plane at the ball's current Y so drag is constrained to XZ (horizontal) movement.
        // This makes dragging map to world X/Z only.
        const ballWorldPos = meshComp.mesh.getWorldPosition(
            new THREE.Vector3(),
        );
        const horizontalNormal = new THREE.Vector3(0, 1, 0);
        plane.setFromNormalAndCoplanarPoint(horizontalNormal, ballWorldPos);

        const intersectPoint = new THREE.Vector3();
        const hit = raycaster.ray.intersectPlane(plane, intersectPoint);
        if (hit) {
            out.copy(intersectPoint);
            return true;
        }
        return false;
    }

    function onPointerDown(ev: PointerInputEvent) {
        // only left button
        if (ev.button !== 0) return;
        if (!pointerToWorldOnBallPlane(ev, tmpVec)) return;

        // quick raycast to ensure we clicked the ball mesh
        const intersects = raycaster.intersectObject(meshComp.mesh, false);
        if (intersects.length === 0) return;

        dragging = true;
        activePointerId = ev.pointerId;
        dragStartWorld.copy(tmpVec);
        // show empty indicator
        hideTrajectory();
    }

    function onPointerMove(ev: PointerInputEvent) {
        if (!dragging || ev.pointerId !== activePointerId) return;
        // optional: you could show a visual indicator here using the world point
        if (!pointerToWorldOnBallPlane(ev, tmpVec)) return;
        // compute preview using same logic as onPointerUp (but without applying impulse)
        const dragNow = new THREE.Vector3().subVectors(tmpVec, dragStartWorld);
        dragNow.y = 0;
        const dragLen = dragNow.length();
        const strength = Math.min(dragLen * 60, 400);
        // direction is opposite of drag (player drags backward)
        const impulseDir = dragNow.clone().negate().normalize();
        const impulse = impulseDir.clone().multiplyScalar(strength);
        // velocity estimate: v0 = impulse / mass (rbComp.mass previously set)
        const mass =
            rbComp.mass && typeof rbComp.mass === "number" ? rbComp.mass : 1;
        const v0 = impulse.clone().divideScalar(mass);
        // world position to start from (ball current world position)
        const startPos = meshComp.mesh.getWorldPosition(new THREE.Vector3());
        updateTrajectory(startPos, v0);
    }

    function onPointerUp(ev: PointerInputEvent) {
        if (!dragging || ev.pointerId !== activePointerId) return;

        const dragEndWorld = new THREE.Vector3();
        const got = pointerToWorldOnBallPlane(ev, dragEndWorld);
        // fallback: if plane intersection fails, use last known tmpVec
        if (!got) dragEndWorld.copy(tmpVec);

        // compute impulse direction: opposite of drag vector (player drags backward to shoot forward)
        const dragVec = new THREE.Vector3().subVectors(
            dragEndWorld,
            dragStartWorld,
        );
        // constrain to horizontal (ignore Y) so launch is only in XZ plane
        dragVec.y = 0;
        if (dragVec.lengthSq() < 1e-6) {
            // tiny drag — apply a small upward nudge
            dragVec.set(0, -0.2, 0);
        }
        const impulseDir = dragVec.clone().negate().normalize();

        // scale strength by drag length (tweak multiplier to taste)
        const strength = Math.min(dragVec.length() * 60, 400);
        const impulse = {
            x: impulseDir.x * strength,
            y: impulseDir.y * strength,
            z: impulseDir.z * strength,
        };

        rbComp.rigidbody.applyImpulse(impulse, true);

        dragging = false;
        activePointerId = null;
        // hide the indicator on release
        hideTrajectory();
    }

    const removeListeners = [
        input.addEventListener("pointerDown", onPointerDown),
        input.addEventListener("pointerMove", onPointerMove),
        input.addEventListener("pointerUp", onPointerUp),
        input.addEventListener("pointerCancel", onPointerUp),
        input.addEventListener("pointerLeave", onPointerUp),
    ];

    // Hook to clean up listeners if the script/component system supports disposal
    script.onDispose = () => {
        removeListeners.forEach((dispose) => dispose());
        try {
            hideTrajectory();
            if (trajLine) {
                // remove resize listener
                const onResize = (
                    trajLine as unknown as { __onResize?: () => void }
                ).__onResize;
                if (onResize) window.removeEventListener("resize", onResize);
                scene.remove(trajLine);
                trajLine = null;
            }
            trajGeometry = null;
            if (trajMaterial) {
                try {
                    trajMaterial.dispose?.();
                } catch (err) {
                    console.warn("trajMaterial.dispose failed:", err);
                }
                trajMaterial = null;
            }
        } catch (err) {
            console.warn("onDispose failed:", err);
        }
    };

    return ball;
}

// moved three/examples type declarations to an ambient .d.ts file at:
// src/types/three-line2.d.ts
