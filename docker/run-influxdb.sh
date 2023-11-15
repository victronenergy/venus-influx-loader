#!/bin/bash

TAG="influxdb:1.8"
NETWORK="vil"

INFLUXDB_ADMIN_USER=s3cr4t
INFLUXDB_ADMIN_PASSWORD=s3cr4t

docker network inspect $NETWORK 1>/dev/null 2>/dev/null || docker network create $NETWORK

docker run -p 8086:8086 --network $NETWORK \
    -e INFLUXDB_HTTP_LOG_ENABLED=false \
    -e INFLUXDB_HTTP_AUTH_ENABLED=true \
    -e INFLUXDB_ADMIN_USER=$INFLUXDB_ADMIN_USER \
    -e INFLUXDB_ADMIN_PASSWORD=$INFLUXDB_ADMIN_PASSWORD \
    ${TAG}
