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
          <p>Interfaz base para juegos web con canvas, escenas reutilizables y control por hand tracking.</p>
        </div>

        <section class="launcher__menu">
          <h2>Navegacion</h2>
          <p>La biblioteca queda lista para sumar mas proyectos sin romper el layout ni el router.</p>
          <ul>
            <li>Libreria</li>
            <li>Duel</li>
            <li>Gravity Weaver</li>
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
          meta: "p5.js + ml5.js + ES Modules",
          cover: "./assets/launcher/duel-cover.png",
          details: "Seleccion de personajes, fondos, combate por ventana de disparo y resultado con revancha.",
        },
        {
          id: "gravity-weaver",
          title: "Gravity Weaver",
          tag: "Nuevo puzzle",
          description: "Puzzle fisico neon donde manipulas la gravedad por poses de mano o con flechas como respaldo.",
          meta: "p5.js + ml5.js Teachable Machine",
          cover: "./assets/launcher/duel-cover.png",
          details: "Controla la gravedad en tiempo real para esquivar obstaculos y llegar al portal con inercia y rebotes.",
        },
      ],
      onPlay: (game) => this.router.navigate(game.id),
    });

    shell.querySelector(".launcher__content").appendChild(view.render());
    this.root.appendChild(shell);
    this.element = shell;
  }

  destroy() {
    this.element?.remove();
  }
}
