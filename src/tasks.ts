export type TaskFilter = 'all' | 'active' | 'completed';

export type Task = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
};

export function splitDictatedTasks(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/\s*(?:,|;|\.|\band then\b|\bthen\b|\band\b)\s*/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

export function extractJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function getGeminiOutputText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (typeof data?.outputText === 'string') return data.outputText;

  const textParts = data?.steps
    ?.flatMap((step: any) => step?.content ?? [])
    ?.filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
    ?.map((part: any) => part.text);

  return Array.isArray(textParts) ? textParts.join('\n').trim() : '';
}

export function getAudioMimeType(uri: string) {
  const lowerUri = uri.toLowerCase();
  if (lowerUri.endsWith('.mp3')) return 'audio/mp3';
  if (lowerUri.endsWith('.wav')) return 'audio/wav';
  if (lowerUri.endsWith('.aac')) return 'audio/aac';
  if (lowerUri.endsWith('.ogg')) return 'audio/ogg';
  if (lowerUri.endsWith('.flac')) return 'audio/flac';
  if (lowerUri.endsWith('.m4a')) return 'audio/m4a';
  return 'audio/m4a';
}

export function parseTaskTitlesFromGeminiText(outputText: string) {
  const jsonText = extractJsonObject(outputText);
  if (!jsonText) return splitDictatedTasks(outputText);

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed.tasks)) return splitDictatedTasks(outputText);

  return parsed.tasks
    .map((task: { title?: unknown }) => (typeof task.title === 'string' ? task.title.trim() : ''))
    .filter(Boolean);
}

export function filterAndSortTasks(tasks: Task[], query: string, filter: TaskFilter) {
  return tasks
    .filter((task) => {
      if (filter === 'active') return !task.completed;
      if (filter === 'completed') return task.completed;
      return true;
    })
    .filter((task) => `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}
