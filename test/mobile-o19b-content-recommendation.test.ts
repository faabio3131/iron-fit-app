import { getContentRecommendations } from '../src/services/ai';

const mockApi = jest.fn();

jest.mock('../src/services/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe('O19B governed AI content recommendation', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  test('normalizes only canonical HTTPS content returned by the backend', async () => {
    mockApi.mockResolvedValue({
      advisory: true,
      recommendations: [
        {
          exerciseId: '11111111-1111-4111-8111-111111111111',
          exerciseName: 'Supino reto',
          reason: 'Revise a execução antes da próxima série.',
          content: {
            kind: 'EXTERNAL_REFERENCE',
            url: 'https://www.youtube.com/watch?v=abc',
          },
        },
        {
          exerciseId: '22222222-2222-4222-8222-222222222222',
          exerciseName: 'Agachamento',
          reason: 'Conteúdo gerenciado elegível.',
          content: {
            kind: 'MANAGED_CONTENT',
            delivery: { url: 'https://cdn.example.com/signed/video' },
          },
        },
      ],
    });

    const result = await getContentRecommendations([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);

    expect(result.source).toBe('ai');
    expect(result.advisory).toBe(true);
    expect(result.recommendations).toEqual([
      expect.objectContaining({
        exerciseName: 'Supino reto',
        contentKind: 'EXTERNAL_REFERENCE',
        url: 'https://www.youtube.com/watch?v=abc',
      }),
      expect.objectContaining({
        exerciseName: 'Agachamento',
        contentKind: 'MANAGED_CONTENT',
        url: 'https://cdn.example.com/signed/video',
      }),
    ]);

    const call = mockApi.mock.calls[0];
    expect(call[0]).toBe('/me/ai/content-recommendations');
    const body = JSON.parse(String(call[2]?.body ?? '{}'));
    expect(body.exerciseIds).toHaveLength(2);
    expect(body.limit).toBe(4);
  });

  test('drops unsafe/non-canonical URLs and fails safe when AI is unavailable', async () => {
    mockApi.mockResolvedValueOnce({
      advisory: true,
      recommendations: [
        {
          exerciseId: '11111111-1111-4111-8111-111111111111',
          exerciseName: 'Supino reto',
          reason: 'Unsafe reference',
          content: { kind: 'EXTERNAL_REFERENCE', url: 'http://unsafe.example.com/video' },
        },
      ],
    });

    const unsafe = await getContentRecommendations([
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(unsafe.recommendations).toEqual([]);

    mockApi.mockRejectedValueOnce(new Error('provider unavailable'));
    const fallback = await getContentRecommendations([
      '11111111-1111-4111-8111-111111111111',
    ]);
    expect(fallback).toEqual(
      expect.objectContaining({
        source: 'fallback',
        advisory: true,
        recommendations: [],
        reason: 'AI_CONTENT_UNAVAILABLE',
      }),
    );
  });
});
