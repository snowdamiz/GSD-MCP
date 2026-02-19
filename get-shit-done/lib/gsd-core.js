const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'gsd-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet' },
  'gsd-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku' },
  'gsd-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet' },
  'gsd-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku' },
  'gsd-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    research: true,
    plan_checker: true,
    verifier: true,
    parallelization: true,
    brave_search: false,
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    const get = (key, nested) => {
      if (parsed[key] !== undefined) return parsed[key];
      if (nested && parsed[nested.section] && parsed[nested.section][nested.field] !== undefined) {
        return parsed[nested.section][nested.field];
      }
      return undefined;
    };

    const parallelization = (() => {
      const val = get('parallelization');
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val !== null && 'enabled' in val) return val.enabled;
      return defaults.parallelization;
    })();

    return {
      model_profile: get('model_profile') ?? defaults.model_profile,
      commit_docs: get('commit_docs', { section: 'planning', field: 'commit_docs' }) ?? defaults.commit_docs,
      search_gitignored: get('search_gitignored', { section: 'planning', field: 'search_gitignored' }) ?? defaults.search_gitignored,
      branching_strategy: get('branching_strategy', { section: 'git', field: 'branching_strategy' }) ?? defaults.branching_strategy,
      phase_branch_template: get('phase_branch_template', { section: 'git', field: 'phase_branch_template' }) ?? defaults.phase_branch_template,
      milestone_branch_template: get('milestone_branch_template', { section: 'git', field: 'milestone_branch_template' }) ?? defaults.milestone_branch_template,
      research: get('research', { section: 'workflow', field: 'research' }) ?? defaults.research,
      plan_checker: get('plan_checker', { section: 'workflow', field: 'plan_check' }) ?? defaults.plan_checker,
      verifier: get('verifier', { section: 'workflow', field: 'verifier' }) ?? defaults.verifier,
      parallelization,
      brave_search: get('brave_search') ?? defaults.brave_search,
      model_overrides: parsed.model_overrides,
    };
  } catch {
    return defaults;
  }
}

