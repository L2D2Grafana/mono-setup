import path from 'path';
import { PLUGIN_TYPES, IS_DEV, DEV_EXPORT_DIR } from '../constants';
import { normalizeId } from './utils.handlebars';

export function getExportPath(pluginName: string, orgName: string, pluginType: PLUGIN_TYPES): string {
  if (!pluginType) {
    pluginType = PLUGIN_TYPES.app;
  }
  if (IS_DEV) {
    return DEV_EXPORT_DIR;
  } else {
    return path.join(process.cwd(), normalizeId(pluginName, orgName, pluginType));
  }
}

export function getMonoRepoExportPath(
  monoRepoName: string,
  orgName: string,
  pluginType: PLUGIN_TYPES,
  pluginName: string
): string {
  if (!pluginType) {
    pluginType = PLUGIN_TYPES.app;
  }
  if (IS_DEV) {
    return DEV_EXPORT_DIR;
  } else {
    return path.join(process.cwd(), normalizeId(monoRepoName, orgName, pluginType) + '/packages/' + pluginName + '/');
  }
}
