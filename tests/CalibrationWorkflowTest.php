<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Tests;

use DateTimeImmutable;
use MeasurementPortfolio\Domain\CalibrationRecord;
use MeasurementPortfolio\Domain\CalibrationTask;
use MeasurementPortfolio\Domain\CalibrationTaskStatus;
use MeasurementPortfolio\Domain\DomainRuleViolation;
use MeasurementPortfolio\Service\CalibrationWorkflow;

final class CalibrationWorkflowTest extends TestCase
{
    public function testStartIsGuardedAndIdempotent(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-001');

        $this->assertFalse($workflow->start($task));
        $this->assertSame(CalibrationTaskStatus::InProgress, $task->status);
        $this->assertTrue($workflow->start($task));
        $this->assertSame(1, count($workflow->events()));
    }

    public function testPendingTaskCannotBeCompletedDirectly(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-002');

        $this->assertThrows(
            fn () => $workflow->complete($task, $this->record()),
            DomainRuleViolation::class,
            '执行中',
        );
    }

    public function testCompletionRequiresActualDateAndResult(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-003');
        $workflow->start($task);
        $record = new CalibrationRecord('REC-DEMO-003', new DateTimeImmutable('2026-01-10'));

        $this->assertThrows(
            fn () => $workflow->complete($task, $record),
            DomainRuleViolation::class,
            '实际校验日期',
        );
    }

    public function testCompletionRecordsOverdueWithoutDiscardingFacts(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-004');
        $workflow->start($task);
        $record = $this->record('2026-01-12', 'passed');

        $result = $workflow->complete($task, $record);

        $this->assertFalse($result['replayed']);
        $this->assertTrue($result['overdue']);
        $this->assertSame(CalibrationTaskStatus::Completed, $task->status);
        $this->assertSame('passed', $task->record?->result);
        $this->assertSame('calibration.completed', $workflow->events()[1]->name);
    }

    public function testSameCompletionCanReplayWithoutDuplicateEvent(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-005');
        $workflow->start($task);
        $record = $this->record();
        $workflow->complete($task, $record);

        $result = $workflow->complete($task, $record);

        $this->assertTrue($result['replayed']);
        $this->assertSame(2, count($workflow->events()));
    }

    public function testCompletedTaskRejectsDifferentExecutionFacts(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-006');
        $workflow->start($task);
        $workflow->complete($task, $this->record());

        $this->assertThrows(
            fn () => $workflow->complete($task, $this->record('2026-01-10', 'failed')),
            DomainRuleViolation::class,
            '覆盖',
        );
    }

    public function testCertificateEvidenceDoesNotRewriteExecutionFacts(): void
    {
        $workflow = new CalibrationWorkflow();
        $task = new CalibrationTask('TASK-DEMO-007');
        $workflow->start($task);
        $record = $this->record();
        $workflow->complete($task, $record);

        $this->assertFalse($workflow->attachCertificateEvidence($task, 'CERT-DEMO-2026-001'));
        $this->assertSame('2026-01-10', $record->actualDate?->format('Y-m-d'));
        $this->assertSame('passed', $record->result);
        $this->assertTrue($workflow->attachCertificateEvidence($task, 'CERT-DEMO-2026-001'));
        $this->assertSame(3, count($workflow->events()));
        $this->assertThrows(
            fn () => $workflow->attachCertificateEvidence($task, 'CERT-DEMO-2026-999'),
            DomainRuleViolation::class,
            '冲突',
        );
    }

    private function record(string $actualDate = '2026-01-10', string $result = 'passed'): CalibrationRecord
    {
        return new CalibrationRecord(
            id: 'REC-DEMO-001',
            plannedDate: new DateTimeImmutable('2026-01-10'),
            actualDate: new DateTimeImmutable($actualDate),
            result: $result,
        );
    }
}
