# Guarda la clave de Claude en el servidor sin escribirla en ningún comando ni en el historial.
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\poner-clave.ps1
$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host 'Pega tu clave de Claude (empieza por sk-ant-) y pulsa Enter.' -ForegroundColor Cyan
Write-Host 'No se verá nada mientras la pegas: es normal, el texto va oculto.' -ForegroundColor DarkGray
$secure = Read-Host 'Clave' -AsSecureString
$key = [Net.NetworkCredential]::new('', $secure).Password
if (-not $key.StartsWith('sk-ant-')) {
  Write-Host 'Esa clave no empieza por sk-ant-. Revisa que copiaste la de Claude (no la de Groq) y vuelve a ejecutar.' -ForegroundColor Red
  exit 1
}
Write-Host 'Guardando en el servidor...' -ForegroundColor Cyan
# La clave viaja por la entrada del comando, no dentro de él. Se limpian el salto de línea y la marca BOM que añade PowerShell.
$remote = "cd devsentinel-ai && IFS= read -r K && K=`$(printf %s `$K | tr -d '\r\357\273\277') && { [ -f .env.local.groq ] || cp .env.local .env.local.groq; } && chmod 600 .env.local.groq && sed -i '/^AI_API_KEY=/d;/^AI_PROVIDER=/d;/^AI_MODEL=/d;/^AI_BASE_URL=/d' .env.local && printf 'AI_PROVIDER=anthropic\nAI_MODEL=claude-haiku-5-5\nAI_API_KEY=%s\n' `$K >> .env.local && bash deploy/devsentinel.sh restart"
$key | ssh virtualelearning $remote
if ($LASTEXITCODE -ne 0) {
  Write-Host "No se pudo guardar (código $LASTEXITCODE). Copia este mensaje y mándaselo a Claude." -ForegroundColor Red
  exit 1
}
Write-Host ''
Write-Host 'Listo: la clave quedó guardada y el servidor se reinició.' -ForegroundColor Green
Write-Host 'Avísale a Claude para que pruebe la conexión.' -ForegroundColor Green
