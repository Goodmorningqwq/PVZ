// Discovers plant animation frames from assets/sprites/<plantName>/<state>/frame-<n>.(png|svg)
// and turns them into Phaser texture/animation registrations. Adding a new
// plant or animation state is just dropping files in that folder structure —
// nothing here needs to change.
const FRAME_MODULES = import.meta.glob('../../../assets/sprites/*/*/*.{png,svg}', {
  eager: true,
  import: 'default',
});

const FRAME_PATH_PATTERN = /assets\/sprites\/([^/]+)\/([^/]+)\/frame-(\d+)\.\w+$/;

function buildFrameIndex() {
  const plants = new Map();

  for (const [path, url] of Object.entries(FRAME_MODULES)) {
    const match = path.match(FRAME_PATH_PATTERN);
    if (!match) {
      continue;
    }

    const [, plantName, state, frameIndex] = match;
    if (!plants.has(plantName)) {
      plants.set(plantName, new Map());
    }

    const states = plants.get(plantName);
    if (!states.has(state)) {
      states.set(state, []);
    }

    states.get(state).push({ frameIndex: Number(frameIndex), url });
  }

  for (const states of plants.values()) {
    for (const frames of states.values()) {
      frames.sort((a, b) => a.frameIndex - b.frameIndex);
    }
  }

  return plants;
}

const FRAME_INDEX = buildFrameIndex();

export function getAnimatedPlantNames() {
  return [...FRAME_INDEX.keys()];
}

export function getPlantAnimationStates(plantName) {
  return [...(FRAME_INDEX.get(plantName)?.keys() ?? [])];
}

// The function that "takes a plant name and goes to that directory to obtain
// the frames": returns the sorted { frameIndex, url } list for one state.
export function getPlantFrames(plantName, state) {
  return FRAME_INDEX.get(plantName)?.get(state) ?? [];
}

export function getAnimationKey(plantName, state) {
  return `${plantName}-${state}`;
}

function getFrameTextureKey(plantName, state, frameIndex) {
  return `${plantName}-${state}-${frameIndex}`;
}

// Call from Scene.preload() to queue every discovered frame as a texture.
export function preloadPlantAnimations(scene) {
  for (const plantName of getAnimatedPlantNames()) {
    for (const state of getPlantAnimationStates(plantName)) {
      for (const { frameIndex, url } of getPlantFrames(plantName, state)) {
        scene.load.image(getFrameTextureKey(plantName, state, frameIndex), url);
      }
    }
  }
}

// Call from Scene.create(), after preload finishes, to register a looping
// Phaser animation per plant/state from the textures loaded above.
export function createPlantAnimations(scene, frameRate = 6) {
  for (const plantName of getAnimatedPlantNames()) {
    for (const state of getPlantAnimationStates(plantName)) {
      const animationKey = getAnimationKey(plantName, state);
      if (scene.anims.exists(animationKey)) {
        continue;
      }

      const frames = getPlantFrames(plantName, state).map(({ frameIndex }) => ({
        key: getFrameTextureKey(plantName, state, frameIndex),
      }));

      scene.anims.create({ key: animationKey, frames, frameRate, repeat: -1 });
    }
  }
}
