#!/usr/bin/env node
/**
 * Run E2E tests across multiple models locally (simulates CI matrix).
 *
 * Usage:
 *   pnpm e2e:matrix                                          # all models from model-config.ts
 *   pnpm e2e:matrix --model "ac_7xhfwyml::openai::gpt-5.2"  # single model
 *   pnpm e2e:matrix --current                                # use current CARTO_AI_API_MODEL from .env
 *   pnpm e2e:matrix -- --grep "Counties"                     # forward args to Playwright
 *
 * Environment:
 *   E2E_MODELS="model1,model2"   # override model list (comma-separated)
 */
import { execSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = resolve(__dirname, '../..');
const MODEL_CONFIG = resolve(__dirname, '../helpers/model-config.ts');

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function parseModelsFromConfig() {
  const content = readFileSync(MODEL_CONFIG, 'utf-8');
  const models = [];
  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('//')) continue;
    const match = line.match(/['"]ac_[^'"]+['"]/);
    if (match) models.push(match[0].slice(1, -1));
  }
  if (models.length === 0) {
    console.error('ERROR: No models found in', MODEL_CONFIG);
    process.exit(1);
  }
  return models;
}

function slugify(model) {
  return model.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
}

function killPort(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    // Nothing running on port
  }
}

function getBackendEnvPath(backend) {
  return resolve(FRONTEND_DIR, `../../backend/${backend}/.env`);
}

function getEnvModel(backendEnv) {
  if (!existsSync(backendEnv)) return '';
  const content = readFileSync(backendEnv, 'utf-8');
  const match = content.match(/^CARTO_AI_API_MODEL=(.*)$/m);
  return match ? match[1] : '';
}

function setEnvModel(backendEnv, model) {
  if (!existsSync(backendEnv)) {
    console.warn('  WARNING: Backend .env not found at', backendEnv);
    return;
  }
  let content = readFileSync(backendEnv, 'utf-8');
  if (/^CARTO_AI_API_MODEL=/m.test(content)) {
    content = content.replace(/^CARTO_AI_API_MODEL=.*$/m, `CARTO_AI_API_MODEL=${model}`);
  } else {
    content += `\nCARTO_AI_API_MODEL=${model}\n`;
  }
  writeFileSync(backendEnv, content);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let models = null;
  let useCurrent = false;
  let backend = 'openai-agents-sdk';
  const playwrightArgs = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && i + 1 < args.length) {
      models = [args[++i]];
    } else if (args[i] === '--backend' && i + 1 < args.length) {
      backend = args[++i];
    } else if (args[i] === '--current') {
      useCurrent = true;
    } else {
      playwrightArgs.push(args[i]);
    }
  }

  return { models, useCurrent, backend, playwrightArgs };
}

function resolveModels(cliModels, useCurrent, backendEnv) {
  if (cliModels) return cliModels;

  if (useCurrent) {
    const current = getEnvModel(backendEnv);
    if (!current) {
      console.error('ERROR: --current used but no CARTO_AI_API_MODEL found in backend .env');
      process.exit(1);
    }
    return [current];
  }

  if (process.env.E2E_MODELS) {
    return process.env.E2E_MODELS.split(',').map((m) => m.trim()).filter(Boolean);
  }

  return parseModelsFromConfig();
}

// Run a single model test, streaming Playwright output live with a spinner during quiet periods
function runTest(model, playwrightArgs, backend) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', ['e2e', ...playwrightArgs], {
      cwd: FRONTEND_DIR,
      env: { ...process.env, TEST_MODEL: model, BACKEND_SDK: backend },
      stdio: 'pipe',
    });

    const chunks = { stdout: [], stderr: [] };
    let spinnerIdx = 0;
    const spinnerLine = '  waiting...';

    // Spinner runs during quiet periods (server startup, etc.)
    const spinner = setInterval(() => {
      process.stdout.write(`\r  ${SPINNER[spinnerIdx++ % SPINNER.length]} ${spinnerLine}`);
    }, 80);

    function clearSpinner() {
      process.stdout.write(`\r${' '.repeat(spinnerLine.length + 6)}\r`);
    }

    child.stdout.on('data', (d) => {
      chunks.stdout.push(d);
      const text = d.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/[✓✗✘·]|passed|failed|skipped|\d+ test/.test(trimmed)) {
          clearSpinner();
          console.log(`  ${trimmed}`);
        }
      }
    });

    child.stderr.on('data', (d) => chunks.stderr.push(d));

    child.on('close', (code) => {
      clearInterval(spinner);
      clearSpinner();
      resolve({
        passed: code === 0,
        stdout: Buffer.concat(chunks.stdout).toString(),
        stderr: Buffer.concat(chunks.stderr).toString(),
      });
    });
  });
}

