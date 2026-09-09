# @sarosia/apper

> Rapid Node.js web application toolkit bundling Express, UIkit, Winston logging with daily rotation, hierarchical configuration, and built-in Google SSO authentication.

Apper gets your web applications running in seconds by eliminating boilerplate for configuration loading, structured logging, frontend UI styling, and user authentication.

---

## Features

- 🚀 **Zero Boilerplate**: Initialize an Express web app with routing, logging, and configuration in just a few lines.
- 🔐 **Built-in Google SSO**: Complete OAuth 2.0 OpenID Connect authentication, HMAC-signed session cookies, email whitelist authorization, and auto-redirects.
- 👤 **Ready-to-use Auth UI**: Pre-packaged `/login` page and `<apper-user-profile>` web component / badge with Google user avatar and sign-out button.
- 🪵 **Production Logging**: Winston logger with daily rotating JSON log files (`app-%DATE%.log`), custom `logDir` with tilde expansion, and colorized development console output.
- ⚙️ **Hierarchical Configuration**: Powered by `rc` for seamless merging of defaults, configuration files (`.<appname>rc`), environment variables, and CLI flags.
- 🎨 **Bundled UIkit**: Automatically serves UIkit CSS and JavaScript assets without manual build steps.
- 🧩 **Context Architecture**: Injects a shared `Context` holding logger, configuration, and custom application services into every route handler.
- 🔄 **Lifecycle Hooks**: Register asynchronous startup hooks with `app.onStart((ctx) => ...)`.

---

## Installation

```bash
npm install @sarosia/apper
```

Or reference directly from GitHub:

```bash
npm install github:sarosia/apper
```

---

## Quick Start

Create an `index.js`:

```javascript
const Apper = require('@sarosia/apper');

const app = new Apper('myapp', (ctx) => {
  ctx.logger.info('App initialized with port %s', ctx.config.port);
}, {
  port: 8080,
});

app.get('/api/hello', (ctx, req, res) => {
  ctx.logger.info('Greeting requested');
  res.json({ message: 'Hello, world!' });
});

app.start();
```

Run the application:

```bash
node index.js
```

---

## Architecture & Core Concepts

### Context-Driven Dependency Injection

When instantiating `Apper`, the initializer function receives a `Context` instance:

```javascript
const app = new Apper('myapp', (ctx) => {
  // ctx.config  -> Merged configuration from rc
  // ctx.logger  -> Winston Logger instance
  // ctx.auth    -> AuthManager instance

  // Attach arbitrary application services
  ctx.database = new Database(ctx.config.dbUrl);
  ctx.service = new CustomService(ctx.database, ctx.logger);
});
```

Every route registered via `app.get()` or `app.post()` receives `ctx` as its first parameter:

```javascript
app.get('/items', async (ctx, req, res) => {
  const items = await ctx.database.getItems();
  res.json(items);
});
```

### Startup Lifecycle (`onStart`)

Register startup tasks (such as background workers, database connections, or schedulers) that should only run when `app.start()` is called:

```javascript
app.onStart(async (ctx) => {
  await ctx.database.connect();
  ctx.service.startPolling();
});

app.start();
```

---

## Google SSO Authentication

Apper provides end-to-end Google OAuth 2.0 Single Sign-On and session management out of the box.

### 1. Configuration

Configure your Google OAuth credentials in your app configuration file (e.g. `.myapprc` in the project root or `$HOME`) or via environment variables:

```json
{
  "port": 8080,
  "auth": {
    "enabled": true,
    "clientId": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "clientSecret": "YOUR_GOOGLE_CLIENT_SECRET",
    "callbackUrl": "http://localhost:8080/auth/callback",
    "cookieName": "myapp_session",
    "sessionMaxAge": "7d",
    "allowedEmails": [
      "alice@example.com",
      "bob@example.com"
    ],
    "publicRoutes": [
      "/api/public",
      "/healthz",
      "/webhooks"
    ]
  }
}
```

#### Environment Variables Alternative

You can also provide credentials via environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `SESSION_SECRET`

### 2. How Auth Works

