import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "../components";
import { scene } from "../globals";
import { createGameObject, getObjectByName } from "../objectSystem";
import { getSingletonComponent } from "../objectSystem";
import { Inventory } from "../inventory";

/**
 * Create a door that opens when the player has a required key in inventory.
 * - keyId: id required to open (e.g. "gold_key")
 * - onOpen: optional callback when door opens
 */
export function createDoor(
    position: THREE.Vector3,
    size: THREE.Vector3 = new THREE.Vector3(1, 2.5, 0.2),
    keyId: string = "gold_key",
    onOpen?: (doorGO: ReturnType<typeof createDoor>) => void,
) {
    const go = createGameObject();
    const tf = go.addComponent(TransformComponent);
    tf.position = { x: position.x, y: position.y, z: position.z };
    tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

    const meshComp = go.addComponent(MeshComponent);
    const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x663300 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(position.x, position.y, position.z);
    mesh.userData = mesh.userData || {};
    mesh.userData.type = "door";
    mesh.userData.keyId = keyId;
    mesh.userData.gameObject = go;
    scene.add(mesh);
    meshComp.mesh = mesh;

    const rb = go.addComponent(RigidbodyComponent);
    // Make door a fixed collider so it blocks the player until opened
    rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    rb.rigidbody.setTranslation(
        { x: position.x, y: position.y, z: position.z },
        true,
    );
    // non-sensor collider so the door physically blocks the player while closed
    rb.addCollider(
        RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
        false,
    );

    const script = go.addComponent(ScriptComponent);

    // Track opened state
    let opened = false;

    function openDoor() {
        if (opened) return;
        opened = true;
        try {
            // remove physics blocking
            rb.removeCollider();
        } catch (err) {
            console.warn("[Door] removeCollider failed:", err);
        }
        try {
            // simple visual open: hide door mesh
            mesh.visible = false;
        } catch (err) {
            console.warn("[Door] mesh hide failed:", err);
        }
        try {
            if (typeof onOpen === "function") onOpen(go);
        } catch (err) {
            console.warn("[Door] onOpen callback failed:", err);
        }
        console.debug(`[Door] opened by key '${keyId}'`);
    }

    // When collision occurs, check player's inventory and open if they have the key
    script.onCollisionEnter = (other) => {
        if (opened) return;
        // detect player by common userData.type === 'player' or id 'player'
        // simpler check: look at mesh/userData via traversing components (best-effort)
        const playerGO = getObjectByName("player");
        // use safe, typed checks instead of `any` casts
        const otherObj = other as unknown as {
            id?: unknown;
            getComponent?: unknown;
        };
        const isPlayerById = other === playerGO || otherObj.id === "player";
        let isPlayer = Boolean(isPlayerById);
        if (!isPlayer) {
            // also allow collisions from objects tagged as player in their mesh userData
            try {
                const oc = other as unknown as {
                    getComponent?: (c: unknown) => unknown;
                };
                if (typeof oc.getComponent === "function") {
                    const maybe = oc.getComponent(MeshComponent) as unknown;
                    if (maybe && typeof maybe === "object") {
                        const meshCandidate = maybe as MeshComponent;
                        if (
                            meshCandidate.mesh &&
                            meshCandidate.mesh.userData?.type === "player"
                        ) {
                            isPlayer = true;
                        }
                    }
                }
            } catch (checkErr) {
                console.warn(
                    "[Door] failed to check player mesh userData:",
                    checkErr,
                );
            }
        }

        // check inventory
        try {
            const inv = getSingletonComponent(Inventory);
            if (inv && inv.hasItem(keyId)) {
                // optionally consume the key
                inv.removeItem(keyId, 1);
                openDoor();
            } else {
                console.debug(
                    `[Door] player collided but lacks key '${keyId}'`,
                );
            }
        } catch (err) {
            console.warn("[Door] failed to access inventory:", err);
        }
    };

    return go;
}

export default createDoor;
