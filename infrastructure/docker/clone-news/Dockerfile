FROM docker:cli AS docker-cli

FROM python:3.11-slim
# Copy docker CLI binary — needed because CloneContext runs psql via "docker exec"
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app

CMD ["python", "scripts/clone/scheduler.py"]
