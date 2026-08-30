<?php

declare(strict_types=1);

const DIST_DIRECTORY = '.pages-dist';

$root = dirname(__DIR__);
$dist = $root.'/'.DIST_DIRECTORY;

/**
 * 删除构建产物目录。目标被严格限定为仓库根目录下的 .pages-dist，避免误删其他文件。
 */
function removeBuildDirectory(string $path, string $root): void
{
    if ($path !== $root.'/'.DIST_DIRECTORY || basename($path) !== DIST_DIRECTORY) {
        throw new RuntimeException('Refusing to remove an unexpected directory.');
    }

    if (! is_dir($path)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST,
    );

    foreach ($iterator as $entry) {
        $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    }

    rmdir($path);
}

function ensureDirectory(string $path): void
{
    if (! is_dir($path) && ! mkdir($path, 0755, true) && ! is_dir($path)) {
        throw new RuntimeException("Unable to create directory: {$path}");
    }
}

function copyFile(string $source, string $destination): void
{
    if (! is_file($source)) {
        throw new RuntimeException("Missing build input: {$source}");
    }

    ensureDirectory(dirname($destination));

    if (! copy($source, $destination)) {
        throw new RuntimeException("Unable to copy build input: {$source}");
    }
}

removeBuildDirectory($dist, $root);
ensureDirectory($dist);

$template = file_get_contents($root.'/site/index.template.html');
$demoData = json_decode(
    (string) file_get_contents($root.'/site/data/demo.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
);

if ($template === false || substr_count($template, '__DEMO_DATA__') !== 1) {
    throw new RuntimeException('The page template must contain exactly one demo-data placeholder.');
}

// HEX 标志确保 JSON 即使以后出现尖括号，也不会提前结束 template 元素。
$embeddedData = json_encode(
    $demoData,
    JSON_THROW_ON_ERROR
        | JSON_UNESCAPED_UNICODE
        | JSON_UNESCAPED_SLASHES
        | JSON_HEX_TAG
        | JSON_HEX_AMP
        | JSON_HEX_APOS
        | JSON_HEX_QUOT,
);
$index = str_replace('__DEMO_DATA__', $embeddedData, $template);

if (file_put_contents($dist.'/index.html', $index) === false) {
    throw new RuntimeException('Unable to write the generated index page.');
}

foreach (['styles.css', 'app.mjs', 'state.mjs', 'favicon.svg'] as $asset) {
    copyFile($root.'/site/'.$asset, $dist.'/'.$asset);
}

copyFile($root.'/site/data/demo.json', $dist.'/data/demo.json');

$screenshots = glob($root.'/assets/screenshots/*.png') ?: [];

if (count($screenshots) !== 6) {
    throw new RuntimeException('The public gallery must contain exactly six PNG screenshots.');
}

foreach ($screenshots as $screenshot) {
    copyFile($screenshot, $dist.'/assets/screenshots/'.basename($screenshot));
}

if (file_put_contents($dist.'/.nojekyll', '') === false) {
    throw new RuntimeException('Unable to create the GitHub Pages marker.');
}

echo "OK: GitHub Pages artifact built in ".DIST_DIRECTORY.PHP_EOL;