// Main
async function main() {
  const { models: cliModels, useCurrent, backend, playwrightArgs } = parseArgs();
  const backendEnv = getBackendEnvPath(backend);
  const models = resolveModels(cliModels, useCurrent, backendEnv);
  const originalModel = getEnvModel(backendEnv);

  function cleanup() {
    if (originalModel) setEnvModel(backendEnv, originalModel);
    killPort(3003);
  }
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  console.log(`\nE2E Matrix: ${models.length} model${models.length > 1 ? 's' : ''} (backend: ${backend})\n`);

  const results = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const slug = slugify(model);
    const prefix = `[${i + 1}/${models.length}] ${slug}`;

    setEnvModel(backendEnv, model);
    killPort(3003);
    // Wait for port to be fully released and buffers to clear
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(`\n${prefix}`);
    console.log(`${'─'.repeat(prefix.length)}`);
    const result = await runTest(model, playwrightArgs, backend);

    if (result.passed) {
      console.log(`  \u2713 PASS`);
    } else {
      console.log(`  \u2717 FAIL`);
      const combined = (result.stdout + '\n' + result.stderr).trim();
      const lines = combined.split('\n').filter(Boolean);

      // Extract only relevant error lines (LiteLLM errors, system errors, or last lines)
      let errorLines = lines.filter((l) => /litellm\.\w+Error|EADDRINUSE|TimeoutError/.test(l));

      // If we found specific errors, show them with some context (up to 10 lines)
      if (errorLines.length > 0) {
        const firstErrorIdx = lines.findIndex((l) => errorLines.includes(l));
        const contextStart = Math.max(0, firstErrorIdx - 2);
        const contextEnd = Math.min(lines.length, firstErrorIdx + 8);
        errorLines = lines.slice(contextStart, contextEnd);
      } else {
        // Fallback: show last 10 lines if no specific error found
        errorLines = lines.slice(-10);
      }

      const context = errorLines.join('\n');
      if (context) {
        console.log(`\n${context}\n`);
      }
    }

    results.push({
      model,
      slug,
      passed: result.passed,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  // Summary
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;

  console.log(`\n${'MODEL'.padEnd(45)} RESULT`);
  console.log(`${'─'.repeat(45)} ──────`);
  for (const { slug, passed } of results) {
    console.log(`${slug.padEnd(45)} ${passed ? '\u2713 PASS' : '\u2717 FAIL'}`);
  }
  console.log(`\nTotal: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`);

  // Generate detailed report for LLM team
  generateDetailedReport(results, backend);

  process.exit(failCount > 0 ? 1 : 0);
}

function generateDetailedReport(results, backend) {
  const now = new Date().toISOString().split('T')[0];
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.length - passCount;
  const failedModels = results.filter((r) => !r.passed);

  let report = `# Model Availability Test Report\n\n`;
  report += `**Date:** ${now}\n`;
  report += `**Backend:** ${backend}\n`;
  report += `**Total Models:** ${results.length}\n`;
  report += `**Available:** ${passCount} (${((passCount / results.length) * 100).toFixed(1)}%)\n`;
  report += `**Unavailable:** ${failCount} (${((failCount / results.length) * 100).toFixed(1)}%)\n`;
  report += `**Test Type:** Single LDS geocoding test per model\n\n`;

  report += `---\n\n`;

  // Summary table
  report += `## Summary Table\n\n`;
  report += `| # | Provider | Model | Status |\n`;
  report += `|---|----------|-------|--------|\n`;

  results.forEach((r, idx) => {
    const parts = r.model.split('::');
    const provider = parts[1] || 'Unknown';
    const modelName = parts[2] || r.model;
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    report += `| ${idx + 1} | ${provider} | \`${modelName}\` | ${status} |\n`;
  });

  report += `\n---\n\n`;

  // Failed models details
  if (failedModels.length > 0) {
    report += `## Failed Models - Detailed Analysis\n\n`;
    report += `The following ${failedModels.length} model(s) are currently **unavailable** or **failing** the basic availability test:\n\n`;

    failedModels.forEach((r) => {
      const parts = r.model.split('::');
      const provider = parts[1] || 'Unknown';
      const modelName = parts[2] || r.model;

      report += `### ${provider}: \`${modelName}\`\n\n`;
      report += `**Full Model ID:** \`${r.model}\`\n\n`;

      // Extract error details
      const combined = (r.stdout + '\n' + r.stderr).trim();
      const lines = combined.split('\n').filter(Boolean);

      // Look for specific error patterns
      const litellmError = lines.find((l) => /litellm\.\w+Error/.test(l));
      const timeoutError = lines.find((l) => /TimeoutError/.test(l));
      const addrInUse = lines.find((l) => /EADDRINUSE/.test(l));

      if (litellmError) {
        // Extract LiteLLM error message
        const errorMatch = litellmError.match(/litellm\.(\w+Error)[:\s]+(.+)/);
        if (errorMatch) {
          report += `**Error Type:** ${errorMatch[1]}\n\n`;
          report += `**Error Message:**\n\`\`\`\n${errorMatch[2].replace(/\x1b\[[0-9;]*m/g, '').trim()}\n\`\`\`\n\n`;
        }

        // Look for additional context
        const modelGroupMatch = combined.match(/Received Model Group=([^\n]+)/);
        if (modelGroupMatch) {
          report += `**Attempted Model Group:** \`${modelGroupMatch[1].trim()}\`\n\n`;
        }
      } else if (timeoutError) {
        report += `**Error Type:** TimeoutError\n\n`;
        const timeoutMatch = timeoutError.match(/Timeout (\d+)ms exceeded/);
        if (timeoutMatch) {
          report += `**Details:** Test exceeded ${parseInt(timeoutMatch[1]) / 1000}s timeout\n\n`;
        }
        report += `**Possible Causes:**\n- Model is unresponsive\n- Network latency issues\n- Model processing time exceeds limit\n\n`;
      } else if (addrInUse) {
        report += `**Error Type:** Port Already in Use (EADDRINUSE)\n\n`;
        report += `**Details:** Backend port 3003 was already occupied (test infrastructure issue, not model issue)\n\n`;
      } else {
        // Generic failure
        report += `**Error Type:** Unknown/Generic Failure\n\n`;
        const lastLines = lines.slice(-5).join('\n');
        if (lastLines) {
          report += `**Last Output:**\n\`\`\`\n${lastLines}\n\`\`\`\n\n`;
        }
      }

      report += `---\n\n`;
    });
  }

  // Recommendations section
  report += `## Recommendations\n\n`;

  if (failedModels.length > 0) {
    const groupedByProvider = {};
    failedModels.forEach((r) => {
      const provider = r.model.split('::')[1] || 'Unknown';
      if (!groupedByProvider[provider]) groupedByProvider[provider] = [];
      groupedByProvider[provider].push(r);
    });

    Object.entries(groupedByProvider).forEach(([provider, models]) => {
      report += `### ${provider}\n\n`;
      models.forEach((r) => {
        const modelName = r.model.split('::')[2] || r.model;
        const combined = (r.stdout + '\n' + r.stderr).trim();

        if (combined.includes('NotFoundError') || combined.includes('does not exist')) {
          report += `- **${modelName}**: Deployment missing - verify model is properly deployed in ${provider}\n`;
        } else if (combined.includes('annotations')) {
          report += `- **${modelName}**: API incompatibility - remove \`annotations\` field from message format\n`;
        } else if (combined.includes('$schema')) {
          report += `- **${modelName}**: API incompatibility - remove \`$schema\` field from tool definitions\n`;
        } else if (combined.includes('429') || combined.includes('rate limit')) {
          report += `- **${modelName}**: Rate limiting - implement retry logic or increase quota\n`;
        } else if (combined.includes('TimeoutError')) {
          report += `- **${modelName}**: Performance issue - investigate model response time or increase timeout\n`;
        } else {
          report += `- **${modelName}**: Requires investigation - check detailed logs above\n`;
        }
      });
      report += `\n`;
    });
  } else {
    report += `✅ All models are currently available and passing the basic availability test.\n\n`;
  }

  // Test methodology
  report += `---\n\n`;
  report += `## Test Methodology\n\n`;
  report += `**Test:** Single LDS geocoding test ("Fly to New York")\n\n`;
  report += `**Purpose:** Verify basic model availability and API connectivity\n\n`;
  report += `**What This Test Validates:**\n`;
  report += `- Model is accessible via the API\n`;
  report += `- Model can process a simple natural language request\n`;
  report += `- Model can invoke a backend tool (LDS geocoding)\n`;
  report += `- Basic request/response cycle completes successfully\n\n`;
  report += `**What This Test Does NOT Validate:**\n`;
  report += `- Full feature compatibility (markers, widgets, MCP tools, etc.)\n`;
  report += `- Performance under load\n`;
  report += `- Complex multi-turn conversations\n`;
  report += `- All edge cases and error scenarios\n\n`;
  report += `**Note:** For comprehensive testing, run the full test suite with \`pnpm e2e:matrix\`\n\n`;

  // Write report
  const reportPath = resolve(FRONTEND_DIR, 'e2e/test-results/model-availability-report.md');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, report);
  console.log(`\n📄 Detailed report saved: ${reportPath}`);
}

main();
