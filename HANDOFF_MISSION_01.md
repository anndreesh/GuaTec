# Traspaso de trabajo — Mission 1: The Beginning

**Fecha:** 15 de octubre de 2026  
**Repositorio:** [anndreesh/GuaTec](https://github.com/anndreesh/GuaTec)  
**Rama:** `main`  
**Commit de código de referencia:** `7d38d2a` — `Polish Mission 1 period visuals and finale`  
**Commit anterior:** `b925bf7` — `Complete Mission 1 gameplay loop`

## Para quien continúe el proyecto

La tarea es continuar la Misión 1 existente y llevarla a un acabado publicable, no reiniciar el proyecto ni crear una demo separada. Lee este documento junto con `Prompt_Codex_Mission_01_The_Beginning.md` (especificación de diseño adjunta por el usuario) y contrasta ambos con el código actual antes de cambiar sistemas.

La petición más reciente del usuario da prioridad a elevar de forma drástica la calidad visual. **El estado visual actual todavía parece un prototipo procedural de bajo presupuesto; no alcanza una presentación realista ni un nivel digno de Steam/Epic. Hay que rehacer y mejorar profundamente los gráficos para que deje de parecer un juego barato.** Los retoques incluidos en el último commit son una base atmosférica, no el cumplimiento de esa meta.

## Estado de Git y cambios ya realizados

El código de referencia está en `main` y el commit `7d38d2a` ya estaba publicado en `origin/main` al preparar este traspaso. Ese commit:

- Sustituyó el personaje astronauta por un personaje ficticio de campo de los años veinte (`FieldEngineerCharacter.ts`).
- Retiró de la Misión 1 el transbordador espacial moderno y añadió un cohete experimental de época construido proceduralmente.
- Amplió y retocó el terreno, las colinas, la textura del suelo, el cielo de amanecer, las nubes, la niebla y la iluminación.
- Añadió detalles exteriores de una propiedad rural de Nueva Inglaterra y alejó el taller del primer plano.
- Ajustó la cámara inicial hacia el cohete y añadió un encuadre de cierre con controles bloqueados durante la toma.
- Refinó el panel de juego, el mapa, el tutorial y los diálogos para que usen una interfaz de expediente de campo de época y respondan mejor a pantallas estrechas.

Archivos principales del cambio visual anterior:

- `frontend/src/babylon/gameplay/FieldEngineerCharacter.ts`
- `frontend/src/babylon/gameplay/GameplayLayer.ts`
- `frontend/src/babylon/gameplay/MarsTerrain.ts`
- `frontend/src/babylon/BackdropEngine.ts`
- `frontend/src/screens/Mission1Screen.ts`
- `frontend/src/style.css`
- `frontend/index.html`

La aplicación real usa **TypeScript, Vite y Babylon.js**. La prosa inicial de la especificación menciona JavaScript y Three.js, pero también exige continuar con la tecnología real del repositorio. Conserva la arquitectura que ya existe; no migres el motor ni elimines TypeScript por esa discrepancia.

## Qué se verificó

En el cambio anterior se ejecutaron y pasaron:

- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`
- `git diff --check`

También se hizo una revisión manual del flujo y la disposición en escritorio, móvil vertical y móvil horizontal: apertura de la misión, tutorial, mapa, controles de ruta y selección de un punto de ruta. El build informó que el paquete principal de Babylon es grande (aprox. 3.78 MB sin comprimir y 828.84 KB comprimido); el siguiente pase debe medir y mejorar carga y rendimiento.

**Límites de esa verificación:** no se midió una partida completa de 30–40 minutos, no se volvió a jugar de principio a fin tras los últimos cambios y no se verificó visualmente toda la toma final. El proyecto no define hoy un script de pruebas automatizadas en `frontend/package.json`; los scripts disponibles son `dev`, `build`, `preview` y `typecheck`. Hubo mensajes de WebSocket de HMR del navegador integrado durante desarrollo que no se reprodujeron como errores del juego en el build.

## Prioridad P0 — renovación gráfica integral

Haz que la escena parezca un lugar creíble, coherente y cuidadosamente dirigido de Auburn, Massachusetts, en marzo de 1926. La escena actual depende demasiado de formas básicas y superficies uniformes. No basta con subir la resolución del terreno o cambiar colores: revisa el lenguaje visual completo.

1. **Define una dirección artística y una referencia visual** para el campo experimental, el clima de marzo, la paleta, los materiales, la escala y la iluminación. Mantén el tono histórico y terrestre; no lo conviertas en ciencia ficción ni en una base espacial moderna.
2. **Reemplaza las siluetas de bloques** del taller, cobertizos, cercas, bancos y mobiliario con modelos y ensamblajes de calidad, proporciones creíbles y detalles de época. Los edificios son solo referencias exteriores; no añadas interiores ni puertas transitables.
3. **Eleva al personaje y a los NPC**: vestuario de época, silueta, materiales, rostro/manos cuando la escala lo permita, poses y animación con peso. Evita la apariencia de maniquí geométrico.
4. **Rediseña el cohete y el soporte experimental** con una silueta histórica plausible, piezas legibles, superficies y desgaste convincentes. Conserva su naturaleza ficticia/educativa; no conviertas las interacciones en instrucciones reales para fabricar o manipular propulsores.
5. **Da profundidad al terreno**: transiciones naturales entre barro, hierba y caminos; vegetación con variedad y densidad controladas; rocas, huellas y elementos de escala; horizonte y fondo rural que no parezcan una planicie vacía.
6. **Mejora materiales y luz**: variación de roughness/normal, bordes, imperfecciones, sombras estables, luz ambiental, niebla y cielo integrados entre sí. Evita el aspecto plástico, saturado o de material plano.
7. **Dirige la composición y las animaciones**: cámara, distancia focal, encuadres, movimiento, partículas/VFX discretos de clima y lanzamiento, transiciones y lectura de objetivos. La UI debe complementar una escena de juego premium sin tapar la exploración.
8. **Valida rendimiento** en equipos modestos y móviles. Conserva niveles de detalle, cargas diferidas y calidad escalable si hacen falta; evita solucionar el aspecto visual a costa de una escena que no carga.

Usa primero recursos existentes y la procedencia registrada en `frontend/src/config/assetRegistry.ts`. El proyecto incluye algunos modelos y texturas Poly Haven CC0 que podrían aprovecharse. Antes de añadir arte, confirma procedencia y licencia, registra cada recurso y evita descargar modelos desde sitios desconocidos en tiempo de ejecución. La especificación indica que no se use Blender ni se dependa de archivos `.blend`; respeta ese límite. Si el material procedural no alcanza la calidad objetivo, busca activos compatibles con las reglas y licencias del proyecto en lugar de ocultar las limitaciones con geometría básica.

**Criterio visual para aceptar el trabajo:** capturas consistentes de apertura, exploración, estación de ingeniería, zona de pruebas, lanzamiento y cierre deben verse como partes del mismo juego histórico terminado. No declares el objetivo gráfico cumplido mientras el personaje, el entorno o los edificios todavía parezcan primitivas de placeholder.

## Pendiente de diseño, historia y gameplay

Usa el documento de especificación como lista de aceptación y marca cada punto como implementado, incompleto, defectuoso o no verificado. El resumen del README o la existencia de una pantalla no prueban que la experiencia correspondiente esté completa.

- Recorre la estructura narrativa completa: apertura, llegada, exploración exterior, briefing, ingeniería, pruebas, investigación de anomalías, preparación, lanzamiento, telemetría, análisis, consecuencias y cierre.
- Integra y verifica personajes activos, diálogos ambientales/adaptativos, interacciones y colección de documentos/objetos. Cada objetivo debe actualizarse y conducir al siguiente con claridad.
- Verifica que mapa y navegación informen posición, orientación, destino, distancia y ruta de forma correcta, y que las estaciones y puntos de interés sean accesibles desde el exterior.
- Comprueba que las decisiones de diseño, pruebas y pre-lanzamiento tengan consecuencias persistentes que se reflejen en el resultado, la telemetría, el análisis y el informe final.
- Comprueba guardado, checkpoints, reanudación/repetición, recursos, inventario, muestras y estadísticas frente al flujo real del juego; recuperarse de una recarga no debe perder progreso crítico.
- La duración de 30–40 minutos es una meta, no un hecho verificado. Cronometra el ritmo de una partida completa y añade suficiente exploración, diálogos y acciones significativas sin convertirla en tareas repetitivas.
- Mantén Misiones 2 y 3 bloqueadas. No implementes sus escenas ni su gameplay en esta etapa.

### Reglas narrativas e históricas que no se deben perder

- El jugador es un personaje ficticio y **no** Robert H. Goddard. Separa claramente hechos históricos de ficción.
- La misión se inspira en el vuelo experimental del 16 de marzo de 1926 en Auburn, Massachusetts. La especificación da como contexto una altura aproximada de 41 ft / 12.5 m y distancia aproximada de 184 ft / 56 m. Preséntalos como contexto histórico, no como resultado garantizado de cada partida.
- El propósito histórico fue demostrar vuelo con propulsión de combustible líquido, no llegar al espacio.
- No permitir entradas a edificios: nada de interiores, escenas internas, puertas funcionales ni transiciones a interiores. Las estaciones de trabajo deben estar en el exterior, cobertizos abiertos o zonas techadas abiertas.
- Representa la ingeniería como decisiones abstractas y seguras. No incluyas pasos de construcción, fabricación o manipulación real de propulsores.

## Pruebas y control de calidad que faltan

Antes de afirmar que la Misión 1 está terminada:

1. Establece pruebas repetibles para los módulos de estado, eventos, decisiones, objetivos, guardado y finalización. Añade automatización de navegador si el flujo lo necesita; ahora mismo no hay runner de pruebas configurado.
2. Ejecuta `npm run typecheck` y `npm run build` desde `frontend/` después de cada etapa importante, además de `git diff --check`.
3. Prueba una partida completa de principio a fin, con al menos las decisiones/resultados relevantes, y verifica informe, progreso guardado, repetición y estado de desbloqueo.
4. Revisa escritorio y móvil en orientación vertical y horizontal; valida controles, legibilidad, mapa, diálogos, tutorial, HUD, cámara y accesibilidad básica.
5. Inspecciona errores de consola, solicitudes de recursos, tiempos de carga, memoria y tasa de cuadros. Separa problemas reales del juego de fallos de HMR del entorno de desarrollo.
6. Compara evidencia visual antes/después en varias fases. No describas como verificado lo que no se haya recorrido o mirado.

## Cómo empezar

1. Confirma `git status`, rama y commit; conserva cualquier cambio local que aparezca y no lo sobrescribas.
2. Lee la especificación completa, sobre todo las secciones de mapa/arte, las fases de la misión y los criterios definitivos de aceptación.
3. Traza el flujo en `frontend/src/screens/Mission1Screen.ts`, `frontend/src/state/` y `frontend/src/babylon/gameplay/`; localiza los sistemas existentes antes de añadir duplicados.
4. Levanta el proyecto según el README. Para el frontend: `cd frontend && npm install && npm run dev`. Si una prueba requiere API, levanta también el backend mediante `python3 run.py` desde la raíz y configura `.env` a partir de `.env.example` sin versionar secretos.
5. Toma una línea base visual y funcional; entrega primero el pase artístico de calidad, luego completa las brechas de historia/gameplay, optimiza y vuelve a probar.
6. Trabaja solo en Misión 1. Al final, deja evidencia de pruebas, pendientes reales y commits claros.

## Definición de terminado

No marques la tarea como terminada hasta que el flujo completo de Misión 1 sea jugable y los criterios de aceptación de la especificación estén integrados y verificados; el jugador explore e interactúe al aire libre; haya decisiones con consecuencias, pruebas, lanzamiento, telemetría, análisis y cierre; el progreso se guarde; los edificios sigan inaccesibles; las Misiones 2 y 3 sigan bloqueadas; y la calidad visual haya superado claramente el aspecto procedural de prototipo. Si algún punto sigue sin probarse, déjalo explícito en el informe final.
