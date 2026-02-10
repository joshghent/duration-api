# Build stage
FROM rust:1.77-slim AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src/ src/

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/durationapi /usr/local/bin/durationapi

WORKDIR /data
EXPOSE 3000

ENTRYPOINT ["durationapi"]
CMD ["serve", "--port", "3000", "--db-path", "/data/durationapi.db"]
