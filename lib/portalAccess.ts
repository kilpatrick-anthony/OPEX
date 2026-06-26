export type PortalKey = 'opex' | 'oaker' | 'hr' | 'recruitment';

export const DEFAULT_PORTAL_ACCESS: PortalKey[] = ['opex', 'oaker'];

export const PORTAL_OPTIONS: Array<{ key: PortalKey; label: string; description: string }> = [
  { key: 'opex', label: 'OPEX', description: 'Expense requests, approvals, budgets, and reporting' },
  { key: 'oaker', label: 'OAKER Experience', description: 'Store standards checks, reports, and scorecards' },
  { key: 'hr', label: 'HR', description: 'People records, policies, and team support' },
  { key: 'recruitment', label: 'Recruitment Hub', description: 'Hiring and onboarding workflows' },
];

const VALID_PORTALS = new Set<PortalKey>(PORTAL_OPTIONS.map((option) => option.key));

export function normalizePortalAccess(value: unknown): PortalKey[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const normalized = raw
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is PortalKey => VALID_PORTALS.has(item as PortalKey));

  return Array.from(new Set(normalized));
}

export function serializePortalAccess(value: unknown): string {
  const normalized = normalizePortalAccess(value);
  return (normalized.length > 0 ? normalized : DEFAULT_PORTAL_ACCESS).join(',');
}

export function userCanAccessPortal(value: unknown, portal: PortalKey): boolean {
  return normalizePortalAccess(value).includes(portal);
}
