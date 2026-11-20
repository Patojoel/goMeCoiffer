import type { Provider, Type } from '@nestjs/common';
import { AddSalonToOrganizationHandler } from '../application/commands/add-salon-to-organization/add-salon-to-organization.handler.js';
import { SalonAddedResponder } from './http/salon-added.responder.js';
import { SalonsController } from './http/salons.controller.js';

/** Contrôleurs et providers de UC-010 (ajout de salon à son organisation), réunis ici pour éviter les conflits de câblage. */
export const SALON_ADDITION_CONTROLLERS: Type[] = [SalonsController];
export const SALON_ADDITION_PROVIDERS: Provider[] = [AddSalonToOrganizationHandler, SalonAddedResponder];
