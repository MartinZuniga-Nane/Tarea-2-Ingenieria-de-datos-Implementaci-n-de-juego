let ufroDashAssetsPromise = null;

export async function loadUfroDashAssets() {
  if (!ufroDashAssetsPromise) {
    ufroDashAssetsPromise = Promise.resolve({
      audioSrc: "./assets/games/geometrydashassets/StereoMadness.mp3",
      missing: [],
    });
  }

  return ufroDashAssetsPromise;
}
