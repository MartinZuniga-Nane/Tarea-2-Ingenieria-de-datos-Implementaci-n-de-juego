export const duelConfig = {
  canvas: {
    width: 1280,
    height: 720,
    minHeight: 540,
  },
  debug: {
    enabled: false,
    showVideo: false,
  },
  input: {
    gesturePersistenceMs: 300,
    navigationCooldownMs: 220,
    confirmCooldownMs: 650,
    shootCooldownMs: 650,
  },
  launcher: {
    title: "Duel",
  },
  ui: {
    menuSpacing: 84,
    fadeMs: 650,
  },
  playerSelect: {
    models: [
      { id: "model1", title: "Gunslinger Prime", description: "Modelo base 01" },
      { id: "model2", title: "Crimson Warden", description: "Modelo base 02" },
    ],
  },
  stageSelect: {
    stages: ["bg1", "bg2", "bg3"],
  },
  battle: {
    introMs: 850,
    prepareMs: 900,
    countdownStepMs: 850,
    armedMs: 450,
    shootWindowMs: 1700,
    resolveMs: 1200,
    resultDelayMs: 1400,
    simultaneousMarginMs: 120,
    earlyShotPenalty: true,
    opponentReactionMs: {
      min: 520,
      max: 1180,
    },
  },
  fighter: {
    left: { x: 318, y: 520, width: 280, height: 280 },
    right: { x: 965, y: 520, width: 280, height: 280 },
    effectOffsets: {
      left: { attack: { x: 118, y: -48 }, hit: { x: 92, y: -42 } },
      right: { attack: { x: -118, y: -48 }, hit: { x: -92, y: -42 } },
    },
  },
};
