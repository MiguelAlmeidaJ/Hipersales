# Atualiza o codigo local sem alterar a base SQLite e sem fazer cutover.
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".git")) { throw "Execute na raiz do clone Hipersales." }
if (git status --porcelain) { throw "Existem alteracoes locais. Salve/commite antes de atualizar." }
$oldBranch = (git branch --show-current).Trim()
if (-not $oldBranch) { throw "Repositorio em detached HEAD." }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "Falha no fetch." }
git switch main
if ($LASTEXITCODE -ne 0) { throw "Falha ao trocar para main." }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Falha no pull --ff-only." }
Write-Host "Codigo atualizado. Banco SQLite local NAO foi migrado." -ForegroundColor Green
Write-Host "Para executar o backend Python existente: python apps/api/app.py"
Write-Host "Antes de iniciar Docker, configure .env e faça backup de dados."
