#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

use_ripgrep() {
    command -v rg >/dev/null 2>&1 && [[ "${VERIFY_FORCE_PORTABLE:-0}" != '1' ]]
}

public_files() {
    if use_ripgrep; then
        rg --files --hidden -g '!.git/**' -g '!vendor/**' -g '!node_modules/**'

        return
    fi

    find . -type f \
        -not -path './.git/*' \
        -not -path './vendor/*' \
        -not -path './node_modules/*' \
        -print | sed 's#^\./##'
}

scan_public_text() {
    local pattern="$1"

    if use_ripgrep; then
        rg -n -i --hidden \
            -g '!.git/**' \
            -g '!vendor/**' \
            -g '!node_modules/**' \
            -g '!scripts/verify.sh' \
            -- "$pattern" .

        return
    fi

    local matched=1

    while IFS= read -r file; do
        [[ "$file" == 'scripts/verify.sh' ]] && continue

        if grep -I -E -n -i -- "$pattern" "$file"; then
            matched=0
        fi
    done < <(public_files)

    return "$matched"
}

echo '[1/5] PHP syntax'
php_files="$(public_files | grep -E '\.php$' | sort)"
php_files_count="$(printf '%s\n' "$php_files" | wc -l | tr -d ' ')"
while IFS= read -r file; do
    php -l "$file" >/dev/null
done <<< "$php_files"
echo "OK: ${php_files_count} PHP files"

echo '[2/5] Domain tests'
php tests/run.php

echo '[3/5] Composer metadata'
if command -v composer >/dev/null 2>&1; then
    composer validate --strict --no-check-publish
else
    php -r 'json_decode(file_get_contents("composer.json"), true, 512, JSON_THROW_ON_ERROR);'
    echo 'OK: composer.json is valid JSON (Composer unavailable)'
fi

echo '[4/5] Forbidden files'
forbidden_files="$(public_files | grep -E -i '(^|/)(\.env($|\.)|.*\.(sqlite3?|sql(\.gz)?|pem|key|p12|pfx|crt|cer|pdf|xlsx?|csv|zip|tar(\.gz)?)$)' || true)"
if [[ -n "$forbidden_files" ]]; then
    echo 'Forbidden public files found:' >&2
    echo "$forbidden_files" >&2
    exit 1
fi
echo 'OK: no forbidden file types'

echo '[5/5] Sensitive text and private-boundary patterns'
sensitive_pattern='-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[ps]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer[[:space:]]+[A-Za-z0-9._-]{20,}|(password|passwd|secret|token|webhook)[[:space:]]*[:=][[:space:]]*["'"'][^"'"']{8,}["'"']'
if scan_public_text "$sensitive_pattern"; then
    echo 'Potential secret-like value found.' >&2
    exit 1
fi

private_boundary_pattern='/Users/[A-Za-z0-9._-]+/(\.codex|Documents/Dev)|测试环境部署工作日志|外部AI访问测试站说明|领导预览包|[0-9a-f]{40}'
if scan_public_text "$private_boundary_pattern"; then
    echo 'Potential private path, document, or source-history reference found.' >&2
    exit 1
fi

if scan_public_text 'https?://|([0-9]{1,3}\.){3}[0-9]{1,3}'; then
    echo 'Unexpected URL or IPv4 address found; review before publication.' >&2
    exit 1
fi

echo 'OK: sensitive text scan passed'
echo 'Verification complete.'
