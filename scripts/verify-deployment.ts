
import { sql } from 'drizzle-orm';
import db from '../lib/db/client';
import env from '../lib/env';

async function main() {
  console.log('\n🔍 Starting Deployment Verification...');
  console.log(`target: ${env.DATABASE_URL.split('@')[1] || 'localhost'}`); // mask credentials

  let issues = 0;
  let warnings = 0;

  // 1. Check Current User & Privileges
  console.log('\n--- 1. Database User & Privileges ---');
  try {
    const userRes = await db.execute(sql`
      SELECT 
        current_user as name, 
        current_database() as db_name, 
        version() as version
    `);
    const currentUser = userRes[0].name;
    console.log(`✅ Connected as user: '${currentUser}'`);
    console.log(`ℹ️  Database: '${userRes[0].db_name}'`);

    const roleRes = await db.execute(sql`
      SELECT rolname, rolsuper, rolbypassrls, rolcreatedb 
      FROM pg_roles 
      WHERE rolname = ${currentUser}
    `);
    
    if (roleRes.length > 0) {
      const role = roleRes[0];
      console.log(`   - Superuser: ${role.rolsuper ? 'YES' : 'NO'}`);
      console.log(`   - Bypass RLS: ${role.rolbypassrls ? 'YES' : 'NO'}`);

      if (role.rolbypassrls || role.rolsuper) {
        console.warn('⚠️  WARNING: Connected user has BYPASSRLS or SUPERUSER privileges.');
        console.warn('   Row-Level Security policies will be SKIPPED for this user.');
        console.warn('   This is fine for admin tasks, but the app should ideally use a restricted user.');
        warnings++;
      } else {
        console.log('✅ User is restricted (RLS will be enforced).');
      }
    }
  } catch (err) {
    console.error('❌ Failed to check user privileges:', err);
    issues++;
  }

  // 2. Check Table RLS Status
  console.log('\n--- 2. RLS Status on Critical Tables ---');
  const criticalTables = ['accounts', 'budgets', 'category_groups', 'transactions', 'budget_months'];
  
  for (const tableName of criticalTables) {
    try {
      const res = await db.execute(sql`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = ${tableName} 
        AND relkind = 'r'
      `);
      
      if (res.length === 0) {
        console.error(`❌ Table '${tableName}' NOT found!`);
        issues++;
      } else if (res[0].relrowsecurity) {
        console.log(`✅ [${tableName}] RLS Enabled`);
      } else {
        console.error(`❌ [${tableName}] RLS DISABLED (ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY needed)`);
        issues++;
      }
    } catch (err) {
      console.error(`❌ Error checking table ${tableName}:`, err);
      issues++;
    }
  }

  // 3. Check Active Policies
  console.log('\n--- 3. Active RLS Policies ---');
  try {
    const policies = await db.execute(sql`
      SELECT schemaname, tablename, policyname, cmd, roles 
      FROM pg_policies 
      WHERE schemaname = 'public'
    `);
    
    if (policies.length === 0) {
      console.warn('⚠️  NO POLICIES FOUND! RLS is enabled but no policies exist (all access denied?).');
      warnings++;
    } else {
      console.log(`Found ${policies.length} active policies:`);
      policies.forEach((p: unknown) => {
        const policy = p as { tablename: string; policyname: string; cmd: string };
        console.log(`   - ${policy.tablename}: ${policy.policyname} (${policy.cmd})`);
      });
      
      // Check for specific critical policies
      const hasAccountsPolicy = policies.some((p: unknown) => {
        const policy = p as { tablename: string; policyname: string; };
        return policy.tablename === 'accounts' && policy.policyname.includes('isolation');
      });
      if (!hasAccountsPolicy) {
        console.error('❌ Missing isolation policy on accounts table!');
        issues++;
      }
    }
  } catch (err) {
    console.error('❌ Failed to list policies:', err);
    issues++;
  }

  // 4. Migration Consistency Check (Drizzle)
  console.log('\n--- 4. Migration Status ---');
  try {
    // Check if drizzle migrations table exists
    const migTable = await db.execute(sql`
      SELECT to_regclass('drizzle.__drizzle_migrations') as exists
    `);
    
    // Note: Drizzle table name might vary depending on configuration, usually in 'drizzle' schema
    if (migTable[0].exists) {
        console.log('✅ Drizzle migrations table found.');
        // Could query the table here if we knew the schema better, but existence is a good sign
    } else {
         console.warn('ℹ️  Drizzle migrations table not found (or in different schema).');
    }
  } catch (err) {
     console.warn('ℹ️  Could not verify migration table (perms?):', err);
  }

  // 5. Schema Version Check (Critical Columns)
  console.log('\n--- 5. Critical Columns (Schema Version) ---');
  const criticalColumns = [
    { table: 'budget_months', column: 'budget_id' },
    { table: 'categories', column: 'budget_id' },
    { table: 'transactions', column: 'budget_id' },
  ];

  for (const { table, column } of criticalColumns) {
    try {
      const res = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table} 
        AND column_name = ${column}
      `);
      
      if (res.length > 0) {
        console.log(`✅ [${table}.${column}] exists`);
      } else {
        console.error(`❌ [${table}.${column}] MISSING — schema migration incomplete!`);
        issues++;
      }
    } catch (err) {
      console.error(`❌ Error checking ${table}.${column}:`, err);
      issues++;
    }
  }

  console.log('\n════════════════════════════════════════');
  if (issues > 0) {
    console.error(`❌ Verification FAILED with ${issues} strict issues.`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`⚠️  Verification PASSED with ${warnings} warnings (see above).`);
  } else {
    console.log('✅ Verification PASSED completely. Deployment looks solid.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
