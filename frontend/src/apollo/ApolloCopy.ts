import { getLanguage } from '@/core/i18n';
import { CHECKPOINTS, DIALOGUES } from './ApolloState';

/** [es, en, fr] */
export type L3 = readonly [string, string, string];
/** [en, fr]; the Spanish source text lives in ApolloState. */
type Pair = readonly [string, string];
export type Txt = string | (() => string);

const index = (): 0 | 1 | 2 => ({ es: 0, en: 1, fr: 2 } as const)[getLanguage()];
/** Picks the active-language variant of a triplet. */
export const lt = (value: L3): string => value[index()];
/** Resolves a static string or a lazily evaluated one. */
export const txt = (value: Txt): string => (typeof value === 'function' ? value() : value);

// ---------------------------------------------------------------- checkpoints
const CHECKPOINT_COPY: Record<string, { title: Pair; objective: Pair }> = {
  orientation: {
    title: ['Welcome and orientation', 'Accueil et orientation'],
    objective: ['Check the map, recognize the Saturn V and reach the orientation point.', 'Consultez la carte, reconnaissez le Saturn V et rejoignez le point d’orientation.'],
  },
  complex: {
    title: ['Complex reconnaissance', 'Reconnaissance du complexe'],
    objective: ['Identify the tower, pad 39A and the VAB from the authorized station.', 'Identifiez la tour, la rampe 39A et le VAB depuis la station autorisée.'],
  },
  documentation: {
    title: ['Technical documentation', 'Documentation technique'],
    objective: ['Complete the outdoor communications log and verify the report received.', 'Complétez le registre extérieur des communications et vérifiez le rapport reçu.'],
  },
  communications: {
    title: ['Ground communications', 'Communications au sol'],
    objective: ['Recognize the antennas and verify the simulated support link.', 'Reconnaissez les antennes et vérifiez la liaison de soutien simulée.'],
  },
  crew: {
    title: ['The Apollo 11 crew', 'L’équipage d’Apollo 11'],
    objective: ['Watch the retrospective recreation of Armstrong, Collins and Aldrin’s transfer.', 'Regardez la reconstitution rétrospective du transfert d’Armstrong, Collins et Aldrin.'],
  },
  observation: {
    title: ['Observation point', 'Point d’observation'],
    objective: ['Reach the transfer station, prepare camera and audio, and travel to the safe point.', 'Rejoignez la station de transfert, préparez la caméra et l’audio, puis rendez-vous au point sûr.'],
  },
  launch: {
    title: ['Countdown and launch', 'Compte à rebours et lancement'],
    objective: ['Watch the Saturn V lift off from the remote point 5.6 km away, at 9:32 a.m. EDT.', 'Assistez au décollage du Saturn V depuis le point éloigné situé à 5,6 km, à 9 h 32 EDT.'],
  },
  wiring: {
    title: ['Link panel', 'Panneau de liaison'],
    objective: ['Restore the outdoor panel link by connecting each wire to its terminal.', 'Rétablissez la liaison du panneau extérieur en reliant chaque câble à sa borne.'],
  },
  tracking: {
    title: ['Antenna tracking', 'Poursuite d’antenne'],
    objective: ['Align the dish with the tracking signal and keep the link stable.', 'Alignez la parabole sur le signal de poursuite et maintenez la liaison stable.'],
  },
  card: {
    title: ['Access control', 'Contrôle d’accès'],
    objective: ['Swipe your credential card through the reader to enter the observation area.', 'Passez votre carte d’accréditation dans le lecteur pour entrer dans la zone d’observation.'],
  },
  sequence: {
    title: ['Sequence check', 'Vérification de séquence'],
    objective: ['Repeat the light pattern on the pre-observation verification panel.', 'Répétez le motif lumineux du panneau de vérification précédant l’observation.'],
  },
  telemetry: {
    title: ['Tracking telemetry', 'Télémétrie de suivi'],
    objective: ['Stabilize the telemetry signal by keeping the reticle on it.', 'Stabilisez le signal de télémétrie en gardant le réticule dessus.'],
  },
  epilogue: {
    title: ['The beginning of a new era', 'Le début d’une nouvelle ère'],
    objective: ['Read the epilogue and complete the mission log.', 'Consultez l’épilogue et terminez le registre de la mission.'],
  },
};

