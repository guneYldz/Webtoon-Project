# ==============================================================================
# Kaos Manga Backend — Multi-Stage Non-Root Production Dockerfile (Faz 2)
# ==============================================================================

# 1. Builder Stage: Compile C extensions & install Python wheels into /opt/venv
FROM python:3.14-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 2. Runtime Stage: Lean image without compiler toolchain, running as appuser
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    UVICORN_WORKERS=2

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    gosu \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 1000 appuser \
    && useradd -m -u 1000 -g 1000 -s /bin/sh appuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser . /app

RUN sed -i 's/\r$//' /app/entrypoint.sh /app/scripts/*.sh 2>/dev/null || true && \
    chmod +x /app/entrypoint.sh /app/scripts/*.sh 2>/dev/null || true

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
