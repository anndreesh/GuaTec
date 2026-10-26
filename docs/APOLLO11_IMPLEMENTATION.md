# Misión 01 · Apollo 11

Implementación del 26 de octubre de 2026 en el proyecto GuaTec existente.

## Arquitectura y compatibilidad

La aplicación original es TypeScript/Vite con DOM imperativo, Babylon.js y Flask; no contenía React ni React Three Fiber. La nueva pantalla mantiene el contrato `Screen`, el router `GameApp`, autenticación y APIs, y usa Three.js lazy-loaded para su propio canvas. No se creó otro proyecto, router o backend. El código Babylon de la misión de 1926 permanece inactivo para referencia, junto con sus pruebas de regresión; no participa en la nueva ejecución ni en el chunk Apollo.

| Módulo | Responsabilidad |
| --- | --- |
| `frontend/src/apollo/ApolloScreen.ts` | Ciclo de vida, interacción contextual, tareas educativas, HUD/mapa, cinematografía, guardado y menús. |
| `ApolloWorld.ts` | Mundo 3D, cámara, controles, colisiones, GLB/Meshopt, animación de personajes, lanzamiento, calidad y diagnósticos. |
| `ApolloState.ts` | Reglas puras de ocho checkpoints, requisitos por acción, estado versionado y validación de recuperación. |
| `ApolloDialogue.ts` | Una cola de subtítulos, emisor/canal/prioridad/duración y registro de diálogos terminados. |
| `ApolloAudio.ts` | Web Audio desbloqueado mediante gesto, viento y música originales, radio/pasos y motores con retardo. |
| `apollo.css` | HUD, mapa, menús con foco, estados cinematográficos y adaptación de pantalla. |
| `backend/app/routes/progress.py` | API existente; migración aislada de completado de la antigua misión de 1926. |

## Progresión

1. **Orientación:** mapa, identificación del Saturn V y llegada.
2. **Complejo:** torre, 39A, VAB y conversación presencial con técnico ficticio.
3. **Documentación:** leer registro, confirmar AS-506/LC-39A/09:32 EDT e identificar los cinco F-1. El informe requiere registro previo.
4. **Comunicaciones:** antena, secuencia de identificación y respuesta de Carter. La confirmación requiere dos comprobaciones previas.
5. **Tripulación:** retrospectiva de 06:27 con tres Mercenary, caminar hacia la plataforma junto a un vehículo inspirado en el transporte Apollo; cuatro segundos de negro indican embarque fuera de cámara y regreso a 09:30.
6. **Observación:** preparar cámara y audio; la autorización exige ambos. Traslado al área remota de 5,6 km, preservando escala física del Saturn V.
7. **Lanzamiento:** E inicia únicamente desde observación y tras todos los requisitos. Película original de 60 segundos, con cuenta final de diez, encendido, umbilicales, luz, humo instanciado, vibración reducida si el usuario lo solicita y ascenso acelerado.
8. **Epílogo:** fecha del lanzamiento y acontecimientos lunares posteriores claramente separados; completado e informe enviados mediante API existente.

El estado rechaza acciones desconocidas, futuras y repetidas. Valida un prefijo contiguo de checkpoints completados y requisitos de acciones al recuperar. No confía en guardados de 1926 ni de versiones futuras. No hay atajos de QA publicados. Las pruebas capturan una instancia parcheando su prototipo dentro del navegador de pruebas, sin hooks en producción.

## Persistencia y reinicio

El mismo slug `mission-1-arrival` conserva los contratos del backend. Cada usuario tiene una copia local independiente `guatec.apollo11.<id>`. El payload `apollo11` usa versión `apollo11-v1`; `apollo11SavedAt` permite elegir el snapshot más reciente sin confundir el momento de creación con el de recepción del servidor. Las escrituras remotas se serializan. Cada acción se guarda, además de un ciclo periódico; las películas solo se completan al finalizar. Si se recarga durante una película, se vuelve al inicio de su checkpoint.

Una primera escritura Apollo sobre una misión antigua completada limpia solo su informe/fecha de completado. Reiniciar usa el endpoint `replay` existente, espera las escrituras pendientes y borra únicamente su copia local. No elimina usuarios ni otros estados/desbloqueos. Al terminar se reutiliza `complete`, incluido el desbloqueo normal de campaña; las misiones posteriores siguen mostrando su disponibilidad previa/próximamente.

## Escala, modelos, colisiones y calidad

Una unidad es un metro. Saturn V mide 110,6 m; Mercenary se normaliza a 1,85 m. Se comprobó el problema de corrección FBX/esqueleto y se corrigió antes de entrega. Cuatro esqueletos independientes comparten geometría/texturas: jugador y tres astronautas, nombres sin diálogos inventados. Clips preservados: Mixamo Walk (1,9 s), Idle (13,93 s), Running (0,83 s); actualmente se usan Walk e Idle y Shift aumenta la velocidad de marcha. La ropa Mercenary es una adaptación artística explícita.

