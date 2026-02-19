
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

// Dynamic resource handler for phase plans
// Pattern: gsd://current/phase/{phase_num}/plan
const PHASE_PLAN_PATTERN = /^gsd:\/\/current\/phase\/([^\/]+)\/plan$/;

async function handleDynamicResource(uri, cwd) {
  const match = uri.href.match(PHASE_PLAN_PATTERN);
  if (match) {
    const phaseNum = match[1];
    const phaseInfo = gsd.findPhase(cwd, phaseNum);
    if (!phaseInfo || !phaseInfo.directory) throw new Error(`Phase ${phaseNum} not found`);
    
    // Concatenate all plans for this phase? Or just list them? 
    // The spec said "Specific plan file", but phases have multiple plans.
    // Let's return a summary of plans or the most recent plan content if ambiguous.
    // Better: let's return the content of all PLAN.md files concatenated.
    
    let content = `# Plans for Phase ${phaseNum}

`;
    for (const plan of phaseInfo.plans) {
      const planContent = gsd.safeReadFile(path.join(cwd, phaseInfo.directory, plan));
      content += `## ${plan}

${planContent}

---

`;
    }
    
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  }
  return null;
}

module.exports = { RESOURCES, handleDynamicResource };
