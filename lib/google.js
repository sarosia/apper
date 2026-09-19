const {google} = require('googleapis');
const path = require('path');
const os = require('os');

const SCOPE_SHORTCUTS = {
  'calendar': 'https://www.googleapis.com/auth/calendar',
  'calendar.readonly': 'https://www.googleapis.com/auth/calendar.readonly',
  'calendar.events': 'https://www.googleapis.com/auth/calendar.events',
  'drive': 'https://www.googleapis.com/auth/drive',
  'drive.file': 'https://www.googleapis.com/auth/drive.file',
  'drive.readonly': 'https://www.googleapis.com/auth/drive.readonly',
  'gmail': 'https://www.googleapis.com/auth/gmail.readonly',
  'spreadsheets': 'https://www.googleapis.com/auth/spreadsheets',
};

function resolvePath(rawPath) {
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

function normalizeScopes(scopes) {
  if (!scopes) {
    return [];
  }
  const list = Array.isArray(scopes) ? scopes : [scopes];
  return list.map((scope) => SCOPE_SHORTCUTS[scope] || scope);
}

function resolveKeyFilename(keyFilename) {
  if (keyFilename) {
    return resolvePath(keyFilename);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return resolvePath(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }
  return null;
}

function getGoogleAuth(options = {}) {
  const opts = typeof options === 'string' || Array.isArray(options) ?
    {scopes: options} :
    Object.assign({}, options);

  opts.scopes = normalizeScopes(opts.scopes);
  const keyFilename = resolveKeyFilename(opts.keyFilename);
  if (keyFilename) {
    opts.keyFilename = keyFilename;
  }

  return new google.auth.GoogleAuth(opts);
}

const authClients = new Map();

async function initGoogleAuth(options = {}) {
  const auth = getGoogleAuth(options);
  const scopes = (auth.scopes || []).slice().sort();
  const cacheKey = JSON.stringify({
    scopes,
    keyFilename: auth.keyFilename || '',
  });

  if (authClients.has(cacheKey)) {
    return authClients.get(cacheKey);
  }

  const authClient = await auth.getClient();
  google.options({
    auth: authClient,
  });

  const result = {auth, client: authClient};
  authClients.set(cacheKey, result);
  return result;
}

async function getGoogleService(serviceName, version = 'v3', options = {}) {
  const authOptions = options.scopes ?
    options :
    Object.assign({}, options, {scopes: [serviceName]});
  await initGoogleAuth(authOptions);
  if (typeof google[serviceName] !== 'function') {
    throw new Error(`Unknown Google service: "${serviceName}"`);
  }
  return google[serviceName](version);
}

module.exports = {
  google,
  SCOPE_SHORTCUTS,
  normalizeScopes,
  getGoogleAuth,
  initGoogleAuth,
  getGoogleService,
};
