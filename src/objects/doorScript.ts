import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
} from "../components";
import { scene } from "../globals";
import { createGameObject } from "../objectSystem";
import { getSingletonComponent } from "../objectSystem";
import { Inventory } from "../inventory";

/**
 * Create a door that opens when the player has a required key in inventory.
 * - position: world position
 * - size: dimensions
 * - keyId: id required to open (e.g. "gold_key")
 * - rotationDeg: optional rotation in degrees. Can be a single number (Y axis) or an object { x, y, z } in degrees.
 * - onOpen: optional callback when door opens
 */
export function createDoor(
    position: THREE.Vector3,
    size: THREE.Vector3 = new THREE.Vector3(1, 2.5, 0.2),
    keyId: string = "gold_key",
    rotationDeg: number | { x?: number; y?: number; z?: number } = 0,
    onOpen?: (doorGO: ReturnType<typeof createDoor>) => void,
) {
    const go = createGameObject("door");
    const tf = go.addComponent(TransformComponent);

    // normalize rotationDeg into x,y,z in degrees
    let rx = 0,
        ry = 0,
        rz = 0;
    if (typeof rotationDeg === "number") {
        ry = rotationDeg;
    } else if (rotationDeg && typeof rotationDeg === "object") {
        rx = rotationDeg.x ?? 0;
        ry = rotationDeg.y ?? 0;
        rz = rotationDeg.z ?? 0;
    }

    // convert degrees to quaternion
    const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz),
        "XYZ",
    );
    const quat = new THREE.Quaternion().setFromEuler(euler);

    tf.position = { x: position.x, y: position.y, z: position.z };
    tf.rotation = { x: quat.x, y: quat.y, z: quat.z, w: quat.w };

    const meshComp = go.addComponent(MeshComponent);
    const geom = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color: 0x663300 });
    const mesh = new THREE.Mesh(geom, mat);
    // set visual transform immediately so mesh matches the GameObject transform
    mesh.position.set(position.x, position.y, position.z);
    mesh.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    scene.add(mesh);
    meshComp.mesh = mesh;

    const rb = go.addComponent(RigidbodyComponent);
    // Make door a fixed collider so it blocks the player until opened
    rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    // non-sensor collider so the door physically blocks the player while closed
    rb.addCollider(
        RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
        false,
    );

    // Define a minimal typing for optional Rapier extensions we may encounter.
    type QuaternionLike = { x: number; y: number; z: number; w: number };
    interface RigidbodyExtras {
        setRotation?: (q: QuaternionLike, wake?: boolean) => void;
        setRotationFromQuaternion?: (
            q: THREE.Quaternion,
            wake?: boolean,
        ) => void;
        setTranslation?: (
            t: { x: number; y: number; z: number },
            wake?: boolean,
        ) => void;
    }

    const rbExtras = rb.rigidbody as unknown as RigidbodyExtras;

    // try to apply rotation to the physics body (best-effort)
    try {
        if (typeof rbExtras.setRotation === "function") {
            rbExtras.setRotation(
                { x: quat.x, y: quat.y, z: quat.z, w: quat.w },
                true,
            );
        } else if (typeof rbExtras.setRotationFromQuaternion === "function") {
            rbExtras.setRotationFromQuaternion(quat, true);
        } else if (typeof rbExtras.setTranslation === "function") {
            // fallback no-op for rotation: ensure translation is correct
            rbExtras.setTranslation(
                { x: position.x, y: position.y, z: position.z },
                true,
            );
        }
    } catch (err) {
        // ignore physics rotation errors
        console.debug("[Door] physics rotation apply failed:", err);
    }

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
        if (other.name !== "ball") return;
        const inv = getSingletonComponent(Inventory);
        if (inv.hasItem(keyId)) {
            // optionally consume the key
            console.log(`[Door] player has key '${keyId}', opening door`);
            inv.removeItem(keyId, 1);
            openDoor();
        } else {
            console.debug(`[Door] player collided but lacks key '${keyId}'`);
        }
    };
    script.onCollisionExit = (other) => {
        // no action on exit for now
        console.debug("[Door] onCollisionExit with ", other?.name ?? other);
    };

    return go;
}
