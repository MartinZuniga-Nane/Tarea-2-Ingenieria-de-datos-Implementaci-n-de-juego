export class AssetLoader {
  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      image.src = src;
    });
  }

  static async loadImages(map) {
    const entries = Object.entries(map);
    const results = await Promise.allSettled(
      entries.map(async ([key, src]) => [key, await AssetLoader.loadImage(src)]),
    );

    const images = {};
    const missing = [];

    results.forEach((result, index) => {
      const [key, src] = entries[index];

      if (result.status === "fulfilled") {
        const [resolvedKey, image] = result.value;
        images[resolvedKey] = image;
      } else {
        missing.push({ key, src, reason: result.reason.message });
      }
    });

    return { images, missing };
  }
}
