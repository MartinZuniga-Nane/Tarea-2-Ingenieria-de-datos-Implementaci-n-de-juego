import { LauncherApp } from "./launcher/launcherApp.js";

export class Router {
  constructor(root) {
    this.root = root;
    this.currentView = null;
    this.currentRoute = null;
    this.currentPayload = {};
    this.routeHistory = [];
  }

  async start() {
    await this.navigate("launcher", {}, { fromBack: true });
  }

  async navigate(route, payload = {}, options = {}) {
    const { fromBack = false } = options;

    if (!fromBack && this.currentRoute && this.currentRoute !== route) {
      this.routeHistory.push({
        route: this.currentRoute,
        payload: this.currentPayload,
      });
    }

    this.currentRoute = route;
    this.currentPayload = payload;

    this.currentView?.destroy?.();
    this.root.innerHTML = "";

    try {
      if (route === "duel") {
        const { DuelGame } = await import("./games/duel/duelGame.js");
        this.currentView = new DuelGame({
          root: this.root,
          router: this,
          payload,
        });
      } else if (route === "ufro-ninja") {
        const { UfroNinjaScene } = await import("./games/ufroNinja/ufroNinjaScene.js");
        this.currentView = new UfroNinjaScene({
          root: this.root,
          router: this,
          payload,
        });
      } else if (route === "gravity-weaver") {
        const { GravityWeaverScene } = await import("./games/gravityWeaver/gravityWeaverScene.js");
        this.currentView = new GravityWeaverScene({
          root: this.root,
          router: this,
          payload,
        });
      } else {
        this.currentView = new LauncherApp({
          root: this.root,
          router: this,
        });
      }

      this.currentView.mount();
    } catch (error) {
      this.root.innerHTML = `
        <main class="app-shell" style="display:grid;place-items:center;padding:2rem;">
          <section class="soft-panel" style="padding:2rem;max-width:620px;">
            <h1 style="margin-top:0;font-family:'Space Grotesk',sans-serif;">No se pudo abrir la vista</h1>
            <p style="color:var(--text-soft);">${error.message}</p>
          </section>
        </main>
      `;
      console.error(error);
    }
  }

  async back() {
    const previous = this.routeHistory.pop();
    if (!previous) {
      await this.navigate("launcher", {}, { fromBack: true });
      return;
    }

    await this.navigate(previous.route, previous.payload ?? {}, { fromBack: true });
  }
}
