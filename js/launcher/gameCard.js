export function createGameCard(game, onPlay) {
  const article = document.createElement("article");
  article.className = "game-card";

  article.innerHTML = `
    <div class="game-card__media" style="background-image:url('${game.cover}')"></div>
    <div class="game-card__body">
      <div class="pill">${game.tag}</div>
      <div class="game-card__copy">
        <h3>${game.title}</h3>
        <p>${game.description}</p>
      </div>
      <div class="game-card__meta">${game.meta}</div>
      <div class="game-card__actions">
        <button class="launcher-btn" type="button">Jugar</button>
        <button class="launcher-btn--ghost" type="button">Detalles</button>
      </div>
    </div>
  `;

  article.querySelector(".launcher-btn").addEventListener("click", () => onPlay(game));
  article.querySelector(".launcher-btn--ghost").addEventListener("click", () => {
    window.alert(game.details);
  });

  return article;
}
