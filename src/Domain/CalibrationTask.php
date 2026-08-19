<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

final class CalibrationTask
{
    public ?CalibrationRecord $record = null;

    public ?string $completionFingerprint = null;

    public function __construct(
        public readonly string $id,
        public CalibrationTaskStatus $status = CalibrationTaskStatus::Pending,
    ) {
    }
}
