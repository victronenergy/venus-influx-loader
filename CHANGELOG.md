# [1.5.0](https://github.com/victronenergy/venus-influx-loader/compare/1.4.0...1.5.0) (2025-03-12)


### Bug Fixes

* Address TS issue in ms package ([8c021bd](https://github.com/victronenergy/venus-influx-loader/commit/8c021bd0caf0ec9321ea58fd6be1e423f280f1cf))
* Ensure MQTT subscriptions are always valid ([e7da4a4](https://github.com/victronenergy/venus-influx-loader/commit/e7da4a46fa87a2fb07ae495fa81b2d77a8511a70))


### Features

* Allow selection of multiple MQTT subscriptions ([06219b9](https://github.com/victronenergy/venus-influx-loader/commit/06219b9f16da826fb902bbb733695205beca54f5))
* Display VRM token expiry in the Admin UI ([5443902](https://github.com/victronenergy/venus-influx-loader/commit/5443902404624b5a962385fc2872c7a9c6eca975))
* Prevent saving invalid config, flag errors in form ([1e0c90f](https://github.com/victronenergy/venus-influx-loader/commit/1e0c90f96228f6f1c13ea1459c34522c64ee2882))
* Show/Hide multiple selection box for MQTT subscriptions ([30be976](https://github.com/victronenergy/venus-influx-loader/commit/30be976a0e75d5df2f1a27dedaabc1f2e54d54fc))

# [1.4.0](https://github.com/victronenergy/venus-influx-loader/compare/1.3.1...1.4.0) (2024-12-16)


### Bug Fixes

* Add Filter/Close button to device pills ([ed4812b](https://github.com/victronenergy/venus-influx-loader/commit/ed4812beb8ac39ed18a3a22531059a9a1a5d53b7))
* Clarify measurements/sec on Dashboard ([70962e6](https://github.com/victronenergy/venus-influx-loader/commit/70962e6d1402b9af21891535f8af8d592ad50376))
* Display VRM token name/id in UI ([8b60d91](https://github.com/victronenergy/venus-influx-loader/commit/8b60d91205a1d43a39d316a45a8d7ff78439f0c3))
* Implement basic log filtering ([e0bff62](https://github.com/victronenergy/venus-influx-loader/commit/e0bff62b0a5d7c1d35c5a132be7d50327c03d254))
* Implement correct log filtering for VRM devices ([cbf044b](https://github.com/victronenergy/venus-influx-loader/commit/cbf044b7518eac668e00106bb553dd802aa2e2ab))
* Improve Troubleshooting page experience ([0de2907](https://github.com/victronenergy/venus-influx-loader/commit/0de290743b43ad66e36d3278c9f205a9624f1d00))
* Show badge close button to indicate filter is active ([3298db5](https://github.com/victronenergy/venus-influx-loader/commit/3298db5c723d9dff355ad8506f795f3c86fb94fd))
* Turn AppContent into flex container ([4d98480](https://github.com/victronenergy/venus-influx-loader/commit/4d98480a0e56cf5af17e1a1358e63e8dca02103f))
* Use `idAccessToken` returned via `/me` endpoint to derive VRM token name ([80c6b57](https://github.com/victronenergy/venus-influx-loader/commit/80c6b578147ebb4ae3299a132164b92752701fc2))
* Use `My Installations`, and `Other` in VRM settings ([66e65fa](https://github.com/victronenergy/venus-influx-loader/commit/66e65fa973d1ea8685cce2700937c1dc2dee548f))
* Validate VRM token on refresh, determine token name ([5b04cba](https://github.com/victronenergy/venus-influx-loader/commit/5b04cbaf92b52fa2f51dabcce9b52be116b1beb8))


### Features

* Allow custom per device MQTT subscription ([1b06965](https://github.com/victronenergy/venus-influx-loader/commit/1b0696562d0fb28e40030a30ee6467b3c39f161c))
* **influxdb:** add path and protocol to config input ([#206](https://github.com/victronenergy/venus-influx-loader/issues/206)) ([5508a88](https://github.com/victronenergy/venus-influx-loader/commit/5508a88c7944138c6040edfbbebbb5d40edd0b36))

## [1.3.1](https://github.com/victronenergy/venus-influx-loader/compare/1.3.0...1.3.1) (2024-11-19)


### Bug Fixes

* Add method to get installationName for portalId ([0765ec5](https://github.com/victronenergy/venus-influx-loader/commit/0765ec5b3c2743e0487c969457acb025833619fd))
* Make `npm run watch-influx-loader` work again. ([50e7df4](https://github.com/victronenergy/venus-influx-loader/commit/50e7df4d7bf1e38623d22d5ee01eef7795316bae))
* Make sure VRM API is usable before starting Loader ([fe394ae](https://github.com/victronenergy/venus-influx-loader/commit/fe394aeb5198184a4f5d990db7d263e1ab166b4b))
* Remove deprecated VRM username/password login method ([c040645](https://github.com/victronenergy/venus-influx-loader/commit/c04064596f28058ace4b2d35d8908b8179542247))
* Update lint-staged config ([a6fcdaf](https://github.com/victronenergy/venus-influx-loader/commit/a6fcdaf2709c3dc21ece3daafc56d48a50ebee24))
* Use installationName from VRM for VRM connections ([59476ef](https://github.com/victronenergy/venus-influx-loader/commit/59476ef758b11621957dec2d60618091341e4cd3))

# [1.3.0](https://github.com/victronenergy/venus-influx-loader/compare/1.2.1...1.3.0) (2024-11-12)


### Bug Fixes

* Add types to support VRM manual config ([5d8ee03](https://github.com/victronenergy/venus-influx-loader/commit/5d8ee03c795118a5353b1a2229e19271241a8156))
* Adjust usage of vrm.hasToken ([a964f83](https://github.com/victronenergy/venus-influx-loader/commit/a964f8373de4956aae4759ece7cce1398c811a8e))
* build ESM ([e57f48d](https://github.com/victronenergy/venus-influx-loader/commit/e57f48dbadc38289d1ccc649f0dcc554879e31d3))
* Clean stop on SIGTERM and SIGNINT (closes [#201](https://github.com/victronenergy/venus-influx-loader/issues/201)) ([95eb13c](https://github.com/victronenergy/venus-influx-loader/commit/95eb13c8f72a1272a312aeda77aad1c3e8873f30))
* cleanup bin source code ([fd97815](https://github.com/victronenergy/venus-influx-loader/commit/fd978153306874a3502ae8f0856cca3ceae4197c))
* Cleanup LOADER_CONFIG/UI_CONFIG state handling ([94a22ed](https://github.com/victronenergy/venus-influx-loader/commit/94a22ed81882f3bff6baf2df6a6e1df002aaa332))
* compile ts into cjs ([cc9bfa8](https://github.com/victronenergy/venus-influx-loader/commit/cc9bfa8d958a096974f815e5a420202235b83d41))
* Correct setup of /discovery-api ([1f79718](https://github.com/victronenergy/venus-influx-loader/commit/1f79718ebae6eb7ba45a7fbe37f78c07251bc65c))
* Correctly handle expiry disabled ([f9a2aa7](https://github.com/victronenergy/venus-influx-loader/commit/f9a2aa7326f4c5ce5723eba8e78ceb60d5a5e17a))
* Correctly mix discovered/configured VRM devices expiry ([4d0f730](https://github.com/victronenergy/venus-influx-loader/commit/4d0f730b899787904cfcbd0cc2fd18b258c4cb14))
* Delete manually configured Portal IDs on VRM logout ([a961841](https://github.com/victronenergy/venus-influx-loader/commit/a961841c7e438ba563e38731079829c0b411a92a))
* Do not flatten built hierarchy ([1e44422](https://github.com/victronenergy/venus-influx-loader/commit/1e44422401873dc4216213dd9330c5122be359d8))
* Enable Save button only when dirty, reload config when new version vailable ([442ba7f](https://github.com/victronenergy/venus-influx-loader/commit/442ba7f2706e449122ce877a78b283ed27d21bb6))
* eslint.config.mjs ([1641f75](https://github.com/victronenergy/venus-influx-loader/commit/1641f7544ab2754b05bf7ccdf4880ba1ea31683f))
* Forget expiry on VRM logout ([8601188](https://github.com/victronenergy/venus-influx-loader/commit/8601188b49a941bf9e53dbb50d86423c402b35e0))
* generateBuildInfo.sh should produce .cjs ([d6977ab](https://github.com/victronenergy/venus-influx-loader/commit/d6977ab40c9dccaf4dd5e59f3140bb8f5e49699e))
* Handle VRM disabled in better way ([4246b2b](https://github.com/victronenergy/venus-influx-loader/commit/4246b2be024917035a9dfd469a3518a293d9f2b0))
* Hide device panes when not logged in ([b4b1306](https://github.com/victronenergy/venus-influx-loader/commit/b4b1306013a6f324cf5006a5a65cc3fa5d318b8b))
* Improve wording in the UI ([2816de7](https://github.com/victronenergy/venus-influx-loader/commit/2816de74f2d50ca6d17b06533253b43c3f96d877))
* lint ([1e94002](https://github.com/victronenergy/venus-influx-loader/commit/1e94002ce1998a92004c9b7d618ee1e35b2850f0))
* lint ([87eaff4](https://github.com/victronenergy/venus-influx-loader/commit/87eaff45b41c0b0404f3b7ce14fa89616b7a5ee9))
* lint ([c6f98d5](https://github.com/victronenergy/venus-influx-loader/commit/c6f98d53c241584d6dd96f99eafe278c8783f8de))
* Load VRM portals on start ([ff4eaaf](https://github.com/victronenergy/venus-influx-loader/commit/ff4eaaf36290a110430b2a128764a06eb518ed42))
* Make Editable Device List more generic ([5eea6a4](https://github.com/victronenergy/venus-influx-loader/commit/5eea6a4ee21ed67218e9fd28177f78e69f4b7cbf))
* Make sure VRM logout suceeds with invalid token ([69dbb1e](https://github.com/victronenergy/venus-influx-loader/commit/69dbb1e268bbfb14b6d158ef0e490c3c8f293bad))
* Master enable UPNP, Manual, VRM by default ([12acee5](https://github.com/victronenergy/venus-influx-loader/commit/12acee501d2274f4cc4de5b10e4b21f6ee7c6ef4))
* Pass custom command line args to ./run-dev-image.sh underlying docker run ([49425ec](https://github.com/victronenergy/venus-influx-loader/commit/49425ecf0b59ff4c0adb4c606e0acbdb79bec7b8))
* Prevent NaN (division by zero) on Dashboard ([6a3402d](https://github.com/victronenergy/venus-influx-loader/commit/6a3402d5351429776ec9614f979a56e33efbc962))
* properly handle invalid VRM token ([b5a67e6](https://github.com/victronenergy/venus-influx-loader/commit/b5a67e6f67715e4258e720e0a90eb8f9e91f9b37))
* Refactor WebSocketStatus out to reuse ([ab12a0c](https://github.com/victronenergy/venus-influx-loader/commit/ab12a0c646b23cd3d5446b8359243c3a3147e2bb))
* Remember associated row for expiry option list ([c39163f](https://github.com/victronenergy/venus-influx-loader/commit/c39163fde8fb92d126176c1f1eb3887ef8108c96))
* Remember expiry settings by row index ([fda9122](https://github.com/victronenergy/venus-influx-loader/commit/fda91220e0e8d09a57734ae88184c2b1d0b7c3cd))
* Set retention properly ([277f685](https://github.com/victronenergy/venus-influx-loader/commit/277f6859b218597e5413ce762155b28dcde11df0))
* simplify babel config ([7d33281](https://github.com/victronenergy/venus-influx-loader/commit/7d332814bb209376c427f6e3f1875a95e53ea208))
* Sort devices on Dashboard ([74af188](https://github.com/victronenergy/venus-influx-loader/commit/74af188fe0a0d0b5f657a675497eedc4d39418a3))
* Track expiry settings by row index to avoid conflicts ([b9dc12d](https://github.com/victronenergy/venus-influx-loader/commit/b9dc12dae63459aa08017e30fd62b8125374400e))
* Try to force-reload browser on Grafana link ([cfbc3ed](https://github.com/victronenergy/venus-influx-loader/commit/cfbc3ed66fec58cd4bca33be42178619245d3b97))
* Try to force-reload browser on Grafana link ([b16735f](https://github.com/victronenergy/venus-influx-loader/commit/b16735fb810c301b7a56ce86402f3f4760d6ac9c))
* Unify device discovery across VRM and UPNP ([a123894](https://github.com/victronenergy/venus-influx-loader/commit/a123894ea2703865343146e3b1df6f696374bb4a))
* Update types shared between server/client ([3c9d661](https://github.com/victronenergy/venus-influx-loader/commit/3c9d6610e2eadfea272504e6ab5a422e40341291))
* Use correct hook URL for vrm login ([0e9cac7](https://github.com/victronenergy/venus-influx-loader/commit/0e9cac7f1858727e5c98fc69121145239fd7d18b))
* Use correct path to serve built react app ([e98fb61](https://github.com/victronenergy/venus-influx-loader/commit/e98fb614d91f225b3862f8937a5b96fe402891ee))
* use EditableDeviceList ([80ace98](https://github.com/victronenergy/venus-influx-loader/commit/80ace98a0089d047aaaeeab9771baa337117602d))
* Use VRM email for MQTT login ([4f37f93](https://github.com/victronenergy/venus-influx-loader/commit/4f37f93c6b1ff9d601e13c34d5bf862258692c03))


### Features

* .js -> ignoredMeasurements.ts ([d9dd637](https://github.com/victronenergy/venus-influx-loader/commit/d9dd6374f982a71edb649a4c8a98c5f77e6e4605))
* .js -> influxdb.ts ([1de4cac](https://github.com/victronenergy/venus-influx-loader/commit/1de4cac08a3c643c1e9f13e1b0dedb814f8164a0))
* .js -> loader.ts, cleanup loader logic ([97dd460](https://github.com/victronenergy/venus-influx-loader/commit/97dd460f562f12bc983d0a3e275cdcbb4a0b881d))
* .js -> logger.ts ([0aa0750](https://github.com/victronenergy/venus-influx-loader/commit/0aa075015eb72184a1cddf521b9ceb48639f8a98))
* .js -> upnp.ts ([bb95d4e](https://github.com/victronenergy/venus-influx-loader/commit/bb95d4e23a65a9bdbcf170e349aa760208ae4989))
* .js -> vrm.ts, cleanup vrm logic ([c400e73](https://github.com/victronenergy/venus-influx-loader/commit/c400e73dae5b8bfc313d36e13bb7f1c42ceab112))
* .js -> websocket.ts ([429d077](https://github.com/victronenergy/venus-influx-loader/commit/429d077288fe6ee29ee2cfba11bc17cc1f7cb0e7))
* add --disable-admin-api-auth command line option ([aa8adf4](https://github.com/victronenergy/venus-influx-loader/commit/aa8adf4f09353cd253b2e7323f6af991fcff0a81))
* Add --grafana-url option, closes [#186](https://github.com/victronenergy/venus-influx-loader/issues/186) ([0b07bc3](https://github.com/victronenergy/venus-influx-loader/commit/0b07bc34f756d3f8e366f359e396d3560a61dc0e))
* add --hide-settings-* options to tweak UI ([a75990c](https://github.com/victronenergy/venus-influx-loader/commit/a75990cedfe008bd70c1a0892573f16e3ec17c0f))
* Add ability to configure manual VRM portals ([be391d8](https://github.com/victronenergy/venus-influx-loader/commit/be391d8dfef4c079260fee0a78468e35e4a2ab6c))
* Admin UI VRM Login by Token ([85a8da5](https://github.com/victronenergy/venus-influx-loader/commit/85a8da53da10488d92938632cc54273f48f6b8f3))
* Allow client side config of expiry ([a5b19a0](https://github.com/victronenergy/venus-influx-loader/commit/a5b19a0dee768e475fb94e6513fc8e8116895376))
* Annotate custom hooks with TS types ([5c1b2f0](https://github.com/victronenergy/venus-influx-loader/commit/5c1b2f07c3628eb052aa10b325cde1c76c1f19e1))
* Annotate redux store with TS types ([f1bc4fd](https://github.com/victronenergy/venus-influx-loader/commit/f1bc4fd197da7909ecea60e81b11d0f42d81e0cb))
* Connect to manually configured VRM portals ([e5acd91](https://github.com/victronenergy/venus-influx-loader/commit/e5acd91b60fffe16ecf5f96906b10a185f640df4))
* display app version in the UI ([f48fd3f](https://github.com/victronenergy/venus-influx-loader/commit/f48fd3f967d170271b896839429ed4274426bd1e))
* Display connection type + unconnected devices on the dashboard ([ff905ba](https://github.com/victronenergy/venus-influx-loader/commit/ff905baafefd761f5a6c58fabe6fbc76e674b5bb))
* Display expiry selection when --enable-auto-expiry used ([e811873](https://github.com/victronenergy/venus-influx-loader/commit/e8118736c87b54236b8e03342b81278c2bf43e14))
* Extract shared types, api, app state ([e36ecc7](https://github.com/victronenergy/venus-influx-loader/commit/e36ecc700d305707714bc98a4b2ca4caabb1f617))
* Implement Loader data collection expiry ([2ff39fe](https://github.com/victronenergy/venus-influx-loader/commit/2ff39febd3cbc8b804bede536a4a250983573fab))
* Implement VRM Token login ([9149b64](https://github.com/victronenergy/venus-influx-loader/commit/9149b645c57b0b5ba9d96f6e6cdc961b512baced))
* Introduce Typescript ([#187](https://github.com/victronenergy/venus-influx-loader/issues/187)) ([44ce7ec](https://github.com/victronenergy/venus-influx-loader/commit/44ce7ec5b0e82d48a4060250340202c17ffd1b8b))
* Move Dashboard to TS ([ecb299c](https://github.com/victronenergy/venus-influx-loader/commit/ecb299c1cc52385c2613de205ec7d7508b98a310))
* Move DeviceList to TS ([13b1507](https://github.com/victronenergy/venus-influx-loader/commit/13b1507552022d1a82db23c7eaf576004c170222))
* Move Discovery to TS ([b5f9f0e](https://github.com/victronenergy/venus-influx-loader/commit/b5f9f0efe22dabca304727e840cb91b3265a2dee))
* Move EditableDeviceList to TS ([99ae759](https://github.com/victronenergy/venus-influx-loader/commit/99ae75965135bb0f73c02a22921f4cde11f0c02a))
* move express API to .ts, cleanup ([6de8ede](https://github.com/victronenergy/venus-influx-loader/commit/6de8ede376125ed72f0ee357606c2f31e50ffc5d))
* Move InfluxDB to TS ([1ec3aa2](https://github.com/victronenergy/venus-influx-loader/commit/1ec3aa25d00f3532f28ddf1573afba21e7ea2827))
* Move Manual to TS ([a8dcb02](https://github.com/victronenergy/venus-influx-loader/commit/a8dcb026c29adba60abae8b00e8ead6c4b1c55a2))
* Move React App skeleton to TS ([41a9b8b](https://github.com/victronenergy/venus-influx-loader/commit/41a9b8bbd035a40ca936c45f3706fd4e1d6c67c1))
* Move Security to TS ([7778e87](https://github.com/victronenergy/venus-influx-loader/commit/7778e8734861d7efa3bc2db6e93bb3b242686f97))
* Move Troubleshooting to TS ([8e512c7](https://github.com/victronenergy/venus-influx-loader/commit/8e512c7d6b69aafb565158f60b0ccc729c759379))
* Move VRM to TS ([77ef247](https://github.com/victronenergy/venus-influx-loader/commit/77ef2475c7b6bf7eeec54f3e2abcbebc3e2913f1))
* Parse '--enable-auto-expiry [duration]' and pass to UI ([822cc1f](https://github.com/victronenergy/venus-influx-loader/commit/822cc1fe6c2c1759a204acf0c39849e6ad3fddbd))
* send reasonable initial statistics ([bcf4929](https://github.com/victronenergy/venus-influx-loader/commit/bcf492901975f960d3823aec8d422d86e8dccfd2))
* Show warning when not connected to Influx Loader ([80e3301](https://github.com/victronenergy/venus-influx-loader/commit/80e3301cdeb905df78c21ec3215ec1bdf4683b42))
* Specify types to store expiry config ([9bfb9d5](https://github.com/victronenergy/venus-influx-loader/commit/9bfb9d5fc9a1e7c2eaea9fa609f5007d57959a07))

## [1.2.1](https://github.com/victronenergy/venus-influx-loader/compare/1.2.0...1.2.1) (2024-09-30)


### Bug Fixes

* Make production build actually work ([1f3eed3](https://github.com/victronenergy/venus-influx-loader/commit/1f3eed354b7d91b89858091973b9e5dc6d9c85bc))

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
