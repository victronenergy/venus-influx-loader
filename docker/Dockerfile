# Stage 1: build from source
FROM node:20 as build

WORKDIR /venus-influx-loader

COPY . .
RUN npm install
RUN npm run build

# Stage 2: minimize
FROM node:20-slim

RUN apt-get update && apt-get install -y curl

WORKDIR /venus-influx-loader

COPY --from=build /venus-influx-loader/bin ./bin
COPY --from=build /venus-influx-loader/dist ./dist
COPY --from=build /venus-influx-loader/src/server ./src/server
COPY --from=build /venus-influx-loader/package*.json ./

RUN npm install --omit=dev

USER root
RUN mkdir -p /config && chown -R node /config

USER node
EXPOSE 8088

HEALTHCHECK --interval=10s --timeout=10s --start-period=5s CMD curl -f http://localhost:8088
CMD [ "./bin/venus-influx-loader.js" ]
