const Apper = require('./lib/apper.js');
Apper.Apper = Apper;
Apper.AuthManager = require('./lib/auth.js');
Apper.Context = require('./lib/context.js');
Apper.Logger = require('./lib/logger.js');
Apper.NotableStore = require('./lib/store.js');
Apper.Store = Apper.NotableStore;

module.exports = Apper;
