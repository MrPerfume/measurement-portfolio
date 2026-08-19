<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Domain;

final readonly class MatchAssessment
{
    /**
     * @param list<string> $reasons
     * @param list<array{field: string, critical: bool, observed: string, candidate: string}> $conflicts
     * @param list<array{id: string, score: int}> $candidateScores
     */
    public function __construct(
        public int $score,
        public string $level,
        public array $reasons,
        public array $conflicts,
        public array $candidateScores,
        public ?string $selectedCandidateId,
        public bool $autoLink,
        public int $tieCount,
    ) {
    }
}
