export const gravityWeaverConfig = {
  canvas: {
    width: 1280,
    height: 720,
    minHeight: 540,
  },
  ml: {
    teachableModelUrl: "https://teachablemachine.withgoogle.com/models/TU_MODELO/",
    classifyIntervalMs: 90,
  },
  physics: {
    gravityForce: 1180,
    gravityLerp: 0.12,
    friction: 0.986,
    maxSpeed: 740,
    elasticity: 0.72,
  },
  astronaut: {
    radius: 18,
    start: { x: 132, y: 98 },
    color: "#5df3ff",
    glowColor: "rgba(93, 243, 255, 0.95)",
    trailColor: "rgba(93, 243, 255, 0.42)",
  },
  level: {
    glowPulseSpeed: 2.4,
    objectiveText: "Objetivo: alcanza el portal verde",
  },
  stars: {
    near: { count: 75, minSize: 1.2, maxSize: 2.8, minSpeed: 0.7, maxSpeed: 1.8 },
    mid: { count: 90, minSize: 0.8, maxSize: 2.2, minSpeed: 0.3, maxSpeed: 1.1 },
    far: { count: 120, minSize: 0.5, maxSize: 1.4, minSpeed: 0.1, maxSpeed: 0.55 },
  },
  visuals: {
    backgroundColor: "#050816",
    trailOverlay: "rgba(5, 8, 22, 0.19)",
    nebulaColorA: "rgba(86, 118, 255, 0.08)",
    nebulaColorB: "rgba(73, 255, 220, 0.07)",
    obstacleColor: "rgba(131, 85, 252, 0.24)",
    obstacleStroke: "rgba(170, 140, 255, 0.68)",
    portalColor: "rgba(128, 255, 190, 0.28)",
    portalGlowColor: "rgba(118, 255, 182, 0.95)",
    textColor: "#ebf2ff",
    textSoftColor: "#aebad9",
    warningColor: "#ffd48a",
  },
  input: {
    labelsToVectors: {
      arriba: { x: 0, y: -1 },
      abajo: { x: 0, y: 1 },
      izquierda: { x: -1, y: 0 },
      derecha: { x: 1, y: 0 },
      neutral: { x: 0, y: 0 },
    },
  },
};
