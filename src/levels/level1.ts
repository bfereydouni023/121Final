import * as THREE from "three";
import { TransformComponent, PickupComponent } from "../components";
import { createBall } from "../objects/ballScript";
import { createGoal } from "../objects/goalScript";
import { scene } from "../globals";
import { BaseLevel } from "./baselevel";
import {
    destroyGameObject,
    getObjectByName,
    getSingletonComponent,
} from "../objectSystem";
import { createGroundBatch } from "../objects/groundScript";
import { createKey } from "../objects/keyScript";
import { RespawnSystem } from "../respawnSystem";

export class Level1 extends BaseLevel {
    constructor() {
        super();
        this.id = Level1.name;
        this.createObjects();
    }

    protected createObjects(): void {
        //#region Create T-shaped ground using modular tiles -----------------
        // grid to create (gx, gy) relative to a base offset in world space
        // T shape: center (0,0) with stem at (0,1) and arms at (1,1) and (-1,1)
        const tileSize = 15; // world units per tile (adjustable)
        const tileHeight = 5; // thickness of each tile
        const baseOffset = { x: 0, y: 0, z: -15 }; // match previous ground placement

        const coords: Array<[number, number]> = [
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 3],
            [2, 3],
            [2, 4],
            [2, 5],
            [1, 5],
            [0, 5],
            [0, 6],
            [0, 7],
            [0, 8],
        ];

        // create tiles + perimeter walls in local (grid) coordinates
        const created = createGroundBatch(coords, {
            tileSize,
            height: tileHeight,
            color: 0x808080,
            buildWalls: true,
            wallHeight: 5,
            wallThickness: 1,
            wallColor: 0x303030,
        });

        // apply baseOffset to the created tile GameObjects so they sit at the desired world location
        for (const go of created) {
            const tf = go.getComponent(TransformComponent)!;
            tf.position.x += baseOffset.x;
            tf.position.y += baseOffset.y;
            tf.position.z += baseOffset.z;
            this.gameObjects.set(go.name, go);
        }

        // move any perimeter wall meshes created by createGroundBatch by the same baseOffset
        // (walls are added to the scene with mesh.userData.type === "perimeterWall")
        for (const child of scene.children) {
            if (child && child.userData?.type === "perimeterWall") {
                child.position.x += baseOffset.x;
                child.position.y += baseOffset.y;
                child.position.z += baseOffset.z;
            }
        }

        //#endregion --------------------------------------------------------

        // helper: grid (gx,gy) -> world position (centers tile). Y is top surface (baseOffset.y).
        const gridToWorld = (gx: number, gy: number, yOffset = 1) =>
            new THREE.Vector3(
                baseOffset.x + gx * tileSize,
                baseOffset.y + yOffset,
                baseOffset.z - gy * tileSize,
            );

        //#region  Create the goal -------------------------------------------
        const goalPosition = gridToWorld(0, 8, 1); // example using helper
        const goalSize = new THREE.Vector3(4, 4, 4);
        const goal = createGoal(scene, goalPosition, goalSize);
        this.gameObjects.set(goal.name, goal);
        //#endregion

        //#region  Create simple level --------------------------------------

        // Create a Key centered on the tile at grid coords [2,3]
        const keyPosition = gridToWorld(0, -25, 1); // center of tile [2,3], 1 unit above ground
        const key = createKey(keyPosition, "gold_key");

        this.gameObjects.set(key.name, key);

        //#endregion --------------------------------------------------------

        // Simple light
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(-25, 0, 75);
        scene.add(light);
    }

    protected onActivate(): void {
        const startPosition = new THREE.Vector3(0, 0, -15);
        const ball = createBall(scene, startPosition);
        getSingletonComponent(RespawnSystem).respawnPoint.position =
            startPosition;
        this.gameObjects.set(ball.name, ball);

        //Goalscript doesn't work if this code is deleted
        this.gameObjects
            .get("gold_key")!
            .getComponent(PickupComponent)!
            .addTriggerObject(ball);
    }

    protected onDeactivate(): void {
        destroyGameObject(getObjectByName("ball")!);
    }
}