- **Browser Requests (`text/html`)**: Unauthenticated users visiting protected pages are automatically redirected to `/login?redirect=...`.
- **API Requests**: Unauthenticated requests to JSON/API routes automatically return `401 Unauthorized`.
- **Public Endpoints**: Routes listed in `auth.publicRoutes` (or `config.publicRoutes`) bypass authentication entirely (ideal for IoT devices, webhooks, or health checks).
- **Session Security**: Sessions are stored in an HttpOnly, SameSite cookie containing an HMAC SHA-256 signed token.
- **Whitelist Enforcement**: If `allowedEmails` is non-empty, only listed email addresses are allowed to sign in.

### 3. Built-in Auth Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/login` | `GET` | Out-of-the-box Google Sign-In page |
| `/auth/login` | `GET` | Initiates Google OAuth consent flow |
| `/auth/callback` | `GET` | Handles OAuth redirect and issues signed session cookie |
| `/auth/logout` | `GET` | Clears session cookie and redirects to `/login` |
| `/auth/me` | `GET` | Returns current user profile JSON `{ authenticated, user }` |
| `/auth/config` | `GET` | Returns auth status metadata |

---

## Frontend Integration

Apper automatically serves UIkit and authentication assets.

### HTML Setup

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>My App</title>
  <!-- UIkit (automatically served) -->
  <link rel="stylesheet" href="css/uikit.min.css" />
  <script src="js/uikit.min.js"></script>
  <script src="js/uikit-icons.min.js"></script>

  <!-- Apper Auth UI (automatically served) -->
  <link rel="stylesheet" href="apper-auth.css" />
  <script src="apper-auth.js"></script>
</head>
<body>
  <nav class="uk-navbar-container uk-padding-small">
    <div class="uk-flex uk-flex-between uk-flex-middle">
      <h2 class="uk-margin-remove">My App</h2>
      <!-- User profile badge with avatar and logout button renders here automatically -->
      <div id="user-profile"></div>
    </div>
  </nav>

  <main class="uk-container uk-margin-top">
    <!-- Or use the custom web component -->
    <!-- <apper-user-profile></apper-user-profile> -->
  </main>
</body>
</html>
```

---

## Static Assets Configuration

```javascript
const path = require('path');
const Apper = require('@sarosia/apper');

const app = new Apper('myapp', (ctx) => {}, {
  // Static paths protected behind Google SSO authentication
  staticPaths: [
    path.resolve(__dirname, 'static'),
  ],
  // Public static paths accessible without authentication
  publicStaticPaths: [
    path.resolve(__dirname, 'public'),
  ],
});
```

---

## Logging

Apper configures a Winston logger by default:

- **Files**: Automatically logs to daily rotating files (`myapp-YYYY-MM-DD.log`) kept for 7 days.
- **Console**: Displays clean, human-readable, colorized logs in non-production environments (`process.env.NODE_ENV !== 'production'`).
- **Custom Directory**: Set `logDir` in your configuration (supports `~` home directory paths, e.g. `~/logs`).

```javascript
ctx.logger.info('Order processed: %s', orderId);
ctx.logger.warn('Rate limit approaching for %s', ip);
ctx.logger.error('Database connection failed', err);
```

---

## API Reference

### `new Apper(name, [init], [defaultConfig])`

- **`name`** *(string)*: Application name (used as service name in logs, cookie prefix, and `rc` config namespace).
- **`init(ctx)`** *(function, optional)*: Initializer callback receiving the `Context`.
- **`defaultConfig`** *(object, optional)*: Default configuration options.

### Apper Instance Methods

- **`app.start()`**: Starts the Express server and executes all registered `onStart` hooks. Returns `Promise<http.Server>`.
- **`app.onStart(hook)`**: Registers an async/sync callback `async (ctx) => {}` to run upon startup.
- **`app.get(route, handler)`**: Registers a GET handler `(ctx, req, res, next) => {}`.
- **`app.post(route, handler)`**: Registers a POST handler `(ctx, req, res, next) => {}`.
- **`app.use(...middleware)`**: Mounts Express middleware.
- **`app.getExpress()`**: Returns the underlying Express application instance.
- **`app.getContext()`**: Returns the shared `Context`.
- **`app.getAuth()`**: Returns the `AuthManager` instance.
- **`app.getLogger()`**: Returns the `Logger` instance.

---

## Running Tests

```bash
npm test
npm run lint
```

---

## License

[MIT](LICENSE)
