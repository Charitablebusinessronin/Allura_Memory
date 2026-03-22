/**
 * ADAS Sandbox Runner
 * Story 2.3: Sandboxed Execution
 *
 * Executes agent code in isolated environment with safety constraints
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const kmax = parseInt(process.env.KMAX || '100', 10);
  const timeoutMs = parseInt(process.env.TIMEOUT_MS || '60000', 10);

  let stepCount = 0;
  let kmaxExceeded = false;

  const timeoutId = setTimeout(() => {
    console.error(JSON.stringify({
      error: 'Timeout exceeded',
      timeoutMs,
      stepsExecuted: stepCount
    }));
    process.exit(137);
  }, timeoutMs);

  const checkKmax = () => {
    stepCount++;
    if (stepCount > kmax) {
      kmaxExceeded = true;
      return false;
    }
    return true;
  };

  try {
    const agentPath = path.join('/app', 'agent.js');
    const inputPath = path.join('/data', 'input.json');

    if (!fs.existsSync(agentPath)) {
      throw new Error('Agent code not found at /app/agent.js');
    }

    if (!fs.existsSync(inputPath)) {
      throw new Error('Input data not found at /data/input.json');
    }

    checkKmax();

    const agent = require(agentPath);
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    checkKmax();

    const result = await agent.run(input, { checkKmax });

    clearTimeout(timeoutId);

    console.log(JSON.stringify({
      success: true,
      result,
      stepsExecuted: stepCount,
      kmaxLimit: kmax
    }));
    process.exit(0);
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
      stepsExecuted: stepCount,
      kmaxExceeded
    }));
    process.exit(1);
  }
}

main();