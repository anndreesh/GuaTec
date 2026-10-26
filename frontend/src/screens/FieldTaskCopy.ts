import { getLanguage } from "../core/i18n";
import type { FieldTaskId } from "../state/Mission01FieldTasks";

/** Stable keys shared by field stations, task controls and the saved report. */
const copy: Record<string, readonly [string, string, string]> = {
  "task.assembly": ["Montaje del bastidor", "Frame assembly", "Assemblage du châssis"],
  "task.mass": ["Balance de masa", "Mass balance", "Équilibrage de la masse"],
  "task.calibration": ["Calibración de instrumentos", "Instrument calibration", "Étalonnage des instruments"],
  "task.route": ["Inspección de ruta", "Route inspection", "Inspection du trajet"],
  "task.weather": ["Lectura meteorológica", "Weather reading", "Relevé météorologique"],
  "task.signal": ["Recuperación de señal", "Signal recovery", "Rétablissement du signal"],
  "task.recovery": ["Recuperación de registros", "Record recovery", "Récupération des relevés"],
  "common.progress": ["Progreso de la estación", "Station progress", "Progression de la station"],
  "common.ready": ["Registro listo", "Record ready", "Relevé prêt"],
  "common.working": ["En preparación", "In preparation", "En préparation"],
  "common.success": ["Prueba completada. Confirma el registro para guardar el resultado.", "Test complete. Confirm the record to save the result.", "Essai terminé. Confirmez le relevé pour sauvegarder le résultat."],
  "common.abstract": ["Piezas y unidades abstractas de una simulación educativa.", "Abstract parts and units in an educational simulation.", "Pièces et unités abstraites d’une simulation éducative."],
  "common.selected": ["Seleccionado", "Selected", "Sélectionné"],
  "assembly.instructions": ["Encaja las cuatro piezas en sus siluetas. Arrastra o selecciona una pieza y después su hueco. Gira la pieza cuando su orientación no coincida.", "Fit the four parts into their silhouettes. Drag, or select a part followed by its socket. Rotate the part when its orientation does not match.", "Placez les quatre pièces dans leurs silhouettes. Glissez-les ou sélectionnez une pièce puis son emplacement. Tournez la pièce si son orientation ne correspond pas."],
  "assembly.support": ["Soporte", "Bracket", "Support"],
  "assembly.plate": ["Placa", "Plate", "Plaque"],
  "assembly.ring": ["Anillo", "Ring", "Anneau"],
  "assembly.marker": ["Marcador", "Marker", "Repère"],
  "assembly.parts": ["Piezas disponibles", "Available parts", "Pièces disponibles"],
  "assembly.sockets": ["Plano de montaje", "Assembly drawing", "Plan d’assemblage"],
  "assembly.socket": ["Encajar en silueta", "Fit into silhouette", "Placer dans la silhouette"],
  "assembly.rotate": ["Girar pieza · 90°", "Rotate part · 90°", "Tourner la pièce · 90°"],
  "assembly.select": ["Selecciona una pieza para encajarla o girarla.", "Select a part to fit or rotate it.", "Sélectionnez une pièce pour la placer ou la tourner."],
  "assembly.wrongPart": ["Esta silueta corresponde a otra pieza. Puedes corregirla sin perder lo montado.", "This silhouette belongs to another part. Correct it without losing the assembled parts.", "Cette silhouette correspond à une autre pièce. Corrigez-la sans perdre les pièces montées."],
  "assembly.wrongRotation": ["La pieza es correcta, pero su orientación no coincide. Gírala y vuelve a encajarla.", "The part is correct, but its orientation does not match. Rotate it and fit it again.", "La pièce est correcte, mais mal orientée. Tournez-la puis replacez-la."],
  "assembly.fitted": ["Pieza fijada. Continúa con la siguiente silueta.", "Part secured. Continue with the next silhouette.", "Pièce fixée. Passez à la silhouette suivante."],
  "mass.instructions": ["Coloca al menos tres bloques sobre los cuatro apoyos. Equilibra ambos brazos usando como máximo 8 unidades de carga. Arrastra o selecciona bloque y apoyo; devuelve los que sobren a la bandeja.", "Place at least three blocks on the four supports. Balance both arms using no more than 8 load units. Drag, or select a block and a support; return spare blocks to the tray.", "Placez au moins trois blocs sur les quatre supports. Équilibrez les deux bras avec au plus 8 unités de charge. Glissez-les ou sélectionnez un bloc puis un support ; remettez les blocs inutilisés dans le plateau."],
  "mass.tray": ["Bandeja · devolver bloque", "Tray · return block", "Plateau · remettre le bloc"],
  "mass.block": ["Bloque", "Block", "Bloc"],
  "mass.support": ["Apoyo", "Support", "Support"],
  "mass.load": ["Carga", "Load", "Charge"],
  "mass.torque": ["Diferencia entre brazos", "Arm difference", "Écart entre les bras"],
  "mass.measure": ["Registrar pesaje", "Record weighing", "Enregistrer la pesée"],
  "mass.select": ["Selecciona un bloque y su apoyo. Los apoyos exteriores tienen el doble de palanca.", "Select a block and its support. The outer supports have twice the leverage.", "Sélectionnez un bloc puis son support. Les supports extérieurs ont un bras de levier double."],
  "mass.tooFew": ["La plataforma necesita al menos tres bloques. Añade otra carga y vuelve a medir.", "The platform needs at least three blocks. Add another load and measure again.", "La plateforme exige au moins trois blocs. Ajoutez une charge puis mesurez à nouveau."],
  "mass.tooHeavy": ["La carga supera las 8 unidades. Retira un bloque y redistribuye los restantes.", "The load exceeds 8 units. Remove a block and redistribute the remaining ones.", "La charge dépasse 8 unités. Retirez un bloc puis répartissez les autres."],
  "mass.unbalanced": ["La aguja está fuera del centro. Cambia los bloques de apoyo hasta equilibrar ambos brazos.", "The needle is off center. Move the blocks between supports to balance both arms.", "L’aiguille n’est pas centrée. Déplacez les blocs pour équilibrer les deux bras."],
  "mass.moved": ["Carga colocada. Observa la inclinación antes de registrar el pesaje.", "Load placed. Observe the tilt before recording the weighing.", "Charge placée. Observez l’inclinaison avant d’enregistrer la pesée."],
  "calibration.instructions": ["Alinea cada aguja con su marca de referencia y registra la lectura. Gira el dial, usa las flechas del control o los botones − y +. Las tres lecturas deben quedar confirmadas.", "Align each needle with its reference mark and record the reading. Turn the dial, use the slider’s arrow keys, or the − and + buttons. Confirm all three readings.", "Alignez chaque aiguille sur son repère et enregistrez la mesure. Tournez le cadran, utilisez les flèches du curseur ou les boutons − et +. Confirmez les trois mesures."],
  "calibration.dial": ["Instrumento", "Instrument", "Instrument"],
  "calibration.reference": ["Referencia", "Reference", "Référence"],
  "calibration.record": ["Registrar lectura", "Record reading", "Enregistrer la mesure"],
  "calibration.recorded": ["Lectura confirmada", "Reading confirmed", "Mesure confirmée"],
  "calibration.decrease": ["Reducir lectura", "Decrease reading", "Diminuer la mesure"],
  "calibration.increase": ["Aumentar lectura", "Increase reading", "Augmenter la mesure"],
  "calibration.adjust": ["Ajusta la aguja hasta la marca dorada y registra la lectura.", "Adjust the needle to the brass mark and record the reading.", "Amenez l’aiguille sur le repère doré puis enregistrez la mesure."],
  "calibration.noisy": ["Lectura fuera de tolerancia. Acerca la aguja a la referencia y vuelve a registrar.", "Reading outside tolerance. Move the needle toward the reference and record again.", "Mesure hors tolérance. Rapprochez l’aiguille du repère puis recommencez."],
  "calibration.accepted": ["Lectura estable guardada. Calibra el siguiente instrumento.", "Stable reading saved. Calibrate the next instrument.", "Mesure stable enregistrée. Étalonnez l’instrument suivant."],
  "signal.instructions": ["Sigue la señal continua desde el origen hasta el receptor. Arrastra entre terminales o selecciónalos en orden. Dos nodos producen ruido: observa sus trazas antes de conectarlos.", "Follow the continuous signal from source to receiver. Drag between terminals or select them in order. Two nodes produce noise: inspect their traces before connecting them.", "Suivez le signal continu de la source au récepteur. Glissez entre les bornes ou sélectionnez-les dans l’ordre. Deux nœuds produisent du bruit : observez leur trace avant de les relier."],
  "signal.source": ["Origen", "Source", "Source"],
  "signal.receiver": ["Receptor", "Receiver", "Récepteur"],
  "signal.clean": ["Traza continua", "Continuous trace", "Trace continue"],
  "signal.noisy": ["Traza irregular", "Irregular trace", "Trace irrégulière"],
  "signal.connect": ["Conectar terminal", "Connect terminal", "Relier la borne"],
  "signal.start": ["Empieza en el origen y sigue los dos nodos de traza continua.", "Start at the source and follow the two continuous-trace nodes.", "Partez de la source puis suivez les deux nœuds à trace continue."],
  "signal.linked": ["Tramo estable. Continúa desde el terminal iluminado.", "Stable segment. Continue from the lit terminal.", "Segment stable. Continuez depuis la borne allumée."],
  "signal.wrong": ["La señal encontró ruido o un salto de tramo. Vuelve al origen y sigue la traza continua.", "The signal hit noise or skipped a segment. Return to the source and follow the continuous trace.", "Le signal rencontre du bruit ou saute un segment. Repartez de la source et suivez la trace continue."],
};

export function fieldText(key: string): string {
  const languageIndex = { es: 0, en: 1, fr: 2 }[getLanguage()];
  return copy[key]?.[languageIndex] ?? key;
}

export function fieldTaskLabel(id: FieldTaskId): string {
  return fieldText(`task.${id}`);
}
