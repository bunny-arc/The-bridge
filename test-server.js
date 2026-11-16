const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting The Bridge API and Backend Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  try {
    // 1. Health
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.collegesCount === 330, 'GET /api/health returns 330 colleges');

    // 2. Static HTML
    const html = await request('GET', '/');
    assert(html.status === 200 && html.text.includes('The Bridge'), 'GET / serves frontend index.html');

    // 3. Districts
    const dist = await request('GET', '/api/districts');
    assert(dist.status === 200 && dist.body.districts.length === 26, 'GET /api/districts returns 26 AP districts');

    // 4. Checklist
    const check = await request('GET', '/api/checklist');
    assert(check.status === 200 && check.body.checklist.length === 9, 'GET /api/checklist returns 9 documents');

    // 5. Multipliers
    const mult = await request('GET', '/api/multipliers');
    assert(mult.status === 200 && mult.body.multipliers.categoryMultipliers.SC === 2.35, 'GET /api/multipliers returns category multipliers');

    // 6. Colleges list & search
    const allColleges = await request('GET', '/api/colleges');
    assert(allColleges.status === 200 && allColleges.body.total === 330, 'GET /api/colleges returns all 330 colleges');

    const auceSearch = await request('GET', '/api/colleges?search=AUCE');
    assert(auceSearch.status === 200 && auceSearch.body.colleges.some(c => c.code === 'AUCE'), 'GET /api/colleges?search=AUCE returns AUCE');

    const singleCollege = await request('GET', '/api/colleges/AUCE');
    assert(singleCollege.status === 200 && singleCollege.body.college.name.includes('Andhra University'), 'GET /api/colleges/AUCE returns college details');

    const jeeColleges = await request('GET', '/api/colleges?exam=jee_main');
    assert(jeeColleges.status === 200 && jeeColleges.body.total === 5, 'GET /api/colleges?exam=jee_main returns 5 colleges');

    const pagination = await request('GET', '/api/colleges?page=1&limit=10');
    assert(pagination.status === 200 && pagination.body.colleges.length === 10 && pagination.body.totalPages === 33, 'GET /api/colleges with pagination works');

    // 7. OTP Send & Verify
    const otpSend = await request('POST', '/api/otp/send', {
      email: 'student.test@example.com',
      phone: '9876543210'
    });
    assert(otpSend.status === 200 && otpSend.body.ok, 'POST /api/otp/send dispatches codes');

    const otpFail = await request('POST', '/api/otp/verify', {
      channel: 'email',
      target: 'student.test@example.com',
      code: '999999'
    });
    assert(otpFail.status === 400, 'POST /api/otp/verify rejects invalid code');

    const otpPass = await request('POST', '/api/otp/verify', {
      channel: 'email',
      target: 'student.test@example.com',
      code: '000000'
    });
    assert(otpPass.status === 200 && otpPass.body.verified, 'POST /api/otp/verify accepts dev code 000000');

    // 8. Auth / Registration
    const signup = await request('POST', '/api/login/complete', {
      email: 'student.test@example.com',
      phone: '9876543210',
      username: 'studenttest',
      password: 'password123'
    });
    assert(signup.status === 200 && signup.body.token, 'POST /api/login/complete creates user and issues JWT');
    const token = signup.body.token;

    const loginFail = await request('POST', '/api/login', {
      email: 'student.test@example.com',
      password: 'wrongpassword'
    });
    assert(loginFail.status === 401, 'POST /api/login rejects wrong password');

    const loginSuccess = await request('POST', '/api/login', {
      email: 'student.test@example.com',
      password: 'password123'
    });
    assert(loginSuccess.status === 200 && loginSuccess.body.token, 'POST /api/login accepts correct credentials');

    // 9. Authenticated Profile & History
    const profileSave = await request('POST', '/api/profile', {
      profile: { fullName: 'Suresh Kumar', gender: 'male', interPct: 95.5 },
      prefs: { exam: 'ap_cet', rank: 4500, category: 'BC_B', branch: 'CSE' }
    }, token);
    assert(profileSave.status === 200 && profileSave.body.ok, 'POST /api/profile saves authenticated profile');

    const profileGet = await request('GET', '/api/profile', null, token);
    assert(profileGet.status === 200 && profileGet.body.profile.fullName === 'Suresh Kumar', 'GET /api/profile retrieves profile');

    const historySave = await request('POST', '/api/history', {
      history: [
        {
          id: 101,
          ts: Date.now(),
          manual: true,
          exam: 'ap_cet',
          rank: 4500,
          category: 'BC_B',
          items: [
            { collegeId: 'c1', branchCode: 'CSE' },
            { collegeId: 'c2', branchCode: 'ECE' }
          ]
        }
      ]
    }, token);
    assert(historySave.status === 200 && historySave.body.count === 1, 'POST /api/history saves priority snapshot');

    const historyGet = await request('GET', '/api/history', null, token);
    assert(historyGet.status === 200 && historyGet.body.history.length === 1, 'GET /api/history retrieves user history');

    // 10. Send Priority List Email
    const sendPriority = await request('POST', '/api/send-priority', {
      to: 'student.test@example.com',
      cc: 'parent@example.com',
      name: 'Suresh Kumar',
      exam: 'ap_cet',
      rank: 4500,
      category: 'BC_B',
      lines: [
        '#1 AUCE - Andhra University College of Engineering [CSE]',
        '#2 JNTUK - JNTU College of Engineering Kakinada [CSE]',
        '#3 VRSEC - Velagapudi Ramakrishna Siddhartha Eng College [CSE]'
      ]
    });
    assert(sendPriority.status === 200 && sendPriority.body.ok, 'POST /api/send-priority dispatches formatted email');

    // 11. Password Reset
    const forgot = await request('POST', '/api/forgot', { email: 'student.test@example.com' });
    assert(forgot.status === 200 && forgot.body.ok, 'POST /api/forgot initiates password reset');

    const reset = await request('POST', '/api/reset', {
      email: 'student.test@example.com',
      code: '000000',
      password: 'newpassword456'
    });
    assert(reset.status === 200 && reset.body.ok, 'POST /api/reset updates password');

    const loginWithNew = await request('POST', '/api/login', {
      email: 'student.test@example.com',
      password: 'newpassword456'
    });
    assert(loginWithNew.status === 200 && loginWithNew.body.token, 'POST /api/login succeeds with newly reset password');

    console.log(`\n========================================`);
    console.log(`🎉 TEST SUMMARY: ${passed} / ${total} Tests Passed!`);
    console.log(`========================================\n`);

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
