import { Injectable } from '@nestjs/common';
import type { CommonPasswords } from '../../domain/new-password.js';

/**
 * Mots de passe courants (listes publiques de fuites, plus des mots attendus au Cameroun et dans un salon).
 * Comparaison sur la base normalisée : minuscules, sans accents, sans chiffres ni symboles finaux
 * (« MotDePasse2026! » → « motdepasse »).
 */
const COMMON = [
  'password',
  'passw0rd',
  'motdepasse',
  'azerty',
  'azertyuiop',
  'qwerty',
  'qwertyuiop',
  'abcdef',
  'abcdefgh',
  'abcdefghij',
  'iloveyou',
  'jetaime',
  'soleil',
  'bonjour',
  'bonsoir',
  'admin',
  'administrateur',
  'welcome',
  'bienvenue',
  'secret',
  'monsecret',
  'princesse',
  'princess',
  'football',
  'dragon',
  'sunshine',
  'master',
  'letmein',
  'loveyou',
  'chocolat',
  'doudou',
  'loulou',
  'nicolas',
  'camille',
  'motdepas',
  'changeme',
  'cameroun',
  'cameroon',
  'douala',
  'yaounde',
  'bafoussam',
  'garoua',
  'bamenda',
  'limbe',
  'kribi',
  'akwa',
  'bastos',
  'bonapriso',
  'biyemassi',
  'lionsindomptables',
  'lions',
  'indomptables',
  'mtn',
  'orange',
  'mobilemoney',
  'momo',
  'orangemoney',
  'gomecoiffer',
  'gome',
  'coiffeur',
  'coiffeuse',
  'coiffure',
  'salon',
  'salondecoiffure',
  'barbier',
  'barber',
  'barbershop',
  'beaute',
  'beauty',
  'esthetique',
  'manucure',
  'tresses',
  'perruque',
  'onglerie',
  'maquillage',
  'proprietaire',
  'patron',
  'patronne',
  'utilisateur',
  'user',
  'test',
  'testtest',
  'demo',
  'aaaaaaaaaa',
  'zzzzzzzzzz',
  'xxxxxxxxxx',
  'abc',
  'azerty123',
];
const LIST = new Set(COMMON);

const base = (candidate: string) =>
  candidate
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\d\W_]+$/u, '')
    .replace(/[\s'_-]+/g, '');

@Injectable()
export class CommonPasswordList implements CommonPasswords {
  includes(candidate: string): boolean {
    const b = base(candidate);
    return b.length === 0 || LIST.has(b) || /^(.)\1+$/.test(b) || /^\d+$/.test(candidate);
  }
}
