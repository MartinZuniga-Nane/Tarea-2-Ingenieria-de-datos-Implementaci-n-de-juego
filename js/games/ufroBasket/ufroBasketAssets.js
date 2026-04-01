import { AssetLoader } from "../../shared/assetLoader.js";

let ufroBasketAssetsPromise = null;

const manifest = {
  background: "./assets/games/ufroBasket/assets/fondo.jpg",
  cloud: "./assets/games/ufroBasket/assets/Nube.png",
  title: "./assets/games/ufroBasket/assets/Titulo.png",
  playLabel: "./assets/games/ufroBasket/assets/Jugar.png",
  exitLabel: "./assets/games/ufroBasket/assets/Salir.png",
  poseIdle: "./assets/games/ufroBasket/assets/Pose1.png",
  poseCharge: "./assets/games/ufroBasket/assets/Pose2.png",
  poseRelease: "./assets/games/ufroBasket/assets/Pose3.png",
  ball: "./assets/games/ufroBasket/assets/PelotaBasket.png",
  hoopRim: "./assets/games/ufroBasket/assets/Aro.png",
  hoopNet: "./assets/games/ufroBasket/assets/MallaAro.png",
  hoopConnector: "./assets/games/ufroBasket/assets/ConexionAro.png",
  hoopPost: "./assets/games/ufroBasket/assets/PosteAro.png",
  hoopTripod: "./assets/games/ufroBasket/assets/TripodeAro.png",
};

export async function loadUfroBasketAssets() {
  if (!ufroBasketAssetsPromise) {
    ufroBasketAssetsPromise = AssetLoader.loadImages(manifest).then(({ images, missing }) => ({
      background: images.background ?? null,
      cloud: images.cloud ?? null,
      title: images.title ?? null,
      menu: {
        play: images.playLabel ?? null,
        exit: images.exitLabel ?? null,
      },
      player: {
        idle: images.poseIdle ?? null,
        charge: images.poseCharge ?? null,
        release: images.poseRelease ?? null,
      },
      ball: images.ball ?? null,
      hoop: {
        rim: images.hoopRim ?? null,
        net: images.hoopNet ?? null,
        connector: images.hoopConnector ?? null,
        post: images.hoopPost ?? null,
        tripod: images.hoopTripod ?? null,
      },
      meta: { missing },
    }));
  }

  return ufroBasketAssetsPromise;
}
