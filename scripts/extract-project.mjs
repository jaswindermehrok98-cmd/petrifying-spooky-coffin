import { inflateRawSync } from 'node:zlib';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const bundleDir = resolve(root, '.bundle');
const siteDir = resolve(root, 'site');
const chunkNames = (await readdir(bundleDir)).filter((name) => /^part-\\d+\\.b64$/.test(name)).sort();
if (!chunkNames.length) throw new Error('The project bundle chunks are missing.');

const encoded = (await Promise.all(chunkNames.map((name) => readFile(join(bundleDir, name), 'utf8')))).join('');
const archive = Buffer.from(encoded, 'base64');

let eocd = -1;
for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i -= 1) {
  if (archive.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) throw new Error('The embedded project ZIP is invalid (end record missing).');

const entryCount = archive.readUInt16LE(eocd + 10);
let cursor = archive.readUInt32LE(eocd + 16);
await mkdir(siteDir, { recursive: true });

for (let index = 0; index < entryCount; index += 1) {
  if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('The embedded project ZIP has a malformed directory.');
  const flags = archive.readUInt16LE(cursor + 8);
  const method = archive.readUInt16LE(cursor + 10);
  const compressedSize = archive.readUInt32LE(cursor + 20);
  const uncompressedSize = archive.readUInt32LE(cursor + 24);
  const nameLength = archive.readUInt16LE(cursor + 28);
  const extraLength = archive.readUInt16LE(cursor + 30);
  const commentLength = archive.readUInt16LE(cursor + 32);
  const localOffset = archive.readUInt32LE(cursor + 42);
  const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
  cursor += 46 + nameLength + extraLength + commentLength;

  if (flags & 1) throw new Error(`Encrypted ZIP entry is not supported: ${name}`);
  const normal = name.replaceAll('\\\\', '/');
  if (normal.startsWith('/') || normal.split('/').includes('..')) throw new Error(`Unsafe path in project ZIP: ${name}`);
  const destination = resolve(siteDir, normal);
  if (destination !== siteDir && !destination.startsWith(siteDir + sep)) throw new Error(`Unsafe extraction path: ${name}`);
  if (normal.endsWith('/')) { await mkdir(destination, { recursive: true }); continue; }

  if (archive.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local file header: ${name}`);
  const localNameLength = archive.readUInt16LE(localOffset + 26);
  const localExtraLength = archive.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = archive.subarray(dataStart, dataStart + compressedSize);
  let data;
  if (method === 0) data = compressed;
  else if (method === 8) data = inflateRawSync(compressed);
  else throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
  if (data.length !== uncompressedSize) throw new Error(`Size check failed for ${name}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

if (process.argv.includes('--extract-only')) {
  console.log(`Samrath Web extracted (${entryCount} ZIP entries).`);
} else {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = spawnSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: siteDir, stdio: 'inherit' });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
  console.log(`Samrath Web extracted and dependencies installed (${entryCount} ZIP entries).`);
}
