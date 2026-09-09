class Context {
  logger;
  config;
  auth;
  #startHookRegistrar;

  constructor(logger, config, auth = null, startHookRegistrar = null) {
    this.logger = logger;
    this.config = config;
    this.auth = auth;
    this.#startHookRegistrar = startHookRegistrar;
  }

  onStart(hook) {
    if (this.#startHookRegistrar && typeof hook === 'function') {
      this.#startHookRegistrar(hook);
    }
  }
}

module.exports = Context;
