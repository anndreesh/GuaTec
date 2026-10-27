type Copy=readonly [string,string,string];
const handoff=(purpose:Copy,reply:Copy)=>({purpose:purpose[0],reply:reply[0],translations:[purpose,reply]});

/** Fictional support records connect each exercise to the next historical activity.
 * These messages describe the game workflow, never real launch-system authority. */
export const STAND_HANDOFFS:Readonly<Record<string,ReturnType<typeof handoff>>>={
  'power-bus':handoff(
    ['El banco alimenta los instrumentos de práctica que usarás en el recorrido.','The bench powers the practice instruments used along the route.','Ce banc alimente les instruments d’exercice utilisés pendant le parcours.'],
    ['Banco estable. Vuelve a orientación para reconocer el Saturn V y consultar el mapa.','Bench stable. Return to orientation to identify Saturn V and consult the map.','Banc stable. Retournez à l’orientation pour reconnaître Saturn V et consulter la carte.']),
  'flight-record':handoff(
    ['La secuencia de preparación da contexto a las estructuras que observarás desde el puesto óptico.','The preparation sequence explains the structures you will observe from the optical station.','La séquence de préparation donne un contexte aux structures observées depuis le poste optique.'],
    ['Secuencia archivada. El puesto óptico está listo para completar el reconocimiento del complejo.','Sequence filed. The optical station is ready to complete the complex survey.','Séquence archivée. Le poste optique est prêt pour terminer la reconnaissance du complexe.']),
  'telemetry-rack':handoff(
    ['Primero estabilizas las lecturas; después compruebas que los cables llevan cada canal al lugar correcto.','First stabilize the readings; then verify that the cables carry each channel to the right terminal.','Stabilisez les mesures, puis vérifiez que les câbles relient chaque canal à la bonne borne.'],
    ['Lecturas estables. Continúa con el panel de conexiones del mismo patio técnico.','Readings stable. Continue to the connection panel in the same technical yard.','Mesures stables. Passez au panneau de connexions dans la même aire technique.']),
  'umbilical-check':handoff(
    ['La continuidad del panel de práctica cierra la comprobación que acompaña al registro técnico.','Continuity on the practice panel completes the check accompanying the technical record.','La continuité du panneau d’exercice termine la vérification qui accompagne le registre technique.'],
    ['Continuidad confirmada. Ya puedes cotejar los datos en la mesa de documentación.','Continuity confirmed. You can now check the data at the records desk.','Continuité confirmée. Vous pouvez maintenant vérifier les données au bureau des registres.']),
  'crew-manifest':handoff(
    ['Cada impresión vincula un nombre con su función antes de observar la recreación del traslado.','Each impression records a name and role before you watch the recreated crew transfer.','Chaque impression relie un nom à sa fonction avant la reconstitution du transfert de l’équipage.'],
    ['Manifiesto recibido. Regresa al puesto de tripulación para observar su traslado.','Manifest received. Return to the crew station to observe the transfer.','Manifeste reçu. Retournez au poste de l’équipage pour observer le transfert.']),
  'weather-window':handoff(
    ['El parte de práctica acompaña a la inspección del perímetro antes de preparar la cámara.','The practice weather report accompanies the perimeter inspection before camera preparation.','Le bulletin météo d’exercice accompagne l’inspection du périmètre avant la préparation de la caméra.'],
    ['Parte archivado. Inspecciona ahora las tres balizas del área de observación.','Report filed. Now inspect the three observation-area beacons.','Bulletin archivé. Inspectez maintenant les trois balises de la zone d’observation.']),
  'pad-safety':handoff(
    ['Las tres balizas delimitan el área de práctica desde la que preparas la observación segura.','The three beacons mark the practice area where you prepare for safe observation.','Les trois balises délimitent l’aire d’exercice où vous préparez l’observation en sécurité.'],
    ['Perímetro registrado. Prepara la cámara en el puesto de observación para el traslado al mirador.','Perimeter recorded. Prepare the observation-station camera before transferring to the viewing area.','Périmètre enregistré. Préparez la caméra du poste d’observation avant le transfert vers le point de vue.']),
};
export const HANDOFF_TRANSLATIONS:readonly Copy[]=Object.values(STAND_HANDOFFS).flatMap(value=>value.translations);
