import minimist from 'minimist';
import Enquirer from 'enquirer';
import { PLUGIN_TYPES } from '../../constants.js';
import { CliArgs } from '../types.js';

export async function promptUser(argv: minimist.ParsedArgs) {
  let answers: Partial<CliArgs> = {};
  const enquirer = new Enquirer();

  for (const prompt of prompts) {
    const { name, shouldPrompt } = prompt;

    if (argv.hasOwnProperty(name)) {
      answers = { ...answers, [name]: argv[name] };
    } else {
      if (typeof shouldPrompt === 'function' && !shouldPrompt(answers)) {
        continue;
      } else {
        const result = await enquirer.prompt(prompt);
        answers = { ...answers, ...result };
      }
    }
  }

  return answers as CliArgs;
}

type Prompt = {
  name: keyof CliArgs;
  type: string | (() => string);
  message: string | (() => string) | (() => Promise<string>);
  validate?: (value: string) => boolean | string | Promise<boolean | string>;
  initial?: any;
  choices?: Array<string | Choice>;
  shouldPrompt?: ((state: object) => boolean | Promise<boolean>) | boolean;
};

type Choice = {
  name: string;
  message?: string;
  value?: unknown;
  hint?: string;
  role?: string;
  enabled?: boolean;
  disabled?: boolean | string;
};

const prompts: Prompt[] = [
  {
    name: 'monoRepo',
    type: 'confirm',
    message: 'Is this a mono repo?',
    initial: false,
  },
  {
    shouldPrompt: (answers: CliArgs) => answers.monoRepo,
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
    shouldPrompt: (answers: CliArgs) => answers.monoRepo,
    name: 'pluginNames',
    type: 'list',
    message: 'List the names of your plugins (comma-separated):',
    validate: (value) => {
      if (/.+/.test(value)) {
        return true;
      }
      return 'Plugin names are required';
    },
  },
  {
    shouldPrompt: (answers: CliArgs) => answers.monoRepo,
    name: 'pluginTypes',
    type: 'list',
    message: `List the names of your plugin types in order to match your previously entered plugin names (comma-separated) ${PLUGIN_TYPES.app}, ${PLUGIN_TYPES.datasource}, ${PLUGIN_TYPES.panel}, ${PLUGIN_TYPES.scenes}:`,
  },
  {
    shouldPrompt: (answers: CliArgs) => !answers.monoRepo,
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
    shouldPrompt: (answers: CliArgs) => !answers.monoRepo,
    name: 'pluginDescription',
    type: 'input',
    message: 'How would you describe your plugin?',
    initial: '',
  },
  {
    shouldPrompt: (answers: CliArgs) => !answers.monoRepo,
    name: 'pluginType',
    type: 'select',
    choices: [PLUGIN_TYPES.app, PLUGIN_TYPES.datasource, PLUGIN_TYPES.panel, PLUGIN_TYPES.scenes],
    message: 'What type of plugin would you like?',
  },
  {
    shouldPrompt: (answers: CliArgs) => answers.pluginType !== PLUGIN_TYPES.panel || !answers.monoRepo,
    name: 'hasBackend',
    type: 'confirm',
    message: 'Do you want a backend part of your plugin?',
    initial: false,
  },
  {
    name: 'hasGithubWorkflows',
    type: 'confirm',
    message: 'Do you want to add Github CI and Release workflows?',
    initial: false,
  },
  {
    name: 'hasGithubLevitateWorkflow',
    type: 'confirm',
    message: 'Do you want to add a Github workflow for automatically checking "Grafana API compatibility" on PRs?',
    initial: false,
  },
];
