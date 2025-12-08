import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { createGameObject } from "../objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "../components";
import { getSingletonComponent } from "../objectSystem";
import { LevelManager } from "../levelManager";
import { Level1 } from "../levels/level1";
import { Level2 } from "../levels/level2";
import { Level3 } from "../levels/level3";

/**
 * createGoal(scene, position, size)
 * - Adds a goal cube to the scene and returns the created GameObject.
 * - When the ball enters the goal volume this dispatches a "game:victory" event:
 *     window.dispatchEvent(new CustomEvent('game:victory', { detail: { goalId } }))
 * - If the current level is Level1, it will attempt to swap to Level2 via the LevelManager.
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
    rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    rb.rigidbody.setTranslation(
        { x: position.x, y: position.y, z: position.z },
        true,
    );
    // add collider as sensor (second param `true` indicates sensor in this project convention)
    rb.addCollider(
        RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
        false,
    );

    // behavior: use collision callbacks instead of scanning the scene each physics tick
    const script = goal.addComponent(ScriptComponent);
    let triggered = false;

    script.onCollisionEnter = () => {
        if (triggered) return;
        triggered = true;

        // Query the LevelManager singleton for the active level id (robust)
        const lm = getSingletonComponent(LevelManager);
        const currentId = lm?.currentLevelId ?? undefined;
        let nextId: string;
        if (currentId === Level1.name) nextId = Level2.name;
        else if (currentId === Level2.name) nextId = Level3.name;
        else if (currentId === Level3.name)
            nextId = Level1.name; // wrap
        else nextId = Level2.name; // sensible default

        console.debug(
            "[Goal] currentLevelId:",
            currentId,
            "-> requesting swap to",
            nextId,
        );

        // notify the app that this level was completed / should be unlocked
        try {
            window.dispatchEvent(
                new CustomEvent("level:unlock", {
                    detail: { currentLevelId: currentId },
                }),
            );
        } catch (err) {
            console.warn("[Goal] failed to dispatch level:unlock event:", err);
        }

        lm?.swapToLevel(nextId);
    };

    script.onCollisionExit = () => {
        // no-op for now; kept for symmetry and future use
    };

    // cleanup if system supports disposal
    script.onDispose = () => {
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

    // behavior: check each physics tick whether the ball is inside the goal box
    const script = overlay.addComponent(ScriptComponent);
    let triggered = false;
    script.onPhysicsUpdate = () => {
        if (triggered) return;

        // find the ball visually in the scene
        let ballObj: THREE.Object3D | null = null;
        scene.traverse((o) => {
            if (ballObj) return;
            const ud = o.userData;
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
                    detail: { goalId: overlay.name },
                }),
            );
            // optional: visual feedback
            (m.mesh.material as THREE.MeshStandardMaterial).opacity = 0.5;
            console.log(
                "[Overlay] victory triggered for overlay",
                overlay.name,
            );
        }
    };

    // cleanup if system supports disposal
    script.onDispose = () => {
        scene.remove(m.mesh);
    };

    return overlay;
}
