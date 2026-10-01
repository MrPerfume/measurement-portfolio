import { test, expect } from '@playwright/test';

const nav = (page, name) => page.locator('#scenario-nav').getByRole('button', { name, exact: true }).click();
const role = (page, name) => page.locator('#role-buttons').getByRole('button', { name, exact: true }).click();
const status = (page) => page.locator('#notice-region');
const form = (page, name) => page.getByRole('form', { name, exact: true });
const scope = (page) => page.locator('#scenario-content');
const reference = '2026-09-07';

test('发布资源版本隔离旧脚本并覆盖整个模块依赖图', async ({ page }) => {
  const versions = [];
  await page.route('**/*.mjs*', async (route) => {
    const version = new URL(route.request().url()).searchParams.get('v');
    versions.push(version);
    if (!version) await route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("stale module must not load")' });
    else await route.continue();
  });
  await page.reload();
  await expect(page.locator('#workspace-title')).toHaveText('计划外收件');
  expect(versions.length).toBeGreaterThanOrEqual(7);
  expect(new Set(versions).size).toBe(1);
  expect(versions[0]).toMatch(/^[a-f0-9]{16}$/);
  const styles = await page.locator('link[rel="stylesheet"]').getAttribute('href');
  expect(styles).toBe('styles.css?v=' + versions[0]);
});

test('场景直达、无效参数和旧锚点兼容', async ({ page }, testInfo) => {
  await page.screenshot({ path: 'output/playwright/entry-20261001/raw/' + testInfo.project.name + '-home.png' });
  for (const [id, label] of [['weekly','周报检'], ['intake','计划外收件'], ['lab','在检跟进'], ['returns','取回与领取'], ['certificate','连续复核'], ['audit','审计闭环']]) {
    await page.goto('/?scenario=' + id + '#demo');
    await expect(page.locator('#workspace-title')).toHaveText(label);
    await expect(page.locator('#demo-title')).toBeFocused();
    await expectInWorkingViewport(page.locator('#demo-title'));
    await expect(page.locator('#event-count')).toHaveText('1 条事件');
    if (['weekly', 'returns', 'certificate'].includes(id)) await page.screenshot({ path: 'output/playwright/entry-20261001/raw/' + testInfo.project.name + '-' + id + '.png' });
  }
  await page.goto('/?scenario=%3Cinvalid%3E#demo');
  await expect(page.locator('#workspace-title')).toHaveText('计划外收件');
  for (const id of ['top', 'demo', 'evidence']) {
    await page.goto('/#' + id);
    await expect(page.locator('#' + id)).toBeInViewport();
  }
});

test('地址导航保留角色草稿与事实，刷新和重置恢复初始状态', async ({ page }) => {
  await page.getByRole('button', { name: '接收正常设备', exact: true }).click();
  const events = await page.locator('#event-count').textContent();
  await page.getByRole('button', { name: '从分批取回开始' }).click();
  await expect(page).toHaveURL(/\?scenario=returns#demo$/);
  const time = form(page, '登记交接').getByLabel('实际交接时间（北京时间）');
  await time.fill(reference + 'T12:30');
  await role(page, '管理者');
  await nav(page, '审计闭环');
  await page.goBack();
  await expect(page.locator('#workspace-title')).toHaveText('取回与领取');
  await expect(time).toHaveValue(reference + 'T12:30');
  await expect(page.locator('#role-buttons [aria-pressed="true"]')).toHaveText('管理者');
  await page.goForward();
  await expect(page.locator('#workspace-title')).toHaveText('审计闭环');
  await expect(page.locator('#event-count')).toHaveText(events);
  await page.getByRole('button', { name: '从分批取回开始' }).click();
  await expect(time).toHaveValue(reference + 'T12:30');
  await expect(page.locator('#role-buttons [aria-pressed="true"]')).toHaveText('管理者');
  await page.reload();
  await expect(page.locator('#workspace-title')).toHaveText('取回与领取');
  await expect(page.locator('#event-count')).toHaveText('1 条事件');
  await expect(page.locator('#role-buttons [aria-pressed="true"]')).toHaveText('计量管理员');
  await expect(time).not.toHaveValue(reference + 'T12:30');
  await page.getByRole('button', { name: '重置演示' }).click();
  await expect(page.locator('#workspace-title')).toHaveText('计划外收件');
  expect(new URL(page.url()).searchParams.has('scenario')).toBe(false);
});

// 可见不等于在视口内：防止操作成功后只剩按钮、对象标题和失败原因滚出屏幕。
async function expectInWorkingViewport(locator) {
  await expect(locator).toBeInViewport();
  const box = await locator.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(80); // 留出固定页头。
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://localhost:4187') errors.push('Unexpected request: ' + request.url());
  });
  await page.goto('/');
  await expect(page.locator('#workspace-title')).toHaveText('计划外收件');
  page._portfolioErrors = errors;
});

