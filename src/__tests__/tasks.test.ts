import {
  filterAndSortTasks,
  getAudioMimeType,
  getGeminiOutputText,
  parseTaskTitlesFromGeminiText,
  splitDictatedTasks,
  Task,
} from '../tasks';

const tasks: Task[] = [
  {
    id: '1',
    title: 'Call mom',
    completed: false,
    createdAt: '2026-07-23T10:00:00.000Z',
    dueDate: '2026-07-25',
  },
  {
    id: '2',
    title: 'Buy provisions',
    completed: true,
    createdAt: '2026-07-23T10:01:00.000Z',
    dueDate: '2026-07-24',
  },
  {
    id: '3',
    title: 'Submit report',
    completed: false,
    createdAt: '2026-07-23T10:02:00.000Z',
  },
];

describe('task helpers', () => {
  it('splits natural dictated text into separate tasks', () => {
    expect(splitDictatedTasks('Buy provisions and call mom, then submit report.')).toEqual([
      'Buy provisions',
      'call mom',
      'submit report',
    ]);
  });

  it('extracts text from Gemini REST interaction steps', () => {
    expect(
      getGeminiOutputText({
        steps: [
          { type: 'thought' },
          { type: 'model_output', content: [{ type: 'text', text: '{"tasks":[{"title":"Call mom"}]}' }] },
        ],
      }),
    ).toBe('{"tasks":[{"title":"Call mom"}]}');
  });

  it('parses Gemini task JSON', () => {
    expect(parseTaskTitlesFromGeminiText('```json\n{"tasks":[{"title":"Buy provisions"},{"title":"Call mom"}]}\n```')).toEqual([
      'Buy provisions',
      'Call mom',
    ]);
  });

  it('filters and sorts tasks by due date', () => {
    expect(filterAndSortTasks(tasks, '', 'active').map((task) => task.title)).toEqual(['Call mom', 'Submit report']);
    expect(filterAndSortTasks(tasks, 'buy', 'all').map((task) => task.title)).toEqual(['Buy provisions']);
    expect(filterAndSortTasks(tasks, '', 'all').map((task) => task.title)).toEqual(['Buy provisions', 'Call mom', 'Submit report']);
  });

  it('detects supported audio MIME types', () => {
    expect(getAudioMimeType('file:///recording.M4A')).toBe('audio/m4a');
    expect(getAudioMimeType('file:///sample.mp3')).toBe('audio/mp3');
    expect(getAudioMimeType('file:///unknown')).toBe('audio/m4a');
  });
});
