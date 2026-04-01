import { LibraryView } from "./libraryView.js";

export class LauncherApp {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
  }

  mount() {
    const shell = document.createElement("main");
    shell.className = "launcher app-shell";

    shell.innerHTML = `
      <aside class="launcher__sidebar">
        <div class="launcher__brand">
          <div class="pill">Arcade Library</div>
          <h1>Tu galeria de duelos gestuales</h1>
        </div>

        <section class="launcher__menu">
          <h2>Navegacion</h2>
          <ul>
            <li><button class="launcher__menu-btn is-active" type="button" data-route="launcher">Libreria</button></li>
            <li><button class="launcher__menu-btn" type="button" data-route="duel">Duel</button></li>
            <li><button class="launcher__menu-btn" type="button" data-route="ufro-ninja">Ufro Ninja</button></li>
            <li><button class="launcher__menu-btn" type="button" data-route="gravity-weaver">Gravity Weaver</button></li>
          </ul>
        </section>
      </aside>

      <section class="launcher__content"></section>
    `;

    const view = new LibraryView({
      games: [
        {
          id: "duel",
          title: "Duel",
          tag: "Juego principal",
          description: "Duelo 1v1 con seleccion por gestos, flujo de combate por estados y soporte de teclado para debug.",
          cover: "./assets/launcher/duel-cover.png",
        },
        {
          id: "gravity-weaver",
          title: "Gravity Weaver",
          tag: "Nuevo puzzle",
          description: "Puzzle fisico neon donde manipulas la gravedad por poses de mano o con flechas como respaldo.",
          cover: "./assets/games/gravityWeaver/backgrounds/BG1.png",
        },
        {
          id: "ufro-ninja",
          title: "Ufro Ninja",
          tag: "Arcade IA",
          description: "Arcade estilo fruit ninja por gestos con clasificador de Teachable Machine y camara en vivo.",
          meta: "p5.js + ml5.js imageClassifier",
          cover: "./assets/launcher/duel-cover.png",
          details: "Corta frutas con gesto de ataque, evita perder vidas y mejora tu puntaje en dificultad progresiva.",
        },
      ],
      onPlay: (game) => this.router.navigate(game.id),
    });

    shell.querySelector(".launcher__content").appendChild(view.render());

    this.menuClickHandler = (event) => {
      const button = event.target.closest(".launcher__menu-btn");
      if (!button) {
        return;
      }

      const route = button.dataset.route;
      if (!route) {
        return;
      }

      this.router.navigate(route);
    };

    shell.querySelector(".launcher__menu")?.addEventListener("click", this.menuClickHandler);

    this.root.appendChild(shell);
    this.element = shell;
  }

  destroy() {
    this.element?.querySelector(".launcher__menu")?.removeEventListener("click", this.menuClickHandler);
    this.element?.remove();
  }
}
