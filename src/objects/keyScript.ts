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
    rb.addCollider(RAPIER.ColliderDesc.ball(2), false);
    rb.collider.setSensor(true);

    const pickup = go.addComponent(PickupComponent);
    // debug helper to confirm collisions are delivered to components
    const dbg = go.addComponent(ScriptComponent);
    dbg.onCollisionEnter = (other) => {
        console.debug(
            "[Key DEBUG] onCollisionEnter: other=",
            other?.name ?? other,
        );
    };

    // onPickup: add to inventory and destroy the key gameobject
    pickup.onPickup = (_other) => {
        const inv = getSingletonComponent(Inventory);
        inv.addItem(keyId, 1);
        destroyGameObject(go);
        mesh.visible = false;
    };

    return go;
}

export default createKey;
