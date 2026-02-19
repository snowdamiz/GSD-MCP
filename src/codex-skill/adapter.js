
const gsd = require('../../get-shit-done/lib/gsd-core.js');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cwd = process.cwd();

  try {
    let result;
    switch (command) {
      case 'init_project':
        result = gsd.initNewProject(cwd);
        break;
      case 'get_state':
        result = gsd.getState(cwd, args[1]); // section optional
        break;
      case 'update_state':
        result = gsd.updateState(cwd, args[1], args[2]); // field, value
        break;
      case 'add_phase':
        result = gsd.phaseAdd(cwd, args[1]); // description
        break;
      case 'complete_phase':
        result = gsd.phaseComplete(cwd, args[1]); // phase
        break;
      case 'log_work':
        // Parsing args for log_work might be trickier if passed as positional from manifest
        // Assuming: phase plan duration [tasks] [files]
        result = gsd.recordMetric(cwd, {
          phase: args[1],
          plan: args[2],
          duration: args[3],
          tasks: args[4],
          files: args[5],
        });
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
