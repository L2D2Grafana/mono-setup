import { TestFixture } from '@playwright/test';
import { promises } from 'fs';
import path from 'path';
import { parse as parseYml } from 'yaml';
import { PluginFixture, PluginOptions } from '../../api';
import { ReadProvisionArgs } from '../../types';
import { PlaywrightCombinedArgs } from '../types';

type ReadProvisionFixture = TestFixture<
  <T = any>(args: ReadProvisionArgs) => Promise<T>,
  PluginFixture & PluginOptions & PlaywrightCombinedArgs
>;

const readProvision: ReadProvisionFixture = async ({ provisioningRootDir }, use) => {
  await use(async ({ filePath }) => {
    const resolvedPath = path.resolve(path.join(provisioningRootDir, filePath));
    const contents = await promises.readFile(resolvedPath, 'utf8');
    return parseYml(contents);
  });
};

export default readProvision;
