/**
 * CouponService - Core business logic for the WhatsApp coupon loyalty system
 * 
 * Manages token issuance, consumption, wallet operations, and redemptions.
 * All operations are idempotent and include comprehensive event logging.
 * 
 * Requirements: 1.1-1.4, 2.4, 4.2-4.3, 5.2-5.3, 7.1-7.5, 10.2, 13.1, 
 *               19.1-19.3, 20.1-20.4, 21.3-21.4, 23.2-23.3
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { CouponToken, CouponWallet } from '../database/types.js';
import { TokenGenerator } from './TokenGenerator.js';
import { PhoneNormalizer } from './PhoneNormalizer.js';
import { EventLogService } from './EventLogService.js';
import { CouponPolicyService } from './CouponPolicyService.js';

export class CouponService {
  private db: Database.Database;
  private eventLog: EventLogService;
  private policyService: CouponPolicyService;
  private whatsappNumber: string;

  constructor(db: Database.Database, whatsappNumber?: string) {
    this.db = db;
    this.eventLog = new EventLogService(db);
    this.policyService = new CouponPolicyService(db);
    this.whatsappNumber = whatsappNumber || process.env.WHATSAPP_NUMBER || '';
  }

  /**
   * Get the policy service for external access
   */
  getPolicyService(): CouponPolicyService {
    return this.policyService;
  }

  /**
   * Get current redemption threshold from policy
   */
  getRedemptionThreshold(): number {
    return this.policyService.getRedemptionThreshold();
  }

  /**
   * Issue a new coupon token
   * Generates a unique token with collision retry (up to 3 attempts)
   * 
   * Requirements: 1.1, 1.2, 1.3, 1.4, 21.3, 21.4
   * 
   * @param kioskId - Identifier of the kiosk issuing the token
   * @param issuedFor - Optional reference (e.g., massage session ID)
   * @returns Token object with WhatsApp deep link
   */
  issueToken(kioskId: string, issuedFor?: string): CouponToken & { waUrl: string; waText: string } {
    const maxRetries = 3;
    let attempts = 0;
    let token: string | null = null;

    // Retry loop for collision handling
    while (attempts < maxRetries && !token) {
      attempts++;
      const candidate = TokenGenerator.generate();

      // Check for collision
      const existing = this.db
        .prepare('SELECT token FROM coupon_tokens WHERE token = ?')
        .get(candidate);

      if (!existing) {
        token = candidate;
      }
    }

    if (!token) {
      throw new Error('Failed to generate unique token after 3 attempts');
    }

    // Calculate expiration (24 hours from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Store token in database
    this.db
      .prepare(
        `INSERT INTO coupon_tokens (
          token, status, issued_for, kiosk_id, expires_at, created_at, updated_at
        ) VALUES (?, 'issued', ?, ?, ?, ?, ?)`
      )
      .run(
        token,
        issuedFor || null,
        kioskId,
        expiresAt.toISOString(),
        now.toISOString(),
        now.toISOString()
      );

    // Log issuance event
    this.eventLog.logEvent({
      event: 'issued',
      token,
      details: {
        kioskId,
        issuedFor,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // Generate WhatsApp deep link
    const waText = `KUPON ${token}`;
    const waUrl = `https://wa.me/${this.whatsappNumber}?text=${encodeURIComponent(waText)}`;

    return {
      token,
      status: 'issued',
      issuedFor,
      kioskId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      waUrl,
      waText,
    };
  }

  /**
   * Consume a coupon token
   * Validates token, updates wallet, and logs event
   * Idempotent: returns existing balance if token already used
   * 
   * Requirements: 2.4, 7.1, 7.2, 7.3, 7.4, 7.5, 19.1, 19.2, 19.3
   * 
   * @param phone - Customer phone number (will be normalized)
   * @param token - Token to consume
   * @returns Balance information
   */
  consumeToken(
    phone: string,
    token: string
  ): { ok: boolean; balance: number; remainingToFree: number; error?: string } {
    // Normalize phone number
    const normalizedPhone = PhoneNormalizer.normalize(phone);

    // Use transaction for atomicity
    return this.db.transaction(() => {
      // Get token
      const tokenRow = this.db
        .prepare('SELECT * FROM coupon_tokens WHERE token = ?')
        .get(token) as any;

      const threshold = this.policyService.getRedemptionThreshold();

      if (!tokenRow) {
        return {
          ok: false,
          balance: 0,
          remainingToFree: threshold,
          error: 'INVALID_TOKEN',
        };
      }

      // Check if already used
      if (tokenRow.status === 'used') {
        // Return error for already-used token
        const wallet = this.getOrCreateWallet(normalizedPhone);
        const remainingToFree = Math.max(0, threshold - wallet.couponCount);
        
        return {
          ok: false,
          balance: wallet.couponCount,
          remainingToFree,
          error: 'ALREADY_USED',
        };
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(tokenRow.expires_at);
      
      if (now > expiresAt) {
        // Mark as expired
        this.db
          .prepare("UPDATE coupon_tokens SET status = 'expired', updated_at = ? WHERE token = ?")
          .run(now.toISOString(), token);

        return {
          ok: false,
          balance: 0,
          remainingToFree: threshold,
          error: 'EXPIRED_TOKEN',
        };
      }

      // Check status is 'issued'
      if (tokenRow.status !== 'issued') {
        return {
          ok: false,
          balance: 0,
          remainingToFree: threshold,
          error: 'INVALID_TOKEN',
        };
      }

      // Update token status to 'used'
      this.db
        .prepare(
          `UPDATE coupon_tokens 
           SET status = 'used', phone = ?, used_at = ?, updated_at = ? 
           WHERE token = ?`
        )
        .run(normalizedPhone, now.toISOString(), now.toISOString(), token);

      // Get or create wallet
      const wallet = this.getOrCreateWallet(normalizedPhone);

      // Increment coupon count and total earned
      const newBalance = wallet.couponCount + 1;
      const newTotalEarned = wallet.totalEarned + 1;

      this.db
        .prepare(
          `UPDATE coupon_wallets 
           SET coupon_count = ?, total_earned = ?, last_message_at = ?, updated_at = ? 
           WHERE phone = ?`
        )
        .run(
          newBalance,
          newTotalEarned,
          now.toISOString(),
          now.toISOString(),
          normalizedPhone
        );

      // Log coupon awarded event
      this.eventLog.logEvent({
        phone: normalizedPhone,
        event: 'coupon_awarded',
        token,
        details: {
          newBalance,
          totalEarned: newTotalEarned,
        },
      });

      const remainingToFree = Math.max(0, threshold - newBalance);

      return {
        ok: true,
        balance: newBalance,
        remainingToFree,
      };
    })();
  }

  /**
   * Get wallet by phone number
   * Returns null if wallet doesn't exist
   * 
   * Requirements: 13.1
   * 
   * @param phone - Customer phone number (will be normalized)
   * @returns Wallet or null
   */
  getWallet(phone: string): CouponWallet | null {
    const normalizedPhone = PhoneNormalizer.normalize(phone);

    const row = this.db
      .prepare('SELECT * FROM coupon_wallets WHERE phone = ?')
      .get(normalizedPhone) as any;

    if (!row) {
      return null;
    }

    return this.parseWalletRow(row);
  }

  /**
   * Claim a redemption (exchange 4 coupons for free massage)
   * Idempotent: returns existing redemption ID if pending redemption exists
   * 
   * Requirements: 4.2, 4.3, 20.1, 20.2, 20.3, 20.4
   * 
   * @param phone - Customer phone number (will be normalized)
   * @returns Redemption result with isNew flag to distinguish new vs existing pending
   */
  claimRedemption(
    phone: string,
    tierId?: number  // Optional: specific reward tier to claim
  ): { ok: boolean; redemptionId?: string; balance?: number; needed?: number; threshold?: number; rewardName?: string; error?: string; isNew?: boolean } {
    const normalizedPhone = PhoneNormalizer.normalize(phone);
    const threshold = this.policyService.getRedemptionThreshold();

    return this.db.transaction(() => {
      // Get wallet
      const wallet = this.getOrCreateWallet(normalizedPhone);

      // Determine which tier to use
      let couponsRequired = threshold;
      let rewardName = 'Ücretsiz Masaj';
      
      if (tierId) {
        const tiers = this.policyService.getAllRewardTiers();
        const selectedTier = tiers.find(t => t.id === tierId && t.isActive);
        if (selectedTier) {
          couponsRequired = selectedTier.couponsRequired;
          rewardName = selectedTier.nameTr;
        }
      }

      // Log redemption attempt
      this.eventLog.logEvent({
        phone: normalizedPhone,
        event: 'redemption_attempt',
        details: {
          currentBalance: wallet.couponCount,
          requestedTier: tierId,
          couponsRequired,
        },
      });

      // Check for existing pending redemption (idempotency)
      const existingRedemption = this.db
        .prepare(
          `SELECT * FROM coupon_redemptions 
           WHERE phone = ? AND status = 'pending' 
           ORDER BY created_at DESC 
           LIMIT 1`
        )
        .get(normalizedPhone) as any;

      if (existingRedemption) {
        // Return existing redemption ID without creating new one
        // Mark isNew: false so the caller knows this is an existing pending redemption
        return {
          ok: true,
          redemptionId: existingRedemption.id,
          rewardName,
          isNew: false,  // Important: indicates this is NOT a new redemption
        };
      }

      // Check if wallet has enough coupons
      if (wallet.couponCount < couponsRequired) {
        // Log blocked redemption
        this.eventLog.logEvent({
          phone: normalizedPhone,
          event: 'redemption_blocked',
          details: {
            reason: 'insufficient_coupons',
            currentBalance: wallet.couponCount,
            needed: couponsRequired - wallet.couponCount,
            threshold: couponsRequired,
          },
        });

        return {
          ok: false,
          balance: wallet.couponCount,
          needed: couponsRequired - wallet.couponCount,
          threshold: couponsRequired,
          error: 'INSUFFICIENT_COUPONS',
        };
      }

      // Subtract coupons
      const newBalance = wallet.couponCount - couponsRequired;
      const newTotalRedeemed = wallet.totalRedeemed + couponsRequired;
      const now = new Date();

      this.db
        .prepare(
          `UPDATE coupon_wallets 
           SET coupon_count = ?, total_redeemed = ?, last_message_at = ?, updated_at = ? 
           WHERE phone = ?`
        )
        .run(
          newBalance,
          newTotalRedeemed,
          now.toISOString(),
          now.toISOString(),
          normalizedPhone
        );

      // Create redemption record
      const redemptionId = randomUUID();
      
      this.db
        .prepare(
          `INSERT INTO coupon_redemptions (
            id, phone, coupons_used, status, created_at
          ) VALUES (?, ?, ?, 'pending', ?)`
        )
        .run(redemptionId, normalizedPhone, couponsRequired, now.toISOString());

      // Log granted redemption
      this.eventLog.logEvent({
        phone: normalizedPhone,
        event: 'redemption_granted',
        details: {
          redemptionId,
          couponsUsed: couponsRequired,
          rewardName,
          newBalance,
        },
      });

      return {
        ok: true,
        redemptionId,
        rewardName,
        isNew: true,  // This is a newly created redemption
      };
    })();
  }

  /**
   * Complete a redemption (mark as fulfilled)
   * 
   * Requirements: 5.2, 5.3
   * 
   * @param redemptionId - Redemption ID to complete
   * @param adminUsername - Username of admin completing the redemption
   */
  completeRedemption(redemptionId: string, adminUsername: string): void {
    const now = new Date();

    // Check redemption exists
    const redemption = this.db
      .prepare('SELECT * FROM coupon_redemptions WHERE id = ?')
      .get(redemptionId) as any;

    if (!redemption) {
      throw new Error('Redemption not found');
    }

    // Update status to completed
    this.db
      .prepare(
        `UPDATE coupon_redemptions 
         SET status = 'completed', completed_at = ? 
         WHERE id = ?`
      )
      .run(now.toISOString(), redemptionId);

    // Log event
    this.eventLog.logEvent({
      phone: redemption.phone,
      event: 'redemption_granted',
      details: {
        redemptionId,
        action: 'completed',
        completedBy: adminUsername,
      },
    });
  }

  /**
   * Reject a redemption and refund coupons
   * 
   * Requirements: 23.2, 23.3
   * 
   * @param redemptionId - Redemption ID to reject
   * @param note - Reason for rejection (required)
   * @param adminUsername - Username of admin rejecting the redemption
   */
  rejectRedemption(redemptionId: string, note: string, adminUsername: string): void {
    if (!note || note.trim().length === 0) {
      throw new Error('Rejection note is required');
    }

    const now = new Date();

    return this.db.transaction(() => {
      // Get redemption
      const redemption = this.db
        .prepare('SELECT * FROM coupon_redemptions WHERE id = ?')
        .get(redemptionId) as any;

      if (!redemption) {
        throw new Error('Redemption not found');
      }

      // Update redemption status
      this.db
        .prepare(
          `UPDATE coupon_redemptions 
           SET status = 'rejected', rejected_at = ?, note = ? 
           WHERE id = ?`
        )
        .run(now.toISOString(), note, redemptionId);

      // Refund coupons to wallet
      this.db
        .prepare(
          `UPDATE coupon_wallets 
           SET coupon_count = coupon_count + ?, 
               total_redeemed = total_redeemed - ?, 
               updated_at = ? 
           WHERE phone = ?`
        )
        .run(redemption.coupons_used, redemption.coupons_used, now.toISOString(), redemption.phone);

      // Log event
      this.eventLog.logEvent({
        phone: redemption.phone,
        event: 'redemption_blocked',
        details: {
          redemptionId,
          action: 'rejected',
          reason: note,
          refundedCoupons: redemption.coupons_used,
          rejectedBy: adminUsername,
        },
      });
    })();
  }

  /**
   * Opt out of marketing messages
   * 
   * Requirements: 10.2
   * 
   * @param phone - Customer phone number (will be normalized)
   */
  optOut(phone: string): void {
    const normalizedPhone = PhoneNormalizer.normalize(phone);
    const now = new Date();

    // Get or create wallet
    this.getOrCreateWallet(normalizedPhone);

    // Update opted_in_marketing to 0
    this.db
      .prepare(
        `UPDATE coupon_wallets 
         SET opted_in_marketing = 0, updated_at = ? 
         WHERE phone = ?`
      )
      .run(now.toISOString(), normalizedPhone);
  }

  /**
   * Clean up expired and old tokens
   * Deletes tokens with status='issued' that expired more than 7 days ago
   * Deletes tokens with status='used' that were used more than 90 days ago
   * 
   * Requirements: 22.1, 22.2, 22.4
   * 
   * @returns Count of deleted tokens
   */
  cleanupExpiredTokens(): number {
    const now = new Date();
    
    // Calculate cutoff dates
    const expiredCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const usedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

    return this.db.transaction(() => {
      // Delete expired issued tokens (expired > 7 days ago)
      const deletedExpired = this.db
        .prepare(
          `DELETE FROM coupon_tokens 
           WHERE status = 'issued' AND expires_at < ?`
        )
        .run(expiredCutoff.toISOString());

      // Delete old used tokens (used > 90 days ago)
      const deletedUsed = this.db
        .prepare(
          `DELETE FROM coupon_tokens 
           WHERE status = 'used' AND used_at < ?`
        )
        .run(usedCutoff.toISOString());

      const totalDeleted = deletedExpired.changes + deletedUsed.changes;

      // Log cleanup event
      if (totalDeleted > 0) {
        this.eventLog.logEvent({
          event: 'issued',
          details: {
            action: 'cleanup_tokens',
            deletedExpired: deletedExpired.changes,
            deletedUsed: deletedUsed.changes,
            totalDeleted,
            expiredCutoff: expiredCutoff.toISOString(),
            usedCutoff: usedCutoff.toISOString(),
          },
        });
      }

      return totalDeleted;
    })();
  }

  /**
   * Expire pending redemptions older than 30 days
   * Updates status to 'rejected', refunds coupons to wallet
   * 
   * Requirements: 23.5
   * 
   * @returns Count of expired redemptions
   */
  expirePendingRedemptions(): number {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return this.db.transaction(() => {
      // Find pending redemptions older than 30 days
      const expiredRedemptions = this.db
        .prepare(
          `SELECT * FROM coupon_redemptions 
           WHERE status = 'pending' AND created_at < ?`
        )
        .all(cutoffDate.toISOString()) as any[];

      let expiredCount = 0;

      for (const redemption of expiredRedemptions) {
        // Update redemption status to rejected
        this.db
          .prepare(
            `UPDATE coupon_redemptions 
             SET status = 'rejected', 
                 rejected_at = ?, 
                 note = 'Auto-expired after 30 days' 
             WHERE id = ?`
          )
          .run(now.toISOString(), redemption.id);

        // Refund coupons to wallet
        this.db
          .prepare(
            `UPDATE coupon_wallets 
             SET coupon_count = coupon_count + ?, 
                 total_redeemed = total_redeemed - ?, 
                 updated_at = ? 
             WHERE phone = ?`
          )
          .run(
            redemption.coupons_used,
            redemption.coupons_used,
            now.toISOString(),
            redemption.phone
          );

        // Log event
        this.eventLog.logEvent({
          phone: redemption.phone,
          event: 'redemption_blocked',
          details: {
            redemptionId: redemption.id,
            action: 'auto_expired',
            reason: 'Auto-expired after 30 days',
            refundedCoupons: redemption.coupons_used,
            createdAt: redemption.created_at,
          },
        });

        expiredCount++;
      }

      // Log summary event
      if (expiredCount > 0) {
        this.eventLog.logEvent({
          event: 'issued',
          details: {
            action: 'expire_redemptions',
            expiredCount,
            cutoffDate: cutoffDate.toISOString(),
          },
        });
      }

      return expiredCount;
    })();
  }

  /**
   * Get or create a wallet for a phone number
   * Internal helper method
   * 
   * @param normalizedPhone - Phone number in E.164 format
   * @returns Wallet object
   */
  private getOrCreateWallet(normalizedPhone: string): CouponWallet {
    let row = this.db
      .prepare('SELECT * FROM coupon_wallets WHERE phone = ?')
      .get(normalizedPhone) as any;

    if (!row) {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO coupon_wallets (
            phone, coupon_count, total_earned, total_redeemed, 
            opted_in_marketing, updated_at
          ) VALUES (?, 0, 0, 0, 0, ?)`
        )
        .run(normalizedPhone, now);

      row = this.db
        .prepare('SELECT * FROM coupon_wallets WHERE phone = ?')
        .get(normalizedPhone) as any;
    }

    return this.parseWalletRow(row);
  }

  /**
   * Parse database row to CouponWallet object
   * Converts snake_case to camelCase
   */
  private parseWalletRow(row: any): CouponWallet {
    return {
      phone: row.phone,
      couponCount: row.coupon_count,
      totalEarned: row.total_earned,
      totalRedeemed: row.total_redeemed,
      optedInMarketing: row.opted_in_marketing === 1,
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
      updatedAt: new Date(row.updated_at),
    };
  }
}
