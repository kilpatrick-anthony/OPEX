import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(process.env.DATABASE_URL);

const stores = [
  'Anne Street',
  'Arnotts',
  'Blackrock',
  'Blanchardstown',
  'Cork',
  'Dun Laoghaire',
  'Dundalk',
  'Hansfield',
  'ILAC',
  'Kildare Village',
  'Maynooth',
  'Nutgrove',
  'Swords Pavilions',
];

const directors = [
  { name: 'Anthony Kilpatrick', email: 'anthony.kilpatrick@oakberry.ie' },
  { name: 'Alvin Galligan', email: 'alvin.galligan@oakberry.ie' },
  { name: 'Nick Twomey', email: 'nick.twomey@oakberry.ie' },
  { name: "Cian O'Donoghue", email: 'cian.odonoghue@oakberry.ie' },
];

const fieldTeam = [
  { name: 'Emma Barrett', email: 'emma.barrett@oakberry.ie' },
  { name: 'Douglas Abreu', email: 'douglas.abreu@oakberry.ie' },
  { name: 'Layla Pinheiro', email: 'layla.pinheiro@oakberry.ie' },
  { name: 'Bernardo Vianna', email: 'bernardo.vianna@oakberry.ie' },
  { name: 'Andre Monteiro', email: 'andre.monteiro@oakberry.ie' },
  { name: 'Marcio Santos do Nascimento', email: 'marcio.santos@oakberry.ie' },
];

async function main() {
  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  for (const name of stores) {
    await sql`INSERT INTO stores (name, budget) VALUES (${name}, 10000) ON CONFLICT (name) DO NOTHING`;
  }

  for (const user of directors) {
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${passwordHash}, 'director', NULL)
      ON CONFLICT (email) DO NOTHING
    `;
  }

  for (const user of fieldTeam) {
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${passwordHash}, 'employee', NULL)
      ON CONFLICT (email) DO NOTHING
    `;
  }

  for (const storeName of stores) {
    const store = await sql`SELECT id FROM stores WHERE name = ${storeName} LIMIT 1`;
    const managerEmail = `manager.${storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-') }@oakberry.ie`;
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${storeName + ' Manager'}, ${managerEmail}, ${passwordHash}, 'manager', ${store[0].id})
      ON CONFLICT (email) DO NOTHING
    `;
  }

  console.log('Seed complete. Default password: ChangeMe123! (rotate immediately).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
