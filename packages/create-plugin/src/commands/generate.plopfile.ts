import fs from 'fs';
import glob from 'glob';
import path from 'path';
import type { ModifyActionConfig, NodePlopAPI } from 'plop';
import { EXTRA_TEMPLATE_VARIABLES, IS_DEV, PARTIALS_DIR, PLUGIN_TYPES, TEMPLATE_PATHS } from '../constants';
import { ifEq, normalizeId } from '../utils/utils.handlebars';
import { getExportPath, getMonoRepoExportPath } from '../utils/utils.path';
import { getPackageManagerInstallCmd, getPackageManagerFromUserAgent } from '../utils/utils.packageManager';
import { printGenerateSuccessMessage } from './generate-actions/print-success-message';
import { updateGoSdkAndModules } from './generate-actions/update-go-sdk-and-packages';
import { prettifyFiles } from './generate-actions/prettify-files';
import { CliArgs, TemplateData } from './types';
import { getExportFileName } from '../utils/utils.files';
import { getConfig } from '../utils/utils.config';
import { getVersion } from '../utils/utils.version';

// Plopfile API documentation: https://plopjs.com/documentation/#plopfile-api
export default function (plop: NodePlopAPI) {
  plop.setHelper('if_eq', ifEq);
  plop.setHelper('normalize_id', normalizeId);

  plop.setActionType('printSuccessMessage', printGenerateSuccessMessage);
  plop.setActionType('prettifyFiles', prettifyFiles);
  plop.setActionType('updateGoSdkAndModules', updateGoSdkAndModules);

  plop.setGenerator('create-plugin', {
    description: 'used to scaffold a grafana plugin',
    prompts: [
      {
        name: 'monoRepo',
        type: 'input',
        message: 'Is this a mono repo? (y/n)',
      },
      {
        when: function (response) {
          return response.monoRepo;
        },
        name: 'monoRepoName',
        type: 'input',
        message: 'What is going to be the name of your monorepo',
        validate: (value: string) => {
          if (/.+/.test(value)) {
            return true;
          }
          return 'Monorepo name is required';
        },
      },
      {
        when: function (response) {
          return response.monoRepo;
        },
        name: 'pluginNames',
        type: 'input',
        message: 'List the names of your plugins (comma-separated):',
        validate: function (value) {
          if (/.+/.test(value)) {
            return true;
          }
          return 'Plugin names are required';
        },
        filter: function (value) {
          // Convert comma-separated string to an array
          return value.split(',').map((pluginName: string) => pluginName.trim());
        },
      },
      {
        when: function (response) {
          return response.monoRepo;
        },
        name: 'pluginTypes',
        type: 'input',
        message: `List the names of your plugin types in order to match your previously entered plugin names (comma-separated) ${PLUGIN_TYPES.app}, ${PLUGIN_TYPES.datasource}, ${PLUGIN_TYPES.panel}, ${PLUGIN_TYPES.scenes}:`,
        filter: function (value) {
          // Convert comma-separated string to an array
          return value.split(',').map((pluginName: string) => pluginName.trim());
        },
      },
      {
        when: function (response) {
          return !response.monoRepo;
        },
        name: 'pluginName',
        type: 'input',
        message: 'What is going to be the name of your plugin?',
        validate: (value: string) => {
          if (/.+/.test(value)) {
            return true;
          }
          return 'Plugin name is required';
        },
      },
      {
        name: 'orgName',
        type: 'input',
        message: 'What is the organization name of your plugin?',
        validate: (value: string) => {
          if (/.+/.test(value)) {
            return true;
          }
          return 'Organization name is required';
        },
      },
      {
        when: function (response) {
          return !response.monoRepo;
        },
        name: 'pluginDescription',
        type: 'input',
        message: 'How would you describe your plugin?',
        default: '',
      },
      {
        when: function (response) {
          return !response.monoRepo;
        },
        name: 'pluginType',
        type: 'list',
        choices: [PLUGIN_TYPES.app, PLUGIN_TYPES.datasource, PLUGIN_TYPES.panel, PLUGIN_TYPES.scenes],
        message: 'What type of plugin would you like?',
      },
      {
        name: 'hasBackend',
        type: 'confirm',
        message: 'Do you want a backend part of your plugin?',
        default: false,
        when: (answers: CliArgs) => answers.pluginType !== PLUGIN_TYPES.panel && !answers.monoRepo,
      },
      {
        name: 'hasGithubWorkflows',
        type: 'confirm',
        message: 'Do you want to add Github CI and Release workflows?',
        default: false,
      },
      {
        name: 'hasGithubLevitateWorkflow',
        type: 'confirm',
        message: 'Do you want to add a Github workflow for automatically checking "Grafana API compatibility" on PRs?',
        default: false,
      },
    ],
    actions: function ({
      monoRepo,
      monoRepoName,
      pluginNames,
      pluginTypes,
      pluginName,
      orgName,
      pluginType,
      hasBackend,
      hasGithubWorkflows,
      hasGithubLevitateWorkflow,
    }: CliArgs) {
      if (monoRepo) {
        const { features } = getConfig();
        const currentVersion = getVersion();
        // Support the users package manager of choice.
        const { packageManagerName, packageManagerVersion } = getPackageManagerFromUserAgent();
        const packageManagerInstallCmd = getPackageManagerInstallCmd(packageManagerName);
        const isAppType = pluginType === PLUGIN_TYPES.app || pluginType === PLUGIN_TYPES.scenes || true;

        console.log('isAppType :>> ', isAppType);

        // Mono Repo root
        const exportPath = getExportPath(monoRepoName, orgName, pluginType);
        const templateData: TemplateData = {
          pluginId: monoRepoName,
          monoRepo: true,
          packageManagerName,
          packageManagerInstallCmd,
          packageManagerVersion,
          isAppType,
          isNPM: packageManagerName === 'npm',
          version: currentVersion,
          bundleGrafanaUI: features.bundleGrafanaUI,
        };

        // Copy over files that are shared between plugins types
        const commonActions = getActionsForTemplateFolder({
          folderPath: TEMPLATE_PATHS.common,
          exportPath,
          templateData,
        });

        let pluginActions: any = [];

        // Mono repo packages
        pluginNames.forEach((pluginName, i) => {
          console.log('pluginTypes[i] :>> ', pluginTypes[i]);
          const isAppType = pluginTypes[i] === PLUGIN_TYPES.app || pluginTypes[i] === PLUGIN_TYPES.scenes;
          const templateDataPlugin: TemplateData = {
            pluginId: pluginName,
            monoRepo: true,
            packageManagerName,
            packageManagerInstallCmd,
            packageManagerVersion,
            isAppType,
            isNPM: packageManagerName === 'npm',
            version: currentVersion,
            bundleGrafanaUI: features.bundleGrafanaUI,
          };

          const exportPathMonoRepo = getMonoRepoExportPath(monoRepoName, orgName, pluginType, pluginName);
          // Copy over files from the plugin type specific folder, e.g. "templates/app" for "app" plugins ("app" | "panel" | "datasource").
          const pluginTypeSpecificActions = getActionsForTemplateFolder({
            folderPath: TEMPLATE_PATHS[pluginTypes[i]],
            exportPath: exportPathMonoRepo,
            templateData: templateDataPlugin,
          });

          // Common, pluginType and backend actions can contain different templates for the same destination.
          // This filtering removes the duplicate file additions to prevent plop erroring and makes sure the
          // correct template is scaffolded.
          // Note that the order is reversed so backend > pluginType > common
          const dedupe = [...pluginTypeSpecificActions, ...commonActions].reduce((acc, file) => {
            const actionExists = acc.find((f) => f.path === file.path);
            // return early to prevent multiple add type actions being added to the array
            if (actionExists && actionExists.type === 'add' && file.type === 'add') {
              return acc;
            }
            acc.push(file);
            return acc;
          }, []);

          pluginActions = [...pluginActions, ...dedupe];
        });

        // Copy over Github workflow files (if selected)
        const ciWorkflowActions = hasGithubWorkflows
          ? getActionsForTemplateFolder({
              folderPath: TEMPLATE_PATHS.ciWorkflows,
              exportPath,
              templateData,
            })
          : [];

        const isCompatibleWorkflowActions = hasGithubLevitateWorkflow
          ? getActionsForTemplateFolder({
              folderPath: TEMPLATE_PATHS.isCompatibleWorkflow,
              exportPath,
              templateData,
            })
          : [];

        // Replace conditional bits in the Readme files
        // const readmeActions = getActionsForReadme({ exportPath, templateData });
        const readmeActions: any = [];

        return [
          ...pluginActions,
          ...ciWorkflowActions,
          ...readmeActions,
          ...isCompatibleWorkflowActions,
          {
            type: 'updateGoSdkAndModules',
          },
          { type: 'prettifyFiles' },
          {
            type: 'printSuccessMessage',
          },
        ];
      } else {
        const { features } = getConfig();
        const currentVersion = getVersion();
        const exportPath = getExportPath(pluginName, orgName, pluginType);
        const pluginId = normalizeId(pluginName, orgName, pluginType);
        // Support the users package manager of choice.
        const { packageManagerName, packageManagerVersion } = getPackageManagerFromUserAgent();
        const packageManagerInstallCmd = getPackageManagerInstallCmd(packageManagerName);
        const isAppType = pluginType === PLUGIN_TYPES.app || pluginType === PLUGIN_TYPES.scenes;
        const templateData: TemplateData = {
          pluginId,
          packageManagerName,
          packageManagerInstallCmd,
          packageManagerVersion,
          isAppType,
          isNPM: packageManagerName === 'npm',
          version: currentVersion,
          bundleGrafanaUI: features.bundleGrafanaUI,
        };
        // Copy over files that are shared between plugins types
        const commonActions = getActionsForTemplateFolder({
          folderPath: TEMPLATE_PATHS.common,
          exportPath,
          templateData,
        });

        // Copy over files from the plugin type specific folder, e.g. "templates/app" for "app" plugins ("app" | "panel" | "datasource").
        const pluginTypeSpecificActions = getActionsForTemplateFolder({
          folderPath: TEMPLATE_PATHS[pluginType],
          exportPath,
          templateData,
        });

        // Copy over backend-specific files (if selected)
        const backendFolderPath = isAppType ? TEMPLATE_PATHS.backendApp : TEMPLATE_PATHS.backend;
        const backendActions = hasBackend
          ? getActionsForTemplateFolder({ folderPath: backendFolderPath, exportPath, templateData })
          : [];

        // Common, pluginType and backend actions can contain different templates for the same destination.
        // This filtering removes the duplicate file additions to prevent plop erroring and makes sure the
        // correct template is scaffolded.
        // Note that the order is reversed so backend > pluginType > common
        const pluginActions = [...backendActions, ...pluginTypeSpecificActions, ...commonActions].reduce(
          (acc, file) => {
            const actionExists = acc.find((f) => f.path === file.path);
            // return early to prevent multiple add type actions being added to the array
            if (actionExists && actionExists.type === 'add' && file.type === 'add') {
              return acc;
            }
            acc.push(file);
            return acc;
          },
          []
        );

        // Copy over Github workflow files (if selected)
        const ciWorkflowActions = hasGithubWorkflows
          ? getActionsForTemplateFolder({
              folderPath: TEMPLATE_PATHS.ciWorkflows,
              exportPath,
              templateData,
            })
          : [];

        const isCompatibleWorkflowActions = hasGithubLevitateWorkflow
          ? getActionsForTemplateFolder({
              folderPath: TEMPLATE_PATHS.isCompatibleWorkflow,
              exportPath,
              templateData,
            })
          : [];

        // Replace conditional bits in the Readme files
        const readmeActions = getActionsForReadme({ exportPath, templateData });

        return [
          ...pluginActions,
          ...ciWorkflowActions,
          ...readmeActions,
          ...isCompatibleWorkflowActions,
          {
            type: 'updateGoSdkAndModules',
          },
          { type: 'prettifyFiles' },
          {
            type: 'printSuccessMessage',
          },
        ];
      }
    },
  });
}

