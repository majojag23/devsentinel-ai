# DevSentinel AI

Aplicación local con Next.js y React. Dashboard adaptable con incidentes, búsqueda, filtro, diff, registro de acciones, suite real y puerta de aprobación. Incluye acceso OAuth, planes propuestos y editor manual con publicación autenticada por PR.

## Ejecutar

Requiere Node.js 22.12+ y npm.

```powershell
npm install
npm run dev
```

Abrir http://127.0.0.1:3100. Seleccionar **Nuevo análisis** o **Ejecutar demo real**. El servidor crea una fixture temporal, reproduce tres fallos, aplica el cambio y vuelve a ejecutar cuatro tests de Node.js. La suite es fija; el navegador no puede elegir comandos ni rutas. La aprobación está deshabilitada hasta completar la verificación.

```powershell
npm test
npm run build
```

## Qué es real y qué es demostración

- Reales: servidor Next.js, ejecución de procesos Node.js, reproducción del error, escritura del fix, verificación de tests e interacciones del dashboard.
- Demostración: repositorios, incidentes, estadísticas, fechas, rama y aprobación. Aprobar registra un estado en la sesión del navegador; no crea un PR. El motor demo aplica un cambio determinista, sin modelo.
- OAuth Google/GitHub y publicación de PR están implementados pero requieren credenciales del servidor. No hay recepción de webhooks, ejecución de repositorios externos, suscripciones pagadas ni persistencia de auditoría. El dashboard principal continúa siendo una demo pública; sus métricas son de ejemplo.
- Una carpeta temporal separa las fixtures del proyecto; **no es un sandbox de seguridad para código no confiable**. Antes de ejecutar repositorios externos se requiere un contenedor sin credenciales y límites de red, CPU y tiempo.

## Adaptador Copilot SDK

`lib/copilot.mjs` incluye un motor optativo con `CopilotClient`, `defineTool` y herramientas `fetch_ci_logs`, `read_file`, `write_file`, `run_test_suite`. El SDK gestiona las iteraciones de herramientas; el adaptador registra acciones y observaciones, sin publicar razonamiento privado. No está conectado al dashboard: se prueba por CLI sobre una fixture desechable.

Con el runtime de Copilot y autenticación disponibles:

```powershell
node scripts/copilot.mjs
```

Opcional: `COPILOT_MODEL` selecciona un modelo disponible. Las herramientas de archivo solo admiten dos nombres fijos; la escritura solo admite `auth.mjs`. La suite no se puede modificar. Ninguna herramienta crea ramas, PRs o merges. La ejecución del adaptador requiere acceso a Copilot y no se valida sin credenciales.

Referencia del SDK: https://github.com/github/copilot-sdk/blob/main/nodejs/README.md

## Siguiente integración para repositorios reales

1. GitHub App con instalación por repositorio y webhooks firmados, deduplicados.
2. Cola de trabajos y contenedor efímero por commit; checks sobre el SHA exacto.
3. Guardar diff, SHA base, SHA de propuesta, tests y auditoría en una base de datos.
4. Endpoint autenticado de aprobación con protección CSRF e idempotencia. Debe comprobar que diff y SHA coinciden con lo revisado.
5. Crear rama y PR solo después de aprobar. `create_github_pr` pertenece al servicio de publicación, nunca al catálogo de herramientas del agente. No implementar merge automático.

La publicación automática del motor está pendiente de esa integración. El editor manual utiliza su propio endpoint autenticado para publicar propuestas aprobadas en repositorios públicos.

## Acceso con Google y GitHub

1. Copiar `.env.example` a `.env.local`.
2. Generar `AUTH_SECRET` con el comando del ejemplo; mantenerlo estable en el servidor.
3. Crear un cliente OAuth de tipo Web en Google Cloud. Configurar el origen `http://localhost:3100` y callback `http://localhost:3100/api/auth/callback/google`. Guardar el ID y secreto en `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`.
4. Para publicación, crear una OAuth App de GitHub con callback `http://localhost:3100/api/auth/callback/github`. Guardar `AUTH_GITHUB_ID` y `AUTH_GITHUB_SECRET`.
5. Reiniciar el servidor y abrirlo con el mismo host definido en `AUTH_URL`. `localhost` y `127.0.0.1` no se deben mezclar en el flujo OAuth. Google puede requerir añadir usuarios de prueba a la pantalla de consentimiento.

`/login` muestra los proveedores disponibles, acceso a la demo y cierre de sesión. Los proveedores sin configurar permanecen deshabilitados. No existe un usuario de Google simulado ni una contraseña local alternativa. Auth.js maneja las cookies de sesión y la protección CSRF del acceso/salida. Las sesiones JWT duran ocho horas. El token GitHub se conserva solo en el JWT cifrado de sesión HttpOnly y no se incluye en `/api/account`.

El acceso con Google identifica al usuario; no concede permisos GitHub. Para publicar se inicia sesión con GitHub. En esta versión son proveedores de sesión alternativos, **no cuentas vinculadas**. No hay base de datos de usuarios ni vinculación persistente.

## Editor y publicación manual

En `/studio` puedes editar una fixture de ejemplo, comparar con la fuente y descargar un patch. El editor permanece en memoria y no ejecuta código arbitrario. Advierte antes de abandonar cambios sin publicar.

Tras entrar con GitHub, cargar un archivo por `propietario/repositorio`, ruta y rama. La conexión OAuth solicita `read:user user:email public_repo`; este último alcance otorga permisos sobre repositorios públicos accesibles por la cuenta. La autorización exacta se muestra en GitHub. La aplicación comprueba que el repositorio sea público y que el usuario tenga permiso de escritura. No está diseñada para repositorios privados; para ello se recomienda una GitHub App con permisos por instalación.

La publicación requiere una revisión y confirmación explícita. El servidor verifica sesión, token, origen de solicitud, tamaño, ruta permitida y SHA base. Si el archivo o la rama cambió desde su carga, rechaza la publicación con 409. Crea una rama `sentinel/edit-<hash>` desde el commit revisado, escribe el archivo y abre un **PR en borrador**. No se ejecuta merge ni escritura directa en la rama base. Los tokens nunca se envían en JSON al navegador.

Los cambios manuales se describen como **tests no ejecutados**. La suite de la demo no valida el contenido del editor. Los archivos ocultos, flujos de GitHub Actions y archivos mayores de 150 KB no están admitidos. Si GitHub falla tras crear la rama, se informa el nombre para revisión manual; no se eliminan ramas ni se reintenta la escritura automáticamente. El mismo contenido genera el mismo nombre de rama para evitar publicaciones duplicadas.

## Planes

`/plans` presenta Developer, Sentinel Pro y Team. Es una propuesta de producto: sin precios finales, checkout, cobros, suscripciones activas ni permisos premium ficticios. Pro y Team muestran funcionalidades futuras de forma explícita.

## Validación y límites

`npm test` verifica la reproducción del bug, publicación mediante API simulada, bloqueo de commits desactualizados, aprobación obligatoria, rutas prohibidas y conservación de la rama ante fallos parciales. OAuth real y publicación real deben probarse con credenciales y un repositorio de prueba. Las comprobaciones con mocks no prueban permisos o callbacks reales.

Antes de ofrecerlo como SaaS: GitHub App, base de datos de cuentas/instalaciones, historial de auditoría persistente, revocación de sesiones, límites de tasa y uso por usuario, aislamiento de ejecuciones y proveedor de pagos con webhooks verificados. Las rutas de demo permanecen públicas y solo ejecutan una fixture fija; deben limitarse o protegerse antes de desplegar públicamente.
