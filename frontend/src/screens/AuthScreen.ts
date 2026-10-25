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
      el("div", { className: "provider-list", attrs: { id: "provider-list" } }),
      el("p", { className: "auth-divider", text: t("o continúa con") }),
      this.createPasswordForm(),
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
        attrs: { type: "button" },
        children: [
          this.createProviderIcon(provider.id),
          el("span", {
            text: provider.configured ? t(`Continuar con ${provider.label}`) : `${t(provider.label)} (${t("no configurado")})`,
          }),
        ],
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
        if (submit) submit.textContent = t("Crear cuenta con este correo");
        panel.querySelector(".auth-divider")?.setAttribute("hidden", "true");
        panel.querySelector("#provider-list")?.setAttribute("hidden", "true");
        AuthStore.clearPendingOAuthEmail();
      }
    }
  }

  private createProviderIcon(providerId: ProviderInfo["id"]): HTMLElement {
    const icon = el("span", {
      className: `provider-icon provider-icon-${providerId}`,
      attrs: { "aria-hidden": "true" },
    });

    if (providerId === "google") {
      icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z"/><path fill="#34A853" d="M12 21.7c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.7Z"/><path fill="#FBBC05" d="M6.54 13.78a5.85 5.85 0 0 1 0-3.56V7.69H3.3a9.75 9.75 0 0 0 0 8.62l3.24-2.53Z"/><path fill="#EA4335" d="M12 6.19c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.18 14.63 2.3 12 2.3a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.91 9.46 6.19 12 6.19Z"/></svg>';
    } else if (providerId === "github") {
      icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 2.35a9.7 9.7 0 0 0-3.07 18.9c.49.09.67-.21.67-.47v-1.67c-2.73.59-3.3-1.16-3.3-1.16-.45-1.13-1.1-1.43-1.1-1.43-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.88 1.5 2.3 1.07 2.86.82.09-.64.34-1.07.62-1.31-2.18-.25-4.47-1.09-4.47-4.85 0-1.07.38-1.94 1.01-2.62-.1-.25-.44-1.24.1-2.58 0 0 .82-.26 2.67 1a9.27 9.27 0 0 1 4.86 0c1.85-1.26 2.67-1 2.67-1 .54 1.34.2 2.33.1 2.58.63.68 1.01 1.55 1.01 2.62 0 3.77-2.3 4.6-4.48 4.84.35.3.66.88.66 1.78v2.64c0 .26.18.57.68.47A9.7 9.7 0 0 0 12 2.35Z"/></svg>';
    } else {
      icon.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 20c.55-3.1 2.78-4.8 6.5-4.8s5.95 1.7 6.5 4.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8"/></svg>';
    }

    return icon;
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
      text: t("Crear una cuenta"),
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
      error.textContent = t("Las contraseñas no coinciden.");
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
    return t("No se pudo completar la autenticación. Intenta de nuevo.");
  }

  unmount(): void {
    this.container = null;
  }
}
