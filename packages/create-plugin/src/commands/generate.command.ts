import glob from 'glob';
import minimist from 'minimist';
import chalk from 'chalk';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EXTRA_TEMPLATE_VARIABLES, IS_DEV, PLUGIN_TYPES, TEMPLATE_PATHS } from '../constants.js';
import { getConfig } from '../utils/utils.config.js';
import { printError } from '../utils/utils.console.js';
import { directoryExists, getExportFileName, isFile } from '../utils/utils.files.js';
import { normalizeId } from '../utils/utils.handlebars.js';
import { getPackageManagerFromUserAgent, getPackageManagerInstallCmd } from '../utils/utils.packageManager.js';
import { getExportPath, getMonoRepoExportPath } from '../utils/utils.path.js';
import { renderTemplateFromFile } from '../utils/utils.templates.js';
import { getVersion } from '../utils/utils.version.js';
import { prettifyFiles } from './generate/prettify-files.js';
import { printGenerateSuccessMessage } from './generate/print-success-message.js';
import { promptUser } from './generate/prompt-user.js';
import { updateGoSdkAndModules } from './generate/update-go-sdk-and-packages.js';
import { CliArgs, TemplateData } from './types.js';

export const generate = async (argv: minimist.ParsedArgs) => {
  const answers = await promptUser(argv);
  const { monoRepo, monoRepoName, pluginNames, pluginName, pluginType } = answers;
  const name = monoRepoName ? monoRepoName : pluginName;
  const type = pluginType ? pluginType : null;
  const subTemplateData: any = [];
  const templateData = getTemplateData(answers);
  const exportPath = getExportPath(name, answers.orgName, type);
  const exportPathExists = await directoryExists(exportPath);
  const exportPathIsPopulated = exportPathExists ? (await readdir(exportPath)).length > 0 : false;

  // Prevent generation from writing to an existing, populated directory unless in DEV mode.
  if (exportPathIsPopulated && !IS_DEV) {
    printError(`**Aborting plugin scaffold. '${exportPath}' exists and contains files.**`);
    process.exit(1);
  }

  // Generate templates for each plugin in a monorepo
  if (monoRepo) {
    pluginNames.forEach((pluginName: string, i: number) => {
      const subFolder = pluginName;
      subTemplateData.push(getTemplateData(answers, subFolder, i));
    });
  }

  const actions = getTemplateActions({ templateData, exportPath, answers, subTemplateData });
  const { changes, failures } = await generateFiles({ actions });

  changes.forEach((change) => {
    console.log(`${chalk.green('✔︎ ++')} ${change.path}`);
  });

  failures.forEach((failure) => {
    printError(`${failure.error}`);
  });

  if (answers.hasBackend) {
    await execPostScaffoldFunction(updateGoSdkAndModules, exportPath);
  }
  await execPostScaffoldFunction(prettifyFiles, exportPath);

  printGenerateSuccessMessage(answers);
};

function getTemplateData(answers: CliArgs, subFolder?: string, i?: number) {
  const { monoRepoName, pluginName, orgName, pluginType, pluginTypes } = answers;

  const name = subFolder ? subFolder : monoRepoName ? monoRepoName : pluginName;
  const type = subFolder ? pluginTypes[i] : pluginType ? pluginType : null;
  let isAppType = true;
  if (subFolder) {
    isAppType = pluginTypes[i] === PLUGIN_TYPES.app || pluginTypes[i] === PLUGIN_TYPES.scenes;
  } else {
    isAppType = pluginType === PLUGIN_TYPES.app || pluginType === PLUGIN_TYPES.scenes || true;
  }

  const { features } = getConfig();
  const currentVersion = getVersion();
  const pluginId = normalizeId(name, orgName, type);

  // Support the users package manager of choice.
  const { packageManagerName, packageManagerVersion } = getPackageManagerFromUserAgent();
  const packageManagerInstallCmd = getPackageManagerInstallCmd(packageManagerName);

  const templateData: TemplateData = {
    ...answers,
    pluginId,
    ...(!subFolder && monoRepoName ? { pluginDescription: 'mono repo' } : {}),
    packageManagerName,
    packageManagerInstallCmd,
    packageManagerVersion,
    isAppType,
    isNPM: packageManagerName === 'npm',
    version: currentVersion,
    bundleGrafanaUI: features.bundleGrafanaUI,
  };

  return templateData;
}