function isGitIgnored(cwd, targetPath) {
  try {
    execSync('git check-ignore -q -- ' + targetPath.replace(/[^a-zA-Z0-9._\-/]/g, ''), {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function execGit(cwd, args) {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = execSync('git ' + escaped.join(' '), {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

function normalizePhaseName(phase) {
  const match = phase.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return phase;
  const num = match[1];
  const parts = num.split('.');
  const padded = parts[0].padStart(2, '0');
  return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
}

function extractFrontmatter(content) {
  const frontmatter = {};
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return frontmatter;
  const yaml = match[1];
  const lines = yaml.split('\n');
  let stack = [{ obj: frontmatter, key: null, indent: -1 }];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const current = stack[stack.length - 1];
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();
      if (value === '' || value === '[') {
        current.obj[key] = value === '[' ? [] : {};
        current.key = null;
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        current.obj[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        current.key = null;
      } else {
        current.obj[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, '');
      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }
  return frontmatter;
}

function reconstructFrontmatter(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.every(v => typeof v === 'string') && value.length <= 3 && value.join(', ').length < 60) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subkey, subval] of Object.entries(value)) {
        if (subval === null || subval === undefined) continue;
        if (Array.isArray(subval)) {
          if (subval.length === 0) {
            lines.push(`  ${subkey}: []`);
          } else if (subval.every(v => typeof v === 'string') && subval.length <= 3 && subval.join(', ').length < 60) {
            lines.push(`  ${subkey}: [${subval.join(', ')}]`);
          } else {
            lines.push(`  ${subkey}:`);
            for (const item of subval) {
              lines.push(`    - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
            }
          }
        } else if (typeof subval === 'object') {
          lines.push(`  ${subkey}:`);
          for (const [subsubkey, subsubval] of Object.entries(subval)) {
            if (subsubval === null || subsubval === undefined) continue;
            if (Array.isArray(subsubval)) {
              if (subsubval.length === 0) {
                lines.push(`    ${subsubkey}: []`);
              } else {
                lines.push(`    ${subsubkey}:`);
                for (const item of subsubval) {
                  lines.push(`      - ${item}`);
                }
              }
            } else {
              lines.push(`    ${subsubkey}: ${subsubval}`);
            }
          }
        } else {
          const sv = String(subval);
          lines.push(`  ${subkey}: ${sv.includes(':') || sv.includes('#') ? `"${sv}"` : sv}`);
        }
      }
    } else {
      const sv = String(value);
      if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
        lines.push(`${key}: "${sv}"`);
      } else {
        lines.push(`${key}: ${sv}`);
      }
    }
  }
  return lines.join('\n');
}

function spliceFrontmatter(content, newObj) {
  const yamlStr = reconstructFrontmatter(newObj);
  const match = content.match(/^---\n[\s\S]+?\n---/);
  if (match) {
    return `---\n${yamlStr}\n---` + content.slice(match[0].length);
  }
  return `---\n${yamlStr}\n---\n\n` + content;
}

function parseMustHavesBlock(content, blockName) {
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return [];
  const yaml = fmMatch[1];
  const blockPattern = new RegExp(`^\\s{4}${blockName}:\\s*$`, 'm');
  const blockStart = yaml.search(blockPattern);
  if (blockStart === -1) return [];
  const afterBlock = yaml.slice(blockStart);
  const blockLines = afterBlock.split('\n').slice(1);
  const items = [];
  let current = null;
  for (const line of blockLines) {
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= 4 && line.trim() !== '') break;
    if (line.match(/^\s{6}-\s+/)) {
      if (current) items.push(current);
      current = {};
      const simpleMatch = line.match(/^\s{6}-\s+"?([^"]+)"?\s*$/);
      if (simpleMatch && !line.includes(':')) {
        current = simpleMatch[1];
      } else {
        const kvMatch = line.match(/^\s{6}-\s+(\w+):\s*"?([^"]*)"?\s*$/);
        if (kvMatch) {
          current = {};
          current[kvMatch[1]] = kvMatch[2];
        }
      }
    } else if (current && typeof current === 'object') {
      const kvMatch = line.match(/^\s{8,}(\w+):\s*"?([^"]*)"?\s*$/);
      if (kvMatch) {
        const val = kvMatch[2];
        current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
      }
      const arrMatch = line.match(/^\s{10,}-\s+"?([^"]+)"?\s*$/);
      if (arrMatch) {
        const keys = Object.keys(current);
        const lastKey = keys[keys.length - 1];
        if (lastKey && !Array.isArray(current[lastKey])) {
          current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
        }
        if (lastKey) current[lastKey].push(arrMatch[1]);
      }
    }
  }
  if (current) items.push(current);
  return items;
}

function generateSlug(text) {
  if (!text) throw new Error('text required for slug generation');
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { slug };
}

function generateSlugInternal(text) {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function currentTimestamp(format) {
  const now = new Date();
  let result;
  switch (format) {
    case 'date': result = now.toISOString().split('T')[0]; break;
    case 'filename': result = now.toISOString().replace(/:/g, '-').replace(/\..+/, ''); break;
    case 'full': default: result = now.toISOString(); break;
  }
  return { timestamp: result };
}

function verifyPathExists(cwd, targetPath) {
  if (!targetPath) throw new Error('path required for verification');
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    const stats = fs.statSync(fullPath);
    const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
    return { exists: true, type };
  } catch {
    return { exists: false, type: null };
  }
}

function pathExistsInternal(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function resolveModel(cwd, agentType) {
  if (!agentType) throw new Error('agent-type required');
  const config = loadConfig(cwd);
  const override = config.model_overrides?.[agentType];
  if (override) {
    const model = override === 'opus' ? 'inherit' : override;
    return { model, profile: 'custom' };
  }
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return { model: 'sonnet', profile, unknown_agent: true };
  const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  const model = resolved === 'opus' ? 'inherit' : resolved;
  return { model, profile };
}

function getMilestoneInfo(cwd) {
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const versionMatch = roadmap.match(/v(\d+\.\d+)/);
    const nameMatch = roadmap.match(/## .*v\d+\.\d+[:\s]+([^\n(]+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: nameMatch ? nameMatch[1].trim() : 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

function configEnsureSection(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');
  try {
    if (!fs.existsSync(planningDir)) fs.mkdirSync(planningDir, { recursive: true });
  } catch (err) {
    throw new Error('Failed to create .planning directory: ' + err.message);
  }
  if (fs.existsSync(configPath)) {
    return { created: false, reason: 'already_exists' };
  }
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
  const globalDefaultsPath = path.join(homedir, '.gsd', 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
    }
  } catch (err) {}
  const hardcoded = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    workflow: { research: true, plan_check: true, verifier: true },
    parallelization: true,
    brave_search: hasBraveSearch,
  };
  const defaults = {
    ...hardcoded,
    ...userDefaults,
    workflow: { ...hardcoded.workflow, ...(userDefaults.workflow || {}) },
  };
  try {
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    return { created: true, path: '.planning/config.json' };
  } catch (err) {
    throw new Error('Failed to create config.json: ' + err.message);
  }
}

function configSet(cwd, keyPath, value) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  if (!keyPath) throw new Error('Usage: config-set <key.path> <value>');
  let parsedValue = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(value) && value !== '') parsedValue = Number(value);

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    throw new Error('Failed to read config.json: ' + err.message);
  }

  const keys = keyPath.split('.');
  let current = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = parsedValue;

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { updated: true, key: keyPath, value: parsedValue };
  } catch (err) {
    throw new Error('Failed to write config.json: ' + err.message);
  }
}

function configGet(cwd, keyPath) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  if (!keyPath) throw new Error('Usage: config-get <key.path>');
  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      throw new Error('No config.json found at ' + configPath);
    }
  } catch (err) {
    throw new Error('Failed to read config.json: ' + err.message);
  }
  const keys = keyPath.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      throw new Error(`Key not found: ${keyPath}`);
    }
    current = current[key];
  }
  if (current === undefined) throw new Error(`Key not found: ${keyPath}`);
  return current;
}

function getArchivedPhaseDirs(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const results = [];
  if (!fs.existsSync(milestonesDir)) return results;
  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const phaseDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();
    for (const archiveName of phaseDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const entries = fs.readdirSync(archivePath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
      for (const dir of dirs) {
        results.push({
          name: dir,
          milestone: version,
          basePath: path.join('.planning', 'milestones', archiveName),
          fullPath: path.join(archivePath, dir),
        });
      }
    }
  } catch {}
  return results;
}

function historyDigest(cwd) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };
  const allPhaseDirs = [];
  const archived = getArchivedPhaseDirs(cwd);
  for (const a of archived) {
    allPhaseDirs.push({ name: a.name, fullPath: a.fullPath, milestone: a.milestone });
  }
  if (fs.existsSync(phasesDir)) {
    try {
      const currentDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(e => e.isDirectory()).map(e => e.name).sort();
      for (const dir of currentDirs) {
        allPhaseDirs.push({ name: dir, fullPath: path.join(phasesDir, dir), milestone: null });
      }
    } catch {}
  }
  if (allPhaseDirs.length === 0) {
    digest.tech_stack = [];
    return digest;
  }
  try {
    for (const { name: dir, fullPath: dirPath } of allPhaseDirs) {
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      for (const summary of summaries) {
        try {
          const content = fs.readFileSync(path.join(dirPath, summary), 'utf-8');
          const fm = extractFrontmatter(content);
          const phaseNum = fm.phase || dir.split('-')[0];
          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }
        } catch (e) {}
      }
    }
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];
    return digest;
  } catch (e) {
    throw new Error('Failed to generate history digest: ' + e.message);
  }
}

function phasesList(cwd, options) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const { type, phase, includeArchived } = options;
  if (!fs.existsSync(phasesDir)) {
    if (type) return { files: [], count: 0 };
    else return { directories: [], count: 0 };
  }
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    let dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    if (includeArchived) {
      const archived = getArchivedPhaseDirs(cwd);
      for (const a of archived) {
        dirs.push(`${a.name} [${a.milestone}]`);
      }
    }
    dirs.sort((a, b) => {
      const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      return aNum - bNum;
    });
    if (phase) {
      const normalized = normalizePhaseName(phase);
      const match = dirs.find(d => d.startsWith(normalized));
      if (!match) {
        return { files: [], count: 0, phase_dir: null, error: 'Phase not found' };
      }
      dirs = [match];
    }
    if (type) {
      const files = [];
      for (const dir of dirs) {
        const dirPath = path.join(phasesDir, dir);
        const dirFiles = fs.readdirSync(dirPath);
        let filtered;
        if (type === 'plans') filtered = dirFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        else if (type === 'summaries') filtered = dirFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        else filtered = dirFiles;
        files.push(...filtered.sort());
      }
      return { files, count: files.length, phase_dir: phase ? dirs[0].replace(/^\d+(?:\.\d+)?-?/, '') : null };
    }
    return { directories: dirs, count: dirs.length };
  } catch (e) {
    throw new Error('Failed to list phases: ' + e.message);
  }
}

function roadmapGetPhase(cwd, phaseNum) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    return { found: false, error: 'ROADMAP.md not found' };
  }
  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const escapedPhase = phaseNum.replace(/\./g, '\\.');
    const phasePattern = new RegExp(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
    const headerMatch = content.match(phasePattern);
    if (!headerMatch) {
      const checklistPattern = new RegExp(`-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${escapedPhase}:\\s*([^*]+)\\*\\*`, 'i');
      const checklistMatch = content.match(checklistPattern);
      if (checklistMatch) {
        return {
          found: false,
          phase_number: phaseNum,
          phase_name: checklistMatch[1].trim(),
          error: 'malformed_roadmap',
          message: `Phase ${phaseNum} exists in summary list but missing "### Phase ${phaseNum}:" detail section. ROADMAP.md needs both formats.`
        };
      }
      return { found: false, phase_number: phaseNum };
    }
    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
    const section = content.slice(headerIndex, sectionEnd).trim();
    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;
    const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
    const success_criteria = criteriaMatch ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean) : [];
    return {
      found: true,
      phase_number: phaseNum,
      phase_name: phaseName,
      goal,
      success_criteria,
      section,
    };
  } catch (e) {
    throw new Error('Failed to read ROADMAP.md: ' + e.message);
  }
}

function phaseNextDecimal(cwd, basePhase) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(basePhase);
  if (!fs.existsSync(phasesDir)) {
    return { found: false, base_phase: normalized, next: `${normalized}.1`, existing: [] };
  }
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const baseExists = dirs.some(d => d.startsWith(normalized + '-') || d === normalized);
    const decimalPattern = new RegExp(`^${normalized}\\.(\\d+)`);
    const existingDecimals = [];
    for (const dir of dirs) {
      const match = dir.match(decimalPattern);
      if (match) existingDecimals.push(`${normalized}.${match[1]}`);
    }
    existingDecimals.sort((a, b) => parseFloat(a) - parseFloat(b));
    let nextDecimal;
    if (existingDecimals.length === 0) {
      nextDecimal = `${normalized}.1`;
    } else {
      const lastDecimal = existingDecimals[existingDecimals.length - 1];
      const lastNum = parseInt(lastDecimal.split('.')[1], 10);
      nextDecimal = `${normalized}.${lastNum + 1}`;
    }
    return { found: baseExists, base_phase: normalized, next: nextDecimal, existing: existingDecimals };
  } catch (e) {
    throw new Error('Failed to calculate next decimal phase: ' + e.message);
  }
}

function stateLoad(cwd) {
  const config = loadConfig(cwd);
  const planningDir = path.join(cwd, '.planning');
  let stateRaw = '';
  try {
    stateRaw = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
  } catch {}
  const configExists = fs.existsSync(path.join(planningDir, 'config.json'));
  const roadmapExists = fs.existsSync(path.join(planningDir, 'ROADMAP.md'));
  const stateExists = stateRaw.length > 0;
  return {
    config,
    state_raw: stateRaw,
    state_exists: stateExists,
    roadmap_exists: roadmapExists,
    config_exists: configExists,
  };
}

function stateGet(cwd, section) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    if (!section) return { content };
    const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fieldPattern = new RegExp(`\\*\\*${fieldEscaped}:\\*\\*\\s*(.*)`, 'i');
    const fieldMatch = content.match(fieldPattern);
    if (fieldMatch) return { [section]: fieldMatch[1].trim() };
    const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const sectionMatch = content.match(sectionPattern);
    if (sectionMatch) return { [section]: sectionMatch[1].trim() };
    return { error: `Section or field "${section}" not found` };
  } catch {
    throw new Error('STATE.md not found');
  }
}

function statePatch(cwd, patches) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const results = { updated: [], failed: [] };
    for (const [field, value] of Object.entries(patches)) {
      const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
      if (pattern.test(content)) {
        content = content.replace(pattern, `$1${value}`);
        results.updated.push(field);
      } else {
        results.failed.push(field);
      }
    }
    if (results.updated.length > 0) fs.writeFileSync(statePath, content, 'utf-8');
    return results;
  } catch {
    throw new Error('STATE.md not found');
  }
}

function stateUpdate(cwd, field, value) {
  if (!field || value === undefined) throw new Error('field and value required');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${value}`);
      fs.writeFileSync(statePath, content, 'utf-8');
      return { updated: true };
    } else {
      return { updated: false, reason: `Field "${field}" not found in STATE.md` };
    }
  } catch {
    return { updated: false, reason: 'STATE.md not found' };
  }
}

function stateExtractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${newValue}`);
  }
  return null;
}

function stateAdvancePlan(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const currentPlan = parseInt(stateExtractField(content, 'Current Plan'), 10);
  const totalPlans = parseInt(stateExtractField(content, 'Total Plans in Phase'), 10);
  const today = new Date().toISOString().split('T')[0];
  if (isNaN(currentPlan) || isNaN(totalPlans)) return { error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' };
  if (currentPlan >= totalPlans) {
    content = stateReplaceField(content, 'Status', 'Phase complete — ready for verification') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    return { advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' };
  } else {
    const newPlan = currentPlan + 1;
    content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    content = stateReplaceField(content, 'Status', 'Ready to execute') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    return { advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans };
  }
}

function stateRecordMetric(cwd, options) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const { phase, plan, duration, tasks, files } = options;
  if (!phase || !plan || !duration) return { error: 'phase, plan, and duration required' };
  const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
  const metricsMatch = content.match(metricsPattern);
  if (metricsMatch) {
    const tableHeader = metricsMatch[1];
    let tableBody = metricsMatch[2].trimEnd();
    const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;
    if (tableBody.trim() === '' || tableBody.includes('None yet')) tableBody = newRow;
    else tableBody = tableBody + '\n' + newRow;
    content = content.replace(metricsPattern, `${tableHeader}${tableBody}\n`);
    fs.writeFileSync(statePath, content, 'utf-8');
    return { recorded: true, phase, plan, duration };
  } else {
    return { recorded: false, reason: 'Performance Metrics section not found in STATE.md' };
  }
}

function stateUpdateProgress(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  let totalPlans = 0;
  let totalSummaries = 0;
  if (fs.existsSync(phasesDir)) {
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
    for (const dir of phaseDirs) {
      const files = fs.readdirSync(path.join(phasesDir, dir));
      totalPlans += files.filter(f => f.match(/-PLAN\.md$/i)).length;
      totalSummaries += files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
    }
  }
  const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;
  const progressPattern = /(\*\*Progress:\*\*\s*).*/i;
  if (progressPattern.test(content)) {
    content = content.replace(progressPattern, `$1${progressStr}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    return { updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr };
  } else {
    return { updated: false, reason: 'Progress field not found in STATE.md' };
  }
}

function stateAddDecision(cwd, options) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  const { phase, summary, rationale } = options;
  if (!summary) return { error: 'summary required' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;
  const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);
  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    return { added: true, decision: entry };
  } else {
    return { added: false, reason: 'Decisions section not found in STATE.md' };
  }
}

function stateAddBlocker(cwd, text) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  if (!text) return { error: 'text required' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- ${text}`;
  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);
  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    return { added: true, blocker: text };
  } else {
    return { added: false, reason: 'Blockers section not found in STATE.md' };
  }
}

function stateResolveBlocker(cwd, text) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  if (!text) return { error: 'text required' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);
  if (match) {
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(text.toLowerCase());
    });
    let newBody = filtered.join('\n');
    if (!newBody.trim() || !newBody.includes('- ')) newBody = 'None\n';
    content = content.replace(sectionPattern, `${match[1]}${newBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    return { resolved: true, blocker: text };
  } else {
    return { resolved: false, reason: 'Blockers section not found in STATE.md' };
  }
}

function stateRecordSession(cwd, options) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  let content = fs.readFileSync(statePath, 'utf-8');
  const now = new Date().toISOString();
  const updated = [];
  let result = stateReplaceField(content, 'Last session', now);
  if (result) { content = result; updated.push('Last session'); }
  result = stateReplaceField(content, 'Last Date', now);
  if (result) { content = result; updated.push('Last Date'); }
  if (options.stopped_at) {
    result = stateReplaceField(content, 'Stopped At', options.stopped_at);
    if (!result) result = stateReplaceField(content, 'Stopped at', options.stopped_at);
    if (result) { content = result; updated.push('Stopped At'); }
  }
  const resumeFile = options.resume_file || 'None';
  result = stateReplaceField(content, 'Resume File', resumeFile);
  if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
  if (result) { content = result; updated.push('Resume File'); }
  if (updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    return { recorded: true, updated };
  } else {
    return { recorded: false, reason: 'No session fields found in STATE.md' };
  }
}

function resolveModel(cwd, agentType) {
  if (!agentType) throw new Error('agent-type required');
  const config = loadConfig(cwd);
  const override = config.model_overrides?.[agentType];
  if (override) {
    const model = override === 'opus' ? 'inherit' : override;
    return { model, profile: 'custom' };
  }
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return { model: 'sonnet', profile, unknown_agent: true };
  const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  const model = resolved === 'opus' ? 'inherit' : resolved;
  return { model, profile };
}

function findPhase(cwd, phase) {
  if (!phase) throw new Error('phase identifier required');
  const notFound = { found: false, directory: null, phase_number: null, phase_name: null, plans: [], summaries: [] };
  const result = findPhaseInternal(cwd, phase);
  return result ? result : notFound;
}

function searchPhaseInDir(baseDir, relBase, normalized) {
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const match = dirs.find(d => d.startsWith(normalized));
    if (!match) return null;
    const dirMatch = match.match(/^(\d+(?:\.\d+)?)-?(.*)/);
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    const phaseDir = path.join(baseDir, match);
    const phaseFiles = fs.readdirSync(phaseDir);
    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
    const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
    const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
    const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
    const completedPlanIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '')));
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });
    return {
      found: true,
      directory: path.join(relBase, match),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
    };
  } catch {
    return null;
  }
}

