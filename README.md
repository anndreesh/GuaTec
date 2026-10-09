# GuaTec: NASA Space 2026

Simulador educativo de exploración espacial. El jugador se autentica (Google,
GitHub o modo Invitado), elige un nombre de usuario, y juega exclusivamente la
**Misión 1: The Beginning**. La misión transcurre al aire libre en un campo
experimental procedural de Auburn, Massachusetts. Los edificios son referencias
cerradas sin interiores jugables; las actividades ocurren en mesas de proyecto,
bancos de ingeniería, una zona de pruebas y estaciones de lanzamiento y
observación. Incluye decisiones, recolección de registros, guardado automático,
telemetría y un informe final. Las Misiones 2 y 3 permanecen bloqueadas y no se
desarrollan todavía.

> **Nota de alcance:** este repositorio se generó a partir de la descripción
> detallada de requisitos del encargo (frontend TS+Vite+Babylon.js con
> fallback, backend Flask con rutas REST/OAuth/SQLAlchemy, orquestación
> raíz, docker-compose, etc.). Ningún archivo de especificación adicional
> llegó adjunto a la sesión; si tienes un documento de diseño más detallado,
> compártelo para refinar contenido narrativo, arte y balance de las
> misiones 2 y 3.

## Estructura del proyecto

```
.
├── backend/               # API Flask + SQLAlchemy
│   ├── app/
│   │   ├── __init__.py    # Application factory
│   │   ├── config.py      # Config por entorno, leída de variables de entorno
│   │   ├── extensions.py  # db, migrate, cors
│   │   ├── models/        # User, Mission, MissionProgress, InventoryItem, Sample, PlayStatistic
│   │   ├── routes/        # Blueprints: auth, user, missions, progress, inventory, samples, statistics
│   │   └── utils/         # seed de misiones, tokens JWT, clientes OAuth
│   ├── wsgi.py            # Entrypoint WSGI (dev: `python wsgi.py`, prod: gunicorn wsgi:app)
│   └── requirements.txt
├── frontend/              # SPA TypeScript + Vite + Babylon.js
│   └── src/
│       ├── config/gameConfig.ts   # Configuración central única (API, recursos, decisiones, tema)
│       ├── babylon/BackdropEngine.ts  # Fondo 3D con Babylon.js + fallback CSS/canvas2D
│       ├── core/           # GameApp (router de pantallas), ApiClient, AuthStore, dom helper
│       ├── api/            # Un módulo por recurso REST del backend
│       ├── state/          # Lógica pura de la Misión 1 (independiente del DOM)
│       ├── screens/        # Splash, Auth, Username, MissionSelect, Mission1, Report
│       └── types/          # Tipos compartidos con el backend (DTOs)
├── run.py                 # Orquestador raíz: levanta backend + frontend juntos
├── docker-compose.yml      # backend (gunicorn) + frontend (build estático + nginx con proxy /api)
└── .env.example            # Variables de entorno de ejemplo (sin secretos reales)
```

## Requisitos

- Python 3.10+ (probado con 3.9/3.12; usa `from __future__ import annotations` por compatibilidad)
- Node.js 18+ y npm
- (Opcional) Docker + Docker Compose para despliegue en contenedores

## Puesta en marcha rápida (desarrollo local)

```bash
# 1) Backend: crear entorno virtual e instalar dependencias
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cd ..

# 2) Frontend: instalar dependencias
cd frontend
npm install
cd ..

# 3) Variables de entorno (opcional para el MVP; usa defaults inseguros si se omite)
cp .env.example .env

# 4) Levantar todo desde la raíz
python3 run.py
```

Esto inicia:
- Backend Flask en `http://localhost:5050` (rutas bajo `/api/...`)
- Frontend Vite en `http://localhost:5173` (proxea `/api` al backend)

Abre `http://localhost:5173` en el navegador.

> ⚠️ **macOS**: el backend usa el puerto `5050` por defecto porque el `5000`
> suele estar ocupado por "AirPlay Receiver". Si necesitas otro puerto,
> define `PORT=xxxx` (y ajusta el proxy en `frontend/vite.config.ts` y
> `GOOGLE/GITHUB_REDIRECT_URI`).

Ejecutar solo un servicio:
```bash
python3 run.py --backend
python3 run.py --frontend
```

## Variables de entorno (`.env.example`)

