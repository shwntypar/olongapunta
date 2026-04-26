/**
 * Request validation middleware using Zod schemas
 * Supports validation of body, query, params, and file uploads
 */
import type { NextFunction, Request, Response } from "express";
import { ZodError, ZodObject } from "zod";
import { AppError } from "../utils/error";

/**
 * Creates a validation middleware for the given Zod schema
 * Handles multipart form data and file uploads automatically
 * @param schema - Zod schema object for validation
 * @returns Express middleware function
 */
export const validateRequest = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentType = req.headers["content-type"];
      const isMultipartFormData =
        contentType && contentType.includes("multipart/form-data");

      // Create validation object with request data
      const validationObject = {
        body: req.body,
        query: req.query,
        params: req.params,
      };

      //   // Handle file uploads for multipart form data
      //   if (isMultipartFormData) {
      //     if (req.file) {
      //       validationObject.body.file = req.file;
      //     }

      //     if (req.files) {
      //       if (Array.isArray(req.files)) {
      //         validationObject.body.files = req.files;
      //       } else {
      //         validationObject.body.files = req.files;
      //       }
      //     }
      //   }

      // Validate against schema
      await schema.parseAsync(validationObject);

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format validation errors for better readability
        const errorMessages = error.issues.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return next(
          new AppError(
            `Validation error: ${JSON.stringify(errorMessages)}`,
            400,
          ),
        );
      }
      return next(error);
    }
  };
};
