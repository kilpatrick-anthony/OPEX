// ─── Shared types ────────────────────────────────────────────────────────────

export type Period = 'month' | 'last-month' | 'quarter';
export type EntityType = 'store' | 'employee';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'queried';

export type CategoryBreakdown = { category: string; total: number };
export type TrendPoint       = { month: string; total: number };
export type RequestItem      = {
  id: number;
  requesterName: string;
  requesterRole: string;
  category: string;
  amount: number;
  description: string;
  status: RequestStatus;
  createdAt: string;
};

export type EntityPeriodData = {
  totalSpent: number;
  budget: number;
  byCategory: CategoryBreakdown[];
  requests: RequestItem[];
};

export type EntityDetail = {
  name: string;
  slug: string;
  type: EntityType;
  role?: string;
  monthlyBudget: number;
  trend: TrendPoint[];
  month: EntityPeriodData;
  'last-month': EntityPeriodData;
  quarter: EntityPeriodData;
};

export type CategorySpendByEntity = { name: string; type: EntityType; total: number };

export type CategoryDetail = {
  name: string;
  slug: string;
  trend: TrendPoint[];
  month: { total: number; budget: number; byEntity: CategorySpendByEntity[]; requests: RequestItem[] };
  'last-month': { total: number; budget: number; byEntity: CategorySpendByEntity[]; requests: RequestItem[] };
  quarter: { total: number; budget: number; byEntity: CategorySpendByEntity[]; requests: RequestItem[] };
};

// ─── Entity lists (used on main dashboard) ───────────────────────────────────

export const ALL_STORES: { name: string; slug: string }[] = [
  { name: 'Anne Street',       slug: 'anne-street' },
  { name: 'Arnotts',           slug: 'arnotts' },
  { name: 'Blackrock',         slug: 'blackrock' },
  { name: 'Blanchardstown',    slug: 'blanchardstown' },
  { name: 'Cork',              slug: 'cork' },
  { name: 'Dun Laoghaire',    slug: 'dun-laoghaire' },
  { name: 'Dundalk',           slug: 'dundalk' },
  { name: 'Hansfield',         slug: 'hansfield' },
  { name: 'ILAC',              slug: 'ilac' },
  { name: 'Kildare Village',   slug: 'kildare-village' },
  { name: 'Maynooth',          slug: 'maynooth' },
  { name: 'Swords Pavilions',  slug: 'swords-pavilions' },
];

export const ALL_EMPLOYEES: { name: string; slug: string; role: string }[] = [
  { name: 'Emma Barrett',                 slug: 'emma-barrett',                 role: 'Marketing' },
  { name: 'Douglas Abreu',                slug: 'douglas-abreu',                role: 'Data' },
  { name: 'Layla Pinheiro',               slug: 'layla-pinheiro',               role: 'Training & Development' },
  { name: 'Bernardo Vianna',              slug: 'bernardo-vianna',              role: 'Area Lead' },
  { name: 'Andre Monteiro',               slug: 'andre-monteiro',               role: 'Head of Logistics' },
  { name: 'Marcio Santos do Nascimento',  slug: 'marcio-santos-do-nascimento',  role: 'Junior Warehouse Manager' },
  { name: 'Anthony Kilpatrick',           slug: 'anthony-kilpatrick',           role: 'Head of Compliance' },
];

export const ALL_CATEGORIES = [
  'Equipment', 'Maintenance', 'Marketing', 'Supplies', 'Travel', 'Utilities',
];

export function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function split(total: number, weights: [string, number][]): CategoryBreakdown[] {
  const sum = weights.reduce((a, [, w]) => a + w, 0);
  return weights.map(([category, w]) => ({
    category,
    total: Math.round((w / sum) * total),
  }));
}

// ─── Store detail data ────────────────────────────────────────────────────────

