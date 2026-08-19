<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Tests;

use DateTimeImmutable;
use MeasurementPortfolio\Domain\CertificateObservation;
use MeasurementPortfolio\Domain\InstrumentCandidate;
use MeasurementPortfolio\Service\CertificateMatchEvaluator;

final class CertificateMatchEvaluatorTest extends TestCase
{
    public function testUniqueHighScoreCandidateCanAutoLink(): void
    {
        $assessment = (new CertificateMatchEvaluator())->evaluate(
            $this->observation(),
            [$this->candidate('INSTR-DEMO-001')],
        );

        $this->assertTrue($assessment->autoLink);
        $this->assertSame('INSTR-DEMO-001', $assessment->selectedCandidateId);
        $this->assertSame('high', $assessment->level);
        $this->assertTrue($assessment->score >= CertificateMatchEvaluator::AUTO_LINK_SCORE);
        $this->assertContains('内部编号一致', $assessment->reasons);
    }

    public function testCriticalCertificateConflictBlocksOtherwiseHighScore(): void
    {
        $candidate = $this->candidate('INSTR-DEMO-002', certificateNumber: 'CERT-DEMO-OTHER');
        $assessment = (new CertificateMatchEvaluator())->evaluate($this->observation(), [$candidate]);

        $this->assertTrue($assessment->score >= CertificateMatchEvaluator::AUTO_LINK_SCORE);
        $this->assertFalse($assessment->autoLink);
        $this->assertSame(null, $assessment->selectedCandidateId);
        $this->assertTrue($assessment->conflicts[0]['critical']);
        $this->assertSame('证书编号', $assessment->conflicts[0]['field']);
    }

    public function testTieRequiresManualReview(): void
    {
        $assessment = (new CertificateMatchEvaluator())->evaluate(
            $this->observation(),
            [$this->candidate('INSTR-DEMO-A'), $this->candidate('INSTR-DEMO-B')],
        );

        $this->assertSame(2, $assessment->tieCount);
        $this->assertFalse($assessment->autoLink);
        $this->assertSame(null, $assessment->selectedCandidateId);
    }

    public function testSparseObservationStaysLowConfidence(): void
    {
        $assessment = (new CertificateMatchEvaluator())->evaluate(
            new CertificateObservation(instrumentName: '数字压力表'),
            [$this->candidate('INSTR-DEMO-003')],
        );

        $this->assertSame(15, $assessment->score);
        $this->assertSame('low', $assessment->level);
        $this->assertFalse($assessment->autoLink);
    }

    public function testNoCandidateProducesSafeEmptyAssessment(): void
    {
        $assessment = (new CertificateMatchEvaluator())->evaluate($this->observation(), []);

        $this->assertSame(0, $assessment->score);
        $this->assertSame([], $assessment->candidateScores);
        $this->assertFalse($assessment->autoLink);
        $this->assertSame(0, $assessment->tieCount);
    }

    public function testCandidatesAreRankedByEvidence(): void
    {
        $weak = new InstrumentCandidate(
            id: 'INSTR-DEMO-WEAK',
            factoryNumber: 'EQ-DEMO-999',
            instrumentName: '温度计',
        );
        $assessment = (new CertificateMatchEvaluator())->evaluate(
            $this->observation(),
            [$weak, $this->candidate('INSTR-DEMO-STRONG')],
        );

        $this->assertSame('INSTR-DEMO-STRONG', $assessment->candidateScores[0]['id']);
        $this->assertTrue($assessment->candidateScores[0]['score'] > $assessment->candidateScores[1]['score']);
    }

    private function observation(): CertificateObservation
    {
        return new CertificateObservation(
            factoryNumber: 'EQ-DEMO-001',
            serialNumber: 'SN-DEMO-001',
            instrumentName: '数字压力表',
            specification: '0–1.6 MPa',
            calibrationDate: new DateTimeImmutable('2026-01-10'),
            issuer: '示例检测机构',
            certificateNumber: 'CERT-DEMO-2026-001',
        );
    }

    private function candidate(string $id, string $certificateNumber = 'CERT-DEMO-2026-001'): InstrumentCandidate
    {
        return new InstrumentCandidate(
            id: $id,
            factoryNumber: 'EQ-DEMO-001',
            serialNumber: 'SN-DEMO-001',
            instrumentName: '数字压力表',
            specification: '0–1.6 MPa',
            calibrationDate: new DateTimeImmutable('2026-01-10'),
            issuer: '示例检测机构',
            certificateNumber: $certificateNumber,
        );
    }
}
