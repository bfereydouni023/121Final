import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
} from "../components";
import { scene } from "../globals";
import { createGameObject } from "../objectSystem";

/**
 * Options for a single ground tile.
 * - tileSize: world-space size of one grid cell (tile). width/depth of the square.
 * - height: thickness of the ground tile (Y dimension).
 * - color: material color for the tile.
 * - fixed: whether the rigidbody is Fixed (true) or Dynamic (false). Defaults to Fixed.
 */
export type GroundOptions = {
    tileSize?: number;
    height?: number;
    color?: number;
    fixed?: boolean;
    // optional id/name appended to GameObject userData
    name?: string;
};

/**
 * Create a square ground tile at grid coordinates (gx, gy).
 * Grid coordinates are multiplied by tileSize to produce world X,Z.
 *
 * Example: createGround(0,0); createGround(0,1); createGround(1,1); createGround(-1,1);
 * will create a T-shape centered at grid (0,0).
 *
 * Returns the created GameObject.
 */
export function createGround(gx: number, gy: number, opts: GroundOptions = {}) {
    const tileSize = opts.tileSize ?? 50;
    const height = opts.height ?? 1;
    const color = opts.color ?? 0x808080;
    const fixed = opts.fixed ?? true;

    // Position: X = gx * tileSize, Z = gy * tileSize. Y set so top surface is at y = 0.
    const worldX = gx * tileSize;
    const worldZ = -gy * tileSize;
    const worldY = -height / 2;

    const go = createGameObject();
    const tf = go.addComponent(TransformComponent);
    tf.position = { x: worldX, y: worldY, z: worldZ };
    tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

    const meshComp = go.addComponent(MeshComponent);
    const geom = new THREE.BoxGeometry(tileSize, height, tileSize);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(worldX, worldY, worldZ);
    mesh.userData = mesh.userData || {};
    mesh.userData.type = "groundTile";
    if (opts.name) mesh.userData.name = opts.name;
    mesh.userData.gameObject = go;
    scene.add(mesh);
    meshComp.mesh = mesh;

    const rb = go.addComponent(RigidbodyComponent);
    rb.rigidbody.setBodyType(
        fixed ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic,
        true,
    );
    // place rigidbody to match the TransformComponent position
    try {
        rb.rigidbody.setTranslation({ x: worldX, y: worldY, z: worldZ }, true);
    } catch {
        // some runtimes may use setTranslation or setTranslationRaw; ignore if not available
    }
    // collider half-extents = half of tileSize / height
    rb.addCollider(
        RAPIER.ColliderDesc.cuboid(tileSize / 2, height / 2, tileSize / 2),
        false,
    );

    return go;
}

/**
 * Convenience: create multiple ground tiles from an array of grid coords.
 * coords: Array of [gx, gy].
 * returns created GameObjects.
 */
export function createGroundBatch(
    coords: Array<[number, number]>,
    opts: GroundOptions = {},
) {
    return coords.map(([gx, gy]) => createGround(gx, gy, opts));
}

export default createGround;
