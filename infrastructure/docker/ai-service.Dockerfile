# Mizan AI service (FastAPI). Ref: CLAUDE.md §2, §3.3, §4.
# Ollama itself is deliberately NOT containerized here — it runs natively as a
# systemd service on the Jetson for direct GPU access (see docker-compose.development.yml
# for how this container reaches it via host.docker.internal).

FROM python:3.11-slim AS runtime
WORKDIR /app

COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ai-service/src ./src

EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
