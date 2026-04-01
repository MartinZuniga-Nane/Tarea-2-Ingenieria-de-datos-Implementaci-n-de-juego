import { AssetLoader } from "../../shared/assetLoader.js";

const modelSpriteKeys = ["normal", "prepare", "attack", "victory", "defeat", "effect1", "effect2"];
const modelIds = ["luffy", "ace", "sanji", "shanks"];
const modelAssetSources = {
  luffy: "model1",
  ace: "ace",
  sanji: "sanji",
  shanks: "model2",
};

const duelAssetManifest = {
  launcherCover: "./assets/launcher/duel-cover.png",
  menuBackground: "./assets/games/duel/backgrounds/FondoJuego.png",
  shadow: "./assets/games/duel/backgrounds/SombraGeneral.png",
  logo: "./assets/games/duel/logo/Logo.png",
  bg1: "./assets/games/duel/backgrounds/BG1.png",
  bg2: "./assets/games/duel/backgrounds/BG2.png",
  bg3: "./assets/games/duel/backgrounds/BG3.png",
};

modelIds.forEach((modelId) => {
  modelSpriteKeys.forEach((key) => {
    const assetSource = modelAssetSources[modelId];
    duelAssetManifest[`${modelId}${key}`] = `./assets/games/duel/models/${assetSource}/${key}.png`;
  });
});

function createModelBundle(images, modelId) {
  const sprites = {};
  modelSpriteKeys.forEach((key) => {
    sprites[key] = images[`${modelId}${key}`] ?? null;
  });
  return sprites;
}

export async function loadDuelAssets() {
  const { images, missing } = await AssetLoader.loadImages(duelAssetManifest);
  const models = {};

  modelIds.forEach((modelId) => {
    models[modelId] = createModelBundle(images, modelId);
  });

  return {
    meta: { missing },
    shared: {
      launcherCover: images.launcherCover ?? null,
      menuBackground: images.menuBackground ?? null,
      shadow: images.shadow ?? null,
      logo: images.logo ?? null,
      backgrounds: {
        bg1: images.bg1 ?? null,
        bg2: images.bg2 ?? null,
        bg3: images.bg3 ?? null,
      },
    },
    models,
  };
}
