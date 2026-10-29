# GitHub App para repositorios privados

La app sigue usando el inicio de sesión de siempre (Auth.js con GitHub), pero con las credenciales de una **GitHub App** en lugar de una OAuth App. El token de usuario de una GitHub App solo llega a los repositorios donde la app está instalada y donde esa persona tiene permiso, y sus permisos son los que se marcan abajo (no el alcance amplio `public_repo`).

## 1. Crear la app (GitHub → Settings → Developer settings → GitHub Apps → New GitHub App)

| Campo | Valor |
|---|---|
| GitHub App name | `DevSentinel AI` (si está ocupado, añade algo) |
| Homepage URL | `https://devsentinel-ai.virtualelearning.co` |
| Callback URL | `https://devsentinel-ai.virtualelearning.co/api/auth/callback/github` (añade también la de `onrender.com`) |
| Expire user authorization tokens | **desmarcado** |
| Request user authorization (OAuth) during installation | desmarcado |
| Webhook → Active | **desmarcado** |
| Where can this app be installed | Any account |

### Permisos (solo estos)

| Tipo | Permiso | Acceso | Para qué |
|---|---|---|---|
| Repository | Contents | Read and write | leer archivos y subir la rama del arreglo |
| Repository | Pull requests | Read and write | abrir el PR en borrador y revisar PRs |
| Repository | Actions | Read-only | leer el registro de una CI fallida |
| Repository | Checks | Read-only | ver qué comprobaciones fallaron |
| Repository | Metadata | Read-only | obligatorio |
| Account | Email addresses | Read-only | iniciar sesión |

## 2. Credenciales

En la página de la app: copia el **Client ID** y pulsa **Generate a new client secret** (cópialo en el momento: no se vuelve a mostrar). No necesitas la llave privada ni el App ID.

## 3. Instalarla

Install App → tu cuenta → **Only select repositories** → elige los que quieras (privados incluidos).

## 4. Render (Environment)

| Variable | Valor |
|---|---|
| `AUTH_GITHUB_ID` | Client ID de la GitHub App |
| `AUTH_GITHUB_SECRET` | su client secret |
| `ALLOW_PRIVATE_REPOS` | `true` |
| `GITHUB_APP_SLUG` | el final de la dirección de la app (`github.com/apps/<slug>`); opcional, añade el enlace de instalación a los errores 404 |

Guarda: Render redespliega solo. Cierra sesión y vuelve a entrar para tener un token nuevo.

## Qué cambia para quien usa la app

- Un repositorio donde la app no está instalada responde "no encontramos el repositorio" (aunque exista): hay que instalarla ahí.
- El código de los repos privados se envía al proveedor de IA (Claude) para analizarlo. Por eso `ALLOW_PRIVATE_REPOS` empieza apagado.
- Los commits y PR salen a nombre de quien aprobó; GitHub los marca como hechos a través de la app.
