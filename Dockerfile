# Stage 1: build the Vue frontend
FROM node:20-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: build the Python wheel
FROM python:3.12-slim AS builder
WORKDIR /build
ARG VERSION=0.0.0.dev0
ENV SETUPTOOLS_SCM_PRETEND_VERSION=${VERSION}
COPY pyproject.toml README.md LICENSE ./
COPY skills_vis/ skills_vis/
COPY --from=frontend /build/dist skills_vis/static
RUN pip install build --no-cache-dir && \
    python -m build --wheel

# Stage 3: export wheel only
FROM scratch
COPY --from=builder /build/dist /
