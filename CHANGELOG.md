# [1.2.0](https://github.com/victronenergy/venus-influx-loader/compare/1.1.0...1.2.0) (2024-09-13)


### Bug Fixes

* **docker:** correct Dockerfile syntax ([1abb6f0](https://github.com/victronenergy/venus-influx-loader/commit/1abb6f0ee5fb5695b4d10faa56a2988d2ecb3773))
* **docker:** correctly propagate git_ref to nested docker builds ([b79455f](https://github.com/victronenergy/venus-influx-loader/commit/b79455fcf87f8ca3b40d0e84df0d279c44054d10))
* **docker:** infer BUILD_VERSION from environment ([6770b9c](https://github.com/victronenergy/venus-influx-loader/commit/6770b9c9b199cf77609f9f75e5e149f5d752ca41))
* **gh:** bump actions/checkout from v3 to v4 ([4c3dd7c](https://github.com/victronenergy/venus-influx-loader/commit/4c3dd7c7f3cd576098d11ef6516a5ba4584a0a4a))
* **gh:** revert to fetch-depth: 0 ([30a489c](https://github.com/victronenergy/venus-influx-loader/commit/30a489c956076e5c63bea1ec82485aa2983acc2a))
* **loader:** remove unnecesary VRM MQTT reconnect code, lower MQTT reconnect interval to 10s ([f9ce300](https://github.com/victronenergy/venus-influx-loader/commit/f9ce300f5141801198ca55af72e4e7df48065179))


### Features

* **build:** extract buildVersion, use it in mqtt clientId ([c523cc6](https://github.com/victronenergy/venus-influx-loader/commit/c523cc6ca31e15ac26001e34915fd58fafeca408))

## [1.1.1](https://github.com/victronenergy/venus-grafana/compare/1.1.0...1.1.1) (2024-09-13)


### Bug Fixes

* **examples:** use maj.min version tag for docker images ([13ed40c](https://github.com/victronenergy/venus-grafana/commit/13ed40cf3b034a3d7288d6b62c3fe121184b0713))
* **examples:** use properly tagged docker images in example compose files ([6c5458b](https://github.com/victronenergy/venus-grafana/commit/6c5458b435e43acda554a8cad8efa62e264c3775))
