export class Modal {
  constructor(root) {
    this.root = root;
    this.dismiss = this.dismiss.bind(this);
  }

  show({ title, message, dismissLabel = "Cerrar", autoHideMs = 0 }) {
    this.hide();

    const el = document.createElement("div");
    el.className = "modal";
    el.innerHTML = `
      <div class="modal__card soft-panel">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal__actions">
          <button class="launcher-btn" type="button">${dismissLabel}</button>
        </div>
      </div>
    `;

    el.querySelector("button").addEventListener("click", this.dismiss);
    this.root.appendChild(el);
    this.element = el;

    if (autoHideMs > 0) {
      this.timeoutId = window.setTimeout(() => this.hide(), autoHideMs);
    }
  }

  dismiss() {
    this.hide();
  }

  hide() {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.element?.remove();
    this.element = null;
  }
}
