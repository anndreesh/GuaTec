# Apollo 11 · evidencia de entrega

Fecha local:26 de octubre de2026. [Arquitectura y límites](../../docs/APOLLO11_IMPLEMENTATION.md) · [Historia/licencias](../../docs/APOLLO11_HISTORY_ASSETS.md).

## Resultado comprobado

Se reconstruyó la Misión01 dentro de la SPA existente con Three.js y guardado Flask. Los ocho checkpoints se completan en orden, con tres Mercenary caminando en la retrospectiva de tripulación, negro de embarque, traslado remoto, cuenta y lanzamiento originales y epílogo. No hay interiores. El modelo Sketchfab solicitado se ofrece mediante su visor oficial separado; no es descargable.

- `npm run typecheck`:aprobado.
- `npm test`:40 pruebas aprobadas, incluidas9 nuevas del FSM Apollo y31 heredadas.
- `npm run build`:aprobado. Chunk Apollo~780kB/~208kB gzip, carga diferida; Vite conserva advertencia>500kB, documentada porque incluyeThree.js/cargadores.
- `backend/test_apollo_progress.py`:7 pruebas aprobadas sobreSQLite en memoria; migración/replay/completado/identidad y conservación de otros estados.
- `qa-apollo.cjs`:juego compilado, invitado aleatorio y entrada real por teclado a todas las estaciones. Respuesta incorrecta no avanza; guardado parcial `log` se recupera al salir/reentrar;8/8 recuperado al completar; reinicio devuelve0/8. Cero errores de consola/página y cero peticiones fallidas. [JSON completo](qa.json).
- `qa-apollo-cinema.cjs`:introducción completa sin omitir, radio tras introducción, tres NPC con caminar, negro real a26s de película de tripulación y restauración del selector de idioma. AudioContext iniciado mediante gesto. Colisión física de perímetro en(25,100.001) y edificio en(-125,211.666) mediante teclas mantenidas. [JSON](cinema-qa.json).
- `qa-apollo-layout.cjs`:390x844 y1440x900, sin solapamiento pausa/selector de idioma tras corrección. Zoom,mapa,pausa,calidad y silencio operan. [JSON](layout-qa.json).

Los fixtures cinematográficos montan un estado válido mediante su FSM dentro del navegador de prueba; no sustituyen la progresión real del primer harness ni agregan hooks públicos.

## Rendimiento medido

Chrome156/macOS, viewport1440x900,DPR1. GPU reportada **ANGLE Metal Renderer:AppleM5**, noSwiftShader.300 muestras por perfil en la vista inicial ya cargada, con animación del jugador. No se midió móvil físico ni se garantiza este rendimiento en otrasGPU.

| Perfil | FPS medios | p95 de frame | Draw calls | Triángulos | Sombras |
| --- | --- | --- | --- | --- | --- |
| Baja |60,00|16,70ms|113|198.988|No|
| Media |60,00|16,70ms|221|361.096|1024px|
| Alta |60,00|16,70ms|221|361.096|2048px|

Estado postlanzamiento:155calls en baja,259 en media/alta;206texturas incluidas las vistas activadas durante el recorrido. El fixture de tripulación registra374calls/924.710triángulos cuando los tres esqueletos adicionales están visibles, por encima del presupuesto orientativo de250calls. Se conserva esa vista temporal para cumplir la escena de tres NPC; los mixers se detienen cuando están ocultos, las imágenes se redujeron a512px y elGLB pesa4,9MB. Este dato impide extrapolar los60FPS de la vista inicial a cada instante de la tripulación o a hardware inferior.

## Evidencia visual y movimiento

- [Juego1440x900](active-high.png), [juego390x844](active-narrow.png), [mapa](map-narrow.png), [pausa](pause-narrow.png).
- [Tripulación](crew-transfer.png), [negro de embarque](crew-blackout.png), [cuenta](countdown.png), [ascenso](launch.png), [epílogo](epilogue.png).
- [Recorrido completo,3m10s](motion/playthrough.webm). El bot lee/responde inmediatamente y omite la introducción; esta duración no valida la meta humana de20min.
- [Introducción y tripulación sin pausar](cinema-motion/cinematics.webm). Se inspeccionaron fotogramas de caminar y tríada: escala humana y miembros sin colapso evidente; el traje y la velocidad no pretenden reconstrucción biomecánica histórica.
- [Métricas de píxeles](pixel-metrics.json):capturas no vacías, contraste alto y diversidad cromática; muestreo propio sobrePNG,no certificación estética. La vista activa inicial tiene entropía3,9bits/densidad de bordes0,05; la toma abierta de lanzamiento es más escasa(0,029).

Se añadió harness visual reproducible en vez de comparación estricta píxel a píxel:WebGL, humo y las animaciones producen variaciones temporales. Las capturas son una base revisable y los assertions protegen progresión/geometría/foco/cinemática.

## Límites expresos

Mundo estilizado procedural, edificios/vehículos aproximados y trajesMercenary de cienciaficción. No se afirma calidadAAA, fotorealismo o réplica topográfica. No hay voz grabada; narración yCarter usan subtítulos con diseño sonoro original. Español es el contenido nuevo; teclado/ratón son los controles soportados. El objetivo20min requiere un playtest humano de ritmo. Fuentes/license delSaturn privado impiden usar su geometría/clip; el visor oficial depende de red externa. Detalles y pendientes concretos en la documentación técnica.

## Publicación

Publicar como un único cambio enfocado en `anndreesh/GuaTec/main`, mediante el pipeline existente `Vercel – gua-tec`. La verificación final del commit/despliegue se registra en el archivo privado externo `~/.codex/Cambios.md`; no se publica ese archivo. La instancia distinta`gua-tec-n78y` conserva su fallo anterior y no se modifica.
