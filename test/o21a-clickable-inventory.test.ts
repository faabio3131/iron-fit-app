import fs from 'node:fs';
import path from 'node:path';

function sourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(tsx|jsx)$/.test(entry.name) ? [target] : [];
  });
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split('\n').length;
}

test('O21A every touchable/pressable has a real action and button semantics', () => {
  const failures: string[] = [];

  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<(TouchableOpacity|Pressable)\b[\s\S]{0,1200}?>/g)) {
      const opening = match[0];
      const line = lineAt(source, match.index ?? 0);
      if (!/\bonPress\s*=/.test(opening)) {
        failures.push(`${file}:${line} sem onPress`);
      }
      if (!/accessibilityRole\s*=\s*["']button["']/.test(opening)) {
        failures.push(`${file}:${line} sem accessibilityRole=button`);
      }
    }
  }

  expect(failures).toEqual([]);
});

test('O21A raw Text/View/Icon elements are not used as hidden click targets', () => {
  const failures: string[] = [];

  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const tag of ['Text', 'View', 'Ionicons']) {
      const expression = new RegExp(`<${tag}\\b[\\s\\S]{0,900}?\\bonPress\\s*=`, 'g');
      for (const match of source.matchAll(expression)) {
        failures.push(`${file}:${lineAt(source, match.index ?? 0)} <${tag}> com onPress bruto`);
      }
    }
  }

  expect(failures).toEqual([]);
});
