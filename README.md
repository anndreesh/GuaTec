# GuaTec — NASA Space Challenge 2026

GuaTec es una experiencia web educativa e interactiva sobre exploración
espacial. Su primera misión jugable, **Apollo 11: El comienzo de una nueva
era**, recrea el 16 de julio de 1969 en el Centro Espacial Kennedy.

El jugador asume el papel de un técnico ficticio de apoyo terrestre. Explora
el área de lanzamiento, inspecciona estaciones, completa comprobaciones,
revisa comunicaciones y presencia el lanzamiento del Saturn V desde un punto
remoto. La experiencia combina una escena 3D, narrativa histórica,
actividades interactivas y un informe final.

El proyecto tiene un propósito divulgativo: acercar al público a la historia y
la complejidad de una misión espacial mediante una simulación accesible. Las
actividades de ingeniería son abstracciones narrativas y educativas; no son
instrucciones para construir, operar o modificar cohetes reales.

## Qué incluye

- Misión 01 jugable con ocho etapas narrativas y quince operaciones conectadas.
- Exploración 3D del área exterior del Centro Espacial Kennedy.
- Estaciones de trabajo, instrumentos, diálogos, mapa y secuencias
  cinematográficas del traslado de la tripulación y el lanzamiento.
- Guardado automático del progreso, informe final y opción de repetir la
  misión sin perder los desbloqueos de campaña.
- Inicio de sesión por correo, Google, GitHub o modo Invitado.
- Interfaz en español, inglés y francés, con subtítulos y controles de audio.
- Misiones 02 y 03 visibles en el selector, pero todavía bloqueadas y sin
  contenido jugable.

## Tecnologías

| Capa | Tecnologías | Responsabilidad |
| --- | --- | --- |
| Frontend | TypeScript, Vite, Three.js y Babylon.js | Interfaz, escena 3D, controles y lógica de la misión |
| Backend | Python, Flask y SQLAlchemy | API REST, autenticación, progreso e informes |
| Persistencia | SQLite en local o PostgreSQL en producción | Usuarios, misiones, progreso y estadísticas |
| Publicación | Vercel y Render | Frontend estático y API Flask |

El frontend consume la API mediante rutas bajo `/api`. La API emite tokens JWT
y mantiene el progreso por usuario. La clave de NASA, cuando se configura, se
usa únicamente en el backend para cargar contenido complementario en el
selector de misiones.

## Estructura principal

```text
backend/                 API Flask, modelos, autenticación y rutas
frontend/src/apollo/     Mundo, vehículos y contenido de Apollo 11
frontend/src/screens/    Acceso, selector, misión y resultados
frontend/src/state/      Estado, objetivos y reglas de juego
frontend/src/api/        Clientes del backend
frontend/src/config/     Configuración de misión y recursos
docs/                    Diseño, historia, procedencia y verificación
run.py                   Orquestador para desarrollo local
docker-compose.yml       Servicios de backend y frontend en contenedores
```

## Requisitos

- Python 3.10 o superior
- Node.js 18 o superior y npm
- Docker y Docker Compose (opcional)

## Ejecutar en local

Desde la raíz del repositorio:

```bash
# Backend
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm ci
cd ..

# Variables de entorno opcionales
cp .env.example .env

# Iniciar backend y frontend
python3 run.py
```

Después, abre <http://localhost:5173>.

También puedes iniciar un solo servicio:

```bash
python3 run.py --backend   # API en http://localhost:5050
python3 run.py --frontend  # Vite en http://localhost:5173
```

Para ejecutar la versión contenida en Docker:

```bash
docker compose up --build
```

## Configuración

Usa `.env.example` como referencia. No subas archivos `.env`, contraseñas ni
claves privadas al repositorio.

Las variables más importantes son:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Base de datos; por defecto se puede usar SQLite en local |
| `SECRET_KEY` | Clave de sesión de Flask |
| `JWT_SECRET` | Firma de los tokens de autenticación |
| `VITE_API_BASE_URL` | URL pública de la API para el frontend |
| `FRONTEND_URL` | Origen permitido para redirecciones y CORS |
| `CORS_ORIGINS` | Orígenes autorizados para la API |
| `NASA_API_KEY` | Acceso opcional a contenido complementario de NASA |
| `GOOGLE_*` / `GITHUB_*` | Credenciales opcionales para OAuth |

Si no configuras OAuth, el modo Invitado sigue disponible para probar la
experiencia.

## Controles

- **WASD** o flechas: moverse
- **Shift**: correr
- **Arrastrar el mouse**: orbitar la cámara
- **E**: interactuar o inspeccionar
- **M**: abrir el mapa
- **R**: repetir la comunicación de radio
- **H**: minimizar o restaurar el panel de misión
- **Escape**: pausar

La experiencia está optimizada para escritorio. La interfaz se adapta a
ventanas estrechas, pero no ofrece controles táctiles completos.

## Pruebas y compilación

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

El frontend incluye comprobaciones de calidad para la misión Apollo 11. Los
comandos `qa:apollo-*` requieren Playwright y un servidor local de la
aplicación; sus resultados se guardan en `frontend/artifacts/` y no forman
parte del producto publicado.

## API principal

La API usa el prefijo `/api` e incluye, entre otros, estos recursos:

- `GET /health`: estado del servicio.
- `POST /auth/guest`: crea una sesión de Invitado.
- `GET /missions`: devuelve las misiones y su progreso.
- `GET/PUT /progress/<mission_slug>`: consulta o guarda progreso.
- `POST /progress/<mission_slug>/complete`: completa una misión y genera el
  informe.
- `GET/PUT /inventory`: consulta o sincroniza recursos.
- `GET/POST /samples`: consulta o registra muestras.
- `GET/POST /statistics`: consulta o registra métricas.

Salvo las rutas públicas de salud y autenticación, la API requiere un token
JWT en el encabezado `Authorization`.


## Estado del proyecto

La Misión 01 es la experiencia principal disponible. Las misiones posteriores
forman parte de la estructura de campaña, pero su contenido jugable todavía
está pendiente.


