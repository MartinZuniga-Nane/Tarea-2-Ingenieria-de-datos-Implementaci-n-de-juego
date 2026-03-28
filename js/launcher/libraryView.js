import { createGameCard } from "./gameCard.js";

export class LibraryView {
  constructor({ games, onPlay }) {
    this.games = games;
    this.onPlay = onPlay;
  }

  render() {
    const section = document.createElement("section");
    section.className = "library";

    section.innerHTML = `
      <div class="library__veil"></div>
      <header class="library__header">
        <div>
          <div class="pill">Coleccion activa</div>
          <h2>Libreria</h2>
          <p>Launcher modular preparado para sumar nuevos juegos sin tocar el flujo principal.</p>
        </div>
        <div class="pill">${this.games.length} juego disponible</div>
      </header>
      <div class="library__grid"></div>
    `;

    const grid = section.querySelector(".library__grid");
    this.games.forEach((game) => {
      grid.appendChild(createGameCard(game, this.onPlay));
    });

    return section;
  }
}
