# 工程证据与验证结果

## 证据矩阵

| 要证明的能力 | 实现证据 | 测试证据 |
| --- | --- | --- |
| 状态机与服务端守卫 | `src/Service/CalibrationWorkflow.php` | 非法状态、缺失证据、重复完成、冲突覆盖 |
| 执行事实与证书解耦 | `CalibrationRecord`、`attachCertificateEvidence()` | 后补证据不改日期/结果，证书号冲突拒绝 |
| 可解释匹配 | `src/Service/CertificateMatchEvaluator.php` | 高分自动关联、关键冲突、并列候选、低置信 |
| 部分回件与聚合状态 | `src/Service/SubmissionReturnWorkflow.php` | 部分/全部回件、领取关闭、非法领取 |
| 幂等与审计 | 两个工作流服务的操作指纹与领域事件 | 同键同载荷重放、同键异载荷拒绝、事件不重复 |
| 公开安全 | `scripts/verify.sh` | 禁止文件与常见敏感模式扫描 |

## 本地验证记录

核验日期：2026-08-19（Asia/Shanghai）

本地环境：PHP 8.4.23 CLI。仓库最低版本声明为 PHP 8.3；GitHub Actions 使用 PHP 8.3 / 8.4 矩阵执行相同验证脚本，公开仓库的实时结果以 `Actions → Verify` 为准。

```text
[1/5] PHP syntax
OK: 21 PHP files
[2/5] Domain tests
OK: 20 tests, 57 assertions.
[3/5] Composer metadata
composer.json is valid
[4/5] Forbidden files
OK: no forbidden file types
[5/5] Sensitive text and private-boundary patterns
OK: sensitive text scan passed
Verification complete.
```

对应命令：

```bash
bash scripts/verify.sh
```

额外复核：

- Composer PSR-4 自动加载可解析 `MeasurementPortfolio\Domain\CalibrationTask`。
- 演示截图为 1280×720 JPEG；画面已人工检查为合成小规模数据，未见企业、人员、域名或账号信息。
- 原私有仓库在创建前工作树干净；创建完成后再次复核，并将结果记录在本地交付说明中。

这些数字只代表公开领域内核的本次验证，不等于私有系统的生产规模、完整测试数量或合规认证。
