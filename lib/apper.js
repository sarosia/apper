const express = require('express');
const path = require('path');
const rc = require('rc');
const Logger = require('./logger');
const Context = require('./context');
const AuthManager = require('./auth');

class Apper {
  #name;
  #logger;
  #config;
  #express;
  #context;
  #auth;

  constructor(name, init = () => {}, defaultConfig = {
    port: 8080,
    staticPaths: null,
  }) {
    this.#name = name;
    this.#logger = new Logger(name);
    this.#config = rc(name, defaultConfig);
    this.#express = express();

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

      const apperStaticDir = path.resolve(__dirname, '../static');
      this.#express.use(express.static(apperStaticDir));

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
        const authUrl = this.#auth.getAuthUrl();
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
        const user = await this.#auth.handleCallback(code);
        const isSecure = req.secure ||
            req.headers['x-forwarded-proto'] === 'https';
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
      const user = this.#auth.getSessionUser(req);
      if (!user) {
        return res.status(401).json({authenticated: false, user: null});
      }
      res.json({authenticated: true, user});
    });

    this.#express.get('/auth/config', (req, res) => {
      res.json({
        enabled: this.#auth.isEnabled(),
        appName: this.#auth.getAppName(),
        hasGoogleAuth: this.#auth.hasGoogleCredentials(),
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

  start() {
    this.#express.listen(this.#config.port);
    this.#logger.info(`App ${this.#name} started on ${this.#config.port}.`);
  }

  use(...args) {
    return this.#express.use(...args);
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
