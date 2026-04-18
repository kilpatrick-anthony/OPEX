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

// Individual credentials — email is the username, passwords are listed below
const directors = [
  { name: 'Anthony Kilpatrick', email: 'anthony.kilpatrick@oakberry.ie', password: 'Anthony@Oakberry1', role: 'super_admin' },
  { name: 'Alvin Galligan',     email: 'alvin.galligan@oakberry.ie',     password: 'Alvin@Oakberry1',   role: 'director' },
  { name: 'Nick Twomey',        email: 'nick.twomey@oakberry.ie',        password: 'Nick@Oakberry1',     role: 'director' },
  { name: "Cian O'Donoghue",   email: 'cian.odonoghue@oakberry.ie',     password: 'Cian@Oakberry1',     role: 'director' },
];

const fieldTeam = [
  { name: 'Emma Barrett',                email: 'emma.barrett@oakberry.ie',   password: 'Emma@Oakberry1' },
  { name: 'Douglas Abreu',               email: 'douglas.abreu@oakberry.ie',  password: 'Douglas@Oakberry1' },
  { name: 'Layla Pinheiro',              email: 'layla.pinheiro@oakberry.ie', password: 'Layla@Oakberry1' },
  { name: 'Bernardo Vianna',             email: 'bernardo.vianna@oakberry.ie',password: 'Bernardo@Oakberry1' },
  { name: 'Andre Monteiro',              email: 'andre.monteiro@oakberry.ie', password: 'Andre@Oakberry1' },
  { name: 'Marcio Santos do Nascimento', email: 'marcio.santos@oakberry.ie',  password: 'Marcio@Oakberry1' },
];

// Store manager passwords keyed by store name
const storePasswords = {
  'Anne Street':       'AnneStreet@Oakberry1',
  'Arnotts':           'Arnotts@Oakberry1',
  'Blackrock':         'Blackrock@Oakberry1',
  'Blanchardstown':    'Blanchardstown@Oakberry1',
  'Cork':              'Cork@Oakberry1',
  'Dun Laoghaire':     'DunLaoghaire@Oakberry1',
  'Dundalk':           'Dundalk@Oakberry1',
  'Hansfield':         'Hansfield@Oakberry1',
  'ILAC':              'ILAC@Oakberry1',
  'Kildare Village':   'KildareVillage@Oakberry1',
  'Maynooth':          'Maynooth@Oakberry1',
  'Nutgrove':          'Nutgrove@Oakberry1',
  'Swords Pavilions':  'SwordsPavilions@Oakberry1',
};

async function main() {
  for (const name of stores) {
    await sql`INSERT INTO stores (name, budget) VALUES (${name}, 10000) ON CONFLICT (name) DO NOTHING`;
  }

  for (const user of directors) {
    const hash = await bcrypt.hash(user.password, 12);
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${hash}, ${user.role}, NULL)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role
    `;
  }

  for (const user of fieldTeam) {
    const hash = await bcrypt.hash(user.password, 12);
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${user.name}, ${user.email.toLowerCase()}, ${hash}, 'employee', NULL)
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `;
  }

  for (const storeName of stores) {
    const store = await sql`SELECT id FROM stores WHERE name = ${storeName} LIMIT 1`;
    const managerEmail = `manager.${storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@oakberry.ie`;
    const hash = await bcrypt.hash(storePasswords[storeName], 12);
    await sql`
      INSERT INTO users (name, email, password, role, storeId)
      VALUES (${storeName + ' Manager'}, ${managerEmail}, ${hash}, 'manager', ${store[0].id})
      ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
    `;
  }

  console.log('Seed complete.');
  console.log('\nCredentials summary:');
  for (const u of directors) console.log(` ${u.email}  /  ${u.password}`);
  for (const u of fieldTeam)  console.log(` ${u.email}  /  ${u.password}`);
  for (const s of stores)     console.log(` manager.${s.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@oakberry.ie  /  ${storePasswords[s]}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
