import { authFr } from './lang/auth.fr.js';
import { clientSpaceFr } from './lang/clientSpace.fr.js';
import { commonFr } from './lang/common.fr.js';
import { componentsFr } from './lang/components.fr.js';
import { errorsFr } from './lang/errors.fr.js';
import { healthFr } from './lang/health.fr.js';
import { navigationFr } from './lang/navigation.fr.js';
import { platformFr } from './lang/platform.fr.js';
import { rolesFr } from './lang/roles.fr.js';
import { salonsFr } from './lang/salons.fr.js';
import { teamFr } from './lang/team.fr.js';

export const fr = {
  ...commonFr,
  ...navigationFr,
  ...componentsFr,
  ...healthFr,
  ...authFr,
  ...salonsFr,
  ...teamFr,
  ...rolesFr,
  ...platformFr,
  ...clientSpaceFr,
  ...errorsFr,
} as const;

export type MessageKey = keyof typeof fr;
export type Dictionary = Record<MessageKey, string>;
