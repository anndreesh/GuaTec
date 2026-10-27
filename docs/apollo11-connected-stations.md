# Apollo 11 — puestos conectados y revisión de continuidad

Fecha local: 26 de octubre de 2026. Motor activo: Three.js/TypeScript, en `frontend/src/apollo/`. El código Babylon/Auburn permanece como contenido anterior. Esta pasada conserva `apollo11-v1`, ocho etapas narrativas y siete operaciones de apoyo obligatorias: quince operaciones en total. No son quince tipos distintos de minijuego.

Skills aplicadas: `game-ui-ux`, `game-engine`, `threejs-aaa-graphics-builder`, `threejs-interaction`, `performance-optimization` y `camera-systems`. Babylon.js, Blender y las herramientas de generación de assets están instaladas; esta pasada construye las piezas por código y conserva el GLB existente.

## Composición y modelos

Trece puestos físicos comparten seis patios y senderos. El plano y el mundo consumen las mismas definiciones de vías. La carretera termina antes de la zona peatonal de observación. Mesas, antena, vehículo estacionado y técnicos se apartaron del tráfico; las colisiones siguen las ubicaciones y las estructuras visibles.

| Puesto | Forma y piezas visibles |
| --- | --- |
| Orientación | Atril de mapa, placa y brújula; banco de alimentación en el mismo patio |
| Alimentación | Tablero eléctrico, fusibles, bornes, medidor analógico y fuente lateral |
| Reconocimiento | Teodolito con trípode y mesa auxiliar, distinto de la cámara de cine |
| Plan de vuelo | Mesa de dibujo inclinada, documentos y soporte lateral |
| Documentación | Mesa de registro con toldo, archivos y útiles de escritorio |
| Telemetría | Tres CRT con trazas diferentes, perillas y rack de cinta con carretes |
| Conexiones | Bastidor arriostrado, cables, férulas y letras A–D/C–A–D–B iguales a las del ejercicio |
| Comunicaciones | Receptor/transmisor, rejilla de altavoz, auricular cableado y antena |
| Tripulación | Soporte de equipo, cascos y superficies de preparación |
| Manifiesto | Puesto de registro con impresor mecánico de credenciales |
| Meteorología | Carro de instrumentos, medidores, veleta y anemómetro |
| Perímetro | Mesa de seguridad y tres balizas en soportes |
| Observación | Cámara de cine con lente, carretes y trípode articulado |

Las herramientas comparten una familia de materiales: llave de boca abierta con ojo, destornillador estriado y alicates con pivote en bandejas con borde. Los indicadores se montan sobre el equipo. Solo documentación y manifiesto conservan toldos; el resto se distingue por su instrumento y silueta. Las tareas, Carter y sus registros se identifican como adaptaciones educativas, sin atribuirles responsabilidad histórica sobre sistemas reales de lanzamiento.

Los edificios de apoyo añaden ventanas altas, parteluces, juntas, bajantes y rejillas en las fachadas laterales que sirven de fondo a los patios. Sus dimensiones se comparten entre mapa, envolvente, detalles y colisiones. No se abrieron interiores ni se cambiaron sus huellas.

## Manipulación y continuidad

Los siete ejercicios siguen siendo rápidos: encajar fusibles y elevar una palanca, ordenar documentos, sintonizar tres canales, conectar cables por letra, imprimir tres credenciales con un recorrido continuo, ajustar veleta/nubosidad e inspeccionar tres balizas con encuadre sostenido. El impresor admite arrastre, touch y Espacio sostenido; un clic no imprime. Recupera coincidencias válidas de los borradores anteriores sin conceder una finalización automática.

Cada operación explica opcionalmente su vínculo con el recorrido y termina con una indicación distinta de Carter. El siguiente puesto conserva el orden de requisitos existente. Los instrumentos históricos mantienen reconocimiento óptico, registro documental, patrón de radio y cámara de seguimiento. Traslado, lanzamiento y epílogo conservan su presentación narrativa.

La cámara enfoca los puestos y retorna con interpolación temporal. El arrastre vertical ahora controla un ángulo real: encuadre inicial de aproximadamente −7° y límite superior medido de 65,89°. La prueba proyecta base y cima del Saturn V dentro de la pantalla tras un arrastre. La captura de puntero termina al suspender, perder el foco o cancelar; un segundo dedo/botón no roba la órbita.

El GLB contiene Walk, Idle y Running, pero no Jump. Espacio conserva la física existente y usa Idle en el aire cuando falta ese clip. Se corrigió el caso en que todos los pesos quedaban a cero y exponían la pose base.

## Errores reproducidos y corregidos

