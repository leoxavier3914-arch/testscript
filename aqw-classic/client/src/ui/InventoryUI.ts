export default class InventoryUI {
  private container: HTMLDivElement;
  private list: HTMLUListElement;
  private emptyState: HTMLDivElement;
  private equippedLabel: HTMLDivElement;
  private isOpen = false;
  private lastItems: string[] = [];
  private lastEquipped?: string;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "inventory-panel hidden";

    const header = document.createElement("div");
    header.className = "inventory-header";
    header.innerHTML = `<strong>Mochila</strong><span>(pressione \"I\" para alternar)</span>`;

    this.equippedLabel = document.createElement("div");
    this.equippedLabel.className = "inventory-equipped";
    this.equippedLabel.textContent = "Equipado: Nenhum";

    this.list = document.createElement("ul");
    this.list.className = "inventory-list";

    this.emptyState = document.createElement("div");
    this.emptyState.className = "inventory-empty";
    this.emptyState.textContent = "Inventário vazio.";

    this.container.append(header, this.equippedLabel, this.list, this.emptyState);
    document.body.appendChild(this.container);
  }

  toggle() {
    this.setOpen(!this.isOpen);
  }

  setOpen(open: boolean) {
    this.isOpen = open;
    if (this.isOpen) {
      this.container.classList.remove("hidden");
    } else {
      this.container.classList.add("hidden");
    }
  }

  setItems(items: string[], equipped?: string) {
    if (this.areItemsEqual(items, this.lastItems) && this.lastEquipped === equipped) {
      return;
    }
    this.lastItems = [...items];
    this.lastEquipped = equipped;

    this.equippedLabel.textContent = `Equipado: ${equipped ?? "Nenhum"}`;

    this.list.innerHTML = "";
    if (items.length === 0) {
      this.list.classList.add("hidden");
      this.emptyState.classList.remove("hidden");
      return;
    }

    this.list.classList.remove("hidden");
    this.emptyState.classList.add("hidden");

    items.forEach((itemId) => {
      const li = document.createElement("li");
      li.textContent = itemId;
      if (itemId === equipped) {
        li.classList.add("equipped");
      }
      this.list.appendChild(li);
    });
  }

  destroy() {
    this.container.remove();
  }

  private areItemsEqual(a: string[], b: string[]) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => value === b[index]);
  }
}
