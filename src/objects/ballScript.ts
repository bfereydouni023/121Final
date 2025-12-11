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
import { mainCamera, renderer } from "../globals";
import { world } from "../globals";
import { printToScreen } from "../utilities";
import { RingBuffer } from "../ringbuffer";
import type { GameObject } from "../types";
import { Color } from "three";

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
    const ballState: BallState = {
        angularVelocity: new THREE.Vector3(0, 0, 0), // spin axis and magnitude
        lastFrameVelocity: new THREE.Vector3(0, 0, 0),
        isGrounded: false,
        framesSinceLastVelocity: 0,
    };

    // Script / behavior component - adds drag-to-launch interactions
    const normalScript = ball.addComponent(ScriptComponent);
    normalScript.onPhysicsUpdate = () =>
        applyRollingDynamics(rbComp, ballState, radius);

    // Aim script - allows aiming before throwing
    const aimScript = ball.addComponent(ScriptComponent);
    aimScript.enabled = false;
    let aimDirection = 0; // angle in radians
    let aimArrow: GameObject | null = null;

    aimScript.onEnable = () => {
        // Create 3D arrow to show aim direction
        aimArrow = createGameObject("aimArrow");
        const arrowTransform = aimArrow.addComponent(TransformComponent);
        const ballPos = ball.getComponent(TransformComponent)!.position;
        arrowTransform.position = {
            x: ballPos.x,
            y: ballPos.y + 2,
            z: ballPos.z,
        };

        // Create arrow mesh
        const arrowMesh = aimArrow.addComponent(MeshComponent);
        const arrowGeometry = new THREE.ConeGeometry(0.3, 1.5, 8);
        arrowGeometry.rotateX(-Math.PI / 2); // Point along Z axis
        const arrowMaterial = new THREE.MeshToonMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
        });
        arrowMesh.mesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
        scene.add(arrowMesh.mesh);

        // Reset aim direction to forward
        aimDirection = 0;

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
        // rbComp.rigidbody.setEnabled();
    };

    aimScript.onPhysicsUpdate = () => {
        const mouseScreenPos = input.getScreenMousePosition();
        const hit = input.raycastPhysicsFromMouse(
            { clientX: mouseScreenPos.x, clientY: mouseScreenPos.y },
            renderer,
            mainCamera,
            { excludeRigidBody: rbComp.rigidbody },
        );
        if (hit) {
            const ballPos = ball.getComponent(TransformComponent)!.position;
            const dirToMouse = new THREE.Vector3()
                .subVectors(hit.point, ballPos)
                .setY(0)
                .normalize();
            aimDirection = Math.atan2(-dirToMouse.x, -dirToMouse.z);
        }

        // Update arrow rotation and position
        if (aimArrow) {
            const arrowTransform = aimArrow.getComponent(TransformComponent)!;
            const ballPos = ball.getComponent(TransformComponent)!.position;
            arrowTransform.position = {
                x: ballPos.x,
                y: ballPos.y + 2,
                z: ballPos.z,
            };

            // Convert euler angle to quaternion for rotation
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(new THREE.Euler(0, aimDirection, 0, "XYZ"));
            arrowTransform.rotation = {
                x: quaternion.x,
                y: quaternion.y,
                z: quaternion.z,
                w: quaternion.w,
            };
        }
    };

    aimScript.onDisable = () => {
        if (aimArrow) {
            destroyGameObject(aimArrow);
            aimArrow = null;
        }
    };

    normalScript.onClicked = (_mouseEvent: MouseInputEvent) => {
        normalScript.enabled = false;
        aimScript.enabled = true;
    };

    aimScript.onClicked = (mouseEvent: MouseInputEvent) => {
        aimScript.enabled = false;
        throwScript.enabled = true;
        activePointerId = mouseEvent.pointerId;
        lastMousePosition.set(mouseEvent.clientX, mouseEvent.clientY);
    };

    const throwScript = ball.addComponent(ScriptComponent);
    throwScript.enabled = false;
    let dragging = false;
    let validThrow = false;
    const dragStartWorld = new THREE.Vector3();
    let activePointerId: number | null = null;
    let throwObj: GameObject | null = null;
    let throwIndicator: GameObject | null = null;
    let teeLine: GameObject | null = null;
    const lastMousePosition = new THREE.Vector2();
    throwScript.storeVar("strength", 0);
    throwScript.storeVar("maxStrength", 100);
    throwScript.storeVar(
        "minThrowStrength",
        0.2 * throwScript.getVar<number>("maxStrength")!,
    );
    throwScript.storeVar("spin", 0);
    throwScript.storeVar("maxSpin", 50);

    throwScript.onEnable = () => {
        dragging = true;
        validThrow = false;
        document.body.style.cursor = "none";
        dragStartWorld.copy(
            new THREE.Vector3().copy(rbComp.rigidbody.translation()).clone(),
        );

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
            const strength = throwScript.getVar("strength") as number;
            const maxStrength = throwScript.getVar("maxStrength") as number;
            const spin = (throwScript.getVar("spin") as number) || 0;
            const maxSpin = throwScript.getVar("maxSpin") as number;
            const minThrowStrength =
                throwScript.getVar<number>("minThrowStrength")!;
            const minPowerHeight = (minThrowStrength / maxStrength) * height;
            ctx.fillStyle = "rgba(255,0,0,0.25)";
            ctx.fillRect(0, height - minPowerHeight, width / 2, 5);
            const barHeight = (strength / maxStrength) * height;

            // Draw thick bar showing strength with bend for spin
            const barWidth = width * 0.75;
            const spinAmount = spin / maxSpin;
            const bendStart = 0.4;
            const maxBend = width * 0.15; // Maximum horizontal bend at top

            ctx.fillStyle = validThrow
                ? "rgba(0,255,0,0.7)"
                : "rgba(255,0,0,0.7)";

            // Draw the bar as segments to create a bend effect
            const segments = 50;
            const segmentHeight = barHeight / segments;

            for (let i = 0; i < segments; i++) {
                const nextY = height - (i + 1) * segmentHeight;

                // Calculate horizontal offset - increases linearly with height
                const progress =
                    ((height - nextY) / height - bendStart) / (1 - bendStart);
                const offset = spinAmount * maxBend * Math.max(0, progress);

                const x = (width - barWidth) / 2 + offset;

                ctx.fillRect(x, nextY, barWidth, segmentHeight + 1);
            }

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

        // Create line perpendicular to aim direction
        const perpVector = new THREE.Vector3(
            -Math.cos(aimDirection),
            0,
            Math.sin(aimDirection),
        );
        lineComp.points = [
            perpVector.clone().multiplyScalar(-1.5),
            perpVector.clone().multiplyScalar(1.5),
        ];
    };

    const speedBuffer = new RingBuffer<number>(8);
    const spinBuffer = new RingBuffer<number>(10);
    let energy = 0;
    let spinEnergy = 0;

    throwScript.onPhysicsUpdate = () => {
        if (!dragging) {
            throwScript.enabled = false;
            return;
        }
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

        // Get aim direction as a vector
        const aimVector = new THREE.Vector3(
            Math.sin(aimDirection),
            0,
            Math.cos(aimDirection),
        ).normalize();

        // Project mouse velocity onto aim direction (forward/backward)
        // Vertical mouse movement = forward/backward along aim line
        const forwardComponent = -velocity.y * sensitivity;

        // Horizontal mouse movement = perpendicular (spin)
        const spinComponent = velocity.x * sensitivity;

        // Update position along aim direction only
        const currentOffset = new THREE.Vector3()
            .copy(transform.position)
            .sub(dragStartWorld);

        // Project current offset onto aim direction to get distance along line
        const distanceAlongAim = currentOffset.dot(aimVector);

        // Add forward movement
        const newDistanceAlongAim = distanceAlongAim - forwardComponent;

        // Clamp to max distance
        const clampedDistance = Math.max(
            -maxDistance,
            Math.min(maxDistance, newDistanceAlongAim),
        );

        // Calculate new position along the aim line
        const newPosition = new THREE.Vector3()
            .copy(dragStartWorld)
            .add(aimVector.clone().multiplyScalar(clampedDistance));
        newPosition.y = dragStartWorld.y;

        // Check for collision
        const collision = checkBallPlacement(transform, dragStartWorld, rbComp);
        if (collision) {
            validThrow = false;
        } else {
            validThrow = true;
        }

        transform.position = { ...newPosition };

        // Track speed energy (forward/backward movement)
        if (speedBuffer.size() === speedBuffer.capacity()) {
            const vel = speedBuffer.get(0)!;
            energy -= vel;
        }
        const speed = clampVelocity(forwardComponent * 50);
        energy += speed;
        speedBuffer.push(speed);

        // Track spin energy (perpendicular movement)
        if (spinBuffer.size() === spinBuffer.capacity()) {
            const oldSpin = spinBuffer.get(0)!;
            spinEnergy -= oldSpin;
        }
        const spin = clampVelocity(spinComponent * 50);
        spinEnergy += spin;
        spinBuffer.push(spin);

        throwScript.storeVar(
            "strength",
            Math.min(energy, throwScript.getVar("maxStrength") as number),
        );
        throwScript.storeVar(
            "spin",
            Math.min(spinEnergy, throwScript.getVar("maxSpin") as number),
        );

        if (energy < throwScript.getVar<number>("minThrowStrength")!) {
            validThrow = false;
        }
    };

    throwScript.onDisable = () => {
        document.body.style.cursor = "default";
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
            aimScript.enabled = true;
        } else {
            const aimVector = new THREE.Vector3(
                Math.sin(aimDirection),
                0,
                Math.cos(aimDirection),
            ).normalize();
            applyThrowForce(
                rbComp,
                throwScript.getVar<number>("strength")!,
                throwScript.getVar<number>("spin")!,
                aimVector,
                ballState,
            );
            normalScript.enabled = true;
        }
        if (throwIndicator) {
            destroyGameObject(throwIndicator);
        }
        if (teeLine) {
            destroyGameObject(teeLine);
        }
        speedBuffer.clear();
        spinBuffer.clear();
        energy = 0;
        spinEnergy = 0;
    };

    function onPointerUp(ev: PointerInputEvent) {
        if (ev.pointerId !== activePointerId) return;
        dragging = false;
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

    normalScript.onDispose = () => {
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
    ballState: BallState,
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

    rbComp.rigidbody.setAngvel(
        {
            x: ballState.angularVelocity.x,
            y: ballState.angularVelocity.y,
            z: ballState.angularVelocity.z,
        },
        true,
    );

    // Sleep ball if very slow to prevent endless sliding
    if (linSpeed < 0.05 && spinMagnitude < 0.05) {
        rbComp.rigidbody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        ballState.angularVelocity.set(0, 0, 0);
    }
}

function applyThrowForce(
    rbComp: RigidbodyComponent,
    strength: number,
    spin: number,
    aimDirection: THREE.Vector3,
    ballState: BallState,
) {
    // Apply linear velocity in the aim direction
    const throwVelocity = aimDirection
        .clone()
        .normalize()
        .multiplyScalar(-strength);
    ballState.angularVelocity.set(0, 0, 0); // reset spin

    // Apply spin around vertical axis
    const spinAxis = new THREE.Vector3(0, 1, 0); // Y axis
    const spinAngularVel = spinAxis.multiplyScalar(spin / 1); // rad/s
    ballState.angularVelocity.copy(spinAngularVel);
    rbComp.rigidbody.setLinvel(
        { x: throwVelocity.x, y: throwVelocity.y, z: throwVelocity.z },
        true,
    );
}

type BallState = {
    angularVelocity: THREE.Vector3; // spin axis and magnitude
    lastFrameVelocity: THREE.Vector3;
    isGrounded: boolean;
    framesSinceLastVelocity: number;
};
