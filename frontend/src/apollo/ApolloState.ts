/** Pure mission rules. World proximity, input and cinematic clocks are owned by the screen. */
export interface ApolloAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Checks required inside this checkpoint, independent of UI button guards. */
  readonly requires?: readonly string[];
  /** Optional field operations that must be completed before this action advances the story. */
  readonly requiresBonus?: readonly string[];
}

export interface ApolloCheckpoint {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly target: { readonly x: number; readonly z: number };
  readonly requirements: readonly string[];
  readonly actions: readonly ApolloAction[];
}

export type ApolloBonusKind = 'sequence' | 'telemetry' | 'beacons' | 'cables' | 'weather' | 'flight-plan' | 'crew-manifest';

export interface ApolloBonusCheckpoint {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly target: { readonly x: number; readonly z: number };
  readonly kind: ApolloBonusKind;
  /** Earlier stands that must be complete before this one can be registered. */
  readonly requires?: readonly string[];
  /** Historical checkpoint that must already be earned before visiting the stand. */
  readonly afterCheckpoint?: string;
}

/** Mandatory field stands: they extend the historical route with hands-on operations. */
export const BONUS_CHECKPOINTS: readonly ApolloBonusCheckpoint[] = [
  {
    id: 'power-bus', title: 'Banco de alimentación',
    objective: 'Coloca los fusibles correctos y acciona la palanca del banco eléctrico de apoyo.',
    target: { x: -49, z: 135 }, kind: 'sequence',
  },
  {
    id: 'flight-record', title: 'Plan de vuelo',
    objective: 'Ordena cuatro tarjetas de operación para reconstruir la secuencia de salida del Apollo 11.',
    target: { x: -66, z: 183 }, kind: 'flight-plan', requires: ['power-bus'], afterCheckpoint: 'orientation',
  },
  {
    id: 'telemetry-rack', title: 'Rack de telemetría',
    objective: 'Ajusta tres lecturas analógicas para estabilizar el enlace de datos de la plataforma.',
    target: { x: -84, z: 218 }, kind: 'telemetry', requires: ['flight-record'], afterCheckpoint: 'complex',
  },
  {
    id: 'umbilical-check', title: 'Conexiones umbilicales',
    objective: 'Conecta cada canal con el borne de su letra y comprueba la continuidad del panel de práctica.',
    target: { x: -100, z: 201 }, kind: 'cables', requires: ['telemetry-rack'], afterCheckpoint: 'complex',
  },
  {
    id: 'crew-manifest', title: 'Manifiesto de tripulación',
    objective: 'Asocia las credenciales de Armstrong, Collins y Aldrin con sus funciones en el Apollo 11.',
    target: { x: -25, z: 188 }, kind: 'crew-manifest', requires: ['umbilical-check'], afterCheckpoint: 'communications',
  },
  {
    id: 'weather-window', title: 'Ventana meteorológica',
    objective: 'Coteja la veleta y la placa de nubosidad con las referencias del ejercicio meteorológico.',
    target: { x: -36, z: 379 }, kind: 'weather', requires: ['crew-manifest'], afterCheckpoint: 'crew',
  },
  {
    id: 'pad-safety', title: 'Perímetro de seguridad',
    objective: 'Mantén el visor sobre cada baliza para confirmar el perímetro de observación.',
    target: { x: 15, z: 379 }, kind: 'beacons', requires: ['weather-window'], afterCheckpoint: 'crew',
  },
];

