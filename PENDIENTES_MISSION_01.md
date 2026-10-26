# Pendientes — Misión 01

Checkpoint creado el 25 de octubre de 2026 al quedar 5 % del límite de uso.

## Ya implementado

- Siete experimentos de campo: montaje, masa, calibración, ruta, meteorología, señal y recuperación de registros.
- Estaciones 3D con piezas compartidas, colisiones simples y feedback por pieza, dial y bloque.
- Resultados con puntuación, intentos, errores, efectos y borradores persistentes; migración de partidas anteriores.
- Transición negra del lanzamiento iniciada por la salida real del vehículo del encuadre; guardado antes de continuar.
- Avatar `balanced` con 13,39 MB menos de descarga y 72,45 % menos píxeles embebidos; rig y animaciones conservados.
- Instancias reales para utilería, reducción de sombras pequeñas y techo agrupado.
- Textos nuevos ES/EN/FR e idioma accesible en las tareas.

## Qué falta trabajar

1. **Personajes:** terminar la mejora de rostros, manos, ropa, mirada y gestos naturales de los NPC. La ampliación gráfica solicitada se auditó, pero estos cambios aún no están implementados.
2. **Iluminación y materiales:** completar la pasada de mañana rural, suelo PBR con contacto, HDRI y perfiles de render. Evitar el tinte nocturno/morado actual; conservar el suelo estático.
3. **Audio:** implementar buses, silencio de sonidos activos, ducking, pasos, mecanismos y fades por fase. La versión actual conserva el audio sintetizado anterior.
4. **Cámaras:** mejorar conversaciones, presentación del equipo e introducción. Revisar visualmente el último ajuste de enfoque de estaciones y su retorno a la cámara del jugador.
5. **Clima al recargar:** persistir el estado meteorológico del mundo, además de las condiciones ya guardadas en el resultado del experimento.
6. **Modelos:** trabajar LOD/geometría del avatar y materiales del vehículo; siguen siendo los mayores costes. Revisar la coherencia histórica del avatar/vehículo heredados y documentar su procedencia antes de sustituirlos.
7. **Rendimiento:** medir CPU/GPU y FPS con los últimos cambios. La escena sigue por encima del presupuesto orientativo de 150 draw calls; no se ha certificado calidad AAA ni 60 FPS en todos los dispositivos.
8. **QA final:** repetir recorrido completo sobre el commit final publicado, móvil vertical/horizontal, ES/EN/FR, pausa, reinicio, salida, pestaña en segundo plano y controles después de las cinemáticas.

## Verificación disponible

- 30 pruebas de estado/ingeniería y compilación local pasan en la revisión previa al checkpoint.
- El recorrido Chrome de `integrated-v2` llegó al informe con los siete experimentos, las cinco tareas anteriores y transición negra, sin errores de página/consola.
- Después de ese recorrido se ajustaron feedback exacto, guardado al salir, indicaciones y enfoque de cámara; requieren repetir la inspección visual integrada.
- Evidencia: `/Users/andres/.codex/visualizations/2026/10/25/01a17564-d9d3-7d12-be89-2e3bb9913e12/`.
- Comandos: `npm --prefix frontend run typecheck`, `npm --prefix frontend test`, `npm --prefix frontend run build`, `git diff --check`.
- Recorrido: `frontend/scripts/qa-field-roadmap.cjs` con Playwright del entorno y la build compilada.
- Las claves Tripo, Gemini y ElevenLabs no están configuradas; no se enviaron trabajos de generación pagados.

La publicación y su resultado se registran en el archivo privado `/Users/andres/.codex/Cambios.md`.
