const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/portal_audit');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('🚀 Launching Chromium for Comprehensive Portal-Wide Audit...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('React DevTools')) {
        errors.push(`[Console Error]: ${text}`);
      }
    }
  });

  page.on('pageerror', err => {
    errors.push(`[Page Error]: ${err.message}`);
  });

  const auditResults = [];

  // Helper to set session
  async function setSession(role = 'Manager', name = 'Audit User', email = 'audit@cynexai.com') {
    await page.evaluate(({ role, name, email }) => {
      localStorage.setItem('erp_session_token', JSON.stringify({
        id: `usr_${role.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name,
        email,
        role,
        salary: 100000
      }));
    }, { role, name, email });
  }

  try {
    // 1. Check Public Landing Page
    console.log('\n--- 1. Auditing Public Home Page (/) ---');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const homeTitle = await page.title();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_home_page.png') });
    console.log(`✅ Home Page Loaded: "${homeTitle}"`);
    auditResults.push({ module: 'Home Page', status: 'PASS', details: homeTitle });

    // 2. Check Public Payment Page (/pay)
    console.log('\n--- 2. Auditing Payment & Razorpay Page (/pay) ---');
    await page.goto(`${TARGET_URL}/pay`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const rzpBtn = page.locator('button:has-text("Razorpay")');
    const hasRzpBtn = await rzpBtn.isVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_payment_page.png') });
    console.log(`✅ Payment Page Loaded - Razorpay Button Visible: ${hasRzpBtn}`);
    auditResults.push({ module: 'Payment / Razorpay', status: hasRzpBtn ? 'PASS' : 'WARN', details: 'Razorpay button visible' });

    // 3. Check Assessment Portal (/test)
    console.log('\n--- 3. Auditing Assessment / Test Portal (/test) ---');
    await page.goto(`${TARGET_URL}/test`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    const testHeader = page.locator('h1, h2').first();
    const testHeaderText = await testHeader.textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_assessment_test.png') });
    console.log(`✅ Assessment Portal Loaded: "${testHeaderText?.trim()}"`);
    auditResults.push({ module: 'Assessment Portal', status: 'PASS', details: testHeaderText?.trim() });

    // 4. Check Manager Students Directory (/manager/students)
    console.log('\n--- 4. Auditing Manager Students Directory (/manager/students) ---');
    await setSession('Manager');
    await page.goto(`${TARGET_URL}/manager/students`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const studentCards = await page.locator('div.cursor-pointer:has(p.font-bold)').count();
    const studentsHeader = await page.locator('h1').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_manager_students.png') });
    console.log(`✅ Students Page Loaded: "${studentsHeader?.trim()}" with ${studentCards} student cards rendered`);
    auditResults.push({ module: 'Students Directory', status: studentCards > 0 ? 'PASS' : 'WARN', details: `${studentCards} student cards` });

    // 5. Check Manager Student Progress (/manager/student-progress)
    console.log('\n--- 5. Auditing Manager Student Progress (/manager/student-progress) ---');
    await page.goto(`${TARGET_URL}/manager/student-progress`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const progressHeader = await page.locator('h1').first().textContent();
    const progressRows = await page.locator('tbody tr').count();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_student_progress.png') });
    console.log(`✅ Student Progress Loaded: "${progressHeader?.trim()}" with ${progressRows} student progress rows`);
    auditResults.push({ module: 'Student Progress', status: progressRows > 0 ? 'PASS' : 'WARN', details: `${progressRows} rows` });

    // 6. Check CRM Sales Pipeline (/sales/pipeline)
    console.log('\n--- 6. Auditing CRM Sales Pipeline (/sales/pipeline) ---');
    await setSession('Sales/HR');
    await page.goto(`${TARGET_URL}/sales/pipeline`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const pipelineHeader = await page.locator('h1').first().textContent();
    const kanbanColumns = await page.locator('div:has-text("Qualified"), div:has-text("Lead In")').count();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_sales_pipeline.png') });
    console.log(`✅ Sales Pipeline Loaded: "${pipelineHeader?.trim()}"`);
    auditResults.push({ module: 'Sales Pipeline', status: 'PASS', details: pipelineHeader?.trim() });

    // 7. Check Sales Dashboard (/sales/dashboard)
    console.log('\n--- 7. Auditing Sales Dashboard (/sales/dashboard) ---');
    await page.goto(`${TARGET_URL}/sales/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const salesDashTitle = await page.locator('h1').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_sales_dashboard.png') });
    console.log(`✅ Sales Dashboard Loaded: "${salesDashTitle?.trim()}"`);
    auditResults.push({ module: 'Sales Dashboard', status: 'PASS', details: salesDashTitle?.trim() });

    // 8. Check Sales History (/sales/history)
    console.log('\n--- 8. Auditing Sales History (/sales/history) ---');
    await page.goto(`${TARGET_URL}/sales/history`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const salesHistoryHeader = await page.locator('h1').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_sales_history.png') });
    console.log(`✅ Sales History Loaded: "${salesHistoryHeader?.trim()}"`);
    auditResults.push({ module: 'Sales History', status: 'PASS', details: salesHistoryHeader?.trim() });

    // 9. Check Course Management (/manager/courses)
    console.log('\n--- 9. Auditing Course Management (/manager/courses) ---');
    await setSession('Manager');
    await page.goto(`${TARGET_URL}/manager/courses`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const coursesHeader = await page.locator('h1, h2').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_courses_management.png') });
    console.log(`✅ Course Management Loaded: "${coursesHeader?.trim()}"`);
    auditResults.push({ module: 'Course Management', status: 'PASS', details: coursesHeader?.trim() });

    // 10. Check Timetable Manager (/manager/timetable)
    console.log('\n--- 10. Auditing Timetable Manager (/manager/timetable) ---');
    await page.goto(`${TARGET_URL}/manager/timetable`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const timetableHeader = await page.locator('h1, h2').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_timetable.png') });
    console.log(`✅ Timetable Loaded: "${timetableHeader?.trim()}"`);
    auditResults.push({ module: 'Timetable', status: 'PASS', details: timetableHeader?.trim() });

    // 11. Check Teacher CMS & Timetable (/teacher/timetable)
    console.log('\n--- 11. Auditing Teacher Timetable (/teacher/timetable) ---');
    await setSession('Teacher');
    await page.goto(`${TARGET_URL}/teacher/timetable`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const teacherHeader = await page.locator('h1, h2').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_teacher_timetable.png') });
    console.log(`✅ Teacher Timetable Loaded: "${teacherHeader?.trim()}"`);
    auditResults.push({ module: 'Teacher Timetable', status: 'PASS', details: teacherHeader?.trim() });

    // 12. Check CEO Dashboard (/ceo/dashboard)
    console.log('\n--- 12. Auditing CEO Dashboard (/ceo/dashboard) ---');
    await setSession('CEO');
    await page.goto(`${TARGET_URL}/ceo/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const ceoHeader = await page.locator('h1, h2').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_ceo_dashboard.png') });
    console.log(`✅ CEO Dashboard Loaded: "${ceoHeader?.trim()}"`);
    auditResults.push({ module: 'CEO Dashboard', status: 'PASS', details: ceoHeader?.trim() });

    // 13. Check CEO Reports (/ceo/reports or /manager/approvals)
    console.log('\n--- 13. Auditing CEO Settings (/ceo/settings) ---');
    await page.goto(`${TARGET_URL}/ceo/settings`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const ceoSettingsHeader = await page.locator('h1, h2').first().textContent();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_ceo_settings.png') });
    console.log(`✅ CEO Settings Loaded: "${ceoSettingsHeader?.trim()}"`);
    auditResults.push({ module: 'CEO Settings', status: 'PASS', details: ceoSettingsHeader?.trim() });

    console.log('\n================================================================');
    console.log('📊 PORTAL-WIDE END-TO-END AUDIT SUMMARY');
    console.log('================================================================');
    for (const r of auditResults) {
      console.log(`[${r.status}] ${r.module.padEnd(24)}: ${r.details}`);
    }

    if (errors.length > 0) {
      console.log('\n⚠️ Console/Page Errors Detected during audit:');
      const uniqueErrors = Array.from(new Set(errors));
      for (const e of uniqueErrors.slice(0, 10)) {
        console.log(`  - ${e}`);
      }
    } else {
      console.log('\n✨ Zero unhandled errors detected across all tested modules!');
    }

  } catch (err) {
    console.error('Audit failed with error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'audit_failure.png') });
    throw err;
  } finally {
    await browser.close();
  }
})();
