const Apper = require('./lib/apper.js');
Apper.Apper = Apper;
Apper.AuthManager = require('./lib/auth.js');
Apper.Context = require('./lib/context.js');
Apper.Logger = require('./lib/logger.js');
Apper.NotableStore = require('./lib/store.js');
Apper.Store = Apper.NotableStore;
Apper.lint = require('./lib/lint.js');
Apper.test = require('./lib/test-helpers.js');
Apper.testRunner = require('./lib/test.js');
Apper.express = require('express');

module.exports = Apper;