export const CHECKPOINTS: readonly ApolloCheckpoint[] = [
  {
    id: 'orientation', title: 'Bienvenida y orientación',
    objective: 'Consulta el mapa, reconoce el Saturn V y llega al punto de orientación.',
    target: { x: -35, z: 130 }, requirements: [],
    actions: [
      { id: 'map', label: 'Consultar el mapa', description: 'Pulsa M. La posición, las vías y el objetivo corresponden al terreno de esta recreación.' },
      { id: 'landmark', label: 'Reconocer el Saturn V', description: 'Observa el cohete blanco y negro junto a la torre roja. El Saturn V mide aproximadamente 110,6 metros.' },
      { id: 'arrive', requiresBonus: ['power-bus'], label: 'Llegar a orientación', description: 'Acércate al punto autorizado y confirma tu llegada. WASD mueve al técnico; Mayús permite caminar más rápido.' },
    ],
  },
  {
    id: 'complex', title: 'Reconocimiento del complejo',
    objective: 'Identifica la torre, la plataforma 39A y el VAB desde la estación autorizada.',
    target: { x: -70, z: 165 }, requirements: ['orientation'],
    actions: [
      { id: 'tower', label: 'Examinar la torre umbilical', description: 'La torre conecta servicios del equipo terrestre y la pasarela de acceso con el vehículo. Su estructura permanece en tierra al despegar.' },
      { id: 'pad', label: 'Identificar la plataforma 39A', description: 'Apollo 11 partió del Launch Complex 39A sobre una plataforma móvil de lanzamiento. No cruces el perímetro restringido.' },
      { id: 'vab', label: 'Localizar el VAB', description: 'El Vehicle Assembly Building sirvió para ensamblar el Saturn V. El crawler-transporter llevó el conjunto hacia la plataforma por el crawlerway.' },
      { id: 'technician', requiresBonus: ['flight-record'], label: 'Hablar con el técnico', description: 'La mayor parte del trabajo ya está hecha. Hoy observamos el resultado de años de ingeniería; no modificamos el cohete.' },
    ],
  },
  {
    id: 'documentation', title: 'Documentación técnica',
    objective: 'Completa el registro exterior de comunicaciones y verifica el informe recibido.',
    target: { x: -100, z: 220 }, requirements: ['complex'],
    actions: [
      { id: 'log', label: 'Revisar el registro', description: 'Registro simulado de apoyo: enlace de voz recibido; observación exterior autorizada; personal fuera del perímetro de lanzamiento.' },
      { id: 'report', requires: ['log'], label: 'Confirmar el informe', description: 'Confirma que el mensaje pertenece al Saturn V AS-506, Apollo 11, plataforma 39A, 16 de julio de 1969.' },
      { id: 'identify', requiresBonus: ['umbilical-check'], label: 'Registrar la identificación', description: 'Vincula la observación con la torre umbilical y la plataforma móvil. Esta actividad educativa no opera sistemas reales de lanzamiento.' },
    ],
  },
  {
    id: 'communications', title: 'Comunicaciones terrestres',
    objective: 'Reconoce las antenas y verifica el enlace simulado de apoyo.',
    target: { x: 70, z: 252 }, requirements: ['documentation'],
    actions: [
      { id: 'antenna', label: 'Reconocer las antenas', description: 'Las comunicaciones terrestres enlazan estaciones especializadas. Este terminal exterior es una adaptación educativa de consulta.' },
      { id: 'signal', label: 'Identificar la señal', description: 'Escucha y reconoce el patrón de identificación del enlace local antes de comunicar su estado.' },
      { id: 'ready', requires: ['antenna', 'signal'], requiresBonus: ['telemetry-rack'], label: 'Comunicar estación lista', description: 'Envía la confirmación simulada a Daniel Carter. La tripulación y el equipo histórico mantienen todas las responsabilidades reales de vuelo.' },
    ],
  },
  {
    id: 'crew', title: 'La tripulación del Apollo 11',
    objective: 'Observa la recreación retrospectiva del traslado de Armstrong, Collins y Aldrin.',
    target: { x: -24, z: 170 }, requirements: ['communications'],
    actions: [
      { id: 'crew-film', requiresBonus: ['crew-manifest'], label: 'Observar el traslado', description: 'Recreación retrospectiva de la mañana del 16 de julio: tres representaciones estilizadas se dirigen hacia el vehículo de traslado y la plataforma. La elipsis a negro representa su embarque.' },
    ],
  },
  {
    id: 'observation', title: 'Punto de observación',
    objective: 'Alcanza la estación de traslado, prepara cámara y audio y viaja al punto seguro.',
    target: { x: -10, z: 379 }, requirements: ['crew'],
    actions: [
      { id: 'camera', label: 'Preparar la cámara', description: 'Orienta la cámara de seguimiento hacia 39A. Los recorridos y la distancia del área de observación se comprimen por jugabilidad.' },
      { id: 'audio', label: 'Confirmar audio', description: 'Verifica el enlace de radio. El sonido directo de los motores llegará después de la luz debido a la distancia.' },
      { id: 'authorize', requires: ['camera', 'audio'], requiresBonus: ['weather-window', 'pad-safety'], label: 'Solicitar autorización', description: 'Confirma que el técnico permanece en el área de observación y autoriza únicamente la reproducción de la secuencia histórica.' },
    ],
  },
  {
    id: 'launch', title: 'Cuenta regresiva y lanzamiento',
    objective: 'Presencia el despegue del Saturn V desde el punto remoto a 5,6 km, a las 9:32 a. m. EDT.',
    target: { x: 0, z: 5600 }, requirements: ['observation'],
    actions: [
      { id: 'launch-film', label: 'Presenciar el lanzamiento', description: 'El encendido de los cinco motores F-1 precede al despegue. La cuenta, las cámaras y las comunicaciones son una dramatización original.' },
    ],
  },
  {
    id: 'epilogue', title: 'El comienzo de una nueva era',
    objective: 'Consulta el epílogo y completa el registro de la misión.',
    target: { x: 0, z: 5600 }, requirements: ['launch'],
    actions: [
      { id: 'finish', label: 'Completar misión', description: 'El 16 de julio Apollo 11 abandonó la Tierra. El 20 de julio Armstrong y Aldrin alunizaron en Eagle mientras Collins permanecía en órbita lunar.' },
    ],
  },
];

