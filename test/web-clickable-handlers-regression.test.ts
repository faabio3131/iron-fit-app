import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const sourceDirs = [join(process.cwd(), 'src', 'web'), join(process.cwd(), 'src', 'components')];
const interactiveNames = new Set(['TouchableOpacity', 'Pressable', 'Button', 'button']);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

test('Web and shared component interactive elements expose a real press/click handler', () => {
  const missing: string[] = [];
  for (const file of sourceDirs.flatMap(tsxFiles)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = node.tagName.getText(source);
        if (interactiveNames.has(name)) {
          const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
          const named = (key: string) => attributes.find((attr) => attr.name.getText(source) === key);
          const handler = named('onPress') ?? named('onClick');
          if (!handler && !named('href')) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            missing.push(`${file.replace(process.cwd(), '')}:${line + 1} <${name}> without onPress/onClick/href`);
          }
          if (handler && handler.initializer && ts.isJsxExpression(handler.initializer)) {
            const expression = handler.initializer.expression;
            if (expression && ts.isArrowFunction(expression) && ts.isBlock(expression.body) && expression.body.statements.length === 0) {
              const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
              missing.push(`${file.replace(process.cwd(), '')}:${line + 1} <${name}> has empty callback`);
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
  }
  expect(missing).toEqual([]);
});