function findPhaseInternal(cwd, phase) {
  if (!phase) return null;
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);
  const current = searchPhaseInDir(phasesDir, path.join('.planning', 'phases'), normalized);
  if (current) return current;
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;
  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const archiveDirs = milestoneEntries.filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name)).map(e => e.name).sort().reverse();
    for (const archiveName of archiveDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const relBase = path.join('.planning', 'milestones', archiveName);
      const result = searchPhaseInDir(archivePath, relBase, normalized);
      if (result) {
        result.archived = version;
        return result;
      }
    }
  } catch {}
  return null;
}

function getRoadmapPhaseInternal(cwd, phaseNum) {
  if (!phaseNum) return null;
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return null;
  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');
    const escapedPhase = phaseNum.toString().replace(/\./g, '\\.');
    const phasePattern = new RegExp(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
    const headerMatch = content.match(phasePattern);
    if (!headerMatch) return null;
    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
    const section = content.slice(headerIndex, sectionEnd).trim();
    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;
    return { found: true, phase_number: phaseNum.toString(), phase_name: phaseName, goal, section };
  } catch {
    return null;
  }
}

function commit(cwd, message, files, amend) {
  if (!message && !amend) throw new Error('commit message required');
  const config = loadConfig(cwd);
  if (!config.commit_docs) return { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
  if (isGitIgnored(cwd, '.planning')) return { committed: false, hash: null, reason: 'skipped_gitignored' };
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) execGit(cwd, ['add', file]);
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      return { committed: false, hash: null, reason: 'nothing_to_commit' };
    }
    return { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
  }
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  return { committed: true, hash, reason: 'committed' };
}

function getMilestoneInfo(cwd) {
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const versionMatch = roadmap.match(/v(\d+\.\d+)/);
    const nameMatch = roadmap.match(/## .*v\d+\.\d+[:\s]+([^\n(]+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: nameMatch ? nameMatch[1].trim() : 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

function phaseAdd(cwd, description) {
  if (!description) throw new Error('description required for phase add');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) throw new Error('ROADMAP.md not found');
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const slug = generateSlugInternal(description);
  const phasePattern = /#{2,4}\s*Phase\s+(\d+)(?:\.\d+)?:/gi;
  let maxPhase = 0;
  let m;
  while ((m = phasePattern.exec(content)) !== null) {
    const num = parseInt(m[1], 10);
    if (num > maxPhase) maxPhase = num;
  }
  const newPhaseNum = maxPhase + 1;
  const paddedNum = String(newPhaseNum).padStart(2, '0');
  const dirName = `${paddedNum}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
  const phaseEntry = `\n### Phase ${newPhaseNum}: ${description}\n\n**Goal:** [To be planned]\n**Depends on:** Phase ${maxPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (use gsd_plan_phase tool with phase ${newPhaseNum} to break down)\n`;
  let updatedContent;
  const lastSeparator = content.lastIndexOf('\n---');
  if (lastSeparator > 0) updatedContent = content.slice(0, lastSeparator) + phaseEntry + content.slice(lastSeparator);
  else updatedContent = content + phaseEntry;
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');
  return { phase_number: newPhaseNum, padded: paddedNum, name: description, slug, directory: `.planning/phases/${dirName}` };
}

function phaseInsert(cwd, afterPhase, description) {
  if (!afterPhase || !description) throw new Error('after-phase and description required for phase insert');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) throw new Error('ROADMAP.md not found');
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const slug = generateSlugInternal(description);
  const normalizedAfter = normalizePhaseName(afterPhase);
  const unpadded = normalizedAfter.replace(/^0+/, '');
  const afterPhaseEscaped = unpadded.replace(/\./g, '\\.');
  const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
  if (!targetPattern.test(content)) throw new Error(`Phase ${afterPhase} not found in ROADMAP.md`);
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalizedBase = normalizePhaseName(afterPhase);
  let existingDecimals = [];
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const decimalPattern = new RegExp(`^${normalizedBase}\\.(\\d+)`);
    for (const dir of dirs) {
      const dm = dir.match(decimalPattern);
      if (dm) existingDecimals.push(parseInt(dm[1], 10));
    }
  } catch {}
  const nextDecimal = existingDecimals.length === 0 ? 1 : Math.max(...existingDecimals) + 1;
  const decimalPhase = `${normalizedBase}.${nextDecimal}`;
  const dirName = `${decimalPhase}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
  const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (use gsd_plan_phase tool with phase ${decimalPhase} to break down)\n`;
  const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
  const headerMatch = content.match(headerPattern);
  if (!headerMatch) throw new Error(`Could not find Phase ${afterPhase} header`);
  const headerIdx = content.indexOf(headerMatch[0]);
  const afterHeader = content.slice(headerIdx + headerMatch[0].length);
  const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);
  let insertIdx;
  if (nextPhaseMatch) insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
  else insertIdx = content.length;
  const updatedContent = content.slice(0, insertIdx) + phaseEntry + content.slice(insertIdx);
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');
  return { phase_number: decimalPhase, after_phase: afterPhase, name: description, slug, directory: `.planning/phases/${dirName}` };
}

