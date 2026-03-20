# Stage 1: build from source
FROM node:22-alpine AS build

ARG BUILD_VERSION=develop
ENV BUILD_VERSION=${BUILD_VERSION}
ENV HUSKY=0

WORKDIR /venus-influx-loader

RUN apk add --no-cache git

COPY . .
RUN npm ci
RUN npm run build

# Stage 2: minimize
FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /venus-influx-loader

COPY --from=build /venus-influx-loader/package*.json ./
COPY --from=build /venus-influx-loader/dist/ ./

RUN npm ci --omit=dev --ignore-scripts

USER root
RUN mkdir -p /config && chown -R node /config

USER node
EXPOSE 8088

HEALTHCHECK --interval=10s --timeout=10s --start-period=5s CMD curl -f http://localhost:8088
CMD [ "./bin/venus-influx-loader.js" ]
