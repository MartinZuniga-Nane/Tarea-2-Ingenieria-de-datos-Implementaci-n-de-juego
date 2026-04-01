FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3-pip python3-pil \
  && rm -rf /var/lib/apt/lists/*

USER node
