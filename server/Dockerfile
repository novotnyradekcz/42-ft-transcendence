FROM alpine:3.21

# Build-time dependencies
# - build-base  : gcc, g++, make, binutils
# - musl-dev    : musl libc headers (Alpine's libc)
# - perl        : required by openssl-sys vendored build
# - cmake       : required by some vendored C libs
# - pkgconf     : pkg-config shim used by several *-sys crates
# - linux-headers: kernel headers needed when compiling bundled libpq
# - curl        : rustup installer
# - bash        : rustup scripts expect bash
RUN apk add --no-cache \
    curl \
    bash \
    build-base \
    musl-dev \
    perl \
    cmake \
    pkgconf \
    linux-headers

# Install rustup and pin to the exact Rust release required by the project
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain 1.95.0 && \
    rustup --version && \
    rustc --version && \
    cargo --version

WORKDIR /app

# Source code is bind-mounted at runtime via docker-compose.
# On container start: compile the project then execute the binary.
CMD ["sh", "-c", "cargo build && ./target/debug/server"]
