/**
 * Every ride creates a brand-new THREE.WebGLRenderer + scene from scratch (mirroring
 * TractorAdapterV2's `new Phaser.Game(...)` per mount). Without explicit disposal, repeated
 * presenter runs of this mechanic would accumulate lost-but-not-yet-GC'd WebGL contexts and
 * GPU-side buffers — browsers cap how many live contexts a page can hold.
 *
 * One exception: GLB character models (people/glbCharacters.ts) are loaded once and cached at
 * module scope so a replayed mechanic doesn't re-fetch them — `SkeletonUtils.clone` gives each
 * character its own bone hierarchy, but its mesh geometry/material are *shared references*
 * back to that cached template. Disposing those on a single ride's teardown would corrupt the
 * cache for every future ride. glbCharacters.ts marks the wrapper it clones into with
 * `userData.sharedResources = true`; this walker treats that as a hard stop — it neither
 * disposes that subtree nor recurses into it (there's nothing per-instance to free there).
 */
import * as THREE from 'three';

function disposeMaterial(material: THREE.Material): void {
  const withMaps = material as unknown as Record<string, unknown>;
  for (const key of ['map', 'alphaMap', 'normalMap', 'bumpMap', 'emissiveMap']) {
    const tex = withMaps[key];
    if (tex instanceof THREE.Texture) tex.dispose();
  }
  material.dispose();
}

export function disposeObject3D(root: THREE.Object3D): void {
  if ((root.userData as { sharedResources?: boolean }).sharedResources) return;

  const mesh = root as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();

  const material = (root as THREE.Mesh | THREE.Sprite).material as THREE.Material | THREE.Material[] | undefined;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
  } else if (material) {
    disposeMaterial(material);
  }

  for (const child of root.children.slice()) disposeObject3D(child);
}
