<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Service;

use MeasurementPortfolio\Domain\DomainEvent;
use MeasurementPortfolio\Domain\DomainRuleViolation;
use MeasurementPortfolio\Domain\SubmissionBatch;
use MeasurementPortfolio\Domain\SubmissionItemStatus;

final class SubmissionReturnWorkflow
{
    /** @var array<string, string> */
    private array $operationFingerprints = [];

    /** @var list<DomainEvent> */
    private array $events = [];

    /**
     * @param list<string> $itemIds
     */
    public function registerReturn(SubmissionBatch $batch, array $itemIds, string $operationKey): bool
    {
        $itemIds = $this->normalizeIds($itemIds);
        $fingerprint = $this->fingerprint('return', $batch->id, $itemIds);

        if ($this->isReplay($operationKey, $fingerprint)) {
            return true;
        }

        foreach ($itemIds as $itemId) {
            if ($batch->item($itemId)->status !== SubmissionItemStatus::AtLab) {
                throw new DomainRuleViolation("明细 {$itemId} 当前不在检测方，不能登记回件。");
            }
        }

        foreach ($itemIds as $itemId) {
            $batch->item($itemId)->status = SubmissionItemStatus::Returned;
        }

        $this->operationFingerprints[$operationKey] = $fingerprint;
        $this->events[] = new DomainEvent('submission.items_returned', $batch->id, [
            'item_count' => count($itemIds),
            'batch_status' => $batch->status()->value,
        ]);

        return false;
    }

    /**
     * @param list<string> $itemIds
     */
    public function confirmPickup(SubmissionBatch $batch, array $itemIds, string $operationKey): bool
    {
        $itemIds = $this->normalizeIds($itemIds);
        $fingerprint = $this->fingerprint('pickup', $batch->id, $itemIds);

        if ($this->isReplay($operationKey, $fingerprint)) {
            return true;
        }

        foreach ($itemIds as $itemId) {
            if ($batch->item($itemId)->status !== SubmissionItemStatus::Returned) {
                throw new DomainRuleViolation("明细 {$itemId} 尚未回件，不能确认领取。");
            }
        }

        foreach ($itemIds as $itemId) {
            $batch->item($itemId)->status = SubmissionItemStatus::PickedUp;
        }

        $this->operationFingerprints[$operationKey] = $fingerprint;
        $this->events[] = new DomainEvent('submission.items_picked_up', $batch->id, [
            'item_count' => count($itemIds),
            'batch_status' => $batch->status()->value,
        ]);

        return false;
    }

    /** @return list<DomainEvent> */
    public function events(): array
    {
        return $this->events;
    }

    /**
     * @param list<string> $itemIds
     * @return list<string>
     */
    private function normalizeIds(array $itemIds): array
    {
        $itemIds = array_values(array_unique(array_map('trim', $itemIds)));
        sort($itemIds);

        if ($itemIds === [] || in_array('', $itemIds, true)) {
            throw new DomainRuleViolation('操作至少需要一条有效送检明细。');
        }

        return $itemIds;
    }

    /** @param list<string> $itemIds */
    private function fingerprint(string $action, string $batchId, array $itemIds): string
    {
        return hash('sha256', json_encode([
            'action' => $action,
            'batch_id' => $batchId,
            'item_ids' => $itemIds,
        ], JSON_THROW_ON_ERROR));
    }

    private function isReplay(string $operationKey, string $fingerprint): bool
    {
        $operationKey = trim($operationKey);

        if ($operationKey === '') {
            throw new DomainRuleViolation('操作幂等键不能为空。');
        }

        if (! isset($this->operationFingerprints[$operationKey])) {
            return false;
        }

        if ($this->operationFingerprints[$operationKey] !== $fingerprint) {
            throw new DomainRuleViolation('同一操作键对应了不同载荷，拒绝继续处理。');
        }

        return true;
    }
}
