FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

ENV DATABASE_URL=sqlite:////app/data/sayze.db
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app/backend

RUN addgroup --system sayze && adduser --system --ingroup sayze sayze \
    && mkdir -p /app/data \
    && chown sayze:sayze /app/data
USER sayze

EXPOSE 7860
CMD ["sh", "-c", "uvicorn backend.demo:app --host 0.0.0.0 --port ${PORT:-7860}"]
