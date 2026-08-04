# The toolchain container: everything needed to fetch, load, and measure.
#
# Pinned to a digest-stable tag rather than :latest so that a run today and a
# run in six months are the same run. Reproducibility is not a nicety here --
# an accuracy measurement nobody can reproduce is not evidence.
FROM python:3.12-slim-bookworm

# postgresql-client gives psql and COPY-from-stdin, which is how bulk loads
# happen. No build toolchain is installed: psycopg[binary] ships wheels, and a
# compiler in the image would be dead weight in every future pull.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

WORKDIR /work
