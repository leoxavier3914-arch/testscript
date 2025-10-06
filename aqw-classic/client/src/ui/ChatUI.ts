import { on, sendChat, requestJoinMap, requestEquip, requestUnequip } from "../net/connection";

export default class ChatUI {
  private container: HTMLDivElement;
  private log: HTMLDivElement;
  private input: HTMLInputElement;
  private button: HTMLButtonElement;
  private unlisten: (() => void)[] = [];

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "chat-container";
    this.log = document.createElement("div");
    this.log.className = "chat-log";
    this.input = document.createElement("input");
    this.input.placeholder = "Digite uma mensagem ou comando...";
    this.button = document.createElement("button");
    this.button.textContent = "Enviar";

    const inputRow = document.createElement("div");
    inputRow.className = "chat-input";
    inputRow.append(this.input, this.button);
    this.container.append(this.log, inputRow);
    document.body.appendChild(this.container);

    this.button.addEventListener("click", () => this.handleSubmit());
    this.input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.handleSubmit();
      }
    });

    this.unlisten.push(
      on("chat", (payload) => {
        this.appendMessage(`${payload.from}: ${payload.text}`);
      })
    );

    this.unlisten.push(
      on("error", (message) => {
        this.appendMessage(`⚠️ ${message}`);
      })
    );
  }

  appendMessage(message: string) {
    const div = document.createElement("div");
    div.textContent = message;
    this.log.appendChild(div);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private handleSubmit() {
    const text = this.input.value.trim();
    if (!text) return;

    if (text.startsWith("/")) {
      this.processCommand(text.slice(1));
    } else {
      sendChat(text);
    }

    this.input.value = "";
  }

  private processCommand(command: string) {
    const [cmd, ...rest] = command.split(" ");
    switch (cmd) {
      case "join":
        if (rest[0]) {
          requestJoinMap(rest[0]);
          this.appendMessage(`➡️ Mudando para o mapa ${rest[0]}...`);
        }
        break;
      case "equip":
        if (rest[0]) {
          requestEquip(rest[0]);
        }
        break;
      case "unequip":
        requestUnequip();
        break;
      default:
        this.appendMessage(`Comando desconhecido: /${cmd}`);
    }
  }

  destroy() {
    this.unlisten.forEach((fn) => fn());
    this.container.remove();
  }
}
