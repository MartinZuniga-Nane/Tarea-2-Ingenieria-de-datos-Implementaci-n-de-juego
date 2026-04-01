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
      { id: "luffy", title: "Ace V2", description: "Sprite clasico alternativo" },
      { id: "ace", title: "Portgas D. Ace", description: "Fuego y postura desafiante" },
      { id: "sanji", title: "Sanji", description: "Patadas rapidas y destellos" },
      { id: "shanks", title: "Shanks", description: "Sprite clasico alternativo" },
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
    left: { x: 344, y: 556, width: 184, height: 184 },
    right: { x: 936, y: 556, width: 184, height: 184 },
    effectOffsets: {
      left: { attack: { x: 78, y: -26 }, hit: { x: 58, y: -24 } },
      right: { attack: { x: -78, y: -26 }, hit: { x: -58, y: -24 } },
    },
  },
};
