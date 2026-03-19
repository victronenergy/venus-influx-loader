#!/bin/sh

BUILD_VERSION=${BUILD_VERSION:=$(git describe --tags)}

mkdir -p ./dist

echo "// @ts-check" >./dist/buildVersion.cjs
echo "module.exports.buildVersion=\"${BUILD_VERSION}\"" >> ./dist/buildInfo.cjs
