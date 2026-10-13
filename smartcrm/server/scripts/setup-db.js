import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dir = path.dirname(fileURLToPath(import.meta.url));
const readSql = (file) => fs.readFileSync(path.join(dir, '..', 'sql', file), 'utf8');

try {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  await conn.query(readSql('schema.sql'));
  await conn.query(readSql('seed.sql'));
  await conn.end();
  console.log('✅ Database "smartcrm" created and seeded with demo data.');
} catch (err) {
  console.error('❌ Database setup failed:', err.message);
  console.error('Check that MySQL is running and DB_USER / DB_PASSWORD in server/.env are correct.');
  process.exit(1);
}
