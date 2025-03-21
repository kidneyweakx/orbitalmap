FROM rust:1.68-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install wasm32-wasi target
RUN rustup target add wasm32-wasi

# Create a new empty project
WORKDIR /app
COPY . .

# Build the WASM binary
RUN cargo build --release --target=wasm32-wasi

# Second stage - Enarx runtime
FROM ubuntu:22.04

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download and install Enarx using dpkg
WORKDIR /tmp
RUN wget https://github.com/enarx/enarx/releases/download/v0.7.1/enarx-aarch64-unknown-linux-musl
RUN install -m 4755 -o root enarx-aarch64-unknown-linux-musl /usr/bin/enarx

# Copy the WASM binary from the builder stage
WORKDIR /app
COPY --from=builder /app/target/wasm32-wasi/release/tee-rewards.wasm .

# Install Actix Web dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and Actix Web
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Add web interface
COPY web-interface /app/web-interface
WORKDIR /app/web-interface
RUN cargo build --release

# Expose port for web interface
EXPOSE 8080

# Start the web interface
CMD ["./target/release/web-interface"] 