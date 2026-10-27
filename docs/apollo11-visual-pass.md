# Misión 01 · revisión gráfica y jugable

Fecha: 26 de octubre de 2026. Motor activo: Three.js 0.186.1.

## Cambios integrados

Se reconstruyeron las seis estaciones históricas y los siete stands de apoyo mediante un kit procedural compartido. Cada actividad tiene una forma y equipo reconocibles: consolas biseladas, diales, bornes de cobre, cables curvos, herramientas sobre bandeja, archivadores, lámpara articulada, veleta, balizas y cámaras sobre trípodes. Los trípodes quedan junto a la mesa y los gabinetes, postes y equipos laterales tienen colisiones propias.

Las superficies separan esmalte, papel, metal, cobre y aislante mediante color, rugosidad y respuesta a la iluminación. Un atlas de instrumentos de 1024² sirve a todos los stands. Las piezas estáticas se agrupan por material y los dos lados de los carteles comparten textura y geometría. Se corrigieron las nubes que se veían de canto, se conectaron los puestos a las vías y se añadieron detalles de fachada. Los vehículos de servicio usan una interpretación genérica de la época con faros redondos, parachoques cromados y tapacubos; no se presentan como réplicas de modelos concretos.

| Stand | Acción jugable |
| --- | --- |
| Alimentación | Encajar fusibles por amperaje y mover la palanca del circuito |
| Plan de vuelo | Colocar documentos en preparación → embarque → encendido → despegue |
| Telemetría | Ajustar tres mandos y superponer las trazas a su referencia |
| Umbilicales | Conectar cables a bornes por letra, con curvas visibles |
| Tripulación | Asociar credenciales con las funciones de Armstrong, Collins y Aldrin |
| Meteorología | Girar la veleta y ajustar una placa de nubosidad |
| Perímetro | Mover el visor y mantener la observación sobre tres balizas |

La cronología de los stands exige también los hitos históricos correspondientes. Llegar físicamente a una estación futura no concede autorización. El marcador y el mapa guían hacia la primera dependencia pendiente. Se evitó reproducir el traslado de la tripulación mientras faltaba su manifiesto.

