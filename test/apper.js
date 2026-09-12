const Apper = require('../lib/apper');
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('Apper', () => {
  it('Route', async () => {
    const apper = new Apper('testing');
    apper.get('/testing', (context, req, res) => {
      res.send('OK');
    });
    const agent = chai.request.agent(apper.getExpress());
    const res = await agent.get('/testing');
    expect(res.text).to.equal('OK');
    await agent.close();
  });

  it('Config', async () => {
    const apper = new Apper('testing', () => {}, {
      'config1': 'value1',
    });
    apper.get('/testing', (context, req, res) => {
      res.send(JSON.stringify(context.config));
    });
    const agent = chai.request.agent(apper.getExpress());
    const res = await agent.get('/testing');
    expect(JSON.parse(res.text)['config1']).to.equal('value1');
    await agent.close();
  });

  it('Logger', async () => {
    const apper = new Apper('testing', () => {}, {
      'config1': 'value1',
    });
    apper.get('/testing', (context, req, res) => {
      context.logger.info('Testing');
      res.send('OK');
    });
    const agent = chai.request.agent(apper.getExpress());
    const res = await agent.get('/testing');
    expect(res.text).to.equal('OK');
    await agent.close();
  });

  it('Logger supports custom logDir and path resolution', () => {
    const Logger = require('../lib/logger');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    expect(Logger.resolveLogDir('~/my-logs')).to.equal(
        path.join(os.homedir(), 'my-logs'));
    expect(Logger.resolveLogDir('~')).to.equal(os.homedir());
    expect(Logger.resolveLogDir(null)).to.be.null;

    const testDir = path.join(os.tmpdir(), 'apper-test-logs-' + Date.now());
    const logger = new Logger('testlogdir', {logDir: testDir});
    expect(logger.logDir).to.equal(testDir);
    expect(fs.existsSync(testDir)).to.be.true;
    logger.close();
  });

  it('Apper passes logDir config to logger', () => {
    const path = require('path');
    const os = require('os');

    const testDir = path.join(os.tmpdir(), 'apper-app-logs-' + Date.now());
    const apper = new Apper('testapplogdir', () => {}, {
      logDir: testDir,
    });
    apper.get('/check', (context, req, res) => {
      res.send('OK');
    });
    expect(apper.getLogger().logDir).to.equal(testDir);
  });

  it('runs onStart hooks on app with context argument during start()',
      async () => {
        let appHookCalled = false;

        const apper = new Apper('teststarthooks', (ctx) => {
          ctx.foo = 'bar';
        });

        apper.onStart((context) => {
          expect(context).to.equal(apper.getContext());
          expect(context.foo).to.equal('bar');
          appHookCalled = true;
        });

        // Mock listen to avoid taking a port
        apper.getExpress().listen = () => ({
          close: () => {},
        });

        await apper.start();
        expect(appHookCalled).to.be.true;
      });

  it('Rotated log file writes in human readable format with context',
      async () => {
        const Logger = require('../lib/logger');
        const path = require('path');
        const os = require('os');
        const fs = require('fs');

        const testDir = path.join(os.tmpdir(),
            'apper-format-test-' + Date.now());
        const logger = new Logger('formattest', {logDir: testDir});
        logger.info('Hello human readable', {detail: 'ctx123'});

        // Allow stream to flush to file
        await new Promise((resolve) => setTimeout(resolve, 300));
        logger.close();

        const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.log'));
        expect(files.length).to.be.greaterThan(0);
        const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
        expect(content)
            .to.include('info: Hello human readable {"detail":"ctx123"}');
        expect(content.trim().startsWith('{')).to.be.false;
      });

  it('supports post, put, delete, and patch routes with context', async () => {
    const apper = new Apper('httptest');
    apper.post('/item', (ctx, req, res) => res.json({method: 'POST'}));
    apper.put('/item', (ctx, req, res) => res.json({method: 'PUT'}));
    apper.delete('/item', (ctx, req, res) => res.json({method: 'DELETE'}));
    apper.patch('/item', (ctx, req, res) => res.json({method: 'PATCH'}));

    const agent = chai.request.agent(apper.getExpress());
    const postRes = await agent.post('/item');
    expect(postRes.body.method).to.equal('POST');
    const putRes = await agent.put('/item');
    expect(putRes.body.method).to.equal('PUT');
    const deleteRes = await agent.delete('/item');
    expect(deleteRes.body.method).to.equal('DELETE');
    const patchRes = await agent.patch('/item');
    expect(patchRes.body.method).to.equal('PATCH');
    await agent.close();
  });

  it('Apper.resolvePath expands tilde and normalizes paths', () => {
    const path = require('path');
    const os = require('os');
    expect(Apper.resolvePath(null)).to.be.null;
    expect(Apper.resolvePath('~')).to.equal(os.homedir());
    expect(Apper.resolvePath('~/foo/bar')).to.equal(
        path.join(os.homedir(), 'foo', 'bar'));
    expect(Apper.resolvePath('/absolute/path')).to.equal('/absolute/path');
  });

  it('configures trust proxy by default and allows overriding', () => {
    const defaultApp = new Apper('trustproxydefault');
    expect(defaultApp.getExpress().get('trust proxy')).to.be.true;

    const disabledApp = new Apper('trustproxydisabled', () => {}, {
      trustProxy: false,
    });
    expect(disabledApp.getExpress().get('trust proxy')).to.be.false;
  });

  it('serves e.js and apper-auth and apper-ui static assets', async () => {
    const apper = new Apper('teststatics', () => {}, {
      auth: {enabled: false},
    });
    const agent = chai.request.agent(apper.getExpress());

    const eRes = await agent.get('/e.js').buffer();
    expect(eRes).to.have.status(200);
    expect(eRes.text).to.include('function');

    const authJsRes = await agent.get('/apper-auth.js').buffer();
    expect(authJsRes).to.have.status(200);
    expect(authJsRes.text).to.include('user-avatar-btn');

    const authCssRes = await agent.get('/apper-auth.css').buffer();
    expect(authCssRes).to.have.status(200);
    expect(authCssRes.text).to.include('.user-avatar-btn');

    const uiCssRes = await agent.get('/apper-ui.css').buffer();
    expect(uiCssRes).to.have.status(200);
    expect(uiCssRes.text).to.include('.apper-card');

    const uiJsRes = await agent.get('/apper-ui.js').buffer();
    expect(uiJsRes).to.have.status(200);
    expect(uiJsRes.text).to.include('formatEventDateTime');

    await agent.close();
  });

  describe('ApperUI Client Utilities', () => {
    let ui;
    before(async () => {
      ui = await import('../static/apper-ui.js');
    });

    it('escapeHtml escapes dangerous characters', () => {
      expect(ui.escapeHtml('<b>"hello" & \'world\'</b>')).to.equal(
          '&lt;b&gt;&quot;hello&quot; &amp; &#039;world&#039;&lt;/b&gt;',
      );
      expect(ui.escapeHtml(null)).to.equal('');
      expect(ui.escapeHtml(undefined)).to.equal('');
    });

    it('shortenUrlText trims long URLs cleanly', () => {
      expect(ui.shortenUrlText('https://example.com/short')).to.equal(
          'https://example.com/short',
      );
      expect(
          ui.shortenUrlText(
              'https://subdomain.example.com/very/long/path/name/that/exceeds/limit',
              25,
          ),
      ).to.include('...');
    });

    it('formatTextWithLinks turns URLs into links', () => {
      const text = 'Check out https://google.com for info.';
      const res = ui.formatTextWithLinks(text);
      expect(res).to.include('<a href="https://google.com"');
      expect(res).to.include('target="_blank"');
    });

    it('parseDateOnly parses YYYY-MM-DD in local time', () => {
      const d = ui.parseDateOnly('2026-09-11');
      expect(d).to.be.an.instanceOf(Date);
      expect(d.getFullYear()).to.equal(2026);
      expect(d.getMonth()).to.equal(8); // September is 8
      expect(d.getDate()).to.equal(11);
      expect(ui.parseDateOnly(null)).to.be.null;
    });

    it('formatDate formats short dates', () => {
      const d = new Date(2026, 8, 11, 10, 0, 0);
      const str = ui.formatDate(d);
      expect(str).to.be.a('string');
      expect(str.length).to.be.greaterThan(0);
    });

    it('formatEventDateTime formats all-day and timed events', () => {
      const allDayEvent = {
        isAllDay: true,
        startDate: '2026-09-11',
        endDate: '2026-09-11',
      };
      const formattedAllDay = ui.formatEventDateTime(allDayEvent);
      expect(formattedAllDay).to.be.a('string');

      const timedEvent = {
        startTime: new Date(2026, 8, 11, 9, 0, 0).toISOString(),
        endTime: new Date(2026, 8, 11, 10, 0, 0).toISOString(),
      };
      const formattedTimed = ui.formatEventDateTime(timedEvent);
      expect(formattedTimed).to.include('-');
    });

    it('getTagClass provides deterministic color tags', () => {
      const class1 = ui.getTagClass('Work');
      const class2 = ui.getTagClass('Work');
      expect(class1).to.equal(class2);
      expect(class1).to.include('source-tag');
      expect(ui.getTagClass('')).to.equal('source-tag source-tag-default');
    });
  });
});
