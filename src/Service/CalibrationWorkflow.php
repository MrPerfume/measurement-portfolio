<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Service;

use MeasurementPortfolio\Domain\CalibrationRecord;
use MeasurementPortfolio\Domain\CalibrationTask;
use MeasurementPortfolio\Domain\CalibrationTaskStatus;
use MeasurementPortfolio\Domain\DomainEvent;
use MeasurementPortfolio\Domain\DomainRuleViolation;

final class CalibrationWorkflow
{
    /** @var list<DomainEvent> */
    private array $events = [];

    public function start(CalibrationTask $task): bool
    {
        if ($task->status === CalibrationTaskStatus::InProgress) {
            return true;
        }

        if ($task->status !== CalibrationTaskStatus::Pending) {
            throw new DomainRuleViolation('只有待处理任务可以开始执行。');
        }

        $task->status = CalibrationTaskStatus::InProgress;
        $this->events[] = new DomainEvent('calibration.started', $task->id);

        return false;
    }

    /**
     * @return array{replayed: bool, overdue: bool}
     */
    public function complete(CalibrationTask $task, CalibrationRecord $record): array
    {
        $fingerprint = $record->executionFingerprint();

        if ($task->status === CalibrationTaskStatus::Completed) {
            if ($task->completionFingerprint === $fingerprint) {
                return [
                    'replayed' => true,
                    'overdue' => $this->isOverdue($record),
                ];
            }

            throw new DomainRuleViolation('任务已经完成，不能用不同执行事实覆盖。');
        }

        if ($task->status !== CalibrationTaskStatus::InProgress) {
            throw new DomainRuleViolation('只有执行中的任务才能完成。');
        }

        if (! $record->hasExecutionEvidence()) {
            throw new DomainRuleViolation('实际校验日期和校验结果必须同时存在。');
        }

        $task->record = $record;
        $task->completionFingerprint = $fingerprint;
        $task->status = CalibrationTaskStatus::Completed;

        $overdue = $this->isOverdue($record);
        $this->events[] = new DomainEvent('calibration.completed', $task->id, [
            'record_id' => $record->id,
            'overdue' => $overdue,
            'result' => $record->result,
        ]);

        return ['replayed' => false, 'overdue' => $overdue];
    }

    public function attachCertificateEvidence(CalibrationTask $task, string $certificateNumber): bool
    {
        $certificateNumber = trim($certificateNumber);

        if ($task->status !== CalibrationTaskStatus::Completed || ! $task->record) {
            throw new DomainRuleViolation('只有已经形成校验记录的任务才能补充证书证据。');
        }

        if ($certificateNumber === '') {
            throw new DomainRuleViolation('证书编号不能为空。');
        }

        $existing = trim((string) $task->record->certificateNumber);

        if ($existing === $certificateNumber) {
            return true;
        }

        if ($existing !== '') {
            throw new DomainRuleViolation('已有证书编号与本次补充内容冲突，禁止静默覆盖。');
        }

        // 这里只补证书字段，不改写实际日期、结果或计划日期。
        $task->record->certificateNumber = $certificateNumber;
        $this->events[] = new DomainEvent('calibration.certificate_attached', $task->id, [
            'record_id' => $task->record->id,
            'certificate_number' => $certificateNumber,
        ]);

        return false;
    }

    /** @return list<DomainEvent> */
    public function events(): array
    {
        return $this->events;
    }

    private function isOverdue(CalibrationRecord $record): bool
    {
        return $record->actualDate !== null && $record->actualDate > $record->plannedDate;
    }
}
