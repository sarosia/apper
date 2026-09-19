const googleHelper = require('./google');

class Context {
  logger;
  config;
  auth;
  google;
  getGoogleAuth;
  initGoogleAuth;
  getGoogleService;

  constructor(logger, config, auth = null) {
    this.logger = logger;
    this.config = config;
    this.auth = auth;
    this.google = googleHelper.google;
    this.getGoogleAuth = googleHelper.getGoogleAuth;
    this.initGoogleAuth = googleHelper.initGoogleAuth;
    this.getGoogleService = googleHelper.getGoogleService;
  }
}

module.exports = Context;
