<?php

declare(strict_types=1);

use MeasurementPortfolio\Tests\CalibrationWorkflowTest;
use MeasurementPortfolio\Tests\CertificateMatchEvaluatorTest;
use MeasurementPortfolio\Tests\SubmissionReturnWorkflowTest;
use MeasurementPortfolio\Tests\TestCase;

require dirname(__DIR__).'/bootstrap.php';

$classes = [
    CalibrationWorkflowTest::class,
    CertificateMatchEvaluatorTest::class,
    SubmissionReturnWorkflowTest::class,
];

$tests = 0;
$assertions = 0;
$failures = [];

foreach ($classes as $class) {
    $reflection = new ReflectionClass($class);

    foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
        if (! str_starts_with($method->name, 'test')) {
            continue;
        }

        /** @var TestCase $case */
        $case = $reflection->newInstance();
        $tests++;

        try {
            $method->invoke($case);
            fwrite(STDOUT, '.');
        } catch (Throwable $exception) {
            fwrite(STDOUT, 'F');
            $failures[] = sprintf('%s::%s — %s', $class, $method->name, $exception->getMessage());
        }

        $assertions += $case->assertionCount();
    }
}

fwrite(STDOUT, PHP_EOL.PHP_EOL);

if ($failures !== []) {
    foreach ($failures as $index => $failure) {
        fwrite(STDERR, sprintf("%d) %s%s", $index + 1, $failure, PHP_EOL));
    }

    fwrite(STDERR, sprintf("FAILED: %d tests, %d assertions, %d failures.%s", $tests, $assertions, count($failures), PHP_EOL));
    exit(1);
}

fwrite(STDOUT, sprintf("OK: %d tests, %d assertions.%s", $tests, $assertions, PHP_EOL));
