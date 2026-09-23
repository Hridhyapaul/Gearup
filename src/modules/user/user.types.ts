export type UserQuery = {
    searchTerm?: string;
    role?: string;
    isActive?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };

  export type UpdateUserInput = {
    name?: string;
    role?: "CUSTOMER" | "PROVIDER" | "ADMIN";
    isActive?: boolean;
  };
