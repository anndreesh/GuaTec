import { authApi } from "@/api/authApi";
import { AuthStore } from "@/core/AuthStore";
import { el } from "@/core/dom";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";
import type { Credentials, ProviderInfo } from "@/types";
import { getLanguage, t } from "@/core/i18n";
import { API_BASE_URL } from "@/config/gameConfig";

/** Provider-choice screen: email/password, Google, GitHub, or Guest. */
export class AuthScreen implements Screen {
  private container: HTMLElement | null = null;
  private isRegistering = false;

  constructor(private app: GameApp) {}

  async mount(container: HTMLElement): Promise<void> {
    this.container = container;
    const panel = el("div", { className: "screen auth-screen" });
    panel.append(
      el("h2", { className: "screen-title", text: t("Selecciona cómo ingresar") }),
      this.createPasswordForm(),
      el("p", { className: "auth-divider", text: t("o continúa con") }),
      el("div", { className: "provider-list", attrs: { id: "provider-list" } }),
      this.createLegalLinks(),
    );
    container.append(panel);

    let providers: ProviderInfo[];
    try {
      const res = await authApi.listProviders();
      providers = res.providers;
    } catch {
      providers = [{ id: "guest", label: t("Invitado"), configured: true }];
    }

    const list = panel.querySelector("#provider-list")!;
    for (const provider of providers) {
      const button = el("button", {
        className: `btn provider-btn provider-${provider.id}`,
        text: provider.configured ? t(provider.label) : `${t(provider.label)} (${t("no configurado")})`,
        attrs: { type: "button" },
      });
      if (!provider.configured) {
        button.setAttribute("disabled", "true");
      } else {
        button.addEventListener("click", () => void this.handleProviderClick(provider.id));
      }
      list.append(button);
    }

    const pendingEmail = AuthStore.getPendingOAuthEmail();
    if (pendingEmail) {
      const form = panel.querySelector("form") as HTMLFormElement | null;
      if (!form) {
        AuthStore.clearPendingOAuthEmail();
      } else {
        const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
        const toggle = form.querySelector(".auth-toggle") as HTMLButtonElement | null;
        const confirmation = form.querySelector(".auth-confirm-password") as HTMLInputElement | null;
        const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
        if (emailInput) emailInput.value = pendingEmail;
        if (emailInput) emailInput.readOnly = true;
        this.isRegistering = true;
        if (toggle) toggle.hidden = true;
        if (confirmation) {
          confirmation.hidden = false;
          confirmation.required = true;
        }
        if (submit) submit.textContent = "Crear cuenta con este correo";
        panel.querySelector(".auth-divider")?.setAttribute("hidden", "true");
        panel.querySelector("#provider-list")?.setAttribute("hidden", "true");
        AuthStore.clearPendingOAuthEmail();
      }
    }
  }

  private createLegalLinks(): HTMLElement {
    const language = getLanguage();
    const labels = {
      es: ["Política de privacidad", "Términos y condiciones de uso", "Contacto"],
      en: ["Privacy policy", "Terms and conditions of use", "Contact"],
      fr: ["Politique de confidentialité", "Conditions d’utilisation", "Contact"],
    }[language];
    const navigationLabels = {
      es: "Información legal y contacto",
      en: "Legal information and contact",
      fr: "Informations légales et contact",
    };
    const pages = ["privacy", "terms", "contact"];
    const nav = el("nav", {
      className: "auth-legal-links",
      attrs: { "aria-label": navigationLabels[language] },
    });

    pages.forEach((page, index) => {
      const url = new URL("/legal.html", window.location.origin);
      url.searchParams.set("document", page);
      url.searchParams.set("lang", language);
      nav.append(
        el("a", {
          text: labels[index],
          attrs: {
            href: url.toString(),
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
      );
    });

    return nav;
  }

  private createPasswordForm(): HTMLElement {
    const form = el("form", { className: "auth-form" });
    const email = el("input", {
      className: "text-input",
      attrs: {
        type: "email",
        placeholder: t("Correo electrónico"),
        autocomplete: "email",
        required: "true",
      },
    });
    const password = el("input", {
      className: "text-input",
      attrs: {
        type: "password",
        placeholder: t("Contraseña"),
        autocomplete: "current-password",
        minlength: "8",
        required: "true",
      },
    });
    const confirmation = el("input", {
      className: "text-input auth-confirm-password",
      attrs: {
        type: "password",
        placeholder: t("Confirmar contraseña"),
        autocomplete: "new-password",
        minlength: "8",
        required: "true",
      },
    });
    const error = el("p", { className: "form-error", text: "" });
    const submit = el("button", {
      className: "btn btn-primary",
      text: t("Iniciar sesión"),
      attrs: { type: "submit" },
    });
    const toggle = el("button", {
      className: "btn btn-ghost auth-toggle",
      text: "Crear una cuenta",
      attrs: { type: "button" },
    });

    const updateMode = () => {
      confirmation.hidden = !this.isRegistering;
      confirmation.required = this.isRegistering;
      password.autocomplete = this.isRegistering ? "new-password" : "current-password";
      submit.textContent = t(this.isRegistering ? "Crear cuenta" : "Iniciar sesión");
      toggle.textContent = t(this.isRegistering ? "Ya tengo una cuenta" : "Crear una cuenta");
      error.textContent = "";
    };

    toggle.addEventListener("click", () => {
      this.isRegistering = !this.isRegistering;
      updateMode();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.handlePasswordSubmit(
        { email: email.value.trim(), password: password.value },
        confirmation.value,
        error,
        submit,
      );
    });

    form.append(email, password, confirmation, error, submit, toggle);
    updateMode();
    return form;
  }

  private async handlePasswordSubmit(
    credentials: Credentials,
    confirmation: string,
    error: HTMLElement,
    submit: HTMLButtonElement,
  ): Promise<void> {
    error.textContent = "";
    if (this.isRegistering && credentials.password !== confirmation) {
      error.textContent = "Las contraseñas no coinciden.";
      return;
    }

    submit.disabled = true;
    const isRegistering = this.isRegistering;
    try {
      const { token, user } = isRegistering
        ? await authApi.register(credentials)
        : await authApi.login(credentials);
      AuthStore.setToken(token);
      this.app.currentUser = user;
      if (isRegistering) {
        await this.app.showUsername();
      } else {
        await this.app.showMissionSelect();
      }
    } catch (err: unknown) {
      error.textContent = this.extractErrorMessage(err);
    } finally {
      submit.disabled = false;
    }
  }

  private async handleProviderClick(providerId: ProviderInfo["id"]): Promise<void> {
    if (providerId === "guest") {
      const { token, user } = await authApi.loginGuest();
      AuthStore.setToken(token);
      this.app.currentUser = user;
      await this.app.showUsername();
      return;
    }

    window.location.href = `${API_BASE_URL}/auth/${providerId}/login`;
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === "object" && "body" in err) {
      const body = (err as { body?: { message?: string } }).body;
      if (body?.message) return body.message;
    }
    return "No se pudo completar la autenticación. Intenta de nuevo.";
  }

  unmount(): void {
    this.container = null;
  }
}
