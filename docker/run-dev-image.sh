#!/bin/sh

VER=develop

OWNER=${OWNER:="victronenergy"}
TARGET=venus-influx-loader

TAG="$OWNER/$TARGET:${VER}"

NETWORK="vil"

VIL_INFLUXDB_URL=http://host.docker.internal:8086
VIL_INFLUXDB_USERNAME=s3cr4t
VIL_INFLUXDB_PASSWORD=s3cr4t

docker network inspect $NETWORK 1>/dev/null 2>/dev/null || docker network create $NETWORK

docker run -p 8088:8088 --network $NETWORK \
    -e VIL_INFLUXDB_URL=$VIL_INFLUXDB_URL \
    -e VIL_INFLUXDB_USERNAME=$VIL_INFLUXDB_USERNAME \
    -e VIL_INFLUXDB_PASSWORD=$VIL_INFLUXDB_PASSWORD \
    -v $PWD/../config:/config \
    ${TAG}
