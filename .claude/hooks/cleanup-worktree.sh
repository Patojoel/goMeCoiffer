#!/usr/bin/env bash
input=$(cat)
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

{ read -r path; read -r root; } < <(
  printf '%s' "$input" | node "$dir/json-field.js" worktree_path repo_path
)

[[ -n $path && -n $root ]] || exit 0
git -C "$root" worktree remove "$path" 2>/dev/null || true
exit 0