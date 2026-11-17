import { InvalidValueError } from './errors.js';

/** Intervalle [start, end[ : un rendez-vous qui finit à 10 h ne chevauche pas celui qui commence à 10 h. */
export class TimeRange {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static of(start: Date, end: Date): TimeRange {
    if (!(start.getTime() < end.getTime())) {
      throw new InvalidValueError('Une plage horaire doit finir après son début.');
    }
    return new TimeRange(start, end);
  }

  get durationInMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / 60_000;
  }

  overlaps(other: TimeRange): boolean {
    return this.start < other.end && other.start < this.end;
  }

  contains(other: TimeRange): boolean {
    return this.start <= other.start && other.end <= this.end;
  }
}
