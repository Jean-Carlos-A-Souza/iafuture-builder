#!/bin/sh
set -e

APP_DIR="/var/www/html"
API_REPO_URL="${API_REPO_URL:-}"

echo "====================================="
echo " iafuture-builder — Build Worker"
echo "====================================="
echo " ROLE: build_worker"
echo " API_REPO_URL: ${API_REPO_URL:-não configurado}"
echo "====================================="

# Se o código da API ainda não foi clonado, clonar
if [ ! -f "$APP_DIR/artisan" ]; then
    if [ -z "$API_REPO_URL" ]; then
        echo "ERRO: API_REPO_URL não configurado."
        echo "Configure a variável de ambiente API_REPO_URL com a URL do repositório da API."
        exit 1
    fi

    echo "Clonando API Laravel de $API_REPO_URL..."
    git clone "$API_REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
    composer install --no-dev --no-interaction --no-progress --optimize-autoloader
    echo "API clonada com sucesso."
else
    echo "API já presente. Atualizando..."
    cd "$APP_DIR"
    git pull origin main || echo "Aviso: git pull falhou, continuando com versão atual."
fi

# Garantir pastas de storage
mkdir -p \
    "$APP_DIR/storage/app" \
    "$APP_DIR/storage/framework/cache/data" \
    "$APP_DIR/storage/framework/sessions" \
    "$APP_DIR/storage/framework/views" \
    "$APP_DIR/storage/logs" \
    "$APP_DIR/bootstrap/cache"

# Configurações do builder
export CHAT_APP_INSTALLER_TEMPLATE_PATH="/opt/chat-installer"
export CHAT_APP_INSTALLER_CACHE_PATH="/tmp/chat-installer-cache"
export CHAT_APP_INSTALLER_PYTHON_COMMAND="python3"
export CHAT_APP_INSTALLER_NODE_COMMAND="node"
export CHAT_APP_INSTALLER_NPM_COMMAND="npm"
export SERVICE_ROLE="build_worker"

echo "Iniciando worker de builds..."
exec php artisan chat-app:work-builds --sleep="${BUILD_WORKER_SLEEP:-5}"