const ACTION_COPY: Record<string, { label: Pair; description: Pair }> = {
  map: {
    label: ['Check the map', 'Consulter la carte'],
    description: ['Press M. Your position, the roads and the objective correspond to the terrain of this recreation.', 'Appuyez sur M. Votre position, les routes et l’objectif correspondent au terrain de cette reconstitution.'],
  },
  landmark: {
    label: ['Recognize the Saturn V', 'Reconnaître le Saturn V'],
    description: ['Look at the black-and-white rocket next to the red tower. The Saturn V is about 110.6 meters tall.', 'Observez la fusée noire et blanche à côté de la tour rouge. Le Saturn V mesure environ 110,6 mètres.'],
  },
  arrive: {
    label: ['Reach the orientation point', 'Rejoindre le point d’orientation'],
    description: ['Approach the authorized point and confirm your arrival. WASD moves the technician; Shift lets you walk faster.', 'Approchez-vous du point autorisé et confirmez votre arrivée. WASD déplace le technicien ; Maj permet de marcher plus vite.'],
  },
  tower: {
    label: ['Examine the umbilical tower', 'Examiner la tour ombilicale'],
    description: ['The tower connects ground-crew services and the access walkway to the vehicle. Its structure stays on the ground at liftoff.', 'La tour relie les services de l’équipe au sol et la passerelle d’accès au lanceur. Sa structure reste au sol au décollage.'],
  },
  pad: {
    label: ['Identify pad 39A', 'Identifier la rampe 39A'],
    description: ['Apollo 11 lifted off from Launch Complex 39A on a mobile launcher platform. Do not cross the restricted perimeter.', 'Apollo 11 a décollé du complexe de lancement 39A sur une plateforme de lancement mobile. Ne franchissez pas le périmètre interdit.'],
  },
  vab: {
    label: ['Locate the VAB', 'Repérer le VAB'],
    description: ['The Vehicle Assembly Building was used to assemble the Saturn V. The crawler-transporter carried the assembly to the pad along the crawlerway.', 'Le Vehicle Assembly Building a servi à assembler le Saturn V. Le crawler-transporteur a conduit l’ensemble jusqu’à la rampe par le crawlerway.'],
  },
  technician: {
    label: ['Talk to the technician', 'Parler au technicien'],
    description: ['Most of the work is already done. Today we watch the result of years of engineering; we do not modify the rocket.', 'L’essentiel du travail est déjà fait. Aujourd’hui, nous observons le fruit de plusieurs années d’ingénierie ; nous ne modifions pas la fusée.'],
  },
  log: {
    label: ['Review the log', 'Consulter le registre'],
    description: ['Simulated support log: voice link received; outdoor observation authorized; personnel outside the launch perimeter.', 'Registre de soutien simulé : liaison vocale reçue ; observation extérieure autorisée ; personnel hors du périmètre de lancement.'],
  },
  report: {
    label: ['Confirm the report', 'Confirmer le rapport'],
    description: ['Confirm that the message belongs to Saturn V AS-506, Apollo 11, pad 39A, July 16, 1969.', 'Confirmez que le message concerne le Saturn V AS-506, Apollo 11, rampe 39A, 16 juillet 1969.'],
  },
  identify: {
    label: ['Record the identification', 'Enregistrer l’identification'],
    description: ['Link the observation to the umbilical tower and the mobile platform. This educational activity does not operate any real launch systems.', 'Associez l’observation à la tour ombilicale et à la plateforme mobile. Cette activité éducative ne commande aucun système de lancement réel.'],
  },
  antenna: {
    label: ['Recognize the antennas', 'Reconnaître les antennes'],
    description: ['Ground communications link specialized stations. This outdoor terminal is an educational reference adaptation.', 'Les communications au sol relient des stations spécialisées. Ce terminal extérieur est une adaptation éducative de consultation.'],
  },
  signal: {
    label: ['Identify the signal', 'Identifier le signal'],
    description: ['Listen for and recognize the identification pattern of the local link before reporting its status.', 'Écoutez et reconnaissez le motif d’identification de la liaison locale avant d’en communiquer l’état.'],
  },
  ready: {
    label: ['Report station ready', 'Signaler la station prête'],
    description: ['Send the simulated confirmation to Daniel Carter. The crew and the historical team keep all real flight responsibilities.', 'Envoyez la confirmation simulée à Daniel Carter. L’équipage et l’équipe historique conservent toutes les responsabilités de vol réelles.'],
  },
  'crew-film': {
    label: ['Watch the transfer', 'Observer le transfert'],
    description: ['Retrospective recreation of the morning of July 16: three stylized representations head toward the transfer vehicle and the pad. The cut to black stands for their boarding.', 'Reconstitution rétrospective de la matinée du 16 juillet : trois représentations stylisées se dirigent vers le véhicule de transfert et la rampe. Le fondu au noir représente leur embarquement.'],
  },
  camera: {
    label: ['Prepare the camera', 'Préparer la caméra'],
    description: ['Aim the tracking camera toward 39A. Routes and the distance to the observation area are compressed for gameplay.', 'Orientez la caméra de suivi vers 39A. Les trajets et la distance jusqu’à la zone d’observation sont compressés pour la jouabilité.'],
  },
  audio: {
    label: ['Confirm audio', 'Confirmer l’audio'],
    description: ['Check the radio link. The direct sound of the engines will arrive after the light because of the distance.', 'Vérifiez la liaison radio. Le son direct des moteurs arrivera après la lumière à cause de la distance.'],
  },
  authorize: {
    label: ['Request authorization', 'Demander l’autorisation'],
    description: ['Confirm that the technician stays in the observation area and authorize only the playback of the historical sequence.', 'Confirmez que le technicien reste dans la zone d’observation et n’autorisez que la lecture de la séquence historique.'],
  },
  'launch-film': {
    label: ['Watch the launch', 'Assister au lancement'],
    description: ['The ignition of the five F-1 engines precedes liftoff. The count, the cameras and the communications are an original dramatization.', 'L’allumage des cinq moteurs F-1 précède le décollage. Le compte à rebours, les caméras et les communications sont une dramatisation originale.'],
  },
  'wire-panel': {
    label: ['Connect the panel wires', 'Connecter les câbles du panneau'],
    description: ['Minigame: drag each wire to the terminal of its color. Three wrong connections cause a short circuit and the panel resets.', 'Mini-jeu : faites glisser chaque câble vers la borne de sa couleur. Trois mauvaises connexions provoquent un court-circuit et le panneau se réinitialise.'],
  },
  'align-dish': {
    label: ['Align the antenna', 'Aligner l’antenne'],
    description: ['Minigame: adjust azimuth and elevation until you pick up the signal and hold the lock for 3 seconds. The source drifts slowly.', 'Mini-jeu : réglez l’azimut et l’élévation jusqu’à capter le signal et maintenez le verrouillage 3 secondes. La source dérive lentement.'],
  },
  'swipe-card': {
    label: ['Swipe the card', 'Passer la carte'],
    description: ['Minigame: swipe the card through the slot at a medium speed and in a straight line. Two valid reads in a row are required.', 'Mini-jeu : passez la carte dans la fente à vitesse moyenne et en ligne droite. Deux lectures valides consécutives sont nécessaires.'],
  },
  'repeat-pattern': {
    label: ['Repeat the pattern', 'Répéter le motif'],
    description: ['Minigame: memorize the light pattern and repeat it; each round adds one step. Three mistakes restart the check.', 'Mini-jeu : mémorisez le motif lumineux et répétez-le ; chaque manche ajoute une étape. Trois erreurs relancent la vérification.'],
  },
  'stabilize-signal': {
    label: ['Stabilize the signal', 'Stabiliser le signal'],
    description: ['Minigame: keep the reticle inside the ring that follows the signal until stability reaches 100%.', 'Mini-jeu : gardez le réticule dans l’anneau qui suit le signal jusqu’à atteindre 100 % de stabilité.'],
  },
  finish: {
    label: ['Complete mission', 'Terminer la mission'],
    description: ['On July 16, Apollo 11 left Earth. On July 20, Armstrong and Aldrin landed in Eagle while Collins stayed in lunar orbit.', 'Le 16 juillet, Apollo 11 a quitté la Terre. Le 20 juillet, Armstrong et Aldrin se sont posés à bord d’Eagle tandis que Collins restait en orbite lunaire.'],
  },
};

const pairIndex = (): 0 | 1 => (getLanguage() === 'fr' ? 1 : 0);

export function checkpointText(id: string): { title: string; objective: string } {
  const source = CHECKPOINTS.find(checkpoint => checkpoint.id === id);
  if (!source) return { title: id, objective: '' };
  if (getLanguage() === 'es') return { title: source.title, objective: source.objective };
  const copy = CHECKPOINT_COPY[id];
  return copy ? { title: copy.title[pairIndex()], objective: copy.objective[pairIndex()] } : { title: source.title, objective: source.objective };
}

export function actionText(id: string): { label: string; description: string } {
  const source = CHECKPOINTS.flatMap(checkpoint => checkpoint.actions).find(action => action.id === id);
  if (!source) return { label: id, description: '' };
  if (getLanguage() === 'es') return { label: source.label, description: source.description };
  const copy = ACTION_COPY[id];
  return copy ? { label: copy.label[pairIndex()], description: copy.description[pairIndex()] } : { label: source.label, description: source.description };
}

// ------------------------------------------------------------------ dialogues
const CHARACTER_COPY: Record<string, Pair> = {
  'Narrador': ['Narrator', 'Narrateur'],
  'Daniel Carter · supervisor ficticio': ['Daniel Carter · fictional supervisor', 'Daniel Carter · superviseur fictif'],
  'Técnico de apoyo · ficticio': ['Support technician · fictional', 'Technicien de soutien · fictif'],
  'Técnico de plataforma': ['Pad technician', 'Technicien de rampe'],
};