export interface ApolloDialogue {
  readonly id: string;
  readonly checkpoint: number;
  readonly character: string;
  readonly text: string;
  /** Estimated subtitle duration in seconds, replaced by media duration when audio is supplied. */
  readonly duration: number;
  readonly channel: 'radio' | 'in-person' | 'narrator';
  readonly priority: number;
  readonly trigger: 'enter' | 'complete';
  readonly audio?: string;
}

/** All spoken lines are original fiction. Historical people have no invented dialogue. */
export const DIALOGUES: readonly ApolloDialogue[] = [
  { id: 'intro-history', checkpoint: 0, character: 'Narrador', channel: 'narrator', trigger: 'enter', priority: 100, duration: 10,
    text: '16 de julio de 1969. Durante años, miles de personas han trabajado para conseguir lo que alguna vez parecía imposible: enviar seres humanos a la Luna.' },
  { id: 'intro-crew', checkpoint: 0, character: 'Narrador', channel: 'narrator', trigger: 'enter', priority: 99, duration: 8,
    text: 'Hoy, Neil Armstrong, Buzz Aldrin y Michael Collins se preparan para abandonar la Tierra a bordo de Apollo 11. Comienza un viaje que cambiará nuestra historia.' },
  { id: 'carter-welcome', checkpoint: 0, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 90, duration: 9,
    text: 'Buenos días. Bienvenido a las operaciones de apoyo del Apollo 11. Tenemos unas tareas pendientes antes de que puedas dirigirte al punto de observación.' },
  { id: 'carter-orientation', checkpoint: 0, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 80, duration: 9,
    text: '¿Ves aquella estructura al horizonte? Es el Saturn V. Antes de continuar, revisa el mapa: tus tareas estarán señaladas. Permanece en las zonas autorizadas.' },
  { id: 'orientation-complete', checkpoint: 0, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 70, duration: 6,
    text: 'Ubicación confirmada. Acércate a la estación de reconocimiento; desde allí podrás distinguir la plataforma y sus instalaciones.' },
  { id: 'complex-enter', checkpoint: 1, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 60, duration: 7,
    text: 'La torre, el vehículo y la plataforma forman un solo paisaje, pero cada elemento cumple una función distinta. Tómate un momento para reconocerlos.' },
  { id: 'complex-complete', checkpoint: 1, character: 'Técnico de apoyo · ficticio', channel: 'in-person', trigger: 'complete', priority: 70, duration: 8,
    text: 'La mayor parte del trabajo ya está hecha. El Saturn V está preparado. Hoy nos corresponde documentar el resultado de años de trabajo, desde un lugar seguro.' },
  { id: 'documentation-enter', checkpoint: 2, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 60, duration: 8,
    text: 'En una operación como esta, cada registro tiene importancia. Revisa la información de la estación y confirma que coincide con el informe recibido.' },
  { id: 'documentation-complete', checkpoint: 2, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 70, duration: 6,
    text: 'Informe de apoyo recibido. Identificación y observaciones completas. Continúa hacia la estación de comunicaciones.' },
  { id: 'communications-enter', checkpoint: 3, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 60, duration: 7,
    text: 'Necesitamos mantener una comunicación clara con las demás estaciones. Reconoce la señal y comunica que nuestro enlace de apoyo está listo.' },
  { id: 'communications-complete', checkpoint: 3, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 80, duration: 6,
    text: 'Te recibo con claridad. Estación de apoyo lista. Antes de movernos, revisaremos cómo comenzó esta mañana para la tripulación.' },
  { id: 'crew-enter', checkpoint: 4, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 80, duration: 9,
    text: 'Esta recreación vuelve a las primeras horas de hoy. Ahí van Armstrong, Collins y Aldrin. Tras años de preparación, su viaje está a punto de comenzar.' },
  { id: 'crew-complete', checkpoint: 4, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 70, duration: 8,
    text: 'Regresamos a los preparativos finales. Nuestro trabajo aquí ha terminado. Es hora de dirigirnos al área de observación.' },
  { id: 'observation-enter', checkpoint: 5, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 60, duration: 8,
    text: 'Prepara la cámara y comprueba el audio desde la zona señalada. Quiero que recuerdes lo que vas a ver: no todos los días comienza un viaje a otro mundo.' },
  { id: 'observation-complete', checkpoint: 5, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 80, duration: 6,
    text: 'Área de observación confirmada. Permanecemos aquí. Todas las miradas se dirigen ahora hacia el Saturn V.' },
  { id: 'launch-enter', checkpoint: 6, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'enter', priority: 90, duration: 7,
    text: 'Atención, estamos entrando en los últimos segundos. Toda la atención está puesta sobre el Saturn V. El lanzamiento está previsto para las nueve y treinta y dos.' },
  { id: 'launch-complete', checkpoint: 6, character: 'Daniel Carter · supervisor ficticio', channel: 'radio', trigger: 'complete', priority: 95, duration: 7,
    text: '¡Despegue confirmado! Ahí está. Apollo 11 se dirige hacia el espacio. Nuestro registro de apoyo queda completo.' },
  { id: 'epilogue-enter', checkpoint: 7, character: 'Narrador', channel: 'narrator', trigger: 'enter', priority: 100, duration: 10,
    text: 'El 16 de julio de 1969, Apollo 11 abandonó la Tierra. Cuatro días después, Armstrong y Aldrin alcanzarían la superficie de la Luna, mientras Collins permanecía en órbita lunar.' },
  { id: 'epilogue-complete', checkpoint: 7, character: 'Narrador', channel: 'narrator', trigger: 'complete', priority: 100, duration: 6,
    text: 'Misión 01 completada. Apollo 11: el comienzo de una nueva era. Próximo capítulo: el viaje hacia la Luna.' },
];

