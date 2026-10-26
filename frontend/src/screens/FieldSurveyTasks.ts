import { el } from "../core/dom";
import { getLanguage } from "../core/i18n";
import { fieldTaskResult, type FieldTaskDraft, type MissionMiniGameResult } from "../state/Mission01FieldTasks";
import "../field-survey.css";

const copy = {
  "weather.instructions": ["Observa el anemómetro, la bandera y la aguja. Alinea la lectura con la marca y registra las condiciones.", "Observe the anemometer, flag and needle. Align the reading with the mark and record the conditions.", "Observez l’anémomètre, le drapeau et l’aiguille. Alignez la mesure sur le repère et relevez les conditions."],
  "weather.calm": ["Copas lentas · bandera caída · aguja baja", "Slow cups · resting flag · low needle", "Coupelles lentes · drapeau au repos · aiguille basse"],
  "weather.variable": ["Copas moderadas · bandera inclinada · aguja media", "Moderate cups · angled flag · middle needle", "Coupelles modérées · drapeau incliné · aiguille moyenne"],
  "weather.windy": ["Copas rápidas · bandera extendida · aguja alta", "Fast cups · extended flag · high needle", "Coupelles rapides · drapeau tendu · aiguille haute"],
  "weather.dial": ["Lectura del anemómetro", "Anemometer reading", "Mesure de l’anémomètre"],
  "weather.stable": ["Estables", "Stable", "Stables"],
  "weather.changing": ["Variables", "Variable", "Variables"],
  "weather.adverse": ["Desfavorables", "Unfavorable", "Défavorables"],
  "weather.record": ["Registrar condiciones", "Record conditions", "Relever les conditions"],
  "weather.retry": ["La lectura no coincide con los instrumentos. Revisa la marca y las tres señales; puedes repetirla.", "The reading does not match the instruments. Review the mark and all three signals, then try again.", "La mesure ne correspond pas aux instruments. Revoyez le repère et les trois indices, puis réessayez."],
  "weather.done": ["Condiciones registradas. El director incorpora la lectura al riesgo del vuelo.", "Conditions recorded. The director adds the reading to the flight risk assessment.", "Conditions relevées. Le directeur intègre la mesure à l’évaluation du risque du vol."],
  "route.checked": ["Punto inspeccionado", "Point inspected", "Point inspecté"],
  "route.next": ["Sigue las marcas hasta el siguiente punto de la ruta.", "Follow the markers to the next route point.", "Suivez les repères jusqu’au prochain point du trajet."],
  "radio.field": ["La siguiente estación está marcada en el mapa.", "The next station is marked on the map.", "La prochaine station est indiquée sur la carte."],
  "route.done": ["Ruta revisada: las tres marcas están confirmadas. Registra ahora la meteorología.", "Route checked: all three markers confirmed. Record the weather next.", "Trajet vérifié : les trois repères sont confirmés. Relevez maintenant la météo."],
  "route.missing": ["RADIO · Revisa las tres marcas de la ruta y la estación meteorológica antes de autorizar el lanzamiento.", "RADIO · Check all three route markers and the weather station before authorizing launch.", "RADIO · Vérifiez les trois repères du trajet et la station météo avant d’autoriser le lancement."],
  "common.record": ["Guardar resultado", "Save result", "Sauvegarder le résultat"],
  "common.recorded": ["Resultado registrado", "Result recorded", "Résultat enregistré"],
  "common.ready": ["Resultado validado. Guarda el registro para continuar.", "Result validated. Save the record to continue.", "Résultat validé. Sauvegardez le relevé pour continuer."],
  "common.retryCost": ["Puedes corregir los errores. Se registran en la puntuación y pueden consumir tiempo y presupuesto.", "Mistakes can be corrected. They affect the score and may consume time and budget.", "Les erreurs peuvent être corrigées. Elles influencent le score et peuvent consommer du temps et du budget."],
  "common.required": ["Completa primero el objetivo anterior.", "Complete the previous objective first.", "Terminez d’abord l’objectif précédent."],
  "report.title": ["Experimentos de campo", "Field experiments", "Expériences de terrain"],
  "report.attempts": ["intentos", "attempts", "tentatives"],
  "report.mistakes": ["errores", "mistakes", "erreurs"],
  "report.inherited": ["Checkpoint conservado de una partida anterior", "Checkpoint preserved from a previous save", "Étape conservée d’une sauvegarde précédente"],
  "report.readiness": ["Preparación del campo", "Field readiness", "Préparation du terrain"],
} as const;
export function surveyText(key: keyof typeof copy): string { return copy[key][{ es: 0, en: 1, fr: 2 }[getLanguage()]]; }
export function weatherTarget(weather: string): number { return weather === "WINDY" ? 82 : weather === "CLEAR" ? 22 : weather === "CLOUDY" ? 40 : 58; }

