/**
 * Authentication utilities for JWT token management and cookie handling
 */
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { config } from "../../config/environment";

/**
 * Generates a JWT token and sets it as an HTTP-only cookie
 * @param id - User ID to encode in the token
 * @param res - Express response object for setting cookies
 * @returns The generated JWT token
 */
export const generateToken = (id: number, res: Response): string => {
  const token = jwt.sign({ id }, config.jwt.secret, { expiresIn: "7d" });

  res.cookie(config.cookie, token, {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: config.env !== "development" ? "none" : "strict",
    secure: config.env !== "development",
    path: "/",
  });

  return token;
};

/**
 * Extracts JWT token from Authorization header or cookies
 * Supports both Bearer token and cookie-based authentication
 * @param req - Express request object
 * @returns JWT token string or null if not found
 */
export const extractToken = (req: Request): string | null => {
  if (req.headers.authorization?.startsWith("Bearer")) {
    const token = req.headers.authorization.split(" ")[1];
    return token || null;
  }

  if (req.cookies && req.cookies[config.cookie]) {
    return req.cookies[config.cookie];
  }

  return null;
};
