FROM imperium-spark:3.5.3

USER root

# Copy the entire news-pipeline codebase into the container
COPY . /opt/imperium/news-pipeline

# Change ownership back to spark user
RUN chown -R spark:spark /opt/imperium/news-pipeline

USER spark

# Set the PYTHONPATH env variable so Python can find your helper scripts
ENV PYTHONPATH="/opt/imperium/news-pipeline/src"

# The command will be provided by Kubernetes or Docker Compose (e.g., via spark-submit)
