export const ufroNinjaConfig = {
  canvas: {
    width: 640,
    height: 480,
  },
  assets: {
    backgroundPath: "./assets/games/ufroNinja/modelo/backgrounds/bg1.png",
    fruitPaths: [
      "./assets/games/ufroNinja/modelo/fruits/red apple.png",
      "./assets/games/ufroNinja/modelo/fruits/yellow banana.png",
      "./assets/games/ufroNinja/modelo/fruits/green watermelon.png",
      "./assets/games/ufroNinja/modelo/fruits/yellow pineapple.png",
      "./assets/games/ufroNinja/modelo/fruits/orange 1.png",
      "./assets/games/ufroNinja/modelo/fruits/brown coconut 1.png",
      "./assets/games/ufroNinja/modelo/fruits/brown kiwi.png",
    ],
  },
  model: {
    path: "./assets/games/ufroNinja/modelo/model.json",
    metadataPath: "./assets/games/ufroNinja/modelo/metadata.json",
    classifyIntervalMs: 80,
  },
  input: {
    attackLabels: ["ataque"],
    restLabels: ["reposo", "neutral"],
    expectedLabels: ["ataque", "reposo"],
  },
  game: {
    initialLives: 3,
    gravity: 0.4,
    spawnSlowFrames: 60,
    spawnFastFrames: 20,
    spawnRampScore: 50,
  },
  ui: {
    title: "UFRO NINJA",
    subtitle: "Haz el gesto de ataque para cortar frutas",
    hudTextColor: "#ffffff",
    statusLoading: "Cargando clasificador...",
  },
};
