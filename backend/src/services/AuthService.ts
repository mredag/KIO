import bcrypt from 'bcrypt';
import { DatabaseService } from '../database/DatabaseService.js';

/**
 * AuthService handles authentication operations
 * - Password hashing with bcrypt (cost factor 10)
 * - Credential verification against database
 */
export class AuthService {
  private db: DatabaseService;
  private readonly BCRYPT_ROUNDS = 10;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Hash a password using bcrypt with cost factor 10
   * Requirements: 12.5
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Verify credentials against stored hash in database
   * Requirements: 12.2
   */
  async verifyCredentials(username: string, password: string): Promise<boolean> {
    try {
      // For this system, we only have one admin user
      // Username is validated but password is what matters
      if (username !== 'admin') {
        return false;
      }

      const settings = this.db.getSettings();
      const storedHash = settings.admin_password_hash;

      if (!storedHash) {
        return false;
      }

      return bcrypt.compare(password, storedHash);
    } catch (error) {
      console.error('Error verifying credentials:', error);
      return false;
    }
  }

  /**
   * Update admin password
   * Requirements: 12.5
   */
  async updatePassword(newPassword: string): Promise<void> {
    const hashedPassword = await this.hashPassword(newPassword);
    this.db.updateSettings({ admin_password_hash: hashedPassword });
  }
}