export function mountWeatherTask(host: HTMLElement, weather: string, callbacks: {
  onValidated(result: MissionMiniGameResult): void;
  onDraft(draft: FieldTaskDraft): void;
  onFeedback?(type: "input" | "error" | "success"): void;
  onProgress?(progress: number, value?: number): void;
}, saved: FieldTaskDraft = {}): () => void {
  const abort = new AbortController();
  const target = weatherTarget(weather);
  const expected = weather === "WINDY" ? "adverse" : weather === "CLEAR" ? "stable" : "changing";
  let reading = typeof saved.reading === "number" ? Math.max(0, Math.min(100, saved.reading)) : 10;
  let category = typeof saved.category === "string" ? saved.category : "";
  let attempts = typeof saved.attempts === "number" ? saved.attempts : 0;
  let mistakes = typeof saved.mistakes === "number" ? saved.mistakes : 0;
  let validated = false;
  const root = el("section", { className: "field-task field-task--weather", attrs: { "data-field-task": "weather" } });
  const status = el("p", { className: "field-task__status", attrs: { role: "status", "aria-live": "polite" } });
  const needle = el("span", { className: "field-task__weather-needle" });
  const mark = el("span", { className: "field-task__weather-mark" }); mark.style.left = `${target}%`;
  const track = el("div", { className: "field-task__weather-track", attrs: { "aria-hidden": "true" }, children: [mark, needle] });
  const dial = el("input", { attrs: { type: "range", min: "0", max: "100", value: String(reading), "aria-label": surveyText("weather.dial") } });
  const categories = el("div", { className: "field-task__weather-categories" });
  const buttons = (["stable", "changing", "adverse"] as const).map(value => {
    const button = el("button", { className: "field-task__button", text: surveyText(`weather.${value}`), attrs: { type: "button", "data-weather": value } });
    button.addEventListener("click", () => { category = value; update(); }, { signal: abort.signal });
    categories.append(button); return button;
  });
  const saveDraft = () => callbacks.onDraft({ reading, category, attempts, mistakes, validated });
  const update = () => {
    needle.style.left = `${reading}%`;
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.weather === category)));
    callbacks.onProgress?.(Math.max(0, 1 - Math.abs(reading - target) / 100), reading / 100);
    saveDraft();
  };
  dial.addEventListener("input", () => { reading = Number(dial.value); update(); }, { signal: abort.signal });
  const record = el("button", { className: "field-task__button", text: surveyText("weather.record"), attrs: { type: "button", "data-weather-record": "" } });
  const finish = () => {
    validated = true; status.textContent = surveyText("weather.done");
    record.disabled = true; dial.disabled = true; buttons.forEach(button => button.disabled = true);
    saveDraft(); callbacks.onFeedback?.("success"); callbacks.onProgress?.(1, reading / 100);
    callbacks.onValidated(fieldTaskResult("weather", attempts, mistakes, weather as MissionMiniGameResult["conditions"]));
  };
  record.addEventListener("click", () => {
    attempts++;
    if (category !== expected || Math.abs(reading - target) > 6) {
      mistakes++; status.textContent = surveyText("weather.retry"); callbacks.onFeedback?.("error"); saveDraft();
    } else finish();
  }, { signal: abort.signal });
  root.append(el("p", { text: surveyText("weather.instructions") }), el("strong", { text: surveyText(weather === "WINDY" ? "weather.windy" : weather === "CLEAR" ? "weather.calm" : "weather.variable") }), track, dial, categories, record, status);
  host.append(root); update();
  if (saved.validated === true && category === expected && Math.abs(reading - target) <= 6) finish();
  return () => { abort.abort(); root.remove(); };
}
