import { AssetLoader } from "../../shared/assetLoader.js";

const modelSpriteKeys = ["normal", "prepare", "attack", "victory", "defeat", "effect1", "effect2"];

const duelAssetManifest = {
  launcherCover: "./assets/launcher/duel-cover.png",
  menuBackground: "./assets/games/duel/backgrounds/FondoJuego.png",
  shadow: "./assets/games/duel/backgrounds/SombraGeneral.png",
  logo: "./assets/games/duel/logo/Logo.png",
  bg1: "./assets/games/duel/backgrounds/BG1.png",
  bg2: "./assets/games/duel/backgrounds/BG2.png",
  bg3: "./assets/games/duel/backgrounds/BG3.png",
  model1normal: "./assets/games/duel/models/model1/normal.png",
  model1prepare: "./assets/games/duel/models/model1/prepare.png",
  model1attack: "./assets/games/duel/models/model1/attack.png",
  model1victory: "./assets/games/duel/models/model1/victory.png",
  model1defeat: "./assets/games/duel/models/model1/defeat.png",
  model1effect1: "./assets/games/duel/models/model1/effect1.png",
  model1effect2: "./assets/games/duel/models/model1/effect2.png",
  model2normal: "./assets/games/duel/models/model2/normal.png",
  model2prepare: "./assets/games/duel/models/model2/prepare.png",
  model2attack: "./assets/games/duel/models/model2/attack.png",
  model2victory: "./assets/games/duel/models/model2/victory.png",
  model2defeat: "./assets/games/duel/models/model2/defeat.png",
  model2effect1: "./assets/games/duel/models/model2/effect1.png",
  model2effect2: "./assets/games/duel/models/model2/effect2.png",
};

function createModelBundle(images, modelId) {
  const sprites = {};
  modelSpriteKeys.forEach((key) => {
    sprites[key] = images[`${modelId}${key}`] ?? null;
  });
  return sprites;
}

export async function loadDuelAssets() {
  const { images, missing } = await AssetLoader.loadImages(duelAssetManifest);

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
    models: {
      model1: createModelBundle(images, "model1"),
      model2: createModelBundle(images, "model2"),
    },
  };
}
