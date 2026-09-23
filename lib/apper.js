const http = require('http');
const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const rc = require('rc');
const Logger = require('./logger');
const Context = require('./context');
const AuthManager = require('./auth');
const googleHelper = require('./google');

class Apper {
  #name;
  #logger;
  #config;
  #express;
  #context;
  #auth;
  #startHooks = [];
  #stopHooks = [];
  #server = null;
  #adminServer = null;
  #adminPort = null;
  #isStopping = false;
  #signalsAttached = false;

  static google = googleHelper.google;
  static getGoogleAuth = googleHelper.getGoogleAuth;
  static initGoogleAuth = googleHelper.initGoogleAuth;
  static getGoogleService = googleHelper.getGoogleService;

  static resolvePath(rawPath) {
    if (!rawPath || typeof rawPath !== 'string') {
      return null;
    }
    let resolved = rawPath.trim();
    if (resolved === '~') {
      resolved = os.homedir();
    } else if (resolved.startsWith('~/') || resolved.startsWith('~\\')) {
      resolved = path.join(os.homedir(), resolved.slice(2));
    }
    return path.resolve(resolved);
  }

  constructor(name, init = () => {}, defaultConfig = {
    port: 8080,
    adminPort: null,
    staticPaths: null,
  }) {
    this.#name = name;
    this.#config = rc(name, defaultConfig);
    const rawAdminPort = this.#config.adminPort !== undefined ?
      this.#config.adminPort :
      (this.#config.admin_port !== undefined ?
        this.#config.admin_port :
        this.#config['admin-port']);
    this.#adminPort = (rawAdminPort !== undefined &&
      rawAdminPort !== null &&
      rawAdminPort !== '') ?
      Number(rawAdminPort) : null;
    const logDir = this.#config.logDir || this.#config.logdir;
    this.#logger = new Logger(name, {
      logDir,
      isTTY: this.#config.isTTY,
      useConsole: this.#config.useConsole,
      useFile: this.#config.useFile,
      transport: this.#config.logTransport || this.#config.transport,
    });
    this.#express = express();
    this.#express.use((req, res, next) => {
      if (typeof req.isAdmin === 'undefined') {
        req.isAdmin = false;
      }
      next();
    });

    const trustProxy = this.#config.trustProxy !== undefined ?
      this.#config.trustProxy :
      true;
    if (trustProxy) {
      this.#express.set('trust proxy', trustProxy);
    }

    const authConfig = this.#config.auth;
    const isAuthEnabled = Boolean(authConfig && authConfig.enabled !== false);
    this.#auth = new AuthManager(this.#name, this.#config, this.#logger);

    this.#express.use(express.json());

    let uikitDist;
    try {
      uikitDist = path.resolve(
          path.dirname(require.resolve('uikit/package.json')), 'dist');
    } catch (e) {
      uikitDist = path.resolve(`${__dirname}/../../../uikit/dist`);
    }
    this.#express.use(express.static(uikitDist));

    let eDist;
    try {
      eDist = path.resolve(
          path.dirname(require.resolve('@sarosia/e/package.json')), 'src');
    } catch (e) {
      eDist = path.resolve(`${__dirname}/../../../e/src`);
    }
    if (fs.existsSync(eDist)) {
      this.#express.use(express.static(eDist));
    }

    const apperStaticDir = path.resolve(__dirname, '../static');
    this.#express.use(express.static(apperStaticDir));

    if (this.#config.publicStaticPaths) {
      for (const publicPath of this.#config.publicStaticPaths) {
        this.#express.use(express.static(publicPath));
      }
    }

    if (isAuthEnabled) {
      this.#express.use((req, res, next) => {
        req.cookies = this.#auth.parseCookies(req);
        next();
      });

      this.#mountAuthRoutes(apperStaticDir);
      this.#express.use(this.#auth.getMiddleware());
    }

    if (this.#config.staticPaths) {
      for (const staticPath of this.#config.staticPaths) {
        this.#express.use(express.static(staticPath));
      }
    }

    this.#context = new Context(this.#logger, this.#config, this.#auth);
    init(this.#context);
  }

  #mountAuthRoutes(apperStaticDir) {
    this.#express.get('/login', (req, res) => {
      if (!this.#auth.isEnabled() || req.isAdmin) {
        return res.redirect('/');
      }
      const user = this.#auth.getSessionUser(req);
      if (user) {
        return res.redirect('/');
      }
      if (this.#config.auth && this.#config.auth.loginPage) {
        return res.sendFile(path.resolve(this.#config.auth.loginPage));
      }
      return res.sendFile(path.join(apperStaticDir, 'login.html'));
    });

    this.#express.get('/auth/login', (req, res) => {
      if (!this.#auth.isEnabled()) {
        return res.redirect('/');
      }
      if (this.#auth.hasGoogleCredentials()) {
        const callbackUrl = this.#auth.getCallbackUrl(req);
        const authUrl = this.#auth.getAuthUrl('', callbackUrl);
        return res.redirect(authUrl);
      }
      return res.redirect(
          '/login?error=auth_failed&msg=' +
          encodeURIComponent(
              'Google OAuth Client ID & Secret are not configured yet.',
          ),
      );
    });

    this.#express.get('/auth/callback', async (req, res) => {
      const code = req.query.code;
      if (!code) {
        return res.redirect('/login?error=missing_code');
      }
      try {
        const callbackUrl = this.#auth.getCallbackUrl(req);
        const user = await this.#auth.handleCallback(code, callbackUrl);
        const host = req.headers['x-forwarded-host'] || req.get('host') || '';
        const isLocal =
            host.startsWith('localhost') || host.startsWith('127.0.0.1');
        const isSecure = req.secure ||
            req.headers['x-forwarded-proto'] === 'https' ||
            (!isLocal && req.headers['x-forwarded-proto'] !== 'http');
        this.#auth.setSessionCookie(res, user, isSecure);
        return res.redirect('/');
      } catch (err) {
        if (err.code === 'UNAUTHORIZED_EMAIL') {
          return res.redirect('/login?error=unauthorized');
        }
        return res.redirect(
            `/login?error=auth_failed&msg=${encodeURIComponent(err.message)}`,
        );
      }
    });

    this.#express.get('/auth/logout', (req, res) => {
      this.#auth.clearSessionCookie(res);
      res.redirect('/login');
    });

    this.#express.get('/auth/me', (req, res) => {
      if (!this.#auth.isEnabled()) {
        return res.json({authenticated: false, user: null});
      }
      const user = this.#auth.getSessionUser(req);
      if (!user) {
        if (req.isAdmin) {
          return res.json({authenticated: false, user: null, isAdmin: true});
        }
        return res.status(401).json({authenticated: false, user: null});
      }
      res.json({authenticated: true, user, isAdmin: Boolean(req.isAdmin)});
    });

    this.#express.get('/auth/config', (req, res) => {
      res.json({
        enabled: req.isAdmin ? false : this.#auth.isEnabled(),
        appName: this.#auth.getAppName(),
        hasGoogleAuth: this.#auth.hasGoogleCredentials(),
        isAdmin: Boolean(req.isAdmin),
      });
    });
  }

  getExpress() {
    return this.#express;
  }

  getAuth() {
    return this.#auth;
  }

  getContext() {
    return this.#context;
  }

  getLogger() {
    return this.#logger;
  }

  onStart(hook) {
    if (typeof hook === 'function') {
      this.#startHooks.push(hook);
    }
    return this;
  }

  onStop(hook) {
    if (typeof hook === 'function') {
      this.#stopHooks.push(hook);
    }
    return this;
  }

  getServer() {
    return this.#server;
  }

  getAdminServer() {
    return this.#adminServer;
  }

  getAdminPort() {
    if (this.#adminServer && this.#adminServer.address()) {
      return this.#adminServer.address().port;
    }
    return this.#adminPort;
  }

  async stop(signal = 'MANUAL') {
    if (this.#isStopping) {
      return;
    }
    this.#isStopping = true;
    this.#logger.info(`Stopping app ${this.#name}... (signal: ${signal})`);

    for (const hook of this.#stopHooks) {
      try {
        await hook(this.#context, signal);
      } catch (err) {
        this.#logger.error(`Error in onStop hook: ${err.message}`, err);
      }
    }

    if (this.#adminServer && typeof this.#adminServer.close === 'function') {
      await new Promise((resolve) => this.#adminServer.close(resolve));
      this.#adminServer = null;
    }

    if (this.#server && typeof this.#server.close === 'function') {
      await new Promise((resolve) => this.#server.close(resolve));
      this.#server = null;
    }

    this.#logger.info(`App ${this.#name} stopped.`);
  }

  async start() {
    const server = this.#express.listen(this.#config.port);
    this.#server = server;
    if (server && typeof server.once === 'function' && !server.listening) {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', resolve);
      });
    }
    const actualPort = server && server.address && server.address() ?
      server.address().port : this.#config.port;
    this.#logger.info(`App ${this.#name} started on ${actualPort}.`);

    if (this.#adminPort !== null && !isNaN(this.#adminPort)) {
      const adminServer = http.createServer((req, res) => {
        req.isAdmin = true;
        this.#express(req, res);
      });
      if (typeof adminServer.once === 'function') {
        await new Promise((resolve, reject) => {
          adminServer.once('error', reject);
          adminServer.once('listening', resolve);
          adminServer.listen(this.#adminPort);
        });
      } else {
        adminServer.listen(this.#adminPort);
      }
      this.#adminServer = adminServer;
      const actualAdminPort = adminServer.address && adminServer.address() ?
        adminServer.address().port : this.#adminPort;
      this.#auth.setAdminPort(actualAdminPort);
      this.#logger.info(
          `App ${this.#name} admin interface started on ${actualAdminPort}.`,
      );
    }

    if (this.#config.handleSignals !== false && !this.#signalsAttached) {
      this.#signalsAttached = true;
      const handleSignal = async (sig) => {
        this.#logger.info(`Received ${sig}, shutting down gracefully...`);
        try {
          await this.stop(sig);
          process.exit(0);
        } catch (err) {
          this.#logger.error(`Error during shutdown: ${err.message}`, err);
          process.exit(1);
        }
      };
      process.once('SIGINT', () => handleSignal('SIGINT'));
      process.once('SIGTERM', () => handleSignal('SIGTERM'));
    }

    for (const hook of this.#startHooks) {
      await hook(this.#context);
    }
    return server;
  }

  use(...args) {
    return this.#express.use(...args);
  }

  #runWithContext(func) {
    const context = this.#context;
    return (req, res, next) => {
      const tag = req.isAdmin ? ' (admin)' : '';
      context.logger.info(
          `Received request${tag}: ${req.method} ${req.path}.`,
      );
      func(context, req, res, next);
    };
  }

  get(route, func) {
    return this.#express.get(route, this.#runWithContext(func));
  }

  post(route, func) {
    return this.#express.post(route, this.#runWithContext(func));
  }

  put(route, func) {
    return this.#express.put(route, this.#runWithContext(func));
  }

  delete(route, func) {
    return this.#express.delete(route, this.#runWithContext(func));
  }

  patch(route, func) {
    return this.#express.patch(route, this.#runWithContext(func));
  }
}

module.exports = Apper;
