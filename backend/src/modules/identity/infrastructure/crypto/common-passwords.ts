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
  // suites de clavier (une fois les chiffres retirés : « 1q2w3e4r5t » → « qwert »)
  'qwert',
  'qwertz',
  'azert',
  'asdf',
  'asdfgh',
  'asdfghjkl',
  'zxcvbn',
  'qazwsx',
  'wxcvbn',
  'aqwzsx',
];
const LIST = new Set(COMMON);

/** Seules les lettres comptent : chiffres et symboles ajoutés avant, au milieu ou après ne rendent pas un mot rare. */
const lettersOf = (candidate: string) =>
  candidate
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z]/g, '');

/** « azertyazerty » : un mot courant répété reste courant. */
const isRepetitionOfCommonWord = (letters: string) => {
  for (let size = 1; size <= letters.length / 2; size++) {
    const word = letters.slice(0, size);
    if (letters.length % size === 0 && LIST.has(word) && word.repeat(letters.length / size) === letters)
      return true;
  }
  return false;
};

/**
 * Liste locale (mots camerounais, métier du salon, suites de clavier) et règles de motifs. À compléter par une
 * liste issue des fuites publiques (backlog).
 */
@Injectable()
export class CommonPasswordList implements CommonPasswords {
  includes(candidate: string): boolean {
    const letters = lettersOf(candidate);
    return (
      letters.length < 3 || /^(.)\1+$/.test(letters) || LIST.has(letters) || isRepetitionOfCommonWord(letters)
    );
  }
}
