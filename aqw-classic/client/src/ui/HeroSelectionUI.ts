import { CHARACTER_CLASSES } from "../config/characters";
import type { CharacterClassDefinition } from "../config/characters";
import type { PlayerClassId } from "../types";

interface HeroSelectionOptions {
  defaultName: string;
  defaultClass: PlayerClassId;
}

export interface HeroProfileSelection {
  name: string;
  classId: PlayerClassId;
}

export default class HeroSelectionUI {
  private container: HTMLDivElement;
  private form: HTMLFormElement;
  private nameInput: HTMLInputElement;
  private errorLabel: HTMLDivElement;
  private classButtons = new Map<PlayerClassId, HTMLButtonElement>();
  private selectedClass: PlayerClassId;
  private pendingPromise: Promise<HeroProfileSelection> | null = null;
  private resolveSelection: ((selection: HeroProfileSelection) => void) | null = null;

  constructor(options: HeroSelectionOptions) {
    this.selectedClass = options.defaultClass;
    this.container = document.createElement("div");
    this.container.className = "hero-setup-overlay";

    this.form = document.createElement("form");
    this.form.className = "hero-setup-card";

    const title = document.createElement("h1");
    title.textContent = "Escolha seu herói";

    const description = document.createElement("p");
    description.className = "hero-setup-description";
    description.textContent = "Defina um nome e selecione a classe antes de entrar no mundo.";

    const nameLabel = document.createElement("label");
    nameLabel.className = "hero-setup-label";
    nameLabel.textContent = "Nome do herói";

    this.nameInput = document.createElement("input");
    this.nameInput.type = "text";
    this.nameInput.maxLength = 16;
    this.nameInput.value = options.defaultName;
    this.nameInput.placeholder = "3-16 caracteres alfanuméricos";
    this.nameInput.className = "hero-setup-input";

    nameLabel.appendChild(this.nameInput);

    const classLabel = document.createElement("span");
    classLabel.className = "hero-setup-label";
    classLabel.textContent = "Classe";

    const classContainer = document.createElement("div");
    classContainer.className = "hero-setup-classes";

    (Object.values(CHARACTER_CLASSES) as CharacterClassDefinition[]).forEach((definition) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hero-setup-class";
      button.dataset.classId = definition.id;
      button.innerHTML = `<strong>${definition.displayName}</strong><span>${definition.id}</span>`;
      if (definition.id === this.selectedClass) {
        button.classList.add("selected");
      }
      button.addEventListener("click", () => {
        this.setSelectedClass(definition.id);
      });
      this.classButtons.set(definition.id, button);
      classContainer.appendChild(button);
    });

    this.errorLabel = document.createElement("div");
    this.errorLabel.className = "hero-setup-error";

    const actions = document.createElement("div");
    actions.className = "hero-setup-actions";

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "hero-setup-submit";
    submitButton.textContent = "Entrar";

    actions.appendChild(submitButton);

    this.form.append(
      title,
      description,
      nameLabel,
      classLabel,
      classContainer,
      this.errorLabel,
      actions
    );
    this.container.appendChild(this.form);
    document.body.appendChild(this.container);

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleSubmit();
    });

    this.nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.handleSubmit();
      }
    });

    this.container.classList.add("hidden");
  }

  prompt(): Promise<HeroProfileSelection> {
    if (!this.pendingPromise) {
      this.pendingPromise = new Promise<HeroProfileSelection>((resolve) => {
        this.resolveSelection = resolve;
      });
    }
    this.container.classList.remove("hidden");
    this.errorLabel.textContent = "";
    this.nameInput.focus();
    this.nameInput.select();
    return this.pendingPromise;
  }

  showError(message: string) {
    this.errorLabel.textContent = message;
    this.container.classList.remove("hidden");
    this.nameInput.focus();
    this.nameInput.select();
  }

  destroy() {
    this.container.remove();
    this.classButtons.clear();
    this.pendingPromise = null;
    this.resolveSelection = null;
  }

  private handleSubmit() {
    const sanitizedName = this.sanitizeName(this.nameInput.value);
    if (sanitizedName.length < 3) {
      this.errorLabel.textContent = "Use ao menos 3 caracteres alfanuméricos.";
      return;
    }
    this.nameInput.value = sanitizedName;
    const resolve = this.resolveSelection;
    this.pendingPromise = null;
    this.resolveSelection = null;
    this.container.classList.add("hidden");
    resolve?.({ name: sanitizedName, classId: this.selectedClass });
  }

  private setSelectedClass(classId: PlayerClassId) {
    this.selectedClass = classId;
    this.classButtons.forEach((button, id) => {
      if (id === classId) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }
    });
  }

  private sanitizeName(raw: string) {
    return raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  }
}
