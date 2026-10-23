# SPACE MISSION — MISSION 01: THE BEGINNING

## Documento de diseño de misión

**Tipo:** especificación de narrativa, jugabilidad y procesos  
**Duración objetivo:** 30–40 minutos  
**Época:** marzo de 1926  
**Lugar de inspiración:** Auburn, Massachusetts, Estados Unidos  
**Estado:** misión 01 de una campaña de tres misiones

---

## 1. Propósito de la misión

La misión introduce al jugador en el mundo de SPACE MISSION y presenta el inicio de la exploración espacial mediante los primeros experimentos de cohetes de combustible líquido. Está inspirada en el vuelo histórico de Robert H. Goddard del 16 de marzo de 1926, pero el jugador y los diálogos interactivos son ficticios.

El personaje del jugador **no es Robert H. Goddard**. Es un asistente técnico ficticio que se incorpora a un pequeño equipo experimental y ayuda a preparar, probar y documentar un lanzamiento.

El objetivo narrativo no es llegar al espacio. Es demostrar que una idea experimental puede producir un vuelo y conseguir suficientes datos para aprender del resultado.

La misión debe sentirse como un capítulo de videojuego narrativo, no como una sucesión de menús. El jugador se desplaza físicamente por el entorno exterior, escucha diálogos, inspecciona objetos, toma decisiones, resuelve un problema, prepara el lanzamiento y analiza lo ocurrido.

## 2. Límites de alcance

Esta especificación cubre solamente Mission 01. No implementar el contenido de Mission 02 ni Mission 03.

Reglas obligatorias:

- **No se puede entrar a edificios.** Los edificios son elementos visuales y puntos de referencia; no tienen interiores jugables ni transiciones interiores.
- Todas las actividades se realizan al aire libre: mesas de trabajo, estaciones abiertas, áreas parcialmente techadas, plataformas, zona de pruebas y campo de lanzamiento.
- El jugador utiliza un personaje predeterminado, sin personalización de rostro, cuerpo, vestuario o texturas.
- No utilizar Blender como requisito del flujo de trabajo.
- La lógica técnica del cohete debe ser una simulación abstracta de videojuego. No implementar instrucciones prácticas de fabricación o manipulación de sistemas propulsores.
- No crear combate, armas ni enemigos. La tensión proviene de las decisiones, las pruebas y la incertidumbre del experimento.
- No reemplazar sistemas generales existentes del proyecto sin inspeccionarlos primero.

## 3. Contexto histórico y tono

La misión toma como referencia el vuelo histórico de marzo de 1926, que alcanzó aproximadamente 12,5 metros de altura y recorrió unos 56 metros en alrededor de 2,5 segundos. Debe explicarse que su importancia histórica fue demostrar que la propulsión de combustible líquido podía producir vuelo, no alcanzar el espacio.

Mantener separados los hechos documentados y la ficción creada para la jugabilidad. Mostrar los datos históricos en una breve tarjeta educativa al finalizar la misión.

**Fuentes de referencia:**

