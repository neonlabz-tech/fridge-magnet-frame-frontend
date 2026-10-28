const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/v1';

export const apiV1Url = (path: string) => {
  const cleaned = path.replace(/^\//, '').replace(/^api\/v1\//, '');
  return `${BASE.replace(/\/$/, '')}/${cleaned}`;
};
