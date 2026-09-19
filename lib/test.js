const path = require('path');
const fs = require('fs');
const {fork} = require('child_process');

function getMochaBin() {
  const pkgPath = require.resolve('mocha/package.json');
  const pkg = require(pkgPath);
  const binField = pkg.bin;
  const relBin = typeof binField === 'string' ?
    binField :
    (binField.mocha || binField._mocha || './bin/mocha');
  return path.resolve(path.dirname(pkgPath), relBin);
}

function run(args = [], cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const mochaBin = getMochaBin();

    const hasReporter = args.some(
        (arg) =>
          arg === '-R' ||
        arg === '--reporter' ||
        arg.startsWith('--reporter='),
    );
    const mochaArgs = [];

    if (!hasReporter) {
      mochaArgs.push('--reporter', 'spec');
    }

    const hasPath = args.some((arg) => !arg.startsWith('-'));

    mochaArgs.push(...args);

    if (!hasPath) {
      const defaultTestDir = path.join(cwd, 'test');
      if (fs.existsSync(defaultTestDir)) {
        mochaArgs.push('test/');
      }
    }

    const child = fork(mochaBin, mochaArgs, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        resolve(code || 0);
      }
    });
  });
}

module.exports = {
  getMochaBin,
  run,
};
