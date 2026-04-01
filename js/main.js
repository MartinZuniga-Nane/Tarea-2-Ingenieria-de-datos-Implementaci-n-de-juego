import { Router } from "./router.js";

async function bootstrap() {
  const appRoot = document.getElementById("app");

  try {
    const router = new Router(appRoot);
    await router.start();
  } catch (error) {
    appRoot.innerHTML = `
      <main class="app-shell" style="display:grid;place-items:center;padding:2rem;">
        <section class="soft-panel" style="padding:2rem;max-width:560px;">
          <h1 style="margin-top:0;font-family:'Space Grotesk',sans-serif;">No se pudo iniciar Arcade Library</h1>
          <p style="color:var(--text-soft);">${error.message}</p>
        </section>
      </main>
    `;
    console.error(error);
  }
}

bootstrap();