const DIALOGUE_COPY: Record<string, Pair> = {
  'intro-history': ['July 16, 1969. For years, thousands of people have worked to achieve what once seemed impossible: sending human beings to the Moon.', '16 juillet 1969. Pendant des années, des milliers de personnes ont travaillé pour accomplir ce qui semblait autrefois impossible : envoyer des êtres humains sur la Lune.'],
  'intro-crew': ['Today, Neil Armstrong, Buzz Aldrin and Michael Collins prepare to leave Earth aboard Apollo 11. A journey that will change our history is about to begin.', 'Aujourd’hui, Neil Armstrong, Buzz Aldrin et Michael Collins s’apprêtent à quitter la Terre à bord d’Apollo 11. Un voyage qui changera notre histoire commence.'],
  'carter-welcome': ['Good morning. Welcome to the Apollo 11 support operations. We have a few tasks pending before you can head to the observation point.', 'Bonjour. Bienvenue aux opérations de soutien d’Apollo 11. Quelques tâches nous attendent avant que vous puissiez rejoindre le point d’observation.'],
  'carter-orientation': ['See that structure on the horizon? That is the Saturn V. Before continuing, check the map: your tasks will be marked on it. Stay inside the authorized zones.', 'Vous voyez cette structure à l’horizon ? C’est le Saturn V. Avant de continuer, consultez la carte : vos tâches y seront indiquées. Restez dans les zones autorisées.'],
  'orientation-complete': ['Location confirmed. Head to the reconnaissance station; from there you will be able to make out the pad and its facilities.', 'Position confirmée. Rendez-vous à la station de reconnaissance ; de là, vous distinguerez la rampe et ses installations.'],
  'complex-enter': ['The tower, the vehicle and the pad form a single landscape, but each element has a different function. Take a moment to recognize them.', 'La tour, le lanceur et la rampe forment un seul paysage, mais chaque élément a une fonction différente. Prenez un moment pour les reconnaître.'],
  'complex-complete': ['Most of the work is already done. The Saturn V is ready. Today our job is to document the result of years of work, from a safe place.', 'L’essentiel du travail est déjà fait. Le Saturn V est prêt. Aujourd’hui, notre tâche est de documenter le fruit de ces années de travail, depuis un lieu sûr.'],
  'documentation-enter': ['In an operation like this, every record matters. Review the station information and confirm that it matches the report received.', 'Dans une opération comme celle-ci, chaque enregistrement compte. Consultez les informations de la station et vérifiez qu’elles correspondent au rapport reçu.'],
  'documentation-complete': ['Support report received. Identification and observations complete. Continue to the communications station.', 'Rapport de soutien reçu. Identification et observations terminées. Poursuivez vers la station de communications.'],
  'communications-enter': ['We need to keep communication clear with the other stations. Recognize the signal and report that our support link is ready.', 'Nous devons maintenir une communication claire avec les autres stations. Reconnaissez le signal et indiquez que notre liaison de soutien est prête.'],
  'communications-complete': ['I read you loud and clear. Support station ready. Before we move, we will look back at how this morning began for the crew.', 'Je vous reçois clairement. Station de soutien prête. Avant de nous déplacer, nous allons revoir comment cette matinée a commencé pour l’équipage.'],
  'wiring-enter': ['An outdoor panel lost its link after the last check. Connect each wire to its terminal and avoid short circuits.', 'Un panneau extérieur a perdu sa liaison après la dernière vérification. Reliez chaque câble à sa borne et évitez les courts-circuits.'],
  'wiring-complete': ['Panel link restored. Good work; now it is time to review the communications log.', 'Liaison du panneau rétablie. Bon travail ; il est maintenant temps de revoir le registre des communications.'],
  'tracking-enter': ['The antenna must point precisely. Adjust azimuth and elevation and keep the link stable for a few seconds; the source moves slowly.', 'L’antenne doit pointer avec précision. Réglez l’azimut et l’élévation et maintenez la liaison stable quelques secondes ; la source bouge lentement.'],
  'tracking-complete': ['Antenna aligned. With the signal stable we can recognize it and report that the station is ready.', 'Antenne alignée. Le signal étant stable, nous pouvons le reconnaître et indiquer que la station est prête.'],
  'card-enter': ['To enter the observation area you need clearance. Swipe your card through the reader, not too fast and not too slow.', 'Pour entrer dans la zone d’observation, vous avez besoin d’une accréditation. Passez votre carte dans le lecteur, ni trop vite ni trop lentement.'],
  'card-complete': ['Access granted. Two checks remain before you reach the observation point.', 'Accès accordé. Il reste deux vérifications avant d’arriver au point d’observation.'],
  'sequence-enter': ['This check confirms the panel responds. Watch the light pattern and repeat it in the same order.', 'Cette vérification confirme que le panneau répond. Observez le motif lumineux et répétez-le dans le même ordre.'],
  'sequence-complete': ['Sequence verified. The tracking telemetry still needs to be stabilized.', 'Séquence vérifiée. Il reste à stabiliser la télémétrie de suivi.'],
  'telemetry-enter': ['The telemetry signal is drifting. Keep the reticle on it until it settles completely.', 'Le signal de télémétrie dérive. Gardez le réticule dessus jusqu’à ce qu’il se stabilise complètement.'],
  'telemetry-complete': ['Telemetry stable. You can now head to the observation point.', 'Télémétrie stable. Vous pouvez maintenant vous diriger vers le point d’observation.'],
  'crew-enter': ['This recreation goes back to the early hours of today. There go Armstrong, Collins and Aldrin. After years of preparation, their journey is about to begin.', 'Cette reconstitution revient sur les premières heures de la journée. Les voilà : Armstrong, Collins et Aldrin. Après des années de préparation, leur voyage est sur le point de commencer.'],
  'crew-complete': ['Back to the final preparations. Our work here is done. It is time to head to the observation area.', 'Retour aux derniers préparatifs. Notre travail ici est terminé. Il est temps de nous rendre dans la zone d’observation.'],
  'observation-enter': ['Prepare the camera and check the audio from the marked area. I want you to remember what you are about to see: a journey to another world does not begin every day.', 'Préparez la caméra et vérifiez l’audio depuis la zone indiquée. Je veux que vous reteniez ce que vous allez voir : un voyage vers un autre monde ne commence pas tous les jours.'],
  'observation-complete': ['Observation area confirmed. We stay here. All eyes are now on the Saturn V.', 'Zone d’observation confirmée. Nous restons ici. Tous les regards sont maintenant tournés vers le Saturn V.'],
  'launch-enter': ['Attention, we are entering the final seconds. All eyes are on the Saturn V. Liftoff is scheduled for nine thirty-two.', 'Attention, nous entrons dans les dernières secondes. Tous les regards sont braqués sur le Saturn V. Le lancement est prévu à neuf heures trente-deux.'],
  'launch-complete': ['Liftoff confirmed! There it goes. Apollo 11 is heading into space. Our support log is complete.', 'Décollage confirmé ! Le voilà. Apollo 11 s’élance vers l’espace. Notre registre de soutien est complet.'],
  'epilogue-enter': ['On July 16, 1969, Apollo 11 left Earth. Four days later, Armstrong and Aldrin would reach the surface of the Moon while Collins stayed in lunar orbit.', 'Le 16 juillet 1969, Apollo 11 a quitté la Terre. Quatre jours plus tard, Armstrong et Aldrin atteindraient la surface de la Lune, tandis que Collins restait en orbite lunaire.'],
  'epilogue-complete': ['Mission 01 complete. Apollo 11: the beginning of a new era. Next chapter: the journey to the Moon.', 'Mission 01 terminée. Apollo 11 : le début d’une nouvelle ère. Prochain chapitre : le voyage vers la Lune.'],
};

export function characterText(character: string): string {
  if (getLanguage() === 'es') return character;
  const copy = CHARACTER_COPY[character];
  return copy ? copy[pairIndex()] : character;
}

export function dialogueText(id: string): { character: string; text: string } {
  const source = DIALOGUES.find(dialogue => dialogue.id === id);
  if (!source) return { character: '', text: '' };
  if (getLanguage() === 'es') return { character: source.character, text: source.text };
  const copy = DIALOGUE_COPY[id];
  return { character: characterText(source.character), text: copy ? copy[pairIndex()] : source.text };
}

export const channelPrefix = (channel: string): string => {
  if (channel === 'radio') return '◉ RADIO · ';
  if (channel === 'narrator') return lt(['NARRACIÓN · ', 'NARRATION · ', 'NARRATION · ']);
  return '';
};

// ------------------------------------------------------------------ questions
export interface QuestionCopy { title: L3; copy: L3; options: readonly L3[]; answer: number }

