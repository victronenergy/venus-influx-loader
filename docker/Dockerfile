# Stage 1: build from source
FROM node:18-alpine as build

WORKDIR /venus-influx-loader

COPY . .
RUN npm install
RUN npm run build

# Stage 2: minimize
FROM node:18-alpine

RUN apk --no-cache add curl

WORKDIR /venus-influx-loader

COPY --from=build /venus-influx-loader/bin ./bin
COPY --from=build /venus-influx-loader/dist ./dist
COPY --from=build /venus-influx-loader/src/server ./src/server
COPY --from=build /venus-influx-loader/package*.json ./

RUN npm install --omit=dev

USER node
EXPOSE 8088

HEALTHCHECK --interval=10s --timeout=10s --start-period=5s CMD curl -f http://localhost:8088
CMD [ "./bin/venus-influx-loader.js" ]
