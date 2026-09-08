import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export const validateRequest = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw new Error(
        result.error.issues[0]?.message || "Validation failed",
      );
    }

    req.body = result.data;

    next();
  };
};
