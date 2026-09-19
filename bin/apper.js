#!/usr/bin/env node

const [, , cmd, ...rest] = process.argv;

if (cmd === 'lint') {
  const {run} = require('../lib/lint');
  run(rest)
      .then((exitCode) => {
        process.exit(exitCode);
      })
      .catch((err) => {
        console.error('Lint failed with error:', err);
        process.exit(1);
      });
} else if (cmd === 'test') {
  const {run} = require('../lib/test');
  run(rest)
      .then((exitCode) => {
        process.exit(exitCode);
      })
      .catch((err) => {
        console.error('Test failed with error:', err);
        process.exit(1);
      });
} else {
  console.log(`
Usage: apper <command> [options]

Commands:
  lint [paths...] [--fix]   Lint project files with standard Apper rules
  test [args...]            Run tests with bundled Mocha and Chai

Examples:
  apper lint
  apper lint --fix
  apper test
  apper test --bail --check-leaks
`);
  process.exit(cmd ? 1 : 0);
}
