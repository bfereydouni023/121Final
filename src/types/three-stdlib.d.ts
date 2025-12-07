// Local type shim so TypeScript can resolve the three-stdlib exports we use.
declare module "three-stdlib" {
    export { Line2 } from "three/examples/jsm/lines/Line2.js";
    export { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
    export { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
}
