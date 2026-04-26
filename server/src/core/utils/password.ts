/**
 * Password security utilities for hashing, comparison, generation, and strength validation
 */
import bcrypt from "bcryptjs";

/**
 * Hashes a password using bcrypt with salt rounds of 12
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password
 * @param password - Plain text password
 * @param hashedPassword - Previously hashed password
 * @returns Promise resolving to boolean indicating match
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