Geometría estática agrupada por materiales, vegetación y humo por instancing, VAB con LOD y cámara con frustum culling. Los actores cinematográficos invisibles no actualizan sus mezcladores. El GLB pasó de 500.419.044 bytes a unos 4,9 MB: Meshopt, simplificación objetivo 15%, texturas WebP de máximo 512 px y animaciones remuestreadas. Herramienta reproducible `tools/optimize_apollo_crew.sh`; atribución en el juego y junto al GLB. Los archivos fuente gigantes siguen excluidos de producción por el plugin Vite existente.

Quince colliders AABB, paso de movimiento subdividido a máximo 0,25 m, límite exterior y exclusión circular de plataforma impiden atravesar edificios y acercarse al pad. El área remota tiene sus propios límites. Toda actividad es exterior; el traslado y embarque se omiten mediante una elipsis identificada.

| Calidad | DPR máximo | Sombras | Partículas de humo |
| --- | --- | --- | --- |
| Baja | 1 | Desactivadas | 35 |
| Media | 1,35 | 1024 px | 65 |
| Alta | 1,75 | 2048 px | 100 |

La frecuencia de pantalla se registra sin confundir el delta limitado de simulación con el tiempo real. Los resultados medidos por configuración y GPU se incluyen en `artifacts/apollo11/qa.json`; no son una garantía para cualquier equipo. No se han medido móviles reales.

## Audio, diálogos y controles

WASD/flechas, Shift, arrastrar ratón, E, M, R y Escape. Zoom usa teleobjetivo. Pausa ofrece calidad, silencio, créditos, visor Sketchfab, reinicio y regreso al selector. El foco vuelve al canvas al cerrar un menú; modales con trampa de foco y Escape. Ocultar la pestaña pausa la experiencia. Unmount cancela RAF/listeners/audio y libera geometría/materiales/texturas/renderizador.

Los diálogos son originales en español, con canal radio/presencial/narrador, checkpoint, disparador, prioridad y duración estimada. Nunca hablan dos emisores a la vez. R repite la última instrucción de la etapa cuando no hay otra línea activa. La narración cinematográfica se presenta en subtítulos; **no se suministraron voces grabadas**. Ambiente, tonos de radio, pasos, música ambiental y motores son síntesis original; sin música comercial ni audio histórico. El sonido directo llega con 5600/343 ≈16,3 s de retardo desde el encendido, incluso cuando la película muestra cámaras cercanas.

## Fuentes y limitaciones

[Historia y licencias](APOLLO11_HISTORY_ASSETS.md) distingue documentación NASA, fotografías consultadas y composición ficticia. El modelo LEGO solicitado es Standard y no descargable; tiene una animación y más de diez millones de caras. Se integra solamente mediante visor oficial bajo demanda; el Saturn original de la escena no deriva de su geometría o clip.

El mundo es una **reconstrucción estilizada y procedural**, con geografía de operaciones comprimida, utilería de época aproximada y Mercenary de ciencia ficción. No es fotogrametría, un levantamiento arquitectónico exacto ni una simulación física de motores/órbita. La misión prioriza reconocimiento y documentación; sus actividades son preguntas verificables, no controles de vuelo. La duración humana aproximada de veinte minutos depende de explorar, leer y observar: **no se ha validado mediante un estudio con jugadores**, y un bot que responde inmediatamente termina mucho antes. La interfaz estrecha está revisada, pero esta entrega usa teclado/ratón y no promete juego táctil completo. Solo el español tiene nuevo contenido narrativo; los demás idiomas del menú conservan su mecanismo existente, mostrando esta misión en español.

Pendientes de calidad superior: voces originales grabadas/sintéticas revisadas, mayor fidelidad arquitectónica y ambiental, trajes A7L históricos y playtesting humano de ritmo. No se afirma una certificación visual AAA. Ninguna de estas limitaciones oculta un asset privado extraído ni un checkpoint concedido sin su condición.

## Verificación reproducible

```sh
cd frontend
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# En otra terminal, con Playwright/Chrome disponibles:
PLAYWRIGHT_MODULE=/ruta/a/playwright CHROMIUM_EXECUTABLE=/ruta/a/chrome node scripts/qa-apollo.cjs

# Desde la raíz; DB exclusivamente en memoria:
DATABASE_URL=sqlite:///:memory: backend/.venv/bin/python -m unittest discover -s backend -p 'test_apollo_progress.py' -v
```

El harness admite `QA_BASE_URL` y `QA_OUTPUT_DIR`, registra consola/red/GPU/FPS y captura bienvenida, juego, tripulación, negro, cuenta, ascenso y epílogo. Recorre estaciones con teclas mantenidas; la orientación de cámara se fija para que el trayecto sea reproducible. Comprueba respuesta equivocada sin progreso, recuperación parcial y completa, reinicio y exclusión de plataforma. Las pruebas de backend verifican aislamiento por invitado y conservación de otras misiones.
