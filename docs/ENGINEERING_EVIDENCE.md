# 工程证据与验证结果

## 当前发布记录

**2026-10-11 演示引导与推荐案例收口**：本轮候选范围与验证见[本轮验收](INTERACTION_QA.md#guide-20261011)。实际合入、CI、Pages 与个人主页 README 的发布结果另记发布回执，不将本地通过当作已上线；上一公开版本见 [PR #8 回执](https://github.com/MrPerfume/measurement-portfolio/pull/8#issuecomment-6106737059)。

## 从业务判断核实我的贡献

主导现场需求、业务规则与验收，AI 辅助代码和测试。以下列出我定义的规则及可复现验收依据，不把代码实现量或测试数量当作生产收益。

| 我的判断与验收责任 | 公开核实入口 | 能证明什么 |
| --- | --- | --- |
| 逐台记录交接，不整批关闭 | [取回演示](https://mrperfume.github.io/measurement-portfolio/?scenario=returns#demo)、[用例：同批分次混合去向](../site/tests/state.test.mjs#L129) | 剩余在检数量一致；直领不制造待领取 |
| 预约与实际到场分别记录 | [周单演示](https://mrperfume.github.io/measurement-portfolio/?scenario=weekly#demo)、[用例：待确认或拒绝改期](../site/tests/state.test.mjs#L168)、[分次到场](../site/tests/state.test.mjs#L187) | 待确认建议不覆盖预约；重复到场被阻断；结果与证书单独完成 |
| 匹配建议不替代人工确认 | [连续复核](https://mrperfume.github.io/measurement-portfolio/?scenario=certificate#demo)、[用例：确认结果须人工核对](../site/tests/state.test.mjs#L214)、[浏览器：候选与焦点](../e2e/portfolio.spec.mjs#L134) | 重复确认不多记；失败保留输入；成功推进下一份 |

## 本轮验证与覆盖边界

本轮以公开 `4791f55` 为基线，新增只读任务引导及变化行为测试，不改业务状态模型。最新实际结果见[本轮验收](INTERACTION_QA.md#guide-20261011)；可直接核对[六场景三角色提示测试](../site/tests/guidance.test.mjs#L23)与[浏览器角色切换测试](../e2e/portfolio.spec.mjs#L116)。复现命令见[本地体验与验证](#本地体验与验证)。

公开 PHP 套件验证既有领域内核，不覆盖全部新增流程；Node 状态机与 Chromium 验证合成六场景、导航和错误恢复。私有系统的性能、测试站和完整功能记录属于历史自述，不能由本站复现，不与公开测试累计。下方“未发布”等描述只表示对应历史阶段。

## 历史发布与验证记录

2026-10-11 首屏与近期案例修订经 PR #7 发布为 `441938e`，[Verify](https://github.com/MrPerfume/measurement-portfolio/actions/runs/38117718291) 与 [Pages](https://github.com/MrPerfume/measurement-portfolio/actions/runs/38117718321) 成功，线上资源与代表操作核验见[当次回执](https://github.com/MrPerfume/measurement-portfolio/pull/7#issuecomment-6106231985)。本轮不借用该版本的成功结果。

2026-10-01 六场景经 PR #5 发布，PR #6 完成旧缓存兼容修订；最终公开版本 `8369409` 的 [Verify](https://github.com/MrPerfume/measurement-portfolio/actions/runs/36809794510) 与 [Pages](https://github.com/MrPerfume/measurement-portfolio/actions/runs/36809794498) 成功。公开套件为 **20 项 PHP／57 个断言、35 项 Node、33 项 Chromium**；见[当次发布复核](INTERACTION_QA.md#publication-20261001)。

## 2026-10-11 内容与首屏修订

历史阶段：近期案例与首屏修订见[同步记录](INTERACTION_QA.md#refresh-20261011)；同日后续招聘入口修订为 20 项 PHP／57 个断言、36 项 Node、36 项 Chromium，见[验收与 PR #8 回执入口](INTERACTION_QA.md#recruiter-20261011)。不借用这些结果证明本轮候选。

<a id="certificate-workflow-case"></a>
## 证书导入任务与人工复核（完整系统案例说明）

**现场问题**：文件接收成功并不代表分析成功，批次结束也不代表每份证书已被人工确认；离开结果页后，失败对象与后续复核位置容易丢失。

**业务判断**：把导入任务、逐份处理结果、人工复核和证书中心衔接起来。任务保留分页汇总与结果入口，失败保留可核对的依据，不自动重试或确认历史证据；从结果进入复核再返回原任务，保持查阅上下文。证书中心区分实际设备有效覆盖与应收证归档，不用上传数量替代业务完成。

**验证与限制**：2026-10-01 证书中心与相关上传能力已有测试站管理员桌面／模拟手机只读检查；10 月 3 日导入任务、原生复核／中心与历史认定入口完成本地专项、代表性角色及测试站管理员双端只读检查。真实失败和历史待认定项仍保留，没有自动认定或声称全部处理完成。该记录属于私有历史自述，公开原型仅演示合成材料的连续复核，不覆盖真实上传、PDF/OCR、完整权限或数据库流程。

## 2026-10-01 求职表达与场景入口候选（历史本地记录）

当时本地候选通过 20 项 PHP／57 个断言、35 项 Node、30 项 Chromium，未提交或发布；导航覆盖、环境与后续发布分别见[当次验收](INTERACTION_QA.md#entry-20261001)及[发布复核](INTERACTION_QA.md#publication-20261001)。

## 贡献与验证边界

贡献见上方映射。公开可复现验证与私有历史自述分开；公开原型不证明生产成效或完整系统全面验收。

## 2026-09-17 本地候选版复核

当时新增两则说明，不新增交互；20 项 PHP／57 个断言、35 项 Node、24 项 Chromium 通过，仍未提交或发布。三视口抽查与私有案例边界见[当次验收](INTERACTION_QA.md#refresh-20260917)，不累计历次数量。

## 公开可复现证据（2026-09-15 历史记录）

2026-09-15 本地 PHP 8.4.23、Node.js 24.18.0、锁定 Playwright 1.63.0：20 项 PHP／57 个断言、35 项 Node、24 项 Chromium（8 类流程 × 三视口）、构建与安全检查通过。当时仅本地交付，未推送、运行远端 CI 或发布 Pages；实际覆盖、失败复现与补验见[当次记录](INTERACTION_QA.md#2026-09-15-新案例体验优化)。

## 规则到测试的映射

| 业务判断 | 实现 | 测试重点 |
| --- | --- | --- |
| 实物明细只有一份 | `state.mjs`、`domain/physical.mjs` | 接收、送出、切换角色、混合取回后各视图数量一致 |
| 建议不能替代预约 | `domain/weekly.mjs` | 发布冻结、版本替代/拒绝、分次到场去重、原预约继续有效 |
| 交接不补造结果 | `domain/physical.mjs` | 空/重复/跨轮次选择、缺少领取资料、非法/倒序/未来时间、整次失败回滚 |
| 候选输入不覆盖确认结果 | `domain/certificates.mjs` | 同候选复选、切换后返回、重复确认、仅关联、缺证失败、跳过 |
| 独立完成轴 | `domain/common.mjs` | 先证书后实物与先实物后证书；周单全部结果/证据满足才闭环 |
| 幂等与角色守卫 | `state.mjs` | 同标识同载荷重放、不同载荷拒绝、失败可重试、管理者零事实写入 |
| 固定演示时钟 | `data/demo.json` | 44/45 天边界、未知停发、完整重置与刷新 |
| 操作后仍看得见当前任务 | `app.mjs`、`views.mjs` | 换份标题/焦点、就近错误、多预约反馈归属、按实物状态独立选单和任务定位 |
| 引导不替代业务事实 | `guidance.mjs` | 六场景／三角色只读派生，当前轮次数量、复核顺序及输入焦点保持 |

失败复现、反馈位置和补验过程归[交互验收记录](INTERACTION_QA.md)；DOM 中存在标题或提示不能代替用户可见。

## 真实浏览器与素材证据

详见[交互验收记录](INTERACTION_QA.md)。三张新图直接截自本公开原型，图内和页面均明确标记“合成交互原型”：

- [周报检与分次到场](../assets/cases/01-weekly.png)
- [双路径取回与部门直领](../assets/cases/02-returns.png)
- [连续证书复核](../assets/cases/03-review.png)

原六张 `assets/screenshots/` 图来自后台隔离环境的合成界面，不是新原型截图。两组素材均不包含真实 PDF 或业务数据。截图生成命令为 `npm run capture`，会关闭自身服务、浏览器和临时资料目录；更多本地验收产物保存在被 Git 忽略的 `output/playwright/`，不进入 Pages。

## 私有性能案例（历史自述，公开不可复现）

核查来源为 2026-09-05 已归档的本地证书列表对照实验。只摘述测量结论与方法，不公开内部原始记录、代码、计划或环境细节。

- 问题定位：证书行菜单重复求值；优化局部渲染，保留权限判断。
- 范围：相同本地环境、账号、视口和数据，列表实际 20 行；应用处理阶段测量，不是整个用户操作的端到端耗时。
- 方法：每阶段首轮单列，后五次预热样本取中位数；首轮也不等于完全冷启动。
- 结果：**584.23ms → 430.38ms，改善约 26.3%**，计算为 `(584.23 - 430.38) / 584.23`。
- 限制：不是生产收益、INP、P95、并发容量或 SLA；未测 OCR、真实 PDF 解析，也不能代表全部证书分布。

## 私有功能验证（历史自述，公开不可复现）

另有 2026-08-27—28 的私有专项记录，涉及计划外收件的原子提交、当前轮次占用、44/45 天阈值、未知投递停发和只读核对零外呼。它们用于交代业务判断来源，不作为本轮公开可执行证据，也不与上表测试数相加。真实权限、数据库事务、并发、外部消息和运维可靠性不由本仓库的内存演示证明。

## 本地体验与验证

PHP 8.3+、Node.js 24；既有 PHP 示例不需要数据库。首次安装开发验证工具：

```bash
npm ci --ignore-scripts
npx playwright install chromium
```

构建与本地预览（在本仓库根目录执行）：

```bash
bash scripts/build-pages.sh
php -S localhost:4173 -t .pages-dist
```

打开终端显示的本地地址；预览结束按 Ctrl+C 停止服务。自动验证：

```bash
bash scripts/verify.sh
npm run test:e2e
git diff --check
```

以本轮实际结果为准；不要将源码模板通过 `file://` 直接打开作为运行验收。Linux CI 使用 `npx playwright install --with-deps chromium` 安装浏览器依赖；运行时不需要第三方请求。

`npm run capture` 可重建三张案例图与本地验收截图，并清理自身服务、浏览器和临时资料。CI 配置锁定依赖与浏览器验证；当前修订的实际执行结果见对应 PR / Actions，历史结果见[验收记录](INTERACTION_QA.md)。
