import { World } from "@dimforge/rapier3d-compat";
import { PerspectiveCamera, WebGLRenderer } from "three";

export let world: World;
export let renderer: WebGLRenderer;
export let mainCamera: PerspectiveCamera;
export function setWorld(w: World) {
    world = w;
}

export function setRenderer(r: WebGLRenderer) {
    renderer = r;
}

export function setMainCamera(c: PerspectiveCamera) {
    mainCamera = c;
}

export const mouseInteractionGroup = 0x0000_0002;
