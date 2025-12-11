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
import { createDoor } from "../objects/doorScript";
//import { createBlock } from "./block";
import { RespawnSystem } from "../respawnSystem";

export class Level3 extends BaseLevel {
    private readonly baseOffset = { x: 1000, y: 0, z: -15 } as const;
    private readonly tileSize = 20;

    private keyPosition = new THREE.Vector3();
    private doorPosition = new THREE.Vector3();

    constructor() {
        super();
        this.id = Level3.name;
        this.createObjects();
    }

    protected createObjects(): void {
        //#region Create T-shaped ground using modular tiles -----------------
        // grid to create (gx, gy) relative to a base offset in world space
        // T shape: center (0,0) with stem at (0,1) and arms at (1,1) and (-1,1)
        const tileSize = this.tileSize; // world units per tile (adjustable)
        const tileHeight = 5; // thickness of each tile
        const baseOffset = this.baseOffset; // match previous ground placement

        const coords: Array<[number, number]> = [
            //First corridor
            [0, 0],
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 3],
            [2, 3],

            //1st Path
            [2, 2],
            [2, 1],
            [3, 1],
            [4, 1], //key at [4, 1]

            //2nd Path
            [2, 4], //Door at [2, 4]
            [2, 5],
            [2, 6],
            [2, 7],
            [2, 8],
            [3, 8],
            [4, 8],
            [5, 8],
            [5, 9],
            [5, 10],
            [5, 11],
            [5, 12],
            [4, 12],
            [3, 12],
            [2, 12],
            [2, 11],
            [2, 10],
            [3, 10], //key at [3, 10]

            //3rd path
            [1, 6], //Door at [1, 6]]
            [0, 6],
            [0, 7],
            [0, 8],
            [0, 9],
            [-1, 9],
            [-2, 9],
            [-2, 10],
            [-3, 10],
            [-4, 10],
            [-4, 9],
            [-5, 9], //Key at [-5, 9]

            //Final path
            [0, 10], //Door at [0, 10]
            [0, 11],
            [0, 12],
            [0, 13],
            [0, 14],
            [-1, 14],
            [-2, 14],
            [-2, 15],
            [-2, 16],
            [-2, 17], //Goal at [-2, 17]
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
        const goalPosition = gridToWorld(-2, 17, 1); // example using helper
        const goalSize = new THREE.Vector3(4, 4, 4);
        const goal = createGoal(scene, goalPosition, goalSize);
        this.gameObjects.set(goal.name, goal);
        //#endregion

        //#region  Create simple level --------------------------------------

        // Create a Key centered on the tile at grid coords [4,1]
        const keyPos_4_1 = gridToWorld(4, 1, 1);
        this.registerRespawnable("gold_key_4_1", () => {
            const key = createKey(keyPos_4_1.clone(), "gold_key"); // inventory id remains "gold_key"
            this.gameObjects.set("gold_key_4_1", key); // unique map key
            return key;
        });

        // Create a Door at grid coords [2, 4]
        const doorPos_2_4 = gridToWorld(2, 4, 1);
        this.registerRespawnable("door_2_4", () => {
            const d = createDoor(
                doorPos_2_4.clone(),
                new THREE.Vector3(this.tileSize - 0.5, 5, 1),
                "gold_key",
                0,
            );
            this.gameObjects.set("door_2_4", d);
            return d;
        });

        // Create a Key centered on the tile at grid coords [3,10]
        const keyPos_3_10 = gridToWorld(3, 10, 1);
        this.registerRespawnable("gold_key_3_10", () => {
            const key = createKey(keyPos_3_10.clone(), "gold_key");
            this.gameObjects.set("gold_key_3_10", key);
            return key;
        });

        // Create a Door at grid coords [1, 6]
        const doorPos_1_6 = gridToWorld(1, 6, 1);
        this.registerRespawnable("door_1_6", () => {
            const d = createDoor(
                doorPos_1_6.clone(),
                new THREE.Vector3(this.tileSize - 0.5, 5, 1),
                "gold_key",
                90,
            );
            this.gameObjects.set("door_1_6", d);
            return d;
        });

        // Create a Key centered on the tile at grid coords [3,10]
        const keyPos_neg5_9 = gridToWorld(-5, 9, 1);
        this.registerRespawnable("gold_key_-5_9", () => {
            const key = createKey(keyPos_neg5_9.clone(), "gold_key");
            this.gameObjects.set("gold_key_-5_9", key);
            return key;
        });

        // Create a Door at grid coords [0, 10]
        const doorPos_0_10 = gridToWorld(0, 10, 1);
        this.registerRespawnable("door_0_10", () => {
            const d = createDoor(
                doorPos_0_10.clone(),
                new THREE.Vector3(this.tileSize - 0.5, 5, 1),
                "gold_key",
                0,
            );
            this.gameObjects.set("door_0_10", d);
            return d;
        });

        //#endregion --------------------------------------------------------

        // Simple light
        // const light = new THREE.DirectionalLight(0xffffff, 1);
        // light.position.set(-25, 0, 75);
        // scene.add(light);
    }

    protected onActivate(): void {
        const startPosition = new THREE.Vector3(1000, 0, -15);
        const ball = createBall(scene, startPosition);
        getSingletonComponent(RespawnSystem).respawnPoint.position =
            startPosition;
        this.gameObjects.set(ball.name, ball);
        // Hook all spawned key objects (they may be stored under unique keys like "gold_key_4_1")
        for (const [, go] of this.gameObjects) {
            if (go.name === "gold_key") {
                const pickup = go.getComponent(PickupComponent);
                if (pickup) pickup.addTriggerObject(ball);
            }
        }
    }

    protected onDeactivate(): void {
        destroyGameObject(getObjectByName("ball")!);
    }

    private createKeyObject() {
        const key = createKey(this.keyPosition.clone(), "gold_key");
        const ball = getObjectByName("ball");
        if (ball) {
            key.getComponent(PickupComponent)?.addTriggerObject(ball);
        }
        return key;
    }

    private createDoorObject(rotation: number) {
        return createDoor(
            this.doorPosition.clone(),
            new THREE.Vector3(this.tileSize - 0.5, 5, 1),
            "gold_key",
            rotation,
        );
    }
}