function getActionsForReadme({
  exportPath,
  templateData,
}: {
  exportPath: string;
  templateData: TemplateData;
}): ModifyActionConfig[] {
  return [
    replacePatternWithTemplateInReadme(
      '-- INSERT FRONTEND GETTING STARTED --',
      'frontend-getting-started.md',
      exportPath,
      templateData
    ),
    replacePatternWithTemplateInReadme(
      '-- INSERT BACKEND GETTING STARTED --',
      'backend-getting-started.md',
      exportPath,
      templateData
    ),
    replacePatternWithTemplateInReadme(
      '-- INSERT DISTRIBUTING YOUR PLUGIN --',
      'distributing-your-plugin.md',
      exportPath,
      templateData
    ),
  ];
}

function replacePatternWithTemplateInReadme(
  pattern: string,
  partialsFile: string,
  exportPath: string,
  templateData: TemplateData
): ModifyActionConfig {
  return {
    type: 'modify',
    path: path.join(exportPath, 'README.md'),
    pattern,
    // @ts-ignore
    template: undefined,
    templateFile: path.join(PARTIALS_DIR, partialsFile),
    data: {
      ...EXTRA_TEMPLATE_VARIABLES,
      ...templateData,
    },
  };
}

// TODO<use Plop action `addMany` instead>
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

  function getExportPath(f: string) {
    return path.relative(folderPath, path.dirname(f));
  }

  return files.filter(isFile).map((f) => ({
    type: 'add',
    templateFile: f,
    // The target path where the compiled template is saved to
    path: path.join(exportPath, getExportPath(f), getExportFileName(f)),
    // Support overriding files in development for overriding "generated" plugins.
    force: IS_DEV,
    // We would still like to scaffold as many files as possible even if one fails
    abortOnFail: false,
    data: {
      ...EXTRA_TEMPLATE_VARIABLES,
      ...templateData,
    },
  }));
}

function isFile(path: string) {
  try {
    return fs.lstatSync(path).isFile();
  } catch (e) {
    return false;
  }
}
