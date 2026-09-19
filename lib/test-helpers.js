const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiHttp = require('chai-http');

chai.use(chaiAsPromised);
chai.use(chaiHttp);

module.exports = {
  chai,
  expect: chai.expect,
  assert: chai.assert,
  should: chai.should,
};
