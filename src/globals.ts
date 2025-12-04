import { World } from "@dimforge/rapier3d-compat";
import { PerspectiveCamera, WebGLRenderer, Scene } from "three";

export let world: World;
export let renderer: WebGLRenderer;
export let mainCamera: PerspectiveCamera;
export let scene: Scene;

export function setWorld(w: World) {
    world = w;
}

export function setRenderer(r: WebGLRenderer) {
    renderer = r;
}

export function setMainCamera(c: PerspectiveCamera) {
    mainCamera = c;
}

export function setScene(s: Scene) {
    scene = s;
}

export const mouseInteractionGroup = 0x0000_0002;