export interface ApolloSave {
  version: 'apollo11-v1';
  checkpoint: number;
  completed: string[];
  checks: string[];
  dialogues: string[];
  elapsed: number;
  done: boolean;
  /** Optional for backward compatibility with saves made before bonus operations existed. */
  bonusCompleted: string[];
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string') && new Set(value).size === value.length;
}

export class ApolloState {
  checkpoint = 0;
  completed: string[] = [];
  checks: string[] = [];
  dialogues: string[] = [];
  elapsed = 0;
  done = false;
  bonusCompleted: string[] = [];

  constructor(saved?: unknown) {
    if (!saved || typeof saved !== 'object') return;
    const candidate = saved as Partial<ApolloSave>;
    // A legacy mission or a future schema must never inherit Apollo launch clearance.
    if (candidate.version !== 'apollo11-v1' || !Number.isInteger(candidate.checkpoint)
      || candidate.checkpoint! < 0 || candidate.checkpoint! >= CHECKPOINTS.length
      || typeof candidate.done !== 'boolean' || !Number.isFinite(candidate.elapsed)
      || candidate.elapsed! < 0 || !uniqueStrings(candidate.completed)
      || !uniqueStrings(candidate.checks) || !uniqueStrings(candidate.dialogues)) return;

    const index = candidate.checkpoint!;
    const prefixLength = candidate.done ? CHECKPOINTS.length : index;
    if (candidate.done && index !== CHECKPOINTS.length - 1) return;
    if (candidate.completed.length !== prefixLength
      || candidate.completed.some((id, i) => id !== CHECKPOINTS[i].id)) return;
    const actionIds = CHECKPOINTS[index].actions.map(action => action.id);
    if (candidate.checks.some(id => !actionIds.includes(id))
      || candidate.checks.length >= actionIds.length
      || (candidate.done && candidate.checks.length !== 0)) return;
    // Validate actions in the order they were earned so a saved dependent check
    // cannot appear before the evidence that authorized it.
    const restoredChecks: string[] = [];
    for (const id of candidate.checks) {
      const action = CHECKPOINTS[index].actions.find(entry => entry.id === id)!;
      if (action.requires?.some(required => !restoredChecks.includes(required))) return;
      restoredChecks.push(id);
    }
    if (candidate.dialogues.some(id => {
      const dialogue = DIALOGUES.find(entry => entry.id === id);
      return !dialogue || dialogue.checkpoint > index
        || (dialogue.checkpoint === index && dialogue.trigger === 'complete' && !candidate.done);
    })) return;
    const bonusCompleted = candidate.bonusCompleted ?? [];
    if (!uniqueStrings(bonusCompleted) || bonusCompleted.some(id => !BONUS_CHECKPOINTS.some(bonus => bonus.id === id))) return;

    this.checkpoint = index;
    this.completed = [...candidate.completed];
    this.checks = [...candidate.checks];
    this.dialogues = [...candidate.dialogues];
    this.elapsed = candidate.elapsed!;
    this.done = candidate.done;
    this.bonusCompleted = [...bonusCompleted];
  }

