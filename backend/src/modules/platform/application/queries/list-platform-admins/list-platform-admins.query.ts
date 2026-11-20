import { Query } from '@nestjs/cqrs';
import type { ListPlatformAdminsReadModel } from './list-platform-admins.read-model.js';

export class ListPlatformAdmins extends Query<ListPlatformAdminsReadModel> {
  constructor() {
    super();
  }
}

