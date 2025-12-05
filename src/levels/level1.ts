import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { createGameObject, destroyGameObject } from "../objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
} from "../components";
import { createBall } from "../objects/ballScript";
import { createGoal } from "../objects/goalScript";
import { createBlock } from "./block";
import type { GameObject, Level } from "../types";
import { scene } from "../globals";
import { IsResettable, ResetGameObjects } from "../utilities";

export class Level1 implements Level {
    id: string;
    private isActive: boolean;
    private gameObjects: Map<string, GameObject> = new Map();
    constructor() {
        this.id = typeof Level1;
        this.isActive = false;
        this.createObjects();
    }

    get active(): boolean {
        return this.isActive;
    }

    set active(value: boolean) {
        this.isActive = value;
    }

    destroy(): void {
        destroyGameObject(...this.gameObjects.values());
        this.gameObjects.clear();
    }

    reset(): void {
        ResetGameObjects(
            ...Array.from(this.gameObjects.values()).filter((go) =>
                IsResettable(go),
            ),
        );
    }

    private createObjects(): void {
        //#region  Create the ground -------------------------------------------
        const ground = createGameObject();
        const gT = ground.addComponent(TransformComponent);
        gT.position = { x: 0, y: -1, z: -55 };
        gT.rotation = { x: 0, y: 0, z: 0, w: 1 };
        const gMesh = ground.addComponent(MeshComponent);

        // rectangular prism dimensions
        const width = 50;
        const height = 5; // thickness / height of the prism
        const depth = 150;

        gMesh.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            new THREE.MeshStandardMaterial({ color: 0x808080 }),
        );
        // position the box so its top surface is at y = 0 (adjust if you want center at y=0)
        gMesh.mesh.position.set(
            gT.position.x,
            gT.position.y - height / 2,
            gT.position.z,
        );
        // tag ground mesh so raycast code can identify it
        gMesh.mesh.userData = gMesh.mesh.userData || {};
        gMesh.mesh.userData.type = "ground";
        gMesh.mesh.userData.gameObject = ground;
        scene.add(gMesh.mesh);

        const gRb = ground.addComponent(RigidbodyComponent);
        // make ground fixed/static so it doesn't fall from gravity
        gRb.rigidbody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        // place rigidbody to match the TransformComponent position
        gRb.rigidbody.setTranslation(
            { x: gT.position.x, y: gT.position.y, z: gT.position.z },
            true,
        );
        // collider half-extents must match half the box dimensions
        gRb.addCollider(
            RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2),
            false,
        );

        this.gameObjects.set(ground.id, ground);

        //#endregion --------------------------------------------------------

        //#region  Create the ball -------------------------------------------
        const ball = createBall(scene);
        this.gameObjects.set(ball.id, ball);
        //#endregion --------------------------------------------------------

        //#region  Create the goal -------------------------------------------
        const goalPosition = new THREE.Vector3(
            0,
            3,
            gT.position.z - depth / 2 + 6,
        ); // near far end of ground
        const goalSize = new THREE.Vector3(4, 4, 4);
        const goal = createGoal(scene, goalPosition, goalSize);
        this.gameObjects.set(goal.id, goal);
        //#endregion

        //#region  Create simple level ---------------------------------------

        //Walls
        const wallLeft = createBlock(
            scene,
            new THREE.Vector3(-20, 3, gT.position.z),
            new THREE.Vector3(3, 6, depth),
            true,
        );
        const wallRight = createBlock(
            scene,
            new THREE.Vector3(20, 3, gT.position.z),
            new THREE.Vector3(3, 6, depth),
            true,
        );
        //Place this on the far end to prevent ball from going out of bounds
        const wallTop = createBlock(
            scene,
            new THREE.Vector3(0, 3, gT.position.z - depth / 2 + 1.5),
            new THREE.Vector3(width, 6, 3),
            true,
        );
        const wallBottom = createBlock(
            scene,
            new THREE.Vector3(0, 3, gT.position.z + depth / 2 - 1.5),
            new THREE.Vector3(width, 6, 3),
            true,
        );

        this.gameObjects.set(wallLeft.id, wallLeft);
        this.gameObjects.set(wallRight.id, wallRight);
        this.gameObjects.set(wallTop.id, wallTop);
        this.gameObjects.set(wallBottom.id, wallBottom);

        //Create blocks as obstacles (Make a zigzag pattern)
        createBlock(
            scene,
            new THREE.Vector3(-8, 3, gT.position.z + 30),
            new THREE.Vector3(24, 6, 6),
            true,
        );
        createBlock(
            scene,
            new THREE.Vector3(8, 3, gT.position.z + 0),
            new THREE.Vector3(24, 6, 6),
            true,
        );
        createBlock(
            scene,
            new THREE.Vector3(-8, 3, gT.position.z - 30),
            new THREE.Vector3(24, 6, 6),
            true,
        );

        //#endregion --------------------------------------------------------

        // Simple light
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(-25, 0, 75);
        scene.add(light);
    }
}
