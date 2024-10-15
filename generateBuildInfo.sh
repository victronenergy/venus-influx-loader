#!/bin/sh

BUILD_VERSION=${BUILD_VERSION:=$(git describe --tags)}

mkdir -p ./dist
echo "// @ts-check\nmodule.exports.buildVersion=\"${BUILD_VERSION}\"" > ./dist/buildInfo.cjs
