# 计量数字化管理作品集｜Measurement Portfolio

> 面向设备与质量数字化管理、工业软件实施岗位。主导现场需求、业务规则与验收，借助 AI 完成原型与测试，把跨部门协作中的问题转化为可执行流程。

[展示页](https://mrperfume.github.io/measurement-portfolio/) · [业务案例](docs/BUSINESS_FLOWS.md) · [工程证据](docs/ENGINEERING_EVIDENCE.md) · [GitHub Profile](https://github.com/MrPerfume)

六场景版本于 **2026-10-01** 经 [PR #5](https://github.com/MrPerfume/measurement-portfolio/pull/5) 发布，随后 [PR #6](https://github.com/MrPerfume/measurement-portfolio/pull/6) 修复旧缓存兼容；最终版本 `8369409` 的 CI、Pages 与线上核验完成，详见[发布复核](docs/INTERACTION_QA.md#publication-20261001)。最新内容修订与本地验证见[10 月同步记录](docs/INTERACTION_QA.md#refresh-20261011)，其实际上线结果以 [Pages 工作流](https://github.com/MrPerfume/measurement-portfolio/actions/workflows/pages.yml) 为准。

## 我负责什么

主导现场需求、业务规则与验收，AI 辅助代码和测试；业务判断与验收责任由我承担。把设备、实物、结果、证书与责任证据串成可追溯流程，不用按钮或匹配高分替代实际事实。当前为测试与演示阶段，不宣称生产收益、合规认证或完整系统已全面验收。

## 先体验一个案例

推荐路线：分批取回 → 查看剩余在检数量 → 查看审计记录。

| 代表案例 | 要验证的判断 | 在线入口 |
| --- | --- | --- |
| 同批送出，不同方式取回 | 逐台记录去向，未选设备仍在检 | [分批取回](https://mrperfume.github.io/measurement-portfolio/?scenario=returns#demo) |
| 一次报检，多次到场 | 预约不替代到场，建议不覆盖正式安排 | [周报检](https://mrperfume.github.io/measurement-portfolio/?scenario=weekly#demo) |
| 单人连续证书复核 | 匹配只是建议，关联不等于完成 | [连续复核](https://mrperfume.github.io/measurement-portfolio/?scenario=certificate#demo) |

六场景、两条分支、三个角色保持不变。详细规则、交互原型截图与原后台六图见[业务说明](docs/BUSINESS_FLOWS.md)。

![统一管理概览：后台隔离环境合成截图，非交互原型](assets/screenshots/01-system-overview.png)

## 验证与边界

10 月 1 日最终发布验证为 **20 项 PHP／57 个断言、35 项 Node、33 项 Chromium**。最新候选与历史结果分别记录在[工程证据](docs/ENGINEERING_EVIDENCE.md)和[交互验收](docs/INTERACTION_QA.md)，不累计历次测试数量。演示全部使用合成数据与浏览器内存，无登录、数据库、上传、远程接口、统计或持久化。

固定演示时刻为 2026-09-07 17:00（北京时间）；角色是分工模拟，非身份鉴权。刷新恢复初始数据并进入链接指定场景，重置恢复默认场景。

## 近期业务实践（完整系统案例说明）

2026-10-11 更新排期案例，保留部门进度案例；以下均为完整系统说明：

- [部门进度通报与预计领取安排](docs/BUSINESS_FLOWS.md#department-progress-case)：按部门隔离信息，预计时间不等于可领取；预览冻结与重复提交保护。本地模拟验证不代表真实通知已发送。
- [检测单位排期与分组清单](docs/BUSINESS_FLOWS.md#mobile-plan-case)：人员与日期确认、计划组编排、版本冻结及分批执行。基础排期已做测试站双端代表场景验收；后续分组与手机优化已合入、本地验证，测试站尚未验收。

另见[证书导入任务与人工复核](docs/ENGINEERING_EVIDENCE.md#certificate-workflow-case)：从导入任务追到处理结果，失败保留，人工确认后再核对证书中心的覆盖与归档口径。

## 一次有边界的性能案例

2026-09-05 私有本地证书页对照：应用处理中位数 **584.23ms → 430.38ms，改善约 26.3%**。同环境、相同 20 行列表，每阶段首轮单列、后五次预热样本取中位数。优化范围是局部菜单渲染，保留权限判断。

这是公开不可复现的历史自述，不是生产收益、INP、P95 或 SLA，也不包括 OCR 或真实 PDF 解析。方法与限制见[工程证据](docs/ENGINEERING_EVIDENCE.md)。


## 本地预览

在仓库根目录执行：

```bash
bash scripts/build-pages.sh
php -S localhost:4173 -t .pages-dist
```

结束按 Ctrl+C。开发工具安装、测试和截图命令见[工程说明](docs/ENGINEERING_EVIDENCE.md#本地体验与验证)。

[架构](docs/ARCHITECTURE.md) · [状态测试](site/tests/) · [端到端测试](e2e/) · [公开边界与发布准备](docs/PUBLICATION_BOUNDARY.md) · [安全核查](docs/SECURITY_AUDIT.md) · [许可证](docs/LICENSE_AND_DATA_BOUNDARY.md)

许可证仅允许作品集查看与技术评估，不是开源许可证。完整系统的身份鉴权、并发数据库、真实消息、PDF/OCR 和部署不由本原型证明。