export const STORE_DETAILS: Record<string, EntityDetail> = {
  'anne-street': {
    name: 'Anne Street', slug: 'anne-street', type: 'store', monthlyBudget: 12000,
    trend: [
      { month: 'Nov', total: 9200 }, { month: 'Dec', total: 10800 },
      { month: 'Jan', total: 8600 }, { month: 'Feb', total: 9400 },
      { month: 'Mar', total: 11200 }, { month: 'Apr', total: 9800 },
    ],
    month: {
      totalSpent: 9800, budget: 12000,
      byCategory: split(9800, [['Supplies', 32], ['Marketing', 24], ['Maintenance', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 1001, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Marketing', amount: 2350, description: 'Summer menu launch social media shoot — external photographer.', status: 'approved', createdAt: '2026-04-01' },
        { id: 1002, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Supplies', amount: 1850, description: 'Bulk order of cups, lids, straws and branded carry bags.', status: 'approved', createdAt: '2026-04-03' },
        { id: 1003, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1600, description: 'Refrigeration unit service and deep-clean contract.', status: 'approved', createdAt: '2026-04-05' },
        { id: 1004, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Travel', amount: 780, description: 'Team travel to Dublin HQ for Q2 training day.', status: 'approved', createdAt: '2026-04-08' },
        { id: 1005, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Utilities', amount: 620, description: 'Additional chilling display unit electricity allocation.', status: 'approved', createdAt: '2026-04-09' },
        { id: 1006, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Supplies', amount: 850, description: 'Restocking paper cups, lids and sleeve stock for peak summer.', status: 'pending', createdAt: '2026-04-11' },
        { id: 1007, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Marketing', amount: 1950, description: 'Window vinyl rebranding — Summer 2026 artwork.', status: 'queried', createdAt: '2026-04-13' },
      ],
    },
    'last-month': {
      totalSpent: 11200, budget: 12000,
      byCategory: split(11200, [['Supplies', 30], ['Marketing', 28], ['Maintenance', 22], ['Travel', 12], ['Utilities', 8]]),
      requests: [
        { id: 2001, requesterName: 'Fionnuala O\'Connell', requesterRole: 'Store Manager', category: 'Marketing', amount: 3200, description: 'Q1 end promotional campaign — in-store and digital.', status: 'approved', createdAt: '2026-03-05' },
        { id: 2002, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Supplies', amount: 2800, description: 'Full Q1 packaging restock — cups, bags, stickers.', status: 'approved', createdAt: '2026-03-08' },
        { id: 2003, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Maintenance', amount: 2100, description: 'Annual blender and equipment full service.', status: 'approved', createdAt: '2026-03-12' },
        { id: 2004, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Travel', amount: 1450, description: 'Staff transport for area manager visit.', status: 'approved', createdAt: '2026-03-15' },
        { id: 2005, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Utilities', amount: 920, description: 'Additional outdoor seating heating unit rental.', status: 'approved', createdAt: '2026-03-20' },
        { id: 2006, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Marketing', amount: 730, description: 'Staff uniform restock for 2 new team members.', status: 'rejected', createdAt: '2026-03-25' },
      ],
    },
    quarter: {
      totalSpent: 31200, budget: 36000,
      byCategory: split(31200, [['Supplies', 31], ['Marketing', 25], ['Maintenance', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 3001, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Marketing', amount: 9200, description: 'Q1/Q2 full promotional and campaign expenditure.', status: 'approved', createdAt: '2026-02-10' },
        { id: 3002, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Supplies', amount: 8600, description: 'Quarter bulk packaging and consumables order.', status: 'approved', createdAt: '2026-02-12' },
        { id: 3003, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Maintenance', amount: 7200, description: 'Full equipment service contract Q1.', status: 'approved', createdAt: '2026-02-14' },
        { id: 3004, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Travel', amount: 3800, description: 'Team travel and training events Q1+Q2.', status: 'approved', createdAt: '2026-02-18' },
        { id: 3005, requesterName: 'Conor Walsh', requesterRole: 'Store Manager', category: 'Utilities', amount: 2400, description: 'Utilities overage allocation Q1.', status: 'approved', createdAt: '2026-02-20' },
      ],
    },
  },

  'arnotts': {
    name: 'Arnotts', slug: 'arnotts', type: 'store', monthlyBudget: 10000,
    trend: [
      { month: 'Nov', total: 6100 }, { month: 'Dec', total: 7800 },
      { month: 'Jan', total: 5900 }, { month: 'Feb', total: 6600 },
      { month: 'Mar', total: 7400 }, { month: 'Apr', total: 6400 },
    ],
    month: {
      totalSpent: 6400, budget: 10000,
      byCategory: split(6400, [['Supplies', 33], ['Marketing', 22], ['Maintenance', 21], ['Travel', 14], ['Utilities', 10]]),
      requests: [
        { id: 4001, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Supplies', amount: 1850, description: 'Packaging and consumables restock.', status: 'approved', createdAt: '2026-04-02' },
        { id: 4002, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1650, description: 'Floor grout clean and reseal per landlord requirement.', status: 'approved', createdAt: '2026-04-04' },
        { id: 4003, requesterName: 'Séan Doyle', requesterRole: 'Deputy Manager', category: 'Marketing', amount: 1400, description: 'Spring campaign in-store POS materials.', status: 'approved', createdAt: '2026-04-06' },
        { id: 4004, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Travel', amount: 900, description: 'Quarterly area manager training event.', status: 'approved', createdAt: '2026-04-08' },
        { id: 4005, requesterName: 'Séan Doyle', requesterRole: 'Deputy Manager', category: 'Equipment', amount: 1800, description: 'Replacement point-of-sale tablet — cracked screen.', status: 'pending', createdAt: '2026-04-12' },
      ],
    },
    'last-month': {
      totalSpent: 7400, budget: 10000,
      byCategory: split(7400, [['Supplies', 30], ['Marketing', 25], ['Maintenance', 22], ['Travel', 13], ['Utilities', 10]]),
      requests: [
        { id: 5001, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Supplies', amount: 2200, description: 'Q1 bulk supplies restock.', status: 'approved', createdAt: '2026-03-03' },
        { id: 5002, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Marketing', amount: 1850, description: 'Q1 wraparound seasonal campaign.', status: 'approved', createdAt: '2026-03-07' },
        { id: 5003, requesterName: 'Séan Doyle', requesterRole: 'Deputy Manager', category: 'Maintenance', amount: 1600, description: 'Ice machine and blender annual service.', status: 'approved', createdAt: '2026-03-15' },
        { id: 5004, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Travel', amount: 950, description: 'Staff to area training event.', status: 'approved', createdAt: '2026-03-18' },
        { id: 5005, requesterName: 'Ciarán Ryan', requesterRole: 'Store Manager', category: 'Utilities', amount: 800, description: 'Supplemental power for extra fridge units.', status: 'approved', createdAt: '2026-03-22' },
      ],
    },
    quarter: {
      totalSpent: 19800, budget: 30000,
      byCategory: split(19800, [['Supplies', 32], ['Marketing', 23], ['Maintenance', 21], ['Travel', 14], ['Utilities', 10]]),
      requests: [],
    },
  },

  'blackrock': {
    name: 'Blackrock', slug: 'blackrock', type: 'store', monthlyBudget: 8500,
    trend: [
      { month: 'Nov', total: 3800 }, { month: 'Dec', total: 5200 },
      { month: 'Jan', total: 3600 }, { month: 'Feb', total: 4000 },
      { month: 'Mar', total: 5100 }, { month: 'Apr', total: 4200 },
    ],
    month: {
      totalSpent: 4200, budget: 8500,
      byCategory: split(4200, [['Supplies', 34], ['Maintenance', 24], ['Marketing', 20], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 6001, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Maintenance', amount: 490, description: 'Ice machine descale and service.', status: 'approved', createdAt: '2026-04-07' },
        { id: 6002, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Supplies', amount: 1420, description: 'Monthly consumables bulk order.', status: 'approved', createdAt: '2026-04-04' },
        { id: 6003, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Marketing', amount: 840, description: 'Local area social media campaign.', status: 'approved', createdAt: '2026-04-09' },
        { id: 6004, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Travel', amount: 540, description: 'Staff travel for compliance audit.', status: 'approved', createdAt: '2026-04-10' },
        { id: 6005, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Utilities', amount: 380, description: 'Extra utility usage — extended summer hours.', status: 'pending', createdAt: '2026-04-13' },
      ],
    },
    'last-month': {
      totalSpent: 5100, budget: 8500,
      byCategory: split(5100, [['Supplies', 33], ['Maintenance', 25], ['Marketing', 21], ['Travel', 12], ['Utilities', 9]]),
      requests: [
        { id: 7001, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Supplies', amount: 1680, description: 'March bulk supplies.', status: 'approved', createdAt: '2026-03-04' },
        { id: 7002, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1275, description: 'Full equipment service.', status: 'approved', createdAt: '2026-03-10' },
        { id: 7003, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Marketing', amount: 1070, description: 'Spring menu launch leaflet drop.', status: 'approved', createdAt: '2026-03-15' },
        { id: 7004, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Travel', amount: 612, description: 'Staff to training workshop.', status: 'approved', createdAt: '2026-03-20' },
        { id: 7005, requesterName: 'Roisín Kelly', requesterRole: 'Store Manager', category: 'Utilities', amount: 460, description: 'Utility overage.', status: 'approved', createdAt: '2026-03-25' },
      ],
    },
    quarter: {
      totalSpent: 14200, budget: 25500,
      byCategory: split(14200, [['Supplies', 33], ['Maintenance', 24], ['Marketing', 21], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
  },

  'blanchardstown': {
    name: 'Blanchardstown', slug: 'blanchardstown', type: 'store', monthlyBudget: 11000,
    trend: [
      { month: 'Nov', total: 7000 }, { month: 'Dec', total: 8400 },
      { month: 'Jan', total: 6800 }, { month: 'Feb', total: 7200 },
      { month: 'Mar', total: 8900 }, { month: 'Apr', total: 7600 },
    ],
    month: {
      totalSpent: 7600, budget: 11000,
      byCategory: split(7600, [['Supplies', 32], ['Marketing', 23], ['Maintenance', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [
        { id: 8001, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Supplies', amount: 2430, description: 'Bulk order — cups, lids, straws & branded bags.', status: 'approved', createdAt: '2026-04-03' },
        { id: 8002, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Marketing', amount: 1750, description: 'Local social media photoshoot for summer menu launch.', status: 'pending', createdAt: '2026-04-12' },
        { id: 8003, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1670, description: 'Annual equipment service and calibration.', status: 'approved', createdAt: '2026-04-05' },
        { id: 8004, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Travel', amount: 1065, description: 'Staff transport for area manager event.', status: 'approved', createdAt: '2026-04-08' },
        { id: 8005, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Utilities', amount: 685, description: 'Additional HVAC run-hours peak summer.', status: 'approved', createdAt: '2026-04-10' },
      ],
    },
    'last-month': {
      totalSpent: 8900, budget: 11000,
      byCategory: split(8900, [['Supplies', 30], ['Marketing', 25], ['Maintenance', 23], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 9001, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Supplies', amount: 2670, description: 'March full packaging restock.', status: 'approved', createdAt: '2026-03-03' },
        { id: 9002, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Marketing', amount: 2225, description: 'Spring campaign full execution.', status: 'approved', createdAt: '2026-03-07' },
        { id: 9003, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Maintenance', amount: 2047, description: 'Blender and refrigeration service.', status: 'approved', createdAt: '2026-03-12' },
        { id: 9004, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Travel', amount: 1157, description: 'Q1 close travel expenses.', status: 'approved', createdAt: '2026-03-20' },
        { id: 9005, requesterName: 'Aoife O\'Brien', requesterRole: 'Store Manager', category: 'Utilities', amount: 801, description: 'March utility overage.', status: 'approved', createdAt: '2026-03-26' },
      ],
    },
    quarter: {
      totalSpent: 22600, budget: 33000,
      byCategory: split(22600, [['Supplies', 31], ['Marketing', 24], ['Maintenance', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [],
    },
  },

  'cork': {
    name: 'Cork', slug: 'cork', type: 'store', monthlyBudget: 11000,
    trend: [
      { month: 'Nov', total: 6800 }, { month: 'Dec', total: 9500 },
      { month: 'Jan', total: 7100 }, { month: 'Feb', total: 7800 },
      { month: 'Mar', total: 8100 }, { month: 'Apr', total: 7200 },
    ],
    month: {
      totalSpent: 7200, budget: 11000,
      byCategory: split(7200, [['Supplies', 31], ['Maintenance', 24], ['Marketing', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [
        { id: 10001, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1728, description: 'Full refrigeration unit service contract Q1.', status: 'approved', createdAt: '2026-04-02' },
        { id: 10002, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Supplies', amount: 2232, description: 'Monthly packaging order.', status: 'approved', createdAt: '2026-04-04' },
        { id: 10003, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Marketing', amount: 1584, description: 'Summer promotional signage and digital assets.', status: 'approved', createdAt: '2026-04-07' },
        { id: 10004, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Travel', amount: 1008, description: 'TravelTeam to area manager training in Dublin.', status: 'approved', createdAt: '2026-04-09' },
        { id: 10005, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Maintenance', amount: 620, description: 'Blender repair — out of warranty.', status: 'pending', createdAt: '2026-04-10' },
        { id: 10006, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Utilities', amount: 648, description: 'Summer HVAC extra units.', status: 'approved', createdAt: '2026-04-11' },
      ],
    },
    'last-month': {
      totalSpent: 8100, budget: 11000,
      byCategory: split(8100, [['Supplies', 30], ['Maintenance', 24], ['Marketing', 23], ['Travel', 14], ['Utilities', 9]]),
      requests: [
        { id: 11001, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Supplies', amount: 2430, description: 'March packaging bulk order.', status: 'approved', createdAt: '2026-03-04' },
        { id: 11002, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1944, description: 'Full equipment service.', status: 'approved', createdAt: '2026-03-09' },
        { id: 11003, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Marketing', amount: 1863, description: 'Spring campaign materials.', status: 'approved', createdAt: '2026-03-14' },
        { id: 11004, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Travel', amount: 1134, description: 'Area event travel.', status: 'approved', createdAt: '2026-03-20' },
        { id: 11005, requesterName: 'Siobhán Murphy', requesterRole: 'Store Manager', category: 'Utilities', amount: 729, description: 'Utility overage.', status: 'approved', createdAt: '2026-03-27' },
      ],
    },
    quarter: {
      totalSpent: 24800, budget: 33000,
      byCategory: split(24800, [['Supplies', 31], ['Maintenance', 24], ['Marketing', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [],
    },
  },

  'dun-laoghaire': {
    name: 'Dun Laoghaire', slug: 'dun-laoghaire', type: 'store', monthlyBudget: 8500,
    trend: [
      { month: 'Nov', total: 3400 }, { month: 'Dec', total: 4800 },
      { month: 'Jan', total: 3200 }, { month: 'Feb', total: 3600 },
      { month: 'Mar', total: 4600 }, { month: 'Apr', total: 3800 },
    ],
    month: {
      totalSpent: 3800, budget: 8500,
      byCategory: split(3800, [['Supplies', 33], ['Maintenance', 23], ['Marketing', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 12001, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Supplies', amount: 1254, description: 'Monthly consumables order.', status: 'approved', createdAt: '2026-04-03' },
        { id: 12002, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Marketing', amount: 720, description: 'Window vinyl rebranding — Summer 2026 artwork.', status: 'queried', createdAt: '2026-04-09' },
        { id: 12003, requesterName: 'Eoin O\'Shea', requesterRole: 'Store Manager', category: 'Maintenance', amount: 874, description: 'HVAC filter replacement & annual service.', status: 'approved', createdAt: '2026-04-05' },
        { id: 12004, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Travel', amount: 494, description: 'Staff travel for training event.', status: 'approved', createdAt: '2026-04-10' },
        { id: 12005, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Utilities', amount: 342, description: 'Supplemental utility usage.', status: 'approved', createdAt: '2026-04-12' },
      ],
    },
    'last-month': {
      totalSpent: 4600, budget: 8500,
      byCategory: split(4600, [['Supplies', 32], ['Maintenance', 24], ['Marketing', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
    quarter: {
      totalSpent: 12800, budget: 25500,
      byCategory: split(12800, [['Supplies', 33], ['Maintenance', 23], ['Marketing', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
  },

  'dundalk': {
    name: 'Dundalk', slug: 'dundalk', type: 'store', monthlyBudget: 7500,
    trend: [
      { month: 'Nov', total: 2200 }, { month: 'Dec', total: 3400 },
      { month: 'Jan', total: 2100 }, { month: 'Feb', total: 2400 },
      { month: 'Mar', total: 2900 }, { month: 'Apr', total: 2600 },
    ],
    month: {
      totalSpent: 2600, budget: 7500,
      byCategory: split(2600, [['Supplies', 35], ['Maintenance', 23], ['Marketing', 20], ['Travel', 14], ['Utilities', 8]]),
      requests: [
        { id: 13001, requesterName: 'Cormac Burke', requesterRole: 'Store Manager', category: 'Supplies', amount: 910, description: 'Monthly paper goods restock.', status: 'approved', createdAt: '2026-04-03' },
        { id: 13002, requesterName: 'Cormac Burke', requesterRole: 'Store Manager', category: 'Maintenance', amount: 598, description: 'HVAC filter and service.', status: 'approved', createdAt: '2026-04-05' },
        { id: 13003, requesterName: 'Cormac Burke', requesterRole: 'Store Manager', category: 'Travel', amount: 364, description: 'Staff travel for area training.', status: 'approved', createdAt: '2026-04-08' },
        { id: 13004, requesterName: 'Cormac Burke', requesterRole: 'Store Manager', category: 'Travel', amount: 960, description: 'Hotel and transport — quarterly area manager visit and training day.', status: 'pending', createdAt: '2026-04-09' },
      ],
    },
    'last-month': {
      totalSpent: 2900, budget: 7500,
      byCategory: split(2900, [['Supplies', 35], ['Maintenance', 23], ['Marketing', 20], ['Travel', 14], ['Utilities', 8]]),
      requests: [],
    },
    quarter: {
      totalSpent: 8100, budget: 22500,
      byCategory: split(8100, [['Supplies', 35], ['Maintenance', 23], ['Marketing', 20], ['Travel', 14], ['Utilities', 8]]),
      requests: [],
    },
  },

  'hansfield': {
    name: 'Hansfield', slug: 'hansfield', type: 'store', monthlyBudget: 6500,
    trend: [
      { month: 'Nov', total: 1600 }, { month: 'Dec', total: 2800 },
      { month: 'Jan', total: 1500 }, { month: 'Feb', total: 1800 },
      { month: 'Mar', total: 2400 }, { month: 'Apr', total: 2000 },
    ],
    month: {
      totalSpent: 2000, budget: 6500,
      byCategory: split(2000, [['Supplies', 36], ['Maintenance', 24], ['Marketing', 19], ['Utilities', 13], ['Travel', 8]]),
      requests: [
        { id: 14001, requesterName: 'Brian Mullan', requesterRole: 'Store Manager', category: 'Supplies', amount: 720, description: 'Monthly supplies.', status: 'approved', createdAt: '2026-04-04' },
        { id: 14002, requesterName: 'Brian Mullan', requesterRole: 'Store Manager', category: 'Utilities', amount: 430, description: 'External lighting repair — 2 units faulty per safety report.', status: 'pending', createdAt: '2026-04-13' },
        { id: 14003, requesterName: 'Brian Mullan', requesterRole: 'Store Manager', category: 'Maintenance', amount: 480, description: 'Ice machine service.', status: 'approved', createdAt: '2026-04-07' },
      ],
    },
    'last-month': {
      totalSpent: 2400, budget: 6500,
      byCategory: split(2400, [['Supplies', 36], ['Maintenance', 24], ['Marketing', 19], ['Utilities', 13], ['Travel', 8]]),
      requests: [],
    },
    quarter: {
      totalSpent: 6400, budget: 19500,
      byCategory: split(6400, [['Supplies', 36], ['Maintenance', 24], ['Marketing', 19], ['Utilities', 13], ['Travel', 8]]),
      requests: [],
    },
  },

  'ilac': {
    name: 'ILAC', slug: 'ilac', type: 'store', monthlyBudget: 9000,
    trend: [
      { month: 'Nov', total: 4400 }, { month: 'Dec', total: 6200 },
      { month: 'Jan', total: 4200 }, { month: 'Feb', total: 4600 },
      { month: 'Mar', total: 5800 }, { month: 'Apr', total: 4900 },
    ],
    month: {
      totalSpent: 4900, budget: 9000,
      byCategory: split(4900, [['Supplies', 33], ['Marketing', 22], ['Maintenance', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [
        { id: 15001, requesterName: 'Pádraig Daly', requesterRole: 'Store Manager', category: 'Supplies', amount: 1617, description: 'Monthly packaging/consumables restock.', status: 'approved', createdAt: '2026-04-03' },
        { id: 15002, requesterName: 'Pádraig Daly', requesterRole: 'Store Manager', category: 'Marketing', amount: 1078, description: 'April campaign in-store POS materials.', status: 'approved', createdAt: '2026-04-05' },
        { id: 15003, requesterName: 'Pádraig Daly', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1078, description: 'Ice machine and appliance service.', status: 'approved', createdAt: '2026-04-07' },
        { id: 15004, requesterName: 'Pádraig Daly', requesterRole: 'Store Manager', category: 'Supplies', amount: 275, description: 'Emergency re-order of branded take-away bags.', status: 'pending', createdAt: '2026-04-13' },
        { id: 15005, requesterName: 'Pádraig Daly', requesterRole: 'Store Manager', category: 'Supplies', amount: 380, description: 'Coffee stir sticks & napkin restock.', status: 'rejected', createdAt: '2026-04-08' },
      ],
    },
    'last-month': {
      totalSpent: 5800, budget: 9000,
      byCategory: split(5800, [['Supplies', 32], ['Marketing', 23], ['Maintenance', 21], ['Travel', 15], ['Utilities', 9]]),
      requests: [],
    },
    quarter: {
      totalSpent: 15600, budget: 27000,
      byCategory: split(15600, [['Supplies', 33], ['Marketing', 22], ['Maintenance', 22], ['Travel', 14], ['Utilities', 9]]),
      requests: [],
    },
  },

  'kildare-village': {
    name: 'Kildare Village', slug: 'kildare-village', type: 'store', monthlyBudget: 9500,
    trend: [
      { month: 'Nov', total: 3100 }, { month: 'Dec', total: 4500 },
      { month: 'Jan', total: 3000 }, { month: 'Feb', total: 3400 },
      { month: 'Mar', total: 4200 }, { month: 'Apr', total: 3500 },
    ],
    month: {
      totalSpent: 3500, budget: 9500,
      byCategory: split(3500, [['Supplies', 32], ['Marketing', 22], ['Maintenance', 22], ['Travel', 14], ['Utilities', 10]]),
      requests: [
        { id: 16001, requesterName: 'Fionnuala O\'Connell', requesterRole: 'Deputy Manager', category: 'Equipment', amount: 1800, description: 'Replacement POS tablet.', status: 'queried', createdAt: '2026-04-12' },
        { id: 16002, requesterName: 'Fionnuala O\'Connell', requesterRole: 'Deputy Manager', category: 'Supplies', amount: 1120, description: 'Monthly supplies.', status: 'approved', createdAt: '2026-04-04' },
        { id: 16003, requesterName: 'Fionnuala O\'Connell', requesterRole: 'Deputy Manager', category: 'Maintenance', amount: 770, description: 'Monthly maintenance.', status: 'approved', createdAt: '2026-04-06' },
      ],
    },
    'last-month': {
      totalSpent: 4200, budget: 9500,
      byCategory: split(4200, [['Supplies', 32], ['Marketing', 22], ['Maintenance', 22], ['Travel', 14], ['Utilities', 10]]),
      requests: [],
    },
    quarter: {
      totalSpent: 11400, budget: 28500,
      byCategory: split(11400, [['Supplies', 32], ['Marketing', 22], ['Maintenance', 22], ['Travel', 14], ['Utilities', 10]]),
      requests: [],
    },
  },

  'maynooth': {
    name: 'Maynooth', slug: 'maynooth', type: 'store', monthlyBudget: 7000,
    trend: [
      { month: 'Nov', total: 2700 }, { month: 'Dec', total: 3900 },
      { month: 'Jan', total: 2600 }, { month: 'Feb', total: 2900 },
      { month: 'Mar', total: 3700 }, { month: 'Apr', total: 3100 },
    ],
    month: {
      totalSpent: 3100, budget: 7000,
      byCategory: split(3100, [['Supplies', 34], ['Maintenance', 23], ['Marketing', 21], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 17001, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Supplies', amount: 520, description: 'Uniform restock for 3 new team members starting May.', status: 'pending', createdAt: '2026-04-13' },
        { id: 17002, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Supplies', amount: 1054, description: 'Monthly packaging order.', status: 'approved', createdAt: '2026-04-04' },
        { id: 17003, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Maintenance', amount: 713, description: 'Blender service.', status: 'approved', createdAt: '2026-04-06' },
        { id: 17004, requesterName: 'Ciara Finn', requesterRole: 'Store Manager', category: 'Marketing', amount: 651, description: 'Summer signage update.', status: 'approved', createdAt: '2026-04-09' },
      ],
    },
    'last-month': {
      totalSpent: 3700, budget: 7000,
      byCategory: split(3700, [['Supplies', 34], ['Maintenance', 23], ['Marketing', 21], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
    quarter: {
      totalSpent: 10100, budget: 21000,
      byCategory: split(10100, [['Supplies', 34], ['Maintenance', 23], ['Marketing', 21], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
  },

  'swords-pavilions': {
    name: 'Swords Pavilions', slug: 'swords-pavilions', type: 'store', monthlyBudget: 9000,
    trend: [
      { month: 'Nov', total: 4800 }, { month: 'Dec', total: 6400 },
      { month: 'Jan', total: 4600 }, { month: 'Feb', total: 5100 },
      { month: 'Mar', total: 6200 }, { month: 'Apr', total: 5500 },
    ],
    month: {
      totalSpent: 5500, budget: 9000,
      byCategory: split(5500, [['Supplies', 34], ['Marketing', 22], ['Maintenance', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [
        { id: 19001, requesterName: 'Niamh Brennan', requesterRole: 'Store Manager', category: 'Supplies', amount: 1870, description: 'Field ops toolkit restock.', status: 'approved', createdAt: '2026-04-06' },
        { id: 19002, requesterName: 'Niamh Brennan', requesterRole: 'Store Manager', category: 'Marketing', amount: 1210, description: 'Summer campaign POS materials.', status: 'approved', createdAt: '2026-04-07' },
        { id: 19003, requesterName: 'Niamh Brennan', requesterRole: 'Store Manager', category: 'Maintenance', amount: 1210, description: 'Equipment service.', status: 'approved', createdAt: '2026-04-05' },
        { id: 19004, requesterName: 'Niamh Brennan', requesterRole: 'Store Manager', category: 'Travel', amount: 340, description: 'Return travel for quarterly store audit visits.', status: 'pending', createdAt: '2026-04-12' },
        { id: 19005, requesterName: 'Niamh Brennan', requesterRole: 'Store Manager', category: 'Utilities', amount: 495, description: 'Supplemental utility allocation.', status: 'approved', createdAt: '2026-04-09' },
      ],
    },
    'last-month': {
      totalSpent: 6200, budget: 9000,
      byCategory: split(6200, [['Supplies', 33], ['Marketing', 23], ['Maintenance', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
    quarter: {
      totalSpent: 17400, budget: 27000,
      byCategory: split(17400, [['Supplies', 34], ['Marketing', 22], ['Maintenance', 22], ['Travel', 13], ['Utilities', 9]]),
      requests: [],
    },
  },
};

// ─── Field employee detail data ───────────────────────────────────────────────

export const EMPLOYEE_DETAILS: Record<string, EntityDetail> = {
  'emma-barrett': {
    name: 'Emma Barrett', slug: 'emma-barrett', type: 'employee', role: 'Marketing', monthlyBudget: 4500,
    trend: [
      { month: 'Nov', total: 2800 }, { month: 'Dec', total: 3600 },
      { month: 'Jan', total: 2400 }, { month: 'Feb', total: 2900 },
      { month: 'Mar', total: 3800 }, { month: 'Apr', total: 3200 },
    ],
    month: {
      totalSpent: 3200, budget: 4500,
      byCategory: split(3200, [['Marketing', 62], ['Travel', 22], ['Supplies', 16]]),
      requests: [
        { id: 20001, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Marketing', amount: 1980, description: 'National campaign assets — photography, copywriting & digital ads for Summer 2026.', status: 'approved', createdAt: '2026-04-02' },
        { id: 20002, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Travel', amount: 704, description: 'Travel to Cork & Galway stores for campaign kick-off sessions.', status: 'approved', createdAt: '2026-04-05' },
        { id: 20003, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Supplies', amount: 516, description: 'Branded merchandise and print collateral for store rollout.', status: 'approved', createdAt: '2026-04-08' },
        { id: 20004, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Marketing', amount: 1200, description: 'Influencer partnership — 2 x Instagram campaigns for new product launch.', status: 'pending', createdAt: '2026-04-11' },
      ],
    },
    'last-month': {
      totalSpent: 3800, budget: 4500,
      byCategory: split(3800, [['Marketing', 64], ['Travel', 20], ['Supplies', 16]]),
      requests: [
        { id: 21001, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Marketing', amount: 2432, description: 'Spring campaign full execution — digital and in-store.', status: 'approved', createdAt: '2026-03-04' },
        { id: 21002, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Travel', amount: 760, description: 'Travel for store campaign briefings nationwide.', status: 'approved', createdAt: '2026-03-10' },
        { id: 21003, requesterName: 'Emma Barrett', requesterRole: 'Marketing', category: 'Supplies', amount: 608, description: 'POS promotional materials print run.', status: 'approved', createdAt: '2026-03-15' },
      ],
    },
    quarter: {
      totalSpent: 9600, budget: 13500,
      byCategory: split(9600, [['Marketing', 62], ['Travel', 22], ['Supplies', 16]]),
      requests: [],
    },
  },

  'douglas-abreu': {
    name: 'Douglas Abreu', slug: 'douglas-abreu', type: 'employee', role: 'Data', monthlyBudget: 2500,
    trend: [
      { month: 'Nov', total: 900 }, { month: 'Dec', total: 1400 },
      { month: 'Jan', total: 850 }, { month: 'Feb', total: 1000 },
      { month: 'Mar', total: 1350 }, { month: 'Apr', total: 1100 },
    ],
    month: {
      totalSpent: 1100, budget: 2500,
      byCategory: split(1100, [['Equipment', 38], ['Supplies', 32], ['Travel', 30]]),
      requests: [
        { id: 22001, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Equipment', amount: 418, description: 'Wireless keyboard & mouse set for field reporting setup.', status: 'approved', createdAt: '2026-04-03' },
        { id: 22002, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Supplies', amount: 352, description: 'USB drives, printed survey forms and stationery for data collection.', status: 'approved', createdAt: '2026-04-06' },
        { id: 22003, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Travel', amount: 330, description: 'Travel to 4 Dublin stores for quarterly data audit.', status: 'approved', createdAt: '2026-04-09' },
      ],
    },
    'last-month': {
      totalSpent: 1350, budget: 2500,
      byCategory: split(1350, [['Equipment', 36], ['Supplies', 34], ['Travel', 30]]),
      requests: [
        { id: 23001, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Equipment', amount: 486, description: 'Monitor upgrade for data analysis workstation.', status: 'approved', createdAt: '2026-03-05' },
        { id: 23002, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Supplies', amount: 459, description: 'Office and data collection supplies Q1.', status: 'approved', createdAt: '2026-03-12' },
        { id: 23003, requesterName: 'Douglas Abreu', requesterRole: 'Data', category: 'Travel', amount: 405, description: 'Cork and Limerick store visit for data collection.', status: 'approved', createdAt: '2026-03-20' },
      ],
    },
    quarter: {
      totalSpent: 3800, budget: 7500,
      byCategory: split(3800, [['Equipment', 38], ['Supplies', 32], ['Travel', 30]]),
      requests: [],
    },
  },

  'layla-pinheiro': {
    name: 'Layla Pinheiro', slug: 'layla-pinheiro', type: 'employee', role: 'Training & Development', monthlyBudget: 3500,
    trend: [
      { month: 'Nov', total: 2100 }, { month: 'Dec', total: 2800 },
      { month: 'Jan', total: 1900 }, { month: 'Feb', total: 2200 },
      { month: 'Mar', total: 2900 }, { month: 'Apr', total: 2600 },
    ],
    month: {
      totalSpent: 2600, budget: 3500,
      byCategory: split(2600, [['Travel', 35], ['Supplies', 28], ['Marketing', 22], ['Utilities', 15]]),
      requests: [
        { id: 24001, requesterName: 'Layla Pinheiro', requesterRole: 'Training & Development', category: 'Travel', amount: 910, description: 'Travel to 6 stores for onboarding sessions — 3 new hires each.', status: 'approved', createdAt: '2026-04-02' },
        { id: 24002, requesterName: 'Layla Pinheiro', requesterRole: 'Training & Development', category: 'Supplies', amount: 728, description: 'Training manuals, workbooks and printed materials for Q2 inductions.', status: 'approved', createdAt: '2026-04-05' },
        { id: 24003, requesterName: 'Layla Pinheiro', requesterRole: 'Training & Development', category: 'Marketing', amount: 572, description: 'Design and print of new onboarding handbook — updated brand guidelines.', status: 'approved', createdAt: '2026-04-08' },
        { id: 24004, requesterName: 'Layla Pinheiro', requesterRole: 'Training & Development', category: 'Utilities', amount: 390, description: 'Virtual training platform subscription — April.', status: 'approved', createdAt: '2026-04-10' },
      ],
    },
    'last-month': {
      totalSpent: 2900, budget: 3500,
      byCategory: split(2900, [['Travel', 35], ['Supplies', 28], ['Marketing', 22], ['Utilities', 15]]),
      requests: [],
    },
    quarter: {
      totalSpent: 8100, budget: 10500,
      byCategory: split(8100, [['Travel', 35], ['Supplies', 28], ['Marketing', 22], ['Utilities', 15]]),
      requests: [],
    },
  },

  'bernardo-vianna': {
    name: 'Bernardo Vianna', slug: 'bernardo-vianna', type: 'employee', role: 'Area Lead', monthlyBudget: 4000,
    trend: [
      { month: 'Nov', total: 2400 }, { month: 'Dec', total: 3200 },
      { month: 'Jan', total: 2200 }, { month: 'Feb', total: 2600 },
      { month: 'Mar', total: 3400 }, { month: 'Apr', total: 2900 },
    ],
    month: {
      totalSpent: 2900, budget: 4000,
      byCategory: split(2900, [['Travel', 48], ['Supplies', 27], ['Maintenance', 25]]),
      requests: [
        { id: 25001, requesterName: 'Bernardo Vianna', requesterRole: 'Area Lead', category: 'Travel', amount: 1392, description: 'Mileage and transport — 13-store quarterly performance review tour.', status: 'approved', createdAt: '2026-04-01' },
        { id: 25002, requesterName: 'Bernardo Vianna', requesterRole: 'Area Lead', category: 'Supplies', amount: 783, description: 'Area lead audit materials and printed report forms.', status: 'approved', createdAt: '2026-04-05' },
        { id: 25003, requesterName: 'Bernardo Vianna', requesterRole: 'Area Lead', category: 'Maintenance', amount: 725, description: 'Minor repair kit equipment for store visits — portable tools.', status: 'approved', createdAt: '2026-04-08' },
        { id: 25004, requesterName: 'Bernardo Vianna', requesterRole: 'Area Lead', category: 'Travel', amount: 700, description: 'Hotel accommodation — 2-night area review stay Cork & Galway.', status: 'pending', createdAt: '2026-04-12' },
      ],
    },
    'last-month': {
      totalSpent: 3400, budget: 4000,
      byCategory: split(3400, [['Travel', 48], ['Supplies', 27], ['Maintenance', 25]]),
      requests: [],
    },
    quarter: {
      totalSpent: 9800, budget: 12000,
      byCategory: split(9800, [['Travel', 48], ['Supplies', 27], ['Maintenance', 25]]),
      requests: [],
    },
  },

  'andre-monteiro': {
    name: 'Andre Monteiro', slug: 'andre-monteiro', type: 'employee', role: 'Head of Logistics', monthlyBudget: 5000,
    trend: [
      { month: 'Nov', total: 3200 }, { month: 'Dec', total: 4100 },
      { month: 'Jan', total: 3000 }, { month: 'Feb', total: 3400 },
      { month: 'Mar', total: 4200 }, { month: 'Apr', total: 3800 },
    ],
    month: {
      totalSpent: 3800, budget: 5000,
      byCategory: split(3800, [['Supplies', 40], ['Maintenance', 32], ['Travel', 18], ['Utilities', 10]]),
      requests: [
        { id: 26001, requesterName: 'Andre Monteiro', requesterRole: 'Head of Logistics', category: 'Supplies', amount: 1520, description: 'Warehouse consumables — pallet wrap, labels, safety tape Q2 stock.', status: 'approved', createdAt: '2026-04-01' },
        { id: 26002, requesterName: 'Andre Monteiro', requesterRole: 'Head of Logistics', category: 'Maintenance', amount: 1216, description: 'Pallet truck and trolley service — annual maintenance contract.', status: 'approved', createdAt: '2026-04-04' },
        { id: 26003, requesterName: 'Andre Monteiro', requesterRole: 'Head of Logistics', category: 'Travel', amount: 684, description: 'Site visits to warehouse and distribution points — monthly logistics run.', status: 'approved', createdAt: '2026-04-08' },
        { id: 26004, requesterName: 'Andre Monteiro', requesterRole: 'Head of Logistics', category: 'Utilities', amount: 380, description: 'Additional forklift charging station electricity allocation.', status: 'approved', createdAt: '2026-04-10' },
      ],
    },
    'last-month': {
      totalSpent: 4200, budget: 5000,
      byCategory: split(4200, [['Supplies', 40], ['Maintenance', 32], ['Travel', 18], ['Utilities', 10]]),
      requests: [],
    },
    quarter: {
      totalSpent: 12500, budget: 15000,
      byCategory: split(12500, [['Supplies', 40], ['Maintenance', 32], ['Travel', 18], ['Utilities', 10]]),
      requests: [],
    },
  },

  'marcio-santos-do-nascimento': {
    name: 'Marcio Santos do Nascimento', slug: 'marcio-santos-do-nascimento', type: 'employee', role: 'Junior Warehouse Manager', monthlyBudget: 3000,
    trend: [
      { month: 'Nov', total: 1400 }, { month: 'Dec', total: 2100 },
      { month: 'Jan', total: 1300 }, { month: 'Feb', total: 1600 },
      { month: 'Mar', total: 2100 }, { month: 'Apr', total: 1800 },
    ],
    month: {
      totalSpent: 1800, budget: 3000,
      byCategory: split(1800, [['Supplies', 44], ['Maintenance', 36], ['Utilities', 20]]),
      requests: [
        { id: 27001, requesterName: 'Marcio Santos do Nascimento', requesterRole: 'Junior Warehouse Manager', category: 'Supplies', amount: 792, description: 'Warehouse packaging and labelling supplies restock.', status: 'approved', createdAt: '2026-04-03' },
        { id: 27002, requesterName: 'Marcio Santos do Nascimento', requesterRole: 'Junior Warehouse Manager', category: 'Maintenance', amount: 648, description: 'Monthly equipment check and minor repair parts.', status: 'approved', createdAt: '2026-04-06' },
        { id: 27003, requesterName: 'Marcio Santos do Nascimento', requesterRole: 'Junior Warehouse Manager', category: 'Utilities', amount: 360, description: 'Cold store energy supplement — warmer weather extra load.', status: 'pending', createdAt: '2026-04-11' },
      ],
    },
    'last-month': {
      totalSpent: 2100, budget: 3000,
      byCategory: split(2100, [['Supplies', 44], ['Maintenance', 36], ['Utilities', 20]]),
      requests: [],
    },
    quarter: {
      totalSpent: 5900, budget: 9000,
      byCategory: split(5900, [['Supplies', 44], ['Maintenance', 36], ['Utilities', 20]]),
      requests: [],
    },
  },

  'anthony-kilpatrick': {
    name: 'Anthony Kilpatrick', slug: 'anthony-kilpatrick', type: 'employee', role: 'Head of Compliance', monthlyBudget: 3500,
    trend: [
      { month: 'Nov', total: 1700 }, { month: 'Dec', total: 2300 },
      { month: 'Jan', total: 1600 }, { month: 'Feb', total: 1900 },
      { month: 'Mar', total: 2400 }, { month: 'Apr', total: 2100 },
    ],
    month: {
      totalSpent: 2100, budget: 3500,
      byCategory: split(2100, [['Travel', 40], ['Supplies', 32], ['Utilities', 28]]),
      requests: [
        { id: 28001, requesterName: 'Anthony Kilpatrick', requesterRole: 'Head of Compliance', category: 'Travel', amount: 840, description: 'Store compliance audits — travel to 8 stores Q2 opening round.', status: 'approved', createdAt: '2026-04-01' },
        { id: 28002, requesterName: 'Anthony Kilpatrick', requesterRole: 'Head of Compliance', category: 'Supplies', amount: 672, description: 'Compliance documentation, audit forms and branded folders.', status: 'approved', createdAt: '2026-04-04' },
        { id: 28003, requesterName: 'Anthony Kilpatrick', requesterRole: 'Head of Compliance', category: 'Utilities', amount: 588, description: 'Remote compliance platform subscription — monthly license.', status: 'approved', createdAt: '2026-04-07' },
      ],
    },
    'last-month': {
      totalSpent: 2400, budget: 3500,
      byCategory: split(2400, [['Travel', 40], ['Supplies', 32], ['Utilities', 28]]),
      requests: [],
    },
    quarter: {
      totalSpent: 6800, budget: 10500,
      byCategory: split(6800, [['Travel', 40], ['Supplies', 32], ['Utilities', 28]]),
      requests: [],
    },
  },
};

// ─── Category detail data ─────────────────────────────────────────────────────

function buildCategoryByEntity(slug: string, period: Period): CategorySpendByEntity[] {
  const results: CategorySpendByEntity[] = [];
  for (const store of Object.values(STORE_DETAILS)) {
    const match = store[period].byCategory.find((c) => c.category === slug.charAt(0).toUpperCase() + slug.slice(1));
    if (match && match.total > 0) results.push({ name: store.name, type: 'store', total: match.total });
  }
  for (const emp of Object.values(EMPLOYEE_DETAILS)) {
    const match = emp[period].byCategory.find((c) => c.category === slug.charAt(0).toUpperCase() + slug.slice(1));
    if (match && match.total > 0) results.push({ name: emp.name, type: 'employee', total: match.total });
  }
  return results.sort((a, b) => b.total - a.total);
}

function buildCategoryRequests(slug: string, period: Period): RequestItem[] {
  const results: RequestItem[] = [];
  const catName = slug.charAt(0).toUpperCase() + slug.slice(1);
  for (const store of Object.values(STORE_DETAILS)) {
    for (const req of store[period].requests) {
      if (req.category === catName) results.push(req);
    }
  }
  for (const emp of Object.values(EMPLOYEE_DETAILS)) {
    for (const req of emp[period].requests) {
      if (req.category === catName) results.push(req);
    }
  }
  return results.sort((a, b) => b.amount - a.amount).slice(0, 10);
}

const CATEGORY_TRENDS: Record<string, TrendPoint[]> = {
  supplies:    [{ month: 'Nov', total: 18400 }, { month: 'Dec', total: 24600 }, { month: 'Jan', total: 17800 }, { month: 'Feb', total: 20100 }, { month: 'Mar', total: 27200 }, { month: 'Apr', total: 21400 }],
  marketing:   [{ month: 'Nov', total: 11800 }, { month: 'Dec', total: 16200 }, { month: 'Jan', total: 10600 }, { month: 'Feb', total: 12800 }, { month: 'Mar', total: 18400 }, { month: 'Apr', total: 14800 }],
  maintenance: [{ month: 'Nov', total: 9800 }, { month: 'Dec', total: 14400 }, { month: 'Jan', total: 9200 }, { month: 'Feb', total: 10800 }, { month: 'Mar', total: 16100 }, { month: 'Apr', total: 12600 }],
  travel:      [{ month: 'Nov', total: 6200 }, { month: 'Dec', total: 8500 }, { month: 'Jan', total: 5800 }, { month: 'Feb', total: 7100 }, { month: 'Mar', total: 9600 }, { month: 'Apr', total: 8300 }],
  utilities:   [{ month: 'Nov', total: 4800 }, { month: 'Dec', total: 6600 }, { month: 'Jan', total: 4400 }, { month: 'Feb', total: 5200 }, { month: 'Mar', total: 7100 }, { month: 'Apr', total: 6400 }],
  equipment:   [{ month: 'Nov', total: 1200 }, { month: 'Dec', total: 2400 }, { month: 'Jan', total: 1100 }, { month: 'Feb', total: 1800 }, { month: 'Mar', total: 3200 }, { month: 'Apr', total: 2200 }],
};

export function getCategoryDetail(slug: string): CategoryDetail | null {
  if (!CATEGORY_TRENDS[slug]) return null;
  const catName = slug.charAt(0).toUpperCase() + slug.slice(1);
  const totalBudget = 95000;

  const monthEntities = buildCategoryByEntity(slug, 'month');
  const lastMonthEntities = buildCategoryByEntity(slug, 'last-month');
  const quarterEntities = buildCategoryByEntity(slug, 'quarter');

  return {
    name: catName,
    slug,
    trend: CATEGORY_TRENDS[slug],
    month: {
      total: monthEntities.reduce((s, e) => s + e.total, 0),
      budget: totalBudget,
      byEntity: monthEntities,
      requests: buildCategoryRequests(slug, 'month'),
    },
    'last-month': {
      total: lastMonthEntities.reduce((s, e) => s + e.total, 0),
      budget: totalBudget,
      byEntity: lastMonthEntities,
      requests: buildCategoryRequests(slug, 'last-month'),
    },
    quarter: {
      total: quarterEntities.reduce((s, e) => s + e.total, 0),
      budget: totalBudget * 3,
      byEntity: quarterEntities,
      requests: buildCategoryRequests(slug, 'quarter'),
    },
  };
}

// ─── Dashboard summary (for main dashboard page) ──────────────────────────────

export const DASHBOARD_MOCK: Record<string, any> = {
  month: {
    totalSpent: 63500,
    totalBudget: 95000,
    remainingBudget: 31500,
    pendingCount: 8,
    byStore: ALL_STORES.map((s) => ({
      name: s.name,
      slug: s.slug,
      total: STORE_DETAILS[s.slug]?.month.totalSpent ?? 0,
    })),
    byEmployee: ALL_EMPLOYEES.map((e) => ({
      name: e.name,
      slug: e.slug,
      role: e.role,
      total: EMPLOYEE_DETAILS[e.slug]?.month.totalSpent ?? 0,
    })),
    byCategory: [
      { category: 'Supplies',    slug: 'supplies',    total: 21400 },
      { category: 'Marketing',   slug: 'marketing',   total: 14800 },
      { category: 'Maintenance', slug: 'maintenance',  total: 12600 },
      { category: 'Travel',      slug: 'travel',      total: 8300 },
      { category: 'Utilities',   slug: 'utilities',   total: 6400 },
    ],
    topExpenses: [
      { id: 1001, amount: 4500, storeName: 'Anne Street',       category: 'Marketing', requesterName: 'Conor Walsh' },
      { id: 10001, amount: 3800, storeName: 'Cork',              category: 'Maintenance', requesterName: 'Siobhán Murphy' },
      { id: 8001, amount: 3200, storeName: 'Blanchardstown',     category: 'Supplies', requesterName: 'Aoife O\'Brien' },
      { id: 4001, amount: 2900, storeName: 'Arnotts',            category: 'Travel', requesterName: 'Ciarán Ryan' },
      { id: 19001, amount: 2400, storeName: 'Swords Pavilions',  category: 'Supplies', requesterName: 'Niamh Brennan' },
    ],
  },
  'last-month': {
    totalSpent: 71200,
    totalBudget: 95000,
    remainingBudget: 23800,
    pendingCount: 5,
    byStore: ALL_STORES.map((s) => ({
      name: s.name,
      slug: s.slug,
      total: STORE_DETAILS[s.slug]?.['last-month'].totalSpent ?? 0,
    })),
    byEmployee: ALL_EMPLOYEES.map((e) => ({
      name: e.name,
      slug: e.slug,
      role: e.role,
      total: EMPLOYEE_DETAILS[e.slug]?.['last-month'].totalSpent ?? 0,
    })),
    byCategory: [
      { category: 'Supplies',    slug: 'supplies',    total: 24600 },
      { category: 'Marketing',   slug: 'marketing',   total: 18200 },
      { category: 'Maintenance', slug: 'maintenance',  total: 14800 },
      { category: 'Travel',      slug: 'travel',      total: 8500 },
      { category: 'Utilities',   slug: 'utilities',   total: 5100 },
    ],
    topExpenses: [
      { id: 2001, amount: 5800, storeName: 'Anne Street',       category: 'Marketing', requesterName: 'Fionnuala O\'Connell' },
      { id: 11001, amount: 4600, storeName: 'Blanchardstown',    category: 'Supplies', requesterName: 'Aoife O\'Brien' },
      { id: 9001, amount: 3900, storeName: 'Cork',               category: 'Maintenance', requesterName: 'Siobhán Murphy' },
      { id: 5001, amount: 3200, storeName: 'Kildare Village',    category: 'Travel', requesterName: 'Fionnuala O\'Connell' },
      { id: 21001, amount: 2700, storeName: 'ILAC',              category: 'Utilities', requesterName: 'Emma Barrett' },
    ],
  },
  quarter: {
    totalSpent: 198400,
    totalBudget: 285000,
    remainingBudget: 86600,
    pendingCount: 12,
    byStore: ALL_STORES.map((s) => ({
      name: s.name,
      slug: s.slug,
      total: STORE_DETAILS[s.slug]?.quarter.totalSpent ?? 0,
    })),
    byEmployee: ALL_EMPLOYEES.map((e) => ({
      name: e.name,
      slug: e.slug,
      role: e.role,
      total: EMPLOYEE_DETAILS[e.slug]?.quarter.totalSpent ?? 0,
    })),
    byCategory: [
      { category: 'Supplies',    slug: 'supplies',    total: 68200 },
      { category: 'Marketing',   slug: 'marketing',   total: 48600 },
      { category: 'Maintenance', slug: 'maintenance',  total: 40100 },
      { category: 'Travel',      slug: 'travel',      total: 24800 },
      { category: 'Utilities',   slug: 'utilities',   total: 16700 },
    ],
    topExpenses: [
      { id: 3001, amount: 9200, storeName: 'Anne Street',       category: 'Marketing', requesterName: 'Conor Walsh' },
      { id: 4002, amount: 7800, storeName: 'Blanchardstown',     category: 'Maintenance', requesterName: 'Aoife O\'Brien' },
      { id: 10001, amount: 6400, storeName: 'Cork',              category: 'Supplies', requesterName: 'Siobhán Murphy' },
      { id: 5003, amount: 5600, storeName: 'Kildare Village',    category: 'Travel', requesterName: 'Niamh Brennan' },
      { id: 4003, amount: 4900, storeName: 'Arnotts',            category: 'Marketing', requesterName: 'Ciarán Ryan' },
    ],
  },
};
