<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$excludedDirectories = ['.git', '.pages-dist', 'node_modules', 'output', 'vendor'];
$excludedFiles = ['scripts/verify-public-urls.php', 'scripts/verify.sh'];
$violations = [];

function approvedPublicUrl(string $url, string $relative = ''): bool
{
    $parts = parse_url(rtrim($url, '.,;'));

    if (! is_array($parts) || ! isset($parts['scheme'], $parts['host'])) {
        return false;
    }

    $scheme = strtolower($parts['scheme']);
    $host = strtolower($parts['host']);
    $path = $parts['path'] ?? '/';

    // 只允许锁文件的三项开发依赖，以及明确的测试/截图脚本访问本地静态服务。
    // 这不是运行期白名单扩张；site/ 与发布 HTML 仍只能引用原有公开来源。
    if ($relative === 'package-lock.json' && $scheme === 'https' && $host === 'registry.npmjs.org'
        && preg_match('#^/(?:@playwright/test/-/test|playwright/-/playwright|playwright-core/-/playwright-core)-[0-9.]+\.tgz$#', $path)) {
        return true;
    }
    if (in_array($relative, ['playwright.config.mjs', 'e2e/portfolio.spec.mjs', 'scripts/capture-cases.mjs'], true)
        && $scheme === 'http' && $host === 'localhost' && ($parts['port'] ?? null) === 4187 && $path === '/') {
        return true;
    }

    if ($scheme === 'https' && $host === 'github.com') {
        return $path === '/MrPerfume' || str_starts_with($path, '/MrPerfume/measurement-portfolio');
    }

    if ($scheme === 'https' && $host === 'mrperfume.github.io') {
        return $path === '/measurement-portfolio' || str_starts_with($path, '/measurement-portfolio/');
    }

    return $scheme === 'http' && $host === 'www.w3.org' && $path === '/2000/svg';
}

$iterator = new RecursiveIteratorIterator(
    new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        static function (SplFileInfo $entry) use ($excludedDirectories): bool {
            return ! ($entry->isDir() && in_array($entry->getFilename(), $excludedDirectories, true));
        },
    ),
);

foreach ($iterator as $entry) {
    if (! $entry->isFile()) {
        continue;
    }

    $relative = ltrim(str_replace($root, '', $entry->getPathname()), DIRECTORY_SEPARATOR);

    if (in_array($relative, $excludedFiles, true)) {
        continue;
    }

    $contents = file_get_contents($entry->getPathname());

    if ($contents === false || str_contains($contents, "\0")) {
        continue;
    }

    if (preg_match_all('#https?://[^\s<>"\'\)\]]+#i', $contents, $matches, PREG_OFFSET_CAPTURE)) {
        foreach ($matches[0] as [$url, $offset]) {
            if (! approvedPublicUrl($url, $relative)) {
                $line = substr_count(substr($contents, 0, $offset), "\n") + 1;
                $violations[] = "{$relative}:{$line}: unexpected public URL {$url}";
            }
        }
    }

    if (preg_match_all('/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/', $contents, $addresses, PREG_OFFSET_CAPTURE)) {
        foreach ($addresses[0] as [$address, $offset]) {
            $line = substr_count(substr($contents, 0, $offset), "\n") + 1;
            $violations[] = "{$relative}:{$line}: unexpected IPv4 address {$address}";
        }
    }
}

if ($violations !== []) {
    fwrite(STDERR, implode(PHP_EOL, $violations).PHP_EOL);
    exit(1);
}

echo 'OK: public URLs and network-address boundary passed'.PHP_EOL;
