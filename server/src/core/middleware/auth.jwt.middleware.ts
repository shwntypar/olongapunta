/**
 * JWT authentication middleware
 * Validates JWT tokens and provides role-based access control
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config/environment";
import { prisma } from "../prisma";
import { extractToken } from "../utils/auth";
import { AppError } from "../utils/error";

interface TokenPayload {
  id: number;
  iat: number;
  exp: number;
}

/**
 * JWT authentication middleware class
 */
export class AuthJwtMiddleware {
  // Module-level API log service
  //   private static _apiLogRepository = new ApiLogRepository(prisma);
  //   private static apiLogService = new ApiLogService(
  //     AuthJwtMiddleware._apiLogRepository,
  //   );

  /**
   * Fetch user from DB, validate token, and populate req.user
   */
  private static async authenticateUser(
    decoded: TokenPayload,
    req: Request,
  ): Promise<void> {
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!currentUser) {
      throw new AppError(
        "The user belonging to this token no longer exists.",
        401,
      );
    }

    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role as "USER" | "ADMIN" | "SUPERADMIN",
    };
  }

  /**
   * Main JWT protection middleware
   */
  static protect = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Extract and verify JWT
      const token = extractToken(req);
      if (!token) {
        return next(
          new AppError(
            "You are not logged in. Please log in to get access.",
            401,
          ),
        );
      }

      const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
      await AuthJwtMiddleware.authenticateUser(decoded, req);

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      if (error instanceof jwt.TokenExpiredError) {
        return next(
          new AppError("Your token has expired! Please log in again.", 401),
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new AppError("Invalid token. Please log in again.", 401));
      }
      return next(new AppError("Authentication failed", 401));
    }
  };

  /**
   * Role-based access control middleware factory
   */
  static restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AppError("You are not logged in", 401));
      }

      if (!roles.includes(req.user.role)) {
        return next(
          new AppError(
            "You do not have permission to perform this action",
            403,
          ),
        );
      }

      next();
    };
  };

  /**
   * Ensure user has organization access
   */
  static requireOrganizationAccess = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      return next(new AppError("You are not logged in", 401));
    }

    // SUPERADMIN always has access
    if (req.user.role === "SUPERADMIN") {
      return next();
    }

    next();
  };
}

// Export static methods for convenient usage
export const protect = AuthJwtMiddleware.protect;
export const restrictTo = AuthJwtMiddleware.restrictTo;
export const requireOrganizationAccess =
  AuthJwtMiddleware.requireOrganizationAccess;
