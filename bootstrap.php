<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefixes = [
        'MeasurementPortfolio\\Tests\\' => __DIR__.'/tests/',
        'MeasurementPortfolio\\' => __DIR__.'/src/',
    ];

    foreach ($prefixes as $prefix => $directory) {
        if (! str_starts_with($class, $prefix)) {
            continue;
        }

        $relative = substr($class, strlen($prefix));
        $path = $directory.str_replace('\\', '/', $relative).'.php';

        if (is_file($path)) {
            require $path;
        }

        return;
    }
});
