const path = require('path');
const os = require('os');
const fs = require('fs');
const {createLogger, format, transports} = require('winston');
require('winston-daily-rotate-file');

class Logger {
  #logger;
  #logDir;

  constructor(name, options = {}) {
    if (typeof options === 'string') {
      options = {logDir: options};
    }
    const rawLogDir = options.logDir || options.dirname || options.logdir ||
      process.env.LOG_DIR;
    const rotateOpts = {
      filename: `${name}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxFiles: '7d',
      format: format.json(),
    };

    if (rawLogDir) {
      const resolvedDir = Logger.resolveLogDir(rawLogDir);
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, {recursive: true});
      }
      rotateOpts.dirname = resolvedDir;
      this.#logDir = resolvedDir;
    } else {
      this.#logDir = process.cwd();
    }

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
        new transports.DailyRotateFile(rotateOpts),
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

  static resolveLogDir(rawLogDir) {
    if (!rawLogDir) {
      return null;
    }
    let resolvedDir = rawLogDir;
    if (resolvedDir === '~') {
      resolvedDir = os.homedir();
    } else if (resolvedDir.startsWith('~/') ||
               resolvedDir.startsWith('~\\')) {
      resolvedDir = path.join(os.homedir(), resolvedDir.slice(2));
    }
    return path.resolve(resolvedDir);
  }

  get logDir() {
    return this.#logDir;
  }

  get transports() {
    return this.#logger.transports;
  }

  close() {
    return this.#logger.close();
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
