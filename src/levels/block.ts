import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { createGameObject } from "../objectSystem";
import {
  TransformComponent,
  MeshComponent,
  RigidbodyComponent,
} from "../components";

/**
 * createBlock(scene, position, size, isStatic)
 * - Creates a 1x1x1 cube GameObject (mesh + collider) and adds it to the scene.
 * - Returns the created GameObject.
 */
export function createBlock(
  scene: THREE.Scene,
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  size: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
  isStatic = true,
) {
  const block = createGameObject();

  // Transform
  const t = block.addComponent(TransformComponent);
  t.position = { x: position.x, y: position.y, z: position.z };

  // Visual mesh
  const meshComp = block.addComponent(MeshComponent);
  meshComp.mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  meshComp.mesh.position.copy(position);
  meshComp.mesh.userData = meshComp.mesh.userData || {};
  meshComp.mesh.userData.type = "block";
  meshComp.mesh.userData.gameObject = block;
  scene.add(meshComp.mesh);

  // Physics - static by default (level geometry)
  const rb = block.addComponent(RigidbodyComponent);
  try {
    // try to set body type and initial translation if API is exposed
    if (
      (rb as any).rigidbody &&
      typeof (rb as any).rigidbody.setBodyType === "function"
    ) {
      const bodyType = isStatic
        ? RAPIER.RigidBodyType.Fixed
        : RAPIER.RigidBodyType.Dynamic;
      (rb as any).rigidbody.setBodyType(bodyType, true);
      (rb as any).rigidbody.setTranslation(
        { x: position.x, y: position.y, z: position.z },
        true,
      );
    }
  } catch {
    /* ignore API differences */
  }

  // add a collider that matches the box geometry
  const halfX = size.x / 2;
  const halfY = size.y / 2;
  const halfZ = size.z / 2;

  // ensure the rigidbody (if exposed) is positioned to the block center before adding collider
  try {
    if (
      (rb as any).rigidbody &&
      typeof (rb as any).rigidbody.setTranslation === "function"
    ) {
      (rb as any).rigidbody.setTranslation(
        { x: position.x, y: position.y, z: position.z },
        true,
      );
    }
  } catch {
    /* ignore if API differs */
  }

  // pass explicit `false` for `isSensor` (match other usage in the repo)
  rb.addCollider(RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ), false);

  return block;
}
