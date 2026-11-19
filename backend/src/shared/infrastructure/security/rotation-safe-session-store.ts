import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import type pg from 'pg';
import './session-types.js';

const PgStore = connectPgSimple(session);
const ONE_DAY_S = 86_400;

/**
 * Magasin de sessions qui ne recrée jamais une session authentifiée supprimée (D-039). Une requête déjà en cours
 * pendant une rotation (changement de salon, réinitialisation, déconnexion) sauve à sa fin l'ancienne session ;
 * avec l'écriture « créer ou remplacer » de connect-pg-simple, l'ancien identifiant revivrait.
 *
 * Règle : une session authentifiée n'est créée que par le code qui vient de l'émettre (`freshlyIssued`, retiré avant
 * le stockage) ; toute autre sauvegarde est une mise à jour seulement, sans effet si la ligne n'existe plus.
 * Choisi plutôt qu'une liste mémoire d'identifiants supprimés : valable avec plusieurs processus et après un
 * redémarrage. Les sessions de visiteurs (sans utilisateur) gardent l'écriture habituelle.
 */
export class RotationSafePgStore extends PgStore {
  constructor(
    private readonly options: { pool: pg.Pool; tableName: string; createTableIfMissing: boolean } & Record<
      string,
      unknown
    >,
  ) {
    super(options);
  }

  /**
   * Consomme la session avant d'en émettre une autre : supprime la ligne et dit si elle existait. Une rotation qui
   * part d'une session déjà détruite (déconnexion, autre rotation) ne doit rien émettre, sinon elle la ferait revivre.
   * Atomique : de deux rotations simultanées, une seule supprime la ligne.
   */
  async consume(sid: string): Promise<boolean> {
    const res = await this.options.pool.query(
      `DELETE FROM "${this.options.tableName}" WHERE sid = $1 RETURNING sid`,
      [sid],
    );
    return (res.rowCount ?? 0) > 0;
  }

  override set(sid: string, sess: session.SessionData, done?: (err?: unknown) => void): void {
    const { freshlyIssued, ...stored } = sess;
    if (freshlyIssued || !stored.userId) return super.set(sid, stored, done);
    const expires = stored.cookie?.expires ? new Date(stored.cookie.expires).getTime() / 1000 : null;
    this.options.pool
      .query(`UPDATE "${this.options.tableName}" SET sess = $1, expire = to_timestamp($2) WHERE sid = $3`, [
        stored,
        Math.ceil(expires ?? Date.now() / 1000 + ONE_DAY_S),
        sid,
      ])
      .then(
        () => done?.(),
        (err: unknown) => done?.(err),
      );
  }
}
