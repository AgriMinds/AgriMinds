# syntax=docker/dockerfile:1.7
# Build context is the repository root (see docker-compose.yml) because the API depends on ../ml.

FROM python:3.12-slim AS builder
RUN pip install --no-cache-dir "uv>=0.5,<0.6"
# This layer pulls ~500 MB of wheels: torch is 187 MB and xgboost drags in nvidia-nccl-cu13 at
# 291 MB, which it declares on Linux for multi-GPU collectives this CPU-only image never uses.
# uv's default 30 s HTTP timeout is per-request, so a single slow wheel fails the whole build —
# which is what `Failed to download fsspec ... network timeout` actually means. Give the large
# downloads room, and let uv retry a flaky connection rather than restarting the layer by hand.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never \
    UV_HTTP_TIMEOUT=600 \
    UV_CONCURRENT_DOWNLOADS=4
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY ml/pyproject.toml ml/README.md ml/
COPY backend/pyproject.toml backend/README.md backend/
# Cache the wheel downloads across builds so a retry after a network failure is cheap. The mount
# is build-only; nothing of it reaches the runtime image.
RUN uv sync --frozen --no-dev --no-install-workspace --package agriminds-api --extra crop-yield
COPY ml/src ml/src
COPY backend/src backend/src
COPY backend/alembic.ini backend/alembic.ini
COPY backend/alembic backend/alembic
RUN uv sync --frozen --no-dev --package agriminds-api --extra crop-yield

FROM python:3.12-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home /app app
WORKDIR /app
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/ml /app/ml
COPY --from=builder --chown=app:app /app/backend /app/backend
# Bake model weights and reference data into the image so Railway has them without a volume mount
COPY --chown=app:app data/models /app/data/models
COPY --chown=app:app data/geo /app/data/geo
COPY --chown=app:app data/raw /app/data/raw
COPY --chown=app:app data/processed /app/data/processed
COPY --chown=app:app data/outputs /app/data/outputs
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    AGRIMINDS_DATA_DIR=/app/data \
    AI_DREWS_DATA_DIR=/app/data
USER app
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1
# Apply pending migrations on container boot so database schema is always up to date
WORKDIR /app/backend
CMD ["sh", "-c", "alembic upgrade head; exec uvicorn agriminds_api.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
