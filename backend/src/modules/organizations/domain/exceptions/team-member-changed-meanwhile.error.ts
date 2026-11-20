import { ConflictError } from '../../../../shared/domain/errors.js';

export class TeamMemberChangedMeanwhileError extends ConflictError {
  override readonly code = 'TEAM_MEMBER_CHANGED_MEANWHILE';

  constructor() {
    super("Ce membre vient d'être modifié sur un autre écran. Rechargez l'équipe puis recommencez.");
  }
}
