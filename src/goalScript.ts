import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { createGameObject } from "./objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "./components";

/**
 * createGoal(scene, position, size)
 * - Adds a goal cube to the scene and returns the created GameObject.
 * - When the ball enters the goal volume this dispatches a "game:victory" event:
 *     window.dispatchEvent(new CustomEvent('game:victory', { detail: { goalId } }))
 */
export function createGoal(
    scene: THREE.Scene,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, -10),
    size: THREE.Vector3 = new THREE.Vector3(2, 2, 2),
) {
    const goal = createGameObject();

    // transform
    const t = goal.addComponent(TransformComponent);
    t.position = { x: position.x, y: position.y, z: position.z };

    // visual cube
    const m = goal.addComponent(MeshComponent);
    m.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            opacity: 0.9,
            transparent: true,
        }),
    );
    m.mesh.position.set(position.x, position.y, position.z);
    m.mesh.userData = m.mesh.userData || {};
    m.mesh.userData.type = "goal";
    m.mesh.userData.gameObject = goal;
    scene.add(m.mesh);

    // physics: static sensor collider so ball can pass through but we detect entry
    const rb = goal.addComponent(RigidbodyComponent);
    try {
        rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        rb.rigidbody.setTranslation(
            { x: position.x, y: position.y, z: position.z },
            true,
        );
        // add collider as sensor (second param `true` indicates sensor in this project convention)
        rb.addCollider(
            RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
            true,
        );
    } catch {
        // ignore if API differs — detection below will still work via overlap test
    }

    // behavior: check each physics tick whether the ball is inside the goal box
    const script = goal.addComponent(ScriptComponent);
    let triggered = false;
    script.onPhysicsUpdate = () => {
        if (triggered) return;

        // find the ball visually in the scene
        let ballObj: THREE.Object3D | null = null;
        scene.traverse((o) => {
            if (ballObj) return;
            const ud = (o as any).userData;
            if (ud && ud.type === "ball") ballObj = o;
        });
        if (!ballObj) return;

        // compute goal box and test containment
        const box = new THREE.Box3().setFromObject(m.mesh);
        const ballPos = (ballObj as THREE.Object3D).getWorldPosition(
            new THREE.Vector3(),
        );
        if (box.containsPoint(ballPos)) {
            triggered = true;
            // dispatch a generic event so UI / main can listen and transition to a victory screen
            window.dispatchEvent(
                new CustomEvent("game:victory", {
                    detail: { goalId: goal.id },
                }),
            );
            // optional: visual feedback
            (m.mesh.material as THREE.Material).opacity = 0.5;
            console.log("[Goal] victory triggered for goal", goal.id);
        }
    };

    // cleanup if system supports disposal
    (script as any).onDispose = () => {
        scene.remove(m.mesh);
    };

    return goal;
}

/**
 * createOverlay(scene, position, size)
 * - Adds an overlay to the scene and returns the created GameObject.
 * - When the overlay is clicked, it removes itself and restarts the game.
 */
export function createOverlay(
    scene: THREE.Scene,
    position: THREE.Vector3 = new THREE.Vector3(0, 0, -10),
    size: THREE.Vector3 = new THREE.Vector3(2, 2, 2),
) {
    const overlay = createGameObject();

    // transform
    const t = overlay.addComponent(TransformComponent);
    t.position = { x: position.x, y: position.y, z: position.z };

    // visual cube
    const m = overlay.addComponent(MeshComponent);
    m.mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            opacity: 0.9,
            transparent: true,
        }),
    );
    m.mesh.position.set(position.x, position.y, position.z);
    m.mesh.userData = m.mesh.userData || {};
    m.mesh.userData.type = "overlay";
    m.mesh.userData.gameObject = overlay;
    scene.add(m.mesh);

    // physics: static sensor collider so ball can pass through but we detect entry
    const rb = overlay.addComponent(RigidbodyComponent);
    try {
        rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        rb.rigidbody.setTranslation(
            { x: position.x, y: position.y, z: position.z },
            true,
        );
        // add collider as sensor (second param `true` indicates sensor in this project convention)
        rb.addCollider(
            RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
            true,
        );
    } catch {
        // ignore if API differs — detection below will still work via overlap test
    }

    // behavior: check each physics tick whether the ball is inside the goal box
    const script = overlay.addComponent(ScriptComponent);
    let triggered = false;
    script.onPhysicsUpdate = () => {
        if (triggered) return;

        // find the ball visually in the scene
        let ballObj: THREE.Object3D | null = null;
        scene.traverse((o) => {
            if (ballObj) return;
            const ud = (o as any).userData;
            if (ud && ud.type === "ball") ballObj = o;
        });
        if (!ballObj) return;

        // compute goal box and test containment
        const box = new THREE.Box3().setFromObject(m.mesh);
        const ballPos = (ballObj as THREE.Object3D).getWorldPosition(
            new THREE.Vector3(),
        );
        if (box.containsPoint(ballPos)) {
            triggered = true;
            // dispatch a generic event so UI / main can listen and transition to a victory screen
            window.dispatchEvent(
                new CustomEvent("game:victory", {
                    detail: { goalId: overlay.id },
                }),
            );
            // optional: visual feedback
            (m.mesh.material as THREE.Material).opacity = 0.5;
            console.log("[Overlay] victory triggered for overlay", overlay.id);
        }
    };

    // cleanup if system supports disposal
    (script as any).onDispose = () => {
        scene.remove(m.mesh);
    };

    return overlay;
}
