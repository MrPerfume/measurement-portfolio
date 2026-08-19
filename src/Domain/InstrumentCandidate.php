<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

use DateTimeImmutable;

final readonly class InstrumentCandidate
{
    public function __construct(
        public string $id,
        public string $factoryNumber,
        public ?string $serialNumber = null,
        public ?string $instrumentName = null,
        public ?string $specification = null,
        public ?DateTimeImmutable $calibrationDate = null,
        public ?string $issuer = null,
        public ?string $certificateNumber = null,
    ) {
    }
}