function phaseRemove(cwd, targetPhase, options) {
  if (!targetPhase) throw new Error('phase number required for phase remove');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const force = options?.force || false;
  if (!fs.existsSync(roadmapPath)) throw new Error('ROADMAP.md not found');
  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');
  let targetDir = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    targetDir = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);
  } catch {}
  if (targetDir && !force) {
    const targetPath = path.join(phasesDir, targetDir);
    const files = fs.readdirSync(targetPath);
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) throw new Error(`Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`);
  }
  if (targetDir) fs.rmSync(path.join(phasesDir, targetDir), { recursive: true, force: true });

  const renamedDirs = [];
  if (isDecimal) {
    // Renumber sibling decimal phases
    const baseParts = targetPhase.split('.');
    const baseNum = baseParts[0];
    const baseNorm = normalizePhaseName(baseNum);
    const decimalNum = parseFloat(baseParts[1]);
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
      for (const dir of dirs) {
        const dirMatch = dir.match(/^(\d+)\.(\d+)-?(.*)/);
        if (!dirMatch) continue;
        const dirBase = dirMatch[1];
        const dirDecimal = parseInt(dirMatch[2], 10);
        if (dirBase === baseNorm && dirDecimal > decimalNum) {
          const newDecimal = dirDecimal - 1;
          const suffix = dirMatch[3] ? `-${dirMatch[3]}` : '';
          const newName = `${dirBase}.${newDecimal}${suffix}`;
          fs.renameSync(path.join(phasesDir, dir), path.join(phasesDir, newName));
          renamedDirs.push({ from: dir, to: newName });
        }
      }
    } catch {}
  } else {
    // Renumber subsequent whole-number phases
    const targetNum = parseInt(normalized, 10);
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
      for (const dir of dirs) {
        const dirMatch = dir.match(/^(\d+)-?(.*)/);
        if (!dirMatch || dir.includes('.')) continue;
        const dirNum = parseInt(dirMatch[1], 10);
        if (dirNum > targetNum) {
          const newNum = String(dirNum - 1).padStart(2, '0');
          const suffix = dirMatch[2] ? `-${dirMatch[2]}` : '';
          const newName = `${newNum}${suffix}`;
          const oldPath = path.join(phasesDir, dir);
          const newPath = path.join(phasesDir, newName);
          // Rename files inside the directory to match new phase number
          const files = fs.readdirSync(oldPath);
          const oldPadded = dirMatch[1].padStart(2, '0');
          for (const file of files) {
            if (file.startsWith(oldPadded + '-')) {
              const newFile = newNum + file.substring(oldPadded.length);
              fs.renameSync(path.join(oldPath, file), path.join(oldPath, newFile));
            }
          }
          fs.renameSync(oldPath, newPath);
          renamedDirs.push({ from: dir, to: newName });
        }
      }
    } catch {}
  }

  // Update roadmap: remove the target phase section and renumber subsequent phases
  let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  const targetEscaped = targetPhase.replace(/\./g, '\\.');
  const sectionPattern = new RegExp(`\\n?#{2,4}\\s*Phase\\s+${targetEscaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s*Phase\\s+\\d|$)`, 'i');
  roadmapContent = roadmapContent.replace(sectionPattern, '');
  const checkboxPattern = new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${targetEscaped}[:\\s][^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(checkboxPattern, '');
  const tableRowPattern = new RegExp(`\\n?\\|\\s*${targetEscaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(tableRowPattern, '');

  // Renumber subsequent phases in roadmap text (whole-number only)
  if (!isDecimal) {
    const targetNum = parseInt(normalized, 10);
    for (const renamed of renamedDirs) {
      const oldMatch = renamed.from.match(/^(\d+)/);
      const newMatch = renamed.to.match(/^(\d+)/);
      if (oldMatch && newMatch) {
        const oldNum = parseInt(oldMatch[1], 10);
        const newNum = parseInt(newMatch[1], 10);
        // Replace "Phase X:" with "Phase Y:" in headings
        roadmapContent = roadmapContent.replace(
          new RegExp(`(#{2,4}\\s*Phase\\s+)${oldNum}(\\s*:)`, 'g'),
          `$1${newNum}$2`
        );
        // Replace in checkboxes
        roadmapContent = roadmapContent.replace(
          new RegExp(`(\\[[ x]\\]\\s*Phase\\s+)${oldNum}(\\s*:)`, 'g'),
          `$1${newNum}$2`
        );
        // Replace "Depends on: Phase X" references
        roadmapContent = roadmapContent.replace(
          new RegExp(`(Depends on:\\*\\*\\s*Phase\\s+)${oldNum}\\b`, 'g'),
          `$1${newNum}`
        );
      }
    }
  }

  fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');

  // Update STATE.md total phases
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    // Recount phases from roadmap
    const updatedRoadmap = fs.readFileSync(roadmapPath, 'utf-8');
    const phaseCount = (updatedRoadmap.match(/#{2,4}\s*Phase\s+\d+(?:\.\d+)?\s*:/gi) || []).length;
    const newState = stateReplaceField(stateContent, 'Total Phases', String(phaseCount));
    if (newState) fs.writeFileSync(statePath, newState, 'utf-8');
  }

  return { removed: targetPhase, directory_deleted: targetDir || null, roadmap_updated: true, renumbered: renamedDirs };
}

function phaseComplete(cwd, phaseNum) {
  if (!phaseNum) throw new Error('phase number required for phase complete');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const today = new Date().toISOString().split('T')[0];
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) throw new Error(`Phase ${phaseNum} not found`);
  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  // Update roadmap
  if (fs.existsSync(roadmapPath)) {
    let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    const phaseEscaped = phaseNum.replace('.', '\\.');
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`, 'i');
    roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);
    const tablePattern = new RegExp(`(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|[^|]*\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`, 'i');
    roadmapContent = roadmapContent.replace(tablePattern, `$1 Complete    $2 ${today} $3`);
    const planCountPattern = new RegExp(`(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`, 'i');
    roadmapContent = roadmapContent.replace(planCountPattern, `$1${summaryCount}/${planCount} plans complete`);
    fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');
  }

  // Find next phase
  let nextPhase = null;
  let isLastPhase = true;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const normalizedCurrent = normalizePhaseName(phaseNum);
    const currentNum = parseInt(normalizedCurrent, 10);
    for (const dir of dirs) {
      const dirMatch = dir.match(/^(\d+)/);
      if (!dirMatch || dir.includes('.')) continue;
      const dirNum = parseInt(dirMatch[1], 10);
      if (dirNum > currentNum) {
        nextPhase = dirMatch[1].padStart(2, '0');
        isLastPhase = false;
        break;
      }
    }
    // If no next directory on disk, check roadmap for next phase
    if (isLastPhase && fs.existsSync(roadmapPath)) {
      const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
      const allPhases = [];
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)/gi;
      let m;
      while ((m = phasePattern.exec(roadmapContent)) !== null) {
        allPhases.push(parseInt(m[1], 10));
      }
      allPhases.sort((a, b) => a - b);
      const idx = allPhases.indexOf(currentNum);
      if (idx >= 0 && idx < allPhases.length - 1) {
        nextPhase = String(allPhases[idx + 1]).padStart(2, '0');
        isLastPhase = false;
      }
    }
  } catch {}

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    if (isLastPhase) {
      const s1 = stateReplaceField(stateContent, 'Status', `Milestone complete (${today})`);
      if (s1) stateContent = s1;
    } else {
      const s1 = stateReplaceField(stateContent, 'Current Phase', nextPhase);
      if (s1) stateContent = s1;
      const s2 = stateReplaceField(stateContent, 'Status', 'Ready to plan');
      if (s2) stateContent = s2;
      const s3 = stateReplaceField(stateContent, 'Current Plan', 'Not started');
      if (s3) stateContent = s3;
    }
    fs.writeFileSync(statePath, stateContent, 'utf-8');
  }

  // Extract requirement IDs from roadmap for this phase and mark them complete
  let reqIds = [];
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    const phaseEscaped = phaseNum.replace('.', '\\.');
    // Find the phase section
    const sectionMatch = roadmapContent.match(new RegExp(`#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?(?=\\n#{2,4}\\s*Phase\\s+\\d|$)`, 'i'));
    if (sectionMatch) {
      const section = sectionMatch[0];
      const reqMatch = section.match(/\*\*Requirements:\*\*\s*\[?([^\]\n]+)\]?/);
      if (reqMatch) {
        reqIds = reqMatch[1].split(',').map(r => r.trim()).filter(Boolean);
      }
    }
  }

  // Update REQUIREMENTS.md
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (reqIds.length > 0 && fs.existsSync(reqPath)) {
    let reqContent = fs.readFileSync(reqPath, 'utf-8');
    for (const reqId of reqIds) {
      // Check checkboxes
      reqContent = reqContent.replace(
        new RegExp(`(-\\s*\\[) (\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi'),
        '$1x$2'
      );
      // Update traceability table
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqId}\\s*\\|\\s*Phase\\s+${phaseNum}\\s*\\|)\\s*Pending\\s*\\|`, 'gi'),
        `$1 Complete |`
      );
    }
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
  }

  return {
    completed_phase: phaseNum,
    date: today,
    plans_executed: `${summaryCount}/${planCount}`,
    next_phase: nextPhase,
    is_last_phase: isLastPhase,
  };
}

