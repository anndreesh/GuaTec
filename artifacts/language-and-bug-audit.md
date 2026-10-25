# Auditoría de idioma y errores — GuaTec

Fecha: 25 de octubre de 2026

## Cambios aplicados

- Mission 01: los botones de cámara `1 · CINEMATIC`, `2 · OBSERVATION` y `3 · TELEMETRY` ahora pasan por `t()`, por lo que usan español, inglés o francés según la selección activa.
- Autenticación: el mensaje genérico de fallo ahora se traduce en inglés y francés.
- Errores de navegación: se agregó una pantalla 404 personalizada, con estética de consola de vuelo, botón de regreso al centro de misión y textos localizados.
- Errores de arranque/runtime: se agregó una pantalla 500 recuperable para evitar dejar el canvas o la interfaz en blanco cuando falla el arranque.

## Hallazgos corregidos

1. **P1 — texto sin localizar en Mission 01.** Los controles de cámara se escribían directamente en inglés y no respondían al selector de idioma.
2. **P2 — error de autenticación sin localizar.** El fallback de `AuthScreen` devolvía español incluso con inglés o francés seleccionados.
3. **P2 — rutas inválidas sin estado de error explícito.** La SPA podía cargar el shell principal para una ruta desconocida sin una respuesta visual clara.

## Cobertura revisada

Se hizo una revisión estática de `frontend/src/screens`, `frontend/src/state`, `frontend/src/babylon` y `frontend/src/core/i18n.ts`, incluyendo el recorrido heredado y Mission 01. Los textos dinámicos principales de Mission 01 ya pasan por `t()` o por el catálogo específico de minijuegos.

## Verificación

- `git diff --check`: correcto.
- No se ejecutaron tests, build, navegador ni gameplay por decisión de entrega: este cambio debe detenerse y quedar listo para commit cuando el uso llegue al umbral solicitado del 4%.
- La publicación a producción queda pendiente hasta confirmar credenciales/flujo de despliegue disponible.

## Pendientes recomendados

- Ejecutar `npm run build` y los tests de Mission 01 en un siguiente ciclo.
- Abrir el juego con Invitado y recorrer Mission 01 en es/en/fr para verificar también textos producidos por API y datos persistidos.
- Probar rutas inválidas en el hosting real y confirmar el código HTTP 404; la pantalla personalizada ya está implementada en el cliente.
