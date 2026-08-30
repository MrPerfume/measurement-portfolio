<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$dist = $root.'/.pages-dist';
$indexPath = $dist.'/index.html';

function assertPage(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$index = file_get_contents($indexPath);
assertPage($index !== false, 'Missing generated index.html.');
assertPage(! str_contains($index, '__DEMO_DATA__'), 'Demo-data placeholder was not replaced.');
assertPage(str_contains($index, "connect-src 'none'"), 'The page must keep network connections disabled.');
assertPage(str_contains($index, '脱敏演示数据 · Demo Data'), 'The public demo label is missing.');
assertPage(! preg_match('/<script(?![^>]*\bsrc=)[^>]*>/i', $index), 'Inline scripts are not allowed.');

$demoData = json_decode(
    (string) file_get_contents($root.'/site/data/demo.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
);
assertPage(($demoData['meta']['prototype'] ?? null) === '静态交互原型', 'Demo metadata is invalid.');
assertPage(count($demoData['roles'] ?? []) === 3, 'The demo must expose exactly three role views.');
assertPage(count($demoData['scenarios'] ?? []) === 4, 'The demo must expose exactly four scenarios.');

$document = new DOMDocument();
$previous = libxml_use_internal_errors(true);
$loaded = $document->loadHTML($index, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
libxml_clear_errors();
libxml_use_internal_errors($previous);
assertPage($loaded, 'Generated HTML could not be parsed.');

$xpath = new DOMXPath($document);
assertPage($xpath->query('//*[@id="demo"]')->length === 1, 'Interactive demo landmark is missing.');
assertPage($xpath->query('//figure[contains(@class, "gallery-featured") or ancestor::*[@class="gallery"]]')->length >= 6, 'The gallery must show six screenshots.');

foreach ($xpath->query('//*[@src or @href]') as $node) {
    foreach (['src', 'href'] as $attribute) {
        if (! $node->hasAttribute($attribute)) {
            continue;
        }

        $reference = trim($node->getAttribute($attribute));

        if ($reference === '' || str_starts_with($reference, '#') || preg_match('#^https?://#i', $reference)) {
            continue;
        }

        $path = parse_url($reference, PHP_URL_PATH);
        assertPage(is_string($path) && is_file($dist.'/'.ltrim($path, '/')), "Broken local asset reference: {$reference}");
    }
}

foreach (range(1, 6) as $number) {
    $matches = glob(sprintf('%s/assets/screenshots/%02d-*.png', $dist, $number)) ?: [];
    assertPage(count($matches) === 1, sprintf('Screenshot %02d is missing or ambiguous.', $number));
}

echo 'OK: generated Pages artifact and internal references are valid'.PHP_EOL;
