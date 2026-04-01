import { AssetLoader } from "../../shared/assetLoader.js";

let ufroVolleyAssetsPromise = null;

const manifest = {
  background: "./assets/games/ufroVolley/volleyAssets/fondo cancha.png",
  courtLine: "./assets/games/ufroVolley/volleyAssets/linea cancha.png",
  netPost: "./assets/games/ufroVolley/volleyAssets/palo.png",
  ball: "./assets/games/ufroVolley/volleyAssets/pelota.png",
  ballShadowSmall: "./assets/games/ufroVolley/volleyAssets/sombra pelota chica.png",
  ballShadowLarge: "./assets/games/ufroVolley/volleyAssets/sombra pelota grande transp.png",
  catGray1: "./assets/games/ufroVolley/volleyAssets/gato gris 1 p.png",
  catGray2: "./assets/games/ufroVolley/volleyAssets/gato gris 2 p.png",
  catGray3: "./assets/games/ufroVolley/volleyAssets/gato gris 3 p.png",
  catGray4: "./assets/games/ufroVolley/volleyAssets/gato gris 4 p.png",
  catGray5: "./assets/games/ufroVolley/volleyAssets/gato gris 5 p2.png",
  catYellow1: "./assets/games/ufroVolley/volleyAssets/gato amarillo 1.png",
  catYellow2: "./assets/games/ufroVolley/volleyAssets/gato amarillo 2.png",
  catYellow3: "./assets/games/ufroVolley/volleyAssets/gato amarillo 3.png",
  catYellow4: "./assets/games/ufroVolley/volleyAssets/gato amarillo 4.png",
  catYellow5: "./assets/games/ufroVolley/volleyAssets/gato amarillo 5.png",
  dogWhite1: "./assets/games/ufroVolley/volleyAssets/perro blanco 1.png",
  dogWhite2: "./assets/games/ufroVolley/volleyAssets/perro blanco 2.png",
  dogWhite3: "./assets/games/ufroVolley/volleyAssets/perro blanco 3.png",
  dogWhite4: "./assets/games/ufroVolley/volleyAssets/perro blanco 4.png",
  dogWhite5: "./assets/games/ufroVolley/volleyAssets/perro blanco 5.png",
  dogBrown1: "./assets/games/ufroVolley/volleyAssets/perro cafe 1.png",
  dogBrown2: "./assets/games/ufroVolley/volleyAssets/perro cafe 2.png",
  dogBrown3: "./assets/games/ufroVolley/volleyAssets/perro cafe 3.png",
  dogBrown4: "./assets/games/ufroVolley/volleyAssets/perro cafe 4.png",
  dogBrown5: "./assets/games/ufroVolley/volleyAssets/perro cafe 5.png",
};

function createFrameSet(images, keys) {
  return keys.map((key) => images[key] ?? null);
}

export async function loadUfroVolleyAssets() {
  if (!ufroVolleyAssetsPromise) {
    ufroVolleyAssetsPromise = AssetLoader.loadImages(manifest).then(({ images, missing }) => ({
      background: images.background ?? null,
      courtLine: images.courtLine ?? null,
      netPost: images.netPost ?? null,
      ball: images.ball ?? null,
      ballShadowSmall: images.ballShadowSmall ?? null,
      ballShadowLarge: images.ballShadowLarge ?? null,
      meta: { missing },
      teams: {
        left: {
          front: {
            id: "cat-gray",
            frames: createFrameSet(images, ["catGray1", "catGray2", "catGray3", "catGray4", "catGray5"]),
          },
          back: {
            id: "cat-yellow",
            frames: createFrameSet(images, ["catYellow1", "catYellow2", "catYellow3", "catYellow4", "catYellow5"]),
          },
        },
        right: {
          front: {
            id: "dog-white",
            frames: createFrameSet(images, ["dogWhite1", "dogWhite2", "dogWhite3", "dogWhite4", "dogWhite5"]),
          },
          back: {
            id: "dog-brown",
            frames: createFrameSet(images, ["dogBrown1", "dogBrown2", "dogBrown3", "dogBrown4", "dogBrown5"]),
          },
        },
      },
    }));
  }

  return ufroVolleyAssetsPromise;
}
