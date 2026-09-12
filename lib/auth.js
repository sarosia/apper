const crypto = require('crypto');
const {google} = require('googleapis');

function parseDurationMs(val, defaultMs = 7 * 24 * 60 * 60 * 1000) {
  if (typeof val === 'number') return val;
  if (!val || typeof val !== 'string') return defaultMs;
  const match = val.trim().match(/^(\d+)\s*([smhdw])$/i);
  if (!match) return defaultMs;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 60 * 60 * 1000;
    case 'd':
      return num * 24 * 60 * 60 * 1000;
    case 'w':
      return num * 7 * 24 * 60 * 60 * 1000;
    default:
      return defaultMs;
  }
}

class AuthManager {
  #appName;
  #enabled;
  #clientId;
  #clientSecret;
  #configuredCallbackUrl;
  #callbackUrl;
  #sessionSecret;
  #sessionMaxAgeMs;
  #allowedEmails;
  #publicRoutes;
  #cookieName;
  #logger;

  constructor(appName = 'apper', config = {}, logger = console) {
    if (typeof appName === 'object' && appName !== null) {
      logger = config || console;
      config = appName;
      appName = config.appName || config.name || 'apper';
    }
    const authConfig = config.auth || {};
    this.#appName = config.appName || appName;
    this.#logger = logger;
    this.#clientId = process.env.GOOGLE_CLIENT_ID || authConfig.clientId || '';
    this.#clientSecret =
      process.env.GOOGLE_CLIENT_SECRET || authConfig.clientSecret || '';
    this.#enabled = authConfig.enabled !== false && this.hasGoogleCredentials();

    if (authConfig.enabled !== false && !this.hasGoogleCredentials()) {
      this.#logger.info(
          'OAuth credentials not found; authentication will not be required.',
      );
    }
    this.#configuredCallbackUrl =
      process.env.GOOGLE_CALLBACK_URL || authConfig.callbackUrl || null;
    this.#callbackUrl =
      this.#configuredCallbackUrl ||
      `http://localhost:${config.port || 8080}/auth/callback`;
    this.#sessionSecret =
      process.env.SESSION_SECRET ||
      authConfig.sessionSecret ||
      `${appName}-session-secret-change-in-production`;
    this.#sessionMaxAgeMs = parseDurationMs(authConfig.sessionMaxAge || '7d');
    this.#allowedEmails = (authConfig.allowedEmails || [])
        .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter(Boolean);
    const rawPublicRoutes =
        authConfig.publicRoutes || config.publicRoutes || [];
    this.#publicRoutes =
        (Array.isArray(rawPublicRoutes) ? rawPublicRoutes : [rawPublicRoutes])
            .map((r) => (typeof r === 'string' ? r.trim() : ''))
            .filter(Boolean);
    const sanitizedName = appName.replace(/[^a-zA-Z0-9_]/g, '_');
    this.#cookieName = authConfig.cookieName || `${sanitizedName}_session`;
  }

  getAppName() {
    return this.#appName;
  }

  isEnabled() {
    return this.#enabled;
  }

  getPublicRoutes() {
    return [...this.#publicRoutes];
  }

  hasGoogleCredentials() {
    return Boolean(this.#clientId && this.#clientSecret);
  }

  getAllowedEmails() {
    return [...this.#allowedEmails];
  }

  getCookieName() {
    return this.#cookieName;
  }

  isAllowed(email) {
    if (!email || typeof email !== 'string') return false;
    if (this.#allowedEmails.length === 0) return true;
    return this.#allowedEmails.includes(email.trim().toLowerCase());
  }

  getCallbackUrl(req = null) {
    if (this.#configuredCallbackUrl) {
      return this.#configuredCallbackUrl;
    }
    if (req) {
      const proto =
        req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      if (host) {
        return `${proto}://${host}/auth/callback`;
      }
    }
    return this.#callbackUrl;
  }

  getGoogleOAuthClient(callbackUrl = null) {
    if (!this.hasGoogleCredentials()) {
      throw new Error('Google OAuth Client ID and Secret are not configured.');
    }
    return new google.auth.OAuth2(
        this.#clientId,
        this.#clientSecret,
        callbackUrl || this.#callbackUrl,
    );
  }

  getAuthUrl(state = '', callbackUrl = null) {
    const oauth2Client = this.getGoogleOAuthClient(callbackUrl);
    return oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid',
      ],
      state,
      prompt: 'select_account',
    });
  }

  async handleCallback(code, callbackUrl = null) {
    const oauth2Client = this.getGoogleOAuthClient(callbackUrl);
    const {tokens} = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let user = null;

    if (tokens.id_token) {
      try {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: this.#clientId,
        });
        const payload = ticket.getPayload();
        user = {
          email: payload.email,
          name: payload.name || payload.email,
          picture: payload.picture || '',
        };
      } catch (err) {
        this.#logger.warn(
            `ID token verification failed, using userinfo: ${err.message}`,
        );
      }
    }

    if (!user) {
      const oauth2 = google.oauth2({version: 'v2', auth: oauth2Client});
      const res = await oauth2.userinfo.get();
      user = {
        email: res.data.email,
        name: res.data.name || res.data.email,
        picture: res.data.picture || '',
      };
    }

    if (!user.email || !this.isAllowed(user.email)) {
      const err = new Error(
          `Email "${user.email}" is not authorized to access this service.`,
      );
      err.code = 'UNAUTHORIZED_EMAIL';
      err.email = user.email;
      throw err;
    }

    return user;
  }

  createSessionToken(user) {
    if (!user || !user.email) {
      throw new Error('Cannot create session token without user email');
    }
    const exp = Date.now() + this.#sessionMaxAgeMs;
    const payload = {
      email: user.email.trim().toLowerCase(),
      name: user.name || user.email,
      picture: user.picture || '',
      exp,
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
    );
    const signature = crypto
        .createHmac('sha256', this.#sessionSecret)
        .update(payloadBase64)
        .digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  verifySessionToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSig = crypto
        .createHmac('sha256', this.#sessionSecret)
        .update(payloadBase64)
        .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      return null;
    }

    try {
      const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload = JSON.parse(jsonStr);

      if (!payload.exp || typeof payload.exp !== 'number') return null;
      if (Date.now() > payload.exp) return null;
      if (!this.isAllowed(payload.email)) return null;

      return payload;
    } catch (err) {
      return null;
    }
  }

  parseCookies(req) {
    const list = {};
    const cookieHeader = req && req.headers ? req.headers.cookie : '';
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts.shift().trim();
      if (name) {
        list[name] = decodeURIComponent(parts.join('='));
      }
    });

    return list;
  }

  getSessionUser(req) {
    const cookies = this.parseCookies(req);
    const token = cookies[this.#cookieName];
    if (!token) return null;
    return this.verifySessionToken(token);
  }

  setSessionCookie(res, user, secure = false) {
    const token = this.createSessionToken(user);
    const maxAgeSec = Math.floor(this.#sessionMaxAgeMs / 1000);
    const cookieParts = [
      `${this.#cookieName}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAgeSec}`,
    ];
    if (secure) {
      cookieParts.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieParts.join('; '));
    return token;
  }

  clearSessionCookie(res) {
    const cookieParts = [
      `${this.#cookieName}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=0',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ];
    res.setHeader('Set-Cookie', cookieParts.join('; '));
  }

  getMiddleware() {
    return (req, res, next) => {
      if (!this.#enabled) {
        return next();
      }

      if (this.#publicRoutes.some(
          (route) => req.path === route || req.path.startsWith(route),
      )) {
        return next();
      }

      const user = this.getSessionUser(req);
      if (user) {
        req.user = user;
        return next();
      }

      const accept =
        req.headers && req.headers.accept ? req.headers.accept : '';
      const isHtmlRequest =
        req.method === 'GET' &&
        (accept.includes('text/html') ||
          req.path === '/' ||
          req.path.endsWith('.html'));

      if (isHtmlRequest) {
        const redirectUrl =
          req.originalUrl &&
          req.originalUrl !== '/' &&
          req.originalUrl !== '/login' ?
            `/login?redirect=${encodeURIComponent(req.originalUrl)}` :
            '/login';
        return res.redirect(redirectUrl);
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in with Google.',
        loginUrl: '/login',
      });
    };
  }
}

module.exports = AuthManager;
