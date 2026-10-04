'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { rewriteAliases } = require('./aep-resources.cjs');

function createResolver(extensionRoot, cacheRoot) {
  const resourceRoot = path.join(extensionRoot, 'resources');
  const temporaryRoot = cacheRoot || path.join(os.tmpdir(), 'LyricMotion-AE', 'portable-projects');
  function resolveResource(value) {
    const file = String(value || '');
    if (!/^resources[\\/]/i.test(file)) return file;
    const result = path.resolve(extensionRoot, file);
    const relative = path.relative(resourceRoot, result);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Invalid bundled resource path');
    return result;
  }
  async function prepare(value) {
    const file = resolveResource(value);
    const relative = path.relative(resourceRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !/\.aep$/i.test(file))
      return file;
    const bytes = await fs.promises.readFile(file);
    if (!bytes.includes(Buffer.from('lyricmotion://resources/'))) return file;
    const digest = crypto.createHash('sha256').update(extensionRoot).update(bytes).digest('hex');
    const folder = path.join(temporaryRoot, digest);
    const output = path.join(folder, path.basename(file));
    const localized = rewriteAliases(bytes, (alias) => {
      if (!String(alias.fullpath || '').startsWith('lyricmotion://resources/')) return alias;
      const target = resolveResource(alias.fullpath.slice('lyricmotion://'.length));
      if (!fs.existsSync(target))
        throw new Error('Bundled footage is missing: ' + path.basename(target));
      return { ...alias, fullpath: target, server_name: '', server_volume_name: '' };
    });
    await fs.promises.mkdir(folder, { recursive: true });
    await fs.promises.writeFile(output, localized);
    return output;
  }
  async function prepareProject(project) {
    if (!project.recipe || !Array.isArray(project.recipe.local)) return project;
    const local = [];
    for (const record of project.recipe.local)
      local.push({ ...record, path: await prepare(record.path) });
    return { ...project, recipe: { ...project.recipe, local } };
  }
  return { resolveResource, prepare, prepareProject };
}

module.exports = { createResolver };