export const QUESTIONS: Record<string, QuestionCopy> = {
  landmark: {
    title: ['Un vehículo para alcanzar la Luna', 'A vehicle to reach the Moon', 'Un lanceur pour atteindre la Lune'],
    copy: ['Observa la silueta blanca y negra sobre la plataforma. Mide aproximadamente 110,6 metros. ¿Qué vehículo llevará al Apollo 11?', 'Look at the white-and-black silhouette on the pad. It is about 110.6 meters tall. Which vehicle will carry Apollo 11?', 'Observez la silhouette blanche et noire sur la rampe. Elle mesure environ 110,6 mètres. Quel lanceur emportera Apollo 11 ?'],
    options: [['Saturn V · AS-506', 'Saturn V · AS-506', 'Saturn V · AS-506'], ['Space Shuttle', 'Space Shuttle', 'Navette spatiale'], ['Saturn IB', 'Saturn IB', 'Saturn IB']],
    answer: 0,
  },
  tower: {
    title: ['Torre umbilical', 'Umbilical tower', 'Tour ombilicale'],
    copy: ['La estructura metálica roja junto al Saturn V proporciona conexiones y acceso. Su brazo de acceso de tripulación se retiró aproximadamente cinco minutos antes del lanzamiento.', 'The red metal structure next to the Saturn V provides connections and access. Its crew access arm was retracted about five minutes before launch.', 'La structure métallique rouge à côté du Saturn V assure les connexions et l’accès. Son bras d’accès de l’équipage a été rétracté environ cinq minutes avant le lancement.'],
    options: [['Torre de servicio umbilical', 'Umbilical service tower', 'Tour de service ombilicale'], ['Torre de control aéreo', 'Air traffic control tower', 'Tour de contrôle aérien'], ['Vehículo de ensamblaje', 'Assembly vehicle', 'Véhicule d’assemblage']],
    answer: 0,
  },
  pad: {
    title: ['Complejo de lanzamiento', 'Launch complex', 'Complexe de lancement'],
    copy: ['El Apollo 11 partió el 16 de julio de 1969 desde el complejo 39 del Centro Espacial Kennedy. Identifica la plataforma.', 'Apollo 11 lifted off on July 16, 1969 from Complex 39 at the Kennedy Space Center. Identify the pad.', 'Apollo 11 a décollé le 16 juillet 1969 depuis le complexe 39 du Centre spatial Kennedy. Identifiez la rampe.'],
    options: [['39B', '39B', '39B'], ['39A', '39A', '39A'], ['Plataforma 34', 'Pad 34', 'Rampe 34']],
    answer: 1,
  },
  vab: {
    title: ['El edificio del horizonte', 'The building on the horizon', 'Le bâtiment à l’horizon'],
    copy: ['Allí se ensambló verticalmente el Saturn V. Solo observamos su exterior; su fachada de 1969 aún no tenía la gran bandera estadounidense añadida en 1976.', 'The Saturn V was assembled vertically there. We only see its exterior; its 1969 facade did not yet have the large American flag added in 1976.', 'Le Saturn V y a été assemblé à la verticale. Nous n’en voyons que l’extérieur ; sa façade de 1969 ne portait pas encore le grand drapeau américain ajouté en 1976.'],
    options: [['Vehicle Assembly Building (VAB)', 'Vehicle Assembly Building (VAB)', 'Vehicle Assembly Building (VAB)'], ['Centro de Houston', 'Houston center', 'Centre de Houston'], ['Un hangar de transbordadores', 'A shuttle hangar', 'Un hangar de navettes']],
    answer: 0,
  },
  log: {
    title: ['Registro de comunicaciones · consulta', 'Communications log · review', 'Registre de communications · consultation'],
    copy: ['INFORME RECIBIDO\nVehículo: Saturn V AS-506\nMisión: Apollo 11\nPlataforma: LC-39A\nLanzamiento programado: 09:32 EDT · 16 JUL 1969\nTripulación: Armstrong / Collins / Aldrin\n\nRegistro educativo ficticio basado en datos históricos. Confirma el vehículo.', 'REPORT RECEIVED\nVehicle: Saturn V AS-506\nMission: Apollo 11\nPad: LC-39A\nScheduled launch: 09:32 EDT · JUL 16, 1969\nCrew: Armstrong / Collins / Aldrin\n\nFictional educational log based on historical data. Confirm the vehicle.', 'RAPPORT REÇU\nVéhicule : Saturn V AS-506\nMission : Apollo 11\nRampe : LC-39A\nLancement prévu : 09 h 32 EDT · 16 JUIL. 1969\nÉquipage : Armstrong / Collins / Aldrin\n\nRegistre éducatif fictif fondé sur des données historiques. Confirmez le véhicule.'],
    options: [['AS-505', 'AS-505', 'AS-505'], ['AS-506', 'AS-506', 'AS-506'], ['AS-507', 'AS-507', 'AS-507']],
    answer: 1,
  },
  report: {
    title: ['Informe de estado recibido', 'Status report received', 'Rapport d’état reçu'],
    copy: ['Comprueba que el destino y la hora coinciden con el registro. Esta tarea simula documentación de apoyo, sin acceso a controles de lanzamiento reales.', 'Check that the destination and time match the log. This task simulates supporting documentation, with no access to real launch controls.', 'Vérifiez que la destination et l’heure correspondent au registre. Cette tâche simule de la documentation de soutien, sans accès à de véritables commandes de lancement.'],
    options: [['LC-39A · 09:32 EDT', 'LC-39A · 09:32 EDT', 'LC-39A · 09:32 EDT'], ['LC-39B · 12:00 EDT', 'LC-39B · 12:00 EDT', 'LC-39B · 12:00 EDT'], ['Houston · 06:27 EDT', 'Houston · 06:27 EDT', 'Houston · 06:27 EDT']],
    answer: 0,
  },
  identify: {
    title: ['Identificación del vehículo', 'Vehicle identification', 'Identification du lanceur'],
    copy: ['La primera etapa S-IC impulsaba el Saturn V al abandonar la plataforma. ¿Cuántos motores F-1 tenía?', 'The S-IC first stage powered the Saturn V as it left the pad. How many F-1 engines did it have?', 'Le premier étage S-IC propulsait le Saturn V à son départ de la rampe. Combien de moteurs F-1 comptait-il ?'],
    options: [['Tres', 'Three', 'Trois'], ['Cuatro', 'Four', 'Quatre'], ['Cinco', 'Five', 'Cinq']],
    answer: 2,
  },
  antenna: {
    title: ['Antenas de apoyo terrestre', 'Ground support antennas', 'Antennes de soutien au sol'],
    copy: ['Las antenas permiten transmitir y recibir señales de radio. La antena representada es una simplificación visual; no una réplica de la red MSFN.', 'Antennas allow radio signals to be sent and received. The antenna shown is a visual simplification, not a replica of the MSFN network.', 'Les antennes permettent d’émettre et de recevoir des signaux radio. L’antenne représentée est une simplification visuelle, et non une réplique du réseau MSFN.'],
    options: [['Comunicación por radio', 'Radio communication', 'Communication radio'], ['Suministro de combustible', 'Fuel supply', 'Alimentation en carburant'], ['Control directo de los motores', 'Direct engine control', 'Commande directe des moteurs']],
    answer: 0,
  },
  signal: {
    title: ['Escucha y verifica · señal simulada', 'Listen and verify · simulated signal', 'Écoutez et vérifiez · signal simulé'],
    copy: ['Canal recibido: APOYO TERRESTRE → LC-39A → RECIBIDO\n\nSelecciona el registro que reproduce la secuencia completa. Si omites un elemento, Carter solicitará repetirlo.', 'Channel received: GROUND SUPPORT → LC-39A → RECEIVED\n\nSelect the log that reproduces the complete sequence. If you leave out an element, Carter will ask you to repeat it.', 'Canal reçu : SOUTIEN AU SOL → LC-39A → REÇU\n\nSélectionnez le registre qui reproduit la séquence complète. Si vous omettez un élément, Carter vous demandera de le répéter.'],
    options: [['LC-39A → APOYO TERRESTRE', 'LC-39A → GROUND SUPPORT', 'LC-39A → SOUTIEN AU SOL'], ['APOYO TERRESTRE → LC-39A → RECIBIDO', 'GROUND SUPPORT → LC-39A → RECEIVED', 'SOUTIEN AU SOL → LC-39A → REÇU'], ['APOYO TERRESTRE → SIN SEÑAL', 'GROUND SUPPORT → NO SIGNAL', 'SOUTIEN AU SOL → AUCUN SIGNAL']],
    answer: 1,
  },
  ready: {
    title: ['Respuesta de la estación', 'Station response', 'Réponse de la station'],
    copy: ['Daniel Carter: «Registro recibido. Nuestra estación de apoyo está lista. Gracias por comprobar cada mensaje.»\n\nSelecciona la confirmación del registro de apoyo.', 'Daniel Carter: “Log received. Our support station is ready. Thank you for checking every message.”\n\nSelect the confirmation of the support log.', 'Daniel Carter : « Registre reçu. Notre station de soutien est prête. Merci d’avoir vérifié chaque message. »\n\nSélectionnez la confirmation du registre de soutien.'],
    options: [['Estación de apoyo lista', 'Support station ready', 'Station de soutien prête'], ['Autorizar motores por cuenta propia', 'Authorize the engines on your own', 'Autoriser les moteurs de sa propre initiative'], ['Cambiar el plan de vuelo', 'Change the flight plan', 'Modifier le plan de vol']],
    answer: 0,
  },
  camera: {
    title: ['Preparar la cámara de seguimiento', 'Prepare the tracking camera', 'Préparer la caméra de suivi'],
    copy: ['Alinea la cámara con el Saturn V desde el área autorizada. En este escenario las distancias están comprimidas: el punto representa un observador a 5,6 km de la plataforma. La autorización incluye un traslado hasta ese punto remoto.', 'Align the camera with the Saturn V from the authorized area. In this scenario distances are compressed: the point represents an observer 5.6 km from the pad. The authorization includes a transfer to that remote point.', 'Alignez la caméra sur le Saturn V depuis la zone autorisée. Dans ce scénario, les distances sont compressées : le point représente un observateur situé à 5,6 km de la rampe. L’autorisation inclut un transfert jusqu’à ce point éloigné.'],
    options: [['Encuadrar la plataforma desde el área segura', 'Frame the pad from the safe area', 'Cadrer la rampe depuis la zone sûre'], ['Acercarme a la base del Saturn V', 'Move closer to the base of the Saturn V', 'Me rapprocher de la base du Saturn V']],
    answer: 0,
  },
  audio: {
    title: ['Canal de observación', 'Observation channel', 'Canal d’observation'],
    copy: ['Recibirás una recreación de comunicaciones con subtítulos. El sonido de los motores llegará con unos 16,3 segundos de retardo, equivalente a 5,6 km a 343 m/s.', 'You will receive a recreation of communications with subtitles. The sound of the engines will arrive with about 16.3 seconds of delay, equivalent to 5.6 km at 343 m/s.', 'Vous recevrez une reconstitution des communications avec sous-titres. Le son des moteurs arrivera avec environ 16,3 secondes de retard, soit 5,6 km à 343 m/s.'],
    options: [['Confirmar recepción del canal de apoyo', 'Confirm reception of the support channel', 'Confirmer la réception du canal de soutien'], ['Transmitir a los astronautas', 'Transmit to the astronauts', 'Transmettre aux astronautes']],
    answer: 0,
  },
  authorize: {
    title: ['Todo preparado', 'Everything ready', 'Tout est prêt'],
    copy: ['Carter: «Nuestro trabajo aquí ha terminado. Quiero que recuerdes lo que vas a ver. No todos los días comienza un viaje a otro mundo.»\n\nLa secuencia solo se habilita después de preparar cámara y audio.', 'Carter: “Our work here is done. I want you to remember what you are about to see. A journey to another world does not begin every day.”\n\nThe sequence is only enabled after preparing camera and audio.', 'Carter : « Notre travail ici est terminé. Je veux que vous reteniez ce que vous allez voir. Un voyage vers un autre monde ne commence pas tous les jours. »\n\nLa séquence n’est activée qu’après la préparation de la caméra et de l’audio.'],
    options: [['Solicitar autorización de observación', 'Request observation authorization', 'Demander l’autorisation d’observation'], ['Iniciar lanzamiento sin comprobaciones', 'Start the launch without checks', 'Lancer sans vérifications']],
    answer: 0,
  },
};

