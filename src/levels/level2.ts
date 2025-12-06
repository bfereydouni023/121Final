import * as THREE from "three";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
} from "../components";
import { createBall } from "../objects/ballScript";
import { createGoal } from "../objects/goalScript";
import { scene } from "../globals";
import { BaseLevel } from "./baselevel";
import { destroyGameObject, getObjectByName } from "../objectSystem";
import { createGround } from "../objects/groundScript";
import { createKey } from "../objects/keyScript";
import { createDoor } from "../objects/doorScript";

export class Level2 extends BaseLevel {
    constructor() {
        super();
        this.id = Level2.name;
        this.createObjects();
    }

    protected createObjects(): void {
        //#region Create T-shaped ground using modular tiles -----------------
        // grid to create (gx, gy) relative to a base offset in world space
        // T shape: center (0,0) with stem at (0,1) and arms at (1,1) and (-1,1)
        const tileSize = 50; // world units per tile (adjustable)
        const tileHeight = 5; // thickness of each tile
        const baseOffset = { x: 500, y: 0, z: -15 }; // match previous ground placement

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
            const tf = go.getComponent(TransformComponent);
            const meshComp = go.getComponent(MeshComponent);
            const rbComp = go.getComponent(RigidbodyComponent);
            if (tf) {
                tf.position.x += baseOffset.x;
                tf.position.y += baseOffset.y; // keep same vertical offset used in level
                tf.position.z += baseOffset.z;
            }
            // sync visual and physics to the updated transform
            try {
                if (meshComp?.mesh) {
                    meshComp.mesh.position.set(
                        tf!.position.x,
                        tf!.position.y,
                        tf!.position.z,
                    );
                    meshComp.mesh.userData = meshComp.mesh.userData || {};
                    meshComp.mesh.userData.type = "ground";
                    meshComp.mesh.userData.gameObject = go;
                }
            } catch (err) {
                console.warn("level2 optional block error:", err);
            }
            try {
                if (rbComp?.rigidbody && tf) {
                    rbComp.rigidbody.setTranslation(
                        {
                            x: tf.position.x,
                            y: tf.position.y,
                            z: tf.position.z,
                        },
                        true,
                    );
                }
            } catch (err) {
                console.warn("level2 optional block error:", err);
            }

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
        const keyPosition = new THREE.Vector3(
            baseOffset.x + 0,
            baseOffset.y + 1,
            baseOffset.z - tileSize * 1 + 6,
        );
        const key = createKey(keyPosition, "gold_key", tileSize);
        this.gameObjects.set(key.name, key);

        //Create a Door
        const doorPosition = new THREE.Vector3(
            baseOffset.x - 10,
            baseOffset.y + 1,
            baseOffset.z - tileSize * 1 + 6,
        );
        const door = createDoor(
            doorPosition,
            new THREE.Vector3(4, 5, 1),
            "gold_key",
        );
        this.gameObjects.set(door.name, door);

        //#endregion --------------------------------------------------------

        // Simple light
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(-25, 0, 75);
        scene.add(light);
    }

    protected onActivate(): void {
        //#region  Create the ball ------------------------------------------
        //Ball position manually set due to protection
        const ball = createBall(scene, 500, 0, -15);
        this.gameObjects.set(ball.name, ball);
        //#endregion --------------------------------------------------------
    }

    protected onDeactivate(): void {
        destroyGameObject(getObjectByName("ball")!);
    }
}
