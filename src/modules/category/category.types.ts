export type CreateCategoryInput = {
    name: string;
    slug: string;
    description?: string;
  };

  export type UpdateCategoryInput = {
    name?: string;
    slug?: string;
    description?: string;
  };

  export type CategoryQuery = {
    searchTerm?: string;
    name?: string;
    slug?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
