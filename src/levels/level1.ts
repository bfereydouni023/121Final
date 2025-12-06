import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
} from "../components";
import { createBall } from "../objects/ballScript";
import { createGoal } from "../objects/goalScript";
import { createBlock } from "./block";
import { scene } from "../globals";
import { BaseLevel } from "./baselevel";
import {
    createGameObject,
    destroyGameObject,
    getSingletonComponent,
} from "../objectSystem";
import { getObjectByName } from "../objectSystem";
import { RespawnSystem } from "../respawnSystem";

export class Level1 extends BaseLevel {
    constructor() {
        super();
        this.id = Level1.name;
        this.createObjects();
    }

    protected createObjects(): void {
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

        this.gameObjects.set(ground.name, ground);

        //#endregion --------------------------------------------------------

        //#region  Create the goal -------------------------------------------
        const goalPosition = new THREE.Vector3(
            0,
            3,
            gT.position.z - depth / 2 + 6,
        ); // near far end of ground
        const goalSize = new THREE.Vector3(4, 4, 4);
        const goal = createGoal(scene, goalPosition, goalSize);
        this.gameObjects.set(goal.name, goal);
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

        this.gameObjects.set(wallLeft.name, wallLeft);
        this.gameObjects.set(wallRight.name, wallRight);
        this.gameObjects.set(wallTop.name, wallTop);
        this.gameObjects.set(wallBottom.name, wallBottom);

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

    protected onActivate(): void {
        const startPosition = new THREE.Vector3(0, 0, 0);
        const ball = createBall(scene, startPosition);
        getSingletonComponent(RespawnSystem).respawnPoint = {
            position: startPosition,
            rotation: new THREE.Quaternion(0, 0, 0, 1),
            scale: new THREE.Vector3(1, 1, 1),
        };
        this.gameObjects.set(ball.name, ball);
    }

    protected onDeactivate(): void {
        destroyGameObject(getObjectByName("ball")!);
    }
}
