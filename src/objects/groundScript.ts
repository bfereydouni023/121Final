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

    // new wall options
    buildWalls?: boolean;
    wallHeight?: number;
    wallThickness?: number;
    wallColor?: number;
    wallFixed?: boolean;
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
    // do not rely on mesh.userData; MeshComponent holds the mesh and the GameObject owns both components
    if (opts.name) go.name = opts.name;
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
 *
 * If opts.buildWalls is true, automatically builds walls around the outer perimeter
 * of the axis-aligned bounding rectangle that contains all tiles.
 */
export function createGroundBatch(
    coords: Array<[number, number]>,
    opts: GroundOptions = {},
) {
    const createdTiles = coords.map(([gx, gy]) => createGround(gx, gy, opts));
    let wallGOs: Array<any> = [];

    if (opts.buildWalls && coords.length > 0) {
        console.log("Building perimeter walls for ground batch");
        wallGOs = buildPerimeterWalls(coords, opts);
    }

    // return all created GameObjects (tiles + walls) so callers can update transforms/rigidbodies
    return createdTiles.concat(wallGOs);
}

/**
 * Internal helper: build four walls around the bounding rect of the provided tile coords.
 */
function buildPerimeterWalls(coords: Array<[number, number]>, opts: GroundOptions) {
    const tileSize = opts.tileSize ?? 50;
    const wallHeight = opts.wallHeight ?? 5;
    const wallThickness = opts.wallThickness ?? Math.max(0.5, tileSize * 0.1);
    const wallColor = opts.wallColor ?? 0x333333;
    const wallFixed = opts.wallFixed ?? true;

    const halfWallY = wallHeight / 2;

    // fast lookup for whether a tile exists at grid coord
    const tileSet = new Set<string>(coords.map(([gx, gy]) => `${gx},${gy}`));
    const createdWalls: Array<any> = [];

    // helper to create a wall segment (box)
    function createWallSegment(centerX: number, centerY: number, centerZ: number, sizeX: number, sizeY: number, sizeZ: number, rotationY?: number) {
        const go = createGameObject();
        const tf = go.addComponent(TransformComponent);
        tf.position = { x: centerX, y: centerY, z: centerZ };
        tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

        const meshComp = go.addComponent(MeshComponent);
        const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        const mat = new THREE.MeshStandardMaterial({ color: wallColor });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(centerX, centerY, centerZ);
        if (typeof rotationY === "number") {
            const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
            mesh.quaternion.copy(quat);
        }
        scene.add(mesh);
        meshComp.mesh = mesh;

        const rb = go.addComponent(RigidbodyComponent);
        rb.rigidbody.setBodyType(
            wallFixed ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic,
            true,
        );
        try {
            // set physics body translation then rotation (best-effort)
            rb.rigidbody.setTranslation({ x: centerX, y: centerY, z: centerZ }, true);
            if (typeof rotationY === "number") {
                const quatObj = { x: 0, y: Math.sin(rotationY / 2), z: 0, w: Math.cos(rotationY / 2) };
                if (typeof (rb.rigidbody as any).setRotation === "function") {
                    try { (rb.rigidbody as any).setRotation(quatObj, true); } catch {}
                }
            }
        } catch {}

        rb.addCollider(RAPIER.ColliderDesc.cuboid(sizeX / 2, sizeY / 2, sizeZ / 2), false);
        return go;
    }

    // helper to create a visible debug block at corner (small colored box)
    function createCornerDebugBlock(centerX: number, centerY: number, centerZ: number) {
        const go = createGameObject();
        const tf = go.addComponent(TransformComponent);
        tf.position = { x: centerX, y: centerY, z: centerZ };
        tf.rotation = { x: 0, y: 0, z: 0, w: 1 };

        const meshComp = go.addComponent(MeshComponent);
        const size = Math.max(0.2, tileSize * 0.25);
        const geom = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.2, roughness: 0.6 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(centerX, centerY + size / 2, centerZ); // sit on top of ground
        scene.add(mesh);
        meshComp.mesh = mesh;

        // small fixed rigidbody so it participates if needed (optional)
        const rb = go.addComponent(RigidbodyComponent);
        rb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        try {
            rb.rigidbody.setTranslation({ x: centerX, y: centerY + size / 2, z: centerZ }, true);
        } catch {}
        rb.addCollider(RAPIER.ColliderDesc.cuboid(size / 2, size / 2, size / 2), true);
        return go;
    }

    // For each tile, create wall segments along any exposed edges (no neighbor present).
    for (const [gx, gy] of coords) {
        const worldX = gx * tileSize;
        const worldZ = -gy * tileSize;
        const topEdgeZ = worldZ - tileSize / 2;
        const bottomEdgeZ = worldZ + tileSize / 2;
        const leftEdgeX = worldX - tileSize / 2;
        const rightEdgeX = worldX + tileSize / 2;

        // Neighbor positions in grid coords
        const northKey = `${gx},${gy + 1}`;
        const southKey = `${gx},${gy - 1}`;
        const eastKey = `${gx + 1},${gy}`;
        const westKey = `${gx - 1},${gy}`;

        // North edge (gy+1). world Z decreases for +gy, so north is topEdgeZ - thickness/2
        if (!tileSet.has(northKey)) {
            const centerX = worldX;
            const centerZ = topEdgeZ - wallThickness / 2;
            createdWalls.push(
                createWallSegment(centerX, halfWallY, centerZ, tileSize, wallHeight, wallThickness),
            );
        }

        // South edge (gy-1)
        if (!tileSet.has(southKey)) {
            const centerX = worldX;
            const centerZ = bottomEdgeZ + wallThickness / 2;
            createdWalls.push(
                createWallSegment(centerX, halfWallY, centerZ, tileSize, wallHeight, wallThickness),
            );
        }

        // East edge (gx+1)
        if (!tileSet.has(eastKey)) {
            const centerX = rightEdgeX + wallThickness / 2;
            const centerZ = worldZ;
            createdWalls.push(
                createWallSegment(centerX, halfWallY, centerZ, wallThickness, wallHeight, tileSize),
            );
        }

        // West edge (gx-1)
        if (!tileSet.has(westKey)) {
            const centerX = leftEdgeX - wallThickness / 2;
            const centerZ = worldZ;
            createdWalls.push(
                createWallSegment(centerX, halfWallY, centerZ, wallThickness, wallHeight, tileSize),
            );
        }
    }

    // detect 90° external corners and place a single visible debug block at each corner
    const corners = detectRightAngleCorners(coords, tileSize);
    for (const c of corners) {
        // place the debug block so it sits on the ground level (half the wall height)
        const debugY = halfWallY;
        
    }

    return createdWalls;
}

