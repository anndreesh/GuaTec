import type { ApolloBonusCheckpoint } from './ApolloState';
import { apolloText } from './ApolloLocale';

export interface BonusMissionHandle {
  dispose(): void;
}

interface BonusMissionOptions {
  onComplete: () => void;
  onCancel: () => void;
  onFeedback?: (kind: 'success' | 'error') => void;
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = apolloText(text);
  return element;
};

export function mountBonusMission(host: HTMLElement, bonus: ApolloBonusCheckpoint, options: BonusMissionOptions): BonusMissionHandle {
  let disposed = false;
  const listeners: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, callback: EventListener) => {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  };
  const stage = node('div', `ap-bonus-stage ap-bonus-${bonus.kind}`);
  const header = node('div', 'ap-bonus-header');
  header.append(node('span', 'ap-bonus-kicker', 'STAND OBLIGATORIO · OPERACIONES APOLLO 11'), node('h2', '', bonus.title));
  stage.append(header, node('p', 'ap-bonus-objective', bonus.objective));
  const feedback = node('p', 'ap-bonus-feedback', 'Sistema en espera · completa la verificación para registrar el checkpoint.');
  stage.append(feedback);

  const finish = (message: string) => {
    if (disposed) return;
    feedback.textContent = apolloText(message);
    options.onFeedback?.('success');
    feedback.classList.add('ap-bonus-feedback--success');
    stage.classList.add('ap-bonus-stage--complete');
    window.setTimeout(() => { if (!disposed) options.onComplete(); }, 360);
  };
  const fail = (message: string) => {
    feedback.textContent = apolloText(message);
    options.onFeedback?.('error');
    feedback.classList.remove('ap-bonus-feedback--success');
    stage.classList.add('ap-bonus-stage--error');
    window.setTimeout(() => stage.classList.remove('ap-bonus-stage--error'), 230);
  };

  if (bonus.kind === 'sequence') {
    const target = [1, 3, 0, 2];
    let progress = 0;
    const readout = node('div', 'ap-bonus-readout', 'RELAY PATH · — — — —');
    const bank = node('div', 'ap-bonus-relay-bank');
    const render = () => { readout.textContent = `RELAY PATH · ${target.map((_, i) => i < progress ? '●' : '—').join(' ')}`; };
    target.forEach((_, index) => {
      const button = node('button', 'ap-bonus-relay', `${index + 1}`);
      button.type = 'button';
      button.setAttribute('aria-label', `Relé ${index + 1}`);
      listen(button, 'click', () => {
        if (disposed || stage.classList.contains('ap-bonus-stage--complete')) return;
        const expected = target[progress];
        if (index !== expected) { progress = 0; render(); fail('Secuencia rechazada · el banco volvió a modo seguro.'); return; }
        progress += 1; button.classList.add('ap-bonus-relay--active'); render();
        if (progress === target.length) finish('Banco estabilizado · checkpoint registrado.');
      });
      bank.append(button);
    });
    render();
    stage.append(readout, bank, node('small', 'ap-bonus-hint', 'Activa los relés en el orden indicado por el pulso luminoso: 2 · 4 · 1 · 3.'));
  }

  if (bonus.kind === 'telemetry') {
    const targets = [62, 74, 58];
    const labels = ['S-IVB', 'Enlace', 'Plataforma'];
    const rack = node('div', 'ap-bonus-telemetry-rack');
    const inputs: HTMLInputElement[] = [];
    targets.forEach((target, index) => {
      const row = node('label', 'ap-bonus-slider');
      const title = node('span', '', `${labels[index]} · objetivo ${target}`);
      const input = node('input'); input.type = 'range'; input.min = '0'; input.max = '100'; input.value = '50'; input.step = '1'; input.setAttribute('aria-label', labels[index]!);
      const output = node('output', '', '50');
      listen(input, 'input', () => { output.textContent = input.value; });
      row.append(title, input, output); rack.append(row); inputs.push(input);
    });
    const confirm = node('button', 'ap-bonus-action', 'Bloquear lecturas'); confirm.type = 'button';
    listen(confirm, 'click', () => {
      if (disposed) return;
      const aligned = inputs.every((input, index) => Math.abs(Number(input.value) - targets[index]!) <= 3);
      if (aligned) finish('Telemetría estable · enlace de datos confirmado.');
      else fail('Lectura fuera de tolerancia · ajusta los tres canales.');
    });
    stage.append(rack, confirm, node('small', 'ap-bonus-hint', 'Los tres canales deben quedar dentro de ±3 unidades.'));
  }

  if (bonus.kind === 'weather') {
    const targets = [38, 62, 26];
    const labels = ['Viento', 'Humedad', 'Nubosidad'];
    const rack = node('div', 'ap-bonus-telemetry-rack');
    const inputs: HTMLInputElement[] = [];
    targets.forEach((target, index) => {
      const row = node('label', 'ap-bonus-slider');
      const title = node('span', '', `${labels[index]} · objetivo ${target}`);
      const input = node('input'); input.type = 'range'; input.min = '0'; input.max = '100'; input.value = '50'; input.step = '1'; input.setAttribute('aria-label', labels[index]!);
      const output = node('output', '', '50');
      listen(input, 'input', () => { output.textContent = input.value; });
      row.append(title, input, output); rack.append(row); inputs.push(input);
    });
    const confirm = node('button', 'ap-bonus-action', 'Emitir parte meteorológico'); confirm.type = 'button';
    listen(confirm, 'click', () => {
      if (disposed) return;
      const aligned = inputs.every((input, index) => Math.abs(Number(input.value) - targets[index]!) <= 4);
      if (aligned) finish('Ventana confirmada · parte meteorológico enviado.');
      else fail('Condiciones inestables · revisa los tres instrumentos.');
    });
    stage.append(rack, confirm, node('small', 'ap-bonus-hint', 'Ajusta los tres indicadores dentro de ±4 unidades.'));
  }

  if (bonus.kind === 'beacons') {
    const target = [1, 2, 0];
    let progress = 0;
    const beaconRow = node('div', 'ap-bonus-beacon-row');
    const readout = node('div', 'ap-bonus-readout', 'PERÍMETRO · 0 / 3 BALIZADORES');
    target.forEach((_, index) => {
      const beacon = node('button', 'ap-bonus-beacon', `B-${index + 1}`); beacon.type = 'button';
      beacon.setAttribute('aria-label', `Balizador ${index + 1}`);
      listen(beacon, 'click', () => {
        if (disposed || stage.classList.contains('ap-bonus-stage--complete')) return;
        if (index !== target[progress]) { progress = 0; beaconRow.querySelectorAll('.ap-bonus-beacon--active').forEach(item => item.classList.remove('ap-bonus-beacon--active')); readout.textContent = 'PERÍMETRO · SECUENCIA REINICIADA'; fail('Balizador incorrecto · vuelve a recorrer el perímetro.'); return; }
        progress += 1; beacon.classList.add('ap-bonus-beacon--active'); readout.textContent = `PERÍMETRO · ${progress} / 3 BALIZADORES`;
        if (progress === target.length) finish('Perímetro confirmado · ruta de servicio segura.');
      });
      beaconRow.append(beacon);
    });
    stage.append(readout, beaconRow, node('small', 'ap-bonus-hint', 'Confirma los balizadores en el orden que marca el barrido: B-2 · B-3 · B-1.'));
  }

  if (bonus.kind === 'cables') {
    const target = [0, 2, 1, 3];
    let progress = 0;
    const nodes = node('div', 'ap-bonus-cable-nodes');
    const readout = node('div', 'ap-bonus-readout', 'CONTINUIDAD · 0 / 4 NODOS');
    target.forEach((_, index) => {
      const terminal = node('button', 'ap-bonus-cable-node', `N-${index + 1}`); terminal.type = 'button';
      terminal.setAttribute('aria-label', `Nodo de servicio ${index + 1}`);
      listen(terminal, 'click', () => {
        if (disposed || stage.classList.contains('ap-bonus-stage--complete')) return;
        if (index !== target[progress]) { progress = 0; nodes.querySelectorAll('.ap-bonus-cable-node--active').forEach(item => item.classList.remove('ap-bonus-cable-node--active')); readout.textContent = 'CONTINUIDAD · RUTA ABIERTA'; fail('Conexión inválida · el relé aisló el circuito.'); return; }
        progress += 1; terminal.classList.add('ap-bonus-cable-node--active'); readout.textContent = `CONTINUIDAD · ${progress} / 4 NODOS`;
        if (progress === target.length) finish('Continuidad confirmada · umbilical listo.');
      });
      nodes.append(terminal);
    });
    stage.append(readout, nodes, node('small', 'ap-bonus-hint', 'Sigue la ruta marcada por el pulso: N-1 · N-3 · N-2 · N-4.'));
  }

  if (bonus.kind === 'flight-plan') {
    const target = [2, 0, 3, 1];
    let progress = 0;
    const cards = node('div', 'ap-bonus-flight-cards');
    const readout = node('div', 'ap-bonus-readout', 'SECUENCIA DE SALIDA · 0 / 4 TARJETAS');
    const labels = ['T−10 · autorización', 'T−05 · brazos', 'T−00 · ignición', 'T+01 · ascenso'];
    target.forEach((_, index) => {
      const card = node('button', 'ap-bonus-flight-card', labels[index]!); card.type = 'button';
      card.setAttribute('aria-label', labels[index]!);
      listen(card, 'click', () => {
        if (disposed || stage.classList.contains('ap-bonus-stage--complete')) return;
        if (index !== target[progress]) { progress = 0; cards.querySelectorAll('.ap-bonus-flight-card--active').forEach(item => item.classList.remove('ap-bonus-flight-card--active')); readout.textContent = 'SECUENCIA DE SALIDA · REVISAR'; fail('Orden incorrecto · las tarjetas regresaron a la bandeja.'); return; }
        progress += 1; card.classList.add('ap-bonus-flight-card--active'); readout.textContent = `SECUENCIA DE SALIDA · ${progress} / 4 TARJETAS`;
        if (progress === target.length) finish('Plan verificado · secuencia de salida archivada.');
      });
      cards.append(card);
    });
    stage.append(readout, cards, node('small', 'ap-bonus-hint', 'Reconstruye la secuencia: T−00 · T−10 · T+01 · T−05.'));
  }

  if (bonus.kind === 'crew-manifest') {
    const target = [2, 0, 1];
    let progress = 0;
    const readout = node('div', 'ap-bonus-readout', 'MANIFIESTO · 0 / 3 ASIGNACIONES');
    const cards = node('div', 'ap-bonus-crew-cards');
    const labels = ['ARMSTRONG · COMANDANTE', 'COLLINS · PILOTO CM', 'ALDRIN · PILOTO LM'];
    const seats = ['ASIENTO A', 'ASIENTO B', 'ASIENTO C'];
    target.forEach((_expected, index) => {
      const card = node('button', 'ap-bonus-crew-card', `${labels[index]}\n${seats[index]}`); card.type = 'button';
      card.setAttribute('aria-label', `${labels[index]}, ${seats[index]}`);
      listen(card, 'click', () => {
        if (disposed || stage.classList.contains('ap-bonus-stage--complete')) return;
        if (index !== target[progress]) {
          progress = 0;
          cards.querySelectorAll('.ap-bonus-crew-card--active').forEach(item => item.classList.remove('ap-bonus-crew-card--active'));
          readout.textContent = 'MANIFIESTO · REVISAR ASIGNACIONES';
          fail('Asignación incorrecta · el manifiesto volvió a la bandeja.');
          return;
        }
        progress += 1; card.classList.add('ap-bonus-crew-card--active'); readout.textContent = `MANIFIESTO · ${progress} / 3 ASIGNACIONES`;
        if (progress === target.length) finish('Manifiesto verificado · traslado autorizado.');
      });
      cards.append(card);
    });
    stage.append(readout, cards, node('small', 'ap-bonus-hint', 'Asocia cada distintivo con su asiento en el orden del manifiesto: Aldrin · Armstrong · Collins.'));
  }

  const cancel = node('button', 'ap-button ap-bonus-cancel', 'Volver a operaciones'); cancel.type = 'button';
  listen(cancel, 'click', () => options.onCancel()); stage.append(cancel); host.append(stage);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.forEach(remove => remove());
      stage.remove();
    },
  };
}
