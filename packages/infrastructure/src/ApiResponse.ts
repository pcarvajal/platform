export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  data: T;
  pagination?: Pagination;
  meta?: Record<string, unknown>;
};

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return { data, ...(meta && { meta }) };
}
