
const path = require('path');
const gsd = require('../../get-shit-done/lib/gsd-core.js');

const RESOURCES = [
  {
    uri: 'gsd://current/state',
    name: 'Project State',
    description: 'The current project state from .planning/STATE.md',
    mimeType: 'text/markdown',
    handler: async (uri, cwd) => {
      const content = gsd.safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
      if (!content) throw new Error('STATE.md not found');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    },
  },
  {
    uri: 'gsd://current/roadmap',
    name: 'Project Roadmap',
    description: 'The high-level project roadmap from .planning/ROADMAP.md',
    mimeType: 'text/markdown',
    handler: async (uri, cwd) => {
      const content = gsd.safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
      if (!content) throw new Error('ROADMAP.md not found');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    },
  },
  {
    uri: 'gsd://current/requirements',
    name: 'Project Requirements',
    description: 'The active requirements from .planning/REQUIREMENTS.md',
    mimeType: 'text/markdown',
    handler: async (uri, cwd) => {
      const content = gsd.safeReadFile(path.join(cwd, '.planning', 'REQUIREMENTS.md'));
      if (!content) throw new Error('REQUIREMENTS.md not found');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    },
  },
  {
    uri: 'gsd://current/config',
    name: 'Project Config',
    description: 'Project configuration from .planning/config.json',
    mimeType: 'application/json',
    handler: async (uri, cwd) => {
      const content = gsd.safeReadFile(path.join(cwd, '.planning', 'config.json'));
      if (!content) throw new Error('config.json not found');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: content,
          },
        ],
      };
    },
  },
];

module.exports = { RESOURCES };
