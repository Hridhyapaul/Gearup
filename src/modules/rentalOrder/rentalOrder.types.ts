export type RentalOrderItemInput = {
    gearItemId: string;
    quantity: number;
  };

  export type CreateRentalOrderInput = {
    startDate: string;
    endDate: string;
    items: RentalOrderItemInput[];
  };

  export type RentalOrderQuery = {
    status?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  };

  export type ProviderOrdersQuery = {
    status?: string;
    page?: string;
    limit?: string;
    sortOrder?: string;
  };
