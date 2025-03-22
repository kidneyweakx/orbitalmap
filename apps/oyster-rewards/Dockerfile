FROM rust:1.81-slim-bookworm as builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Create a new empty shell project
WORKDIR /usr/src/app
RUN USER=root cargo new --bin oyster-rewards
WORKDIR /usr/src/app/oyster-rewards

# Copy over manifests and source code
COPY ./Cargo.toml ./Cargo.toml
COPY ./Cargo.lock ./Cargo.lock
COPY ./src ./src
COPY ./benches ./benches

# Build the release binary with the desired features
RUN cargo build --release --bin oyster-api

# Use a slim image for the runtime environment
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -ms /bin/bash app
USER app
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /usr/src/app/oyster-rewards/target/release/oyster-api /app/oyster-api

# Expose the port the app will run on
EXPOSE 8080

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=8080
ENV RUST_LOG=info

# Run the binary
CMD ["/app/oyster-api"] 