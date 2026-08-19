<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Service;

use MeasurementPortfolio\Domain\CertificateObservation;
use MeasurementPortfolio\Domain\InstrumentCandidate;
use MeasurementPortfolio\Domain\MatchAssessment;

final class CertificateMatchEvaluator
{
    public const AUTO_LINK_SCORE = 70;

    public const MEDIUM_SCORE = 50;

    /**
     * 评分是纯计算：它只输出依据与冲突，不保存证书、不完成任务。
     *
     * @param list<InstrumentCandidate> $candidates
     */
    public function evaluate(CertificateObservation $observation, array $candidates): MatchAssessment
    {
        if ($candidates === []) {
            return new MatchAssessment(0, 'low', [], [], [], null, false, 0);
        }

        $scored = array_map(
            fn (InstrumentCandidate $candidate): array => $this->score($observation, $candidate),
            $candidates,
        );

        usort($scored, static function (array $left, array $right): int {
            $scoreOrder = $right['score'] <=> $left['score'];

            return $scoreOrder !== 0 ? $scoreOrder : strcmp($left['candidate']->id, $right['candidate']->id);
        });

        $best = $scored[0];
        $tieCount = count(array_filter(
            $scored,
            static fn (array $item): bool => $item['score'] === $best['score'],
        ));
        $hasCriticalConflict = count(array_filter(
            $best['conflicts'],
            static fn (array $conflict): bool => $conflict['critical'],
        )) > 0;
        $autoLink = $best['score'] >= self::AUTO_LINK_SCORE
            && ! $hasCriticalConflict
            && $tieCount === 1;

        return new MatchAssessment(
            score: $best['score'],
            level: $this->level($best['score']),
            reasons: $best['reasons'],
            conflicts: $best['conflicts'],
            candidateScores: array_map(
                static fn (array $item): array => [
                    'id' => $item['candidate']->id,
                    'score' => $item['score'],
                ],
                $scored,
            ),
            selectedCandidateId: $autoLink ? $best['candidate']->id : null,
            autoLink: $autoLink,
            tieCount: $tieCount,
        );
    }

    /**
     * @return array{
     *     candidate: InstrumentCandidate,
     *     score: int,
     *     reasons: list<string>,
     *     conflicts: list<array{field: string, critical: bool, observed: string, candidate: string}>
     * }
     */
    private function score(CertificateObservation $observed, InstrumentCandidate $candidate): array
    {
        $score = 0;
        $reasons = [];
        $conflicts = [];

        $this->compareText(
            '内部编号',
            $observed->factoryNumber,
            $candidate->factoryNumber,
            45,
            0,
            -60,
            true,
            $score,
            $reasons,
            $conflicts,
        );
        $this->compareText('出厂编号', $observed->serialNumber, $candidate->serialNumber, 15, 8, -5, false, $score, $reasons, $conflicts);
        $this->compareText('设备名称', $observed->instrumentName, $candidate->instrumentName, 15, 8, -5, false, $score, $reasons, $conflicts);
        $this->compareText('规格', $observed->specification, $candidate->specification, 10, 5, -3, false, $score, $reasons, $conflicts);
        $this->compareDate($observed, $candidate, $score, $reasons, $conflicts);
        $this->compareText('检测机构', $observed->issuer, $candidate->issuer, 5, 3, 0, false, $score, $reasons, $conflicts);
        $this->compareText('证书编号', $observed->certificateNumber, $candidate->certificateNumber, 20, 0, -25, true, $score, $reasons, $conflicts);

        return [
            'candidate' => $candidate,
            'score' => $score,
            'reasons' => $reasons,
            'conflicts' => $conflicts,
        ];
    }

    /**
     * @param list<string> $reasons
     * @param list<array{field: string, critical: bool, observed: string, candidate: string}> $conflicts
     */
    private function compareText(
        string $field,
        ?string $observed,
        ?string $candidate,
        int $exactScore,
        int $containsScore,
        int $conflictScore,
        bool $critical,
        int &$score,
        array &$reasons,
        array &$conflicts,
    ): void {
        $observed = $this->normalize($observed);
        $candidate = $this->normalize($candidate);

        if ($observed === '' || $candidate === '') {
            return;
        }

        if ($observed === $candidate) {
            $score += $exactScore;
            $reasons[] = "{$field}一致";

            return;
        }

        if ($containsScore > 0 && (str_contains($observed, $candidate) || str_contains($candidate, $observed))) {
            $score += $containsScore;
            $reasons[] = "{$field}部分一致";

            return;
        }

        $score += $conflictScore;
        $conflicts[] = [
            'field' => $field,
            'critical' => $critical,
            'observed' => $observed,
            'candidate' => $candidate,
        ];
    }

    /**
     * @param list<string> $reasons
     * @param list<array{field: string, critical: bool, observed: string, candidate: string}> $conflicts
     */
    private function compareDate(
        CertificateObservation $observed,
        InstrumentCandidate $candidate,
        int &$score,
        array &$reasons,
        array &$conflicts,
    ): void {
        if (! $observed->calibrationDate || ! $candidate->calibrationDate) {
            return;
        }

        $days = abs((int) $observed->calibrationDate->diff($candidate->calibrationDate)->format('%r%a'));

        if ($days === 0) {
            $score += 10;
            $reasons[] = '校验日期一致';

            return;
        }

        if ($days <= 7) {
            $score += 5;
            $reasons[] = '校验日期在七天容差内';

            return;
        }

        if ($days > 30) {
            $score -= 10;
            $conflicts[] = [
                'field' => '校验日期',
                'critical' => false,
                'observed' => $observed->calibrationDate->format('Y-m-d'),
                'candidate' => $candidate->calibrationDate->format('Y-m-d'),
            ];
        }
    }

    private function normalize(?string $value): string
    {
        $value = strtoupper(trim((string) $value));

        return preg_replace('/\s+/u', '', $value) ?? $value;
    }

    private function level(int $score): string
    {
        return match (true) {
            $score >= self::AUTO_LINK_SCORE => 'high',
            $score >= self::MEDIUM_SCORE => 'medium',
            default => 'low',
        };
    }
}
