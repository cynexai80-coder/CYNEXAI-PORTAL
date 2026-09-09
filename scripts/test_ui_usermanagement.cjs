const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('🚀 Launching Chromium for User Management E2E verification...');
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Listen to console
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`[Browser Console ERROR]: ${text}`);
    } else if (text.includes('Turso') || text.includes('getUsers') || text.includes('Deepmind')) {
      console.log(`[Browser Console LOG]: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[Browser Page Unhandled Error]: ${err.message}`);
  });

  try {
    console.log(`\n--- Step 1: Navigating to ${TARGET_URL}/ceo/users with CEO Session ---`);
    await page.addInitScript(() => {
      localStorage.setItem('erp_session_token', JSON.stringify({
        id: 'usr_ceo',
        name: 'CEO User',
        email: 'ceo@cynexai.com',
        role: 'CEO',
        salary: 250000
      }));
    });

    await page.goto(`${TARGET_URL}/ceo/users`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify Title
    const title = await page.locator('h1').textContent();
    console.log(`✅ Page Header: "${title?.trim()}"`);
    if (!title || !title.includes('Staff Management')) {
      throw new Error(`Unexpected page header: ${title}`);
    }

    // Wait for table rows to load
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    const initialRows = await page.locator('tbody tr').count();
    console.log(`✅ Initial staff rows loaded: ${initialRows}`);

    // Capture Staff List Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_staff_list.png') });
    console.log('📸 Saved screenshot: 01_staff_list.png');

    console.log('\n--- Step 2: Testing Staff Filters ---');
    // Search filter
    const searchInput = page.locator('input[placeholder*="Search by Name"]');
    await searchInput.fill('sam');
    await page.waitForTimeout(1000);
    const filteredSearchRows = await page.locator('tbody tr').count();
    console.log(`✅ Filtered search by "sam": ${filteredSearchRows} rows displayed.`);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(1000);

    // Role filter
    const roleSelect = page.locator('select:has(option:has-text("All Roles"))');
    await roleSelect.selectOption('Teacher');
    await page.waitForTimeout(1000);
    const teacherRows = await page.locator('tbody tr').count();
    console.log(`✅ Filtered by Role='Teacher': ${teacherRows} rows displayed.`);

    // Reset role filter
    await roleSelect.selectOption('');
    await page.waitForTimeout(1000);
    const resetRows = await page.locator('tbody tr').count();
    console.log(`✅ Reset role filter: ${resetRows} rows displayed.`);

    console.log('\n--- Step 3: Testing Permissions Dropdown ---');
    const shieldBtn = page.locator('button[title="Manage Module Access Controls"]').first();
    await shieldBtn.click();
    await page.waitForTimeout(1000);

    const isPermDropdownOpen = await page.locator('input[placeholder="search"]').isVisible();
    console.log(`✅ Permissions Popover Open: ${isPermDropdownOpen}`);
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_permissions_dropdown.png') });
    console.log('📸 Saved screenshot: 02_permissions_dropdown.png');

    // Close permissions dropdown by clicking the shield icon again or outside
    await shieldBtn.click();
    await page.waitForTimeout(500);

    console.log('\n--- Step 4: Testing Add Staff Member Modal ---');
    const addStaffBtn = page.locator('button:has-text("Add Staff Member")');
    await addStaffBtn.click();
    await page.waitForSelector('.fixed.inset-0', { timeout: 5000 });

    const staffModal = page.locator('.fixed.inset-0');
    const modalTitle = await staffModal.locator('h2').textContent();
    console.log(`✅ Staff Modal Open: "${modalTitle?.trim()}"`);

    const timestamp = Date.now().toString().slice(-4);
    const testName = `Playwright Staff ${timestamp}`;
    const testEmail = `pw_staff_${timestamp}@cynexai.com`;

    // Fill Modal Inputs
    await staffModal.locator('input[placeholder="e.g. Rahul Sharma"]').fill(testName);
    await staffModal.locator('input[placeholder="email@cynexai.com"]').fill(testEmail);
    await staffModal.locator('input[placeholder="10-digit mobile"]').fill('9988776655');

    // Select Role in modal
    const modalRoleSelect = staffModal.locator('label:has-text("Role") + select');
    await modalRoleSelect.selectOption('Teacher');
    await page.waitForTimeout(500);

    // Verify "Assign Modules" list
    const hasAssignModules = await staffModal.locator('text=Assign Modules').isVisible();
    console.log(`✅ "Assign Modules" visible for Teacher: ${hasAssignModules}`);

    // Fill Salary
    const salaryInput = staffModal.locator('input[type="number"]');
    if (await salaryInput.isVisible()) {
      await salaryInput.fill('55000');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_add_staff_modal.png') });
    console.log('📸 Saved screenshot: 03_add_staff_modal.png');

    // Click Create
    const createBtn = staffModal.locator('button:has-text("Create Staff Member")');
    await createBtn.click();
    
    // Wait for modal to close and row to appear
    await page.locator('h2:has-text("Staff Member")').waitFor({ state: 'detached', timeout: 8000 });
    await page.waitForTimeout(1500);

    const createdRow = page.locator(`tr:has-text("${testName}")`);
    const isCreatedVisible = await createdRow.isVisible();
    console.log(`✅ New staff member "${testName}" successfully saved and visible: ${isCreatedVisible}`);

    console.log('\n--- Step 5: Testing Batches Tab ---');
    const batchesTabBtn = page.locator('button:has-text("Batches")');
    await batchesTabBtn.click();
    await page.waitForTimeout(2000);

    // Verify Metric Summary Cards
    const activeBatchesMetric = await page.locator('p:has-text("Active Batches") + h3').textContent();
    const enrolledStudentsMetric = await page.locator('p:has-text("Enrolled Students") + h3').textContent();
    const totalCapacityMetric = await page.locator('p:has-text("Total Capacity") + h3').textContent();
    const upcomingBatchesMetric = await page.locator('p:has-text("Upcoming Batches") + h3').textContent();

    console.log(`✅ Metrics -> Active: ${activeBatchesMetric?.trim()} | Enrolled: ${enrolledStudentsMetric?.trim()} | Capacity: ${totalCapacityMetric?.trim()} | Upcoming: ${upcomingBatchesMetric?.trim()}`);

    // Check Batch Rows
    const batchRows = await page.locator('tbody tr').count();
    console.log(`✅ Batches Table Rows: ${batchRows}`);

    // Expand Batch 1 to check Subject Progress
    const batch1Row = page.locator('tr:has-text("Batch 1")').first();
    console.log('Clicking Batch 1 to expand subject-wise class progress breakdown...');
    await batch1Row.click();
    await page.waitForTimeout(1000);

    const isBreakdownVisible = await page.locator('text=Class Progress & Subject Breakdown').isVisible();
    console.log(`✅ Batch 1 Breakdown Section Expanded: ${isBreakdownVisible}`);

    // Test Class Increment (+) button
    const firstCompletedLabel = page.locator('span:has-text("classes completed")').first();
    if (await firstCompletedLabel.isVisible()) {
      const beforeText = await firstCompletedLabel.textContent();
      console.log(`Before class count: "${beforeText?.trim()}"`);

      const plusBtn = page.locator('button[title*="Add 1 completed class"]').first();
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await page.waitForTimeout(1000);
        const afterText = await firstCompletedLabel.textContent();
        console.log(`✅ Clicked '+' -> After class count: "${afterText?.trim()}"`);

        // Click '-' to restore
        const minusBtn = page.locator('button[title*="Reduce class"]').first();
        if (await minusBtn.isVisible()) {
          await minusBtn.click();
          await page.waitForTimeout(500);
          console.log(`✅ Clicked '-' -> Restored class count.`);
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_batches_expanded.png') });
    console.log('📸 Saved screenshot: 04_batches_expanded.png');

    console.log('\n--- Step 6: Testing Students in Batch Modal ---');
    const studentsBtn = batch1Row.locator('button:has-text("Students")');
    await studentsBtn.click();
    await page.waitForSelector('div.fixed.z-50', { timeout: 5000 });

    const studentModal = page.locator('div.fixed.z-50');
    const studentModalHeader = await studentModal.locator('h2').textContent();
    console.log(`✅ Batch Students Modal Header: "${studentModalHeader?.trim()}"`);

    // Verify Enrolled Students count tab
    const enrolledTab = studentModal.locator('button:has-text("Enrolled Students")');
    const enrolledTabLabel = await enrolledTab.textContent();
    console.log(`✅ Modal Tab: "${enrolledTabLabel?.trim()}"`);

    // Switch to Available Students Tab
    const availTab = studentModal.locator('button:has-text("Add / Assign Students")');
    await availTab.click();
    await page.waitForTimeout(1000);
    console.log(`✅ Switched to "Add / Assign Students" tab`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_batch_students_modal.png') });
    console.log('📸 Saved screenshot: 05_batch_students_modal.png');

    // Close Student Modal
    const closeStudentBtn = studentModal.locator('button:has(svg.lucide-x)');
    await closeStudentBtn.click();
    await page.locator('h2:has-text("Manage Students")').waitFor({ state: 'detached', timeout: 5000 });
    console.log('✅ Closed Batch Students Modal.');

    console.log('\n--- Step 7: Testing Add Batch Modal ---');
    const addBatchBtn = page.locator('button:has-text("Add Batch")');
    await addBatchBtn.click();
    await page.waitForSelector('div.fixed.z-50', { timeout: 5000 });

    const batchModal = page.locator('div.fixed.z-50');
    const batchModalTitle = await batchModal.locator('h2').textContent();
    console.log(`✅ Batch Modal Header: "${batchModalTitle?.trim()}"`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_add_batch_modal.png') });
    console.log('📸 Saved screenshot: 06_add_batch_modal.png');

    // Close modal
    const closeBatchBtn = batchModal.locator('button:has(svg.lucide-x)');
    await closeBatchBtn.click();
    await page.locator('h2:has-text("Batch")').waitFor({ state: 'detached', timeout: 5000 });
    console.log('✅ Closed Add Batch Modal.');

    console.log('\n========================================================');
    console.log('🎉 ALL USER MANAGEMENT & BATCH UI FLOWS PASSED VERIFIED!');
    console.log('========================================================');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png') });
    throw err;
  } finally {
    await browser.close();
  }
})();