// ------------------------------------------------------------------ interface
const UI = {
  loading: ['PREPARANDO OPERACIONES · APOLLO 11', 'PREPARING OPERATIONS · APOLLO 11', 'PRÉPARATION DES OPÉRATIONS · APOLLO 11'],
  webglError: ['No se pudo iniciar la escena 3D. Comprueba que WebGL está disponible.', 'Could not start the 3D scene. Check that WebGL is available.', 'Impossible de démarrer la scène 3D. Vérifiez que WebGL est disponible.'],
  backToMissions: ['Volver a misiones', 'Back to missions', 'Retour aux missions'],
  offlineDevice: ['Sin conexión · guardado en este dispositivo', 'Offline · saved on this device', 'Hors ligne · enregistré sur cet appareil'],
  audioUnavailable: ['Audio no disponible; los subtítulos permanecen activos.', 'Audio unavailable; subtitles remain active.', 'Audio indisponible ; les sous-titres restent actifs.'],
  markSubtitle: ['CENTRO ESPACIAL KENNEDY · 16 JUL 1969', 'KENNEDY SPACE CENTER · JUL 16, 1969', 'CENTRE SPATIAL KENNEDY · 16 JUIL. 1969'],
  mapBtn: ['Mapa · M', 'Map · M', 'Carte · M'],
  radioBtn: ['Radio · R', 'Radio · R', 'Radio · R'],
  zoomBtn: ['Zoom', 'Zoom', 'Zoom'],
  pauseBtn: ['Pausa', 'Pause', 'Pause'],
  objectiveAria: ['Objetivo actual', 'Current objective', 'Objectif actuel'],
  miniMapAria: ['Abrir mapa de Kennedy', 'Open Kennedy map', 'Ouvrir la carte de Kennedy'],
  miniMapLabel: ['LC-39A · MAPA / M', 'LC-39A · MAP / M', 'LC-39A · CARTE / M'],
  help: ['WASD / Flechas · Moverse     Shift · Caminar rápido     Arrastrar · Mirar     E · Interactuar', 'WASD / Arrows · Move     Shift · Walk faster     Drag · Look     E · Interact', 'WASD / Flèches · Se déplacer     Maj · Marcher plus vite     Glisser · Regarder     E · Interagir'],
  welcomeTitle: ['El comienzo de una nueva era', 'The beginning of a new era', 'Le début d’une nouvelle ère'],
  welcomeBody: ['16 de julio de 1969 · Centro Espacial Kennedy, Florida. Eres un técnico ficticio de apoyo a operaciones terrestres. Observa, documenta y comunica: tu trabajo termina en un punto seguro, antes del despegue de las 9:32 a. m. EDT.', 'July 16, 1969 · Kennedy Space Center, Florida. You are a fictional ground-operations support technician. Observe, document and communicate: your work ends at a safe point, before the 9:32 a.m. EDT liftoff.', '16 juillet 1969 · Centre spatial Kennedy, Floride. Vous êtes un technicien fictif de soutien aux opérations au sol. Observez, documentez et communiquez : votre travail s’arrête en un point sûr, avant le décollage de 9 h 32 EDT.'],
  welcomeNote: ['Recreación educativa. Daniel Carter y los diálogos son ficticios. Las rutas se han acortado; no hay interiores accesibles. Los trajes Mercenary son una adaptación artística, no réplicas del A7L.', 'Educational recreation. Daniel Carter and the dialogues are fictional. Routes have been shortened; no interiors are accessible. The Mercenary suits are an artistic adaptation, not replicas of the A7L.', 'Reconstitution éducative. Daniel Carter et les dialogues sont fictifs. Les parcours ont été raccourcis ; aucun intérieur n’est accessible. Les combinaisons Mercenary sont une adaptation artistique, et non des répliques de la A7L.'],
  viewEpilogue: ['Ver epílogo', 'View epilogue', 'Voir l’épilogue'],
  continueMission: ['Continuar misión', 'Continue mission', 'Continuer la mission'],
  beginOps: ['Comenzar operaciones', 'Begin operations', 'Commencer les opérations'],
  inspectSketchfab: ['Inspeccionar Saturn V · Sketchfab', 'Inspect Saturn V · Sketchfab', 'Inspecter le Saturn V · Sketchfab'],
  backToSelector: ['Volver al selector', 'Back to selector', 'Retour à la sélection'],
  objectiveSmall: ['MISIÓN 01 — APOLLO 11', 'MISSION 01 — APOLLO 11', 'MISSION 01 — APOLLO 11'],
  saveDefault: ['Guardado automático al completar cada etapa', 'Autosave when each stage is completed', 'Enregistrement automatique à chaque étape terminée'],
  saveLocalSync: ['Guardado local · sincronizando…', 'Saved locally · syncing…', 'Enregistré localement · synchronisation…'],
  saveNoLocalSync: ['Almacenamiento local no disponible · sincronizando…', 'Local storage unavailable · syncing…', 'Stockage local indisponible · synchronisation…'],
  saveSynced: ['Registro guardado y sincronizado', 'Log saved and synced', 'Registre enregistré et synchronisé'],
  saveLocalOffline: ['Guardado local · sin conexión al servidor', 'Saved locally · no server connection', 'Enregistré localement · pas de connexion au serveur'],
  transferDone: ['Traslado completado · área de observación a 5,6 km de LC-39A', 'Transfer complete · observation area 5.6 km from LC-39A', 'Transfert terminé · zone d’observation à 5,6 km de LC-39A'],
  followMarker: ['Sigue el marcador hasta la estación autorizada.', 'Follow the marker to the authorized station.', 'Suivez le marqueur jusqu’à la station autorisée.'],
  orientNote: ['WASD o flechas para moverte; arrastra la vista con el ratón. Pulsa M para consultar el mapa. Este registro valida la orientación; no controla el lanzamiento.', 'WASD or arrow keys to move; drag the view with the mouse. Press M to check the map. This log validates orientation; it does not control the launch.', 'WASD ou les flèches pour vous déplacer ; faites glisser la vue avec la souris. Appuyez sur M pour consulter la carte. Ce registre valide l’orientation ; il ne commande pas le lancement.'],
  backToTour: ['Regresar al recorrido', 'Back to the tour', 'Retour au parcours'],
  needCameraAudio: ['Prepara primero la cámara y confirma el audio.', 'Prepare the camera and confirm the audio first.', 'Préparez d’abord la caméra et confirmez l’audio.'],
  needLog: ['Consulta primero el registro recibido.', 'Review the log received first.', 'Consultez d’abord le registre reçu.'],
  needAntennaSignal: ['Revisa primero la antena y la señal.', 'Check the antenna and the signal first.', 'Vérifiez d’abord l’antenne et le signal.'],
  techKicker: ['CONVERSACIÓN PRESENCIAL · PERSONAJE FICTICIO', 'IN-PERSON CONVERSATION · FICTIONAL CHARACTER', 'CONVERSATION EN PERSONNE · PERSONNAGE FICTIF'],
  techTitle: ['Técnico de plataforma', 'Pad technician', 'Technicien de rampe'],
  techBody: ['«La mayor parte del trabajo ya está hecha. El Saturn V se encuentra preparado en su plataforma. El crawler-transporter lo trasladó aquí semanas antes; hoy ya no está debajo del cohete.»', '“Most of the work is already done. The Saturn V is ready on its pad. The crawler-transporter brought it here weeks ago; today it is no longer under the rocket.”', '« L’essentiel du travail est déjà fait. Le Saturn V est prêt sur sa rampe. Le crawler-transporteur l’a amené ici des semaines plus tôt ; aujourd’hui, il n’est plus sous la fusée. »'],
  techSubtitle: ['La mayor parte del trabajo ya está hecha. El Saturn V se encuentra preparado en su plataforma.', 'Most of the work is already done. The Saturn V is ready on its pad.', 'L’essentiel du travail est déjà fait. Le Saturn V est prêt sur sa rampe.'],
  logConversation: ['Registrar conversación', 'Log conversation', 'Enregistrer la conversation'],
  notebookKicker: ['CUADERNO DE OPERACIONES · ACTIVIDAD SIMULADA', 'OPERATIONS NOTEBOOK · SIMULATED ACTIVITY', 'CARNET D’OPÉRATIONS · ACTIVITÉ SIMULÉE'],
  wrongAnswer: ['Revisa los datos del registro y vuelve a intentarlo. No se ha avanzado el checkpoint.', 'Review the log data and try again. The checkpoint has not advanced.', 'Vérifiez les données du registre et réessayez. Le point de contrôle n’a pas avancé.'],
  backToLog: ['Volver al registro', 'Back to the log', 'Retour au registre'],
  skipIntro: ['Omitir introducción', 'Skip introduction', 'Passer l’introduction'],
  introPlace: ['FLORIDA, ESTADOS UNIDOS', 'FLORIDA, UNITED STATES', 'FLORIDE, ÉTATS-UNIS'],
  introDate: ['16 DE JULIO DE 1969', 'JULY 16, 1969', '16 JUILLET 1969'],
  introCenter: ['CENTRO ESPACIAL KENNEDY', 'KENNEDY SPACE CENTER', 'CENTRE SPATIAL KENNEDY'],
  narrationLabel: ['NARRACIÓN ORIGINAL', 'ORIGINAL NARRATION', 'NARRATION ORIGINALE'],
  missionLabel: ['MISIÓN 01', 'MISSION 01', 'MISSION 01'],
  newEra: ['EL COMIENZO DE UNA NUEVA ERA', 'THE BEGINNING OF A NEW ERA', 'LE DÉBUT D’UNE NOUVELLE ÈRE'],
  crewLabel1: ['RECREACIÓN HISTÓRICA RETROSPECTIVA · 06:27 EDT', 'RETROSPECTIVE HISTORICAL RECREATION · 06:27 EDT', 'RECONSTITUTION HISTORIQUE RÉTROSPECTIVE · 06:27 EDT'],
  crewLabel2: ['TRANSICIÓN TEMPORAL · 09:30 EDT', 'TIME TRANSITION · 09:30 EDT', 'TRANSITION TEMPORELLE · 09:30 EDT'],
  crewTitle1: ['EL CAMINO HACIA APOLLO 11', 'THE ROAD TO APOLLO 11', 'LA ROUTE VERS APOLLO 11'],
  crewTitle2: ['TRIPULACIÓN A BORDO', 'CREW ON BOARD', 'ÉQUIPAGE À BORD'],
  crewText1: ['Daniel Carter (ficticio): «Ahí van. Armstrong, Collins y Aldrin. Después de tantos años de preparación, todo se reduce a este momento.»', 'Daniel Carter (fictional): “There they go. Armstrong, Collins and Aldrin. After so many years of preparation, it all comes down to this moment.”', 'Daniel Carter (fictif) : « Les voilà. Armstrong, Collins et Aldrin. Après tant d’années de préparation, tout se résume à ce moment. »'],
  crewText2: ['El traslado y el embarque han concluido. Regresamos a los preparativos finales de observación.', 'The transfer and boarding are complete. We return to the final observation preparations.', 'Le transfert et l’embarquement sont terminés. Nous revenons aux derniers préparatifs d’observation.'],
  launchLabel: ['16 JUL 1969 · 09:32 EDT · LC-39A', 'JUL 16, 1969 · 09:32 EDT · LC-39A', '16 JUIL. 1969 · 09:32 EDT · LC-39A'],
  liftoff: ['DESPEGUE', 'LIFTOFF', 'DÉCOLLAGE'],
  climbing: ['APOLLO 11 · EN ASCENSO', 'APOLLO 11 · CLIMBING', 'APOLLO 11 · EN ASCENSION'],
  launchText1: ['Daniel Carter (ficticio): «Atención, estamos entrando en los últimos segundos. Toda la atención está puesta sobre el Saturn V.»', 'Daniel Carter (fictional): “Attention, we are entering the final seconds. All eyes are on the Saturn V.”', 'Daniel Carter (fictif) : « Attention, nous entrons dans les dernières secondes. Tous les regards sont braqués sur le Saturn V. »'],
  launchConfirmed: ['Daniel Carter (ficticio): «¡Despegue confirmado!»', 'Daniel Carter (fictional): “Liftoff confirmed!”', 'Daniel Carter (fictif) : « Décollage confirmé ! »'],
  launchFinal: ['Daniel Carter (ficticio): «Ahí está. Apollo 11 se dirige hacia el espacio.»', 'Daniel Carter (fictional): “There it goes. Apollo 11 is heading into space.”', 'Daniel Carter (fictif) : « Le voilà. Apollo 11 s’élance vers l’espace. »'],
  endKickerDone: ['MISIÓN 01 COMPLETADA', 'MISSION 01 COMPLETE', 'MISSION 01 TERMINÉE'],
  endKickerEpilogue: ['EPÍLOGO · 16 DE JULIO DE 1969', 'EPILOGUE · JULY 16, 1969', 'ÉPILOGUE · 16 JUILLET 1969'],
  endTitle: ['Apollo 11 dejó la Tierra', 'Apollo 11 left Earth', 'Apollo 11 a quitté la Terre'],
  endBody: ['Cuatro días después, el 20 de julio, Neil Armstrong y Buzz Aldrin alunizaron en el Eagle. Michael Collins permaneció en órbita lunar a bordo del Columbia. Esos acontecimientos pertenecen al próximo capítulo.', 'Four days later, on July 20, Neil Armstrong and Buzz Aldrin landed on the Moon in Eagle. Michael Collins stayed in lunar orbit aboard Columbia. Those events belong to the next chapter.', 'Quatre jours plus tard, le 20 juillet, Neil Armstrong et Buzz Aldrin se sont posés sur la Lune à bord d’Eagle. Michael Collins est resté en orbite lunaire à bord de Columbia. Ces événements appartiennent au prochain chapitre.'],
  nextChapter: ['PRÓXIMO CAPÍTULO: EL VIAJE HACIA LA LUNA', 'NEXT CHAPTER: THE JOURNEY TO THE MOON', 'PROCHAIN CHAPITRE : LE VOYAGE VERS LA LUNE'],
  backSelector: ['Regresar al selector', 'Back to selector', 'Retour à la sélection'],
  completeReturn: ['Completar misión y regresar', 'Complete mission and return', 'Terminer la mission et revenir'],
  sourcesBtn: ['Fuentes históricas y créditos', 'Historical sources and credits', 'Sources historiques et crédits'],
  reportQueued: ['Misión guardada localmente; la sincronización del informe queda pendiente.', 'Mission saved locally; report sync is pending.', 'Mission enregistrée localement ; la synchronisation du rapport est en attente.'],
  pauseKicker: ['OPERACIONES EN PAUSA', 'OPERATIONS PAUSED', 'OPÉRATIONS EN PAUSE'],
  pauseTitle: ['Un momento antes de la historia', 'A moment before history', 'Un instant avant l’histoire'],
  continue: ['Continuar', 'Continue', 'Continuer'],
  audioOn: ['Activar audio', 'Turn audio on', 'Activer l’audio'],
  audioMute: ['Silenciar audio', 'Mute audio', 'Couper l’audio'],
  restartMission: ['Reiniciar misión', 'Restart mission', 'Redémarrer la mission'],
  pauseMapKicker: ['MAPA DE OPERACIONES', 'OPERATIONS MAP', 'CARTE DES OPÉRATIONS'],
  inspect3d: ['Inspección 3D · modelo Sketchfab', '3D inspection · Sketchfab model', 'Inspection 3D · modèle Sketchfab'],
  sourcesCredits: ['Fuentes y créditos', 'Sources and credits', 'Sources et crédits'],
  resetKicker: ['REINICIAR MISIÓN 01', 'RESTART MISSION 01', 'REDÉMARRER LA MISSION 01'],
  resetTitle: ['Volver al comienzo', 'Back to the beginning', 'Retour au début'],
  resetBody: ['Se reiniciarán únicamente los checkpoints y diálogos de Apollo 11. El progreso de otras misiones se conserva.', 'Only the Apollo 11 checkpoints and dialogues will be restarted. Progress in other missions is kept.', 'Seuls les points de contrôle et les dialogues d’Apollo 11 seront réinitialisés. La progression des autres missions est conservée.'],
  resetBtn: ['Reiniciar Apollo 11', 'Restart Apollo 11', 'Redémarrer Apollo 11'],
  cancel: ['Cancelar', 'Cancel', 'Annuler'],
  resetFail: ['No se pudo reiniciar en el servidor. Comprueba la conexión.', 'Could not restart on the server. Check your connection.', 'Impossible de redémarrer sur le serveur. Vérifiez la connexion.'],
  mapKicker: ['MAPA DE OPERACIONES · GEOGRAFÍA COMPRIMIDA', 'OPERATIONS MAP · COMPRESSED GEOGRAPHY', 'CARTE DES OPÉRATIONS · GÉOGRAPHIE COMPRESSÉE'],
  mapTitle: ['Centro Espacial Kennedy', 'Kennedy Space Center', 'Centre spatial Kennedy'],
  mapNote: ['N ↑ · Verde: completado · Ámbar: destino activo · Rojo: perímetro restringido. Las coordenadas del mapa corresponden al escenario. Las conexiones son una adaptación jugable de las distancias reales.', 'N ↑ · Green: completed · Amber: active destination · Red: restricted perimeter. Map coordinates correspond to the scenario. The connections are a playable adaptation of the real distances.', 'N ↑ · Vert : terminé · Ambre : destination active · Rouge : périmètre interdit. Les coordonnées de la carte correspondent au scénario. Les liaisons sont une adaptation jouable des distances réelles.'],
  backToOps: ['Volver a operaciones', 'Back to operations', 'Retour aux opérations'],
  mapObservation: ['OBSERVACIÓN · 5,6 km', 'OBSERVATION · 5.6 km', 'OBSERVATION · 5,6 km'],
  skKicker: ['VISOR OFICIAL EXTERNO · NO INTEGRADO EN EL ESCENARIO', 'OFFICIAL EXTERNAL VIEWER · NOT INTEGRATED INTO THE SCENE', 'VISIONNEUSE OFFICIELLE EXTERNE · NON INTÉGRÉE À LA SCÈNE'],
  skTitle: ['Saturn V de HUuser2024', 'Saturn V by HUuser2024', 'Saturn V par HUuser2024'],
  skBody: ['LEGO Animated Saturn V Apollo 11 Rocket launch · 1 animación · 10.291.703 caras. Licencia Standard, sin descarga autorizada disponible. El lanzamiento del escenario utiliza una recreación original independiente.', 'LEGO Animated Saturn V Apollo 11 Rocket launch · 1 animation · 10,291,703 faces. Standard license, no authorized download available. The scene’s launch uses an independent original recreation.', 'LEGO Animated Saturn V Apollo 11 Rocket launch · 1 animation · 10 291 703 faces. Licence Standard, aucun téléchargement autorisé disponible. Le lancement de la scène utilise une reconstitution originale indépendante.'],
  skFrameTitle: ['Visor oficial Sketchfab del Saturn V de HUuser2024', 'Official Sketchfab viewer of the Saturn V by HUuser2024', 'Visionneuse officielle Sketchfab du Saturn V par HUuser2024'],
  skError: ['El visor requiere conexión con Sketchfab. Puedes continuar la misión sin él.', 'The viewer needs a connection to Sketchfab. You can continue the mission without it.', 'La visionneuse nécessite une connexion à Sketchfab. Vous pouvez poursuivre la mission sans elle.'],
  skUnavailable: ['Sketchfab no está disponible. El escenario jugable funciona de forma independiente.', 'Sketchfab is unavailable. The playable scene works independently.', 'Sketchfab est indisponible. La scène jouable fonctionne de manière indépendante.'],
  skLink: ['Abrir ficha y condiciones del autor', 'Open the model page and author’s terms', 'Ouvrir la fiche et les conditions de l’auteur'],
  back: ['Volver', 'Back', 'Retour'],
  crKicker: ['FUENTES, LICENCIAS Y ADAPTACIONES', 'SOURCES, LICENSES AND ADAPTATIONS', 'SOURCES, LICENCES ET ADAPTATIONS'],
  crTitle: ['Una recreación de un día real', 'A recreation of a real day', 'Une reconstitution d’un jour réel'],
  crBody: ['Hechos documentados: Apollo 11, Saturn V AS-506, lanzamiento desde 39A el 16 de julio de 1969 a las 09:32 EDT. Traslado de la tripulación a las 06:27 EDT. Epílogo lunar del 20 de julio.', 'Documented facts: Apollo 11, Saturn V AS-506, launch from 39A on July 16, 1969 at 09:32 EDT. Crew transfer at 06:27 EDT. Lunar epilogue of July 20.', 'Faits documentés : Apollo 11, Saturn V AS-506, lancement depuis 39A le 16 juillet 1969 à 09 h 32 EDT. Transfert de l’équipage à 06 h 27 EDT. Épilogue lunaire du 20 juillet.'],
  crLinkNasa: ['NASA · Apollo 11', 'NASA · Apollo 11', 'NASA · Apollo 11'],
  crLinkLaunch: ['NASA · El día del lanzamiento', 'NASA · Launch day', 'NASA · Le jour du lancement'],
  crLinkLicense: ['Licencia CC BY 4.0', 'CC BY 4.0 license', 'Licence CC BY 4.0'],
  crNote: ['Mercenary Astronaut fue optimizado y escalado por este proyecto. Tres copias representan a Armstrong, Collins y Aldrin, sin atribuirles diálogos. No son retratos ni reproducciones de sus trajes. Saturn V, edificios, vehículos, música y efectos son originales del proyecto. Carter, las tareas y sus registros son ficticios. El terreno y los recorridos están comprimidos. La película muestra el traslado en retrospectiva; la pantalla negra omite el embarque, sin acceso a interiores.', 'Mercenary Astronaut was optimized and scaled by this project. Three copies represent Armstrong, Collins and Aldrin, without attributing any dialogue to them. They are not portraits or reproductions of their suits. The Saturn V, buildings, vehicles, music and effects are original to the project. Carter, the tasks and their logs are fictional. The terrain and routes are compressed. The film shows the transfer in retrospect; the black screen skips the boarding, with no access to interiors.', 'Mercenary Astronaut a été optimisé et mis à l’échelle par ce projet. Trois copies représentent Armstrong, Collins et Aldrin, sans leur attribuer de dialogues. Ce ne sont ni des portraits ni des reproductions de leurs combinaisons. Le Saturn V, les bâtiments, les véhicules, la musique et les effets sont des créations originales du projet. Carter, les tâches et leurs registres sont fictifs. Le terrain et les parcours sont compressés. Le film montre le transfert de manière rétrospective ; l’écran noir omet l’embarquement, sans accès aux intérieurs.'],
  promptCrew: ['E · Observar a la tripulación', 'E · Watch the crew', 'E · Observer l’équipage'],
  promptLaunch: ['E · Presenciar el lanzamiento', 'E · Watch the launch', 'E · Assister au lancement'],
  promptExamine: ['E · Examinar estación', 'E · Examine station', 'E · Examiner la station'],
  promptPlay: ['E · Iniciar la tarea', 'E · Start the task', 'E · Lancer la tâche'],
} as const satisfies Record<string, L3>;

