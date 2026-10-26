import { missionsApi } from "@/api/missionsApi";
import { nasaApi } from "@/api/nasaApi";
import { el, loadingFeedback } from "@/core/dom";
import { MISSION_SLUGS } from "@/config/gameConfig";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";
import type { MissionDTO } from "@/types";
import type { NasaMissionBriefing } from "@/types";
import { getLanguage, t } from "@/core/i18n";

const STATUS_LABEL: Record<MissionDTO["status"], string> = {
  locked: "Bloqueada",
  unlocked: "Disponible",
  in_progress: "En progreso",
  completed: "Completada",
};

/** Formats an RSS (RFC 822) or ISO date string into a readable Spanish date. */
function formatStoryDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const locale = { es: "es-ES", en: "en-US", fr: "fr-FR" }[getLanguage()];
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

/** Mission carousel: shows the 3 missions with lock state and progress. */
export class MissionSelectScreen implements Screen {
  private nasaCarouselTimer: number | undefined;
  constructor(private app: GameApp) {}

  async mount(container: HTMLElement): Promise<void> {
    const panel = el("div", { className: "screen mission-select-screen" });
    const header = el("div", { className: "mission-select-header" });
    const actions = el("div", { className: "mission-select-actions" });
    actions.append(
      el("button", { className: "btn btn-ghost", text: t("Cerrar sesión"), attrs: { type: "button" } }),
    );
    header.append(
      el("h2", {
        className: "screen-title",
        text: `${t("Comandante")} ${this.app.currentUser?.username ?? ""}`,
      }),
      actions,
    );
    actions.querySelector("button")!.addEventListener("click", () => this.app.logout());

    const carousel = el("div", { className: "mission-carousel", attrs: { id: "mission-carousel" } });
    const loading = loadingFeedback(t("Cargando..."));
    panel.append(header, loading, carousel);
    container.append(panel);

    let missions: MissionDTO[] = [];
    try {
      const res = await missionsApi.list();
      missions = res.missions;
    } catch {
      loading.remove();
      carousel.append(el("p", { className: "form-error", text: t("No se pudo conectar con el servidor.") }));
      return;
    }
    loading.remove();

    for (const mission of missions) {
      const locked = mission.status === "locked";
      const card = el("div", { className: `mission-card ${locked ? "mission-card--locked" : ""}` });
      card.append(
        el("h3", { className: "mission-card-title", text: mission.slug === MISSION_SLUGS.mission1 ? "Misión 01: Apollo 11" : t(mission.title) }),
        el("p", { className: "mission-card-subtitle", text: mission.slug === MISSION_SLUGS.mission1 ? "El comienzo de una nueva era · 16 de julio de 1969" : t(mission.subtitle ?? "") }),
        el("p", { className: "mission-card-description", text: mission.slug === MISSION_SLUGS.mission1 ? "Kennedy Space Center. Completa operaciones de apoyo, observa el traslado de la tripulación y presencia el lanzamiento del Saturn V." : t(mission.description ?? "") }),
        el("div", { className: "mission-card-status", text: t(STATUS_LABEL[mission.status]) }),
      );

      if (mission.progressPercent > 0 && mission.progressPercent < 100) {
        const bar = el("div", { className: "progress-bar" });
        const fill = el("div", { className: "progress-bar-fill" });
        fill.style.width = `${mission.progressPercent}%`;
        bar.append(fill);
        card.append(bar);
      }

      if (!locked && mission.slug === MISSION_SLUGS.mission1) {
        card.addEventListener("click", () => void this.app.showMission1());
      } else if (!locked) {
        card.append(el("p", { className: "mission-card-note", text: t("Disponible próximamente en esta demo.") }));
      }

      carousel.append(card);
    }

    try {
      const briefing = await nasaApi.missionBriefing();
      this.renderNasaBriefing(panel, briefing);
    } catch (error) {
      console.warn("NASA mission briefing is currently unavailable.", error);
    }
  }

