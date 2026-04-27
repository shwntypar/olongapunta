import type { NextFunction, Request, Response } from "express";
import {
  AUTH_SOURCES,
  AUTH_TYPES,
  getApiKeyHeader,
  type AuthSource,
  type AuthType,
} from "../utils/auth.mw";
import { AppError } from "../utils/error";
import { protect as jwtProtect } from "./auth.jwt.middleware";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: "USER" | "ADMIN" | "SUPERADMIN";
      };
      auth?: {
        type: AuthType;
        credentialId: string | null;
        source: AuthSource;
        scopes: string[];
      };
      apiKey?: {
        id: string;
        key?: string;
        scopes: string[];
        clientIp?: string;
        userAgent?: string;
      };
    }
  }
}

class AuthMiddleware {
  private static runMiddleware(
    middleware: (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void | Promise<void>,
    req: Request,
    res: Response,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const next: NextFunction = (err?: any) => {
        if (err) return reject(err);
        resolve();
      };

      const result = middleware(req, res, next);

      // Handle promise-returning middleware
      if (result && typeof result.then === "function") {
        result.catch(reject);
      }
    });
  }

  /**
   * Set authentication context on request
   */
  private static setAuthContext(
    req: Request,
    type: AuthType,
    credentialId: string | number | null = null,
    scopes: string[] = [],
    source: AuthSource = AUTH_SOURCES.UNKNOWN,
  ): void {
    req.auth = {
      type,
      credentialId: credentialId != null ? String(credentialId) : null,
      source,
      scopes,
    };
  }

  /**
   * Only allow JWT authentication
   * - Rejects API key attempts with helpful error message
   * - Consumes rate limit quota for rejected API keys
   */
  static jwtOnly = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const apiKeyHeader = getApiKeyHeader(req);

    if (apiKeyHeader) {
      // Record minimal context for rate limiter
      AuthMiddleware.setAuthContext(
        req,
        AUTH_TYPES.API_KEY,
        apiKeyHeader,
        [],
        AUTH_SOURCES.HEADER,
      );

      return next(
        new AppError(
          `This endpoint requires JWT authentication. API keys are not supported here. ` +
            `Attempted: ${req.method} ${req.originalUrl}.`,
          401,
        ),
      );
    }

    try {
      await AuthMiddleware.runMiddleware(jwtProtect, req, res);
      AuthMiddleware.setAuthContext(
        req,
        AUTH_TYPES.JWT,
        req.user?.id ?? null,
        [],
        AUTH_SOURCES.COOKIE,
      );
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const jwtOnly = AuthMiddleware.jwtOnly;

export default AuthMiddleware;

// export interface AuthenticatedRequest extends Request {
//   user: {
//     id: number;
//     email: string;
//     [key: string]: any; // Allow additional properties if needed
//   };
// }
// export const authMiddleware = async (
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     let token = req.headers.authorization?.replace("Bearer ", "").trim();

//     if (!token) {
//       token =
//         req.signedCookies?.[config.cookie] ||
//         req.cookies?.[config.cookie] ||
//         req.signedCookies["OLONGAPUNTA_COOKIE"] ||
//         req.cookies["OLONGAPUNTA_COOKIE"];
//     }

//     if (!token) {
//       throw new Error("No authentication token provided");
//     }

//     const decoded = jwt.verify(token, config.jwt.secret) as {
//       id: string;
//       userId: string;
//       email: string;
//       sub?: string;
//       [key: string]: any;
//     };

//     const userId = decoded.userId || decoded.sub || decoded.id;

//     if (!userId) {
//       throw new Error("Invalid token: missing user ID");
//     }

//     req.user = {
//       id: Number(userId),
//       email: decoded.email,
//     };

//     next();
//   } catch (error) {
//     logger.error("Authentication error", { error });
//     res.status(401).json({ message: "Unauthorized" });
//   }
// };