export type UiKey = keyof typeof UI;
export const ui = (key: UiKey): string => lt(UI[key]);

export const INTRO_LINES: readonly L3[] = [
  ['16 de julio de 1969. Durante años, miles de personas han trabajado para conseguir lo que alguna vez parecía imposible: enviar seres humanos a la Luna.', 'July 16, 1969. For years, thousands of people have worked to achieve what once seemed impossible: sending human beings to the Moon.', '16 juillet 1969. Pendant des années, des milliers de personnes ont travaillé pour accomplir ce qui semblait autrefois impossible : envoyer des êtres humains sur la Lune.'],
  ['Hoy, tres astronautas se preparan para abandonar la Tierra a bordo de la nave Apollo 11.', 'Today, three astronauts are preparing to leave Earth aboard the Apollo 11 spacecraft.', 'Aujourd’hui, trois astronautes s’apprêtent à quitter la Terre à bord du vaisseau Apollo 11.'],
  ['Neil Armstrong, Buzz Aldrin y Michael Collins están a punto de comenzar un viaje que cambiará nuestra historia.', 'Neil Armstrong, Buzz Aldrin and Michael Collins are about to begin a journey that will change our history.', 'Neil Armstrong, Buzz Aldrin et Michael Collins sont sur le point d’entamer un voyage qui changera notre histoire.'],
];

