# 工程证据与验证结果

## 公开可复现证据矩阵

| 要证明的能力 | 实现证据 | 可复现测试证据 |
| --- | --- | --- |
| 状态机与服务端守卫 | `src/Service/CalibrationWorkflow.php` | 非法状态、缺失证据、重复完成、冲突覆盖 |
| 执行事实与证书解耦 | `CalibrationRecord`、`attachCertificateEvidence()` | 后补证据不改日期/结果，证书号冲突拒绝 |
| 可解释匹配 | `src/Service/CertificateMatchEvaluator.php` | 高分自动关联、关键冲突、并列候选、低置信 |
| 部分回件与聚合状态 | `src/Service/SubmissionReturnWorkflow.php` | 部分/全部回件、领取关闭、非法领取 |
| 幂等与审计 | 两个工作流服务的操作指纹与领域事件 | 同键同载荷重放、同键异载荷拒绝、事件不重复 |
| 浏览器交互规则 | `site/state.mjs`、`site/data/demo.json` | 异常隔离、44/45 天边界、未知停发、回件、复核、角色对齐 |
| 静态发布契约 | `scripts/build-pages.php`、`scripts/verify-pages.php` | 构建输入、CSP、内嵌数据、站内资源和六图画廊检查 |
| 公开安全 | `scripts/verify.sh`、`scripts/verify-public-urls.php` | 禁止文件、秘密模式、私有边界、URL 白名单与 IPv4 扫描 |

## 本地自动化验证记录

核验日期：2026-08-30（Asia/Shanghai）

本地环境：PHP 8.4.23、Node.js 24.18.0、Composer 2.10.2。仓库最低版本声明为 PHP 8.3；GitHub Actions 使用 PHP 8.3 / 8.4 矩阵执行相同验证脚本。

```text
[1/7] PHP syntax
OK: 24 PHP files
[2/7] Domain tests
OK: 20 tests, 57 assertions.
[3/7] Interactive-demo state tests
OK: 9 tests
[4/7] GitHub Pages build and contract
OK: artifact and internal references are valid
[5/7] Composer metadata
OK: composer.json is valid
[6/7] Forbidden files
OK: no forbidden file types
[7/7] Sensitive text and publication boundary
OK: sensitive text, public URL and network-address boundary passed
Verification complete.
```

对应命令：

```bash
bash scripts/verify.sh
```

## 真实浏览器验收

使用 Playwright 驱动真实浏览器检查构建后的 `.pages-dist/`：

- 视口覆盖 1440×900、768×1024、390×844；手机宽度下 `scrollWidth` 与 `clientWidth` 均为 390，没有页面级横向溢出。
- 实际点通计划外收件、形成送出轮次、44 天不提醒、45 天首次提醒、关键冲突转人工和审计事件回看。
- 三种角色入口与四个场景能够正确对齐；交互后状态、按钮禁用、提示和事件数量同步更新。
- 控制台为 0 error / 0 warning；请求记录只有同源 HTML、CSS、JS、SVG 和已审计 PNG，没有第三方运行时请求。
- Cookie、Local Storage、Session Storage 均为空。
- 键盘首次 Tab 可聚焦“跳到主要内容”，焦点轮廓可见；`prefers-reduced-motion: reduce` 下滚动改为 `auto`，位移动效缩短至 1ms。

## 素材与边界复核

- 六张演示截图均为 1600×900 PNG，并带有“脱敏演示数据 · Demo Data”标记。
- 演示状态使用 `DEMO-*` 与 `EVT-*` 合成标识；构建产物不包含环境变量、数据库、证书、日志或部署配置。
- GitHub Pages 运行时无后端、无数据写入、无外部消息发送；刷新页面即可恢复初始状态。

## 私有完整系统验证记录（自述，公开不可复现）

以下内容来自 2026-08-27—28 的私有项目专项验证记录，用于交代设计判断的来源。它不是本公开仓库的可执行证据，不与上面的公开测试数量相加，也不提供私有源文件、状态编码或提交历史。

| 要证明的能力 | 已核对的私有证据 | 重点失败路径 |
| --- | --- | --- |
| 计划外收件是完整业务动作 | 单事务形成批次、明细、身份关联、协同轮次、接收与可选送出；专项 34 项、302 个断言 | 重复点击、并发、跨范围、无效检测方、时间倒置、证据缺失、越权零写入、失败后材料可重试 |
| 历史关联不等于当前占用 | 只回填开放轮次，当前任务采用独立唯一约束，历史关联保留普通索引 | 重复开放数据阻止迁移、不安全回滚拒绝、并发竞争转为业务错误 |
| 当前在检只来自可证明事实 | 按实际送出轮次汇总；口径回归 45 项、432 个断言 | 未完成接收、送出不确定和已回件记录排除；明确历史证据保留 |
| 45 天阈值不会被内部看板污染 | 外部通知规则冻结为 45 天 | 44/45 天边界、相同阈值不重复、新阈值形成独立身份 |
| 不确定投递不会自动重复 | 通知自动化相关套件 62 项、756 个断言 | 结果未知停发、确定失败复用、回件后跳过、缺少授权留痕人时零外呼 |
| 管理员核对没有副作用 | 路由分区、三层启停、固定预览和重复路由告警有覆盖 | 查看不迁移设置，预览不创建消息或外呼，直接调用继续鉴权 |
| 对外快照遵守最小披露 | 快照使用白名单字段，签名媒体限定所属通知 | 跨通知、篡改、过期、撤回拒绝；媒体失败只降级不扩字段 |

这些私有记录说明的是工程判断与失败路径，不代表生产 KPI、合规认证或客户背书。若未来要把更多能力公开，仍需在本仓库中重新建模并增加独立可执行测试，不能直接复制私有实现。
