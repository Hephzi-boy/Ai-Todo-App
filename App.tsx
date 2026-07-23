import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

type Task = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
};

type RootStackParamList = {
  Tasks: undefined;
  AddTask: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const TASKS_KEY = 'airlabs.todo.tasks.v1';

const light = {
  primary: '#0D9488',
  secondary: '#14B8A6',
  accent: '#EA580C',
  background: '#F0FDFA',
  surface: '#FFFFFF',
  surfaceAlt: '#E8F1F4',
  text: '#134E4A',
  muted: '#4B6B68',
  border: '#99F6E4',
  danger: '#DC2626',
};

const dark = {
  primary: '#2DD4BF',
  secondary: '#5EEAD4',
  accent: '#FB923C',
  background: '#082F2C',
  surface: '#134E4A',
  surfaceAlt: '#0F3F3B',
  text: '#F0FDFA',
  muted: '#B7D8D4',
  border: '#2A6F68',
  danger: '#F87171',
};

function splitDictatedTasks(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/\s*(?:,|;|\.|\band then\b|\bthen\b|\band\b)\s*/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function getGeminiOutputText(data: any) {
  if (typeof data?.output_text === 'string') return data.output_text;
  if (typeof data?.outputText === 'string') return data.outputText;

  const textParts = data?.steps
    ?.flatMap((step: any) => step?.content ?? [])
    ?.filter((part: any) => part?.type === 'text' && typeof part?.text === 'string')
    ?.map((part: any) => part.text);

  return Array.isArray(textParts) ? textParts.join('\n').trim() : '';
}

function getAudioMimeType(uri: string) {
  const lowerUri = uri.toLowerCase();
  if (lowerUri.endsWith('.mp3')) return 'audio/mp3';
  if (lowerUri.endsWith('.wav')) return 'audio/wav';
  if (lowerUri.endsWith('.aac')) return 'audio/aac';
  if (lowerUri.endsWith('.ogg')) return 'audio/ogg';
  if (lowerUri.endsWith('.flac')) return 'audio/flac';
  if (lowerUri.endsWith('.m4a')) return 'audio/m4a';
  return 'audio/m4a';
}

async function transcribeTasksWithGemini(uri: string) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');

  const base64Audio = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      input: [
        {
          type: 'text',
          text:
            'Transcribe this audio and extract to-do tasks. Return only valid JSON in this exact shape: {"tasks":[{"title":"Task title"}]}. Split multiple dictated tasks joined by words like "and", "then", pauses, commas, or separate sentences. Do not include markdown.',
        },
        {
          type: 'audio',
          data: base64Audio,
          mime_type: getAudioMimeType(uri),
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Gemini transcription failed');
  }

  const outputText = getGeminiOutputText(data);
  if (!outputText) {
    throw new Error('Gemini returned no transcript text. Try recording again with clearer audio.');
  }

  const jsonText = extractJsonObject(outputText);
  if (!jsonText) return splitDictatedTasks(outputText);

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed.tasks)) return splitDictatedTasks(outputText);

  return parsed.tasks
    .map((task: { title?: unknown }) => (typeof task.title === 'string' ? task.title.trim() : ''))
    .filter(Boolean);
}

