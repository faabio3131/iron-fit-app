import fs from 'node:fs';
import path from 'node:path';

test('Workout Studio details retain the HTTPS video action on the real Web workspace', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/web/CommercialWebApp.tsx'), 'utf8');
  expect(source).toContain("typeof entry.exercise?.videoUrl === 'string'");
  expect(source).toContain("entry.exercise.videoUrl");
  expect(source).toContain("label=\"Assistir vídeo do exercício\"");
  expect(source).toContain("Linking.openURL(entry.exercise.videoUrl)");
  expect(source).toContain("Não foi possível abrir o vídeo do exercício.");
});
