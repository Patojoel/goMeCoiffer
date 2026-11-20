import { userInfo } from 'node:os';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../app.module.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { loadLocalEnvFile } from '../../../../database/load-env.js';
import { loadConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { BootstrapSuperAdmin } from '../../application/commands/bootstrap-super-admin/bootstrap-super-admin.command.js';
import type { BootstrapSuperAdminResponse } from '../../application/commands/bootstrap-super-admin/bootstrap-super-admin.response.js';

export function extractPhoneFromArgs(argv: readonly string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith('--phone=')) {
      const value = arg.slice('--phone='.length).trim();
      if (value) return value;
    }
    if (arg === '--phone' && argv[i + 1]) {
      const value = argv[i + 1]!.trim();
      if (value) return value;
    }
  }
  throw new Error('Paramètre requis : --phone=<numéro camerounais>');
}

export function hasRecoveryFlag(argv: readonly string[]): boolean {
  return argv.includes('--recovery');
}

export interface BootstrapRunOptions {
  readonly systemUser: string;
  readonly recovery: boolean;
}

export async function runBootstrapSuperAdmin(
  commands: TransactionalCommandBus,
  phone: string,
  options: BootstrapRunOptions,
): Promise<BootstrapSuperAdminResponse> {
  return commands.execute(new BootstrapSuperAdmin(phone, options.systemUser, options.recovery));
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const args = process.argv.slice(2);
  const phone = extractPhoneFromArgs(args);
  const options = { systemUser: userInfo().username, recovery: hasRecoveryFlag(args) };
  const config = loadConfig(process.env);
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), {
    logger: ['error', 'warn'],
  });
  try {
    const commands = app.get(TransactionalCommandBus);
    const result = await runBootstrapSuperAdmin(commands, phone, options);
    if (!result.alreadyAssigned && result.existingSuperAdmins > 0)
      console.warn(
        `MODE SECOURS : ${result.existingSuperAdmins} Super Administrateur(s) existaient déjà ; nomination tracée dans le journal d'audit (utilisateur système ${options.systemUser}).`,
      );
    const status = result.alreadyAssigned ? 'déjà attribué (aucun changement)' : 'attribué';
    console.log(`SUPER_ADMIN ${status} pour l'utilisateur ${result.userId} (${result.grantedAt}).`);
  } finally {
    await app.close();
  }
}

const isEntrypoint = process.argv[1]?.endsWith('bootstrap-super-admin.cli.js') ?? false;
if (isEntrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Échec bootstrap-super-admin : ${message}`);
    process.exitCode = 1;
  });
}
