import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Clock, IdGenerator } from '../../application/ports.js';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class UuidV7Generator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