- Radio a unos 8 FPS: un pulso largo real se evaluaba con el delta de animación limitado. Se mide con reloj independiente del render.
- Registro con teclado: Enter podía colocar la ficha en otra casilla; ahora usa la enfocada. Además, actualizar el foco reemplazaba nodos y anulaba el clic nativo: el feedback conserva esos nodos.
- Idioma durante carga/error WebGL: se accedía a un mundo todavía ausente. La recuperación permanece operativa y localizada.
- Idioma durante un puesto: conserva el borrador y el ejercicio abierto; actualiza subtítulos, navegación y voz correspondiente.
- Almacenamiento denegado: tanto el inicio como la página legal quedaban vacíos. La sesión puede funcionar en memoria y guardar en la API; no se persiste en otro lugar ni sobrevive a una recarga si el navegador sigue denegándolo.
- Guardado: si fallaban almacenamiento y API, el HUD afirmaba que existía una copia local. Ahora distingue copia local, sincronización, ausencia de registro y fallo de ambos destinos, en ES/EN/FR.
- Perímetro: una flecha sostenida continuaba moviendo la retícula después de blur. Se liberan teclas y encuadres incompletos al perder el foco/visibilidad. La prueba señala que el evento de ciclo de vida es explícito; no presenta el cambio de pestaña headless como foco nativo.
- Informe: una partida Apollo completada usaba datos del informe anterior de 1926. Ahora muestra sus quince operaciones y mantiene el formato anterior para partidas antiguas.

## Traducciones

Se centralizó el idioma de menús, misión, etiquetas de canvas y voces, con preferencia en memoria si localStorage falla. La página legal comparte ese estado y sincroniza cambios entre pestañas. Se revisaron objetivos, diálogos, acciones, requisitos, mapa, minijuegos, errores de cuenta, navegación NASA e informe. Los nombres técnicos y personales conservan su identidad.

El catálogo comprueba cobertura y conflictos entre claves repetidas. El caché mantiene por separado la precedencia de coincidencia exacta y sustitución parcial. Una comparación de 778 entradas/frases en los tres idiomas no cambió resultados. El microbenchmark local de 2000 textos técnicos sin clave exacta pasó de ES 158→5 ms, EN 150→8 ms y FR 409→10 ms; mide traducción en Node, no FPS del juego.

## Recursos y medición

Los puestos usan un atlas de instrumentos de 1024² y hasta nueve materiales compartidos. La geometría estática se agrupa; los planos inmutables se reutilizan solo a igual tamaño para conservar sus volúmenes de recorte. En las mismas 22 vistas de inspección, las geometrías cargadas bajaron de 222 a 196, sin cambiar llamadas de dibujo ni texturas. Es un conteo acumulado del recorrido de inspección, distinto del conteo de una vista de juego recién cargada.

Inspector de canvas de `threejs-qa-release`, Chrome headless con Apple M5/ANGLE Metal real:

| Vista con personaje | Calls | Triángulos | Geometrías | Texturas | Entropía | Densidad de bordes | Contraste |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Banco, 1440×900 | 130 | 200870 | 153 | 98 | 3,35 | 0,172 | 136,3 |
| Telemetría, 1440×900 | 166 | 205946 | 165 | 99 | 2,94 | 0,158 | 120,6 |
| Banco, 390×844 | 92 | 199490 | 153 | 97 | 4,30 | 0,261 | 156,1 |

Las tres capturas se reconocieron como render no vacío, sin errores de página ni consola. Calls, triángulos y geometrías cumplen los presupuestos de referencia del inspector en esas vistas; las texturas los superan. El personaje importado conserva numerosos mapas de 512². Una auditoría separada encontró 88 texturas únicas referenciadas por materiales, incluyendo las de elementos ocultos; ese inventario no equivale al conteo GPU, que también incluye recursos de esqueleto y entorno.

No se afirma rendimiento de un teléfono físico ni calidad AAA. El terreno despejado responde a la petición de retirar vegetación y ruido visual. La siguiente mejora de materiales del personaje requiere medir una estrategia de atlas/compresión sin degradar su lectura. Ninguna decoración se añadió para inflar métricas de imagen.

El detalle final de fachadas añadió aproximadamente 3168 triángulos en estas vistas sin aumentar las llamadas de dibujo. Los valores anteriores a esta última intervención eran 197702/202778/196322 triángulos; las capturas finales son las de la tabla. No se atribuye una ganancia de FPS a este cambio.

### Evaluación visual conservadora

Escala interna 0–3 de la skill gráfica. El antes corresponde a la evaluación de [la pasada anterior](apollo11-visual-pass.md), con baseline de escritorio; no se inventa un baseline móvil independiente. Las vistas actuales incluyen las tres capturas con personaje de la tabla, los trece puestos y seis patios. Se revisaron también movimiento y retorno de cámara sin pausa.

