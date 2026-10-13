#!/bin/bash
#
# Starts a throwaway InfluxDB for local development. Usage: ./run-influxdb.sh [1|2|3]
#
#   1 (default) InfluxDB 1.x  on :8086, username/password s3cr4t/s3cr4t
#   2           InfluxDB 2.x  on :8086, org venus, token s3cr4t-token
#   3           InfluxDB 3    on :8181, no authentication
#
# Never use the `latest` tag, it points to InfluxDB 3 Core since September 2026.

VERSION=${1:-1}
NETWORK="vil"

docker network inspect $NETWORK 1>/dev/null 2>/dev/null || docker network create $NETWORK

case "$VERSION" in
  1)
    # 1.8 is the last release with 32-bit ARM images, 1.12 is the current 1.x line
    # TODO: move to influxdb:1.13 once the OSS image is published on Docker Hub
    docker run --rm -p 8086:8086 --network $NETWORK \
        -e INFLUXDB_HTTP_LOG_ENABLED=false \
        -e INFLUXDB_HTTP_AUTH_ENABLED=true \
        -e INFLUXDB_ADMIN_USER=s3cr4t \
        -e INFLUXDB_ADMIN_PASSWORD=s3cr4t \
        influxdb:1.12
    ;;
  2)
    docker run --rm -p 8086:8086 --network $NETWORK \
        -e DOCKER_INFLUXDB_INIT_MODE=setup \
        -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
        -e DOCKER_INFLUXDB_INIT_PASSWORD=s3cr4ts3cr4t \
        -e DOCKER_INFLUXDB_INIT_ORG=venus \
        -e DOCKER_INFLUXDB_INIT_BUCKET=init \
        -e DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=s3cr4t-token \
        influxdb:2.9
    ;;
  3)
    docker run --rm -p 8181:8181 --network $NETWORK \
        -e INFLUXDB3_NODE_IDENTIFIER_PREFIX=node0 \
        -e INFLUXDB3_OBJECT_STORE=memory \
        -e INFLUXDB3_WITHOUT_AUTH=true \
        influxdb:3-core
    ;;
  *)
    echo "usage: $0 [1|2|3]" >&2
    exit 1
    ;;
esac
