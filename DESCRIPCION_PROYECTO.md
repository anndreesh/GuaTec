# GuaTec: NASA Space 2026

## Descripción

GuaTec es un simulador educativo de exploración espacial con una misión
ambientada en Auburn, Massachusetts, en marzo de 1926. El jugador participa
como integrante ficticio de un equipo experimental que prepara y evalúa un
vehículo de combustible líquido. La experiencia combina exploración de un
campo de pruebas en 3D, objetivos narrativos, decisiones de ingeniería,
telemetría y un informe de resultados.

El proyecto está pensado para enseñar conceptos generales de exploración,
pruebas y análisis. Las opciones de ingeniería son simulaciones narrativas y
no instrucciones para construir o manejar cohetes reales.

## Experiencia de juego

- El jugador inicia sesión con correo, Google, GitHub o como invitado y elige
  un nombre de comandante.
- La Misión 1 se desarrolla en un campo exterior con estaciones de trabajo,
  equipo de pruebas, un marco de lanzamiento y un vehículo 3D.
- Los objetivos se completan en orden. Las estaciones y conversaciones
  habilitan los siguientes pasos de la misión.
- El jugador explora en tercera persona, consulta el mapa, inspecciona equipo,
  toma decisiones y revisa las métricas del vehículo.
- El progreso se guarda en el backend y al finalizar se genera un informe.
- Las Misiones 2 y 3 aparecen en el selector, pero permanecen bloqueadas
  mientras su contenido jugable está pendiente.

La escena 3D usa Babylon.js. El terreno, los materiales y parte del equipo se
generan mediante código; el cielo nocturno incluye estrellas dispersas,
sembradas de forma reproducible y colocadas en coordenadas fijas del mundo.
El encuadre permite explorar con la cámara sin que las estrellas giren para
seguirla.

## Componentes técnicos

| Componente | Tecnología | Función |
| --- | --- | --- |
| Frontend | TypeScript, Vite y Babylon.js | Interfaz, juego 3D, mapa y estado de la misión |
| Backend | Python, Flask y SQLAlchemy | API REST, autenticación, progreso e informes |
| Base de datos | PostgreSQL en Supabase | Usuarios, misiones, progreso y datos de juego |
| Publicación web | Vercel | Compilación y entrega del frontend |
| Publicación de API | Render | Ejecución de la API Flask |

El frontend solicita datos al backend mediante rutas bajo `/api`. La API emite
tokens JWT y usa PostgreSQL para conservar el progreso entre sesiones. La URL
de la API se configura con `VITE_API_BASE_URL`; las credenciales y secretos se
guardan como variables de entorno en los servicios correspondientes.

## Estructura del repositorio

```text
backend/                 API Flask, modelos, autenticación y rutas
frontend/src/api/        Clientes para los recursos de la API
frontend/src/babylon/    Escena 3D, terreno y lógica de cámara
frontend/src/screens/    Pantallas de acceso, misiones y resultados
frontend/src/state/      Estado y reglas de juego
frontend/src/config/     Configuración de misiones y recursos
render.yaml              Configuración del servicio en Render
vercel.json              Configuración de publicación en Vercel
```

## Desarrollo local

Se requieren Python, Node.js y npm. La guía de instalación, variables de
entorno, rutas de la API y opciones de despliegue están en [README.md](README.md).

Para compilar el frontend:

```bash
cd frontend
npm ci
npm run build
```

## Estado actual

La Misión 1 es la experiencia jugable principal. El frontend se publica en
Vercel, la API en Render y la base de datos PostgreSQL en Supabase. Las otras
dos misiones todavía no tienen contenido jugable.

Repositorio: <https://github.com/anndreesh/GuaTec>
