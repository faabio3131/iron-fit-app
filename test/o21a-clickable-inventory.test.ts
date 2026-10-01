import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function sourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(tsx|jsx)$/.test(entry.name) ? [target] : [];
  });
}

function tagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
  return node.tagName.getText();
}

function hasAttribute(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
) {
  return node.attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) &&
      property.name.getText() === name,
  );
}

function literalAttributeValue(
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string,
) {
  const attribute = node.attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) &&
      property.name.getText() === name,
  );
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) {
    return null;
  }
  return ts.isStringLiteral(attribute.initializer)
    ? attribute.initializer.text
    : null;
}

function visitJsx(
  file: string,
  source: string,
  visitor: (
    node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
    sourceFile: ts.SourceFile,
  ) => void,
) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function walk(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      visitor(node, sourceFile);
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
}

function location(
  file: string,
  node: ts.Node,
  sourceFile: ts.SourceFile,
) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${file}:${line + 1}`;
}

test('O21A every touchable/pressable has a real action and button semantics', () => {
  const failures: string[] = [];

  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    visitJsx(file, source, (node, sourceFile) => {
      const tag = tagName(node);
      if (tag !== 'TouchableOpacity' && tag !== 'Pressable') return;

      const at = location(file, node, sourceFile);
      if (!hasAttribute(node, 'onPress')) {
        failures.push(`${at} <${tag}> sem onPress`);
      }
      if (literalAttributeValue(node, 'accessibilityRole') !== 'button') {
        failures.push(`${at} <${tag}> sem accessibilityRole="button"`);
      }
    });
  }

  expect(failures).toEqual([]);
});

test('O21A raw Text/View/Icon elements are not hidden click targets', () => {
  const failures: string[] = [];

  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    visitJsx(file, source, (node, sourceFile) => {
      const tag = tagName(node);
      if (!['Text', 'View', 'Ionicons'].includes(tag)) return;
      if (!hasAttribute(node, 'onPress')) return;
      failures.push(
        `${location(file, node, sourceFile)} <${tag}> com onPress bruto`,
      );
    });
  }

  expect(failures).toEqual([]);
});
