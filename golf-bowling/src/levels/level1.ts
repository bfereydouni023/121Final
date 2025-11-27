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

  // Ground (visual + static physics)
  const ground = createGameObject();
  const gT = ground.addComponent(TransformComponent);
  gT.position = { x: 0, y: -35, z: -10 };
  gT.rotation = { x: 0, y: 0, z: 0 };
  const gMesh = ground.addComponent(MeshComponent);
  gMesh.mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x808080 })
  );
  scene.add(gMesh.mesh);

  const gRb = ground.addComponent(RigidbodyComponent);
  gRb.rigidbodyType = 'static';
  // add a box collider roughly matching the plane
  gRb.addCollider(RAPIER.ColliderDesc.cuboid(25, 0.1, 25));

  created.push({ id: ground.id });

  // Ball (visual + dynamic physics)
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
  bRb.mass = 1;
  bRb.rigidbodyType = 'dynamic';
  bRb.addCollider(RAPIER.ColliderDesc.ball(radius));

  // log the ball position every frame via a ScriptComponent
  const bScript = ball.addComponent(ScriptComponent);
  bScript.onStart = () => {
    console.log('[Ball] started at transform', bT.position);
  };
  bScript.onUpdate = (_dt: number) => {
    // prefer mesh position if available (rendered position), fallback to transform
    const transform = ball.getComponent(TransformComponent);
    if (transform) {
      console.log('[Ball] transform.position', transform.position);
    }
  };

  created.push({ id: ball.id });

  // Simple light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(-25, 0, 75);
  scene.add(light);

  return created;
}