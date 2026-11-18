import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { LoggingSmsSender } from '../../infrastructure/sms/logging-sms-sender.js';

const MIREILLE = PhoneNumber.parse('6 77 12 34 56');
const TEXT = 'GoMeCoiffer : votre code est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.';

describe('The fake SMS provider used before a real one is plugged in', () => {
  it('shows the code in the logs on a developer machine, so the sign-up can be tried', async () => {
    const lines: string[] = [];
    await new LoggingSmsSender(true, (line) => lines.push(line)).send(MIREILLE, TEXT);

    expect(lines).toEqual([`→ 6 77 •• •• 56 : ${TEXT}`]);
  });

  it('hides the code everywhere else, so reading the logs never lets anyone sign up on a number', async () => {
    const lines: string[] = [];
    await new LoggingSmsSender(false, (line) => lines.push(line)).send(MIREILLE, TEXT);

    expect(lines[0]).not.toContain('482913');
    expect(lines[0]).toContain('votre code est ••••••');
  });
});
