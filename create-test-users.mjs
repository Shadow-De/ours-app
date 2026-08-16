import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUsers() {
  const { data: userA, error: errA } = await supabase.auth.admin.createUser({
    email: 'testA@example.com',
    password: 'password123',
    email_confirm: true,
  });
  if (errA) console.error("Error A:", errA.message);
  else console.log("Created A:", userA.user.id);

  const { data: userB, error: errB } = await supabase.auth.admin.createUser({
    email: 'testB@example.com',
    password: 'password123',
    email_confirm: true,
  });
  if (errB) console.error("Error B:", errB.message);
  else console.log("Created B:", userB.user.id);
}

createTestUsers();
