import { exec as nodeExec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs';
import { getExportPath } from '../../utils/utils.path';
import { CliArgs } from '../types';
import { PLUGIN_TYPES } from '../../constants';

const exec = promisify(nodeExec);

export async function prettifyFiles({ monoRepoName, pluginName, orgName, pluginType }: CliArgs) {
  const name = monoRepoName || pluginName;
  if (!pluginType) {
    pluginType = PLUGIN_TYPES.app;
  }
  const exportPath = getExportPath(name, orgName, pluginType);

  if (!fs.existsSync(exportPath)) {
    return '';
  }

  try {
    let command = 'npx -y prettier@2 . --write';
    await exec(command, { cwd: exportPath });
  } catch (error) {
    throw new Error(
      'There was a problem running prettier on the plugin files. Please run `npx -y prettier@2 . --write` manually in your plugin directory.'
    );
  }
  return 'Successfully ran prettier against new plugin.';
}
