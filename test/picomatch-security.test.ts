import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));

test('CVE-2026-112366 uses the pinned, MIT-licensed, security-reviewed matcher in actual tooling', () => {
  const cfg = JSON.parse(readFileSync('vendor/picomatch-v4/package.json', 'utf8'));
  expect(cfg.name).toBe('@fmtech/picomatch-backport');
  expect(cfg.version).toBe('4.0.8-iron.0');
  expect(cfg.ironUpstreamSha).toBe('c63a5bf4e61dbdb81bc41e97dc2616c30acce337');
  const expected = realpathSync('vendor/picomatch-v4/index.js');
  for (const packageName of ['micromatch', 'metro', '@expo/metro-config', 'tinyglobby', 'jest-resolve']) {
    const base = nodeRequire.resolve(packageName);
    const resolved = nodeRequire.resolve('picomatch', { paths: [base] });
    expect(realpathSync(resolved)).toBe(expected);
  }
});

test('CVE-2026-112366 hostile repeated extglobs finish under bounded subprocess deadline', () => {
  const program = `
    const assert=require('node:assert/strict');
    const matcher=require('./vendor/picomatch-v4');
    for(const pattern of ['+(*a)','+(*a)c','*(a*)b','+(a*b)c']) {
      assert.equal(matcher.isMatch('a'.repeat(10000)+'!', pattern),false,pattern);
    }
    for(const [pattern,yes,no] of [
      ['+(*a)','aba','bbb'], ['+(a*b)','abab','abc'],
      ['*(a*b)c','ababc','abb'], ['x+(*a)y','xabaay','xby']
    ]) {
      assert.equal(matcher.isMatch(yes,pattern),true,pattern);
      assert.equal(matcher.isMatch(no,pattern),false,pattern);
    }
  `;
  expect(() => execFileSync(process.execPath, ['-e', program], {
    timeout: 2500, stdio: ['ignore','pipe','pipe'], cwd: process.cwd(),
  })).not.toThrow();
});
