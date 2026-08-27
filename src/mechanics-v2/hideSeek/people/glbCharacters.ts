/**
 * Loads Kenney "Mini Characters" GLB models (public/assets/hideSeekCharacters/, CC0 — see
 * CREDITS.txt there) and instantiates them as CharacterRigs, porting the isometric-maze
 * prototype's `loadCharacter` normalization (scale to a target height, center X/Z, feet at
 * y=0) and `resolveAnimations` (match clips to idle/walk by name). Multiple characters can
 * share one loaded template: `SkeletonUtils.clone` duplicates the skinned mesh + skeleton so
 * each instance gets its own independently-posable AnimationMixer.
 *
 * The 8 bundled models are split so the seeker always uses one reserved model no team ever
 * gets — that alone (plus its hat, plus never carrying a name chip) is what keeps it visually
 * unmistakable, since a photo-textured GLB can't be cleanly recolored per team the way the
 * flat-shaded procedural fallback (./character.ts) can.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeNameChipSprite } from './badgeChip';
import { makeTeamCharacter as makeProceduralTeamCharacter, makeSeekerCharacter as makeProceduralSeekerCharacter, type CharacterRig } from './character';

const BASE_PATH = 'assets/hideSeekCharacters/';
export const TEAM_MODEL_FILES = [
  'character-male-b.glb',
  'character-male-c.glb',
  'character-male-d.glb',
  'character-female-a.glb',
  'character-female-b.glb',
  'character-female-c.glb',
  'character-female-d.glb',
];
export const SEEKER_MODEL_FILE = 'character-male-a.glb';

const TARGET_HEIGHT = 110;
const HAT_COLOR = 0x7f1d1d;

interface LoadedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export interface CharacterAssetCache {
  models: Map<string, LoadedModel>;
}

let cachedLoad: Promise<CharacterAssetCache> | null = null;

/** Loads (and caches at module scope, so a replayed mechanic doesn't re-fetch) every bundled
 *  model. A model that fails to load is simply left out of the map — callers fall back to the
 *  procedural rig for that team/seeker rather than failing the whole ride. */
export function loadCharacterAssets(): Promise<CharacterAssetCache> {
  if (!cachedLoad) {
    cachedLoad = (async () => {
      const loader = new GLTFLoader();
      const files = [...TEAM_MODEL_FILES, SEEKER_MODEL_FILE];
      const models = new Map<string, LoadedModel>();
      await Promise.all(
        files.map(async (file) => {
          try {
            const gltf = await loader.loadAsync(BASE_PATH + file);
            models.set(file, { scene: gltf.scene, animations: gltf.animations });
          } catch (err) {
            console.warn(`hideSeek: failed to load character model ${file}, will fall back to procedural rig.`, err);
          }
        })
      );
      return { models };
    })();
  }
  return cachedLoad;
}

interface Instantiated {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  headTopY: number;
}

function findClip(clips: THREE.AnimationClip[], key: string): THREE.AnimationClip | null {
  return clips.find((c) => c.name.toLowerCase().includes(key)) ?? null;
}

function instantiateModel(loaded: LoadedModel): Instantiated {
  const cloned = cloneSkinned(loaded.scene) as THREE.Object3D;
  cloned.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
  });
  cloned.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(cloned);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  cloned.scale.setScalar(TARGET_HEIGHT / maxDim);
  cloned.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(cloned);
  const center = box.getCenter(new THREE.Vector3());
  cloned.position.x -= center.x;
  cloned.position.z -= center.z;
  cloned.position.y -= box.min.y;
  cloned.updateMatrixWorld(true);
  const headTopY = box.max.y - box.min.y;

  const group = new THREE.Group();
  // Geometry/material on `cloned` are shared references back to the cached template (only the
  // skeleton/bone hierarchy is actually duplicated) — flagged so sceneBuild/dispose.ts's
  // per-ride cleanup skips this subtree instead of corrupting the cache for future rides.
  group.userData.sharedResources = true;
  group.add(cloned);

  const mixer = new THREE.AnimationMixer(cloned);
  const idleClip = findClip(loaded.animations, 'idle');
  const walkClip = findClip(loaded.animations, 'walk') ?? findClip(loaded.animations, 'run');
  const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
  idleAction?.play();

  return { group, mixer, idleAction, walkAction, headTopY };
}

export function makeGlbTeamCharacter(cache: CharacterAssetCache, team: { name: string; color: string }, modelFile: string): CharacterRig {
  const loaded = cache.models.get(modelFile);
  if (!loaded) return makeProceduralTeamCharacter(team);

  const { group, mixer, idleAction, walkAction, headTopY } = instantiateModel(loaded);
  const root = new THREE.Group();
  root.add(group);

  const chip = makeNameChipSprite(team);
  chip.position.set(0, headTopY + 22, 0);
  root.add(chip);

  return { root, chip, mixer, idleAction, walkAction, currentAction: idleAction };
}

export function makeGlbSeekerCharacter(cache: CharacterAssetCache): CharacterRig {
  const loaded = cache.models.get(SEEKER_MODEL_FILE);
  if (!loaded) return makeProceduralSeekerCharacter();

  const { group, mixer, idleAction, walkAction, headTopY } = instantiateModel(loaded);
  const root = new THREE.Group();
  root.add(group);

  // A sibling of `group`, not a child of it — `group` is flagged shared/undisposable (see
  // above), but the hat is freshly created per ride and must be disposed like anything else.
  const hatMaterial = new THREE.MeshLambertMaterial({ color: HAT_COLOR });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 3, 20), hatMaterial);
  brim.position.y = headTopY - 4;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 16, 16), hatMaterial);
  crown.position.y = headTopY + 6;
  const hat = new THREE.Group();
  hat.add(brim, crown);
  root.add(hat);

  return { root, mixer, idleAction, walkAction, currentAction: idleAction };
}
