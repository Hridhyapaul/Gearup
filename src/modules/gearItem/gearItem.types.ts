export type CreateGearItemInput = {
    name: string;
    slug: string;
    description?: string;
    pricePerDay: number;
    stock: number;
    availableStock: number;
    image?: string;
    categoryId: string;
  };

  export type UpdateGearItemInput = {
    name?: string;
    slug?: string;
    description?: string;
    pricePerDay?: number;
    stock?: number;
    availableStock?: number;
    image?: string;
    isAvailable?: boolean;
    categoryId?: string;
  };

  export type GearItemQuery = {
    searchTerm?: string;
    categoryId?: string;
    providerId?: string;
    minPrice?: string;
    maxPrice?: string;
    isAvailable?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };
