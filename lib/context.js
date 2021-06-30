class Context {
  logger;
  config;

  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }
}

module.exports = Context;
