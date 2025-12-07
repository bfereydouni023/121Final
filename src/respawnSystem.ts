import { RigidbodyComponent, TransformComponent } from "./components";
import { getObjectByName } from "./objectSystem";
import type { GameObject, SingletonComponent, Transform } from "./types";
import * as THREE from "three";

export class RespawnSystem implements SingletonComponent {
    public respawnPoint: Transform = {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(0, 0, 0, 1),
        scale: new THREE.Vector3(1, 1, 1),
    };
    public killPlaneHeight: number = -5;
    private ball: GameObject | null = null;

    create(): void {
        // Initial setup if needed
    }

    physicsUpdate(_deltaTime: number): void {
        if (!this.ball) {
            this.ball = getObjectByName("ball");
        }
        if (!this.ball) return;
        const ballTransform = this.ball.getComponent(TransformComponent)!;
        if (!ballTransform) return;
        if (ballTransform.position.y < this.killPlaneHeight) {
            this.respawn();
        }
    }

    respawn(): void {
        if (!this.ball) return;
        const ballTransform = this.ball.getComponent(TransformComponent)!;
        if (!ballTransform) return;
        
        // Respawn the ball at the respawn point
        console.log(ballTransform.position.y);
        ballTransform.position = { ...this.respawnPoint.position };
        ballTransform.rotation = { ...this.respawnPoint.rotation };
        ballTransform.scale = { ...this.respawnPoint.scale };
        this.ball
            .getComponent(RigidbodyComponent)
            ?.rigidbody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.ball
            .getComponent(RigidbodyComponent)
            ?.rigidbody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
}