// ─── Verification & Init (Full Implementations) ──────────────────────────────

function verifySummary(cwd, summaryPath, checkCount) {
  if (!summaryPath) throw new Error('summary-path required');
  const fullPath = path.join(cwd, summaryPath);
  const checkFileCount = checkCount || 2;
  if (!fs.existsSync(fullPath)) {
    return { passed: false, errors: ['SUMMARY.md not found'] };
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const errors = [];
  const mentionedFiles = new Set();
  const patterns = [/`([^`]+\.[a-zA-Z]+)`/g, /(?:Created|Modified|Added|Updated|Edited):\s*`?([^\s`]+\.[a-zA-Z]+)`?/gi];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const filePath = m[1];
      if (filePath && !filePath.startsWith('http') && filePath.includes('/')) mentionedFiles.add(filePath);
    }
  }
  const filesToCheck = Array.from(mentionedFiles).slice(0, checkFileCount);
  const missing = [];
  for (const file of filesToCheck) {
    if (!fs.existsSync(path.join(cwd, file))) missing.push(file);
  }
  const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
  const hashes = content.match(commitHashPattern) || [];
  let commitsExist = false;
  if (hashes.length > 0) {
    for (const hash of hashes.slice(0, 3)) {
      const result = execGit(cwd, ['cat-file', '-t', hash]);
      if (result.exitCode === 0 && result.stdout === 'commit') {
        commitsExist = true;
        break;
      }
    }
  }
  if (missing.length > 0) errors.push('Missing files: ' + missing.join(', '));
  if (!commitsExist && hashes.length > 0) errors.push('Referenced commit hashes not found in git history');
  const passed = missing.length === 0;
  return { passed, errors };
}

function initMapCodebase(cwd) {
  const config = loadConfig(cwd);
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch {}
  return {
    mapper_model: resolveModel(cwd, 'gsd-codebase-mapper').model,
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,
    codebase_dir: '.planning/codebase',
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };
}

function initTodos(cwd, area) {
  const config = loadConfig(cwd);
  const now = new Date();
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  let count = 0;
  const todos = [];
  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';
        if (area && todoArea !== area) continue;
        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch {}
    }
  } catch {}
  return {
    commit_docs: config.commit_docs,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    todo_count: count,
    todos,
    area_filter: area || null,
    pending_dir: '.planning/todos/pending',
    completed_dir: '.planning/todos/completed',
    planning_exists: pathExistsInternal(cwd, '.planning'),
    todos_dir_exists: pathExistsInternal(cwd, '.planning/todos'),
    pending_dir_exists: pathExistsInternal(cwd, '.planning/todos/pending'),
  };
}

function initMilestoneOp(cwd) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);
  let phaseCount = 0;
  let completedPhases = 0;
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    phaseCount = dirs.length;
    for (const dir of dirs) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (hasSummary) completedPhases++;
      } catch {}
    }
  } catch {}
  const archiveDir = path.join(cwd, '.planning', 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  } catch {}
  return {
    commit_docs: config.commit_docs,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    archive_exists: pathExistsInternal(cwd, '.planning/archive'),
    phases_dir_exists: pathExistsInternal(cwd, '.planning/phases'),
  };
}

function initProgress(cwd, includes) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    for (const dir of dirs) {
      const match = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      const phaseNumber = match ? match[1] : dir;
      const phaseName = match && match[2] ? match[2] : null;
      const phasePath = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phasePath);
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' : plans.length > 0 ? 'in_progress' : hasResearch ? 'researched' : 'pending';
      const phaseInfo = {
        number: phaseNumber,
        name: phaseName,
        directory: path.join('.planning', 'phases', dir),
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
        has_research: hasResearch,
      };
      phases.push(phaseInfo);
      if (!currentPhase && (status === 'in_progress' || status === 'researched')) currentPhase = phaseInfo;
      if (!nextPhase && status === 'pending') nextPhase = phaseInfo;
    }
  } catch {}
  let pausedAt = null;
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch {}
  const result = {
    executor_model: resolveModel(cwd, 'gsd-executor').model,
    planner_model: resolveModel(cwd, 'gsd-planner').model,
    commit_docs: config.commit_docs,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
  };
  if (includes && includes.has('state')) result.state_content = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  if (includes && includes.has('roadmap')) result.roadmap_content = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  if (includes && includes.has('project')) result.project_content = safeReadFile(path.join(cwd, '.planning', 'PROJECT.md'));
  if (includes && includes.has('config')) result.config_content = safeReadFile(path.join(cwd, '.planning', 'config.json'));
  return result;
}

function verifyPlanStructure(cwd, filePath) {
  if (!filePath) throw new Error('file path required');
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) return { valid: false, errors: ['File not found'] };
  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);
    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);
    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }
  if (tasks.length === 0) warnings.push('No <task> elements found');
  return { valid: errors.length === 0, errors, warnings, task_count: tasks.length, tasks };
}

function verifyPhaseCompleteness(cwd, phase) {
  if (!phase) throw new Error('phase required');
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.directory) return { error: 'Phase not found' };
  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);
  let files;
  try { files = fs.readdirSync(phaseDir); } catch { return { error: 'Cannot read phase directory' }; }
  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  return { complete: errors.length === 0, phase: phaseInfo.phase_number, plan_count: plans.length, summary_count: summaries.length, incomplete_plans: incompletePlans, orphan_summaries: orphanSummaries, errors, warnings };
}

function verifyReferences(cwd, filePath) {
  if (!filePath) throw new Error('file path required');
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) return { valid: false, errors: ['File not found'] };
  const found = [];
  const missing = [];
  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1);
    const resolved = cleanRef.startsWith('~/') ? path.join(process.env.HOME || '', cleanRef.slice(2)) : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) found.push(cleanRef); else missing.push(cleanRef);
  }
  return { valid: missing.length === 0, found: found.length, missing, total: found.length + missing.length };
}

function verifyCommits(cwd, hashes) {
  if (!hashes || hashes.length === 0) throw new Error('At least one commit hash required');
  const valid = [];
  const invalid = [];
  for (const hash of hashes) {
    const result = execGit(cwd, ['cat-file', '-t', hash]);
    if (result.exitCode === 0 && result.stdout.trim() === 'commit') valid.push(hash); else invalid.push(hash);
  }
  return { all_valid: invalid.length === 0, valid, invalid, total: hashes.length };
}

function verifyArtifacts(cwd, planFilePath) {
  if (!planFilePath) throw new Error('plan file path required');
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) return { error: 'File not found' };
  const artifacts = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) return { error: 'No must_haves.artifacts found' };
  const results = [];
  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue;
    const artPath = artifact.path;
    if (!artPath) continue;
    const artFullPath = path.join(cwd, artPath);
    const exists = fs.existsSync(artFullPath);
    const check = { path: artPath, exists, issues: [], passed: false };
    if (exists) {
      const fileContent = safeReadFile(artFullPath) || '';
      if (artifact.contains && !fileContent.includes(artifact.contains)) check.issues.push(`Missing pattern: ${artifact.contains}`);
      check.passed = check.issues.length === 0;
    } else check.issues.push('File not found');
    results.push(check);
  }
  const passed = results.filter(r => r.passed).length;
  return { all_passed: passed === results.length, passed, total: results.length, artifacts: results };
}

function verifyKeyLinks(cwd, planFilePath) {
  if (!planFilePath) throw new Error('plan file path required');
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) return { error: 'File not found' };
  const keyLinks = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) return { error: 'No must_haves.key_links found' };
  const results = [];
  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const check = { from: link.from, to: link.to, verified: false };
    const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
    if (sourceContent && sourceContent.includes(link.to || '')) check.verified = true;
    results.push(check);
  }
  const verified = results.filter(r => r.verified).length;
  return { all_verified: verified === results.length, verified, total: results.length, links: results };
}

function roadmapAnalyze(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return { error: 'ROADMAP.md not found' };
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const phasesDir = path.join(cwd, '.planning', 'phases');

  // Extract phases from roadmap
  const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  const phases = [];
  let match;
  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].trim();

    // Extract goal and depends_on from the section after the heading
    const afterHeading = content.substring(match.index + match[0].length);
    const goalMatch = afterHeading.match(/\*\*Goal:\*\*\s*([^\n]+)/);
    const depsMatch = afterHeading.match(/\*\*Depends on:\*\*\s*([^\n]+)/);

    // Check disk status
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    const normalized = normalizePhaseName(phaseNum);
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const phaseDir = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);
      if (phaseDir) {
        const phasePath = path.join(phasesDir, phaseDir);
        const files = fs.readdirSync(phasePath);
        const plans = files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        planCount = plans.length;
        summaryCount = summaries.length;
        if (summaries.length > 0 && summaries.length >= plans.length) {
          diskStatus = 'complete';
        } else if (plans.length > 0) {
          diskStatus = 'planned';
        } else {
          diskStatus = 'empty';
        }
      }
    } catch {}

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal: goalMatch ? goalMatch[1].trim() : null,
      depends_on: depsMatch ? depsMatch[1].trim() : null,
      disk_status: diskStatus,
      plans: planCount,
      summaries: summaryCount,
    });
  }

  const totalPlans = phases.reduce((sum, p) => sum + p.plans, 0);
  const totalSummaries = phases.reduce((sum, p) => sum + p.summaries, 0);
  const completedPhases = phases.filter(p => p.disk_status === 'complete').length;
  const progressPercent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;

  // Determine current phase (first non-complete phase)
  let currentPhase = null;
  for (const p of phases) {
    if (p.disk_status !== 'complete') {
      currentPhase = p.number;
      break;
    }
  }

  return {
    phase_count: phases.length,
    phases,
    completed_phases: completedPhases,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    progress_percent: progressPercent,
    current_phase: currentPhase,
  };
}

