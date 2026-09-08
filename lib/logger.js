const {createLogger, format, transports} = require('winston');
require('winston-daily-rotate-file');

class Logger {
  #logger;

  constructor(name) {
    this.#logger = createLogger({
      level: 'info',
      format: format.combine(
          format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          format.errors({stack: true}),
          format.splat(),
      ),
      defaultMeta: {service: name},
      transports: [
        new transports.DailyRotateFile({
          filename: `${name}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: false,
          maxFiles: '7d',
          format: format.json(),
        }),
      ],
    });
    if (process.env.NODE_ENV != 'production') {
      this.#logger.add(new transports.Console({
        format: format.combine(
            format.colorize(),
            format.printf(
                ({timestamp, level, message, service, stack, ...meta}) => {
                  const extra = Object.keys(meta).length ?
                    ' ' + JSON.stringify(meta) :
                    '';
                  return `[${timestamp}] ${level}: ${stack || message}${extra}`;
                },
            ),
        ),
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
