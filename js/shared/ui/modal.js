export class Modal {
  constructor(root) {
    this.root = root;
  }

  show({ title, message }) {
    this.hide();

    const el = document.createElement("div");
    el.className = "modal";
    el.innerHTML = `
      <div class="modal__card soft-panel">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;

    this.root.appendChild(el);
    this.element = el;
  }

  hide() {
    this.element?.remove();
    this.element = null;
  }
}