Todas las credenciales OAuth y secretos se leen exclusivamente de variables
de entorno; **no hay secretos reales en el repositorio**. Si
`GOOGLE_CLIENT_ID`/`SECRET` o `GITHUB_CLIENT_ID`/`SECRET` están vacíos, esas
rutas de login responden `501 google_not_configured` /
`github_not_configured` y la pantalla de autenticación del frontend
deshabilita ese botón automáticamente; el login como **Invitado** siempre
funciona.

También puedes crear una cuenta con correo y contraseña desde la pantalla de
inicio. Las contraseñas se almacenan únicamente como hashes seguros en el
backend. Para activar los botones de Google y GitHub, registra la aplicación
en cada proveedor y completa `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` en el `.env` local. Usa estas
URLs de callback durante el desarrollo:

```text
http://localhost:5050/api/auth/google/callback
http://localhost:5050/api/auth/github/callback
```

`NASA_API_KEY` se mantiene solo en el backend. La pantalla de selección
consulta `/api/nasa/mission-briefing` para mostrar APOD y material marciano
real sin exponer la clave al navegador.

El carrusel también incorpora las noticias más recientes del feed oficial de
NASA, ordenadas por fecha de publicación, además de investigaciones e
imágenes marcianas actuales. Al terminar una misión aparece `Repetir misión`;
esa opción reinicia el estado jugable y conserva los desbloqueos de campaña.

Durante la Misión 1 puedes minimizar el panel con `− Minimizar` o pulsando
`H` para explorar con mayor visibilidad. `☰ Abrir panel` lo restaura. El
movimiento usa `WASD`, la cámara orbita con el mouse, `E` examina estaciones
exteriores y `M` abre el mapa. El mapa muestra posición, orientación, objetivo,
destino, distancia y una ruta orientativa.

