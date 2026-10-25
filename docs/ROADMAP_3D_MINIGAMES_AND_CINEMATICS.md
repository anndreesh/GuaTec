# Guía de evolución 3D, minijuegos y cinemáticas — GuaTec

## Objetivo

Esta guía define cómo seguir mejorando la experiencia para que la misión se sienta como un juego de exploración e ingeniería, no como una serie de diálogos y botones.

Regla principal: cada objetivo importante debe resolverse en el espacio 3D mediante una acción observable, una decisión y una consecuencia. Los diálogos explican el contexto y reaccionan a lo que hizo el jugador, pero no sustituyen la interacción.

Los minijuegos deben ser breves, legibles y recuperables: un error puede costar tiempo, datos o presupuesto, pero no debe bloquear permanentemente la misión.

## Estado actual que debe conservarse

La implementación actual utiliza:

- Babylon.js + TypeScript + Vite.
- `frontend/src/babylon/gameplay/GameplayLayer.ts` para escena, movimiento, cámara, NPCs, estaciones y lanzamiento.
- `frontend/src/babylon/gameplay/MarsTerrain.ts` para el suelo estático.
- `frontend/src/screens/Mission1Screen.ts` para objetivos, HUD, diálogos, interacción y flujo de misión.
- `frontend/src/screens/EngineeringMinigames.ts` para los minijuegos actuales.
- `frontend/src/state/Mission1State.ts` y los módulos `Mission01*` para máquina de estados, progreso, tareas, pruebas y resultado del lanzamiento.

No reemplazar estos sistemas de forma general. Añadir capacidades pequeñas y conectadas a la máquina de estados existente.

## Skills que deben utilizarse por proceso

Las skills llamadas `threejs-*` sirven como guía de arquitectura, rendimiento y diseño aunque el proyecto renderice con Babylon.js. La implementación final debe seguir usando Babylon.js, no Three.js ni Blender.

| Proceso | Skills recomendadas | Resultado esperado |
|---|---|---|
| Diseño general de una nueva fase | `threejs-game-director`, `threejs-gameplay-systems` | Brief de jugabilidad, estados, objetivos, éxito y reintento. |
| Crear o reorganizar una escena exterior | `threejs-scene`, `threejs-geometry`, `threejs-lighting` | Zona 3D navegable, cámara estable, escala coherente y rutas claras. |
| Construir estructuras 3D | `threejs-geometry`, `threejs-assets`, `threejs-materials` | Piezas modulares, materiales simples, instancing y carga diferida. |
| Props interactivos y estaciones | `threejs-interaction`, `threejs-gameplay-systems` | Proximidad, resaltado, tecla E/touch, estado visual y feedback. |
| Minijuegos de ingeniería | `threejs-gameplay-systems`, `threejs-interaction`, `threejs-accessibility` | Mecánica jugable con teclado, mouse y touch; no solo formularios. |
| NPCs y animaciones ambientales | `threejs-animation`, `threejs-performance` | Animaciones cortas, pausables y limitadas. |
| Cinemática de lanzamiento | `threejs-animation`, `threejs-scene`, `threejs-postprocessing` | Timeline controlado, cámaras, transición negra, audio y retorno seguro. |
| Audio y ambientación | `threejs-audio-generator`, `threejs-audio` | Viento, radio, mecanismos, cuenta regresiva y lanzamiento. |
| HUD y pantallas de resultado | `frontend-design`, `threejs-game-ui-designer` | Interfaz clara, responsive, con éxito, error, pausa y reintento. |
| Optimización para equipos modestos | `threejs-performance`, `threejs-assets`, `threejs-qa-release` | Presupuesto de FPS, draw calls, texturas, partículas y memoria. |
| QA de interacción y regresiones | `threejs-testing`, `threejs-debug-profiler`, `threejs-qa-release` | Pruebas de flujo, cámara, touch, build y evidencia visual. |
| Nueva textura o ilustración bitmap | `imagegen` | Solo cuando no exista un asset reutilizable y se necesite un bitmap. |

### Orden recomendado

1. `threejs-game-director` para definir el objetivo completo.
2. `threejs-gameplay-systems` para convertirlo en acciones, reglas y estados.
3. `threejs-scene` + `threejs-geometry` para preparar el espacio físico.
4. `threejs-interaction` para conectar objetos y estaciones.
5. `frontend-design` + `threejs-game-ui-designer` para HUD y feedback.
6. `threejs-performance` antes de añadir más detalle visual.
7. `threejs-testing` + `threejs-qa-release` antes de publicar.

