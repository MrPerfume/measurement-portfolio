<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

final class SubmissionItem
{
    public function __construct(
        public readonly string $id,
        public SubmissionItemStatus $status = SubmissionItemStatus::AtLab,
    ) {
    }
}
