const AuthManager = require('../lib/auth');
const Apper = require('../lib/apper');
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('Apper Auth', () => {
  describe('AuthManager Unit Tests', () => {
    it('initializes defaults and checks whitelist', () => {
      const auth = new AuthManager('myapp', {
        auth: {
          allowedEmails: ['alice@example.com', 'BOB@EXAMPLE.COM'],
        },
      });

      expect(auth.isEnabled()).to.be.true;
      expect(auth.getCookieName()).to.equal('myapp_session');
      expect(auth.isAllowed('alice@example.com')).to.be.true;
      expect(auth.isAllowed('bob@example.com')).to.be.true;
      expect(auth.isAllowed('eve@example.com')).to.be.false;
    });

    it('creates and verifies session tokens', () => {
      const auth = new AuthManager('myapp', {
        auth: {
          allowedEmails: ['user@example.com'],
          sessionSecret: 'test-secret',
        },
      });

      const token = auth.createSessionToken({
        email: 'user@example.com',
        name: 'Test User',
      });

      expect(token).to.be.a('string');
      const verified = auth.verifySessionToken(token);
      expect(verified).to.not.be.null;
      expect(verified.email).to.equal('user@example.com');
      expect(verified.name).to.equal('Test User');
    });

    it('rejects tampered session tokens', () => {
      const auth = new AuthManager('myapp', {
        auth: {
          allowedEmails: ['user@example.com'],
          sessionSecret: 'test-secret',
        },
      });

      const token = auth.createSessionToken({email: 'user@example.com'});
      const [, sig] = token.split('.');
      const tamperedPayload = Buffer.from(
          JSON.stringify({email: 'admin@example.com', exp: Date.now() + 10000}),
      ).toString('base64url');

      expect(auth.verifySessionToken(`${tamperedPayload}.${sig}`)).to.be.null;
    });
  });

  describe('Apper Auth Integration', () => {
    let apper;
    let expressApp;

    beforeEach(() => {
      apper = new Apper(
          'authtest',
          () => {},
          {
            auth: {
              enabled: true,
              allowedEmails: ['authorized@example.com'],
              sessionSecret: 'test-key',
            },
          },
      );

      apper.get('/api/protected', (context, req, res) => {
        res.json({status: 'OK', user: req.user});
      });

      expressApp = apper.getExpress();
    });

    it('serves login page and public assets without auth', async () => {
      const resLogin = await chai.request(expressApp).get('/login');
      expect(resLogin).to.have.status(200);
      expect(resLogin.text).to.include('Sign in with Google');

      const resCss = await chai
          .request(expressApp)
          .get('/apper-auth.css')
          .buffer();
      expect(resCss).to.have.status(200);
      expect(resCss.text).to.include('.user-profile-badge');

      const resJs = await chai
          .request(expressApp)
          .get('/apper-auth.js')
          .buffer();
      expect(resJs).to.have.status(200);
      expect(resJs.text).to.include('ApperAuth');
    });

    it('provides /auth/config endpoint', async () => {
      const res = await chai.request(expressApp).get('/auth/config');
      expect(res).to.have.status(200);
      expect(res.body.enabled).to.be.true;
      expect(res.body.allowedEmails).to.include('authorized@example.com');
    });

    it('redirects unauthenticated browser request to /login', async () => {
      const res = await chai
          .request(expressApp)
          .get('/api/protected')
          .set('Accept', 'text/html')
          .redirects(0);

      expect(res).to.have.status(302);
      expect(res.header.location).to.include('/login');
    });

    it('returns 401 for unauthenticated API requests', async () => {
      const res = await chai
          .request(expressApp)
          .get('/api/protected')
          .set('Accept', 'application/json');

      expect(res).to.have.status(401);
      expect(res.body.error).to.equal('Unauthorized');
    });

    it('allows access with session cookie and attaches req.user', async () => {
      const auth = apper.getAuth();
      const token = auth.createSessionToken({
        email: 'authorized@example.com',
        name: 'Auth User',
      });

      const res = await chai
          .request(expressApp)
          .get('/api/protected')
          .set('Cookie', `authtest_session=${token}`);

      expect(res).to.have.status(200);
      expect(res.body.status).to.equal('OK');
      expect(res.body.user.email).to.equal('authorized@example.com');
      expect(res.body.user.name).to.equal('Auth User');
    });

    it('handles logout flow and clears cookie', async () => {
      const resLogout = await chai
          .request(expressApp)
          .get('/auth/logout')
          .redirects(0);

      expect(resLogout).to.have.status(302);
      expect(resLogout.header.location).to.equal('/login');
      expect(resLogout.header['set-cookie'][0])
          .to.include('authtest_session=;');
    });
  });
});