El plan anterior proponía una secuencia T−00 → T−10 → T+01 → T−05. Se sustituyó por una secuencia temporal coherente. Las funciones de la tripulación y el orden embarque/encendido/despegue se cotejaron con [NASA: Apollo 11 Mission Overview](https://www.nasa.gov/history/apollo-11-mission-overview/) y la [cronología de Apollo 11](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm). Los valores de clima, fusibles y señales son referencias de ejercicios educativos, no mediciones históricas ni controles reales del lanzamiento.

## Lectura e interacción

La interfaz usa paneles de instrumentos en marfil y verde, una guía lateral, progreso y feedback localizado en ES/EN/FR. Las piezas se manipulan con captura de puntero y funcionan con touch; también se pueden seleccionar y colocar con teclado. Los mandos y la veleta admiten manipulación directa, además de controles de rango accesibles. El visor admite flechas. Cancelar libera listeners, captura y animaciones.

Los borradores conservan piezas y ajustes al cerrar, recargar o cambiar de idioma. La restauración descarta valores inválidos y duplicados; recuperar un borrador no otorga un checkpoint. El banco de sonido del mundo se atenúa mientras la interfaz conserva sus tonos de confirmación.

El HUD de objetivos es plegable, el menú ESC mantiene botones compactos y mapa completo, el selector de idioma abre por encima del mapa y los subtítulos ya no quedan cortados. Escape cierra primero el selector de idioma y devuelve foco al botón.

Contraste calculado de texto sobre fondos sólidos de referencia:

| Uso | Texto / fondo | Relación |
| --- | --- | --- |
| Instrumentos | `#283b38` / `#ded6bc` | 8,15:1 |
| Guía lateral | `#aabdb3` / `#102228` | 8,30:1 |
| Acción principal | `#f2ebce` / `#2a463e` | 8,59:1 |
| Radio | `#f4f1df` / `#122d34` | 12,75:1 |

Estas relaciones corresponden a los colores de referencia, no constituyen una auditoría completa de todos los estados, transparencias o fondos del juego.

## Verificación

- TypeScript, build de producción y revisión de whitespace pasan.
- 65 pruebas automatizadas: progresión, guardado, audio, validación de tareas, recuperación de borradores, escala de modelos, vértices finitos y colisiones.
- `npm run qa:apollo`: once comprobaciones de aceptación de navegador con entrada real. Completa los siete stands, rechaza estados incompletos, comprueba teclado, drag touch nativo, cancelación y recuperación parcial. También mide el retorno gradual de la lente al salir del enfoque de un stand, incluso con el mundo suspendido.
- Tamaños revisados: escritorio 1440×900, tablet 768×1024 y móvil 390×844. Sin desbordamiento horizontal en los paneles probados.
- Flujo local con Invitado: caminar al banco, guardar un fusible con Escape, reabrir, completar y recargar. El progreso se conserva y no vuelve a reproducirse la introducción.
- Menú ESC, selector de idioma y mute/unmute comprobados dentro de la app. Sin errores de página observados.

Para repetir la aceptación, arrancar Vite y ejecutar `npm run qa:apollo`. Si Playwright procede del runtime del equipo, indicar `PLAYWRIGHT_MODULE_PATH`; `CHROME_BIN` permite seleccionar Chrome. Las capturas y el informe se generan en `frontend/artifacts/apollo-qa/`, que permanece fuera de Git. Las páginas de prueba se interceptan en el navegador y no se publican con el juego.

## Diagnóstico gráfico

El inspector de canvas usó GPU real: ANGLE/Metal, Apple M5. Son mediciones locales de desarrollo; la vista móvil emula el tamaño de pantalla, no el hardware de un teléfono.

| Captura | Draw calls | Triángulos | Geometrías | Texturas |
| --- | ---: | ---: | ---: | ---: |
| Energía · 1440×900 | 161 | 198.224 | 176 | 100 |
| Telemetría · 1440×900 | 191 | 205.298 | 189 | 101 |
| Energía · 390×844 | 120 | 197.494 | 167 | 97 |

En la primera implementación de estaciones separadas, la captura móvil tenía 242 geometrías; la agrupación compartida la redujo a 167. El coste de triángulos aumenta ligeramente porque se dibujan los pequeños puestos como un conjunto; las geometrías y llamadas quedan dentro de los presupuestos de referencia en esas capturas. Las sombras se refrescan durante el movimiento, los saltos y las películas; en reposo tienen actualización espaciada, por lo que estos valores no son el máximo de un fotograma con refresco de sombras.

El coste que permanece sobre el presupuesto orientativo es el de texturas. La auditoría encontró numerosas texturas de 512² en los materiales del personaje importado; esta pasada conserva su aspecto y las animaciones. No se afirma que un teléfono físico alcance una tasa de cuadros determinada.

El inspector midió entropía de color 3,06–3,15 y contraste de luminancia 115–119 en las capturas de escritorio; en móvil, 4,28 y 172. No hubo errores de ejecución ni de consola en esas capturas.

## Evaluación visual conservadora

Escala interna 0–3 del skill gráfico. El antes se basa en las capturas iniciales de escritorio; no se capturó un baseline móvil independiente. Los números no representan una certificación de calidad AAA.

| Categoría adaptada al juego histórico | Antes | Después | Evidencia |
| --- | ---: | ---: | --- |
| Dirección artística | 1,5 | 2,5 | Esmalte, instrumentos, documentos y señales comparten lenguaje |
| Personaje | 2 | 2 | Modelo y animaciones conservados; nueva luz ambiental |
| Restricciones y ruta | 1 | 2 | Perímetro, colisiones laterales y dependencias legibles |
| Interactivos | 1 | 2,5 | Props por función e interacciones manipulables |
| Entorno | 1 | 2 | Caminos, fachadas, puestos y cielo corregidos |
| Materiales | 1 | 2,5 | Atlas, biseles y roles de superficies diferenciados |
| Luz/render | 1,5 | 2 | Reflejos ambientales y sombras legibles |
| Movimiento/feedback | 1 | 2 | Trazas, cables, visor, aguja, confirmaciones y cámara suave |
| UI/HUD | 1 | 2,5 | Paneles responsive, foco, radio y pausa corregidos |
| Evidencia de rendimiento | 0 | 2,5 | Inspector GPU, presupuestos y pruebas de navegador |

El conjunto permanece estilizado. El mayor margen gráfico posterior está en el tratamiento de terreno y edificios lejanos, y en consolidar los materiales del personaje sin perder detalle.
