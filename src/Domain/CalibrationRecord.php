<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

use DateTimeImmutable;

final class CalibrationRecord
{
    public function __construct(
        public readonly string $id,
        public readonly DateTimeImmutable $plannedDate,
        public ?DateTimeImmutable $actualDate = null,
        public ?string $result = null,
        public ?string $certificateNumber = null,
    ) {
    }

    public function hasExecutionEvidence(): bool
    {
        return $this->actualDate !== null && trim((string) $this->result) !== '';
    }

    public function executionFingerprint(): string
    {
        return hash('sha256', json_encode([
            'actual_date' => $this->actualDate?->format('Y-m-d'),
            'result' => $this->result,
        ], JSON_THROW_ON_ERROR));
    }
}
