# Venus Influx Loader

## Introduction

Venus Influx Loader is a small application that allows reatime monitoring, and historical data analysis of Venus devices. It obtains realtime measurements from Venus devices via MQTT, stores them for later analysis into InfluxDB, and allows visualization via Grafana.

It supports connection to the Venus devices:

  - Running on the same network and discovered via UPNP.
  - Configured manually by setting their IP address.
  - Configured via VRM login credentials.

Venus Influx Loader can run nearby a Venus device, and does not require internet access.

It is therefore ideal to be installed on a Yacht, Motorhome, or sites without permanent internet access.

## Quick Start

Follow detailed instructions at: https://github.com/victronenergy/venus-grafana to learn how to setup Venus Influx Loader, Influx DB, and Venus Grafana.

## Distribution

Venus Influx Loader is distributed as:

- NPM module: https://www.npmjs.com/package/venus-influx-loader
- Docker Image: https://hub.docker.com/r/victronenergy/venus-influx-loader

## Advanced Configuration

### Venus Influx Loader

Venus Influx Loader allows MQTT connection to the Venus devices running on the same network and discovered via UPNP, configured manually using their IP address, or by accessing them via VRM.

Configuration details and necessary usernames and passwords are stored in `config.json`, and `secrets.json` that are looked up under `--config-path` (`/config` by default). Config Path needs to be writable.

> TODO: should not be needed for config path to be writable in production deployments.

Configuration files can either be created manually, or by starting the Venus Influx Loader, and accessing the Admin UI by browsing to `http://localhost:8088`. The default usernname and password is `admin`, `admin`.

```
$ npx venus-influx-loader --help
Usage: venus-influx-loader [options]

Monitor Venus devices and capture & store realtime data to serve Grafana

Options:
  -V, --version                    output the version number
  -c, --config-path <path>         path to store config.json and secrets.json (default: "/config")
  -p, --port <port>                http port used by Admin Web User Interface and Grafana JSON datasource (default: "8088")
  --grafana-url <url>              http link to Grafana (default: "${window.location.protocol}//${window.location.hostname}:3000")
  --disable-admin-api              disable Admin Web User Interface and /admin-api/ endpoint
  --disable-admin-api-auth         disable password protection for Admin Web User Interface and /admin-api/ endpoint
  --disable-grafana-api            disable Grafana JSON datasource /grafana-api/ endpoint
  --enable-discovery-api           enable venus-upnp-browser /discovery-api/ endpoint
  --hide-settings-influxdb
  --hide-settings-security
  --hide-settings-venus-discovery
  --hide-settings-venus-manual
  --hide-settings-venus-vrm
  -h, --help                       display help for command
  ```

### InfluxDB

Venus Influx Loader can store data into InfluxDB 1.x, InfluxDB 2.x, and InfluxDB 3. Select the version in Admin UI under Settings / InfluxDB, or pre-configure it via the environment variables below. Every version accepts the same measurements, and Grafana dashboards using InfluxQL work against all of them.

| | InfluxDB 1.x (default) | InfluxDB 2.x | InfluxDB 3 Core / Enterprise |
|---|---|---|---|
| Credentials | Username, Password | Organization, Token | Token |
| Database Name means | database | bucket | database |
| Retention | `venus_default` retention policy, created and updated by the loader | bucket retention rule, created and updated by the loader | set only when the loader creates the database, can not be changed later on InfluxDB 3 Core |
| Default port | 8086 | 8086 | 8181 |
| Docker image | `influxdb:1.12` (`influxdb:1.8` on 32-bit ARM) | `influxdb:2.9` | `influxdb:3-core` |

Notes:

