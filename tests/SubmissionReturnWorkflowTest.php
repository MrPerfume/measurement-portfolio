<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Tests;

use MeasurementPortfolio\Domain\DomainRuleViolation;
use MeasurementPortfolio\Domain\SubmissionBatch;
use MeasurementPortfolio\Domain\SubmissionBatchStatus;
use MeasurementPortfolio\Domain\SubmissionItem;
use MeasurementPortfolio\Domain\SubmissionItemStatus;
use MeasurementPortfolio\Service\SubmissionReturnWorkflow;

final class SubmissionReturnWorkflowTest extends TestCase
{
    public function testPartialReturnKeepsBatchAtLab(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();

        $this->assertFalse($workflow->registerReturn($batch, ['ITEM-DEMO-1'], 'op-return-1'));
        $this->assertSame(SubmissionItemStatus::Returned, $batch->item('ITEM-DEMO-1')->status);
        $this->assertSame(SubmissionItemStatus::AtLab, $batch->item('ITEM-DEMO-2')->status);
        $this->assertSame(SubmissionBatchStatus::AtLab, $batch->status());
    }

    public function testAllReturnedItemsMoveBatchToReturned(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();

        $workflow->registerReturn($batch, ['ITEM-DEMO-2', 'ITEM-DEMO-1'], 'op-return-all');

        $this->assertSame(SubmissionBatchStatus::Returned, $batch->status());
        $this->assertSame(1, count($workflow->events()));
        $this->assertSame(2, $workflow->events()[0]->payload['item_count']);
    }

    public function testPickupClosesOnlyAfterEveryReturnedItemIsHandled(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();
        $workflow->registerReturn($batch, ['ITEM-DEMO-1', 'ITEM-DEMO-2'], 'op-return-both');

        $workflow->confirmPickup($batch, ['ITEM-DEMO-1'], 'op-pickup-1');
        $this->assertSame(SubmissionBatchStatus::Returned, $batch->status());

        $workflow->confirmPickup($batch, ['ITEM-DEMO-2'], 'op-pickup-2');
        $this->assertSame(SubmissionBatchStatus::Closed, $batch->status());
    }

    public function testSameOperationAndPayloadCanReplay(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();

        $this->assertFalse($workflow->registerReturn($batch, ['ITEM-DEMO-1'], 'op-idempotent'));
        $this->assertTrue($workflow->registerReturn($batch, ['ITEM-DEMO-1'], 'op-idempotent'));
        $this->assertSame(1, count($workflow->events()));
    }

    public function testSameOperationKeyWithDifferentPayloadIsRejected(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();
        $workflow->registerReturn($batch, ['ITEM-DEMO-1'], 'op-collision');

        $this->assertThrows(
            fn () => $workflow->registerReturn($batch, ['ITEM-DEMO-2'], 'op-collision'),
            DomainRuleViolation::class,
            '不同载荷',
        );
    }

    public function testAtLabItemCannotBePickedUp(): void
    {
        $workflow = new SubmissionReturnWorkflow();
        $batch = $this->batch();

        $this->assertThrows(
            fn () => $workflow->confirmPickup($batch, ['ITEM-DEMO-1'], 'op-invalid-pickup'),
            DomainRuleViolation::class,
            '尚未回件',
        );
    }

    public function testEmptyOperationIsRejected(): void
    {
        $workflow = new SubmissionReturnWorkflow();

        $this->assertThrows(
            fn () => $workflow->registerReturn($this->batch(), [], 'op-empty'),
            DomainRuleViolation::class,
            '至少需要',
        );
    }

    private function batch(): SubmissionBatch
    {
        return new SubmissionBatch('BATCH-DEMO-001', [
            new SubmissionItem('ITEM-DEMO-1'),
            new SubmissionItem('ITEM-DEMO-2'),
        ]);
    }
}
