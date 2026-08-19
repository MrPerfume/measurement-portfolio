# 计量设备与校验协同系统｜Measurement Portfolio

[![Verify](/MrPerfume/measurement-portfolio/actions/workflows/verify.yml/badge.svg)](/MrPerfume/measurement-portfolio/actions/workflows/verify.yml)

> 一个可公开审阅、可本地运行的计量设备与校验协同领域内核，展示业务建模、状态守卫、可解释匹配、幂等处理、部分回件与审计思维。

- **项目场景**：计量设备台账、校准计划、证书及异常协同。
- **个人职责**：独立完成需求梳理、流程设计、领域建模和系统开发。
- **当前状态**：测试/演示阶段，小范围试用已安排；未正式上线，不宣称生产成效。

![排检计划与任务概览（合成演示数据）](assets/calibration-plan-demo.jpg)

这不是私有生产仓库的镜像，也不是可直接部署的企业系统。它是从真实复杂业务中提炼出的**脱敏重构版作品集**：不包含原 Git 历史、企业与人员信息、真实设备/证书/数据库、域名与服务器信息、通知配置、Webhook、Token、密钥或内部运维记录。

## 为什么不只是 CRUD

计量管理的难点不是“建几张表”，而是让台账、计划、实物、校验结果、证书和责任证据在不同角色之间保持一致：

- 任务只有在形成实际日期和结果后才能完成，页面按钮不能代替服务端状态守卫。
- 校验结果与证书证据分阶段到达，补证不能重写已经形成的执行事实。
- 证书自动匹配必须给出分数、依据和冲突；高分、无关键冲突且无并列候选时才允许自动关联。
- 送检可以分批回件、分批领取；批次状态由明细事实推导，重复请求必须幂等。
- 关键动作形成可复核事件，便于权限、审计和异常治理继续接入。

```mermaid
flowchart LR
    A[设备台账] --> B[排检与送检]
    B --> C[校验任务]
    C --> D[校验记录]
    D --> E[证书解析与复核]
    E --> F[异常 / 指标 / 审计]
    F -.规则与质量反馈.-> A
```

## 可执行内容

公开内核使用 PHP 8.3+，不连接数据库、不读取环境变量、不发起网络请求，也不依赖私有系统。

```bash
gh repo clone MrPerfume/measurement-portfolio
cd measurement-portfolio
bash scripts/verify.sh
```

也可以只运行测试：

```bash
php tests/run.php
```

验证覆盖：

- 校验任务的合法流转、证据门槛、逾期判定和重复完成。
- 证书候选的评分、关键冲突、并列候选和自动关联闸门。
- 送检明细的部分回件、领取闭环、操作幂等和冲突拒绝。
- PHP 语法检查、Composer 元数据校验、敏感文件与敏感文本扫描。

## 仓库导航

- [架构与设计决策](docs/ARCHITECTURE.md)
- [核心业务闭环](docs/BUSINESS_FLOWS.md)
- [工程证据与验证结果](docs/ENGINEERING_EVIDENCE.md)
- [公开边界与私有映射](docs/PUBLICATION_BOUNDARY.md)
- [公开安全审计清单](docs/SECURITY_AUDIT.md)
- [许可证与数据边界](docs/LICENSE_AND_DATA_BOUNDARY.md)
- [`src/`](src/)：框架无关的领域内核
- [`tests/`](tests/)：无外部依赖的边界测试

## 技术背景

私有项目采用 Laravel 13、Filament 5、PHP 8.3、MariaDB、Docker Compose、PHPUnit、Larastan 与 Pint。公开仓库刻意只保留可独立验证的领域层，以缩小披露面；Web 后台、真实迁移、通知适配器、部署脚本、备份恢复和运行数据均不在公开范围内。

## 数据与声明

- 截图中的月份、类型、数量与状态均为合成演示数据。
- 代码保留业务不变量，但类、字段、示例标识和存储方式经过重构。
- 仓库不宣称截图数量是生产 KPI，也不包含客户或雇主背书。
- 当前许可证为“仅供查看和技术评估”，不是开源许可证；未来如需开放复用，可另行调整许可证。

安全边界与后续发布人工复核项见[公开安全审计清单](docs/SECURITY_AUDIT.md)。
