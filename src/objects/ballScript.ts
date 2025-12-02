import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { createGameObject } from "../objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "../components";

/**
 * Create a ball GameObject, add mesh + physics, and attach a ScriptComponent
 * that supports click-drag-release to launch the ball in the opposite direction.
 *
 * NOTE: This function now requires the active camera and the DOM element used for pointer events
 * so it can raycast pointer positions into world space.
 */
export function createBall(
    scene: THREE.Scene,
    camera: THREE.Camera,
    domElement: HTMLElement = document.body,
) {
    // validate camera early to give a clear error
    if (!camera) {
        throw new Error(
            "createBall: invalid camera passed. Ensure you pass a valid THREE.Camera and call createBall after creating the camera.",
        );
    }
    const ball = createGameObject("ball");

    // Transform
    const t = ball.addComponent(TransformComponent);
    t.position = { x: 0, y: 10, z: 0 };

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

    function getPointerNDCCoords(event: PointerEvent) {
        const rect = domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pointerToWorldOnBallPlane(
        event: PointerEvent,
        out: THREE.Vector3,
    ) {
        getPointerNDCCoords(event);
        // guard the camera before calling into Three.js
        if (!camera) {
            console.error(
                "pointerToWorldOnBallPlane: invalid camera, aborting raycast",
            );
            return false;
        }
        raycaster.setFromCamera(pointer, camera);

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

    function onPointerDown(ev: PointerEvent) {
        // only left button
        if (ev.button !== 0) return;
        if (!pointerToWorldOnBallPlane(ev, tmpVec)) return;

        // quick raycast to ensure we clicked the ball mesh
        getPointerNDCCoords(ev);
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObject(meshComp.mesh, false);
        if (intersects.length === 0) return;

        dragging = true;
        activePointerId = ev.pointerId;
        dragStartWorld.copy(tmpVec);
        // prevent page drag/selection while interacting
        domElement.setPointerCapture?.(ev.pointerId);
    }

    function onPointerMove(ev: PointerEvent) {
        if (!dragging || ev.pointerId !== activePointerId) return;
        // optional: you could show a visual indicator here using the world point
        pointerToWorldOnBallPlane(ev, tmpVec);
    }

    function onPointerUp(ev: PointerEvent) {
        if (!dragging || ev.pointerId !== activePointerId) return;
        // release pointer capture
        domElement.releasePointerCapture?.(ev.pointerId);

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
    }

    // Attach pointer listeners to the provided DOM element
    domElement.addEventListener("pointerdown", onPointerDown);
    domElement.addEventListener("pointermove", onPointerMove);
    domElement.addEventListener("pointerup", onPointerUp);
    domElement.addEventListener("pointercancel", onPointerUp);
    domElement.addEventListener("pointerleave", onPointerUp);

    // Hook to clean up listeners if the script/component system supports disposal
    script.onDispose = () => {
        domElement.removeEventListener("pointerdown", onPointerDown);
        domElement.removeEventListener("pointermove", onPointerMove);
        domElement.removeEventListener("pointerup", onPointerUp);
        domElement.removeEventListener("pointercancel", onPointerUp);
        domElement.removeEventListener("pointerleave", onPointerUp);
    };

    return ball;
}
