# 计量数字化管理作品集｜Measurement Portfolio

> 面向设备与质量数字化管理、工业软件实施岗位。主导现场需求、业务规则与验收，借助 AI 完成原型与测试，把跨部门协作中的问题转化为可执行流程。

[展示页](https://mrperfume.github.io/measurement-portfolio/) · [业务案例](docs/BUSINESS_FLOWS.md) · [工程证据](docs/ENGINEERING_EVIDENCE.md) · [GitHub Profile](https://github.com/MrPerfume)

内容更新：**2026-10-25 部门协同、证书识别与台账核对**。[直接看最新实践](https://mrperfume.github.io/measurement-portfolio/#recent-practice)；[当前发布记录](docs/ENGINEERING_EVIDENCE.md#当前发布记录)列出本次检查与实际发布状态。六场景交互沿用 10 月 11 日版本，新进展以完整系统案例说明呈现。

## 我负责什么

主导现场需求、业务规则与验收，AI 辅助代码和测试。我负责明确现场问题、定义事实边界和验收条件：预约不能替代到场，交接不能补造结果，高分不能替代人工确认。不宣称生产收益、合规认证或完整系统已全面验收。

## 先体验一个案例

先看[三个代表案例](https://mrperfume.github.io/measurement-portfolio/#cases)，推荐从分批取回开始，再体验周报检与连续复核。初始管理员取回样例：勾选一台 → 选择“取回计量室” → 登记 → 查看在检从 2 变 1 → 查看本次审计。外部直达先看演示介绍，页面内入口直达工作区；成功摘要使用本轮真实数量，审计回看后仍保留未提交草稿。推荐路线与当前任务分开，已操作会话以当前明细为准，不自动重置。

| 代表案例 | 我的规则与验收重点 | 在线入口 |
| --- | --- | --- |
| 同批送出，不同方式取回 | 不整批关闭；逐台记录去向，剩余数量和审计一致 | [分批取回](https://mrperfume.github.io/measurement-portfolio/?scenario=returns#demo) |
| 一次报检，多次到场 | 拆分预约与到场；待确认改期不覆盖原预约，重复到场被阻断 | [周报检](https://mrperfume.github.io/measurement-portfolio/?scenario=weekly#demo) |
| 单人连续证书复核 | 拆分建议、关联与完成；重复确认不多记，失败保留输入 | [连续复核](https://mrperfume.github.io/measurement-portfolio/?scenario=certificate#demo) |

六场景、两条分支、三个角色保持不变。详细规则、交互原型截图与原后台六图见[业务说明](docs/BUSINESS_FLOWS.md)。

![统一管理概览：后台隔离环境合成截图，非交互原型](assets/screenshots/01-system-overview.png)

## 验证与边界

10 月 11 日公开版本的验证为 **20 项 PHP／57 个断言、46 项 Node、48 项 Chromium**，见[历史交互验收](docs/INTERACTION_QA.md#mobile-feedback-20261011)；本次内容更新检查见[10 月 25 日记录](docs/INTERACTION_QA.md#practice-20261025)，不累计历次数量。PHP 验证既有领域内核，Node 与浏览器验证六场景、导航、任务引导和交接反馈；演示只使用合成数据与内存，无登录、数据库、上传、接口、统计或持久化。

固定演示时刻为 2026-09-07 17:00（北京时间）；角色是分工模拟，非身份鉴权。刷新恢复初始数据并进入链接指定场景，重置恢复默认场景。

## 近期业务实践（完整系统案例说明）

截至 2026-10-25，以下为完整系统的业务实践说明：

- [使用部门按计划组协同与证书查询](docs/BUSINESS_FLOWS.md#department-portal-case)：按计划组申报数量，送检和领取分别跟进；按设备分组、分页查询证书历史。10 月 24—25 日相关版本部署测试站并补充归档。
- [检测单位排期与分组清单](docs/BUSINESS_FLOWS.md#mobile-plan-case)：人员与日期确认、计划组编排、版本冻结及分批执行。既有代表场景验收与后续功能进展分开记录。
- [原始检测记录与车间台账分离](docs/BUSINESS_FLOWS.md#inspection-record-case)：保留来源、历史设备身份与关联，分别管理原始记录、台账和送检轮次。
- [证书识别、登记与台账差异确认](docs/ENGINEERING_EVIDENCE.md#certificate-workflow-case)：PDF／OCR 辅助提取，先核对身份与日期，再预览差异、人工确认；执行时复查权限和并发变化，符合条件才可撤回。未识别与冲突项保留人工待办。

实际工作已有部分通知、查询与协同使用；新增代码、测试站交付和历史截图不证明全部新功能已实际使用，覆盖人数、设备量与节省工时仍未新增确认。原[部门进度通报案例](docs/BUSINESS_FLOWS.md#department-progress-case)及历史日期保留。

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