function getTemplateActions({
  exportPath,
  templateData,
  answers,
  subTemplateData,
}: {
  exportPath: string;
  templateData: any;
  answers: any;
  subTemplateData?: any[];
}) {
  const { monoRepo, monoRepoName, orgName, pluginNames, pluginTypes } = answers;
  const commonActions = getActionsForTemplateFolder({
    folderPath: TEMPLATE_PATHS.common,
    exportPath,
    templateData,
  });

  let pluginActions: any = [];
  if (monoRepo) {
    pluginNames.forEach((pluginName: string, i: number) => {
      const exportPathMonoRepo = getMonoRepoExportPath(monoRepoName, orgName, null, pluginName);

      // Copy over files from the plugin type specific folder, e.g. "templates/app" for "app" plugins ("app" | "panel" | "datasource").
      const pluginTypeSpecificActions = getActionsForTemplateFolder({
        folderPath: TEMPLATE_PATHS[pluginTypes[i]],
        exportPath: exportPathMonoRepo,
        templateData: subTemplateData[i],
      });

      // TODO: hasBackend is not supported for monorepos yet.

      // Common, pluginType and backend actions can contain different templates for the same destination.
      // This filtering removes the duplicate file additions to make sure the correct template is scaffolded.
      // Note that the order is reversed so backend > pluginType > common
      const dedupe = [...pluginTypeSpecificActions].reduce((acc, file) => {
        const actionExists = acc.find((f) => f.path === file.path);
        // return early to prevent duplicate file additions
        if (actionExists) {
          return acc;
        }
        acc.push(file);
        return acc;
      }, []);

      pluginActions = [...pluginActions, ...dedupe];
    });
    pluginActions = [...pluginActions, ...commonActions];
  } else {
    // Copy over files from the plugin type specific folder, e.g. "templates/app" for "app" plugins ("app" | "panel" | "datasource").
    const pluginTypeSpecificActions = getActionsForTemplateFolder({
      folderPath: TEMPLATE_PATHS[templateData.pluginType],
      exportPath,
      templateData,
    });
    // Copy over backend-specific files (if selected)
    const backendFolderPath = templateData.isAppType ? TEMPLATE_PATHS.backendApp : TEMPLATE_PATHS.backend;
    const backendActions = templateData.hasBackend
      ? getActionsForTemplateFolder({ folderPath: backendFolderPath, exportPath, templateData })
      : [];
    // Common, pluginType and backend actions can contain different templates for the same destination.
    // This filtering removes the duplicate file additions to make sure the correct template is scaffolded.
    // Note that the order is reversed so backend > pluginType > common
    pluginActions = [...backendActions, ...pluginTypeSpecificActions, ...commonActions].reduce((acc, file) => {
      const actionExists = acc.find((f) => f.path === file.path);
      // return early to prevent duplicate file additions
      if (actionExists) {
        return acc;
      }
      acc.push(file);
      return acc;
    }, []);
  }

  // Copy over Github workflow files (if selected)
  const ciWorkflowActions = templateData.hasGithubWorkflows
    ? getActionsForTemplateFolder({
        folderPath: TEMPLATE_PATHS.ciWorkflows,
        exportPath,
        templateData,
      })
    : [];

  const isCompatibleWorkflowActions = templateData.hasGithubLevitateWorkflow
    ? getActionsForTemplateFolder({
        folderPath: TEMPLATE_PATHS.isCompatibleWorkflow,
        exportPath,
        templateData,
      })
    : [];

  return [...pluginActions, ...ciWorkflowActions, ...isCompatibleWorkflowActions];
}

function getActionsForTemplateFolder({
  folderPath,
  exportPath,
  templateData,
}: {
  folderPath: string;
  exportPath: string;
  templateData: TemplateData;
}) {
  let files = glob.sync(`${folderPath}/**`, { dot: true });

  // The npmrc file is only useful for `pnpm` settings. We can remove it for other package managers.
  if (templateData.packageManagerName !== 'pnpm') {
    files = files.filter((file) => path.basename(file) !== 'npmrc');
  }

  function getFileExportPath(f: string) {
    return path.relative(folderPath, path.dirname(f));
  }

  return files.filter(isFile).map((f) => ({
    templateFile: f,
    // The target path where the compiled template is saved to
    path: path.join(exportPath, getFileExportPath(f), getExportFileName(f)),
    data: {
      ...EXTRA_TEMPLATE_VARIABLES,
      ...templateData,
    },
  }));
}

async function generateFiles({ actions }: { actions: any[] }) {
  const failures = [];
  const changes = [];
  for (const action of actions) {
    try {
      const rootDir = path.dirname(action.path);
      const pathExists = await directoryExists(rootDir);
      if (!pathExists) {
        await mkdir(rootDir, { recursive: true });
      }

      const rendered = renderTemplateFromFile(action.templateFile, action.data);

      await writeFile(action.path, rendered);
      changes.push({
        path: action.path,
      });
    } catch (error) {
      if (action.templateFile.includes('package.json')) {
        console.log('error :>> ', error);
      }
      failures.push({
        path: action.path,
        error: error.message || error.toString(),
      });
    }
  }
  return { failures, changes };
}

type AsyncFunction<T> = (...args: any[]) => Promise<T>;

async function execPostScaffoldFunction<T>(fn: AsyncFunction<T>, ...args: Parameters<AsyncFunction<T>>) {
  try {
    const resultMsg = await fn.apply(undefined, args);
    if (resultMsg) {
      console.log(`${chalk.green('✔︎')} ${resultMsg}`);
    }
  } catch (error) {
    printError(`${error}`);
  }
}
