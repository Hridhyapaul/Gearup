import { NextFunction, Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";
import config from "../config";
import { prisma } from "../lib/prisma";
import { UserRole } from "../generated/prisma/enums";



declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: "CUSTOMER" | "PROVIDER" | "ADMIN";
      };
    }
  }
}

export const auth = (...requiredRoles: UserRole[]) => {
    return catchAsync(
      async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : req.headers.authorization;

        if (!token) {
          throw new Error(
            "You are not logged in. Please log in to access this resource.",
          );
        }

        const verifiedToken = jwtUtils.verifyToken(
          token,
          config.jwt_access_secret as string,
        );

        if (!verifiedToken.success) {
          throw new Error(verifiedToken.error);
        }

        const { userId, email, role } = verifiedToken.data as JwtPayload;

        const user = await prisma.user.findUnique({
          where: {
            id: userId,
          },
        });

        if (!user) {
          throw new Error("User not found. Please log in again.");
        }

        if (!user.isActive) {
          throw new Error(
            "Your account has been blocked. Please contact support.",
          );
        }

        if (requiredRoles.length && !requiredRoles.includes(user.role)) {
          throw new Error(
            "Forbidden. You don't have permission to access this resource.",
          );
        }

        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };

        next();
      },
    );
  };
