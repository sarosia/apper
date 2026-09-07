class Context {
  logger;
  config;
  auth;

  constructor(logger, config, auth = null) {
    this.logger = logger;
    this.config = config;
    this.auth = auth;
  }
}

module.exports = Context;