- NASA — [95 Years Ago: Goddard’s First Liquid-Fueled Rocket](https://www.nasa.gov/history/95-years-ago-goddards-first-liquid-fueled-rocket/)
- National Park Service — [Goddard Rocket Launching Site](https://home.nps.gov/articles/goddard-rocket-launching-site.htm)
- NASA — [3D Resources](https://www.nasa.gov/3D-resources/)

## 4. Historia y personajes

### Personaje del jugador

Un asistente técnico ficticio que llega al proyecto el día de los preparativos del experimento. Su apariencia y vestuario deben ser coherentes con el trabajo de campo de la década de 1920; no debe parecer un astronauta moderno.

### Director del proyecto

Da la bienvenida, explica la importancia de la jornada, presenta los objetivos y toma las decisiones finales del equipo. Debe guiar al jugador con diálogos breves y naturales.

### Ingeniero de propulsión

Está preocupado por la estabilidad del sistema experimental. Explica las observaciones del equipo, sin proporcionar instrucciones reales para fabricar o manipular propulsores.

### Ingeniero estructural

Se preocupa por el equilibrio entre masa, robustez y coste. Reacciona a la configuración seleccionada por el jugador.

### Técnico de instrumentación

Quiere registrar la mayor cantidad de información posible y explica por qué las mediciones son importantes.

Los personajes deben moverse y realizar pequeñas actividades ambientales: revisar hojas, hablar entre sí, organizar instrumentos y caminar entre estaciones. No deben permanecer todos inmóviles esperando al jugador.

## 5. Apertura narrativa

La misión comienza con una pantalla negra, ambiente de viento y el texto:

> AUBURN, MASSACHUSETTS — MARCH 1926

Después aparece el título **THE BEGINNING** y el subtítulo **One small launch can change everything**.

La cámara muestra el campo, árboles, caminos de tierra, vegetación, terreno húmedo y un pequeño complejo experimental. Después entrega el control al jugador en el exterior.

El director da la bienvenida con un diálogo de tono histórico y humano, por ejemplo:

> “Hoy es un día importante. Llevamos mucho tiempo intentando responder una pregunta: ¿puede esta máquina realizar un vuelo controlado? Hoy vamos a averiguarlo. Bienvenido al proyecto.”

Los diálogos pueden adaptarse, pero deben conservar esa intención. Utilizar un sistema de diálogo tipo videojuego narrativo: nombre del personaje, retrato sencillo opcional, texto legible y aparición discreta. Cuando el personaje esté lejos, las indicaciones deben llegar por radio.

## 6. Mapa y orientación

Crear un mapa funcional disponible con la tecla **M** y mediante un botón del HUD. Debe representar el mundo real de la misión y actualizarse con las coordenadas reales del jugador.

### Localizaciones

1. Punto de llegada.
2. Área de bienvenida y reunión.
3. Área exterior de trabajo.
4. Mesa de ingeniería y prototipo.
5. Almacenamiento exterior de equipos.
6. Área de pruebas.
7. Campo de lanzamiento.
8. Zona de observación.
9. Estación exterior de análisis.

Los edificios pueden aparecer como elementos de ambientación, pero no deben ser accesibles por dentro. No añadir marcadores que lleven a interiores.

### Información que debe mostrar el mapa

- posición actual del jugador;
- dirección aproximada hacia la que mira;
- localizaciones descubiertas y no descubiertas;
- objetivo actual y ubicación de destino;
- distancia aproximada hasta el siguiente objetivo;
- ruta opcional y discreta;
- leyenda de iconos.

Al costado del mapa debe aparecer siempre un panel **CURRENT OBJECTIVE** con descripción, ubicación, distancia y progreso. Ejemplo:

```text
CURRENT OBJECTIVE
Go to the test area.
LOCATION: Test Area
DISTANCE: 42 m
PROGRESS: 2/4 tasks
[SHOW ROUTE]
```

El objetivo del panel debe actualizarse inmediatamente cuando cambia la fase de la misión. No crear un mapa decorativo cuya posición no corresponda al mundo 3D.

## 7. Flujo obligatorio de la misión

La misión se implementa como una máquina de estados. El jugador no puede saltarse los pasos requeridos.

```text
OPENING
  -> ARRIVAL
  -> WELCOME_AND_MEET_TEAM
  -> OUTDOOR_EXPLORATION
  -> PROJECT_BRIEFING
  -> ENGINEERING
  -> TESTING
  -> LAUNCH_PREPARATION
  -> OBSERVATION_AREA
  -> LAUNCH_AND_FLIGHT
  -> DATA_ANALYSIS
  -> AFTERMATH
  -> MISSION_COMPLETE
```

Solo se habilita el estado siguiente cuando se cumplen sus requisitos. El mapa, las puertas decorativas, los botones, las teclas y las llamadas internas deben respetar el mismo control de progreso. No debe bastar con modificar una variable del frontend para saltarse una fase.

Los objetivos opcionales, documentos y conversaciones adicionales sí pueden explorarse libremente, siempre que no permitan eludir los objetivos principales.

## 8. Desarrollo jugable paso a paso

### Fase A — Llegada y bienvenida (aprox. 2–4 min)

1. El jugador aparece fuera del complejo.
2. El objetivo dice **Find the project area**.
3. Se muestran brevemente los controles básicos: WASD para moverse, ratón para mirar, E para interactuar y M para abrir el mapa.
4. El jugador camina hacia el punto de bienvenida.
5. El director lo recibe y explica que el día es importante para la historia de la cohetería.
6. El objetivo cambia a **Meet the team**.
7. El director conduce al jugador hacia los demás personajes, pero el jugador debe recorrer el espacio por sí mismo.

### Fase B — Exploración exterior y descubrimiento (aprox. 4–9 min)

1. El jugador conoce progresivamente al ingeniero de propulsión, al ingeniero estructural y al técnico de instrumentación.
2. Se habilita la exploración de la zona exterior de trabajo.
3. El jugador inspecciona el prototipo, planos, instrumentos, notas y fotografías.
4. Cada objeto importante presenta una interacción contextual con E.
5. Encontrar documentos los añade al **Mission Log** y puede desbloquear contexto o diálogos adicionales.
6. Los NPCs conversan y realizan actividades ambientales mientras el jugador explora.
7. Cuando se cumplen los requisitos mínimos, el director solicita reunirse alrededor del prototipo.

Objetivo principal de esta fase: entender qué se intenta demostrar y por qué es importante medir el resultado.

### Fase C — Reunión y briefing (aprox. 2–3 min)

El equipo se reúne al aire libre junto al prototipo. El director explica que el objetivo es demostrar un vuelo experimental, no alcanzar el espacio. Presenta las etapas de la misión y los recursos limitados.

Objetivos mostrados en pantalla:

- Understand the prototype.
- Prepare the vehicle.
- Complete testing.
- Prepare the launch.
- Attempt the flight.
- Analyze the results.

Al terminar el briefing, la siguiente localización queda disponible en el mapa.

### Fase D — Ingeniería y preparación del prototipo (aprox. 6 min)

1. El jugador se desplaza hasta la mesa exterior de ingeniería.
2. Puede interactuar con el modelo del vehículo y abrir un panel técnico superpuesto al mundo 3D.
3. Configura opciones abstractas, no instrucciones reales de fabricación:
   - estructura: ligera, equilibrada o reforzada;
   - instrumentación: básica, equilibrada o avanzada;
   - prioridad del proyecto: coste, estabilidad o recuperación de datos.
4. Cada elección altera las variables de juego: masa, estabilidad, fiabilidad, capacidad de datos y coste.
5. El modelo 3D cambia visualmente según la configuración: soportes visibles, instrumentos o variaciones estructurales.
6. Los personajes comentan la decisión y mencionan sus ventajas y desventajas.
7. El jugador revisa el resumen y confirma la configuración.
8. El sistema guarda la decisión y habilita el área de pruebas.

No exigir una única configuración correcta. La idea es que haya diferentes compromisos y consecuencias.

### Fase E — Pruebas y diagnóstico (aprox. 5 min)

1. El mapa indica la ruta al área de pruebas exterior.
2. El jugador camina hasta allí; no se realiza teletransporte.
3. Activa estaciones de comprobación de estructura, instrumentación y estabilidad.
4. Cada estación muestra progreso visual, sonidos e indicadores.
5. Tras completar las pruebas, aparece una anomalía abstracta, como una advertencia de estabilidad o una interrupción de datos.
6. Los personajes reaccionan mediante diálogo y el objetivo cambia a **Find the source of the problem**.
7. El jugador inspecciona componentes y consulta los datos disponibles.
8. Selecciona una hipótesis entre varias posibilidades abstractas.
9. El diagnóstico puede ser correcto o incorrecto. Un error consume tiempo o presupuesto y puede requerir otra prueba, pero no debe terminar la misión.
10. El jugador decide si repite la prueba o acepta un margen de incertidumbre.
11. El sistema guarda el diagnóstico, la decisión y sus consecuencias.

No incluir instrucciones prácticas sobre fabricación, mezclas, presiones o manipulación de propulsores.

### Fase F — Preparativos de lanzamiento (aprox. 4 min)

1. Mostrar la transición narrativa a **March 16, 1926 — Launch Day**.
2. La iluminación, los NPCs y la actividad del entorno cambian para reflejar el día del lanzamiento.
3. El jugador camina desde el área de pruebas hasta el campo de lanzamiento.
4. Completa una lista interactiva:
   - inspeccionar visualmente el vehículo;
   - revisar los instrumentos;
   - revisar las condiciones de lanzamiento simplificadas;
   - confirmar el equipo de observación;
   - comprobar que el registro de datos está preparado.
5. Cada elemento se completa mediante interacción real, no solo pulsando un botón de “completar todo”.
6. El director pregunta si el equipo está preparado.
7. El jugador elige **Proceed** o **Delay**. Retrasar consume tiempo o presupuesto, pero permite una revisión adicional; proceder conserva recursos, pero mantiene los riesgos no resueltos.
8. Si se decide proceder, el objetivo cambia a **Go to the observation area**.

### Fase G — Zona de observación y lanzamiento (aprox. 4 min)

1. El jugador camina a la zona de observación.
2. Al llegar, se activa una transición de cámara suave.
3. Los personajes intercambian frases breves de preparación.
4. La música disminuye y se enfatiza el ambiente exterior.
5. Comienza la cuenta regresiva.
6. El lanzamiento utiliza humo, polvo, partículas, sonido, vibración de cámara y movimiento del vehículo.
7. Mantener una escala visual coherente con un experimento pequeño de 1926; no debe parecer un lanzamiento espacial moderno.
8. Durante el vuelo aparecen datos simplificados de altitud, velocidad, estabilidad, señal y recuperación de datos.
9. El jugador puede alternar entre cámara cinematográfica, observación y telemetría.
10. Las decisiones anteriores influyen en el resultado.

Resultados posibles:

- Successful Flight.
- Partial Success.
- Limited Data.
- Experimental Failure.

El fracaso no debe terminar abruptamente el capítulo: debe generar un resultado y permitir continuar al análisis.

### Fase H — Análisis de datos (aprox. 3–4 min)

1. El objetivo indica regresar a la estación exterior de análisis.
2. El jugador vuelve físicamente a esa localización.
3. Examina los registros de vuelo, telemetría, estabilidad e instrumentación.
4. La cantidad y calidad de los datos dependen de la configuración y decisiones anteriores.
5. Los resultados se muestran con gráficos o indicadores simples y legibles.
6. Se presenta una breve nota histórica que explica que el vuelo real fue muy corto, pero demostró que la propulsión líquida podía producir vuelo.

### Fase I — Consecuencias y cierre (aprox. 3–5 min)

1. Los personajes comentan los resultados según las decisiones del jugador.
2. El ingeniero estructural comenta la estabilidad; el técnico comenta los datos; el director habla de los siguientes pasos.
3. El jugador puede inspeccionar una vez más los planos o registros iniciales, ahora marcados como revisados o completados.
4. Se muestra el informe final con objetivos, coste, configuración, resultados, datos recuperados, decisiones y objetivos opcionales.
5. La cámara muestra el complejo desde el exterior y se presenta el mensaje:

> THE FLIGHT WAS SMALL. THE POSSIBILITY WAS NOT.

6. Marcar la misión como completada y notificar al sistema general para desbloquear Mission 02.

## 9. Mecánicas principales

### Movimiento e interacción

- Movimiento con teclado y cámara con ratón.
- Interacciones contextuales mediante E.
- Animaciones simples de caminar, detenerse, inspeccionar y trabajar.
- Colisiones coherentes con el terreno y los objetos.
- No permitir atravesar edificios ni acceder a interiores.

### Diálogo narrativo

- Nombre del interlocutor visible.
- Texto breve, legible y sincronizado con la escena.
- Retratos 2D sencillos si resultan útiles.
- Diálogos directos cuando los personajes están cerca.
- Radio para instrucciones desde otras zonas.
- Conversaciones ambientales no bloqueantes.
- Reacciones distintas según las decisiones guardadas.

### Objetivos y progreso

Cada objetivo tiene identificador, descripción, ubicación, estado y condición de cumplimiento. El objetivo actual debe aparecer en el HUD y en el panel lateral del mapa.

### Ingeniería abstracta

Las decisiones afectan variables internas: masa, estabilidad, fiabilidad, coste y recuperación de datos. Las variables deben influir realmente en pruebas, lanzamiento y resultados.

### Coleccionables

Documentos, notas, fotografías y bocetos añaden contexto al diario. Son opcionales y no bloquean la misión, salvo cuando un objeto sea explícitamente parte de un requisito principal.

## 10. Dirección artística y recursos 3D

La prioridad es conseguir un entorno artístico, detallado y coherente, no una colección de primitivas sin acabado.

### Recursos

El proyecto ya tiene una integración con recursos de NASA. Antes de recrear un objeto relevante, comprueba si existe un modelo o recurso oficial apropiado. NASA ofrece una colección de modelos 3D, imágenes y texturas en [NASA 3D Resources](https://www.nasa.gov/3D-resources/).

Para cada asset externo:

1. comprobar procedencia y condiciones de uso;
2. descargar únicamente si la fuente es confiable y su uso es compatible;
3. revisar formato y tamaño de archivo;
4. comprobar dimensiones, origen del modelo, unidades y escala;
5. comparar las proporciones con referencias históricas;
6. convertir unidades y aplicar escalado de forma explícita si es necesario;
7. comprobar que el modelo se renderice correctamente en Babylon.js;
8. documentar fuente y licencia en un registro de assets.

Si no existe un recurso apropiado, recrearlo mediante código y geometría procedural. No depender de Blender. No usar assets desconocidos o con licencias incompatibles.

### Texturas y materiales

Evitar colores planos. Incorporar variaciones realistas de roughness, desgaste, suciedad, metal pintado, madera envejecida, barro, hierba, piedras y papel. Añadir huellas, caminos de tierra, marcas de uso, herramientas y pequeños detalles ambientales.

### Iluminación y atmósfera

- Luz suave de primera hora de la mañana.
- Interiores no accesibles: no gastar recursos construyéndolos.
- Sombras y contraste suficientes para dar profundidad.
- Niebla o polvo ligero cuando mejore la composición.
- Efectos de lanzamiento limitados y optimizados.
- Variación de terreno y vegetación.

### Rendimiento

Utilizar instancing para objetos repetidos, limitar partículas, evitar luces y sombras excesivas, cargar assets de forma progresiva y mantener el mapa compacto pero visualmente rico.

## 11. Mapa y panel de objetivo

El mapa debe derivarse de las coordenadas reales del mundo 3D. Requisitos:

- marcador de jugador que se mueva en tiempo real;
- orientación aproximada;
- localizaciones descubiertas;
- destino del objetivo actual;
- distancia aproximada;
- ruta opcional;
- leyenda de iconos;
- panel lateral de objetivo y progreso.

Ejemplo:

```text
CURRENT OBJECTIVE
Complete the final checklist.
LOCATION: Launch Field
DISTANCE: 18 m
PROGRESS: 3/5 tasks
```

El mapa solo representa áreas exteriores. No mostrar interiores accesibles. Los objetivos deben cambiar únicamente cuando se cumplan las condiciones establecidas.

## 12. Checkpoints, guardado y recuperación

Crear checkpoints persistentes, como mínimo, en:

1. llegada;
2. descubrimiento del proyecto;
3. configuración de ingeniería;
4. pruebas;
5. preparación del lanzamiento;
6. lanzamiento;
7. análisis;
8. finalización.

Guardar automáticamente después de completar objetivos principales, confirmar decisiones, encontrar registros relevantes y cambiar de fase. Si el jugador sale del juego, debe poder volver al último checkpoint sin repetir toda la misión.

Guardar al menos:

- estado actual de la misión;
- checkpoint;
- objetivos completados;
- configuración del vehículo;
- decisiones de prueba;
- decisión de lanzamiento;
- documentos encontrados;
- recursos gastados;
- resultado del vuelo;
- datos recuperados;
- objetivos opcionales.

## 13. Reglas para impedir saltos de pasos

Implementar una máquina de estados con transiciones validadas. No habilitar la prueba antes de confirmar una configuración válida; no iniciar el lanzamiento hasta completar los requisitos de preparación; no permitir analizar resultados antes de terminar el vuelo; no marcar la misión como completada hasta terminar el análisis y la conclusión.

El mismo control debe aplicarse tanto a la interfaz como al sistema de progreso. Deshabilitar acciones no disponibles e informar claramente qué requisito falta. Los objetivos opcionales no deben bloquear el progreso principal.

## 14. Organización del código

Integrarse con la arquitectura existente y mantener la misión modular. Si los módulos equivalentes ya existen, reutilizarlos en lugar de duplicarlos.

Separar, cuando proceda:

- `Mission01.ts` — ciclo de vida y máquina de estados.
- `Mission01Story.ts` — escenas y progresión narrativa.
- `Mission01Dialogue.ts` — diálogos y reacciones.
- `Mission01Objectives.ts` — requisitos y objetivos.
- `Mission01Engineering.ts` — configuración y variables abstractas.
- `Mission01Testing.ts` — pruebas, anomalías y diagnóstico.
- `Mission01Launch.ts` — checklist, cuenta regresiva y vuelo.
- `Mission01Analysis.ts` — resultados y análisis.
- `Mission01Map.ts` — mapa, ubicación, distancias y rutas.
- `Mission01Data.ts` — datos históricos y configuración del contenido.

No crear un archivo monolítico ni sustituir sistemas generales existentes sin necesidad.

## 15. Verificación antes de entregar

No considerar la tarea finalizada solo porque el código compile. Ejecutar el proyecto y evaluar la misión de principio a fin.

### Pruebas funcionales

- La misión comienza correctamente.
- El jugador puede moverse e interactuar.
- No se puede entrar a ningún edificio.
- El mapa muestra la posición real y cambia al moverse.
- El panel lateral indica el siguiente objetivo.
- Las distancias y rutas son coherentes.
- Los diálogos aparecen en los momentos correctos.
- Los objetivos se completan solo al cumplir sus requisitos.
- No se puede saltar de ingeniería a lanzamiento.
- Las decisiones afectan pruebas y resultados.
- Los checkpoints guardan y recuperan el progreso.
- El lanzamiento y la telemetría funcionan.
- El análisis produce un informe final.
- La misión se marca como completada y se notifica el desbloqueo de Mission 02.

### Pruebas visuales

- Los modelos tienen escala y proporciones coherentes.
- Ningún modelo aparece gigantesco, diminuto, flotando o enterrado por un error de unidades.
- Los materiales tienen detalle y variación.
- No hay edificios accesibles accidentalmente.
- No hay solapamientos importantes, texturas ausentes ni errores visibles de iluminación.
- La cámara no atraviesa el terreno ni queda atrapada.
- Los efectos de partículas no bloquean la visibilidad.
- El mapa coincide con la distribución real del mundo.
- El rendimiento es aceptable durante exploración y lanzamiento.

### Pruebas de regresión

Verificar que no se hayan roto la autenticación, el perfil, el guardado, el menú o los sistemas generales de misiones.

Corregir los errores encontrados y repetir las pruebas relacionadas. No dejar deliberadamente defectos conocidos sin describirlos en la entrega.

## 16. Criterios de aceptación

Mission 01 solo se acepta cuando:

- se puede jugar desde la llegada hasta el final;
- los diálogos guían la historia y dan contexto;
- el jugador explora un mapa exterior conectado;
- el mapa presenta ubicación, destino y objetivo actual;
- los objetivos principales tienen condiciones reales;
- los pasos obligatorios no pueden saltarse;
- la configuración de ingeniería afecta las pruebas o el resultado;
- existe una anomalía que debe investigarse;
- la preparación y el lanzamiento son jugables;
- los resultados y datos dependen de las decisiones;
- hay checkpoints y guardado persistente;
- los modelos y materiales tienen calidad visual aceptable;
- los assets descargados tienen escala y procedencia verificadas;
- se ha ejecutado una prueba completa de la misión.

## 17. Entrega del agente

Al finalizar, entregar un resumen con:

- funcionalidades implementadas;
- archivos modificados;
- pruebas realizadas y sus resultados;
- recursos externos utilizados y sus fuentes/licencias;
- problemas corregidos;
- limitaciones reales que aún existan;
- instrucciones para ejecutar y probar la misión.

**La prioridad es una misión coherente, visualmente cuidada, jugable y probada de principio a fin; no basta con crear una escena atractiva o una secuencia de lanzamiento aislada.**
