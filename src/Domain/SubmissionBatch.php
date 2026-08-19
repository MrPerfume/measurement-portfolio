<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

final class SubmissionBatch
{
    /** @var array<string, SubmissionItem> */
    private array $items = [];

    /**
     * @param list<SubmissionItem> $items
     */
    public function __construct(
        public readonly string $id,
        array $items,
    ) {
        if ($items === []) {
            throw new DomainRuleViolation('送检批次至少包含一条明细。');
        }

        foreach ($items as $item) {
            if (isset($this->items[$item->id])) {
                throw new DomainRuleViolation('送检明细标识不能重复。');
            }

            $this->items[$item->id] = $item;
        }
    }

    public function item(string $id): SubmissionItem
    {
        return $this->items[$id] ?? throw new DomainRuleViolation("送检明细 {$id} 不存在。");
    }

    /** @return list<SubmissionItem> */
    public function items(): array
    {
        return array_values($this->items);
    }

    public function status(): SubmissionBatchStatus
    {
        $statuses = array_map(
            static fn (SubmissionItem $item): SubmissionItemStatus => $item->status,
            $this->items,
        );

        if (in_array(SubmissionItemStatus::AtLab, $statuses, true)) {
            return SubmissionBatchStatus::AtLab;
        }

        if (in_array(SubmissionItemStatus::Returned, $statuses, true)) {
            return SubmissionBatchStatus::Returned;
        }

        return SubmissionBatchStatus::Closed;
    }
}
