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
} else {
  console.log(`
Usage: apper <command> [options]

Commands:
  lint [paths...] [--fix]   Lint project files with standard Apper rules

Examples:
  apper lint
  apper lint --fix
  apper lint lib/ test/
`);
  process.exit(cmd ? 1 : 0);
}