test.afterEach(async ({ page, context }) => {
  expect(page._portfolioErrors).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('收件→送出→跨角色在检→混合取回→证书→审计闭环', async ({ page }) => {
  await page.getByRole('button', { name: '接收正常设备', exact: true }).click();
  await page.getByRole('button', { name: '形成送出轮次', exact: true }).click();
  await nav(page, '在检跟进');
  await role(page, '检测方');
  await expect(page.locator('[data-round-id="DEMO-ROUND-NEW-1"]')).toContainText('在检 2 台');
  await role(page, '计量管理员');
  const execution = form(page, '登记实际校验结果');
  await execution.getByLabel('数字压力表', { exact: false }).check();
  await execution.getByLabel('温度变送器', { exact: false }).check();
  await execution.getByLabel('校验结论', { exact: true }).selectOption('pass');
  await execution.getByLabel('我确认所选设备已实际完成校验（合成演示事实）').check();
  await execution.getByRole('button', { name: '确认登记结果' }).click();
  await page.getByRole('button', { name: '载入合成证书', exact: true }).click();
  await nav(page, '取回与领取');
  let transfer = form(page, '登记交接');
  await transfer.getByLabel('数字压力表', { exact: false }).check();
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await expect(status(page)).toContainText('明确选择交接方式');
  await expect(transfer.getByLabel('数字压力表', { exact: false })).toBeChecked();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('metering');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await expect(scope(page).locator('[data-object-id="DEMO-EQ-0001"]')).toContainText('待领取');
  transfer = form(page, '登记交接');
  await transfer.getByLabel('温度变送器', { exact: false }).check();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('direct');
  await transfer.getByLabel('实际领取人（直领或领取必选）').selectOption('演示领取人甲');
  await transfer.getByLabel('使用部门（直领或领取必选）').selectOption('演示使用部门一');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  transfer = form(page, '确认计量室领取');
  await transfer.getByLabel('数字压力表', { exact: false }).check();
  await transfer.getByLabel('实际领取人（直领或领取必选）').selectOption('演示领取人乙');
  await transfer.getByLabel('使用部门（直领或领取必选）').selectOption('演示使用部门二');
  await transfer.getByRole('button', { name: '确认计量室领取' }).click();
  await expect(scope(page)).toContainText('本轮实物已全部领取');
  await nav(page, '连续复核');
  for (const id of ['DEMO-CERT-AUTO-1', 'DEMO-CERT-AUTO-2']) {
    await page.locator('.certificate-queue').getByRole('button', { name: new RegExp(id) }).click();
    await page.getByRole('button', { name: '执行匹配检查', exact: true }).click();
    await page.getByLabel('我已人工核对日期、结论与证据（合成演示）').check();
    await page.getByRole('button', { name: '确认复核并推进结果', exact: true }).click();
  }
  await nav(page, '取回与领取');
  await expect(scope(page).locator('.metric-row')).toContainText('2 / 2');
  await nav(page, '计划外收件');
  await expect(scope(page).locator('[data-object-id="DEMO-EQ-0001"]')).toContainText('已领取');
  await nav(page, '审计闭环');
  await expect(scope(page)).toContainText('检测单位直领完成');
  await expect(scope(page)).toContainText('人工复核已确认');
});

test('周单发布、排期版本、分次到场和证据完整关闭', async ({ page }) => {
  await nav(page, '周报检');
  const create = form(page, '从计划组建立周单');
  await expect(scope(page).locator('.metric-row')).toHaveCount(0);
  expect(await create.evaluate((element) => element.offsetTop < element.parentElement.querySelector('.rule-callout').offsetTop)).toBe(true);
  await create.getByLabel('压力仪表组', { exact: false }).check();
  await create.getByRole('button', { name: '建立周单草稿' }).click();
  await page.getByRole('button', { name: '发布并冻结范围' }).click();
  await role(page, '检测方');
  let proposal = form(page, '提出排期或改期建议');
  await proposal.getByLabel('计划组', { exact: true }).selectOption('DEMO-GROUP-P');
  await proposal.getByRole('button', { name: '提交排期建议' }).click();
  await role(page, '计量管理员');
  await expect(form(page, '提出排期或改期建议')).toHaveCount(0);
  expect(await page.locator('.pending-proposals').evaluate((element) => element.offsetTop < element.parentElement.querySelector('.history-panel').offsetTop)).toBe(true);
  await page.getByRole('button', { name: '接受此建议' }).click();
  await expect(scope(page)).toContainText('正式预约 1 / 1 组');
  await role(page, '检测方');
  proposal = form(page, '提出排期或改期建议');
  await proposal.getByLabel('建议开始（北京时间）').fill(reference + 'T13:00');
  await proposal.getByLabel('建议结束（北京时间）').fill(reference + 'T15:00');
  await proposal.getByLabel('改期原因（已有预约时必填）').fill('演示：调整到场时段');
  await proposal.getByRole('button', { name: '提交排期建议' }).click();
  await expect(scope(page).locator('.appointment')).toContainText('09:00');
  await role(page, '计量管理员');
  await page.getByRole('button', { name: '拒绝此建议' }).click();
  await expect(scope(page).locator('.appointment')).toContainText('09:00');
  for (const name of ['现场压力表 A', '现场压力表 B']) {
    const attendance = form(page, '核对实际到场 · 压力仪表组');
    await attendance.getByLabel(name, { exact: false }).check();
    await attendance.getByRole('button', { name: '确认本次到场' }).click();
    if (name === '现场压力表 A') {
      await expect(attendance.getByRole('checkbox')).toHaveCount(1);
      await expect(attendance).toContainText('尚有 1 台未到场');
      await role(page, '管理者');
      await expect(form(page, '核对实际到场 · 压力仪表组')).toHaveCount(0);
      await expect(scope(page)).toContainText('已核对到场');
      await role(page, '计量管理员');
    }
  }
  await expect(scope(page)).toContainText('到场记录 2 次');
  const execution = form(page, '登记实际校验结果');
  await execution.getByLabel('现场压力表 A', { exact: false }).check();
  await execution.getByLabel('现场压力表 B', { exact: false }).check();
  await execution.getByLabel('校验结论', { exact: true }).selectOption('pass');
  await execution.getByLabel('我确认所选设备已实际完成校验（合成演示事实）').check();
  await execution.getByRole('button', { name: '确认登记结果' }).click();
  await page.getByRole('button', { name: '载入合成证书' }).click();
  await nav(page, '连续复核');
  for (const id of ['DEMO-CERT-AUTO-1', 'DEMO-CERT-AUTO-2']) {
    await page.locator('.certificate-queue').getByRole('button', { name: new RegExp(id) }).click();
    await page.getByRole('button', { name: '执行匹配检查' }).click();
    await page.getByLabel('我已人工核对日期、结论与证据（合成演示）').check();
    await page.getByRole('button', { name: '确认复核并推进结果' }).click();
  }
  await nav(page, '周报检');
  await expect(scope(page)).toContainText('已闭环 · 只读');
  await nav(page, '在检跟进');
  await expect(page.locator('.round-card')).toHaveCount(3);
});

test('仅关联、复选幂等、缺证失败保留输入和跳过', async ({ page }) => {
  await nav(page, '连续复核');
  const queue = page.locator('.certificate-queue');
  await queue.getByRole('button', { name: /DEMO-CERT-002/ }).click();
  await expect(page.locator('.candidate-list .score-high')).toHaveText('96');
  await expect(page.locator('.candidate-list .score-low')).toHaveText('78');
  await page.getByRole('button', { name: '执行匹配检查' }).click();
  await page.getByRole('button', { name: '仅确认关联', exact: true }).click();
  const count = await page.locator('#event-count').textContent();
  await queue.getByRole('button', { name: /DEMO-CERT-002/ }).click();
  await page.locator('.candidate-list').getByRole('button').first().click();
  await page.getByRole('button', { name: '仅确认关联', exact: true }).click();
  await expect(page.locator('#event-count')).toHaveText(count);
  await queue.getByRole('button', { name: /DEMO-CERT-004/ }).click();
  await page.getByLabel('复核备注（仅保存在本页）').fill('演示：等待补充材料');
  await page.getByRole('button', { name: '执行匹配检查' }).click();
  await page.getByRole('button', { name: '确认复核并推进结果' }).click();
  await expect(status(page)).toContainText('证据缺失');
  await expect(page.getByLabel('复核备注（仅保存在本页）')).toHaveValue('演示：等待补充材料');
  await page.getByRole('button', { name: '跳过，保留待办' }).click();
  await expect(queue.getByRole('button', { name: /DEMO-CERT-004/ })).toContainText('已跳过');
});

test('角色切换与来源返回保留输入，管理者只读', async ({ page }) => {
  await nav(page, '取回与领取');
  const transfer = form(page, '登记交接');
  await transfer.getByLabel('实际交接时间（北京时间）').fill(reference + 'T12:30');
  await role(page, '管理者');
  await expect(page.locator('#workspace-title')).toHaveText('取回与领取');
  await expect(transfer.getByRole('button', { name: '登记取回', exact: true })).toBeDisabled();
  await role(page, '计量管理员');
  await expect(transfer.getByLabel('实际交接时间（北京时间）')).toHaveValue(reference + 'T12:30');
  await transfer.getByLabel('演示在检仪表 1', { exact: false }).check();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('metering');
  await transfer.getByLabel('实际交接时间（北京时间）').fill('');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await expect(status(page)).toContainText('时间');
  await expect(transfer.getByLabel('实际交接时间（北京时间）')).toHaveValue('');
  await expect(transfer.getByLabel('演示在检仪表 1', { exact: false })).toBeChecked();
  await nav(page, '连续复核');
  await page.getByRole('button', { name: '返回来源轮次' }).click();
  await expect(page.locator('#workspace-title')).toHaveText('在检跟进');
});

test('所有场景可读、键盘跳转、减少动效、空队列与重置', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  const keyboardRole = page.locator('#role-buttons').getByRole('button', { name: '计量管理员', exact: true });
  await keyboardRole.focus();
  await page.keyboard.down(' ');
  expect(await keyboardRole.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  expect(await keyboardRole.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.keyboard.up(' ');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const name of ['周报检', '计划外收件', '在检跟进', '取回与领取', '连续复核', '审计闭环']) {
    await nav(page, name);
    await expect(page.locator('#workspace-title')).toHaveText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await nav(page, '连续复核');
  for (let count = 0; count < 4; count++) await page.getByRole('button', { name: '跳过，保留待办' }).click();
  await expect(scope(page)).toContainText('本轮队列已处理完');
  const reset = page.getByRole('button', { name: '重置演示' });
  await reset.hover();
  await page.mouse.down();
  expect(await reset.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.mouse.up();
  await expect(page.locator('#event-count')).toHaveText('1 条事件');
  await page.getByRole('button', { name: '接收正常设备', exact: true }).click();
  await page.reload();
  await expect(page.locator('#event-count')).toHaveText('1 条事件');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test('连续复核换份后定位当前材料，失败原因就近可见', async ({ page }) => {
  await nav(page, '连续复核');
  await page.getByRole('button', { name: '执行匹配检查', exact: true }).click();
  await page.getByLabel('我已人工核对日期、结论与证据（合成演示）').check();
  await page.getByRole('button', { name: '确认复核并推进结果', exact: true }).click();
  const current = page.getByRole('heading', { name: '复核工作区 · DEMO-CERT-002', exact: true });
  await expectInWorkingViewport(current);
  await expect(current).toBeFocused();
  await page.getByLabel('当前证书 · 可切换查看', { exact: true }).selectOption('DEMO-CERT-001');
  await expectInWorkingViewport(page.getByRole('heading', { name: '复核工作区 · DEMO-CERT-001', exact: true }));
  await expect(page.getByRole('button', { name: '确认复核并推进结果', exact: true })).toBeDisabled();
  await page.locator('.certificate-queue').getByRole('button', { name: /DEMO-CERT-004/ }).click();
  await page.getByLabel('复核备注（仅保存在本页）').fill('合成：缺证后继续核对');
  await page.getByRole('button', { name: '执行匹配检查', exact: true }).click();
  await page.getByRole('button', { name: '确认复核并推进结果', exact: true }).click();
  await expect(status(page)).toContainText('证据缺失');
  await expectInWorkingViewport(status(page));
  await expect(status(page)).toBeFocused();
  await expect(page.getByLabel('复核备注（仅保存在本页）')).toHaveValue('合成：缺证后继续核对');
});

test('交接失败可见，取回与领取只展示各自可操作设备', async ({ page }) => {
  await nav(page, '取回与领取');
  const transfer = form(page, '登记交接');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  await expect(status(page)).toContainText('至少选择');
  await expectInWorkingViewport(status(page));
  await expect(status(page)).toBeFocused();
  await transfer.getByLabel('演示在检仪表 1', { exact: false }).check();
  await transfer.getByLabel('交接方式', { exact: true }).selectOption('metering');
  await transfer.getByRole('button', { name: '登记取回', exact: true }).click();
  const pickup = form(page, '确认计量室领取');
  await page.getByRole('navigation', { name: '交接任务', exact: true }).getByRole('button', { name: '确认领取 · 1 台', exact: true }).click();
  await expectInWorkingViewport(pickup.locator('legend'));
  await expect(pickup.locator('legend')).toBeFocused();
  await expect(transfer.getByRole('checkbox')).toHaveCount(1);
  await expect(pickup.getByRole('checkbox')).toHaveCount(1);
  await expect(transfer.getByLabel('演示在检仪表 1', { exact: false })).toHaveCount(0);
  await expect(pickup.getByLabel('交接方式', { exact: true })).toHaveCount(0);
  await pickup.getByLabel('演示在检仪表 1', { exact: false }).check();
  await pickup.getByRole('button', { name: '确认计量室领取', exact: true }).click();
  await expect(status(page)).toContainText('领取人');
  await expectInWorkingViewport(status(page));
  await role(page, '管理者');
  await expect(pickup.getByRole('checkbox')).toBeDisabled();
  await role(page, '计量管理员');
  await expect(pickup.getByRole('checkbox')).toBeChecked();
});

test('多计划组同屏时失败反馈归属实际提交的预约', async ({ page }) => {
  await nav(page, '周报检');
  await page.getByLabel('压力仪表组', { exact: false }).check();
  await page.getByLabel('温度仪表组', { exact: false }).check();
  await page.getByRole('button', { name: '建立周单草稿', exact: true }).click();
  await page.getByRole('button', { name: '发布并冻结范围', exact: true }).click();
  for (const id of ['DEMO-GROUP-P', 'DEMO-GROUP-T']) {
    await role(page, '检测方');
    await page.getByLabel('计划组', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '提交排期建议', exact: true }).click();
    await role(page, '计量管理员');
    await page.getByRole('button', { name: '接受此建议', exact: true }).click();
  }
  const pressure = form(page, '核对实际到场 · 压力仪表组');
  const temperature = form(page, '核对实际到场 · 温度仪表组');
  await temperature.getByRole('button', { name: '确认本次到场', exact: true }).click();
  await expect(temperature.locator('#notice-region')).toContainText('至少选择');
  await expect(pressure.locator('#notice-region')).toHaveCount(0);
  await expectInWorkingViewport(status(page));
  await expect(page.locator('#notice-region')).toHaveCount(1);
});
