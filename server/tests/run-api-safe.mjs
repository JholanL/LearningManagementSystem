import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertSafeTestDatabase } from './testSafety.mjs';

dotenv.config();

const testUri = process.env.MONGO_TEST_URI;
const normalUri = process.env.MONGO_URI;
const { testName, normalName } = assertSafeTestDatabase({ testUri, normalUri });
const port = Number(process.env.API_TEST_PORT || 5501);
const apiUrl = `http://127.0.0.1:${port}/api`;
const testEnv = {
  ...process.env,
  MONGO_URI: testUri,
  MONGO_TEST_URI: testUri,
  ORIGINAL_MONGO_URI_FOR_TEST_GUARD: normalUri || '',
  VOICELINK_SAFE_API_TEST: '1',
  API_URL: apiUrl,
  PORT: String(port),
  NODE_ENV: 'test',
};

function run(args, env = testEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error('The isolated API server did not become ready.');
}

async function dropOnlyTestDatabase() {
  assertSafeTestDatabase({ testUri, normalUri });
  await mongoose.connect(testUri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function stopServer() {
  if (!server || server.killed) return;
  await new Promise((resolve) => {
    server.once('exit', resolve);
    server.kill();
  });
}

let server;
let exitCode = 1;
try {
  console.log(`Safe API test database: ${testName}`);
  if (normalName) console.log(`Normal application database remains protected: ${normalName}`);
  if ((await run(['src/seed/seed.js'])) !== 0) throw new Error('Isolated test fixture creation failed.');

  server = spawn(process.execPath, ['src/server.js'], { cwd: process.cwd(), env: testEnv, stdio: 'inherit', windowsHide: true });
  await waitForServer();
  exitCode = await run(['tests/api.test.mjs']);
} catch (error) {
  console.error(`Safe API test aborted: ${error.message}`);
} finally {
  await stopServer();
  try {
    await dropOnlyTestDatabase();
    console.log(`Cleaned only isolated test database: ${testName}`);
  } catch (error) {
    console.error(`Test database cleanup failed: ${error.message}`);
    exitCode = 1;
  }
}

process.exit(exitCode);

