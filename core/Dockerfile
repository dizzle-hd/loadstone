FROM rust AS build

WORKDIR /app

# Workspace-Dateien für Cargo
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./

# Nur core und dashboard/src-tauri sind Workspace-Members
# Wir brauchen aber nur core, also erstellen wir ein Dummy für den anderen Member
COPY core ./core

# Dev-DB für SQLx Compile-Zeit-Prüfung
COPY dev.db ./dev.db

# Dummy für src-tauri damit der Workspace aufgelöst werden kann
RUN mkdir -p dashboard/src-tauri/src && \
    echo '[package]\nname = "lodestone-client"\nversion = "0.0.1"\nedition = "2021"' > dashboard/src-tauri/Cargo.toml && \
    echo 'fn main() {}' > dashboard/src-tauri/src/main.rs

ENV DATABASE_URL=sqlite:///app/dev.db
RUN cargo build --release --features "vendored-openssl" -p lodestone_core

FROM debian:bullseye-slim AS production

RUN apt-get update \
  && apt-get install -y ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/target/release/lodestone_core ./

EXPOSE 16662

RUN groupadd user && useradd -g user user
RUN mkdir -p /home/user/.lodestone
RUN chown user /app /home/user/.lodestone

USER user

VOLUME ["/home/user/.lodestone"]

CMD ["./lodestone_core"]
