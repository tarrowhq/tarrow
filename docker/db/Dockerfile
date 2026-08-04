# The database image, built rather than pulled.
#
# The obvious move is `image: postgis/postgis:17-3.5`. We don't, for two
# reasons:
#
#   1. ARCHITECTURE. postgis/postgis publishes amd64 only. Under Constitution
#      Principle VII, somap must be runnable by anyone -- and "anyone" includes
#      every self-hoster on Apple Silicon, an ARM VPS, or a Raspberry Pi. An
#      amd64-only database silently excludes them, or drops them into
#      emulation. The official postgres image is genuinely multi-arch
#      (amd64, arm64, arm, ppc64le, s390x, ...), so building on it inherits that.
#
#   2. PROVENANCE. There are third-party multi-arch PostGIS images. Using one
#      would mean the component that computes somap's safety-critical distances
#      comes from an account we do not control and cannot audit. The official
#      postgres image plus the PostGIS packages from PGDG -- the PostgreSQL
#      project's own apt repository, already configured in that base image --
#      is a supply chain a reviewer can actually follow.
#
# The cost is one apt install at build time, cached thereafter.

FROM postgres:17-bookworm

# postgresql-17-postgis-3 comes from PGDG, whose apt source and signing key are
# already present in the base image. Version-pin the major/minor line but let
# patch releases through: PostGIS patches are bug fixes, and pinning to an exact
# patch would mean shipping known-fixed bugs for the sake of a stable string.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-17-postgis-3 \
        postgresql-17-postgis-3-scripts \
    && rm -rf /var/lib/apt/lists/*

# Create the extensions at cluster init so no application code ever needs
# permission to run CREATE EXTENSION. Files here run once, on an empty data
# directory, in filename order.
COPY init/ /docker-entrypoint-initdb.d/
