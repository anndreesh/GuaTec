import { userApi } from "@/api/userApi";
import { AuthStore } from "@/core/AuthStore";
import { el } from "@/core/dom";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";
import { t } from "@/core/i18n";

/** Username setup screen, shown once right after auth (any provider). */
export class UsernameScreen implements Screen {
  mount(container: HTMLElement): void {
    const panel = el("div", { className: "screen username-screen" });
    const input = el("input", {
      className: "text-input",
      attrs: { type: "text", placeholder: t("Tu nombre de comandante"), maxlength: "20" },
    });
    const error = el("p", { className: "form-error", text: "" });
    const submit = el("button", { className: "btn btn-primary", text: t("Confirmar"), attrs: { type: "button" } });

    panel.append(
      el("h2", { className: "screen-title", text: t("Elige tu nombre de usuario") }),
      el("p", { className: "screen-subtitle", text: t("3-20 caracteres: letras, números, guiones.") }),
      input,
      error,
      submit,
    );
    container.append(panel);

    const cached = AuthStore.getCachedUsername();
    if (cached) input.value = cached;

    const submitHandler = async () => {
      error.textContent = "";
      const username = input.value.trim();
      try {
        const user = await userApi.setUsername(username);
        AuthStore.setCachedUsername(username);
        this.app.currentUser = user;
        await this.app.showMissionSelect();
      } catch (err: unknown) {
        error.textContent = this.extractErrorMessage(err);
      }
    };

    submit.addEventListener("click", () => void submitHandler());
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") void submitHandler();
    });
  }

  constructor(private app: GameApp) {}

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "body" in err) {
      const body = (err as { body?: { message?: string } }).body;
      if (body?.message) return body.message;
    }
    return "No se pudo guardar el nombre de usuario. Intenta de nuevo.";
  }

  unmount(): void {
    /* no external listeners/timers to clean up */
  }
}
