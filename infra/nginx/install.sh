#!/usr/bin/env bash
set -euo pipefail

# Rode na raiz do monorepo: bash infra/nginx/install.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$ROOT/infra/nginx/hipersales.conf"
TARGET="/etc/nginx/sites-available/hipersales"
LINK="/etc/nginx/sites-enabled/hipersales"

if [[ ! -f "$SOURCE" ]]; then echo "Configuração ausente: $SOURCE" >&2; exit 1; fi
if ! command -v nginx >/dev/null; then echo "Instale o Nginx antes de continuar." >&2; exit 1; fi
if [[ -e "$TARGET" ]]; then
  echo "O arquivo $TARGET já existe. Confira as alterações antes de substituí-lo." >&2
  echo "sudo diff -u '$TARGET' '$SOURCE' || true" >&2
  exit 1
fi

sudo install -m 644 "$SOURCE" "$TARGET"
sudo ln -s "$TARGET" "$LINK"
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "Nginx configurado. Após DNS apontar ao servidor, emita o certificado:"
  echo "sudo certbot --nginx -d web.hipersalesweb.com.br -d api.hipersalesweb.com.br --redirect"
else
  sudo rm -f "$LINK" "$TARGET"
  echo "Teste falhou; alteração desfeita." >&2
  exit 1
fi