## Regla de diseño: interacción antes que diálogo

Completar esta ficha antes de programar cada objetivo:

```text
OBJETIVO:
LOCALIZACIÓN 3D:
OBJETO QUE EL JUGADOR VE:
ACCIÓN FÍSICA: caminar / mirar / recoger / girar / conectar / medir / colocar
MINIJUEGO:
DECISIÓN:
FEEDBACK VISUAL Y SONORO:
VARIABLES AFECTADAS:
ÉXITO:
ERROR RECUPERABLE:
DIÁLOGO REACTIVO:
```

Si la ficha solo contiene “abrir diálogo” y “pulsar confirmar”, el objetivo no está listo para implementarse.

## Minijuegos nuevos propuestos

Estos minijuegos amplían los que ya existen en `EngineeringMinigames.ts`. Deben representar conceptos abstractos del proyecto y no instrucciones prácticas para fabricar, mezclar o manipular propelentes.

### 1. Montaje visual del bastidor

**Lugar:** mesa exterior de ingeniería.

El jugador arrastra piezas grandes y seguras —soportes, placas, anillos y marcadores— hasta sus siluetas correspondientes. Cada pieza encaja con una animación corta y un sonido mecánico.

- Input: arrastrar con mouse/touch; teclas opcionales para seleccionar y rotar.
- Éxito: todos los componentes están alineados.
- Error: una pieza mal colocada reduce estabilidad y puede corregirse.
- Consecuencia: modifica `stability`, `mass` y `structureScore`.
- UI: el modelo 3D de la mesa cambia, no solo una barra de progreso.

### 2. Balance de masa del vehículo

**Lugar:** estación de pesaje.

El jugador coloca bloques abstractos de carga en los lados de una balanza visual. El objetivo es mantener el indicador dentro de una banda segura sin hacer el vehículo innecesariamente pesado.

- Input: arrastrar bloques y confirmar la lectura.
- Éxito: equilibrio dentro de la tolerancia.
- Error: se puede repetir, pero consume tiempo.
- Consecuencia: cambia estabilidad, coste y probabilidad de datos útiles.
- Seguridad narrativa: no mostrar cantidades reales de combustible o presión.

### 3. Calibración de instrumentos

**Lugar:** mesa del técnico de datos.

Tres diales analógicos deben alinearse con una zona marcada usando controles con inercia suave. Al completar cada dial, el jugador observa una lectura breve y pulsa “registrar” en el momento correcto.

- Input: teclado, mouse, touch y botones accesibles.
- Éxito: tres lecturas guardadas.
- Error: lectura ruidosa; se puede repetir con una pequeña penalización.
- Consecuencia: mejora `dataQuality` y desbloquea más información en el análisis.

### 4. Inspección de ruta y obstáculos

**Lugar:** camino entre la mesa de trabajo y el campo de lanzamiento.

El jugador recorre físicamente la ruta y usa una linterna/visor para localizar marcas de seguridad, cables visuales o zonas bloqueadas. Las marcas están repartidas en el entorno; no es un menú de selección.

- Input: caminar, orientar la cámara e interactuar con E/touch.
- Éxito: revisar tres puntos de la ruta.
- Error: omitir un punto activa una llamada de radio que dirige al jugador sin teletransportarlo.
- Consecuencia: cambia `launchReadiness` y el resultado del checklist.

### 5. Lectura meteorológica de campo

**Lugar:** anemómetro y estación meteorológica.

El jugador observa una aguja, una copa giratoria y una bandera. Debe combinar las tres señales para clasificar las condiciones como estables, variables o desfavorables.

- Input: mirar el objeto, ajustar un dial y registrar una categoría.
- Éxito: clasificación coherente con el estado del clima.
- Error: lectura incierta; el director pide repetirla.
- Consecuencia: modifica el riesgo y los comentarios de los NPCs.

### 6. Diagnóstico de señal interrumpida

**Lugar:** estación exterior de telemetría.

El jugador sigue una señal visual por un diagrama de cables abstracto. Debe conectar el origen con el receptor evitando dos nodos falsos.

- Input: conectar terminales o arrastrar una ruta.
- Éxito: señal continua y lectura estable.
- Error: ruido visual y pérdida temporal de datos; se puede reintentar.
- Consecuencia: afecta la cantidad de telemetría recuperada.

