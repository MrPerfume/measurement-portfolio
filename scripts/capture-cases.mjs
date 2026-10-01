import { chromium, expect } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

// 独立静态服务、临时浏览器资料与合成操作。无个人资料、真实账号或外部数据。
const server = spawn('php', ['-S', 'localhost:4187', '-t', '.pages-dist'], { stdio: ['ignore', 'ignore', 'pipe'] });
let context;
let profile;
const qaRoot = 'output/playwright/ux-20260915/raw';
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Preview startup timed out.')), 10000);
    server.once('error', (error) => { clearTimeout(timer); reject(error); });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('Preview server could not start.')); });
    server.stderr.on('data', (chunk) => { if (String(chunk).includes('started')) { clearTimeout(timer); resolve(); } });
  });
  profile = await mkdtemp(join(tmpdir(), 'measurement-portfolio-qa-'));
  context = await chromium.launchPersistentContext(profile, { headless: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', viewport: { width: 1440, height: 900 } });
  const page = context.pages()[0];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  console.log('Temporary browser: ' + chromium.executablePath());
  console.log(execFileSync('ps', ['-Ao', 'pid=,ppid=,args='], { encoding: 'utf8' }).split('\n').filter((line) => line.includes(profile)).join('\n'));
  await mkdir('assets/cases', { recursive: true });
  await mkdir(qaRoot, { recursive: true });
  const nav = (name) => page.locator('#scenario-nav').getByRole('button', { name, exact: true }).click();
  const role = (name) => page.locator('#role-buttons').getByRole('button', { name, exact: true }).click();
  const screenshot = async (path) => {
    await page.locator('.workspace-topbar').evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 108, behavior: 'instant' }));
    await page.screenshot({ path });
  };
  await page.goto('http://localhost:4187');
  await page.screenshot({ path: qaRoot + '/desktop-home.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nav('周报检');
  await page.getByLabel('压力仪表组', { exact: false }).check();
  await page.getByRole('button', { name: '建立周单草稿' }).click();
  await page.getByRole('button', { name: '发布并冻结范围' }).click();
  await role('检测方');
  await page.getByLabel('计划组', { exact: true }).selectOption('DEMO-GROUP-P');
  await page.getByRole('button', { name: '提交排期建议' }).click();
  await role('计量管理员');
  await page.getByRole('button', { name: '接受此建议' }).click();
  await page.getByRole('form', { name: '核对实际到场 · 压力仪表组' }).getByLabel('现场压力表 A', { exact: false }).check();
  await page.getByRole('button', { name: '确认本次到场' }).click();
  await screenshot('assets/cases/01-weekly.png');
  await nav('取回与领取');
  await page.getByLabel('当前送出轮次', { exact: true }).selectOption('DEMO-ROUND-0045');
  const transfer = page.getByRole('form', { name: '登记交接' });
  await transfer.getByLabel('演示在检仪表 1', { exact: false }).check();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('metering');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await transfer.getByLabel('演示在检仪表 2', { exact: false }).check();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('direct');
  await transfer.getByLabel('实际领取人（直领或领取必选）').selectOption('演示领取人甲');
  await transfer.getByLabel('使用部门（直领或领取必选）').selectOption('演示使用部门一');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await screenshot('assets/cases/02-returns.png');
  await nav('连续复核');
  await page.getByRole('button', { name: '执行匹配检查' }).click();
  await screenshot('assets/cases/03-review.png');
  for (const [name, viewport] of [['tablet', { width: 768, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    for (const scene of ['周报检', '取回与领取', '连续复核', '审计闭环']) {
      await nav(scene);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await screenshot(qaRoot + '/' + name + '-' + ({ 周报检: 'weekly', 取回与领取: 'returns', 连续复核: 'review', 审计闭环: 'audit' })[scene] + '.png');
    }
    await page.getByRole('link', { name: '返回作品集首页' }).click();
    // 导航本身允许平滑滚动；取证时固定到最终位置，不截取滚动中的中间帧。
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: qaRoot + '/' + name + '-home.png' });
  }
  // 以下直接截取操作后的视口，不重新定位截图：专门证明连续处理与失败反馈。
  await nav('连续复核');
  await page.getByLabel('当前证书 · 可切换查看', { exact: true }).selectOption('DEMO-CERT-001');
  await page.getByRole('button', { name: '执行匹配检查', exact: true }).click();
  await page.getByLabel('我已人工核对日期、结论与证据（合成演示）').check();
  await page.getByRole('button', { name: '确认复核并推进结果', exact: true }).click();
  await expect(page.getByRole('heading', { name: '复核工作区 · DEMO-CERT-002', exact: true })).toBeInViewport();
  await page.screenshot({ path: qaRoot + '/after-review-mobile.png' });
  await page.getByLabel('当前证书 · 可切换查看', { exact: true }).selectOption('DEMO-CERT-004');
  await page.getByLabel('复核备注（仅保存在本页）').fill('合成材料缺失，等待补齐');
  await page.getByRole('button', { name: '执行匹配检查', exact: true }).click();
  await page.getByRole('button', { name: '确认复核并推进结果', exact: true }).click();
  await expect(page.locator('#notice-region')).toBeInViewport();
  await page.screenshot({ path: qaRoot + '/missing-evidence-mobile.png' });
  for (let count = 0; count < 3; count++) await page.getByRole('button', { name: '跳过，保留待办', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本轮队列已处理完', exact: true })).toBeInViewport();
  await page.screenshot({ path: qaRoot + '/queue-end-mobile.png' });
  await nav('取回与领取');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await expect(page.locator('#notice-region')).toBeInViewport();
  await page.screenshot({ path: qaRoot + '/after-feedback-mobile.png' });
  expect(errors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  console.log('Captured three public prototype images and desktop/tablet/mobile QA. Browser errors/warnings: 0.');
} finally {
  await context?.close();
  if (profile && basename(profile).startsWith('measurement-portfolio-qa-')) await rm(profile, { recursive: true });
  server.kill('SIGTERM');
  await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  console.log('Temporary browser/profile and preview server closed.');
}