export const COUNTDOWN: readonly L3[] = [
  ['Cinco…', 'Five…', 'Cinq…'], ['Cuatro…', 'Four…', 'Quatre…'], ['Tres…', 'Three…', 'Trois…'], ['Dos…', 'Two…', 'Deux…'], ['Uno…', 'One…', 'Un…'],
];

export const checkpointKicker = (n: number): string => lt([`CHECKPOINT ${n} / ${CHECKPOINTS.length}`, `CHECKPOINT ${n} / ${CHECKPOINTS.length}`, `POINT DE CONTRÔLE ${n} / ${CHECKPOINTS.length}`]);
export const checkpointDone = (n: number): string => lt([`CHECKPOINT ${n} COMPLETADO`, `CHECKPOINT ${n} COMPLETED`, `POINT DE CONTRÔLE ${n} TERMINÉ`]);
export const resumeText = (n: number): string => lt([`Registro recuperado · ${n} de ${CHECKPOINTS.length} checkpoints completados.`, `Log restored · ${n} of ${CHECKPOINTS.length} checkpoints completed.`, `Registre récupéré · ${n} points de contrôle sur ${CHECKPOINTS.length} terminés.`]);
export const distanceTravelled = (title: string, meters: number): string => lt([`${title} · ${meters} m de recorrido simulado`, `${title} · ${meters} m of simulated travel`, `${title} · ${meters} m de parcours simulé`]);

