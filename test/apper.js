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
});
