import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Input } from "../input";
import type { MouseInputEvent, PointerInputEvent } from "../input";
import {
    createGameObject,
    destroyGameObject,
    getSingletonComponent,
} from "../objectSystem";
import {
    TransformComponent,
    MeshComponent,
    RigidbodyComponent,
    ScriptComponent,
    FollowComponent,
    BillboardUIComponent,
    LineRendererComponent,
} from "../components";
import { mainCamera } from "../globals";
import { world } from "../globals";
import { printToScreen } from "../utilities";
import { RingBuffer } from "../ringbuffer";
import type { GameObject } from "../types";
import { Color } from "three";
import { max } from "three/tsl";

/**
 * Create a ball GameObject, add mesh + physics, and attach a ScriptComponent
 * that supports click-drag-release to launch the ball in the opposite direction.
 *
 * NOTE: This function now requires the active camera. Pointer interactions are wired through the
 * global Input event bus so individual objects no longer need direct DOM access.
 */
export function createBall(scene: THREE.Scene, position: THREE.Vector3) {
    // validate camera early to give a clear error
    if (!mainCamera) {
        throw new Error(
            "createBall: invalid camera passed. Ensure you pass a valid THREE.Camera and call createBall after creating the camera.",
        );
    }
    const input = getSingletonComponent(Input);
    const ball = createGameObject("ball");

    // Transform
    const t = ball.addComponent(TransformComponent);
    t.position = position.clone();

    // Visual mesh
    const meshComp = ball.addComponent(MeshComponent);
    const radius = 1.5;
    meshComp.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 24),
        new THREE.MeshToonMaterial({
            color: 0xffffff,
            normalMap: new THREE.TextureLoader().load(
                "../../assets/textures/sand-normal.jpg",
            ),
        }),
    );
    meshComp.mesh.castShadow = true;
    scene.add(meshComp.mesh);

    // Physics
    const rbComp = ball.addComponent(RigidbodyComponent);
    rbComp.rigidbody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    rbComp.addCollider(RAPIER.ColliderDesc.ball(radius), false);
    rbComp.collider.setFriction(0);
    rbComp.collider.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    rbComp.collider.setRestitution(0.3);

    ball.addComponent(FollowComponent);

    // Custom tracking for spin and physics state
    const ballState = {
        angularVelocity: new THREE.Vector3(0, 0, 0), // spin axis and magnitude
        lastFrameVelocity: new THREE.Vector3(0, 0, 0),
        isGrounded: false,
        framesSinceLastVelocity: 0,
    };

    // Script / behavior component - adds drag-to-launch interactions
    const script = ball.addComponent(ScriptComponent);
    script.onPhysicsUpdate = () =>
        applyRollingDynamics(rbComp, ballState, radius);

    const throwScript = ball.addComponent(ScriptComponent);
    let dragging = false;
    let validThrow = false;
    const dragStartWorld = new THREE.Vector3();
    let activePointerId: number | null = null;
    let throwObj: GameObject | null = null;
    let throwIndicator: GameObject | null = null;
    let teeLine: GameObject | null = null;
    const lastMousePosition = new THREE.Vector2();
    script.storeVar("strength", 0);
    script.storeVar("maxStrength", 100);
    script.storeVar(
        "minThrowStrength",
        0.2 * script.getVar<number>("maxStrength")!,
    );

    throwScript.onClicked = (mouseEvent: MouseInputEvent) => {
        document.body.style.cursor = "none";
        dragging = true;
        activePointerId = mouseEvent.pointerId;
        dragStartWorld.copy(
            new THREE.Vector3().copy(rbComp.rigidbody.translation()).clone(),
        );
        lastMousePosition.set(mouseEvent.clientX, mouseEvent.clientY);
        ball.getComponent(RigidbodyComponent)!.rigidbody.setLinvel(
            { x: 0, y: 0, z: 0 },
            true,
        );
        ball.getComponent(RigidbodyComponent)!.rigidbody.setAngvel(
            { x: 0, y: 0, z: 0 },
            true,
        );
        ballState.angularVelocity.set(0, 0, 0);
        ballState.framesSinceLastVelocity = 0;
        ballState.lastFrameVelocity.set(0, 0, 0);
        rbComp.rigidbody.setEnabled(false);
        mainCamera.gameObject.getComponent(FollowComponent)!.target = null;

        throwObj = createGameObject("throwIndicator");
        const throwTransform = throwObj.addComponent(TransformComponent);
        throwTransform.position =
            ball.getComponent(TransformComponent)!.position;
        ball.getComponent(FollowComponent)!.target = throwTransform;

        throwIndicator = createGameObject("throwSprite");
        const indicatorTransform =
            throwIndicator.addComponent(TransformComponent);
        indicatorTransform.position.y = dragStartWorld.y + 5;
        indicatorTransform.position.x += dragStartWorld.x + 3;
        indicatorTransform.position.z += dragStartWorld.z;
        throwIndicator.addComponent(BillboardUIComponent);
        throwIndicator.getComponent(BillboardUIComponent)!.size = {
            width: 50,
            height: 200,
        };
        throwIndicator.getComponent(BillboardUIComponent)!.draw = (ctx) => {
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = "white";
            const strength = script.getVar("strength") as number;
            const maxStrength = script.getVar("maxStrength") as number;
            const minThrowStrength = script.getVar<number>("minThrowStrength")!;
            const minPowerHeight = (minThrowStrength / maxStrength) * height;
            ctx.fillStyle = "rgba(255,0,0,0.25)";
            ctx.fillRect(0, height - minPowerHeight, width / 2, 5);
            const barHeight = (strength / maxStrength) * height;
            ctx.fillStyle = validThrow
                ? "rgba(0,255,0,0.7)"
                : "rgba(255,0,0,0.7)";
            ctx.fillRect(
                width * 0.25,
                height - barHeight,
                width * 0.5,
                barHeight,
            );
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, width, height);
        };

        teeLine = createGameObject("teeLine");
        const teeTransform = teeLine.addComponent(TransformComponent);
        teeTransform.position = {
            ...ball.getComponent(TransformComponent)!.position,
        };
        teeTransform.position.y += 0.01;
        const lineComp = teeLine.addComponent(LineRendererComponent);
        lineComp.colorFunc = (_t: number) => new Color(0x00ff00);
        lineComp.thickness = 0.1;
        lineComp.points = [
            new THREE.Vector3(-1.5, 0, 0),
            new THREE.Vector3(1.5, 0, 0),
        ];
    };

    const speedBuffer = new RingBuffer<number>(8);
    const spinBuffer = new RingBuffer<THREE.Vector3>(10);
    let energy = 0;
    throwScript.onPhysicsUpdate = () => {
        if (!dragging) return;
        if (!throwObj) return;
        const sensitivity = 1 / 30;
        const maxDistance = 6;
        const maxVelocity = 50;
        const clampVelocity = (velocity: number) => {
            return Math.max(-maxVelocity, Math.min(maxVelocity, velocity / 5));
        };
        const transform = throwObj.getComponent(TransformComponent)!;
        const mousePos = input.getScreenMousePosition();
        const velocity = new THREE.Vector2(mousePos.x, mousePos.y).sub(
            lastMousePosition,
        );
        lastMousePosition.set(mousePos.x, mousePos.y);
        const cursorPos = new THREE.Vector3(velocity.x, 0, velocity.y)
            .multiplyScalar(sensitivity)
            .add(
                new THREE.Vector3(
                    transform.position.x,
                    dragStartWorld.y,
                    transform.position.z,
                ),
            );

        let position = cursorPos;
        position.y = dragStartWorld.y;
        const collision = checkBallPlacement(transform, dragStartWorld, rbComp);
        if (collision) {
            validThrow = false;
        } else {
            validThrow = true;
        }

        if (
            new THREE.Vector3().copy(position).distanceTo(dragStartWorld) >
            maxDistance
        ) {
            // clamp to max distance
            const dir = new THREE.Vector3()
                .copy(position)
                .sub(dragStartWorld)
                .normalize();
            position = new THREE.Vector3()
                .copy(dragStartWorld)
                .add(dir.multiplyScalar(maxDistance));
        }
        transform.position = { ...position };
        if (speedBuffer.size() === speedBuffer.capacity()) {
            const vel = speedBuffer.get(0)!;
            energy -= vel;
        }
        const speed = clampVelocity(
            velocity.lengthSq() * sensitivity * -Math.sign(velocity.y),
        );
        energy += speed;
        speedBuffer.push(speed);
        script.storeVar("strength", energy);
        if (energy < script.getVar<number>("minThrowStrength")!) {
            validThrow = false;
        }
    };

    function onPointerUp(ev: PointerInputEvent) {
        document.body.style.cursor = "default";
        if (!dragging || ev.pointerId !== activePointerId) return;
        dragging = false;
        activePointerId = null;
        rbComp.rigidbody.setEnabled(true);
        ball.getComponent(FollowComponent)!.target = null;
        mainCamera.gameObject.getComponent(FollowComponent)!.target =
            ball.getComponent(TransformComponent)!;
        if (throwObj) destroyGameObject(throwObj);
        if (!validThrow) {
            ball.getComponent(TransformComponent)!.position = {
                ...dragStartWorld,
            };
        }
        if (throwIndicator) {
            destroyGameObject(throwIndicator);
        }
        if (teeLine) {
            destroyGameObject(teeLine);
        }
        speedBuffer.clear();
        energy = 0;
    }

    input.addEventListener("pointerCancel", (ev: PointerInputEvent) => {
        onPointerUp(ev);
    });
    input.addEventListener("pointerLeave", (ev: PointerInputEvent) => {
        onPointerUp(ev);
    });

    const removeListeners = [
        input.addEventListener("pointerUp", onPointerUp),
        input.addEventListener("pointerCancel", onPointerUp),
        input.addEventListener("pointerLeave", onPointerUp),
    ];

    // Hook to clean up listeners if the script/component system supports disposal
    script.onDispose = () => {
        removeListeners.forEach((dispose) => dispose());
    };
    return ball;
}

