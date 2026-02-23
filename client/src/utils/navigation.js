export const getDefaultRouteForRole = role => {
  if (role === 'Director') return '/dashboard/businesshead';
  if (role === 'Sales Manager') return '/dashboard/manager';
  if (role === 'Sales Executive') return '/dashboard/executive';
  if (role === 'Delivery Team') return '/dashboard/delivery';
  if (role === 'Finance') return '/finance/dashboard';
  return '/';
};
