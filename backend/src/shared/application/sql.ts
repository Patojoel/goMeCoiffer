/** Requête prête à exécuter : texte avec $1…$n et valeurs liées (node-postgres). */
export interface SqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

type Part =
  { readonly kind: 'text'; readonly text: string } | { readonly kind: 'value'; readonly value: unknown };

/** Morceau de SQL composable ; seuls `sql`, `sql.unsafe` et `sql.join` en fabriquent. */
export class SqlFragment implements SqlStatement {
  constructor(private readonly parts: readonly Part[]) {}

  flatten(): readonly Part[] {
    return this.parts;
  }

  get text(): string {
    let index = 0;
    return this.parts.map((p) => (p.kind === 'text' ? p.text : `$${++index}`)).join('');
  }

  get values(): readonly unknown[] {
    return this.parts.flatMap((p) => (p.kind === 'value' ? [p.value] : []));
  }
}

function build(strings: TemplateStringsArray, ...values: readonly unknown[]): SqlFragment {
  const parts: Part[] = [];
  strings.forEach((text, i) => {
    parts.push({ kind: 'text', text });
    if (i >= values.length) return;
    const value = values[i];
    if (value instanceof SqlFragment) parts.push(...value.flatten());
    else parts.push({ kind: 'value', value });
  });
  return new SqlFragment(parts);
}

/** Gabarit des lectures : chaque `${valeur}` devient un paramètre lié, jamais du texte SQL. */
export const sql = Object.assign(build, {
  /** Constante du code uniquement (liste blanche de tri, nom de colonne) ; jamais une entrée utilisateur. */
  unsafe: (constant: string): SqlFragment => new SqlFragment([{ kind: 'text', text: constant }]),
  join: (fragments: readonly SqlFragment[], separator: string): SqlFragment =>
    new SqlFragment(
      fragments.flatMap((f, i) =>
        i === 0 ? f.flatten() : [{ kind: 'text', text: separator } as const, ...f.flatten()],
      ),
    ),
});
