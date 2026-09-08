export type RegisterInput = {
    name: string;
    email: string;
    password: string;
    role: "CUSTOMER" | "PROVIDER";
  };

  export type LoginInput = {
    email: string;
    password: string;
  };

  export type JwtUserPayload = {
    userId: string;
    email: string;
    role: "CUSTOMER" | "PROVIDER" | "ADMIN";
  };