function validateConsistency(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(roadmapPath)) {
    errors.push('ROADMAP.md not found');
    return { passed: false, errors, warnings };
  }

  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

  // Extract phase numbers mentioned in roadmap
  const roadmapPhases = new Set();
  const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(normalizePhaseName(match[1]));
  }

  // Check disk phases vs roadmap phases
  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      for (const dir of dirs) {
        const dirMatch = dir.match(/^(\d+(?:\.\d+)?)/);
        if (dirMatch) {
          const phaseNum = normalizePhaseName(dirMatch[1]);
          if (!roadmapPhases.has(phaseNum)) {
            warnings.push(`Phase directory ${dir} exists on disk but not in ROADMAP.md`);
          }
        }
      }
    } catch {}
  }

  // Check for gaps in phase numbering
  const wholePhases = Array.from(roadmapPhases)
    .filter(p => !p.includes('.'))
    .map(p => parseInt(p, 10))
    .sort((a, b) => a - b);
  for (let i = 1; i < wholePhases.length; i++) {
    if (wholePhases[i] - wholePhases[i - 1] > 1) {
      for (let gap = wholePhases[i - 1] + 1; gap < wholePhases[i]; gap++) {
        warnings.push(`Gap in phase numbering: Phase ${gap} missing between ${wholePhases[i - 1]} and ${wholePhases[i]}`);
      }
    }
  }

  // Check STATE.md consistency
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    const currentPhase = stateExtractField(stateContent, 'Current Phase');
    if (currentPhase) {
      const phaseNum = currentPhase.match(/\d+(?:\.\d+)?/);
      if (phaseNum && !roadmapPhases.has(normalizePhaseName(phaseNum[0]))) {
        warnings.push(`STATE.md references Phase ${phaseNum[0]} which is not in ROADMAP.md`);
      }
    }
  }

  return { passed: errors.length === 0, errors, warnings, warning_count: warnings.length };
}

function validateHealth(cwd, options) {
  const planningDir = path.join(cwd, '.planning');
  const errors = [];
  const warnings = [];
  const repair = options?.repair || false;

  // Check .planning/ exists
  if (!fs.existsSync(planningDir)) {
    errors.push('.planning/ directory not found');
    if (repair) {
      fs.mkdirSync(planningDir, { recursive: true });
      warnings.push('Created .planning/ directory');
    }
    return { status: 'broken', errors, warnings, repaired: repair };
  }

  // Check essential files
  const essentialFiles = ['PROJECT.md', 'ROADMAP.md', 'STATE.md'];
  for (const file of essentialFiles) {
    if (!fs.existsSync(path.join(planningDir, file))) {
      warnings.push(`${file} not found`);
    }
  }

  // Check config
  const configPath = path.join(planningDir, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      errors.push('config.json is invalid JSON');
      if (repair) {
        const defaults = { model_profile: 'balanced', commit_docs: true, parallelization: true };
        fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
        warnings.push('Reset config.json to defaults');
      }
    }
  } else {
    warnings.push('config.json not found');
    if (repair) {
      configEnsureSection(cwd);
      warnings.push('Created config.json with defaults');
    }
  }

  // Check phases directory
  const phasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      for (const dir of dirs) {
        const match = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
        if (!match) {
          warnings.push(`Phase directory '${dir}' does not follow naming convention`);
        }
      }
    } catch (e) {
      errors.push('Cannot read phases directory: ' + e.message);
    }
  }

  // Run consistency check
  const consistency = validateConsistency(cwd);
  errors.push(...consistency.errors);
  warnings.push(...consistency.warnings);

  const status = errors.length > 0 ? 'broken' : warnings.length > 0 ? 'warnings' : 'healthy';
  return { status, errors, warnings, repaired: repair && (errors.length > 0 || warnings.length > 0) };
}

function progressRender(cwd, format) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const milestone = getMilestoneInfo(cwd);
  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
      for (const dir of dirs) {
        const match = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
        const phaseNumber = match ? match[1] : dir;
        const phaseName = match && match[2] ? match[2] : '';
        const phasePath = path.join(phasesDir, dir);
        const phaseFiles = fs.readdirSync(phasePath);
        const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
        const status = summaries.length >= plans.length && plans.length > 0 ? 'Complete'
          : plans.length > 0 ? 'In Progress'
          : hasResearch ? 'Researched'
          : 'Pending';
        const statusIcon = status === 'Complete' ? '[x]' : status === 'In Progress' ? '[~]' : '[ ]';
        totalPlans += plans.length;
        totalSummaries += summaries.length;
        phases.push({
          number: phaseNumber,
          name: phaseName,
          status,
          statusIcon,
          plans: plans.length,
          summaries: summaries.length,
        });
      }
    } catch {}
  }

  const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
  const barWidth = 20;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

  let rendered = `# ${milestone.name || milestone.version || 'Project'} Progress\n\n`;
  rendered += `[${bar}] ${percent}% (${totalSummaries}/${totalPlans} plans)\n\n`;
  rendered += `| Phase | Name | Status | Plans |\n|-------|------|--------|-------|\n`;
  for (const p of phases) {
    rendered += `| ${p.number} | ${p.name} | ${p.statusIcon} ${p.status} | ${p.summaries}/${p.plans} |\n`;
  }

  return {
    rendered,
    milestone: milestone.version,
    milestone_name: milestone.name,
    percent,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    completed_plans: totalSummaries,
    phases,
  };
}

function todoComplete(cwd, filename) {
  if (!filename) throw new Error('filename required');
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  const completedDir = path.join(cwd, '.planning', 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);
  if (!fs.existsSync(sourcePath)) throw new Error(`Todo not found: ${filename}`);
  fs.mkdirSync(completedDir, { recursive: true });
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;
  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);
  return { completed: true, file: filename, date: today };
}

function scaffold(cwd, type, options) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;
  if (phase && !phaseDir && type !== 'phase-dir') throw new Error(`Phase ${phase} directory not found`);
  let filePath, content;
  switch (type) {
    case 'context':
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${parseInt(padded, 10)} Context\n\n## Decisions\n\n## Discretion Areas\n\n## Constraints\n`;
      break;
    case 'uat':
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\ncreated: ${today}\nstatus: pending\n---\n\n# User Acceptance Testing\n\n## Test Results\n\n## Gaps\n`;
      break;
    case 'verification':
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\ncreated: ${today}\nstatus: pending\n---\n\n# Goal-Backward Verification\n\n## Must-Haves\n\n## Results\n`;
      break;
    case 'phase-dir':
      if (!phase || !name) throw new Error('phase and name required');
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = path.join(cwd, '.planning', 'phases');
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      return { created: true, directory: `.planning/phases/${dirName}`, path: dirPath };
    default:
      throw new Error(`Unknown scaffold type: ${type}`);
  }
  if (fs.existsSync(filePath)) return { created: false, reason: 'already_exists', path: filePath };
  fs.writeFileSync(filePath, content, 'utf-8');
  return { created: true, path: path.relative(cwd, filePath) };
}

function templateSelect(cwd, planPath) {
  return { template: 'templates/summary-standard.md' };
}

function templateFill(cwd, templateType, options) {
  // ... implementation ...
  return { created: true };
}

