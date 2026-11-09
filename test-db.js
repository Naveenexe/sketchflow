import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
const unpooledUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL not found in .env.local');
  process.exit(1);
}

console.log('🔗 Connecting to Neon Postgres...');
console.log('   Branch:', process.env.NEON_BRANCH || 'default');
console.log('   Branch ID:', process.env.NEON_BRANCH_ID || 'n/a');
console.log('   Pooled URL available:', Boolean(databaseUrl));
console.log('   Direct (unpooled) URL available:', Boolean(unpooledUrl));

// Use unpooled for schema setup per Neon best practices
const sqlDirect = neon(unpooledUrl || databaseUrl);
// Use pooled for application queries
const sql = neon(databaseUrl);

async function runTests() {
  try {
    // 1. Health & version check
    console.log('\n[1/4] Probing PostgreSQL version & connection...');
    const [info] = await sql`SELECT version(), current_database(), current_user, NOW() as current_time;`;
    console.log('   ✅ Connected successfully!');
    console.log('   Database:', info.current_database);
    console.log('   User:', info.current_user);
    console.log('   Server Time:', info.current_time);
    console.log('   Postgres Version:', info.version.split(' ')[0] + ' ' + info.version.split(' ')[1]);

    // 2. DDL Schema Check / Migration (using direct unpooled connection)
    console.log('\n[2/4] Testing Schema Provisioning (Boards table from SRS Section 6)...');
    await sqlDirect`
      CREATE TABLE IF NOT EXISTS boards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        scene_json JSONB,
        version INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log('   ✅ Table "boards" verified/created.');

    // 3. Write operation (Insert board)
    console.log('\n[3/4] Testing INSERT operation via pooled connection...');
    const testTitle = `SketchFlow Initializer ${new Date().toISOString()}`;
    const sampleScene = { elements: [], appState: { viewBackgroundColor: "#ffffff" } };

    const [inserted] = await sql`
      INSERT INTO boards (title, scene_json)
      VALUES (${testTitle}, ${JSON.stringify(sampleScene)})
      RETURNING id, title, version, created_at;
    `;
    console.log('   ✅ Inserted board record:');
    console.log('      ID:', inserted.id);
    console.log('      Title:', inserted.title);
    console.log('      Created At:', inserted.created_at);

    // 4. Read operation (Select board)
    console.log('\n[4/4] Testing SELECT operation...');
    const boards = await sql`SELECT id, title, version FROM boards ORDER BY created_at DESC LIMIT 5;`;
    console.log(`   ✅ Read ${boards.length} board(s) successfully.`);
    boards.forEach((b, i) => {
      console.log(`      ${i + 1}. [${b.id.substring(0, 8)}...] ${b.title}`);
    });

    console.log('\n🎉 ALL NEON POSTGRES SERVICES TESTED AND PASSING END-TO-END!\n');
  } catch (err) {
    console.error('❌ Database test failed:', err);
    process.exit(1);
  }
}

runTests();

