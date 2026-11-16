import { joinNames } from './format';
import type { Civility, Lang } from './types';

/**
 * Personnes d'une invitation : libellés, civilités et forme d'adresse
 * (singulier / pluriel, masculin / féminin) pour s'adresser correctement à une ou plusieurs personnes.
 */

export const CIVILITIES: { id: Civility; fr: string; en: string; gender: Gender }[] = [
  { id: 'm', fr: 'M.', en: 'Mr', gender: 'm' },
  { id: 'mme', fr: 'Mme', en: 'Mrs', gender: 'f' },
  { id: 'mlle', fr: 'Mlle', en: 'Miss', gender: 'f' },
  { id: 'dr', fr: 'Dr', en: 'Dr', gender: 'x' },
];

/** m = masculin, f = féminin, x = inconnu (forme inclusive). */
export type Gender = 'm' | 'f' | 'x';
/** Forme d'adresse : une personne (m, f, x) ou plusieurs (p, ou pf si toutes féminines). */
export type AddressForm = Gender | 'p' | 'pf';

interface Person {
  full_name: string;
  civility?: Civility | null;
}

const civ = (c?: Civility | null) => CIVILITIES.find((x) => x.id === c);

export const genderOf = (p: Person): Gender => civ(p.civility)?.gender ?? 'x';

export function addressForm(people: Person[]): AddressForm {
  if (people.length > 1) return people.every((p) => genderOf(p) === 'f') ? 'pf' : 'p';
  return people[0] ? genderOf(people[0]) : 'x';
}

/** « M. Paul Ngo » (ou « Paul Ngo » sans civilité). */
export function personLabel(p: Person, lang: Lang = 'fr') {
  const c = civ(p.civility);
  return c ? `${c[lang]} ${p.full_name}` : p.full_name;
}

/** « M. Paul Ngo et Mme Marie Ngo » : nomme toujours chaque personne. */
export const peopleLabel = (people: Person[], lang: Lang = 'fr') => joinNames(people.map((p) => personLabel(p, lang)), lang);

/** Nom affiché d'une invitation : le nom choisi, sinon les noms des personnes. */
export function invitationName(inv: { household_name?: string | null; guests?: Person[] }, lang: Lang = 'fr') {
  return inv.household_name?.trim() || peopleLabel(inv.guests || [], lang) || 'Invitation sans nom';
}
