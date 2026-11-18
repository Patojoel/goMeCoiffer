import { Command } from '@nestjs/cqrs';
import type { SignInResponse } from './sign-in.response.js';

/** UC-002 : vérifier le numéro et le mot de passe, sous la politique d'essais ; la session est ouverte par la couche HTTP. */
export class SignIn extends Command<SignInResponse> {
  readonly phone: string;
  readonly password: string;
  /** Jetons du cookie d'appareil reconnu (un par compte, au plus 5), déjà au format strict. */
  readonly deviceTokens: readonly string[];
  /** Adresse réseau de la requête, lue par la couche HTTP (jamais dans le corps). */
  readonly networkAddress: string;

  constructor(input: {
    phone: string;
    password: string;
    deviceTokens: readonly string[];
    networkAddress: string;
  }) {
    super();
    this.phone = input.phone;
    this.password = input.password;
    this.deviceTokens = input.deviceTokens;
    this.networkAddress = input.networkAddress;
  }

  /** Une commande journalisée ou sérialisée ne montre ni le mot de passe, ni le numéro, ni l'adresse, ni le jeton. */
  toJSON() {
    return { phone: '***', password: '***', deviceTokens: '***', networkAddress: '***' };
  }
}
