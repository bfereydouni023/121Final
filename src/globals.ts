import { World } from "@dimforge/rapier3d-compat";
import { WebGLRenderer, Scene } from "three";
import type { MainCamera } from "./types";

export let world: World;
export let renderer: WebGLRenderer;
export let mainCamera: MainCamera;
export let scene: Scene;

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
