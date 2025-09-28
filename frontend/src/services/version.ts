/**
 * Version service for displaying application version information.
 */

import packageJson from '../../package.json';

export class VersionService {
  /**
   * Get the application version from package.json
   */
  static getVersion(): string {
    return packageJson.version;
  }

  /**
   * Get the application name
   */
  static getAppName(): string {
    return 'E-ink PDF Templates';
  }

  /**
   * Get full version string for display
   */
  static getVersionString(): string {
    return `v${this.getVersion()}`;
  }

  /**
   * Get version info for about/footer display
   */
  static getVersionInfo(): { name: string; version: string; versionString: string } {
    return {
      name: this.getAppName(),
      version: this.getVersion(),
      versionString: this.getVersionString()
    };
  }
}