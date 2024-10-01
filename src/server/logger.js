const winston = require("winston");
const Transport = require("winston-transport");

// custom log storage transport
// that keeps last 100 messages
// and emits them live over ws /stream connection
// from venus-influx-loader to react.js client
class LogStorageTransport extends Transport {
  constructor(app, opts) {
    super(opts);
    this.entries = [];
    this.app = app;
    this.size = opts.size || 100;
  }

  log(info, callback) {
    this.entries.push(info);

    if (this.entries.length > this.size) {
      this.entries.splice(0, this.entries.length - this.size);
    }

    this.app.emit("serverevent", {
      type: "LOG",
      data: info,
    });

    callback();
  }
}

// setup root logger with given label and log level
// and provide couple useful helpers like
//
// app.info
// app.debug
// app.getLogger
//
module.exports = function (app, label, level) {
  const format = winston.format.printf((info, _opts) => {
    return `[${info.level}] [${info.label}] ${info.message} ${info.stack || ""}`;
  });

  app.logTransport = new LogStorageTransport(app, {
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.timestamp(),
      winston.format.json(),
    ),
    handleExceptions: true,
  });

  app.rootLogger = winston.createLogger({
    level: level,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.errors({ stack: true }),
          winston.format.splat(),
          format,
        ),
        handleExceptions: true,
      }),
      app.logTransport,
    ],
  });
  app.rootLogger.exitOnError = false;

  app.logger = app.rootLogger.child({ label: label });
  app.getLogger = (label) => {
    return app.rootLogger.child({ label: label });
  };
  app.debug = app.logger.debug.bind(app.logger);
  app.info = app.logger.info.bind(app.logger);

  return app.rootLogger;
};
