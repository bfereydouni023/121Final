import { World } from "@dimforge/rapier3d-compat";
import { Camera, WebGLRenderer } from "three";

export let world: World;
export let renderer: WebGLRenderer;
export let mainCamera: Camera;

export function setWorld(w: World) {
  world = w;
}

export function setRenderer(r: WebGLRenderer) {
  renderer = r;
}

export function setMainCamera(c: Camera) {
  mainCamera = c;
}

export const mouseInteractionGroup = 0x0000_0002;