- InfluxDB 1.x remains the simplest to run, and `influxdb:1.8` is the only version with 32-bit ARM images (32-bit Raspberry Pi OS). The 1.x line is still maintained, use `influxdb:1.12` on 64-bit systems.
- InfluxDB 2.x: the loader creates the bucket inside the given organization when it is missing. Grafana InfluxQL queries reach the bucket under its name via the automatic DBRP mapping. The token needs read/write access to buckets and read access to the organization.
- InfluxDB 3 Core: the database is created with the configured retention on first connection. By default InfluxDB 3 Core answers queries spanning at most about 72 hours, longer dashboard ranges need InfluxDB 3 Enterprise or a higher `--query-file-limit`. Grafana connects via the InfluxQL `/query` endpoint using the token as password.
- Never use the `influxdb:latest` Docker tag, it points to InfluxDB 3 Core since September 2026.
- Retention `30d`, `12h`, `2w` style, `0` means keep forever, empty leaves the retention untouched.
- Victoria Metrics accepts the InfluxDB 1.x write protocol, select InfluxDB 1.x to store into it.

Environment variables used as defaults when no `config.json` exists yet:

- `VIL_INFLUXDB_VERSION`: `1` (default), `2`, or `3`
- `VIL_INFLUXDB_URL`: for example `http://influxdb:8086`
- `VIL_INFLUXDB_USERNAME`, `VIL_INFLUXDB_PASSWORD`: InfluxDB 1.x
- `VIL_INFLUXDB_ORG`, `VIL_INFLUXDB_TOKEN`: InfluxDB 2.x (`VIL_INFLUXDB_TOKEN` only for InfluxDB 3)

#### Tip: Run Influx Loader headless

For production use, once the system is configured `--disable-admin-api` can be used to run the `venus-influx-loader` headless.

#### Tip: Run Influx Loader behind Load Balancer with your own authentication

Use `--disable-admin-api-auth` to skip basic authentication mechanism protecting access to Admin Web User Interface. That way you can implement your own authentication mechanism.

#### Tip: Customize Admin UI

Use `--hide-settings-*` options to tweak the Admin UI and hide parts of the settings that you do not want to accidentally change. For example InfluxDB settings do not need to be overriden once configured.

### Venus UPNP Browser

Venus Influx Loader contains built in mechanism to discover Venus devices running on the same network via UPNP, that is enabled by default.

In cases where `venus-influx-loader` may not have access to local network UPNP, such as when it runs in isolated docker network, or in docker bridge mode, `venus-upnp-browser` can be used to discover Venus devices over UPNP.

