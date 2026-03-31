export function createGameSidebar({
  onNavigate,
  onBack,
} = {}) {
  const container = document.createElement("div");
  container.className = "game-sidebar";

  container.innerHTML = `
    <button class="game-sidebar__toggle" type="button" aria-expanded="false" aria-label="Abrir menu">
      Menu
    </button>
    <aside class="game-sidebar__panel" aria-hidden="true">
      <h3>Menu rapido</h3>
      <ul>
        <li><button type="button" data-action="back">Volver atras</button></li>
        <li><button type="button" data-action="launcher">Libreria</button></li>
        <li><button type="button" data-action="duel">Duel</button></li>
        <li><button type="button" data-action="ufro-volley">UfroVolley</button></li>
        <li><button type="button" data-action="ufro-ninja">Ufro Ninja</button></li>
        <li><button type="button" data-action="gravity-weaver">Gravity Weaver</button></li>
        <li><button type="button" data-action="close">Cerrar</button></li>
      </ul>
    </aside>
  `;

  const toggle = container.querySelector(".game-sidebar__toggle");
  const panel = container.querySelector(".game-sidebar__panel");

  const setOpen = (isOpen) => {
    container.classList.toggle("is-open", isOpen);
    toggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    panel?.setAttribute("aria-hidden", isOpen ? "false" : "true");
  };

  const handleToggle = () => {
    setOpen(!container.classList.contains("is-open"));
  };

  const handleClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    if (action === "close") {
      setOpen(false);
      return;
    }

    if (action === "back") {
      setOpen(false);
      onBack?.();
      return;
    }

    setOpen(false);
    onNavigate?.(action);
  };

  toggle?.addEventListener("click", handleToggle);
  panel?.addEventListener("click", handleClick);

  return {
    element: container,
    close: () => setOpen(false),
    destroy: () => {
      toggle?.removeEventListener("click", handleToggle);
      panel?.removeEventListener("click", handleClick);
      container.remove();
    },
  };
}
