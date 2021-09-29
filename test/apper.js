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
      'config1': 'value1'
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
      'config1': 'value1'
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
});