function checkBallPlacement(
    ball: TransformComponent,
    dragStartWorld: THREE.Vector3,
    rbComp: RigidbodyComponent,
) {
    const checkVel = new THREE.Vector3()
        .copy(new THREE.Vector3().copy(ball.position))
        .sub(dragStartWorld.clone());
    const cast = world.castShape(
        new THREE.Vector3()
            .copy(dragStartWorld)
            .add(new THREE.Vector3(0, 0.05, 0)),
        new RAPIER.Quaternion(0, 0, 0, 1),
        checkVel.set(checkVel.x, 0, checkVel.z),
        rbComp.collider.shape,
        0.01,
        1,
        true,
        undefined,
        undefined,
        rbComp.collider,
    );
    return cast;
}

function applyRollingDynamics(
    rbComp: RigidbodyComponent,
    ballState: {
        angularVelocity: THREE.Vector3; // spin axis and magnitude
        lastFrameVelocity: THREE.Vector3;
        isGrounded: boolean;
        framesSinceLastVelocity: number;
    },
    radius: number,
): void {
    // Ball physics constants (bowling ball like behavior)
    const rollingFrictionCoeff = 0.015; // rolling resistance coefficient
    const spinDampingCoeff = 0.98; // spin damping per frame
    const spinToVelCoupling = 0.5; // how much spin affects linear velocity (0-1)
    // Cast ray downward to check if grounded
    const hit = world.castRayAndGetNormal(
        new RAPIER.Ray(rbComp.rigidbody.translation(), {
            x: 0,
            y: -1,
            z: 0,
        }),
        10,
        true,
        undefined,
        undefined,
        rbComp.collider,
    );

    ballState.isGrounded = hit !== null;
    if (!ballState.isGrounded) {
        // In air: apply light damping to angular velocity
        ballState.angularVelocity.multiplyScalar(spinDampingCoeff);
        return;
    }

    // Get current linear velocity
    const linVel = rbComp.rigidbody.linvel();
    const linVelVec = new THREE.Vector3(linVel.x, linVel.y, linVel.z);
    const linSpeed = linVelVec.length();
    printToScreen(`Speed: ${linSpeed.toFixed(2)} m/s`, "speed", 1000);
    printToScreen(
        `Spin: ${ballState.angularVelocity.length().toFixed(2)} rad/s`,
        "spin",
        1000,
    );

    // Calculate ideal rolling velocity from spin (v = ω × r)
    // For a ball spinning with angular velocity ω, surface velocity should be ω*r
    const spinMagnitude = ballState.angularVelocity.length();
    const idealLinearSpeed = spinMagnitude * radius;

    // Blend current velocity toward spin-induced velocity
    if (spinMagnitude > 0.01) {
        // Get direction perpendicular to spin axis (velocity should be perpendicular to spin)
        const velDir =
            linVelVec.length() > 0.01
                ? linVelVec.clone().normalize()
                : new THREE.Vector3(1, 0, 0);

        // Apply spin coupling effect
        const targetVel = velDir
            .clone()
            .multiplyScalar(
                linSpeed * (1 - spinToVelCoupling) +
                    idealLinearSpeed * spinToVelCoupling,
            );

        rbComp.rigidbody.setLinvel(targetVel, true);
    }

    // Apply rolling friction (rolling resistance)
    if (linSpeed > 0.01) {
        const frictionCoeff = rollingFrictionCoeff * 9.81; // rolling resistance deceleration
        const frictionAccel = Math.max(
            0,
            linSpeed - frictionCoeff * world.timestep,
        );
        const frictionDir = linVelVec.clone().normalize();
        const newVel = frictionDir
            .clone()
            .multiplyScalar(Math.max(0, frictionAccel));
        rbComp.rigidbody.setLinvel(newVel, true);
    }

    // Apply damping to spin
    ballState.angularVelocity.multiplyScalar(spinDampingCoeff);

    // Sleep ball if very slow to prevent endless sliding
    if (linSpeed < 0.05 && spinMagnitude < 0.05) {
        rbComp.rigidbody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ballState.angularVelocity.set(0, 0, 0);
    }
}
