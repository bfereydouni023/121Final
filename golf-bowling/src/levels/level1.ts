import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { createGameObject } from '../objectSystem';
import { TransformComponent, MeshComponent, RigidbodyComponent, ScriptComponent } from '../components';

/**
 * Build a simple level: ground, light, and a ball.
 * Adds meshes to the provided scene and returns created game objects.
 */
export function createLevel(scene: THREE.Scene) {
  // Track created objects for reference
  const created: Array<{ id: string }> = [];

  // Create the ground
  const ground = createGameObject();
  const gT = ground.addComponent(TransformComponent);
  gT.position = { x: 0, y: -5, z: 0 };
  gT.rotation = { x: 0, y: 0, z: 0 , w: 1 };
  const gMesh = ground.addComponent(MeshComponent);

  // rectangular prism dimensions
  const width = 50;
  const height = 2;   // thickness / height of the prism
  const depth = 30;

  gMesh.mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
  );
  // position the box so its top surface is at y = 0 (adjust if you want center at y=0)
  gMesh.mesh.position.set(gT.position.x, gT.position.y - height / 2, gT.position.z);
  scene.add(gMesh.mesh);

  const gRb = ground.addComponent(RigidbodyComponent);
  // make ground fixed/static so it doesn't fall from gravity
  gRb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  // place rigidbody to match the TransformComponent position
  gRb.rigidbody.setTranslation({ x: gT.position.x, y: gT.position.y, z: gT.position.z }, true);
  // collider half-extents must match half the box dimensions
  gRb.addCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2));

  created.push({ id: ground.id });

  // Create the ball
  const ball = createGameObject();
  const bT = ball.addComponent(TransformComponent);
  bT.position = { x: 0, y: 0, z: 0 };

  const bMesh = ball.addComponent(MeshComponent);
  const radius = 1.5;
  bMesh.mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0xff5500, metalness: 0.2, roughness: 0.6 })
  );
  scene.add(bMesh.mesh);

  // force visual to match transform immediately
  bMesh.mesh.position.set(bT.position.x, bT.position.y, bT.position.z);

  const bRb = ball.addComponent(RigidbodyComponent);
  // ensure the ball is dynamic so it falls/collides
  bRb.rigidbody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  bRb.mass = 1;
  // place rigidbody to match the TransformComponent position before adding the collider
  bRb.rigidbody.setTranslation({ x: bT.position.x, y: bT.position.y, z: bT.position.z }, true);
  bRb.addCollider(RAPIER.ColliderDesc.ball(radius));

  created.push({ id: ball.id });

  // Simple light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(-25, 0, 75);
  scene.add(light);

  return created;
}