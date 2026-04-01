import { SelectionSystem } from "../systems/selectionSystem.js";
import { drawImageCentered, drawImageRect } from "../renderUtils.js";

export class PlayerSelectScene {
  constructor(game) {
    this.game = game;
    this.selector = new SelectionSystem({ rows: [2, 2] });
    this.currentSlot = "left";
  }

  enter() {
    this.currentSlot = "left";
    this.selector = new SelectionSystem({ rows: [2, 2] });
  }

  update() {}

  getActiveModelIndex() {
    const selection = this.selector.getSelection();
    return selection.rowIndex * 2 + selection.columnIndexes[selection.rowIndex];
  }

  render(p5) {
    p5.background("#08111d");
    const bg = this.game.assets.shared.menuBackground;
    if (bg) {
      drawImageRect(p5, bg, 0, 0, p5.width, p5.height, { alpha: 0.24 });
    }

    const modelIndex = this.getActiveModelIndex();
    const model = this.game.config.playerSelect.models[modelIndex];
    const preview = this.game.assets.models[model.id].normal;

    const lockedLeft = this.game.state.selectedPlayers.left.modelId;
    const lockedRight = this.game.state.selectedPlayers.right.modelId;

    p5.push();
    p5.fill("rgba(6, 12, 20, 0.78)");
    p5.noStroke();
    p5.rect(64, 48, p5.width - 128, p5.height - 96, 28);
    p5.pop();

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(42);
    p5.text(`Seleccionando ${this.currentSlot === "left" ? "Player 1" : "Player 2"}`, 110, 100);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Usa izquierda, derecha, arriba y abajo para elegir el modelo. Ambos players pueden usar el mismo o uno diferente.", 110, 154, 560);
    p5.pop();

    p5.push();
    p5.fill("rgba(14, 24, 39, 0.92)");
    p5.stroke("rgba(164, 187, 220, 0.16)");
    p5.rect(110, 226, 540, 236, 22);
    p5.rect(110, 500, 540, 112, 22);
    p5.pop();

    this.game.config.playerSelect.models.forEach((option, index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const active = modelIndex === index;
      this.drawOptionCard(p5, {
        x: 146 + column * 250,
        y: 252 + row * 104,
        width: 224,
        height: 88,
        title: option.title,
        subtitle: option.description,
        active,
        selected: false,
      });
    });

    this.drawLockedPlayerCard(p5, 146, 506, "Player 1", lockedLeft, this.currentSlot === "left");
    this.drawLockedPlayerCard(p5, 406, 506, "Player 2", lockedRight, this.currentSlot === "right");

    p5.push();
    p5.fill("rgba(10, 18, 31, 0.88)");
    p5.stroke("rgba(164, 187, 220, 0.16)");
    p5.rect(708, 110, 470, 520, 24);
    p5.line(742, 242, 1140, 242);
    p5.pop();

    if (preview) {
      drawImageCentered(p5, preview, 943, 404, 214, 214, {
        flipX: this.currentSlot === "right",
      });
    }

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(34);
    p5.text(model.title, 742, 154);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text(`Modelo activo: ${model.title}`, 742, 192);
    p5.text(this.currentSlot === "left" ? "Esta eleccion ocupara el lado izquierdo." : "Esta eleccion ocupara el lado derecho.", 742, 220);
    p5.text("Confirma para bloquear el modelo y pasar al siguiente jugador.", 742, 258, 360);
    p5.pop();
  }

  drawLockedPlayerCard(p5, x, y, label, modelId, activeTurn) {
    const model = this.game.config.playerSelect.models.find((entry) => entry.id === modelId);
    p5.push();
    p5.fill(activeTurn ? "rgba(62, 193, 182, 0.18)" : "rgba(17, 28, 45, 0.72)");
    p5.stroke(activeTurn ? "rgba(220, 255, 250, 0.95)" : "rgba(164, 187, 220, 0.16)");
    p5.rect(x, y, 230, 100, 18);
    p5.noStroke();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(22);
    p5.text(label, x + 18, y + 28);
    p5.textFont("IBM Plex Sans");
    p5.textSize(15);
    p5.fill("#b5c0d3");
    p5.text(model?.title ?? "Sin elegir", x + 18, y + 56, 190);
    p5.pop();
  }

  drawOptionCard(p5, { x, y, width, height, title, subtitle, active, selected }) {
    p5.push();
    p5.fill(active ? "rgba(62, 193, 182, 0.24)" : selected ? "rgba(29, 51, 77, 0.9)" : "rgba(17, 28, 45, 0.72)");
    p5.stroke(active ? "rgba(220, 255, 250, 0.95)" : "rgba(164, 187, 220, 0.16)");
    p5.rect(x, y, width, height, 18);
    p5.noStroke();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(22);
    p5.text(title, x + 18, y + 28);
    p5.textFont("IBM Plex Sans");
    p5.textSize(14);
    p5.fill("#b5c0d3");
    p5.text(subtitle, x + 18, y + 54);
    p5.pop();
  }

  handleAction(action) {
    if (action === "NAV_LEFT") this.selector.moveLeft();
    if (action === "NAV_RIGHT") this.selector.moveRight();
    if (action === "NAV_UP") this.selector.moveUp();
    if (action === "NAV_DOWN") this.selector.moveDown();

    if (action === "BACK") {
      this.game.sceneManager.change("main-menu");
      return;
    }

    if (action === "CONFIRM") {
      const model = this.game.config.playerSelect.models[this.getActiveModelIndex()];
      this.game.state.setPlayer(this.currentSlot, { modelId: model.id });

      if (this.currentSlot === "left") {
        this.currentSlot = "right";
        const currentRightModel = this.game.state.selectedPlayers.right.modelId;
        const nextIndex = this.game.config.playerSelect.models.findIndex((entry) => entry.id === currentRightModel);
        const safeIndex = Math.max(0, nextIndex);
        this.selector.rowIndex = Math.floor(safeIndex / 2);
        this.selector.columnIndexes = [0, 0];
        this.selector.columnIndexes[this.selector.rowIndex] = safeIndex % 2;
      } else {
        this.game.sceneManager.change("stage-select");
      }
    }
  }

  exit() {}
  getStatusText() { return "Duel - Seleccion de personajes"; }
  getGestureMap() {
    return {
      OPEN_PALM: "CONFIRM",
      OPEN_PALM_LEFT: "CONFIRM",
      OPEN_PALM_RIGHT: "CONFIRM",
    };
  }
}
