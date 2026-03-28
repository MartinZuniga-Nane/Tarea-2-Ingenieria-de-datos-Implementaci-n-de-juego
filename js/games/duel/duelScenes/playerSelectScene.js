import { SelectionSystem } from "../systems/selectionSystem.js";

export class PlayerSelectScene {
  constructor(game) {
    this.game = game;
    this.selector = new SelectionSystem({ rows: [game.config.playerSelect.models.length] });
    this.currentSlot = "left";
  }

  enter() {
    this.currentSlot = "left";
    this.selector = new SelectionSystem({ rows: [this.game.config.playerSelect.models.length] });
  }

  update() {}

  render(p5) {
    p5.background("#08111d");
    const bg = this.game.assets.shared.menuBackground;
    if (bg) {
      p5.tint(255, 60);
      p5.image(bg, 0, 0, p5.width, p5.height);
      p5.noTint();
    }

    const selection = this.selector.getSelection();
    const modelIndex = selection.columnIndexes[0];
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
    p5.text(`Seleccionando ${this.currentSlot === "left" ? "Player 1" : "Player 2"}`, 104, 96);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Usa izquierda o derecha para elegir el modelo. Ambos players pueden usar el mismo o uno diferente.", 104, 146, 560);
    p5.pop();

    p5.push();
    p5.fill("rgba(14, 24, 39, 0.92)");
    p5.stroke("rgba(164, 187, 220, 0.16)");
    p5.rect(104, 220, 520, 128, 20);
    p5.rect(104, 380, 520, 164, 20);
    p5.pop();

    this.game.config.playerSelect.models.forEach((option, index) => {
      const active = modelIndex === index;
      this.drawOptionCard(p5, {
        x: 134 + index * 246,
        y: 244,
        width: 214,
        height: 84,
        title: option.title,
        subtitle: option.description,
        active,
        selected: false,
      });
    });

    this.drawLockedPlayerCard(p5, 134, 404, "Player 1", lockedLeft, this.currentSlot === "left");
    this.drawLockedPlayerCard(p5, 384, 404, "Player 2", lockedRight, this.currentSlot === "right");

    p5.push();
    p5.fill("rgba(10, 18, 31, 0.88)");
    p5.stroke("rgba(164, 187, 220, 0.16)");
    p5.rect(684, 124, 500, 500, 24);
    p5.pop();

    if (preview) {
      p5.push();
      p5.imageMode(p5.CENTER);
      p5.image(preview, 934, 360, 320, 320);
      p5.pop();
    }

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(34);
    p5.text(model.title, 724, 158);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text(`Modelo activo: ${model.title}`, 724, 204);
    p5.text(this.currentSlot === "left" ? "Esta eleccion ocupara el lado izquierdo." : "Esta eleccion ocupara el lado derecho.", 724, 232);
    p5.text("Confirma para bloquear el modelo y pasar al siguiente jugador. Luego podras agregar mas modelos sin cambiar el flujo.", 724, 260, 380);
    p5.pop();
  }

  drawLockedPlayerCard(p5, x, y, label, modelId, activeTurn) {
    const model = this.game.config.playerSelect.models.find((entry) => entry.id === modelId);
    p5.push();
    p5.fill(activeTurn ? "rgba(62, 193, 182, 0.18)" : "rgba(17, 28, 45, 0.72)");
    p5.stroke(activeTurn ? "rgba(220, 255, 250, 0.95)" : "rgba(164, 187, 220, 0.16)");
    p5.rect(x, y, 220, 112, 18);
    p5.noStroke();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(22);
    p5.text(label, x + 18, y + 28);
    p5.textFont("IBM Plex Sans");
    p5.textSize(15);
    p5.fill("#b5c0d3");
    p5.text(model?.title ?? "Sin elegir", x + 18, y + 58, 180);
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

    if (action === "BACK") {
      this.game.sceneManager.change("main-menu");
      return;
    }

    if (action === "CONFIRM") {
      const selection = this.selector.getSelection();
      const model = this.game.config.playerSelect.models[selection.columnIndexes[0]];
      this.game.state.setPlayer(this.currentSlot, { modelId: model.id });

      if (this.currentSlot === "left") {
        this.currentSlot = "right";
        const currentRightModel = this.game.state.selectedPlayers.right.modelId;
        const nextIndex = this.game.config.playerSelect.models.findIndex((entry) => entry.id === currentRightModel);
        this.selector.columnIndexes[0] = Math.max(0, nextIndex);
      } else {
        this.game.sceneManager.change("stage-select");
      }
    }
  }

  exit() {}
  getStatusText() { return "Duel - Seleccion de personajes"; }
  getGestureMap() { return {}; }
}
