# Infraestrutura do HiperSales

Estrutura:
- `nginx/hipersales.conf`: virtual hosts HTTP para API e Web; Certbot adicionará HTTPS no servidor
- `nginx/install.sh`: instalação cautelosa no Ubuntu/Debian, preservando arquivos Nginx existentes
- `docker/README.md`: instruções dos containers SQL Server, Evolution, PostgreSQL e Redis
- `../docker-compose.yml`: arquivo Compose mantido **na raiz** para preservar o nome/projeto dos volumes existentes
- `../ecosystem.config.cjs`: PM2 mantido **na raiz** para conservar os caminhos e os comandos atuais
- `../docs/deploy-linux.md`: passo a passo completo

## Aplicar Nginx

```bash
cd /opt/hipersales
bash infra/nginx/install.sh
```

Depois de confirmar os dois registros DNS e liberar portas 80/443:

```bash
sudo certbot --nginx -d web.hipersalesweb.com.br -d api.hipersalesweb.com.br --redirect
```

Não use `docker compose down -v`. Mover o Compose para outra pasta pode alterar o nome do projeto Docker e causar indisponibilidade aparente dos volumes; por isso ele permanece na raiz.
