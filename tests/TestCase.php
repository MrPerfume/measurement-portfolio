<?php

declare(strict_types=1);

namespace MeasurementPortfolio\Tests;

use RuntimeException;
use Throwable;

abstract class TestCase
{
    private int $assertions = 0;

    public function assertionCount(): int
    {
        return $this->assertions;
    }

    protected function assertTrue(bool $condition, string $message = 'Expected true.'): void
    {
        $this->assertions++;

        if (! $condition) {
            throw new RuntimeException($message);
        }
    }

    protected function assertFalse(bool $condition, string $message = 'Expected false.'): void
    {
        $this->assertTrue(! $condition, $message);
    }

    protected function assertSame(mixed $expected, mixed $actual, string $message = ''): void
    {
        $this->assertions++;

        if ($expected !== $actual) {
            $message = $message !== '' ? $message : sprintf(
                'Failed asserting that %s is identical to %s.',
                var_export($actual, true),
                var_export($expected, true),
            );

            throw new RuntimeException($message);
        }
    }

    protected function assertContains(string $needle, array $haystack, string $message = ''): void
    {
        $this->assertions++;

        if (! in_array($needle, $haystack, true)) {
            throw new RuntimeException($message !== '' ? $message : "Missing expected value: {$needle}");
        }
    }

    /**
     * @param class-string<Throwable> $exceptionClass
     */
    protected function assertThrows(callable $callback, string $exceptionClass, ?string $messageContains = null): void
    {
        $this->assertions++;

        try {
            $callback();
        } catch (Throwable $exception) {
            if (! $exception instanceof $exceptionClass) {
                throw new RuntimeException(sprintf(
                    'Expected %s, got %s.',
                    $exceptionClass,
                    $exception::class,
                ));
            }

            if ($messageContains !== null && ! str_contains($exception->getMessage(), $messageContains)) {
                throw new RuntimeException("Exception message did not contain: {$messageContains}");
            }

            return;
        }

        throw new RuntimeException("Expected {$exceptionClass} to be thrown.");
    }
}
