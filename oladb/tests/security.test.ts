import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8');
const tables = readFileSync(new URL('../lib/tables.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

test('uses HTTP-only, strict-site session cookies', () => { assert.match(auth, /httpOnly: true/); assert.match(auth, /sameSite: 'strict'/); });
test('does not model an administrator password in PostgreSQL', () => assert.doesNotMatch(schema, /password/i));
test('blocks arbitrary table names', () => assert.match(tables, /tableLabels/));
test('uses project-scoped record lookups before mutations', () => assert.match(tables, /findFirst\(\{ where: \{ id, projectId \}/));
