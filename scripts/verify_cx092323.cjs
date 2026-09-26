const { chromium } = require('@playwright/test');
const path = require('path');

async function testCert() {
  console.log('Testing live production CX092323 and C102097...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Test 1: CX092323
  console.log('Navigating to https://cynexai.in/certificates/CX092323 ...');
  await page.goto('https://cynexai.in/certificates/CX092323', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const cx092323Path = 'C:/Users/kk/.gemini/antigravity/brain/af929d1f-422b-42e9-83b6-818103acbc95/live_prod_cx092323.png';
  await page.screenshot({ path: cx092323Path, fullPage: true });
  console.log('Screenshot saved to', cx092323Path);

  // Test 2: C102097
  console.log('Navigating to https://cynexai.in/certificates/C102097 ...');
  await page.goto('https://cynexai.in/certificates/C102097', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const c102097Path = 'C:/Users/kk/.gemini/antigravity/brain/af929d1f-422b-42e9-83b6-818103acbc95/live_prod_c102097.png';
  await page.screenshot({ path: c102097Path, fullPage: true });
  console.log('Screenshot saved to', c102097Path);

  await browser.close();
  console.log('Finished live verification!');
}

testCert().catch(console.error);