/**
 * Detect external 90° corners (right-angle turns) in a set of grid tiles.
 * Returns an array of corner descriptors with grid tile origin, corner label and
 * world-space position + recommended rotation (radians) for a 45° bank.
 */
export type CornerInfo = {
    gx: number;
    gy: number;
    corner: "NE" | "SE" | "SW" | "NW";
    worldX: number;
    worldZ: number;
    rotationY: number; // radians, rotation to align a diagonal bank
    key: string; // unique key for deduplication
};

export function detectRightAngleCorners(
    coords: Array<[number, number]>,
    tileSize: number = 50,
): CornerInfo[] {
    const tileSet = new Set<string>(coords.map(([gx, gy]) => `${gx},${gy}`));
    const corners: CornerInfo[] = [];
    const seen = new Set<string>();

    for (const [gx, gy] of coords) {
        const worldX = gx * tileSize;
        const worldZ = -gy * tileSize;

        const northMissing = !tileSet.has(`${gx},${gy + 1}`);
        const southMissing = !tileSet.has(`${gx},${gy - 1}`);
        const eastMissing = !tileSet.has(`${gx + 1},${gy}`);
        const westMissing = !tileSet.has(`${gx - 1},${gy}`);

        // NE corner: north && east missing
        if (northMissing && eastMissing) {
            const cx = worldX + tileSize / 2;
            const cz = worldZ - tileSize / 2;
            const key = `${cx.toFixed(3)},${cz.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                corners.push({
                    gx,
                    gy,
                    corner: "NE",
                    worldX: cx,
                    worldZ: cz,
                    rotationY: -Math.PI / 4, // -45°
                    key,
                });
            }
        }

        // SE corner: south && east missing
        if (southMissing && eastMissing) {
            const cx = worldX + tileSize / 2;
            const cz = worldZ + tileSize / 2;
            const key = `${cx.toFixed(3)},${cz.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                corners.push({
                    gx,
                    gy,
                    corner: "SE",
                    worldX: cx,
                    worldZ: cz,
                    rotationY: Math.PI / 4, // +45°
                    key,
                });
            }
        }

        // SW corner: south && west missing
        if (southMissing && westMissing) {
            const cx = worldX - tileSize / 2;
            const cz = worldZ + tileSize / 2;
            const key = `${cx.toFixed(3)},${cz.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                corners.push({
                    gx,
                    gy,
                    corner: "SW",
                    worldX: cx,
                    worldZ: cz,
                    rotationY: -Math.PI / 4, // -45°
                    key,
                });
            }
        }

        // NW corner: north && west missing
        if (northMissing && westMissing) {
            const cx = worldX - tileSize / 2;
            const cz = worldZ - tileSize / 2;
            const key = `${cx.toFixed(3)},${cz.toFixed(3)}`;
            if (!seen.has(key)) {
                seen.add(key);
                corners.push({
                    gx,
                    gy,
                    corner: "NW",
                    worldX: cx,
                    worldZ: cz,
                    rotationY: Math.PI / 4, // +45°
                    key,
                });
            }
        }
    }

    return corners;
}

export default createGround;
