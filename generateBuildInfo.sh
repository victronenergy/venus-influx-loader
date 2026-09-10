#!/bin/sh

BUILD_VERSION=${BUILD_VERSION:=$(git describe --tags)}

mkdir -p ./dist

printf '// @ts-check\nmodule.exports.buildVersion="%s"\n' "${BUILD_VERSION}" > ./dist/buildInfo.cjs
