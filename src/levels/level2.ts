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
import { createGround } from "../objects/groundScript";
import { createKey } from "../objects/keyScript";
import { createDoor } from "../objects/doorScript";
import { RespawnSystem } from "../respawnSystem";

export class Level2 extends BaseLevel {
    private readonly baseOffset = { x: 500, y: 0, z: -15 } as const;
    private readonly tileSize = 50;

    private keyPosition = new THREE.Vector3();
    private doorPosition = new THREE.Vector3();

    constructor() {
        super();
        this.id = Level2.name;
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
            [0, 0],
            [0, 1],
            [1, 1],
            [-1, 1],
        ];

        for (const [gx, gy] of coords) {
            const go = createGround(gx, gy, {
                tileSize,
                height: tileHeight,
                color: 0x808080,
            });
            // apply base offset so grid is positioned where the previous large ground was
            const tf = go.getComponent(TransformComponent)!;
            tf.position.x += baseOffset.x;
            tf.position.y += baseOffset.y; // keep same vertical offset used in level
            tf.position.z += baseOffset.z;

            this.gameObjects.set(go.name, go);
        }

        //#endregion --------------------------------------------------------

        //#region  Create the goal -------------------------------------------
        const goalPosition = new THREE.Vector3(
            baseOffset.x + 0,
            baseOffset.y + 3,
            // place goal near the far end of the tiled ground (approx)
            baseOffset.z - tileSize * 2 + 6,
        ); // near far end of ground
        const goalSize = new THREE.Vector3(4, 4, 4);
        const goal = createGoal(scene, goalPosition, goalSize);
        this.gameObjects.set(goal.name, goal);
        //#endregion

        //#region  Create simple level --------------------------------------

        //Create a Key
        this.keyPosition = new THREE.Vector3(
            baseOffset.x + 0,
            baseOffset.y + 1,
            baseOffset.z - tileSize * 1 + 6,
        );
        this.registerRespawnable("gold_key", () => this.createKeyObject());

        //Create a Door
        this.doorPosition = new THREE.Vector3(
            baseOffset.x - 10,
            baseOffset.y + 1,
            baseOffset.z - tileSize * 1 + 6,
        );
        this.registerRespawnable("door", () => this.createDoorObject());

        //#endregion --------------------------------------------------------

        // Simple light
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(-25, 0, 75);
        scene.add(light);
    }

    protected onActivate(): void {
        const startPosition = new THREE.Vector3(500, 0, -15);
        const ball = createBall(scene, startPosition);
        getSingletonComponent(RespawnSystem).respawnPoint.position =
            startPosition;
        this.gameObjects.set(ball.name, ball);
        this.gameObjects
            .get("gold_key")!
            .getComponent(PickupComponent)!
            .addTriggerObject(ball);
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

    private createDoorObject() {
        return createDoor(
            this.doorPosition.clone(),
            new THREE.Vector3(4, 5, 1),
            "gold_key",
        );
    }
}