// ------------------------------------------------------------- 3D scene signs
export const WORLD_TEXT = {
  launchObs: ['OBSERVACIÓN DEL LANZAMIENTO', 'LAUNCH OBSERVATION', 'OBSERVATION DU LANCEMENT'],
  safetyDistance: ['DISTANCIA DE SEGURIDAD · 5,6 KM', 'SAFETY DISTANCE · 5.6 KM', 'DISTANCE DE SÉCURITÉ · 5,6 KM'],
  kennedy: ['CENTRO ESPACIAL KENNEDY', 'KENNEDY SPACE CENTER', 'CENTRE SPATIAL KENNEDY'],
  groundOps: ['OPERACIONES TERRESTRES · 1969', 'GROUND OPERATIONS · 1969', 'OPÉRATIONS AU SOL · 1969'],
  pad: ['PLATAFORMA 39A', 'PAD 39A', 'RAMPE 39A'],
  restricted: ['ÁREA RESTRINGIDA · NO PASAR', 'RESTRICTED AREA · DO NOT ENTER', 'ZONE INTERDITE · ACCÈS INTERDIT'],
  rocket: ['SATURN V · AS-506 · LC-39A', 'SATURN V · AS-506 · LC-39A', 'SATURN V · AS-506 · LC-39A'],
  vab: ['EDIFICIO DE ENSAMBLAJE DE VEHÍCULOS (VAB)', 'VEHICLE ASSEMBLY BUILDING (VAB)', 'BÂTIMENT D’ASSEMBLAGE DES VÉHICULES (VAB)'],
  s1: ['ORIENTACIÓN', 'ORIENTATION', 'ORIENTATION'],
  s1sub: ['01 · OPERACIONES DE APOYO', '01 · SUPPORT OPERATIONS', '01 · OPÉRATIONS DE SOUTIEN'],
  s2: ['RECONOCIMIENTO', 'RECONNAISSANCE', 'RECONNAISSANCE'],
  s2sub: ['02 · OBSERVACIÓN DEL COMPLEJO', '02 · COMPLEX OBSERVATION', '02 · OBSERVATION DU COMPLEXE'],
  s3: ['DOCUMENTACIÓN', 'DOCUMENTATION', 'DOCUMENTATION'],
  s3sub: ['04 · REGISTRO DE COMUNICACIONES', '04 · COMMUNICATIONS LOG', '04 · REGISTRE DES COMMUNICATIONS'],
  s4: ['COMUNICACIONES', 'COMMUNICATIONS', 'COMMUNICATIONS'],
  s4sub: ['06 · ESTACIÓN DE APOYO', '06 · SUPPORT STATION', '06 · STATION DE SOUTIEN'],
  s5: ['LA TRIPULACIÓN', 'THE CREW', 'L’ÉQUIPAGE'],
  s5sub: ['07 · RECREACIÓN HISTÓRICA', '07 · HISTORICAL RECREATION', '07 · RECONSTITUTION HISTORIQUE'],
  s6: ['OBSERVACIÓN', 'OBSERVATION', 'OBSERVATION'],
  s6sub: ['11 · CÁMARA DE SEGUIMIENTO', '11 · TRACKING CAMERA', '11 · CAMÉRA DE SUIVI'],
  sWiring: ['PANEL DE ENLACE', 'LINK PANEL', 'PANNEAU DE LIAISON'],
  sWiringSub: ['03 · CABLEADO EXTERIOR', '03 · OUTDOOR WIRING', '03 · CÂBLAGE EXTÉRIEUR'],
  sTracking: ['SEGUIMIENTO', 'TRACKING', 'POURSUITE'],
  sTrackingSub: ['05 · ALINEACIÓN DE ANTENA', '05 · ANTENNA ALIGNMENT', '05 · ALIGNEMENT D’ANTENNE'],
  sCard: ['CONTROL DE ACCESO', 'ACCESS CONTROL', 'CONTRÔLE D’ACCÈS'],
  sCardSub: ['08 · LECTOR DE TARJETAS', '08 · CARD READER', '08 · LECTEUR DE CARTES'],
  sSequence: ['VERIFICACIÓN', 'VERIFICATION', 'VÉRIFICATION'],
  sSequenceSub: ['09 · SECUENCIA DE LUCES', '09 · LIGHT SEQUENCE', '09 · SÉQUENCE LUMINEUSE'],
  sTelemetry: ['TELEMETRÍA', 'TELEMETRY', 'TÉLÉMÉTRIE'],
  sTelemetrySub: ['10 · ESTABILIZACIÓN DE SEÑAL', '10 · SIGNAL STABILIZATION', '10 · STABILISATION DU SIGNAL'],
} as const satisfies Record<string, L3>;
export const world = (key: keyof typeof WORLD_TEXT): string => lt(WORLD_TEXT[key]);
