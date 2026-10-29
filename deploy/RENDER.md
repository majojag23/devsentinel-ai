# Despliegue en Render

Servicio web Node (sin Docker) + base de datos Postgres en la misma región.
Las claves se escriben solo en el panel de Render, nunca en el repositorio.

## Servicio web (New + → Web Service → repositorio `majojag23/devsentinel-ai`)

| Campo | Valor |
|---|---|
| Runtime | Node |
| Región | la misma de la base de datos (Virginia) |
| Branch | `main` |
| Build Command | `npm ci && npm run build` |
| Start Command | `node deploy/server.mjs` |
| Health Check Path | `/login` |
| Instance type | Starter |

## Variables de entorno

| Nombre | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `HOST` | `0.0.0.0` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | la URL pública, p. ej. `https://devsentinel-ai.virtualelearning.co` |
| `AUTH_SECRET` | el mismo que usa hoy el servidor |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | los de la OAuth App de GitHub |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | los de Google |
| `AI_PROVIDER` | `anthropic` |
| `AI_API_KEY` | la clave de Claude |
| `AI_MODEL` | `claude-haiku-5-5` |
| `DATABASE_URL` | **Internal Database URL** de `devsentinel-db` |

`PORT` lo pone Render solo. Sin `DATABASE_URL` la app guarda el historial en archivos, que en Render se pierden en cada despliegue: no la dejes vacía.

## Después del primer despliegue

1. En GitHub (Settings → Developer settings → OAuth Apps) añade como callback `https://<dominio>/api/auth/callback/github`; en Google, `https://<dominio>/api/auth/callback/google`.
2. Prueba el acceso y haz una acción que quede en el historial; recarga y comprueba que sigue ahí.
3. Cuando todo funcione, en Render: Settings → Custom Domains. Apunta el DNS y recién entonces apaga el servidor de SiteGround.
