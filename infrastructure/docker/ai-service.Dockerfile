# Mizan AI service (FastAPI). Ref: CLAUDE.md §2, §3.3, §4.
# Reaches Ollama on the internal network only; it has no route to the internet
# in production (docker-compose.production.yml), which enforces §1 by design.

FROM python:3.11-slim AS runtime
WORKDIR /app
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-service/src ./src
RUN useradd --system --uid 10001 --no-create-home mizan
USER mizan
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