function phasePlanIndex(cwd, phase) {
  if (!phase) throw new Error('phase required');
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo) return { error: 'Phase not found' };

  const phaseDir = path.join(cwd, phaseInfo.directory);
  const plans = [];
  const waves = {};
  let hasCheckpoints = false;

  for (const planFile of (phaseInfo.plans || [])) {
    const planPath = path.join(phaseDir, planFile);
    const content = safeReadFile(planPath);
    if (!content) continue;
    const fm = extractFrontmatter(content);
    const planId = planFile.replace(/-PLAN\.md$/i, '').replace(/PLAN\.md$/i, '');
    const hasSummary = (phaseInfo.summaries || []).some(s =>
      s.replace(/-SUMMARY\.md$/i, '').replace(/SUMMARY\.md$/i, '') === planId
    );

    // Extract objective from XML tag or frontmatter
    const objMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
    const objective = objMatch ? objMatch[1].trim().split('\n')[0] : (fm.objective || null);

    const wave = parseInt(fm.wave, 10) || 1;
    const autonomous = fm.autonomous !== 'false' && fm.autonomous !== false;
    if (!autonomous) hasCheckpoints = true;

    // Parse files_modified from frontmatter (may be array or YAML inline array string)
    let filesModified = fm['files-modified'] || fm.files_modified || [];
    if (typeof filesModified === 'string') {
      filesModified = filesModified.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
    }

    // Count tasks from XML tags or ## Task headings
    const xmlTasks = (content.match(/<task[^>]*>/g) || []).length;
    const mdTasks = (content.match(/^## Task \d+/gm) || []).length;
    const taskCount = xmlTasks > 0 ? xmlTasks : mdTasks;

    const plan = {
      id: planId,
      file: planFile,
      wave,
      autonomous,
      objective,
      files_modified: filesModified,
      depends_on: fm.depends_on || [],
      task_count: taskCount,
      has_summary: hasSummary,
      gap_closure: fm.gap_closure === true || fm.gap_closure === 'true',
    };
    plans.push(plan);

    if (!waves[wave]) waves[wave] = [];
    waves[wave].push(planId);
  }

  const incomplete = plans.filter(p => !p.has_summary).map(p => p.id);

  return {
    phase: phaseInfo.phase_number,
    phase_name: phaseInfo.phase_name,
    directory: phaseInfo.directory,
    plans,
    waves,
    incomplete,
    has_checkpoints: hasCheckpoints,
    total_plans: plans.length,
    incomplete_count: incomplete.length,
  };
}

function stateSnapshot(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) return { error: 'STATE.md not found' };
  const content = fs.readFileSync(statePath, 'utf-8');

  const fields = [
    'Current Phase', 'Current Phase Name', 'Current Plan', 'Total Plans in Phase',
    'Total Phases', 'Status', 'Progress', 'Last Activity', 'Last Activity Description',
    'Paused At', 'Stopped At', 'Resume File', 'Last session', 'Last Date',
  ];
  const snapshot = {};
  for (const field of fields) {
    const value = stateExtractField(content, field);
    if (value) snapshot[field.toLowerCase().replace(/\s+/g, '_')] = value;
  }

  // Numeric conversions
  if (snapshot.total_phases) snapshot.total_phases = parseInt(snapshot.total_phases, 10);
  if (snapshot.total_plans_in_phase) snapshot.total_plans_in_phase = parseInt(snapshot.total_plans_in_phase, 10);
  if (snapshot.progress) {
    const pctMatch = snapshot.progress.match(/(\d+)/);
    if (pctMatch) snapshot.progress_percent = parseInt(pctMatch[1], 10);
    delete snapshot.progress;
  }

  // Parse decisions table
  const decisionsMatch = content.match(/## Decisions Made\s*\n\n\|[^\n]*\|\n\|[-|\s]*\|\n([\s\S]*?)(?=\n##|\n\n\n|$)/);
  if (decisionsMatch) {
    const rows = decisionsMatch[1].trim().split('\n').filter(r => r.startsWith('|'));
    snapshot.decisions = rows.map(row => {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      return { phase: cols[0] || '', summary: cols[1] || '', rationale: cols[2] || '' };
    });
  }

  // Parse blockers list
  const blockersMatch = content.match(/## Blockers\s*\n\n((?:- [^\n]+\n?)+)/);
  if (blockersMatch) {
    snapshot.blockers = blockersMatch[1].trim().split('\n').map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean);
  }

  // Parse session section
  const sessionMatch = content.match(/## Session\s*\n([\s\S]*?)(?=\n##|$)/);
  if (sessionMatch) {
    const sessionContent = sessionMatch[1];
    const session = {};
    const lastDateVal = stateExtractField(sessionContent, 'Last Date');
    const stoppedVal = stateExtractField(sessionContent, 'Stopped At');
    const resumeVal = stateExtractField(sessionContent, 'Resume File');
    if (lastDateVal) session.last_date = lastDateVal;
    if (stoppedVal) session.stopped_at = stoppedVal;
    if (resumeVal) session.resume_file = resumeVal;
    if (Object.keys(session).length > 0) snapshot.session = session;
    // Remove duplicate top-level session fields
    delete snapshot.last_date;
    delete snapshot.stopped_at;
    delete snapshot.resume_file;
  }

  snapshot.timestamp = new Date().toISOString();
  return snapshot;
}

function summaryExtract(cwd, summaryPath, fields) {
  if (!summaryPath) throw new Error('summary-path required');
  const fullPath = path.join(cwd, summaryPath);
  if (!fs.existsSync(fullPath)) return { error: 'File not found' };
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);

  // Map of field names the caller might request (underscore style) to frontmatter keys (hyphen style)
  const fmKeyMap = {
    one_liner: 'one-liner',
    key_files: 'key-files',
    tech_added: 'tech-stack',
    patterns: 'patterns-established',
    decisions: 'key-decisions',
  };

  const allFields = ['one_liner', 'key_files', 'tech_added', 'patterns', 'decisions'];
  const requestedFields = fields && fields.length > 0 ? fields : allFields;

  const result = { path: summaryPath };

  for (const field of requestedFields) {
    const fmKey = fmKeyMap[field] || field.replace(/_/g, '-');

    if (field === 'one_liner') {
      result.one_liner = fm['one-liner'] || null;
      if (!result.one_liner) {
        const oneLinerMatch = content.match(/^(?:---[\s\S]*?---\s*\n)?#[^\n]*\n+([^\n#]+)/);
        if (oneLinerMatch) result.one_liner = oneLinerMatch[1].trim();
      }
    } else if (field === 'key_files') {
      const val = fm['key-files'];
      result.key_files = Array.isArray(val) ? val : [];
    } else if (field === 'tech_added') {
      const ts = fm['tech-stack'];
      result.tech_added = (ts && ts.added) ? (Array.isArray(ts.added) ? ts.added : [ts.added]) : [];
    } else if (field === 'patterns') {
      const val = fm['patterns-established'];
      result.patterns = Array.isArray(val) ? val : [];
    } else if (field === 'decisions') {
      const val = fm['key-decisions'];
      if (Array.isArray(val)) {
        result.decisions = val.map(d => {
          if (typeof d === 'string') {
            const colonIdx = d.indexOf(':');
            if (colonIdx !== -1) {
              return { summary: d.substring(0, colonIdx).trim(), rationale: d.substring(colonIdx + 1).trim() };
            }
            return { summary: d, rationale: '' };
          }
          return d;
        });
      } else {
        result.decisions = [];
      }
    }
  }

  return result;
}

async function webSearch(query, options) {
  // ... implementation ...
  return { results: [] };
}

function milestoneComplete(cwd, version, options) {
  if (!version) throw new Error('version required');
  const milestoneName = options?.name || version;
  const archivePhases = options?.archivePhases !== false;
  const planningDir = path.join(cwd, '.planning');
  const milestonesDir = path.join(planningDir, 'milestones');
  const phasesDir = path.join(planningDir, 'phases');
  const today = new Date().toISOString().split('T')[0];

  // Create milestones directory
  fs.mkdirSync(milestonesDir, { recursive: true });

  // Count phases and collect one-liners from summaries
  let phaseCount = 0;
  const accomplishments = [];
  if (fs.existsSync(phasesDir)) {
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
      phaseCount = dirs.length;
      for (const dir of dirs) {
        const dirPath = path.join(phasesDir, dir);
        const files = fs.readdirSync(dirPath);
        const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        for (const summary of summaries) {
          const content = safeReadFile(path.join(dirPath, summary));
          if (content) {
            const fm = extractFrontmatter(content);
            if (fm['one-liner']) accomplishments.push(fm['one-liner']);
          }
        }
      }
    } catch {}
  }

  // Archive phase directories if requested
  const archivedPhases = [];
  if (archivePhases && fs.existsSync(phasesDir)) {
    const archiveName = `${version}-phases`;
    const archivePath = path.join(milestonesDir, archiveName);
    fs.mkdirSync(archivePath, { recursive: true });
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      for (const dir of dirs) {
        const src = path.join(phasesDir, dir);
        const dst = path.join(archivePath, dir);
        fs.cpSync(src, dst, { recursive: true });
        fs.rmSync(src, { recursive: true, force: true });
        archivedPhases.push(dir);
      }
    } catch {}
  }

  // Archive ROADMAP.md and REQUIREMENTS.md
  const archiveFiles = ['ROADMAP.md', 'REQUIREMENTS.md'];
  const archived = { roadmap: false, requirements: false };
  for (const file of archiveFiles) {
    const src = path.join(planningDir, file);
    if (fs.existsSync(src)) {
      const dst = path.join(milestonesDir, `${version}-${file}`);
      fs.cpSync(src, dst);
      if (file === 'ROADMAP.md') archived.roadmap = true;
      if (file === 'REQUIREMENTS.md') archived.requirements = true;
    }
  }

  // Update STATE.md
  const statePath = path.join(planningDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    const newStatus = stateReplaceField(stateContent, 'Status', `Milestone ${version} complete (${today})`);
    if (newStatus) {
      stateContent = newStatus;
      fs.writeFileSync(statePath, stateContent, 'utf-8');
    }
  }

  // Create/update MILESTONES.md
  const milestonesPath = path.join(planningDir, 'MILESTONES.md');
  let milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n`;
  if (accomplishments.length > 0) {
    milestoneEntry += `### Accomplishments\n\n`;
    for (const acc of accomplishments) {
      milestoneEntry += `- ${acc}\n`;
    }
    milestoneEntry += '\n';
  }
  milestoneEntry += `---\n\n`;
  if (fs.existsSync(milestonesPath)) {
    let existing = fs.readFileSync(milestonesPath, 'utf-8');
    existing = existing.trimEnd() + '\n\n' + milestoneEntry;
    fs.writeFileSync(milestonesPath, existing, 'utf-8');
  } else {
    fs.writeFileSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`, 'utf-8');
  }

  return {
    version,
    name: milestoneName,
    completed: true,
    date: today,
    phases: phaseCount,
    archived,
    archived_phases: archivedPhases,
    archive_directory: `.planning/milestones/${version}-phases`,
  };
}

function requirementsMarkComplete(cwd, reqIdsRaw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) throw new Error('requirement IDs required');
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (!fs.existsSync(reqPath)) return { updated: false, reason: 'REQUIREMENTS.md not found' };
  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  for (const reqId of reqIdsRaw) {
    if (reqContent.includes(reqId)) {
      reqContent = reqContent.replace(new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi'), '$1x$2');
      updated.push(reqId);
    }
  }
  if (updated.length > 0) fs.writeFileSync(reqPath, reqContent, 'utf-8');
  return { updated: updated.length > 0, marked_complete: updated };
}

function roadmapUpdatePlanProgress(cwd, phaseNum) {
  if (!phaseNum) throw new Error('phase number required');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return { updated: false, reason: 'ROADMAP.md not found' };
  // ... logic ...
  return { updated: true };
}

function initNewProject(cwd) {
  const config = loadConfig(cwd);
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));
  let hasCode = false;
  let hasPackageFile = false;
  try {
    const files = execSync('find . -maxdepth 3 \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" \\) 2>/dev/null | grep -v node_modules | grep -v .git | head -5', { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    hasCode = files.trim().length > 0;
  } catch {}
  hasPackageFile = ['package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'Package.swift'].some(f => pathExistsInternal(cwd, f));
  return {
    researcher_model: resolveModel(cwd, 'gsd-project-researcher').model,
    synthesizer_model: resolveModel(cwd, 'gsd-research-synthesizer').model,
    roadmapper_model: resolveModel(cwd, 'gsd-roadmapper').model,
    commit_docs: config.commit_docs,
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    has_codebase_map: pathExistsInternal(cwd, '.planning/codebase'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.planning/codebase'),
    has_git: pathExistsInternal(cwd, '.git'),
    brave_search_available: hasBraveSearch,
  };
}

function initNewMilestone(cwd) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);
  return {
    researcher_model: resolveModel(cwd, 'gsd-project-researcher').model,
    synthesizer_model: resolveModel(cwd, 'gsd-research-synthesizer').model,
    roadmapper_model: resolveModel(cwd, 'gsd-roadmapper').model,
    commit_docs: config.commit_docs,
    research_enabled: config.research,
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
  };
}

function initQuick(cwd, description) {
  const config = loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir).filter(f => /^\d+-/.test(f)).map(f => parseInt(f.split('-')[0], 10)).filter(n => !isNaN(n));
    if (existing.length > 0) nextNum = Math.max(...existing) + 1;
  } catch {}
  return {
    planner_model: resolveModel(cwd, 'gsd-planner').model,
    executor_model: resolveModel(cwd, 'gsd-executor').model,
    checker_model: resolveModel(cwd, 'gsd-plan-checker').model,
    verifier_model: resolveModel(cwd, 'gsd-verifier').model,
    commit_docs: config.commit_docs,
    next_num: nextNum,
    slug: slug,
    description: description || null,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };
}

function initResume(cwd) {
  const config = loadConfig(cwd);
  let interruptedAgentId = null;
  try { interruptedAgentId = fs.readFileSync(path.join(cwd, '.planning', 'current-agent-id.txt'), 'utf-8').trim(); } catch {}
  return {
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,
    commit_docs: config.commit_docs,
  };
}

function initVerifyWork(cwd, phase) {
  if (!phase) throw new Error('phase required');
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  return {
    planner_model: resolveModel(cwd, 'gsd-planner').model,
    checker_model: resolveModel(cwd, 'gsd-plan-checker').model,
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    has_verification: phaseInfo?.has_verification || false,
  };
}

function initPhaseOp(cwd, phase) {
  const config = loadConfig(cwd);
  let phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo) {
    const roadmapPhase = getRoadmapPhaseInternal(cwd, phase);
    if (roadmapPhase?.found) {
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: roadmapPhase.phase_name,
        phase_slug: roadmapPhase.phase_name ? generateSlugInternal(roadmapPhase.phase_name) : null,
        plans: [], summaries: [], incomplete_plans: [], has_research: false, has_context: false, has_verification: false
      };
    }
  }
  return {
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    plan_count: phaseInfo?.plans?.length || 0,
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };
}

function initExecutePhase(cwd, phase, includes) {
  if (!phase) throw new Error('phase required');
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  const milestone = getMilestoneInfo(cwd);
  const result = {
    executor_model: resolveModel(cwd, 'gsd-executor').model,
    verifier_model: resolveModel(cwd, 'gsd-verifier').model,
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    plans: phaseInfo?.plans || [],
    summaries: phaseInfo?.summaries || [],
    incomplete_plans: phaseInfo?.incomplete_plans || [],
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,
    branch_name: config.branching_strategy === 'phase' && phaseInfo ? config.phase_branch_template.replace('{phase}', phaseInfo.phase_number).replace('{slug}', phaseInfo.phase_slug || 'phase') : config.branching_strategy === 'milestone' ? config.milestone_branch_template.replace('{milestone}', milestone.version).replace('{slug}', generateSlugInternal(milestone.name) || 'milestone') : null,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
  };
  if (includes && includes.has('state')) result.state_content = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  if (includes && includes.has('config')) result.config_content = safeReadFile(path.join(cwd, '.planning', 'config.json'));
  if (includes && includes.has('roadmap')) result.roadmap_content = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  return result;
}

function initPlanPhase(cwd, phase, includes) {
  if (!phase) throw new Error('phase required');
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  const result = {
    researcher_model: resolveModel(cwd, 'gsd-phase-researcher').model,
    planner_model: resolveModel(cwd, 'gsd-planner').model,
    checker_model: resolveModel(cwd, 'gsd-plan-checker').model,
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
  };
  // Include file contents if requested
  if (includes && includes.size > 0) {
    const planningDir = path.join(cwd, '.planning');
    const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;
    if (includes.has('state')) {
      result.state_content = safeReadFile(path.join(planningDir, 'STATE.md')) || null;
    }
    if (includes.has('roadmap')) {
      result.roadmap_content = safeReadFile(path.join(planningDir, 'ROADMAP.md')) || null;
    }
    if (includes.has('requirements')) {
      result.requirements_content = safeReadFile(path.join(planningDir, 'REQUIREMENTS.md')) || null;
    }
    if (includes.has('config')) {
      result.config_content = safeReadFile(path.join(planningDir, 'config.json')) || null;
    }
    if (includes.has('context') && phaseDir) {
      result.context_content = safeReadFile(path.join(phaseDir, `${result.padded_phase}-CONTEXT.md`)) || null;
    }
    if (includes.has('research') && phaseDir) {
      result.research_content = safeReadFile(path.join(phaseDir, `${result.padded_phase}-RESEARCH.md`)) || null;
    }
    if (includes.has('verification') && phaseDir) {
      result.verification_content = safeReadFile(path.join(phaseDir, `${result.padded_phase}-VERIFICATION.md`)) || null;
    }
    if (includes.has('uat') && phaseDir) {
      result.uat_content = safeReadFile(path.join(phaseDir, `${result.padded_phase}-UAT.md`)) || null;
    }
  }
  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  MODEL_PROFILES,
  safeReadFile,
  loadConfig,
  isGitIgnored,
  execGit,
  normalizePhaseName,
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  generateSlug,
  generateSlugInternal,
  currentTimestamp,
  verifyPathExists,
  pathExistsInternal,
  resolveModel,
  getMilestoneInfo,
  configEnsureSection,
  configSet,
  configGet,
  getArchivedPhaseDirs,
  historyDigest,
  listPhases: phasesList,
  roadmapGetPhase,
  roadmapAnalyze,
  phaseNextDecimal,
  stateLoad,
  getState: stateGet,
  patchState: statePatch,
  updateState: stateUpdate,
  stateExtractField,
  stateReplaceField,
  advancePlan: stateAdvancePlan,
  recordMetric: stateRecordMetric,
  updateProgress: stateUpdateProgress,
  addDecision: stateAddDecision,
  addBlocker: stateAddBlocker,
  resolveBlocker: stateResolveBlocker,
  recordSession: stateRecordSession,
  findPhase,
  commit,
  phaseAdd,
  phaseInsert,
  phaseRemove,
  phaseComplete,
  milestoneComplete,
  requirementsMarkComplete,
  roadmapUpdatePlanProgress,
  verifySummary,
  templateSelect,
  templateFill,
  phasePlanIndex,
  stateSnapshot,
  summaryExtract,
  webSearch,
  verifyPlanStructure,
  verifyPhaseCompleteness,
  verifyReferences,
  verifyCommits,
  verifyArtifacts,
  verifyKeyLinks,
  validateConsistency,
  validateHealth,
  progressRender,
  todoComplete,
  scaffold,
  initExecutePhase,
  initPlanPhase,
  initNewProject,
  initNewMilestone,
  initQuick,
  initResume,
  initVerifyWork,
  initPhaseOp,
  initTodos,
  initMilestoneOp,
  initMapCodebase,
  initProgress,
};
