import Handlebars, { HelperOptions } from 'handlebars';
import {
  camelCase,
  snakeCase,
  dotCase,
  pathCase,
  sentenceCase,
  constantCase,
  kebabCase,
  pascalCase,
} from 'change-case';
import { titleCase } from 'title-case';
import { PARTIALS_DIR, PLUGIN_TYPES } from '../constants.js';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

// Why? The `{#if}` expression in Handlebars unfortunately only accepts a boolean, which makes it hard to compare values in templates.
export const ifEq = (a: any, b: any, options: HelperOptions) => {
  return a === b ? options.fn(this) : options.inverse(this);
};

export const normalizeId = (pluginName: string, orgName: string, type: PLUGIN_TYPES) => {
  const nameRegex = new RegExp('[^0-9a-zA-Z]', 'g');
  const newOrgName = orgName.replace(nameRegex, '');
  if (type) {
    const re = new RegExp(`-?${type}$`, 'i');
    const pluginType = type ? `-${type}` : '';
    const newPluginName = pluginName.replace(re, '').replace(nameRegex, '');
    const newOrgName = orgName.replace(nameRegex, '');
    return newOrgName.toLowerCase() + '-' + newPluginName.toLowerCase() + pluginType;
  }
  return newOrgName.toLowerCase() + '-' + pluginName.toLowerCase();
};

export const notCase = (value: any) => {
  console.log('value :>> ', value);
  return !value;
};

// Register our helpers and partials with handlebars.
registerHandlebarsHelpers();
registerHandlebarsPartials();

function registerHandlebarsHelpers() {
  const helpers = {
    camelCase: camelCase,
    snakeCase: snakeCase,
    dotCase: dotCase,
    pathCase: pathCase,
    lowerCase: (str: string) => str.toUpperCase(),
    upperCase: (str: string) => str.toLowerCase(),
    sentenceCase: sentenceCase,
    constantCase: constantCase,
    titleCase: titleCase,
    dashCase: kebabCase,
    kabobCase: kebabCase,
    kebabCase: kebabCase,
    properCase: pascalCase,
    pascalCase: pascalCase,
    if_eq: ifEq,
    normalize_id: normalizeId,
    not: notCase,
  };

  Object.keys(helpers).forEach((helperName) =>
    Handlebars.registerHelper(helperName, helpers[helperName as keyof typeof helpers])
  );
}

function registerHandlebarsPartials() {
  const partialFiles = readdirSync(PARTIALS_DIR);
  partialFiles.forEach((fileName) => {
    const name = basename(fileName, '.md');
    const template = readFileSync(join(PARTIALS_DIR, fileName), 'utf-8');
    Handlebars.registerPartial(name, template);
  });
}

export function renderHandlebarsTemplate(template: string, data?: any) {
  return Handlebars.compile(template)(data);
}
