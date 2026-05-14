FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── System dependencies ──────────────────────────────────────────────────────
RUN echo 'Acquire::https::Verify-Peer "false";' > /etc/apt/apt.conf.d/99insecure && \
    echo 'Acquire::https::Verify-Host "false";' >> /etc/apt/apt.conf.d/99insecure && \
    sed -i 's/http:/https:/g' /etc/apt/sources.list

RUN apt-get update && apt-get install -y \
    curl \
    git \
    openssh-server \
    ca-certificates \
    build-essential \
    pkg-config \
    libssl-dev \
    libdbus-1-dev \
    libsodium-dev \
    libclang-dev \
    clang \
    libxxhash-dev \
    libzstd-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Rust + Pijul ─────────────────────────────────────────────────────────────
# Install Rust non-interactively, then compile Pijul from crates.io.
# This produces a guaranteed-working binary and avoids broken pre-built URLs.
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
RUN cargo install pijul --version "1.0.0-beta.11" && cp /root/.cargo/bin/pijul /usr/local/bin/pijul

# ── SSH server configuration ──────────────────────────────────────────────────
RUN mkdir /var/run/sshd

# Harden: disable password auth, enable public-key auth
RUN sed -i \
        -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
        -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
        /etc/ssh/sshd_config

# Dynamic key lookup – runs our Node.js authenticator for every SSH connection
RUN echo "AuthorizedKeysCommand /usr/local/bin/pijul-auth %u" >> /etc/ssh/sshd_config \
 && echo "AuthorizedKeysCommandUser root"                       >> /etc/ssh/sshd_config

# ── Application ───────────────────────────────────────────────────────────────
WORKDIR /app

# Copy source (respects .dockerignore)
COPY . .

# Install and build backend (including native pijul-reader)
RUN cd backend/pijul-reader && npm install && npm run build
RUN cd backend && npm install --omit=dev

# Install and build frontend
RUN cd frontend && npm install && npm run build

# Create pijulserv user
RUN useradd -ms /bin/bash pijulserv

# Install pijul-auth / pijul-shell system-wide using the setup script
RUN APP_DIR=/app AUTH_COMMAND_USER=pijulserv bash /app/scripts/setup-ssh.sh || true

# Runtime directories (will be overlaid by volume mounts)
RUN mkdir -p /app/repos /app/data /app/backend/data
RUN chown -R pijulserv:pijulserv /app/repos /app/data /app/backend/data

# Mark entrypoint executable
RUN chmod +x /app/entrypoint.sh

# ── Ports ─────────────────────────────────────────────────────────────────────
# 3001 = Backend API + Frontend (served by Express)
# 22   = SSH (map to 2222 on the host via docker-compose)
EXPOSE 3001 22

CMD ["/app/entrypoint.sh"]
