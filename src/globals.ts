import { World } from "@dimforge/rapier3d-compat";
import { WebGLRenderer, Scene } from "three";
import type { MainCamera, Transform } from "./types";

export let world: World;
export let renderer: WebGLRenderer;
export let mainCamera: MainCamera;
export let scene: Scene;

export const cameraMapViewTransform: Transform = {
    position: { x: 0, y: 150, z: 10 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0, w: 0 },
    scale: { x: 1, y: 1, z: 1 },
};

export function setWorld(w: World) {
    world = w;
}

export function setRenderer(r: WebGLRenderer) {
    renderer = r;
}

export function setMainCamera(c: MainCamera) {
    mainCamera = c;
}

export function setScene(s: Scene) {
    scene = s;
}

export const mouseInteractionGroup = 0x0000_0002;
