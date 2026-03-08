/**
 * FigJamClient — Stub implementation
 * Original file was missing from repository.
 */

export class FigJamClient {
  constructor() {}

  static async listPages() {
    return [];
  }

  async connect(pageTitle) {
    console.warn('FigJamClient is not fully implemented in this version.');
    return this;
  }

  async createSticky(text, x, y, color) {
    throw new Error('FigJam support is currently disabled (missing client implementation).');
  }

  close() {}
}
