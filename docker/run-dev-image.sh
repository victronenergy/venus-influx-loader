VER=develop

OWNER=${OWNER:="victronenergy"}
TARGET=venus-influx-loader

TAG="$OWNER/$TARGET:${VER}"

docker run -it -v $PWD/../config:/config ${TAG}
