export const REQUEST_CATEGORIES = [
  'Supplies',
  'Marketing',
  'Maintenance',
  'Travel',
  'Utilities',
  'Equipment',
  'Lunch and Dinner',
  'Subscriptions',
  'Training',
  'Professional Services',
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