### 7. Recuperación de registros después del vuelo

**Lugar:** estación de análisis.

Después del lanzamiento, el jugador ordena tarjetas, fotografías y lecturas según el momento en que fueron registradas. La secuencia reconstruye un timeline de pocos eventos.

- Input: arrastrar tarjetas a una línea temporal.
- Éxito: secuencia consistente.
- Error: se muestra qué dato es ambiguo, sin bloquear el informe.
- Consecuencia: determina `Successful Flight`, `Partial Success`, `Limited Data` o `Experimental Failure`.

## Estructuras 3D: cómo dejar de usar formas simples

No sustituir cada caja por un modelo pesado. Construir un kit modular reutilizable:

1. Crear piezas base: poste, viga, placa, tornillo grande, soporte, lona, panel, mesa, trípode y señal.
2. Componer cada estación con instancias de esas piezas.
3. Usar bevel pequeño solo en bordes importantes para que reaccionen a la luz.
4. Dar a cada estructura una silueta reconocible antes de añadir detalles.
5. Añadir un elemento funcional visible: rueda, aguja, cable, bandera, palanca, cajón o placa.
6. Separar `visualRoot`, `interactionRoot` y `collisionRoot`.
7. Mantener el suelo y las colisiones simples; no convertir cada detalle visual en collider.

### Estaciones prioritarias

- Mesa de ingeniería: bastidor, planos, herramientas grandes y lámpara.
- Estación de pesaje: plataforma, indicador, contrapesos y registro.
- Banco de instrumentación: diales, cables, caja de registro y cámara.
- Campo de lanzamiento: bastidor, base, perímetro, banderas y zona segura.
- Estación de análisis: mesa, fotografías, tarjetas, panel de datos y pizarra.

Cada estación debe tener tres niveles de lectura:

- A distancia: silueta y color reconocibles.
- A media distancia: piezas y actividad visibles.
- Cerca: interacción, texto corto y minijuego.

## Cinemática de transición del lanzamiento

### Resultado deseado

Cuando el vehículo abandone el encuadre, mostrar una transición de pantalla oscura que comunique el paso del lanzamiento a la observación del resultado.

```text
LAUNCH_PREPARATION
  -> ignition
  -> vehicle leaves frame
  -> 0.4 s: camera holds on smoke and empty launch frame
  -> 0.7 s: fade to black
  -> 1.0 s: black screen + radio/telemetry text
  -> 0.5 s: fade to result view
  -> flight result and data summary
```

### Implementación recomendada

1. Añadir un elemento único `mission-cinematic-transition` en el overlay de `Mission1Screen`, inicialmente oculto.
2. Controlarlo con estados explícitos:

   ```ts
   type LaunchCinematicPhase =
     | "idle"
     | "launching"
     | "vehicle-out-of-frame"
     | "fade-to-black"
     | "black-hold"
     | "fade-to-result"
     | "complete";
   ```

3. En `GameplayLayer.ts`, emitir un callback cuando el vehículo deje la zona visible; no inferirlo desde el texto.
4. En `Mission1Screen.ts`, iniciar `fade-to-black` con una transición CSS de opacidad, no con un elemento 3D que compita con el suelo.
5. Durante `black-hold`, mostrar una tarjeta mínima: `FLIGHT OBSERVATION — Recording the final telemetry pass...`.
6. Mantener el viento/radio durante el negro; bajar el motor y el ambiente con un fade de volumen.
7. Al terminar, mostrar una vista de observación o análisis y conservar el resultado calculado por `Mission01Launch.ts`.
8. El botón de omitir debe aparecer solo después de iniciar el negro y debe llevar al resultado, nunca saltarse el guardado.
9. Respetar `prefers-reduced-motion`: opacidad más corta y sin sacudidas.
10. Probar que `reset()`, abandonar la pantalla y volver a entrar no dejan overlay negro ni audio pausado.

### Reglas

- No cortar directamente de “el cohete se fue” a la pantalla final.
- No mantener partículas ni cámaras cinematográficas activas durante el análisis.
- No bloquear la misión si la pestaña pierde el foco.
- No crear una segunda escena o segundo canvas para el efecto.

## Integración con la máquina de estados

Cada minijuego debe declarar un contrato parecido a este:

```ts
interface MissionMiniGameResult {
  id: string;
  completed: boolean;
  score: number;
  attempts: number;
  mistakes: number;
  effects: Partial<{
    stability: number;
    mass: number;
    dataQuality: number;
    launchReadiness: number;
    budget: number;
    time: number;
  }>;
}
```

