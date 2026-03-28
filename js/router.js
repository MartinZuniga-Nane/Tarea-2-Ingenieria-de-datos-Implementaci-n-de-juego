import { LauncherApp } from "./launcher/launcherApp.js";

export class Router {
  constructor(root) {
    this.root = root;
    this.currentView = null;
  }

  async start() {
    await this.navigate("launcher");
  }

  async navigate(route, payload = {}) {
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
}
