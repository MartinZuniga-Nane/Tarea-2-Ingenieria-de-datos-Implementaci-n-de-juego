const KEY_ACTIONS = {
  KeyA: "NAV_LEFT",
  KeyD: "NAV_RIGHT",
  KeyW: "NAV_UP",
  KeyS: "NAV_DOWN",
  Enter: "CONFIRM",
  Space: "SHOOT",
  KeyF: "SHOOT_LEFT",
  KeyK: "SHOOT_RIGHT",
  Escape: "BACK",
};

export class KeyboardFallback {
  constructor() {
    this.queue = [];
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  start() {
    window.addEventListener("keydown", this.handleKeyDown);
  }

  stop() {
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  handleKeyDown(event) {
    const action = KEY_ACTIONS[event.code];
    if (!action) {
      return;
    }

    event.preventDefault();
    this.queue.push({
      source: "keyboard",
      action,
      at: performance.now(),
    });
  }

  consumeActions() {
    const actions = [...this.queue];
    this.queue.length = 0;
    return actions;
  }
}
