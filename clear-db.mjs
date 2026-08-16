import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

// Create a Supabase client with the service_role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearDB() {
  console.log("Starting full database wipe...");

  try {
    // 1. Delete all spaces (cascades to goals, transactions, etc. due to 'on delete cascade')
    console.log("Deleting all spaces...");
    const { data: spaces, error: spaceError } = await supabase.from('spaces').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (spaceError) throw spaceError;
    console.log("Deleted all spaces.");

    // 2. Fetch all auth users
    console.log("Fetching auth.users...");
    const { data: { users }, error: fetchError } = await supabase.auth.admin.listUsers();
    if (fetchError) throw fetchError;

    console.log(`Found ${users.length} users. Deleting...`);
    
    // 3. Delete all auth users (cascades to public.users because of references on delete cascade)
    for (const user of users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Failed to delete user ${user.id}:`, deleteError);
      } else {
        console.log(`Deleted user ${user.id}`);
      }
    }

    console.log("Database successfully cleared for a fresh start.");

  } catch (err) {
    console.error("Error during DB wipe:", err);
  }
}

clearDB();
