/**
 * 3D maze geometry — ported from the isometric-maze prototype's scene.js `buildMaze`, minus
 * the external Kenney texture loading (this project has no bundled maze-tile assets): both
 * floor and walls use the procedural `makeStoneTexture` from ./textures.ts, in two shades so
 * the floor still reads as a distinct surface from the walls.
 */
import * as THREE from 'three';
import { type Grid, N, S, E, W, hasWall } from '../logic/maze';
import { makeStoneTexture } from './textures';

export const HALF_W = 128;
export const HALF_D = 128;
export const WALL_HEIGHT = 104;
export const WALL_THICKNESS = 14;

export function cellToWorld(r: number, c: number): { x: number; z: number } {
  return { x: (c - r) * HALF_W, z: -(c + r) * HALF_D };
}

const CORNERS: Record<number, { x: number; z: number }> = {
  [N]: { x: 0, z: HALF_D },
  [E]: { x: HALF_W, z: 0 },
  [S]: { x: 0, z: -HALF_D },
  [W]: { x: -HALF_W, z: 0 },
};

const EDGES: Record<number, [number, number]> = {
  [N]: [N, E],
  [E]: [E, S],
  [S]: [S, W],
  [W]: [W, N],
};

function createFloorGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, HALF_D,
    HALF_W, 0, 0,
    0, 0, -HALF_D,
    -HALF_W, 0, 0,
  ]);
  const uvTop = 1 - 364 / 512;
  const uvMid = 1 - 437.5 / 512;
  const uvBottom = 1 - 511 / 512;
  const uvs = new Float32Array([1.0, uvMid, 0.5, uvTop, 0.0, uvMid, 0.5, uvBottom]);
  const indices = [0, 1, 2, 0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface WallTransform {
  x: number;
  z: number;
  angleY: number;
  length: number;
  height: number;
  thickness: number;
}

function wallTransform(ax: number, az: number, bx: number, bz: number, height: number, thickness: number): WallTransform {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  return { x: (ax + bx) / 2, z: (az + bz) / 2, angleY: Math.atan2(dx, dz), length, height, thickness };
}

/** Builds floor + walls as InstancedMesh (cheap for large mazes) and adds them to `scene`. */
export function buildMazeGroup(scene: THREE.Scene, grid: Grid): THREE.Group {
  const group = new THREE.Group();
  const h = grid.length;
  const w = grid[0].length;
  const dummy = new THREE.Object3D();

  const floorGeo = createFloorGeometry();
  const floorTex = makeStoneTexture('#93938f', '#68686a');
  const floorMat = new THREE.MeshBasicMaterial({ map: floorTex, side: THREE.DoubleSide });
  const floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, h * w);
  let fi = 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const p = cellToWorld(r, c);
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      floorMesh.setMatrixAt(fi++, dummy.matrix);
    }
  }
  floorMesh.instanceMatrix.needsUpdate = true;
  group.add(floorMesh);

  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallTex = makeStoneTexture();
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const wallTransforms: WallTransform[] = [];
  const addWall = (dir: number, r: number, c: number) => {
    const [a, b] = EDGES[dir];
    const center = cellToWorld(r, c);
    const ca = CORNERS[a];
    const cb = CORNERS[b];
    wallTransforms.push(
      wallTransform(center.x + ca.x, center.z + ca.z, center.x + cb.x, center.z + cb.z, WALL_HEIGHT, WALL_THICKNESS)
    );
  };

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const cell = grid[r][c];
      if (hasWall(cell, N)) addWall(N, r, c);
      if (hasWall(cell, E)) addWall(E, r, c);
    }
  }
  for (let c = 0; c < w; c++) if (hasWall(grid[h - 1][c], S)) addWall(S, h - 1, c);
  for (let r = 0; r < h; r++) if (hasWall(grid[r][0], W)) addWall(W, r, 0);

  if (wallTransforms.length > 0) {
    const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, wallTransforms.length);
    wallTransforms.forEach((t, i) => {
      dummy.position.set(t.x, t.height / 2, t.z);
      dummy.rotation.set(0, t.angleY, 0);
      dummy.scale.set(t.thickness, t.height, t.length);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(i, dummy.matrix);
    });
    wallMesh.instanceMatrix.needsUpdate = true;
    group.add(wallMesh);
  }

  scene.add(group);
  return group;
}

/** World-space AABB of the whole maze (floor diamonds included), for camera fitting. */
export function mazeWorldBounds(grid: Grid): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const h = grid.length;
  const w = grid[0].length;
  const xMin = cellToWorld(h - 1, 0).x - HALF_W;
  const xMax = cellToWorld(0, w - 1).x + HALF_W;
  const zA = cellToWorld(0, 0).z;
  const zB = cellToWorld(h - 1, w - 1).z;
  return { minX: xMin, maxX: xMax, minZ: Math.min(zA, zB) - HALF_D, maxZ: Math.max(zA, zB) + HALF_D };
}
