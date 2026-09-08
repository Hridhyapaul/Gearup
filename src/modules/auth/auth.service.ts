import bcrypt from "bcryptjs";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { LoginInput, RegisterInput } from "./auth.types";
import { SignOptions } from "jsonwebtoken";
import { jwtUtils } from "../../utils/jwt";

const register = async (payload: RegisterInput) => {
  const { name, email, password, role } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (isUserExist) {
    throw new Error("User already exists with this email");
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(config.bcrypt_salt_rounds),
  );

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
    },
  });

  const user = await prisma.user.findUnique({
    where: {
      id: newUser.id,
    },
    omit: {
      password: true,
    },
  });

  return user;
};

const login = async (payload: LoginInput) => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    throw new Error("Your account has been blocked. Please contact support.");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid email or password");
  }

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as SignOptions["expiresIn"],
  );

  const loggedInUser = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    omit: {
      password: true,
    },
  });

  return {
    accessToken,
    loggedInUser,
  };
};

const getMe = async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      omit: {
        password: true,
      },
    });

    if (!user) {
      throw new Error("User not found. Please log in again.");
    }

    return user;
  };

export const authService = {
  register,
  login,
  getMe,
};
