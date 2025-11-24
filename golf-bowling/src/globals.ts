import { World } from "@dimforge/rapier3d-compat";
import { WebGLRenderer } from "three";

export let world: World;
export let renderer: WebGLRenderer;

export function setWorld(w: World) {
    world = w;
}

export function setRenderer(r: WebGLRenderer) {
    renderer = r;
}