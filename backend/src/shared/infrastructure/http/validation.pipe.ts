import { StandardSchemaValidationPipe } from '@nestjs/common';
import { RequestValidationError } from '../security/security-errors.js';

type Issue = { message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> };

const pathOf = (issue: Issue) =>
  (issue.path ?? []).map((segment) => String(typeof segment === 'object' ? segment.key : segment)).join('.');

/** Validation des `@Body({ schema })`, `@Query({ schema })`… par les schémas Zod de @gomecoiffer/contracts. */
export const contractValidationPipe = () =>
  new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      new RequestValidationError(
        (issues as readonly Issue[]).map((i) => ({ path: pathOf(i), message: i.message })),
      ),
  });