| Categoría adaptada | Antes | Ahora | Evidencia y margen pendiente |
| --- | ---: | ---: | --- |
| Dirección artística | 2,5 | 2,5 | Mismo lenguaje de esmalte, papel e instrumentos; siluetas ahora más distintas |
| Personaje | 2 | 2 | Clips existentes conservados; pose base corregida en el aire |
| Restricciones/ruta | 2 | 2,5 | Patios conectados, puestos fuera del tráfico y accesos verificados |
| Interactivos | 2,5 | 2,5 | Impresor continuo y piezas identificables; siete tareas de apoyo |
| Entorno | 2 | 2 | Fachadas y patios más legibles; horizonte y terreno siguen sencillos |
| Materiales | 2,5 | 2,5 | Atlas reutilizado; mapas del personaje aún costosos |
| Luz/render | 2 | 2 | Sombras y contraste medidos; iluminación conservada |
| Movimiento/feedback | 2 | 2,5 | Cielo accesible, cámara sin gesto obsoleto, radio independiente del render |
| UI/HUD | 2,5 | 2,5 | Errores, foco, idiomas e informe coherentes; tamaños verificados |
| Evidencia de rendimiento | 2,5 | 2,5 | Conteos antes/después y GPU real; falta medición en teléfono físico |

Promedio interno: 2,25→2,35. No es una certificación; el presupuesto de texturas sigue abierto y el entorno conserva margen de autoría.

## Verificación reproducible

Playwright se suministra desde el entorno con `PLAYWRIGHT_MODULE_PATH`; `CHROME_BIN` selecciona Chrome. Los arneses solo admiten localhost y sus fixtures no se publican. `npm test` pasa 86 pruebas; `npm run build` incluye TypeScript y genera la build de producción.

El recorrido completo se repitió sobre la build `394068f`, con quince operaciones, recuperación, reentrada y reinicio correctos, sin errores. La última intervención `17c7ba1` añade fachadas y comparte sus huellas; tiene build, 86 pruebas, accesos y renders propios. Sus datos de GPU son los de la tabla final.

| Comando en frontend | Cobertura verificada |
| --- | --- |
| `qa:apollo-story` | Build compilada + API local: Invitado, WASD real, quince operaciones, traslado, lanzamiento, recuperación y reinicio |
| `qa:apollo` | Doce comprobaciones de los siete puestos, errores, teclado, touch nativo, cancelación, borradores, cámara y foco |
| `qa:apollo-site` | Trece accesos, senderos contra colisiones reales y 22 vistas de puesto/patio/móvil |
| `qa:apollo-instruments` | Dieciséis casos de instrumentos en ES/EN/FR, clic/teclado, móvil y radio a unos 8 FPS |
| `qa:apollo-locales` | Cinco comprobaciones de idioma durante carga, introducción, puesto, pausa y recuperación WebGL |
| `qa:app-locales` | Seis flujos de cuenta, reintento, validación, envío único y navegación NASA |
| `qa:legal-locales` | Dieciocho cargas de documentos, almacenamiento denegado, foco móvil y sincronización entre pestañas |
| `qa:app-storage` | Dos flujos Invitado reales: lecturas bloqueadas/escrituras rechazadas, puesto, guardado API y logout |
| `qa:apollo-saving` | Doce resultados de persistencia en ES/EN/FR con dispositivo/API fallando de forma independiente |
| `qa:apollo-camera` | Cohete entero, límite de cielo, suspensión, botones y multitouch nativo |
| `qa:apollo-movement` | Reposo, caminar, correr, salto con pose, aterrizaje, suspensión y pérdida de foco |
| `qa:apollo-report` | Informe Apollo ES/EN/FR, móvil desplazable y formato anterior conservado |

Las capturas e informes quedan en `frontend/artifacts/` o `/tmp`, fuera de Git. No contienen credenciales de usuario. La memoria privada de cambios permanece fuera del repositorio.

## Archivos principales y publicación

Composición: `ApolloSiteLayout`, `ApolloStandDesigns`, `ApolloStandModels`, `ApolloWorld`. Interacción: `ApolloBonusMissions`, `ApolloCredentialImprinter`, `ApolloInstruments`, `ApolloStandRules`, `ApolloStandHandoffs`. Progresión/informe: `ApolloState`, `ApolloScreen`, `ApolloOperationLog`, `ApolloReport`. Idioma/acceso: `core/language`, `core/i18n`, `AccountCopy`, `apiErrorCopy`, `AuthStore`, pantallas de cuenta y `legal.ts`. Los scripts y pruebas de la tabla acompañan esos cambios.

Cada cambio está en un commit específico y se subió a `origin/main`. El intento explícito de publicar la build compilada `394068f` en el proyecto existente fue rechazado por Vercel con `api-deployments-free-per-day`: más de 100 despliegues diarios, reintentar en 24 horas. El último Ready confirmado sigue siendo `38bbe54`; no se afirma que esta pasada esté publicada. No es un bloqueo de credenciales ni se crearon proyectos alternativos para eludirlo. El frontend público existente usa la API Render; la ruta alternativa Vercel no es el servicio de este build.
