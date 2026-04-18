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
  'Cork',
  'Dun Laoghaire',
  'Dundalk',
  'Hansfield',
  'ILAC',
  'Kildare Village',
  'Maynooth',
  'Swords Pavilions',
];

// Individual credentials — email is the username, passwords are listed below
const directors = [
  { name: 'Anthony Kilpatrick', email: 'info@oakberry.ie',  password: 'Anthony2026!', role: 'super_admin', title: 'Head of Compliance' },
  { name: 'Alvin Galligan',     email: 'alvin@oakberry.ie', password: 'Alvin2026!',   role: 'director',    title: 'Director' },
  { name: 'Nick Twomey',        email: 'nick@oakberry.ie',  password: 'Nick2026!',    role: 'director',    title: 'Director' },
  { name: "Cian O'Donoghue",   email: 'cian@oakberry.ie',  password: 'Cian2026!',    role: 'director',    title: 'Director' },
];

const fieldTeam = [
  { name: 'Andre Luis Monteiro Da Silva',  email: 'andre@oakberry.ie',    password: 'Andre2026!',    title: 'Head of Delivery & Logistics' },
  { name: 'Bernardo Vianna',               email: 'bernardo@oakberry.ie', password: 'Bernardo2026!', title: 'Area Lead' },
  { name: 'Douglas Abreu',                 email: 'douglas@oakberry.ie',  password: 'Douglas2026!',  title: 'Head of Openings & Data Analysis' },
  { name: 'Emma Barrett',                  email: 'emma@oakberry.ie',     password: 'Emma2026!',     title: 'Marketing & Social Media Executive' },
  { name: 'Layla Conti Pinheiro',          email: 'layla@oakberry.ie',    password: 'Layla2026!',    title: 'Training & Development Manager' },
  { name: 'Marcio Santos do Nascimento',   email: 'marcio@oakberry.ie',   password: 'Marcio2026!',   title: 'Junior Warehouse Manager' },
];

const storeAccounts = [
  { storeName: 'Anne Street',      email: 'annestreet@oakberry.ie',     password: 'Annestreet2026!',      title: 'Store Manager' },
  { storeName: 'Arnotts',          email: 'arnotts@oakberry.ie',        password: 'Arnotts2026!',         title: 'Store Manager' },
  { storeName: 'Blackrock',        email: 'blackrock@oakberry.ie',      password: 'Blackrock2026!',       title: 'Store Manager' },
  { storeName: 'Cork',             email: 'cork@oakberry.ie',           password: 'Cork2026!',            title: 'Store Manager' },
  { storeName: 'Dun Laoghaire',    email: 'dunlaoghaire@oakberry.ie',   password: 'Dunlaoghaire2026!',    title: 'Store Manager' },
  { storeName: 'Dundalk',          email: 'dundalk@oakberry.ie',        password: 'Dundalk2026!',         title: 'Store Manager' },
  { storeName: 'Hansfield',        email: 'hansfield@oakberry.ie',      password: 'Hansfield2026!',       title: 'Store Manager' },
  { storeName: 'ILAC',             email: 'ilac@oakberry.ie',           password: 'Ilac2026!',            title: 'Store Manager' },
  { storeName: 'Kildare Village',  email: 'kildarevillage@oakberry.ie', password: 'Kildarevillage2026!',  title: 'Store Manager' },
  { storeName: 'Maynooth',         email: 'maynooth@oakberry.ie',       password: 'Maynooth2026!',        title: 'Store Manager' },
  { storeName: 'Swords Pavilions', email: 'swordspavilions@oakberry.ie',password: 'Swordspavilions2026!', title: 'Store Manager' },
];

const legacyEmails = [
  'anthony.kilpatrick@oakberry.ie',
  'alvin.galligan@oakberry.ie',
  'nick.twomey@oakberry.ie',
  'cian.odonoghue@oakberry.ie',
  'emma.barrett@oakberry.ie',
  'douglas.abreu@oakberry.ie',
  'layla.pinheiro@oakberry.ie',
  'bernardo.vianna@oakberry.ie',
  'andre.monteiro@oakberry.ie',
  'marcio.santos@oakberry.ie',
  'manager.anne-street@oakberry.ie',
  'manager.arnotts@oakberry.ie',
  'manager.blackrock@oakberry.ie',
  'manager.blanchardstown@oakberry.ie',
  'manager.cork@oakberry.ie',
  'manager.dun-laoghaire@oakberry.ie',
  'manager.dundalk@oakberry.ie',
  'manager.hansfield@oakberry.ie',
  'manager.ilac@oakberry.ie',
  'manager.kildare-village@oakberry.ie',
  'manager.maynooth@oakberry.ie',
  'manager.nutgrove@oakberry.ie',
  'manager.swords-pavilions@oakberry.ie',
];

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT`;

  for (const email of legacyEmails) {
    await sql`DELETE FROM users WHERE email = ${email}`;
  }

  for (const name of stores) {
    await sql`INSERT INTO stores (name, budget) VALUES (${name}, 10000) ON CONFLICT (name) DO NOTHING`;
  }

  for (const user of directors) {
    const hash = await bcrypt.hash(user.password, 12);
    await sql`
      INSERT INTO users (name, email, password, role, title, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${hash}, ${user.role}, ${user.title}, NULL)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role, title = EXCLUDED.title
    `;
  }

  for (const user of fieldTeam) {
    const hash = await bcrypt.hash(user.password, 12);
    await sql`
      INSERT INTO users (name, email, password, role, title, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${hash}, 'employee', ${user.title}, NULL)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, title = EXCLUDED.title
    `;
  }

  for (const account of storeAccounts) {
    const store = await sql`SELECT id FROM stores WHERE name = ${account.storeName} LIMIT 1`;
    const hash = await bcrypt.hash(account.password, 12);
    await sql`
      INSERT INTO users (name, email, password, role, title, storeId)
      VALUES (${account.storeName}, ${account.email.toLowerCase()}, ${hash}, 'manager', ${account.title}, ${store[0].id})
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, title = EXCLUDED.title
    `;
  }

  console.log('Seed complete.');
  console.log('\nCredentials summary:');
  for (const u of directors) console.log(` ${u.email}  /  ${u.password}`);
  for (const u of fieldTeam)  console.log(` ${u.email}  /  ${u.password}`);
  for (const u of storeAccounts) console.log(` ${u.email}  /  ${u.password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
