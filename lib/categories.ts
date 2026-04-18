export const REQUEST_CATEGORIES = [
  'Supplies',
  'Marketing',
  'Maintenance',
  'Travel',
  'Utilities',
  'Equipment',
  'Lunch and Dinner',
  'Subscriptions',
  'Software Licenses',
  'Repairs',
  'Courier and Delivery',
  'Events',
  'Training',
  'Professional Services',
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
