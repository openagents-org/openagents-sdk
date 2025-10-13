/**
 * Password hashing utility using bcryptjs
 *
 * This module provides password hashing functionality compatible with
 * the backend's bcrypt implementation (Python bcrypt library).
 */

import bcrypt from 'bcryptjs';

/**
 * Hash a password using bcrypt with 12 rounds (matching backend configuration)
 *
 * @param password - Plain text password to hash
 * @returns Promise that resolves to the bcrypt hash string
 *
 * @example
 * const hash = await hashPassword("AiBotKey2024!");
 * // Returns: "$2b$12$fN4XSArA6AmrXOZ6wtoKeO5vmUHuCUUzhFXEGulT2.GCi7VaPD2em"
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  // Use 12 rounds to match backend configuration
  const saltRounds = 12;
  const hash = await bcrypt.hash(password, saltRounds);

  return hash;
}

/**
 * Verify a password against a bcrypt hash
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to verify against
 * @returns Promise that resolves to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

/**
 * Known agent group passwords and their hashes
 * These are taken from examples/workspace_test.yaml
 */
export const AGENT_GROUP_PASSWORDS = {
  'ai-bots': {
    password: 'AiBotKey2024!',
    hash: '$2b$12$fN4XSArA6AmrXOZ6wtoKeO5vmUHuCUUzhFXEGulT2.GCi7VaPD2em'
  },
  'moderators': {
    password: 'ModSecure2024!',
    hash: '$2b$12$p7CBrw9kLCB8LC0snzyFOeIAXSzrEK6Zw.IBXp9GYVtb75k5F/o7O'
  },
  'researchers': {
    password: 'ResearchAccess2024!',
    hash: '$2b$12$U2x0T4obqhhTCVRvdnQxUu0deCEsOTC3kKf.BJr3kCqgN9hD3C1QK'
  },
  'users': {
    password: 'UserStandard2024!',
    hash: '$2b$12$Mkk6zsut18qVjGNIUkDPjuswDtUqjaW/arJumrVTEcVmpA3gJhh/i'
  }
} as const;
