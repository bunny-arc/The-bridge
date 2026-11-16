const { spawn } = require('child_process');
const path = require('path');

console.log('[Runner] Starting Inter2Tech backend server on port 3000...');
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, PORT: '3000' }
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const msg = data.toString();
  // console.log('[Server stdout]', msg);
  if (msg.includes('Inter2Tech Server running at: http://localhost:3000') && !serverReady) {
    serverReady = true;
    console.log('[Runner] Server is ready! Spawning test runner...\n');

    const tester = spawn('node', ['test-server.js'], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    tester.on('exit', (code) => {
      console.log(`[Runner] Test suite completed with exit code: ${code}`);
      server.kill('SIGTERM');
      process.exit(code || 0);
    });
  }
});

server.stderr.on('data', (data) => {
  console.error('[Server stderr]', data.toString());
});

server.on('exit', (code) => {
  if (!serverReady) {
    console.error(`[Runner] Server exited prematurely with code ${code}`);
    process.exit(1);
  }
});

setTimeout(() => {
  if (!serverReady) {
    console.error('[Runner] Timed out waiting for server to start.');
    server.kill();
    process.exit(1);
  }
}, 10000);
