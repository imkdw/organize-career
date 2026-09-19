import { mkdir, writeFile } from 'node:fs/promises';
import { collectConfluence } from './sources/confluence.js';
import { collectGithub } from './sources/github.js';
import { collectJira } from './sources/jira.js';

const collectors: Record<string, () => Promise<Record<string, unknown[]>>> = {
  github: collectGithub,
  jira: collectJira,
  confluence: collectConfluence,
};

async function save(source: string, entity: string, data: unknown[]) {
  const dir = `data/${source}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${entity}.json`, JSON.stringify(data, null, 2));
  console.log(`✓ ${dir}/${entity}.json — ${data.length}건`);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(collectors);

for (const target of targets) {
  const collect = collectors[target];
  if (!collect) {
    console.error(`알 수 없는 소스: ${target} (가능: ${Object.keys(collectors).join(', ')})`);
    process.exit(1);
  }
  console.log(`[${target}] 수집 시작...`);
  const result = await collect();
  for (const [entity, data] of Object.entries(result)) await save(target, entity, data);
}
