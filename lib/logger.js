const {createLogger, format, transports} = require('winston');
const {LoggingWinston} = require('@google-cloud/logging-winston');

class Logger {
  #logger

  constructor(name) {
    this.#logger = createLogger({
      level: 'info',
      format: format.combine(
          format.timestamp({
            'format': 'YYYY-MM-DD HH:mm:ss',
          }),
          format.errors({'stack': true}),
          format.splat(),
          format.json(),
      ),
      defaultMeta: {service: name},
      transports: [
        new LoggingWinston(),
      ],
    });
    if (process.env.NODE_ENV != 'production') {
      this.#logger.add(new transports.Console({
        format: format.simple(),
      }));
    }
  }

  debug(...args) {
    return this.#logger.debug(...args);
  }
  info(...args) {
    return this.#logger.info(...args);
  }
  warn(...args) {
    return this.#logger.warn(...args);
  }
  error(...args) {
    return this.#logger.error(...args);
  }
}

module.exports = Logger;
