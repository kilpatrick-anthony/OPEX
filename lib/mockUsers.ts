export type UserRole = 'super_admin' | 'director' | 'field_team' | 'store_staff';

export type MockUser = {
  id: string;
  name: string;
  role: UserRole;
  store: string | null;       // set for store_staff
  employeeSlug: string | null; // set for field_team + super_admin
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  director:    'Director',
  field_team:  'Field Team',
  store_staff: 'Store',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  director:    'bg-sky-100 text-sky-700',
  field_team:  'bg-emerald-100 text-emerald-700',
  store_staff: 'bg-amber-100 text-amber-700',
};

export const MOCK_USERS: MockUser[] = [
  // Super admin
  { id: 'anthony-kilpatrick', name: 'Anthony Kilpatrick', role: 'super_admin', store: null, employeeSlug: 'anthony-kilpatrick' },
  // Directors
  { id: 'alvin-galligan',  name: 'Alvin Galligan',    role: 'director', store: null, employeeSlug: null },
  { id: 'nick-twomey',     name: 'Nick Twomey',       role: 'director', store: null, employeeSlug: null },
  { id: 'cian-odonoghue',  name: "Cian O'Donoghue",  role: 'director', store: null, employeeSlug: null },
  // Field team
  { id: 'emma-barrett',              name: 'Emma Barrett',                 role: 'field_team', store: null, employeeSlug: 'emma-barrett' },
  { id: 'douglas-abreu',             name: 'Douglas Abreu',                role: 'field_team', store: null, employeeSlug: 'douglas-abreu' },
  { id: 'layla-pinheiro',            name: 'Layla Pinheiro',               role: 'field_team', store: null, employeeSlug: 'layla-pinheiro' },
  { id: 'bernardo-vianna',           name: 'Bernardo Vianna',              role: 'field_team', store: null, employeeSlug: 'bernardo-vianna' },
  { id: 'andre-monteiro',            name: 'Andre Monteiro',               role: 'field_team', store: null, employeeSlug: 'andre-monteiro' },
  { id: 'marcio-santos',             name: 'Marcio Santos do Nascimento',  role: 'field_team', store: null, employeeSlug: 'marcio-santos-do-nascimento' },
  // Store staff
  { id: 'staff-anne-street',       name: 'Anne Street',       role: 'store_staff', store: 'Anne Street',       employeeSlug: null },
  { id: 'staff-arnotts',           name: 'Arnotts',           role: 'store_staff', store: 'Arnotts',           employeeSlug: null },
  { id: 'staff-blackrock',         name: 'Blackrock',         role: 'store_staff', store: 'Blackrock',         employeeSlug: null },
  { id: 'staff-blanchardstown',    name: 'Blanchardstown',    role: 'store_staff', store: 'Blanchardstown',    employeeSlug: null },
  { id: 'staff-cork',              name: 'Cork',              role: 'store_staff', store: 'Cork',              employeeSlug: null },
  { id: 'staff-dun-laoghaire',     name: 'Dun Laoghaire',    role: 'store_staff', store: 'Dun Laoghaire',     employeeSlug: null },
  { id: 'staff-dundalk',           name: 'Dundalk',           role: 'store_staff', store: 'Dundalk',           employeeSlug: null },
  { id: 'staff-hansfield',         name: 'Hansfield',         role: 'store_staff', store: 'Hansfield',         employeeSlug: null },
  { id: 'staff-ilac',              name: 'ILAC',              role: 'store_staff', store: 'ILAC',              employeeSlug: null },
  { id: 'staff-kildare-village',   name: 'Kildare Village',   role: 'store_staff', store: 'Kildare Village',   employeeSlug: null },
  { id: 'staff-maynooth',          name: 'Maynooth',          role: 'store_staff', store: 'Maynooth',          employeeSlug: null },
  { id: 'staff-nutgrove',          name: 'Nutgrove',          role: 'store_staff', store: 'Nutgrove',          employeeSlug: null },
  { id: 'staff-swords-pavilions',  name: 'Swords Pavilions',  role: 'store_staff', store: 'Swords Pavilions',  employeeSlug: null },
];

export function canAccess(role: UserRole, to: 'dashboard' | 'approval' | 'admin'): boolean {
  if (to === 'dashboard') return role !== 'store_staff';
  if (to === 'approval')  return role === 'super_admin' || role === 'director';
  if (to === 'admin')     return role === 'super_admin';
  return false;
}
