const Client = require("node-ssdp").Client;
const axios = require("axios");
const parseXml = require("xml2js").parseString;

module.exports = function (app) {
  const logger = app.getLogger("upnp");
  const client = new Client();
  let isRunning = false;

  return {
    logger: logger,

    stop: () => {
      logger.info("Stopping UPNP Discovery");
      isRunning = false;
      client.stop();
      app.emit("upnpDiscoveryDidStop", {});
    },

    isRunning: () => {
      return isRunning;
    },

    start: () => {
      client.on("response", function (headers, statusCode, rinfo) {
        if (
          headers.USN &&
          headers.USN.startsWith("uuid:com.victronenergy.ccgx")
        ) {
          axios
            .get(headers.LOCATION)
            .then((response) => response.data)
            .then((text) => {
              parseXml(text, (err, result) => {
                if (err) {
                  logger.error(err);
                } else {
                  try {
                    const info = {
                      portalId: result.root.device[0]["ve:X_VrmPortalId"][0]._,
                      address: rinfo.address,
                    };
                    logger.info(
                      `Found a venus device with id ${info.portalId} at ${info.address}`,
                    );
                    app.emit("upnpDiscovered", info);
                  } catch (err) {
                    logger.error(err);
                  }
                }
              });
            })
            .catch((err) => {
              logger.error(err);
            });
        }
      });

      logger.info("Running UPNP Discovery...");
      isRunning = true;
      app.emit("upnpDiscoveryDidStart", {});
      client.search("urn:schemas-upnp-org:device:Basic:1");
    },
  };
};
