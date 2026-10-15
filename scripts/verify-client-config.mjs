import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolutePath);
      return /\.tsx?$/.test(entry.name) ? [absolutePath] : [];
    })
  );
  return files.flat();
}

const forbidden = [
  { label: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]+/ },
  { label: 'legacy service-role variable', pattern: /SUPABASE_SERVICE_ROLE_KEY/ },
  { label: 'Supabase secret variable', pattern: /SUPABASE_SECRET_KEY/ },
  {
    label: 'hardcoded Supabase client credentials',
    pattern: /createClient\s*\(\s*['"]https:\/\/[^'"]+\.supabase\.co['"]/
  }
];

const clientSourceFiles = [
  ...(await sourceFiles(path.resolve('app'))),
  ...(await sourceFiles(path.resolve('components'))),
  ...(await sourceFiles(path.resolve('lib')))
];

for (const file of clientSourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) {
      throw new Error(`${rule.label} found in ${path.relative(process.cwd(), file)}.`);
    }
  }
}

console.log('Client configuration guard passed: no hardcoded Supabase credentials found.');
