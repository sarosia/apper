const express = require('express');
const path = require('path');
const rc = require('rc');
const Logger = require('./logger');
const Context = require('./context');

class Apper {
  #name;
  #logger;
  #config;
  #express;
  #context;

  constructor(name, init = () => {}, defaultConfig = {
    port: 8080,
    staticPaths: null,
  }) {
    this.#name = name;
    this.#logger = new Logger(name);
    this.#config = rc(name, defaultConfig);
    this.#express = express();
    this.#express.use(express.json());
    if (this.#config.staticPaths) {
      for (const staticPath of this.#config.staticPaths) {
        this.#express.use(express.static(staticPath));
      }
    }
    this.#express.use(express.static(
        path.resolve(`${__dirname}/../../../uikit/dist`)));
    this.#context = new Context(this.#logger, this.#config);
    init(this.#context);
  }

  getExpress() {
    return this.#express;
  }

  start() {
    this.#express.listen(this.#config.port);
    this.#logger.info(`App ${this.#name} started on ${this.#config.port}.`);
  }

  #runWithContext(func) {
    const context = this.#context;
    return (req, res, next) => {
      context.logger.info(`Received request: ${req.method} ${req.path}.`);
      func(context, req, res, next);
    };
  }

  get(route, func) {
    return this.#express.get(route, this.#runWithContext(func));
  }

  post(route, func) {
    return this.#express.post(route, this.#runWithContext(func));
  }
}

module.exports = Apper;