function AppShell() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const colors = isDark ? dark : light;

  useEffect(() => {
    AsyncStorage.getItem(TASKS_KEY)
      .then((raw) => {
        if (raw) setTasks(JSON.parse(raw));
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [loaded, tasks]);

  const addTask = useCallback((title: string, description?: string, dueDate?: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return false;
    setTasks((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: cleanTitle,
        description: description?.trim() || undefined,
        dueDate: dueDate?.trim() || undefined,
        completed: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    return true;
  }, []);

  const addMany = useCallback((titles: string[]) => {
    const clean = titles.map((title) => title.trim()).filter(Boolean);
    if (!clean.length) return;
    setTasks((current) => [
      ...clean.map((title) => ({
        id: `${Date.now()}-${title}-${Math.random().toString(36).slice(2)}`,
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      })),
      ...current,
    ]);
  }, []);

  const toggleTask = (id: string) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const deleteTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator>
        <Stack.Screen name="Tasks" options={{ title: 'AirLabs Tasks' }}>
          {(props) => (
            <TaskListScreen
              {...props}
              tasks={tasks}
              colors={colors}
              isDark={isDark}
              setIsDark={setIsDark}
              addMany={addMany}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="AddTask" options={{ title: 'Add task' }}>
          {(props) => <AddTaskScreen {...props} colors={colors} addTask={addTask} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function TaskListScreen({ navigation, tasks, colors, isDark, setIsDark, addMany, toggleTask, deleteTask }: any) {
  const [query, setQuery] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task: Task) => `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  }, [query, tasks]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>Today</Text>
          <Text style={[styles.title, { color: colors.text }]}>{tasks.filter((task: Task) => !task.completed).length} open tasks</Text>
        </View>
        <View style={styles.themeRow}>
          <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.text} />
          <Switch value={isDark} onValueChange={setIsDark} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          placeholder="Search tasks"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search tasks"
        />
      </View>

      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No tasks yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>Add a task manually or use the voice button.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: item.completed ? 0.68 : 1 }]}>
            <Pressable onPress={() => toggleTask(item.id)} style={styles.checkButton} accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }}>
              <Ionicons name={item.completed ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={item.completed ? colors.primary : colors.muted} />
            </Pressable>
            <View style={styles.taskBody}>
              <Text style={[styles.taskTitle, { color: colors.text, textDecorationLine: item.completed ? 'line-through' : 'none' }]}>{item.title}</Text>
              {!!item.description && <Text style={[styles.taskDescription, { color: colors.muted }]}>{item.description}</Text>}
              {!!item.dueDate && <Text style={[styles.dueDate, { color: colors.accent }]}>Due {item.dueDate}</Text>}
            </View>
            <Pressable onPress={() => deleteTask(item.id)} style={styles.iconButton} accessibilityLabel={`Delete ${item.title}`}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        )}
      />

      <Pressable style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('AddTask')} accessibilityLabel="Add task">
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
      <Pressable style={[styles.voiceButton, { backgroundColor: colors.accent }]} onPress={() => setVoiceOpen(true)} accessibilityLabel="Add task by voice">
        <Ionicons name="mic" size={26} color="#FFFFFF" />
      </Pressable>
      <VoiceModal visible={voiceOpen} colors={colors} onClose={() => setVoiceOpen(false)} onTasks={addMany} />
    </SafeAreaView>
  );
}

function AddTaskScreen({ navigation, colors, addTask }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const submit = () => {
    if (!addTask(title, description, dueDate)) {
      Alert.alert('Task title required', 'Enter a title before saving.');
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Buy provisions" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Optional details" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Due date</Text>
      <TextInput value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD, optional" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Pressable onPress={submit} style={[styles.saveButton, { backgroundColor: colors.primary }]} accessibilityRole="button">
        <Ionicons name="save-outline" size={22} color="#FFFFFF" />
        <Text style={styles.saveText}>Save task</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function VoiceModal({ visible, colors, onClose, onTasks }: any) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Tap start and dictate one or more tasks.');

  const start = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to dictate tasks.');
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording: activeRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setStatus('Listening...');
    setRecording(activeRecording);
  };

  const stop = async () => {
    if (!recording) return;
    setBusy(true);
    setStatus('Processing audio with Gemini...');
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    try {
      if (!uri) throw new Error('Recording file unavailable');
      const tasks = await transcribeTasksWithGemini(uri);
      setTranscript(tasks.join('\n'));
      setStatus(tasks.length ? `${tasks.length} task${tasks.length === 1 ? '' : 's'} found. Review and add.` : 'No tasks found. Try again.');
    } catch (error) {
      setStatus('Transcription failed. You can type the transcript manually.');
      Alert.alert('Voice transcription unavailable', error instanceof Error ? error.message : 'Type the dictated text below, then add it as tasks.');
    } finally {
      setBusy(false);
    }
  };

  const addTranscript = () => {
    const parsed = transcript.includes('\n')
      ? transcript.split('\n').map((item) => item.trim()).filter(Boolean)
      : splitDictatedTasks(transcript);
    if (!parsed.length) {
      Alert.alert('No task text', 'Record or type at least one task.');
      return;
    }
    onTasks(parsed);
    setTranscript('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={[styles.modalPanel, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Voice input</Text>
          <Text style={[styles.modalCopy, { color: colors.muted }]}>Dictate naturally.</Text>
          <Text style={[styles.statusText, { color: colors.primary }]}>{status}</Text>
          <Pressable onPress={recording ? stop : start} disabled={busy} style={[styles.recordButton, { backgroundColor: recording ? colors.danger : colors.accent, opacity: busy ? 0.65 : 1 }]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={recording ? 'stop' : 'mic'} size={26} color="#FFFFFF" />}
            <Text style={styles.saveText}>{recording ? 'Stop listening' : 'Start listening'}</Text>
          </Pressable>
          <TextInput value={transcript} onChangeText={setTranscript} multiline placeholder="Transcript appears here" placeholderTextColor={colors.muted} style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} />
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.secondaryButton}><Text style={[styles.secondaryText, { color: colors.text }]}>Cancel</Text></Pressable>
            <Pressable onPress={addTranscript} style={[styles.primarySmall, { backgroundColor: colors.primary }]}><Text style={styles.saveText}>Add tasks</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  return <AppShell />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800' },
  themeRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { minHeight: 52, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 16, minHeight: 48 },
  listContent: { paddingTop: 18, paddingBottom: 120, flexGrow: 1 },
  emptyState: { flex: 1, minHeight: 320, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { marginTop: 14, fontSize: 22, fontWeight: '800' },
  emptyCopy: { marginTop: 6, fontSize: 15, textAlign: 'center' },
  taskCard: { minHeight: 82, borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  taskBody: { flex: 1 },
  taskTitle: { fontSize: 17, fontWeight: '700' },
  taskDescription: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  dueDate: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  addButton: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  voiceButton: { position: 'absolute', right: 88, bottom: 28, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '800', marginBottom: 8, marginTop: 16 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textArea: { minHeight: 112, textAlignVertical: 'top' },
  saveButton: { minHeight: 52, borderRadius: 8, marginTop: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  modalPanel: { borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, gap: 12 },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  modalCopy: { fontSize: 15, lineHeight: 22 },
  statusText: { fontSize: 14, fontWeight: '800' },
  recordButton: { minHeight: 56, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  secondaryButton: { minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '800' },
  primarySmall: { minHeight: 48, borderRadius: 8, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
});
