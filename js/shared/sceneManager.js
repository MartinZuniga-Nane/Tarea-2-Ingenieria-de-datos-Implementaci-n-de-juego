export class SceneManager {
  constructor(context = {}) {
    this.context = context;
    this.scenes = new Map();
    this.activeScene = null;
    this.activeKey = null;
    this.listeners = new Set();
  }

  register(key, scene) {
    this.scenes.set(key, scene);
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  change(key, payload) {
    this.activeScene?.exit?.();
    this.activeKey = key;
    this.activeScene = this.scenes.get(key);
    this.activeScene?.enter?.(payload);
    this.listeners.forEach((listener) => listener(this.activeScene, key));
  }

  update(dt) {
    this.activeScene?.update?.(dt);
  }

  render(p5) {
    this.activeScene?.render?.(p5);
  }

  handleAction(action) {
    this.activeScene?.handleAction?.(action);
  }

  destroy() {
    this.activeScene?.exit?.();
    this.scenes.clear();
    this.listeners.clear();
  }
}
