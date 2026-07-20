'use strict';

/**
 * Rank role helpers — thin wrappers around RoleManager for clarity.
 */
class RankRoleHandler {
  /**
   * @param {import('../managers/RoleManager').RoleManager} roleManager
   * @param {import('../services/RankService').RankService} rankService
   */
  constructor(roleManager, rankService) {
    this.roleManager = roleManager;
    this.rankService = rankService;
  }

  sync(member, xp) {
    const rank = this.rankService.rankForXp(xp);
    return this.roleManager.syncRankRole(member, rank);
  }

  conflictingRoleIds() {
    return this.rankService.allRankRoleIds();
  }
}

module.exports = { RankRoleHandler };
