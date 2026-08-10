const fs = require('fs');
const content = fs.readFileSync('src/utils/dealStorage.ts', 'utf8');
const fixed1 = content.replace(/if \(Array\.isArray\(parsed\) && parsed\.length > 0\) \{/, "if (Array.isArray(parsed)) {");
const fixed2 = fixed1.replace(
`  saveToLocalStorage(updatedList);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('deals').delete().eq('id', dealId);
    } catch (err) {
      console.warn('Supabase delete warning:', err);
    }
  }

  return updatedList;`,
`  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('deals').delete().eq('id', dealId);
      if (error) {
        throw error;
      }
    } catch (err) {
      console.warn('Supabase delete warning:', err);
      throw err;
    }
  }

  saveToLocalStorage(updatedList);
  return updatedList;`);
fs.writeFileSync('src/utils/dealStorage.ts', fixed2);