La Misión 1 usa geometría y texturas procedurales para mantener el prototipo
ligero, reproducible y coherente con un campo rural de 1926: suelo con
variación de tierra húmeda, hierba, barro, caminos, huellas, rocas, árboles,
cercas, edificios y un vehículo experimental ensamblado por piezas. La
procedencia aprobada para futuras referencias/modelos está registrada en
`frontend/src/config/assetRegistry.ts`. NASA mantiene el catálogo oficial
[NASA 3D Resources](https://science.nasa.gov/3d-resources/); no se descargan
modelos de marketplaces ni sitios desconocidos en tiempo de ejecución.

Los fondos variables del splash, login y selector de misiones son fotografías
reales del programa espacial y viven en `frontend/public/images/`. Para
agregar otro fondo basta con copiar allí un archivo (`.jpg`, `.jpeg`, `.png`,
`.webp`, `.avif` o `.svg` son válidos) y añadir su ruta al arreglo
`MENU_BACKGROUNDS` en `frontend/src/core/GameApp.ts`. Se selecciona una imagen
al azar por carga y se evita repetir la anterior durante la sesión del
navegador (`random.choice`-like, vía `sessionStorage`).

El favicon (`frontend/public/favicon.svg` + `favicon.ico`, `favicon-16.png`,
`favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`) usa la insignia
oficial de la NASA (el "meatball"), un vector de dominio público (obra del
gobierno de EE. UU., 17 U.S.C. §105) tomado de Wikimedia Commons a partir del
archivo `NASA Fav.png` que el usuario agregó en `frontend/public/images/`.
El SVG es la fuente principal (`<link rel="icon" type="image/svg+xml">`) y
los PNG/ICO son fallback para navegadores antiguos y iOS.

## API REST (prefijo `/api`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Chequeo de salud |
| GET | `/auth/providers` | Lista proveedores OAuth y si están configurados |
| GET | `/auth/google/login`, `/auth/github/login` | Devuelve URL de autorización OAuth |
| GET | `/auth/google/callback`, `/auth/github/callback` | Callback OAuth, emite JWT y redirige al frontend |
| POST | `/auth/guest` | Crea sesión de invitado, emite JWT |
| GET | `/user/me` | Perfil del usuario autenticado |
| POST | `/user/username` | Define/actualiza el nombre de usuario (persistente) |
| GET | `/missions` | Carrusel de misiones con estado por usuario |
| GET/PUT | `/progress/<mission_slug>` | Obtiene / autoguarda el progreso de una misión |
| POST | `/progress/<mission_slug>/complete` | Marca la misión completa, guarda informe, desbloquea la siguiente |
| GET/PUT | `/inventory` | Lista / sincroniza el inventario de recursos |
| GET/POST | `/samples` | Lista / registra muestras científicas recolectadas |
| GET/POST | `/statistics` | Lista / registra métricas de telemetría |
| GET | `/statistics/summary/<mission_slug>` | Métricas agregadas para el informe final |

Todas las rutas (excepto `/health`, `/auth/*`) requieren
`Authorization: Bearer <token>` con el JWT emitido por login.

## Flujo del frontend

`Splash → Auth (Google/GitHub/Invitado) → Username → Carrusel de misiones →`
`Misión 1 (jugable) → Informe final → vuelta al carrusel`

- **Misión 1** es completamente jugable: recursos que decaen por turno,
  4 eventos de decisión con efectos en recursos y muestras, guardado
  automático periódico (autosave a `/progress` e `/inventory`), y un informe
  final con resultado (éxito/parcial/fallo).
- **Misión 2 y 3** aparecen en el carrusel como bloqueadas
  (`lockedByDefault=true`) hasta completar la anterior; su contenido
  jugable queda fuera del alcance de este MVP.
- Toda la configuración de balance (recursos, tasas de decaimiento,
  eventos de decisión, duración de la misión, tema visual) vive en un único
  archivo: [`frontend/src/config/gameConfig.ts`](frontend/src/config/gameConfig.ts).

### Fallback sin Babylon.js

El fondo 3D ambiental usa Babylon.js, cargado con `import()` dinámico. Si el
paquete no está disponible (falla de instalación, entorno restringido,
etc.), [`BackdropEngine.ts`](frontend/src/babylon/BackdropEngine.ts) captura el error y
dibuja automáticamente un fondo de estrellas animado con Canvas 2D/CSS, sin
que la aplicación deje de funcionar.

## Despliegue con Docker Compose

```bash
docker compose up --build
```

- `backend`: imagen Python 3.12 + gunicorn, expuesta en `:5050` (host) → `:5000` (contenedor)
- `frontend`: build estático de Vite servido por nginx en `:8080`, con
  `/api/` proxied hacia el servicio `backend`

Configura las variables de entorno reales (OAuth, `SECRET_KEY`, `JWT_SECRET`,
`DATABASE_URL`, etc.) en un archivo `.env` junto a `docker-compose.yml`
(Docker Compose lo carga automáticamente) — nunca commitees ese archivo.

## Publicar con GitHub, Vercel y Supabase

El frontend estático se publica en Vercel, la API Flask en Render y PostgreSQL
en Supabase. El inicio de sesión continúa gestionándose en Flask (correo,
Google, GitHub e invitado), no mediante Supabase Auth. [`render.yaml`](render.yaml)
define el servicio web de Render; [`vercel.json`](vercel.json) configura el build
estático de Vite.

### 1. Subir el proyecto a GitHub

El repositorio ignora los archivos `.env`, entornos virtuales, dependencias
locales y builds generados. Sube el código desde la raíz del proyecto:

```bash
git add .
git commit -m "Prepare deployment"
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

No agregues los archivos `.env` ni contraseñas, claves OAuth o claves de firma
al repositorio. Si una clave real se subió anteriormente, rótala en el
proveedor correspondiente. También se excluyen los modelos 3D originales de
alta resolución (incluido uno que excede el límite de 100 MB de GitHub); el
Proyecto carga las variantes `_optimized.glb`, que sí se incluyen.

### 2. Conectar la base de datos de Supabase

En Supabase, abre **Connect → Direct connection string** y copia la URI
PostgreSQL. Guárdala como `DATABASE_URL` en el servicio web de Render; no la
configures en Vercel ni la subas a GitHub. Render y Supabase admiten conexiones
directas a PostgreSQL. Si la red donde corre el servicio necesita un pooler,
usa el pooler de sesión de Supabase y su URI compatible con psycopg.

Al iniciar la API se crean las tablas que falten. Conserva los permisos de
escritura del usuario de base de datos usado por la aplicación.

### 3. Desplegar el backend en Render

En Render, crea un Blueprint desde este repositorio y usa `render.yaml`. El
servicio necesita estas variables:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | URI PostgreSQL de Supabase |
   | `FRONTEND_URL` | Origen público Vercel, sin `/` final |
   | `CORS_ORIGINS` | El mismo origen público Vercel |

`render.yaml` genera `SECRET_KEY` y `JWT_SECRET` y configura `FLASK_ENV=production`.
El chequeo de salud está en `/api/health`.

### 4. Desplegar el frontend en Vercel

Importa el repositorio conectado y deja **Root Directory** en `frontend`. El
build es `npm ci && npm run build`, y la carpeta de salida es `dist`. Define
`VITE_API_BASE_URL` en Vercel con la URL pública de Render seguida de `/api`,
por ejemplo `https://guatec-api.onrender.com/api`. En Render, define
`FRONTEND_URL` y `CORS_ORIGINS` con el dominio de Vercel. Las credenciales OAuth
son opcionales; si se habilitan, registra las rutas `/api/auth/google/callback`
y `/api/auth/github/callback` del dominio de Render en sus proveedores.

Las variables con credenciales se administran en el proveedor correspondiente
y nunca se suben al repositorio.

## Validación realizada

- ✅ `npx tsc --noEmit` (frontend) sin errores
- ✅ `npm run build` (frontend) genera `dist/` correctamente
- ✅ Backend probado con Flask test client: salud, proveedores OAuth,
  login invitado, `/user/me`, username, misiones, autosave de progreso,
  muestras, completar misión, resumen de estadísticas — todos responden
  como se espera
- ✅ Servidor de desarrollo Flask (`wsgi.py`) y Vite (`npm run dev`)
  levantados juntos manualmente, con el proxy `/api` de Vite reenviando al
  backend real (probado con `curl` a través del puerto 5173)
- ✅ `docker-compose.yml` validado como YAML sintácticamente correcto
  (Docker no estaba disponible en este entorno para un build completo)

## Documentación legal y contacto

La pantalla de acceso incluye enlaces a la política de privacidad, los términos
y la página de contacto; cada documento se abre en una pestaña nueva y permite
cambiar entre español, inglés y francés. Las páginas usan Bootstrap y describen
el tratamiento de los datos y los servicios que utiliza el Proyecto.

Antes de publicar estos documentos para usuarios reales, quien opere el
Proyecto debe completar su identidad legal, domicilio postal y jurisdicción
aplicable en la política de privacidad, además de verificar la documentación
conforme a las leyes de los territorios en los que esté disponible el Proyecto.

## Próximos pasos sugeridos

- Implementar el contenido jugable de las Misiones 2 y 3
- Sustituir el modelo de "eventos de decisión" hardcodeados por datos
  cargados desde el backend (para poder editar el balance sin recompilar)
- Añadir tests automatizados (pytest para el backend, vitest para el frontend)

## Mission 01 — progreso de implementación

La misión enlaza estaciones exteriores con una ruta de objetivos guardable:
descubrimiento del proyecto, inspección del prototipo, configuración abstracta
del vehículo, revisión de sistemas, decisión de lanzamiento y análisis del
vuelo. Los edificios tienen colisión completa y no existen interiores
jugables. La estructura y la instrumentación modifican las métricas y el
aspecto del prototipo; el lanzamiento tiene cuenta regresiva, humo, movimiento
del vehículo y telemetría animada. El mapa presenta la distancia actual al
siguiente objetivo. El informe distingue el resultado simulado de la referencia
histórica de Auburn.

La escena utiliza un personaje procedural de época, equipo exterior y personal
de campo animado. La misión avanza de amanecer a media mañana según los hitos,
con dirección e intensidad solar graduales y cuatro presets atmosféricos. Las
opciones de ingeniería son abstracciones narrativas, no instrucciones de
construcción. La duración de 30–40 minutos es orientativa y depende del ritmo de
exploración y lectura del jugador; no se fuerza con esperas artificiales.

### Actualización visual y procedencia

El campo usa mapas PBR locales 1K de tierra agrícola, barro con huellas y
hierba, más iluminación y reflejos HDRI de un campo rural. Los edificios tienen
tejados inclinados, cimientos, marcos y ventanas, letreros y luz cálida
interior; el prototipo incluye marco de lanzamiento, tuberías visibles,
abrazaderas y materiales envejecidos. La escena incorpora tres props glTF
CC0 de Poly Haven (caja, cubo y paleta), descargados con texturas para no
depender de una red al jugar. La procedencia está en
`frontend/src/config/assetRegistry.ts`; `python3 tools/download_polyhaven_assets.py`
vuelve a descargar las mismas versiones 1K.
