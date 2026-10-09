import { progressApi } from "@/api/progressApi";
import { samplesApi } from "@/api/samplesApi";
import { RESOURCE_DEFINITIONS } from "@/config/gameConfig";
import { el } from "@/core/dom";
import type { GameApp } from "@/core/GameApp";
import type { Screen } from "@/screens/Screen";
import type { MissionReport, SampleDTO } from "@/types";
import { t } from "@/core/i18n";

const OUTCOME_LABEL: Record<MissionReport["outcome"], string> = {
  success: "Éxito",
  partial: "Éxito parcial",
  failure: "Fallo",
};

/** End-of-mission report: outcome, final resources, samples collected. */
export class ReportScreen implements Screen {
  constructor(
    private app: GameApp,
    private missionSlug: string,
  ) {}

  async mount(container: HTMLElement): Promise<void> {
    const panel = el("div", { className: "screen report-screen" });
    panel.append(el("h2", { className: "screen-title", text: t("Informe de misión") }));
    container.append(panel);

    let report: MissionReport | null = null;
    try {
      const progress = await progressApi.get(this.missionSlug);
      report = progress.report;
    } catch {
      /* ignore, render whatever we can */
    }

    if (!report) {
      panel.append(el("p", { text: t("No se encontró un informe para esta misión.") }));
    } else {
      panel.append(
        el("div", { className: `outcome-badge outcome-badge--${report.outcome}`, text: t(OUTCOME_LABEL[report.outcome]) }),
        el("p", { className: "report-summary", text: report.summary }),
        el("h3", { className: "report-subtitle", text: t("Recursos finales") }),
      );

      const resourceList = el("div", { className: "report-resource-list" });
      for (const def of RESOURCE_DEFINITIONS) {
        resourceList.append(
          el("div", {
            className: "report-resource-item",
            text: `${def.label}: ${Math.round(report.finalResources[def.key] ?? 0)} ${def.unit}`,
          }),
        );
      }
      panel.append(resourceList);

      if (report.flightResult) {
        panel.append(
          el("h3", { className: "report-subtitle", text: t("Resultado del vuelo") }),
          el("p", { text: `${t("Resultado")}: ${report.flightResult.replace(/-/g, " ").toUpperCase()}` }),
          el("p", { text: `${t("Recovered data")}: ${Math.round(report.dataRecovered ?? 0)}%` }),
        );
      }
      if (report.engineeringConfiguration) {
        const design = report.engineeringConfiguration;
        panel.append(
          el("h3", { className: "report-subtitle", text: t("Configuración de ingeniería") }),
          el("p", { text: `${t("Structure")}: ${design.structure} · ${t("Instrumentation")}: ${design.instrumentation}` }),
          el("p", { text: `${t("Testing decision")}: ${design.testResponse ?? t("Not recorded")} · ${t("Launch decision")}: ${design.launchDecision ?? t("Not recorded")}` }),
        );
      }
      if (report.historicalRecords?.length) {
        panel.append(el("h3", { className: "report-subtitle", text: t("Mission log · historical records") }));
        const records = el("ul", { className: "mission-objective-list" });
        report.historicalRecords.forEach((record) => records.append(el("li", { text: record })));
        panel.append(records);
      }
      panel.append(
        el("h3", { className: "report-subtitle", text: t("Historical reference · March 16, 1926") }),
        el("p", { text: t("In Auburn, Massachusetts, the first liquid-fuel rocket flight reached approximately 41 feet (12.5 m) and traveled about 184 feet (56 m). Its importance was demonstrating flight, not reaching space. Your team's story and this simulation's outcome are fictional.") }),
      );

      panel.append(
        el("h3", { className: "report-subtitle", text: t("Estadísticas") }),
        el("p", { text: `${t("Ciclos de preparación completados")}: ${report.ticksSurvived}` }),
        el("p", { text: `${t("Decisiones tomadas")}: ${report.decisionsMade}` }),
        el("p", { text: `Muestras recolectadas: ${report.samplesCollected}` }),
      );
    }

    let samples: SampleDTO[] = [];
    try {
      const res = await samplesApi.list();
      samples = res.samples;
    } catch {
      /* ignore */
    }
    if (samples.length > 0) {
      panel.append(el("h3", { className: "report-subtitle", text: t("Muestras en tu colección") }));
      const sampleList = el("div", { className: "sample-list" });
      for (const sample of samples) {
        sampleList.append(
          el("div", {
            className: "sample-item",
            text: `${sample.label} (${sample.type}, calidad ${(sample.quality * 100).toFixed(0)}%)`,
          }),
        );
      }
      panel.append(sampleList);
    }

    const backButton = el("button", { className: "btn btn-primary", text: t("Volver a misiones"), attrs: { type: "button" } });
    backButton.addEventListener("click", () => void this.app.showMissionSelect());
    panel.append(backButton);

    const replayButton = el("button", {
      className: "btn btn-secondary report-replay-button",
      text: t("Repetir misión"),
      attrs: { type: "button" },
    });
    replayButton.addEventListener("click", async () => {
      replayButton.disabled = true;
      replayButton.textContent = t("Preparando misión...");
      try {
        await progressApi.replay(this.missionSlug);
        await this.app.showMission1();
      } catch {
        replayButton.disabled = false;
        replayButton.textContent = t("No se pudo reiniciar. Intentar de nuevo");
      }
    });
    panel.append(replayButton);
  }

  unmount(): void {
    /* no external listeners/timers to clean up */
  }
}
