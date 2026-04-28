FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY utils.py .
COPY qdrant_projector.py .
COPY redis_projector.py .
COPY postgres_projector.py .

CMD ["python", "postgres_projector.py"]
