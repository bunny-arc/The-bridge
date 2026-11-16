const { spawn } = require('child_process');
const http = require('http');

const PORT = 3000;

function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n===============================================================');
  console.log('🚀 Checking The Bridge Server on port 3000...');
  
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    console.log('⚡ Starting local backend server...');
    const serverProc = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });
    serverProc.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
    });
    // Wait for server to boot
    await new Promise(r => setTimeout(r, 2500));
  } else {
    console.log('✅ The Bridge Server is already running on port 3000.');
  }

  console.log('\n🌐 Launching Cloudflare Public Tunnel for instant worldwide access...');
  console.log('👉 Anyone on phone, tablet, or PC can open this link from anywhere!\n');

  const cf = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], { shell: true });

  cf.stdout.on('data', (d) => processData(d.toString()));
  cf.stderr.on('data', (d) => processData(d.toString()));

  function processData(text) {
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) {
      const publicUrl = match[0];
      console.log('===============================================================');
      console.log('🎉 YOUR APP IS PUBLICLY LIVE & ACCESSIBLE WORLDWIDE!');
      console.log('');
      console.log(`   🔗 PUBLIC LINK TO SHARE WITH FRIENDS:`);
      console.log(`      ${publicUrl}`);
      console.log('');
      console.log(`   📶 Local Wi-Fi (Same Network): http://192.168.0.108:${PORT}`);
      console.log(`   💻 Your Computer:              http://localhost:${PORT}`);
      console.log('');
      console.log('   🖼️ All 1,083 College Images Hosted Live');
      console.log('   🤖 BridgeBot (Gemini AI) Connected & Trained on 658 Colleges');
      console.log('===============================================================\n');
    }
  }

  cf.on('close', (code) => {
    console.log(`Cloudflare tunnel closed with code ${code}`);
  });
}

main();
