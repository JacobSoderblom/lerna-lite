const cli = require('./lerna-cli');
const pkg = require('../package.json');

const execCmd = require('./cli-commands/cli-exec-commands');
const initCmd = require('./cli-commands/cli-init-commands');
const infoCmd = require('./cli-commands/cli-info-commands');
const publishCmd = require('./cli-commands/cli-publish-commands');
const runCmd = require('./cli-commands/cli-run-commands');
const versionCmd = require('./cli-commands/cli-version-commands');

export function lerna(argv: any[]) {
  const context = {
    lernaVersion: pkg.version,
  };

  return cli()
    .command(execCmd)
    .command(infoCmd)
    .command(initCmd)
    .command(publishCmd)
    .command(runCmd)
    .command(versionCmd)
    .parse(argv, context);
}
