# =====================================================
# iafuture-builder — Worker de build do chat externo
# Contém: Rust, Wine, LLVM, NSIS, Node, Python, Tauri
# Deploy MANUAL — só atualizar quando o template mudar
# =====================================================
FROM php:8.2-cli

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV PATH=/usr/local/cargo/bin:${PATH}

RUN dpkg --add-architecture i386 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        unzip \
        zip \
        xz-utils \
        ca-certificates \
        build-essential \
        pkg-config \
        clang \
        llvm \
        lld \
        nsis \
        libpq-dev \
        libzip-dev \
        libicu-dev \
        python3 \
        python3-pil \
        nodejs \
        npm \
        wine \
        wine64 \
        wine32 \
    && curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal \
    && rustup target add x86_64-pc-windows-msvc \
    && cargo install --locked cargo-xwin \
    && docker-php-ext-install pdo_pgsql intl zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Template do chat externo fica na imagem
COPY external-chat-installer/ /opt/chat-installer/

# Script de geração de assets de branding
COPY scripts/ /opt/scripts/

WORKDIR /var/www/html

COPY entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint \
    && sed -i 's/\r$//' /usr/local/bin/entrypoint

EXPOSE 8080

CMD ["sh", "/usr/local/bin/entrypoint"]
