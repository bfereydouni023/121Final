import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    PickupComponent,
    ScriptComponent,
} from "../components";
import { scene } from "../globals";
import {
    createGameObject,
    destroyGameObject,
    getSingletonComponent,
} from "../objectSystem";
import { Inventory } from "../inventory";

/**
 * Create a pickupable key.
 * - keyId: string stored in Inventory when picked up (e.g. "gold_key")
 * - playerId: optional id of player GameObject to register as a trigger (defaults to "player")
 */
export function createKey(position: THREE.Vector3, keyId: string = "gold_key") {
    const go = createGameObject(keyId);
    const tf = go.addComponent(TransformComponent);
    tf.position = { x: position.x, y: position.y, z: position.z };
    tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

    const meshComp = go.addComponent(MeshComponent);
    const geom = new THREE.SphereGeometry(2, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    meshComp.mesh = mesh;

    const rb = go.addComponent(RigidbodyComponent);
    rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    rb.addCollider(RAPIER.ColliderDesc.ball(1), false);

    const pickup = go.addComponent(PickupComponent);
    // debug helper to confirm collisions are delivered to components
    const dbg = go.addComponent(ScriptComponent);
    dbg.onCollisionEnter = (other) => {
        console.debug(
            "[Key DEBUG] onCollisionEnter: other=",
            other?.name ?? other,
        );
    };

    // allow pressing "9" to pick up this key (useful for testing)
    let pickedByKey = false;
    const doPickup = () => {
        if (pickedByKey) return;
        pickedByKey = true;
        try {
            const inv = getSingletonComponent(Inventory);
            inv.addItem(keyId, 1);
            console.debug(`[Key] picked up ${keyId} via keypress`);
        } catch (err) {
            console.warn("[Key] failed to add to inventory (keypress):", err);
        }
        // remove listener before destroying to avoid leaks
        try {
            window.removeEventListener("keydown", onKey);
        } catch (err) {
            console.warn(
                "[Key] failed to remove keydown listener (keypress):",
                err,
            );
        }
        try {
            destroyGameObject(go);
        } catch (err) {
            console.warn("[Key] failed to destroy key object (keypress):", err);
            try {
                mesh.visible = false;
            } catch (err) {
                console.warn("[Key] failed to hide mesh (keypress):", err);
            }
        }
    };
    const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "9") {
            doPickup();
        }
    };
    window.addEventListener("keydown", onKey);
    dbg.onDispose = () => {
        try {
            window.removeEventListener("keydown", onKey);
        } catch (err) {
            console.warn(
                "[Key] failed to remove keydown listener (dispose):",
                err,
            );
        }
    };

    // onPickup: add to inventory and destroy the key gameobject
    pickup.onPickup = (other) => {
        try {
            const inv = getSingletonComponent(Inventory);
            inv.addItem(keyId, 1);
            console.debug(
                `[Key] picked up ${keyId} by ${other?.name ?? "unknown"}`,
            );
        } catch (err) {
            console.warn("[Key] failed to add to inventory:", err);
        }
        try {
            // ensure keypress listener removed
            try {
                window.removeEventListener("keydown", onKey);
            } catch (err) {
                console.warn(
                    "[Key] failed to remove keydown listener (pickup):",
                    err,
                );
            }
            destroyGameObject(go);
        } catch (err) {
            console.warn("[Key] failed to destroy key object:", err);
            // fallback: hide visual
            try {
                mesh.visible = false;
            } catch (err) {
                console.warn("[Key] failed to hide mesh (pickup):", err);
            }
        }
    };

    return go;
}

export default createKey;
