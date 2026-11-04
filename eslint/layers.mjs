/**
 * An ESLint rule that keeps every file in its layer: it may import only from the layers
 * listed for it below, so the path of a click stays easy to follow (see ARCHITECTURE.md).
 *
 *   page:    main -> pages -> features -> api / components -> i18n / utils -> shared
 *   Worker:  entry point -> household Durable Object -> API request router -> operations
 *            -> load-edit-save-and-broadcast -> operation context -> month repository / live update connections -> shared
 *            (the entry point also uses sign-in/)
 *
 * Imports within the same layer are always allowed, except between two different features.
 * Tests (test/) may import anything.
 */
import path from 'node:path';

/**
 * Every layer: which files belong to it (the first match wins) and which layers it may import.
 * `name` is what error messages show; `$1` stands for the folder captured by the pattern.
 */
const LAYERS = [
  { name: 'shared', files: /^shared\//, mayImport: [], packages: ['zod/mini'] },

  // ----- The page (web/scripts) -----
  { name: 'main', files: /^web\/scripts\/main\.ts$/, mayImport: ['pages', 'i18n', 'utils'] },
  {
    name: 'pages',
    files: /^web\/scripts\/pages\//,
    mayImport: ['features/*', 'api', 'components', 'i18n', 'utils', 'shared'],
  },
  {
    name: 'features/$1',
    files: /^web\/scripts\/features\/([^/]+)\//,
    mayImport: ['api', 'components', 'i18n', 'utils', 'shared'],
  },
  { name: 'components', files: /^web\/scripts\/components\//, mayImport: ['i18n', 'utils', 'shared'] },
  { name: 'api', files: /^web\/scripts\/api\//, mayImport: ['utils', 'shared'] },
  { name: 'utils', files: /^web\/scripts\/utils\//, mayImport: ['i18n', 'shared'] },
  { name: 'i18n', files: /^web\/scripts\/i18n\//, mayImport: ['shared'] },

  // ----- The Worker -----
  {
    name: 'worker entry point',
    files: /^worker\/worker-[^/]+$/,
    mayImport: ['household durable object', 'sign-in', 'shared'],
  },
  { name: 'sign-in', files: /^worker\/sign-in\//, mayImport: ['shared'] },
  {
    name: 'household durable object',
    files: /^worker\/household-durable-object\/household-durable-object\.ts$/,
    mayImport: ['api request router', 'month repository', 'live update connections', 'operation context', 'shared'],
  },
  {
    name: 'api request router',
    files: /^worker\/household-durable-object\/api-request-router\.ts$/,
    mayImport: ['operations', 'operation context', 'shared'],
  },
  {
    name: 'operations',
    files: /^worker\/household-durable-object\/operations\//,
    mayImport: ['month edit steps', 'operation context', 'shared'],
  },
  {
    name: 'month edit steps',
    files: /^worker\/household-durable-object\/load-edit-save-and-broadcast-month\.ts$/,
    mayImport: ['operation context', 'shared'],
  },
  {
    name: 'operation context',
    files: /^worker\/household-durable-object\/operation-context\.ts$/,
    mayImport: ['month repository', 'live update connections', 'shared'],
  },
  {
    name: 'month repository',
    files: /^worker\/household-durable-object\/durable-object-month-repository\.ts$/,
    mayImport: ['shared'],
  },
  {
    name: 'live update connections',
    files: /^worker\/household-durable-object\/live-update-connection-manager\.ts$/,
    mayImport: ['shared'],
  },
];

/** The layer of a file, with `$1` filled in; null for files outside every layer (tests, configs). */
function layerOf(relativePath) {
  for (const layer of LAYERS) {
    const match = layer.files.exec(relativePath);
    if (match) return { ...layer, name: layer.name.replace('$1', match[1] ?? '') };
  }
  return null;
}

/** True when a file in `from` may import a file in `to`. */
function mayImport(from, to) {
  if (from.name === to.name) return true;
  return from.mayImport.some((allowed) =>
    allowed.endsWith('/*') ? to.name.startsWith(allowed.slice(0, -1)) : allowed === to.name,
  );
}

const layersRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Each file may import only from the layers allowed for it (eslint/layers.mjs)' },
    schema: [],
    messages: {
      layer: '{{from}} may not import {{to}} ({{target}}). {{from}} may import: {{allowed}}. See ARCHITECTURE.md.',
      package:
        '{{from}} may not import the package "{{target}}"; it runs in the page and the Worker. Allowed: {{allowed}}.',
    },
  },
  create(context) {
    const rootDirectory = context.cwd;
    const fromPath = path.relative(rootDirectory, context.filename).split(path.sep).join('/');
    const from = layerOf(fromPath);
    if (!from) return {};

    function check(node) {
      const target = node.source?.value;
      if (typeof target !== 'string') return;
      if (!target.startsWith('.')) {
        if (from.packages && !from.packages.includes(target)) {
          context.report({
            node,
            messageId: 'package',
            data: { from: from.name, target, allowed: from.packages.join(', ') },
          });
        }
        return;
      }
      const toPath = path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), target));
      const to = layerOf(toPath);
      if (to && !mayImport(from, to)) {
        const allowed = from.mayImport.length > 0 ? from.mayImport.join(', ') : 'only itself';
        context.report({ node, messageId: 'layer', data: { from: from.name, to: to.name, target, allowed } });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

export default { rules: { layers: layersRule } };
