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
  getObjectByID,
  getObjectWithComponent,
  getSingletonComponent,
} from "../objectSystem";
import { Inventory } from "../inventory";

/**
 * Create a pickupable key.
 * - keyId: string stored in Inventory when picked up (e.g. "gold_key")
 * - playerId: optional id of player GameObject to register as a trigger (defaults to "player")
 */
export function createKey(
  position: THREE.Vector3,
  keyId: string = "gold_key",
  tileSize?: number,
  playerId: string = "player",
) {
  const go = createGameObject();
  const tf = go.addComponent(TransformComponent);
  tf.position = { x: position.x, y: position.y, z: position.z };
  tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

  const meshComp = go.addComponent(MeshComponent);
  const geom = new THREE.SphereGeometry(2, 12, 12);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(position.x, position.y, position.z);
  mesh.userData = mesh.userData || {};
  mesh.userData.type = "key";
  mesh.userData.keyId = keyId;
  mesh.userData.gameObject = go;
  scene.add(mesh);
  meshComp.mesh = mesh;

  const rb = go.addComponent(RigidbodyComponent);
  // make it a fixed sensor-ish object (small collider)
  rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  rb.rigidbody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
  rb.addCollider(RAPIER.ColliderDesc.ball(3), true);

  const pickup = go.addComponent(PickupComponent);
  // debug helper to confirm collisions are delivered to components
  const dbg = go.addComponent(ScriptComponent);
  dbg.onCollisionEnter = (other) => {
    console.debug("[Key DEBUG] onCollisionEnter: other=", other?.id ?? other);
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
    try { window.removeEventListener("keydown", onKey); } catch {}
    try {
      destroyGameObject(go);
    } catch (err) {
      console.warn("[Key] failed to destroy key object (keypress):", err);
      try { mesh.visible = false; } catch {}
    }
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "9") {
      doPickup();
    }
  };
  window.addEventListener("keydown", onKey);
  dbg.onDispose = () => {
    try { window.removeEventListener("keydown", onKey); } catch {}
  };

  // Try to find the player gameobject to add as a trigger so pickup fires on player collision
  const playerGO = getObjectByID(playerId) ?? getObjectWithComponent(RigidbodyComponent) ?? null;
  if (playerGO) pickup.triggers.add(playerGO);

  // onPickup: add to inventory and destroy the key gameobject
  pickup.onPickup = (other) => {
    try {
      const inv = getSingletonComponent(Inventory);
      inv.addItem(keyId, 1);
      console.debug(`[Key] picked up ${keyId} by ${other?.id ?? "unknown"}`);
    } catch (err) {
      console.warn("[Key] failed to add to inventory:", err);
    }
    try {
      // ensure keypress listener removed
      try { window.removeEventListener("keydown", onKey); } catch {}
      destroyGameObject(go);
    } catch (err) {
      console.warn("[Key] failed to destroy key object:", err);
      // fallback: hide visual
      try {
        mesh.visible = false;
      } catch {}
    }
  };

  return go;
}

export default createKey;