The reason behind spliting the UPNP discovery into separate binary is:

  - ~~Docker container running in host networking mode can not expose ports under Docker Desktop for Mac and Windows (https://github.com/docker/for-mac/issues/6185). So `venus-influx-loader` running in `host` networking mode can access UPNP, but will not get access to port `8088` to enable Admin UI.~~
  - Docker Desktop since version 4.29 (https://docs.docker.com/network/drivers/host/#docker-desktop) allows to experimentally enable host networking mode in which a container running in host network mode can actually expose UDP/TCP ports and gain access to the host network.
  - Docker container running in bridge networking mode does not support UPNP. So `venus-influx-loader` running in `bridge` networking mode will properly map port 8088 for Admin UI, but will not have access to UPNP.
  - Docker container running in isolated networking mode can expose port `8088`, but does not have access to UPNP.

To workaround the limitations, `venus-upnp-browser` actually runs in docker host mode network - having access to both local area UPNP, as well as `venus-influx-loader` admin port exposed via docker, `venus-upnp-browser` communicates discovered Venus devices and diagnostic information to `venus-influx-loader` via `--discovery-api`.

Note: `host` and `bridge` network mode work properly only on Linux, support is being added to Docker Desktop for Windows and Mac incrementally. UPNP does not work in Docker Desktop for Mac at all.

```
$ npx venus-upnp-browser --help
Usage: venus-upnp-browser [options]

Discover Venus devices running on local network using UPNP

Options:
  -V, --version              output the version number
  -d, --discovery-api <url>  discovery api endpoint (default: "http://localhost:8088/discovery-api/")
  -h, --help                 display help for command
```

## Development

To start experimenting, please install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and use the following steps to spin up a quick dev environment:

### Build Venus Influx Loader docker image locally

```
$ export OWNER="martin"
$ (cd docker && ./build-dev-image.sh)
```

### Run InfluxDB docker image instance locally

```
$ (cd docker && ./run-influxdb.sh)     # InfluxDB 1.x on :8086, s3cr4t/s3cr4t
$ (cd docker && ./run-influxdb.sh 2)   # InfluxDB 2.x on :8086, org venus, token s3cr4t-token
$ (cd docker && ./run-influxdb.sh 3)   # InfluxDB 3 Core on :8181, no authentication
```

### Run Venus Influx Loader docker image locally

```
$ export OWNER="martin"
$ (cd docker && ./run-dev-image.sh)
```

Navigate to http://localhost:8088 to access Venus Influx Loader Admin UI, use `admin`, `admin` to sign in, and configure what Venus devices to watch.

Install Venus Grafana by following the instructions here: https://github.com/victronenergy/venus-grafana.


## Source Code Details

The repository is spit into the following components:

## Server

The directory `src/bin`, and `src/server` contains node.js based server watching Venus devices using MQTT and storing real time measurements into InfluxDB. It vends two binaries: `venus-influx-loader`, and `venus-upnp-browser`.

Server is written in TypeScript/JavaScript and compiled using `tsc`.

### Venus Influx Loader Admin UI

The directory `src/client` contains react.js based web admin interface to manage configuration of `src/server`. Influx Loader Admin UI app uses `vite` to compile the browser JavaScript, HTML, and CSS code.

## Development

### Start venus-influx-loader, and client in hot reloading mode

First install all required dependencies:

```
$ npm install
```

Then spin up hot reloading Influx Loader:

```
$ npm run watch-influx-loader
```

and Influx Loader Admin UI:

```
$ npm run watch-client
```

### Run unit tests

```
$ npm test
```

### Run integration tests against real InfluxDB containers

Requires a running Docker daemon, starts InfluxDB 1.8, 1.12, 2.9, and 3 Core via [testcontainers](https://testcontainers.com), and verifies that the loader provisions, writes, and reads back data on each of them. Use `VIL_TEST_INFLUX=1.8,3-core` to run a subset.

```
$ npm run test:integration
```

## Internal API Documentation

Source code is organized according to best practices recommended by  https://github.com/crsandeep/simple-react-full-stack.

The directory `src/client` contains a [React.js](https://reactjs.org) based web app using [React Redux](https://react-redux.js.org) to manage app state and [React Router](https://reactrouter.com/) to handle client side routing. User interface is developed using [Core UI React Components](https://coreui.io/react/) and follows the structure of [Core UI Admin Template](https://coreui.io/product/free-react-admin-template/).

The directory `/src/server` is a [Node.js](https://nodejs.org/en/) app that is configured via `/config/config.json` and `/config/secrets.json` to determine what Venus OS devices to watch and how, and where to store data.

`/src/server` exposes the following internal API routes.

1. `/admin` protected by admin username and password stored in `/config/secrets.json`.

    - This route serves compiled and packed `src/client` `html`, `js`, and `css` web app files from `src/client/dist`.

2. `/admin-api` protected by admin username and password stored in `/config/secrets.json`.

   - `/admin-api/config` for `src/client` to `GET/PUT` `/config/config.json`.
   - `/admin-api/security` for `scr/client` to `POST` new admin username and password and save to `/config/secrets.json`.
   - `/admin-api/log` for `src/client` to `GET` recent server log entries.
   - `/admin-api/debug` to `src/client` to `PUT` server in `debug` or `info` log mode.


   - `/admin-api/vrmLogin` `POST` to login into VRM.
   - `/admin-api/vrmLogout` `POST` to logout from VRM.
   - `/admin-api/vrmRefresh` `PUT` to refresh list of portals available via VRM.
   - TODO: cleanup (move away from `vrm.js` ??)


3. `/grafana-api` that is unprotected and used by [Grafana JSON Datasource](https://grafana.com/grafana/plugins/simpod-json-datasource/) to query Venus OS devices being watched.
   - `/grafana-api/` `GET`
   - `/grafana-api/metrics` `POST`
   - `/grafana-api/query ` `POST`

4. Interface for `venus-upnp-browser`. Unprotected.

   - `/discovery-api/log` to `POST`a new server log entry.
   - `/discovery-api/upnpDiscovered` to `POST` info about Venus OS device newly discovered via externally running `venus-upnp-browser`.
   - TODO: protect with admin username and password so that nobody can flood the log and discovery endpoint?