  get current(): ApolloCheckpoint { return CHECKPOINTS[this.checkpoint]; }

  /** Select the first outstanding dependency, including chained stand prerequisites.
   * Earned legacy actions remain earned; future tasks still obey their own guards. */
  get requiredStand(): ApolloBonusCheckpoint | undefined {
    const needed = new Set<string>();
    const visit = (id: string) => {
      if (this.bonusCompleted.includes(id) || needed.has(id)) return;
      needed.add(id); BONUS_CHECKPOINTS.find(stand => stand.id === id)?.requires?.forEach(visit);
    };
    if (!this.done) this.current.actions.filter(action => !this.checks.includes(action.id)).forEach(action => action.requiresBonus?.forEach(visit));
    return BONUS_CHECKPOINTS.find(stand => needed.has(stand.id));
  }

  canStartBonus(id: string): boolean {
    const stand = BONUS_CHECKPOINTS.find(entry => entry.id === id);
    return !!stand && !this.done && !this.bonusCompleted.includes(id)
      && (!stand.afterCheckpoint || this.completed.includes(stand.afterCheckpoint))
      && !stand.requires?.some(required => !this.bonusCompleted.includes(required));
  }

  act(action: string): boolean {
    const definition = this.current.actions.find(entry => entry.id === action);
    if (this.done || !definition
      || this.checks.includes(action)
      || definition.requires?.some(id => !this.checks.includes(id))
      || definition.requiresBonus?.some(id => !this.bonusCompleted.includes(id))
      || !this.current.requirements.every(id => this.completed.includes(id))) return false;
    this.checks.push(action);
    if (this.current.actions.every(entry => this.checks.includes(entry.id))) {
      this.completed.push(this.current.id);
      this.checks = [];
      if (this.checkpoint === CHECKPOINTS.length - 1) this.done = true;
      else this.checkpoint += 1;
    }
    return true;
  }

  completeBonus(id: string): boolean {
    if (!this.canStartBonus(id)) return false;
    this.bonusCompleted.push(id);
    return true;
  }

  toJSON(): ApolloSave {
    return {
      version: 'apollo11-v1', checkpoint: this.checkpoint,
      completed: [...this.completed], checks: [...this.checks],
      dialogues: [...this.dialogues], elapsed: this.elapsed, done: this.done,
      bonusCompleted: [...this.bonusCompleted],
    };
  }
}
