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
  header.append(node('span', 'ap-bonus-kicker', 'SUBMISIÓN OPCIONAL · OPERACIONES APOLLO 11'), node('h2', '', bonus.title));
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
