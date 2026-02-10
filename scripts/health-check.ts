import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import db from '../lib/repos/client';

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

const tick = `${colors.green}✓${colors.reset}`;
const cross = `${colors.red}✗${colors.reset}`;

function logStep(step: string) {
  console.log(`\n${colors.blue}${colors.bold}running ${step}...${colors.reset}`);
}

function logSuccess(msg: string) {
  console.log(`  ${tick} ${msg}`);
}

function logError(msg: string) {
  console.log(`  ${cross} ${colors.red}${msg}${colors.reset}`);
}

function runCommand(command: string, errorMessage: string): boolean {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch {
    logError(errorMessage);
    return false;
  }
}

async function checkEnv() {
  logStep('Environment Check');

  // 1. Node Version
  const nodeVersion = process.version;
  if (parseInt(nodeVersion.slice(1).split('.')[0]) < 18) {
    logError(`Node.js version ${nodeVersion} is too old. Required: 18+`);
    return false;
  }
  logSuccess(`Node.js ${nodeVersion}`);

  // 1.1 Next.js and React versions from package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    logSuccess(`Next.js ${pkg.dependencies.next}`);
    logSuccess(`React ${pkg.dependencies.react}`);
  } catch {
    // skip if failed to read
  }

  // 2. .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    logSuccess('.env file exists');
  } else {
    console.log(`  ${colors.yellow}⚠ .env file missing (using defaults or system env)${colors.reset}`);
  }

  // 3. Database URL
  if (!process.env.DATABASE_URL) {
    console.log(`  ${colors.yellow}⚠ DATABASE_URL not set in env (defaulting to local/dev)${colors.reset}`);
  } else {
    logSuccess('DATABASE_URL configured');
  }

  return true;
}

async function checkDatabase() {
  logStep('Database Connectivity');
  try {
    const result = await db.execute(sql`SELECT 1`);
    if (result) {
      logSuccess('Connected to Database');
      return true;
    }
    throw new Error('No result returned');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError(`Database connection failed: ${message}`);
    return false;
  }
}

async function main() {
  console.log(`${colors.bold}🏥 Project Health Check${colors.reset}`);
  console.log('====================================');

  const envOk = await checkEnv();
  if (!envOk) process.exit(1);

  const dbOk = await checkDatabase();
  // We don't exit here because local dev might not always have DB running, 
  // but it is critical for the app.
  if (!dbOk) {
    console.log(`\n${colors.red}CRITICAL: Database check failed. Ensure Postgres is running.${colors.reset}`);
    process.exit(1);
  }

  logStep('Linting (Code Style)');
  if (!runCommand('npm run lint', 'Linting failed')) {
    process.exit(1);
  }
  logSuccess('Linting Passed');

  logStep('Type Checking (TypeScript)');
  // Using tsc --noEmit to check types without generating files
  if (!runCommand('npm run typecheck', 'Type checking failed')) {
    process.exit(1);
  }
  logSuccess('Type Checking Passed');

  logStep('Unit Tests');
  if (!runCommand('npm run test', 'Unit tests failed')) {
    process.exit(1);
  }
  logSuccess('Unit Tests Passed');

  // Check valid build
  logStep('Production Build Verification');
  if (!runCommand('NEXT_TEST_BUILD=1 NODE_ENV=production npm run build', 'Build failed')) {
     process.exit(1);
  }
  logSuccess('Build Passed');

  console.log('\n====================================');
  console.log(`${colors.green}${colors.bold}✅  ALL SYSTEMS GO! Project is healthy.${colors.reset}\n`);
  
  // Exit cleanly
  process.exit(0);
}

main().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
