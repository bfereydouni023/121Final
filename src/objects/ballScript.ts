import * as THREE from "three";
import { Line2, LineGeometry, LineMaterial } from "three-stdlib";
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
} from "../components";
import { mainCamera } from "../globals";
import { world } from "../globals";
import { printToScreen } from "../utilities";
import type { GameObject } from "../types";

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
        new THREE.MeshStandardMaterial({
            color: 0xff5500,
            metalness: 0.2,
            roughness: 0.6,
        }),
    );
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
    throwScript.onClicked = (mouseEvent: MouseInputEvent) => {
        document.body.style.cursor = "none";
        dragging = true;
        activePointerId = mouseEvent.pointerId;
        dragStartWorld.copy(
            new THREE.Vector3().copy(rbComp.rigidbody.translation()).clone(),
        );
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
        hideTrajectory();

        throwObj = createGameObject("throwIndicator");
        const throwTransform = throwObj.addComponent(TransformComponent);
        throwTransform.position =
            ball.getComponent(TransformComponent)!.position;
        ball.getComponent(FollowComponent)!.target = throwTransform;
    };

    function onPointerMove(ev: PointerInputEvent) {
        if (!dragging || ev.pointerId !== activePointerId) return;
        if (!throwObj) return;
        const sensitivity = 1 / 10000;
        const transform = throwObj.getComponent(TransformComponent)!;
        const cursorPos = new THREE.Vector3(ev.velocity.x, 0, ev.velocity.y)
            .multiplyScalar(sensitivity)
            .add(
                new THREE.Vector3(
                    transform.position.x,
                    dragStartWorld.y,
                    transform.position.z,
                ),
            );

        updateTrajectory(
            dragStartWorld,
            new THREE.Vector3().copy(cursorPos),
            scene,
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
            new THREE.Vector3().copy(position).distanceTo(dragStartWorld) > 10
        ) {
            // clamp to max distance
            const dir = new THREE.Vector3()
                .copy(position)
                .sub(dragStartWorld)
                .normalize();
            position = new THREE.Vector3()
                .copy(dragStartWorld)
                .add(dir.multiplyScalar(10));
        }
        transform.position = { ...position };
    }

    function onPointerUp(ev: PointerInputEvent) {
        document.body.style.cursor = "default";
        if (!dragging || ev.pointerId !== activePointerId) return;

        dragging = false;
        activePointerId = null;
        rbComp.rigidbody.setEnabled(true);
        ball.getComponent(FollowComponent)!.target = null;
        mainCamera.gameObject.getComponent(FollowComponent)!.target =
            ball.getComponent(TransformComponent)!;
        // hide the indicator on release
        hideTrajectory();
        if (throwObj) destroyGameObject(throwObj);
        if (!validThrow) {
            ball.getComponent(TransformComponent)!.position = {
                ...dragStartWorld,
            };
        }
    }

    input.addEventListener("pointerCancel", (ev: PointerInputEvent) => {
        onPointerUp(ev);
    });
    input.addEventListener("pointerLeave", (ev: PointerInputEvent) => {
        onPointerUp(ev);
    });

    const removeListeners = [
        input.addEventListener("pointerMove", onPointerMove),
        input.addEventListener("pointerUp", onPointerUp),
        input.addEventListener("pointerCancel", onPointerUp),
        input.addEventListener("pointerLeave", onPointerUp),
    ];

    // Hook to clean up listeners if the script/component system supports disposal
    script.onDispose = () => {
        removeListeners.forEach((dispose) => dispose());
        try {
            hideTrajectory();
            if (trajLine) {
                // remove resize listener
                const onResize = (
                    trajLine as unknown as { __onResize?: () => void }
                ).__onResize;
                if (onResize) window.removeEventListener("resize", onResize);
                scene.remove(trajLine);
                trajLine = null;
            }
            trajGeometry = null;
            if (trajMaterial) {
                try {
                    trajMaterial.dispose?.();
                } catch (err) {
                    console.warn("trajMaterial.dispose failed:", err);
                }
                trajMaterial = null;
            }
        } catch (err) {
            console.warn("onDispose failed:", err);
        }
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

// Trajectory indicator (fat line using three/examples Line2)
const TRAJ_POINTS = 40;
const TRAJ_DT = 0.02; // seconds between samples
let trajLine: Line2 | null = null;
let trajGeometry: LineGeometry | null = null;
let trajMaterial: LineMaterial | null = null;

function createTrajectoryLine(scene: THREE.Scene) {
    // positions array: x,y,z repeated
    const positions = new Float32Array(TRAJ_POINTS * 3);
    trajGeometry = new LineGeometry();
    // LineGeometry#setPositions expects a flat array of numbers
    trajGeometry.setPositions(Array.from(positions));

    // try to pick accent color from UI CSS var if available (fallback to hex)

    const accentHex = 0xff8800; // orange
    trajMaterial = new LineMaterial({
        color: accentHex,
        linewidth: 6, // thickness in pixels (adjust to taste)
        transparent: true,
        opacity: 0.95,
    });
    // material needs screen resolution to compute linewidth
    try {
        trajMaterial.resolution.set(window.innerWidth, window.innerHeight);
    } catch {
        // ignore in non-browser envs
    }

    trajLine = new Line2(trajGeometry, trajMaterial);
    trajLine.computeLineDistances();
    trajLine.frustumCulled = false;
    scene.add(trajLine);

    // keep resolution updated on resize
    const onResize = () => {
        try {
            trajMaterial?.resolution.set(window.innerWidth, window.innerHeight);
        } catch (err) {
            console.warn("trajLine onResize failed:", err);
        }
    };
    window.addEventListener("resize", onResize);
    // store as property for cleanup in dispose handler
    (trajLine as unknown as { __onResize?: () => void }).__onResize = onResize;
}

function updateTrajectory(
    position: THREE.Vector3,
    initialVelocity: THREE.Vector3,
    scene: THREE.Scene,
) {
    if (!trajLine || !trajGeometry) createTrajectoryLine(scene);
    if (!trajLine || !trajGeometry) return;

    const ptsArray: number[] = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < TRAJ_POINTS; i++) {
        const t = i * TRAJ_DT;
        // p = p0 + v0*t + 0.5*g*t^2
        tmp.copy(initialVelocity).multiplyScalar(t);
        const gterm = new THREE.Vector3()
            .copy(world.gravity)
            .multiplyScalar(0.5 * t * t);
        tmp.add(gterm).add(position);
        ptsArray.push(tmp.x, tmp.y, tmp.z);
    }
    // update geometry positions
    trajGeometry.setPositions(ptsArray);
    trajLine.computeLineDistances();
    trajLine.visible = true;
}

function hideTrajectory() {
    if (!trajLine) return;
    trajLine.visible = false;
}
