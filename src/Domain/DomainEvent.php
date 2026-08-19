<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

final readonly class DomainEvent
{
    /**
     * @param array<string, bool|int|string|null> $payload
     */
    public function __construct(
        public string $name,
        public string $aggregateId,
        public array $payload = [],
    ) {
    }
}