  private renderNasaBriefing(panel: HTMLElement, briefing: NasaMissionBriefing): void {
    const stories = briefing.stories.length > 0
      ? briefing.stories
      : briefing.apod.title || briefing.apod.explanation || briefing.apod.imageUrl
        ? [{
          kind: "APOD",
          title: briefing.apod.title,
          summary: briefing.apod.explanation,
          date: briefing.apod.date,
          imageUrl: briefing.apod.imageUrl,
          sourceUrl: briefing.apod.url,
        }]
        : [];
    if (stories.length === 0) return;
    const card = el("section", { className: "nasa-briefing nasa-carousel" });
    const viewport = el("div", {
      className: "nasa-carousel-viewport",
      attrs: { role: "group", "aria-label": t("Carrusel de reportes NASA"), tabindex: "0" },
    });
    const track = el("div", { className: "nasa-carousel-track" });
    const dots = el("div", { className: "nasa-carousel-dots" });
    let activeIndex = 0;

    const renderSlide = (index: number) => {
      activeIndex = (index + stories.length) % stories.length;
      track.innerHTML = "";
      const story = stories[activeIndex];
      const sourceTitle = story.title ? t(story.title) : "";
      const titleText = sourceTitle && (sourceTitle !== story.title || getLanguage() === "en")
        ? sourceTitle
        : t("Actualización de NASA");
      const sourceSummary = story.summary ? t(story.summary) : "";
      const summaryText = sourceSummary && (sourceSummary !== story.summary || getLanguage() === "en")
        ? sourceSummary
        : t("Abre la fuente de NASA para consultar los detalles.");
      const images = story.images && story.images.length > 0
        ? story.images
        : story.imageUrl
          ? [story.imageUrl]
          : [];
      track.classList.toggle("nasa-carousel-track--text-only", images.length === 0);

      if (images.length > 0) {
        const media = el("div", { className: "nasa-briefing-media" });
        const mainImg = el("img", {
          className: "nasa-briefing-image",
          attrs: { src: images[0], alt: titleText || t("Imagen NASA"), loading: "lazy" },
        }) as HTMLImageElement;
        media.append(story.sourceUrl
          ? el("a", { attrs: { href: story.sourceUrl, target: "_blank", rel: "noreferrer" }, children: [mainImg] })
          : mainImg);

        if (images.length > 1) {
          const gallery = el("div", { className: "nasa-briefing-gallery" });
          images.forEach((src, thumbIndex) => {
            const thumb = el("img", {
              className: `nasa-briefing-thumb${thumbIndex === 0 ? " active" : ""}`,
              attrs: { src, alt: `Imagen relacionada ${thumbIndex + 1}`, loading: "lazy" },
            }) as HTMLImageElement;
            thumb.addEventListener("click", () => {
              mainImg.src = src;
              gallery.querySelectorAll(".nasa-briefing-thumb").forEach((node) => node.classList.remove("active"));
              thumb.classList.add("active");
            });
            gallery.append(thumb);
          });
          media.append(gallery);
        }
        track.append(media);
      }

      const copy = el("div", { className: "nasa-briefing-copy" });
      copy.append(
        el("p", { className: "nasa-kicker", text: `${t(story.kind)} · ${t("DATOS NASA EN TIEMPO REAL")}` }),
        story.sourceUrl
          ? el("h3", { className: "nasa-briefing-title", children: [
            el("a", {
              className: "nasa-briefing-title-link",
              text: titleText,
              attrs: { href: story.sourceUrl, target: "_blank", rel: "noreferrer" },
            }),
          ] })
          : el("h3", { className: "nasa-briefing-title", text: titleText }),
      );
      const dateLabel = formatStoryDate(story.date);
      if (dateLabel) {
        copy.append(el("p", { className: "nasa-briefing-date", text: `🗓️ Publicado el ${dateLabel}` }));
      }
      copy.append(
        el("p", { className: "nasa-briefing-description", text: summaryText || t("Abre la fuente de NASA para consultar los detalles.") }),
      );
      if (story.sourceUrl) {
        copy.append(el("a", {
          className: "nasa-story-link",
          text: t("Abrir investigación ↗"),
          attrs: { href: story.sourceUrl, target: "_blank", rel: "noreferrer" },
        }));
      }
      track.append(copy);
      dots.querySelectorAll("button").forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === activeIndex);
      });
    };

    const previous = el("button", { className: "nasa-carousel-control", text: "‹", attrs: { type: "button", "aria-label": t("Historia anterior") } });
    const next = el("button", { className: "nasa-carousel-control", text: "›", attrs: { type: "button", "aria-label": t("Siguiente historia") } });
    previous.addEventListener("click", () => renderSlide(activeIndex - 1));
    next.addEventListener("click", () => renderSlide(activeIndex + 1));
    let swipeStart: { x: number; y: number } | null = null;
    viewport.addEventListener("pointerdown", (event) => {
      swipeStart = { x: event.clientX, y: event.clientY };
    });
    viewport.addEventListener("pointerup", (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      renderSlide(activeIndex + (dx < 0 ? 1 : -1));
    });
    viewport.addEventListener("pointercancel", () => { swipeStart = null; });
    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") renderSlide(activeIndex - 1);
      if (event.key === "ArrowRight") renderSlide(activeIndex + 1);
    });
    stories.forEach((_, index) => {
      const dot = el("button", { className: "nasa-carousel-dot", text: "", attrs: { type: "button", "aria-label": `Historia ${index + 1}` } });
      dot.addEventListener("click", () => renderSlide(index));
      dots.append(dot);
    });
    viewport.append(previous, track, next);
    card.append(
      el("div", { className: "nasa-carousel-heading", }, ),
      viewport,
      dots,
    );
    card.querySelector(".nasa-carousel-heading")!.append(
      el("p", { className: "nasa-kicker", text: t("CENTRO DE INTELIGENCIA · NASA") }),
      el("span", { className: "nasa-carousel-counter", text: `${stories.length} ${t("reportes disponibles")}` }),
    );
    renderSlide(0);
    this.nasaCarouselTimer = window.setInterval(() => renderSlide(activeIndex + 1), 9000);
    panel.insertBefore(card, panel.querySelector("#mission-carousel"));
  }

  unmount(): void {
    if (this.nasaCarouselTimer !== undefined) window.clearInterval(this.nasaCarouselTimer);
  }
}
