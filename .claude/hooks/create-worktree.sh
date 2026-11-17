#!/usr/bin/env bash
# Hook WorktreeCreate : crée le worktree dans <racine>/.worktrees/<name>.
# Robuste : ne dépend pas d'un `commit` fourni (part de HEAD sinon), tolère des
# noms de champs alternatifs, et journalise l'entrée brute pour diagnostic.
input=$(cat)
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Journal brut (utile si l'extraction échoue) — écrasé à chaque appel.
printf '%s' "$input" > "$dir/wt-last-input.json"

# Extraction via node (présent sur toutes les machines du projet), avec repli de noms de champs.
eval "$(printf '%s' "$input" | node -e '
let raw=""; process.stdin.on("data",d=>raw+=d); process.stdin.on("end",()=>{
  let d={}; try{d=JSON.parse(raw)}catch(e){}
  const pick=(...ks)=>{for(const k of ks){const v=d[k]; if(v!=null&&v!=="")return String(v);}return"";};
  const q=s=>"\x27"+String(s).replace(/\x27/g,"\x27\\\x27\x27")+"\x27";
  const name  =pick("name","worktree_name","worktreeName");
  const branch=pick("branch","branch_name","branchName")||name;
  const commit=pick("commit","base","baseRef","commit_sha","sha");
  const root  =pick("cwd","repo_path","repoRoot","project_dir","projectDir")||process.env.CLAUDE_PROJECT_DIR||"";
  process.stdout.write("WT_NAME="  +q(name)  +"\n");
  process.stdout.write("WT_BRANCH="+q(branch)+"\n");
  process.stdout.write("WT_COMMIT="+q(commit)+"\n");
  process.stdout.write("WT_ROOT="  +q(root)  +"\n");
});
')"

[ -z "$WT_ROOT" ] && WT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
# Chemin canonique de git (lettre de lecteur en majuscule sous Windows) : le harness compare
# le chemin rendu à celui que git résout dans le worktree.
[ -n "$WT_ROOT" ] && WT_ROOT="$(git -C "$WT_ROOT" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$WT_ROOT")"

if [[ -z "$WT_NAME" || -z "$WT_ROOT" ]]; then
  echo "create-worktree: name/root introuvables dans l'entrée du hook — voir $dir/wt-last-input.json" >&2
  exit 1
fi

path="${WT_ROOT}/.worktrees/${WT_NAME}"
if [ -n "$WT_COMMIT" ]; then
  git -C "$WT_ROOT" worktree add "$path" -b "$WT_BRANCH" "$WT_COMMIT" >&2
else
  git -C "$WT_ROOT" worktree add "$path" -b "$WT_BRANCH" >&2   # part de HEAD
fi
[ $? -eq 0 ] && printf '%s\n' "$path" && exit 0
exit 1