Flujo mínimo:

1. El jugador llega físicamente al POI.
2. El POI activa una interacción contextual.
3. `Mission1Screen` abre el minijuego asociado.
4. `EngineeringMinigames` devuelve un resultado tipado.
5. `Mission1State` guarda el resultado y aplica sus efectos.
6. El mundo 3D reacciona: pieza colocada, indicador cambiado, NPC comenta, estación marcada o ruta habilitada.
7. El objetivo cambia solo después de guardar el resultado.

No guardar únicamente un booleano `done`. Guardar intentos, errores y efectos para que el informe final explique cómo llegó el jugador al resultado.

## Rendimiento obligatorio

Antes de aceptar una nueva estructura o minijuego:

- reutilizar materiales y mallas;
- usar instancias para objetos repetidos;
- justificar texturas nuevas y preferir 512–1024 px;
- evitar normal maps si un material difuso basta;
- no usar sombras dinámicas en todos los objetos;
- pausar partículas, NPCs y animaciones fuera de la fase activa;
- limitar partículas ambientales en perfil `balanced`;
- no recalcular terreno ni colisiones por vértice durante el movimiento;
- mantener el suelo plano y estático salvo necesidad jugable clara.

Presupuesto inicial para `balanced`:

```text
FPS objetivo: 45–60 en laptop modesta
Draw calls de la zona visible: < 150
Texturas nuevas por estación: <= 2
Partículas simultáneas fuera del lanzamiento: <= 100
Animaciones activas de NPC: <= 4
Colliders jugables: solo estaciones y obstáculos principales
```

## Plan de implementación por commits

Un commit enfocado por fase:

1. `feat(mission-01): add interactive launch field station kit`
2. `feat(mission-01): add structural assembly minigame`
3. `feat(mission-01): add instrument calibration minigame`
4. `feat(mission-01): add weather and route inspection gameplay`
5. `feat(mission-01): add post-flight data recovery minigame`
6. `feat(mission-01): add launch blackout transition`
7. `perf(mission-01): budget new structures and minigames`
8. `test(mission-01): cover interactive mission progression`

Cada commit debe pasar `npm run typecheck`, `npm run build`, `npm test` y `git diff --check`; probar el flujo como invitado; revisar movimiento, cámara, touch, pausa, reinicio y salida; registrar el resultado en `/Users/andres/.codex/Cambios.md`; y publicarse en `main` cuando el despliegue esté disponible.

## Checklist de aceptación

### Jugabilidad

- [ ] El jugador camina hasta cada estación; no hay teletransporte obligatorio.
- [ ] Cada estación tiene una acción 3D visible y feedback concreto.
- [ ] Hay al menos tres minijuegos nuevos además de los actuales.
- [ ] Los errores se pueden corregir y afectan el resultado de forma entendible.
- [ ] Los diálogos reaccionan a las decisiones y no son el único contenido.

### Estructuras

- [ ] Las estaciones tienen silueta propia y piezas funcionales visibles.
- [ ] Los objetos repetidos usan instancing o geometría compartida.
- [ ] Visuales, interacción y colisiones están separados.
- [ ] Las estructuras funcionan en perfil `balanced`.

### Lanzamiento

- [ ] El cohete deja el encuadre antes de finalizar la fase de vuelo.
- [ ] Se ve humo/espacio vacío durante un instante.
- [ ] Aparece una pantalla negra con texto de observación.
- [ ] El regreso al resultado usa fade y no un corte abrupto.
- [ ] El estado se guarda aunque el usuario omita la transición.
- [ ] `prefers-reduced-motion` funciona.

### Calidad

- [ ] No hay errores de consola.
- [ ] No hay suelo titilando, z-fighting o cámara atrapada.
- [ ] No se pierde el input tras cerrar un minijuego.
- [ ] Back/close/reset dejan el escenario en un estado válido.
- [ ] La build de producción carga assets y texturas desde rutas públicas.

## Primera tarea recomendada

Implementar primero el **Montaje visual del bastidor**, porque valida la cadena completa: estación 3D, arrastre, feedback, cambio visual del vehículo, estado, consecuencia y reporte. Después reutilizar la arquitectura para Balance de masa y Calibración de instrumentos. La transición negra debe implementarse después de que el lanzamiento tenga un callback estable de “vehículo fuera de encuadre”.
