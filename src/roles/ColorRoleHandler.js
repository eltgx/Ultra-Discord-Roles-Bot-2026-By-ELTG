'use strict';

/**
 * Name-color role helpers (VIP+ exclusive group).
 */
class ColorRoleHandler {
  /**
   * @param {import('../managers/RoleManager').RoleManager} roleManager
   * @param {object} colorsConfig
   */
  constructor(roleManager, colorsConfig) {
    this.roleManager = roleManager;
    this.colors = colorsConfig;
  }

  set(member, colorKey) {
    return this.roleManager.setColor(member, colorKey);
  }

  clear(member) {
    return this.roleManager.clearColors(member);
  }

  keys() {
    return Object.keys(this.colors);
  }
}

module.exports = { ColorRoleHandler };
