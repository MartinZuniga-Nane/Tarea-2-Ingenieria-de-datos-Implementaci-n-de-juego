export function createDuelSketch(game) {
  return (p5) => {
    let lastTime = 0;

    p5.setup = () => {
      const { width, height } = game.config.canvas;
      const canvas = p5.createCanvas(width, height);
      canvas.parent(game.canvasContainer);
      p5.textFont("IBM Plex Sans");
      resizeCanvas();
      lastTime = performance.now();
      game.onSketchReady(p5);
    };

    p5.draw = () => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      game.update(dt, p5);
      game.render(p5);
    };

    p5.windowResized = () => resizeCanvas();

    function resizeCanvas() {
      const parentWidth = game.canvasContainer.clientWidth || window.innerWidth;
      const parentHeight = game.canvasContainer.clientHeight || window.innerHeight;
      const scale = Math.min(parentWidth / game.config.canvas.width, parentHeight / game.config.canvas.height);
      const targetWidth = game.config.canvas.width * scale;
      const targetHeight = game.config.canvas.height * scale;
      p5.resizeCanvas(game.config.canvas.width, game.config.canvas.height);
      p5.canvas.style.width = `${targetWidth}px`;
      p5.canvas.style.height = `${targetHeight}px`;
      p5.canvas.style.margin = "0 auto";
    }
  };
}
