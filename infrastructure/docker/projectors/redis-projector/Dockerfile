FROM python:3.10-slim

WORKDIR /app

# Only postgres strictly needs libpq-dev and gcc, but it's safe to include if sharing requirements.txt
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY utils.py .
COPY redis_projector.py .

CMD ["python", "redis_projector.py"]
