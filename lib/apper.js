const express = require('express');
const path = require('path');
const rc = require('rc');
const Logger = require('./logger');
const Context = require('./context');

class Apper {
  #logger;
  #config;
  #express;

  constructor(name, defaultConfig = {port: 8080}) {
    this.#logger = new Logger(name);
    this.#config = rc(name, defaultConfig);
    this.#express = express();
    this.#express.use(express.json());
    this.#express.use(express.static(
        path.resolve(`${__dirname}/../node_modules/uikit/dist`)));
  }

  getExpress() {
    return this.#express;
  }

  start() {
    this.#express.listen(this.#config.port);
  }

  #runWithContext(func) {
    const context = new Context(this.#logger, this.#config);
    return (...args) => {
      func(context, ...args);
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
