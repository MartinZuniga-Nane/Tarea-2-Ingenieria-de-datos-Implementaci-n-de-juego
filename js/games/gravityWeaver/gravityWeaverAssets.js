import { AssetLoader } from "../../shared/assetLoader.js";

export async function loadGravityWeaverAssets(config) {
  if (!config.assets.enabled) {
    return {
      images: {},
      missing: [],
    };
  }

  const manifest = {
    backgroundMain: config.assets.backgroundPath,
    astronautSheet: config.assets.astronautSheetPath,
    obstaclesSheet: config.assets.obstaclesSheetPath,
  };

  return AssetLoader.loadImages(manifest);
}
