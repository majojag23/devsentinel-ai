# DevSentinel AI

Primera versión local con Next.js y React. Dashboard adaptable con incidentes, búsqueda, filtro, diff, registro de acciones, suite real y puerta de aprobación.

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
- No hay conexión GitHub, recepción de webhooks, usuarios autenticados ni persistencia de auditoría. El diff inicial es una propuesta de ejemplo. Esta versión no debe exponerse públicamente.
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

La publicación está pendiente hasta implementar esa integración; un botón de frontend por sí solo no representa una autorización segura para GitHub.
