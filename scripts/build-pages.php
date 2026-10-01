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
$assets = ['styles.css', 'app.mjs', 'state.mjs', 'views.mjs', 'domain/common.mjs', 'domain/physical.mjs', 'domain/weekly.mjs', 'domain/certificates.mjs', 'favicon.svg'];
// HTML 与整个模块依赖图使用同一内容版本，避免旧浏览器缓存混用新版合成契约。
$fingerprint = hash_init('sha256');
hash_update($fingerprint, $template.$embeddedData);
foreach ($assets as $asset) hash_update($fingerprint, (string) file_get_contents($root.'/site/'.$asset));
$version = substr(hash_final($fingerprint), 0, 16);
$index = str_replace('__DEMO_DATA__', $embeddedData, $template);
$index = str_replace(['href="styles.css"', 'src="app.mjs"'], ['href="styles.css?v='.$version.'"', 'src="app.mjs?v='.$version.'"'], $index);

if (file_put_contents($dist.'/index.html', $index) === false) {
    throw new RuntimeException('Unable to write the generated index page.');
}

foreach ($assets as $asset) {
    copyFile($root.'/site/'.$asset, $dist.'/'.$asset);
    if (str_ends_with($asset, '.mjs')) {
        $source = (string) file_get_contents($dist.'/'.$asset);
        $source = preg_replace_callback('/from\s+([\'"])(\.[^\'"]+\.mjs)\1/', static fn (array $match): string => 'from '.$match[1].$match[2].'?v='.$version.$match[1], $source);
        if (file_put_contents($dist.'/'.$asset, $source) === false) throw new RuntimeException('Unable to version module '.$asset);
    }
}

copyFile($root.'/site/data/demo.json', $dist.'/data/demo.json');

$screenshots = glob($root.'/assets/screenshots/*.png') ?: [];

if (count($screenshots) !== 6) {
    throw new RuntimeException('The public gallery must contain exactly six PNG screenshots.');
}

foreach ($screenshots as $screenshot) {
    copyFile($screenshot, $dist.'/assets/screenshots/'.basename($screenshot));
}

// 新案例只收录本公开原型的三张合成截图，不扩大到其他本地验收产物。
foreach (['01-weekly.png', '02-returns.png', '03-review.png'] as $case) {
    copyFile($root.'/assets/cases/'.$case, $dist.'/assets/cases/'.$case);
}

if (file_put_contents($dist.'/.nojekyll', '') === false) {
    throw new RuntimeException('Unable to create the GitHub Pages marker.');
}

echo "OK: GitHub Pages artifact built in ".DIST_DIRECTORY.PHP_EOL;
