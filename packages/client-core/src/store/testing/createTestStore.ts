import type { AppDependencies } from '../dependencies/AppDependencies.js';
import { createCoreStore } from '../store.js';

const notProvided = (name: string) => () =>
  Promise.reject(new Error(`Gateway « ${name} » non fourni au test.`));

const unprovided: AppDependencies = {
  health: { check: notProvided('health') },
  auth: {
    getSession: notProvided('auth.getSession'),
    signIn: notProvided('auth.signIn'),
    signOut: notProvided('auth.signOut'),
    requestSignUpCode: notProvided('auth.requestSignUpCode'),
    confirmSignUp: notProvided('auth.confirmSignUp'),
    requestPasswordResetCode: notProvided('auth.requestPasswordResetCode'),
    resetPassword: notProvided('auth.resetPassword'),
  },
  salons: {
    createOrganization: notProvided('salons.createOrganization'),
    addSalon: notProvided('salons.addSalon'),
    selectActiveSalon: notProvided('salons.selectActiveSalon'),
  },
  team: {
    listInvitations: notProvided('team.listInvitations'),
    inviteCollaborator: notProvided('team.inviteCollaborator'),
    cancelInvitation: notProvided('team.cancelInvitation'),
    listTeam: notProvided('team.listTeam'),
    changeCollaboratorRole: notProvided('team.changeCollaboratorRole'),
    removeCollaborator: notProvided('team.removeCollaborator'),
  },
  joinSalon: {
    requestCode: notProvided('joinSalon.requestCode'),
    provePhone: notProvided('joinSalon.provePhone'),
    listProvenInvitations: notProvided('joinSalon.listProvenInvitations'),
    acceptInvitation: notProvided('joinSalon.acceptInvitation'),
  },
  roles: {
    getRoles: notProvided('roles.getRoles'),
    adjustRolePermissions: notProvided('roles.adjustRolePermissions'),
  },
  clientSpace: {
    requestCode: notProvided('clientSpace.requestCode'),
    verifyCode: notProvided('clientSpace.verifyCode'),
    getSession: notProvided('clientSpace.getSession'),
  },
  platform: {
    listAdmins: notProvided('platform.listAdmins'),
    grantRole: notProvided('platform.grantRole'),
    revokeRole: notProvided('platform.revokeRole'),
  },
};

export const createTestStore = (overrides: Partial<AppDependencies> = {}) =>
  createCoreStore({ ...unprovided, ...overrides });
