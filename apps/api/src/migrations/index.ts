import { InitShared1762430400000 } from './1762430400000-init-shared';
import { Cardholders1762500000000 } from './1762500000000-cardholders';
import { ReportingCardholders1762500000001 } from './1762500000001-reporting-cardholders';

/** Liste explicite : pas de glob, pour fonctionner à l'identique en build, en CLI et sous Jest. */
export const MIGRATIONS = [
  InitShared1762430400000,
  Cardholders1762500000000,
  ReportingCardholders1762500000001,
];
