import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = 'https://wwrmlhwlthairbfuqlxc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3cm1saHdsdGhhaXJiZnVxbHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjMxNTIsImV4cCI6MjA5MDQzOTE1Mn0.ZD0SoAp8qzv_3JyfeYnNV_Qz6WlrreHn1owWDrIplC8';

const supabase = createClient(url, key);

const TABLES = [
  'pantry_items', 'belongings_daily', 'belongings_durable', 'schedule_events',
  'calorie_records', 'finance_records', 'todos', 'thoughts', 'settings',
  'weight_records', 'measurement_records', 'goals', 'projects', 'ai_sessions', 'ai_messages'
];

const exportData = {};
let total = 0;

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
    exportData[table] = [];
  } else {
    exportData[table] = data || [];
    total += exportData[table].length;
    console.log(`✅ ${table}: ${exportData[table].length} 条`);
  }
}

fs.writeFileSync('/tmp/vlife-data-export.json', JSON.stringify(exportData, null, 2));
console.log(`\n🎉 总计导出 ${total} 条记录，保存到 /tmp/vlife-data-export.json`);
