import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWorkingHours() {
  console.log('Fetching working hours...');
  const { data, error } = await supabase
    .from('working_hours')
    .select('employee_id, day_of_week, start_time, end_time')
    .order('employee_id')
    .order('day_of_week');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Working hours records:');
  console.log(JSON.stringify(data, null, 2));
}

checkWorkingHours();
