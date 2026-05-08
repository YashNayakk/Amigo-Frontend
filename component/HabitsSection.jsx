import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HabitEndpoints } from '../services/apis';

const { width } = Dimensions.get('window');

const T = {
  bg: '#080808',
  surface: '#101010',
  raised: '#181818',
  border: '#1e1e1e',
  hi: '#2a2a2a',
  text: '#efefef',
  mid: '#888',
  dim: '#444',
  white: '#ffffff',
  black: '#000000',
};

const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
};

const getLast3Days = () => {
  const days = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: toLocalDateStr(d),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }
  return days;
};

const normalizeDate = (d) => toLocalDateStr(new Date(d));

const TypeCard = ({ icon, title, desc, onPress }) => (
  <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.75}>
    <View style={tc.iconWrap}>
      <Icon name={icon} size={22} color={T.mid} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={tc.title}>{title}</Text>
      <Text style={tc.desc}>{desc}</Text>
    </View>
    <Icon name="chevron-forward" size={14} color={T.dim} />
  </TouchableOpacity>
);
const tc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderRadius: 14, marginBottom: 10 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  title: { color: T.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  desc: { color: T.mid, fontSize: 12, lineHeight: 17 },
});

const RadioRow = ({ label, selected, onPress }) => (
  <TouchableOpacity style={rr.row} onPress={onPress} activeOpacity={0.7}>
    <View style={[rr.dot, selected && rr.dotOn]}>
      {selected && <View style={rr.dotInner} />}
    </View>
    <Text style={[rr.label, selected && rr.labelOn]}>{label}</Text>
  </TouchableOpacity>
);
const rr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderRadius: 10, marginRight: 10 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.dim, alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderColor: T.white },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.white },
  label: { color: T.mid, fontSize: 13, fontWeight: '600' },
  labelOn: { color: T.text },
});

const DayCell = ({ habit, day, onPress }) => {
  const log = habit?.logs?.find(l => normalizeDate(l.date) === day.date);

  if (!log) {
    return (
      <TouchableOpacity style={dc.empty} onPress={onPress} activeOpacity={0.7}>
        <Icon name="add" size={14} color={T.dim} />
      </TouchableOpacity>
    );
  }

  const isYesNo = habit.type === 'yesno';
  const done = isYesNo ? log.completed : true;

  return (
    <TouchableOpacity
      style={[dc.cell, done ? dc.cellDone : dc.cellFail]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {isYesNo ? (
        <Icon name={done ? 'checkmark' : 'close'} size={14} color={done ? T.black : T.white} />
      ) : (
        <Text style={[dc.measVal, { color: T.black }]} numberOfLines={1}>{log.value}</Text>
      )}
    </TouchableOpacity>
  );
};
const dc = StyleSheet.create({
  empty: { width: 38, height: 38, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  cell: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellDone: { backgroundColor: T.white },
  cellFail: { backgroundColor: T.hi, borderWidth: 1, borderColor: T.border },
  measVal: { fontSize: 10, fontWeight: '800', letterSpacing: -0.3 },
});

export default function HabitsScreen() {
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [habitType, setHabitType] = useState(null);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [creating, setCreating] = useState(false);
  const [logValue, setLogValue] = useState('');

  const [form, setForm] = useState({
    name: '', frequency: 'daily', description: '',
    question: '', unit: '', target: '', targetType: 'at_least',
  });

  const [days] = useState(() => getLast3Days());

  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(HabitEndpoints.GET_ALL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHabits(await res.json());
    } catch (e) {
      console.error(e);

    }
    finally { setLoading(false); }
  };

  const openType = () => setShowTypeModal(true);

  const selectType = (type) => {
    setHabitType(type);
    setShowTypeModal(false);
    setForm({ name: '', frequency: 'daily', description: '', question: '', unit: '', target: '', targetType: 'at_least' });
    setShowFormModal(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const payload = {
        name: form.name, type: habitType, frequency: form.frequency,
        description: form.description, question: form.question,
        ...(habitType === 'measurable' && {
          unit: form.unit,
          target: parseFloat(form.target) || 0,
          targetType: form.targetType,
        }),
      };
      const res = await fetch(HabitEndpoints.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setShowFormModal(false); loadHabits(); }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };
  const openLog = (habit, day) => {
    setSelectedHabit(habit);
    setSelectedDay(day);
    setLogValue('');
    setShowLogModal(true);
  };

  const handleLog = async (value) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(HabitEndpoints.COMPLETE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ habitId: selectedHabit._id, date: selectedDay.date, value, completed: value }),
      });
      setShowLogModal(false);
      loadHabits();
    } catch (e) { console.error(e); }
  };

  return (
    <SafeAreaView style={s.wrap}>

      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>TRACKING</Text>
          <Text style={s.headerTitle}>My Habits</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openType} activeOpacity={0.8}>
          <Icon name="add" size={16} color={T.black} />
          <Text style={s.addBtnText}>New Habit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.tableHead}>
          <View style={{ flex: 1 }} />
          {days.map(d => (
            <View key={d.date} style={s.dayHeadCol}>
              <Text style={s.dayHeadName}>{d.dayName.toUpperCase()}</Text>
              <View style={s.dayHeadNum}>
                <Text style={s.dayHeadNumText}>{d.dayNum}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.divider} />

        {loading ? (
          <View style={s.emptyState}>
            <ActivityIndicator color={T.mid} />
          </View>
        ) : habits.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyRing}>
              <Icon name="repeat-outline" size={28} color={T.mid} />
            </View>
            <Text style={s.emptyTitle}>No habits yet</Text>
            <Text style={s.emptyDesc}>Tap "New Habit" to start building your streak</Text>
          </View>
        ) : habits.map((habit) => (
          <View key={habit._id}>
            <View style={s.habitRow}>
              {/* Name col */}
              <View style={s.habitInfo}>
                <Text style={s.habitName} numberOfLines={1}>{habit.name}</Text>
                <View style={s.habitMeta}>
                  <View style={s.habitTypePill}>
                    <Text style={s.habitTypePillText}>
                      {habit.type === 'yesno' ? 'YES / NO' : `${habit.target} ${habit.unit}`.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.habitFreq}>{habit.frequency}</Text>
                </View>
              </View>

              {days.map(day => (
                <View key={day.date} style={s.dayCell}>
                  <DayCell habit={habit} day={day} onPress={() => openLog(habit, day)} />
                </View>
              ))}
            </View>
            <View style={s.rowDivider} />
          </View>
        ))}

      </ScrollView>

      <Modal visible={showTypeModal} transparent animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />
            <Text style={s.sheetTitle}>Choose type</Text>
            <Text style={s.sheetDesc}>How do you want to track this habit?</Text>

            <TypeCard
              icon="checkmark-circle-outline"
              title="Yes / No"
              desc="Simple done-or-not tracking"
              onPress={() => selectType('yesno')}
            />
            <TypeCard
              icon="stats-chart-outline"
              title="Measurable"
              desc="Track amounts — reps, minutes, km…"
              onPress={() => selectType('measurable')}
            />

            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowTypeModal(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showFormModal} transparent animationType="slide" onRequestClose={() => setShowFormModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.overlay}>
            <View style={[s.sheet, s.sheetTall]}>
              <View style={s.sheetPill} />

              {/* Sheet header */}
              <View style={s.sheetHeader}>
                <View>
                  <Text style={s.eyebrow}>{habitType === 'yesno' ? 'YES / NO' : 'MEASURABLE'}</Text>
                  <Text style={s.sheetTitle}>New Habit</Text>
                </View>
                <TouchableOpacity style={s.iconBtn} onPress={() => setShowFormModal(false)}>
                  <Icon name="close" size={16} color={T.mid} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <ScrollView
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 8 }}
                >

                  {/* Name */}
                  <View style={s.fieldBox}>
                    <Text style={s.fieldLabel}>HABIT NAME</Text>
                    <TextInput
                      style={s.field}
                      value={form.name}
                      onChangeText={v => setForm({ ...form, name: v })}
                      placeholder="e.g. Morning meditation…"
                      placeholderTextColor={T.dim}
                      autoFocus
                    />
                  </View>

                  {/* Measurable fields */}
                  {habitType === 'measurable' && (
                    <>
                      <View style={s.fieldRow}>
                        <View style={[s.fieldBox, { flex: 1 }]}>
                          <Text style={s.fieldLabel}>TARGET</Text>
                          <TextInput
                            style={s.field}
                            value={form.target}
                            onChangeText={v => setForm({ ...form, target: v })}
                            placeholder="30"
                            placeholderTextColor={T.dim}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={[s.fieldBox, { flex: 1, marginLeft: 10 }]}>
                          <Text style={s.fieldLabel}>UNIT</Text>
                          <TextInput
                            style={s.field}
                            value={form.unit}
                            onChangeText={v => setForm({ ...form, unit: v })}
                            placeholder="minutes"
                            placeholderTextColor={T.dim}
                          />
                        </View>
                      </View>

                      <View style={s.fieldBox}>
                        <Text style={s.fieldLabel}>TARGET TYPE</Text>
                        <View style={{ flexDirection: 'row', marginTop: 2 }}>
                          <RadioRow label="At least" selected={form.targetType === 'at_least'} onPress={() => setForm({ ...form, targetType: 'at_least' })} />
                          <RadioRow label="At most" selected={form.targetType === 'at_most'} onPress={() => setForm({ ...form, targetType: 'at_most' })} />
                        </View>
                      </View>
                    </>
                  )}

                  {/* Frequency */}
                  <View style={s.fieldBox}>
                    <Text style={s.fieldLabel}>FREQUENCY</Text>
                    <View style={{ flexDirection: 'row', marginTop: 2 }}>
                      <RadioRow label="Daily" selected={form.frequency === 'daily'} onPress={() => setForm({ ...form, frequency: 'daily' })} />
                      <RadioRow label="Weekly" selected={form.frequency === 'weekly'} onPress={() => setForm({ ...form, frequency: 'weekly' })} />
                    </View>
                  </View>

                  {/* Description */}
                  <View style={s.fieldBox}>
                    <Text style={s.fieldLabel}>DESCRIPTION</Text>
                    <TextInput
                      style={[s.field, { height: 72, textAlignVertical: 'top' }]}
                      value={form.description}
                      onChangeText={v => setForm({ ...form, description: v })}
                      placeholder="Why is this habit important to you?"
                      placeholderTextColor={T.dim}
                      multiline
                    />
                  </View>

                  {/* Question */}
                  <View style={s.fieldBox}>
                    <Text style={s.fieldLabel}>CUSTOM QUESTION <Text style={{ color: T.dim }}>— OPTIONAL</Text></Text>
                    <TextInput
                      style={s.field}
                      value={form.question}
                      onChangeText={v => setForm({ ...form, question: v })}
                      placeholder="e.g. Did I feel energized after?"
                      placeholderTextColor={T.dim}
                    />
                  </View>

                  <View style={{ height: 20 }} />
                </ScrollView>
              </View>
              {/* Bottom bar */}
              <View style={s.bar}>
                <TouchableOpacity style={s.barBack} onPress={() => setShowFormModal(false)}>
                  <Icon name="arrow-back" size={17} color={T.mid} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.barNext, (!form.name.trim() || creating) && s.barNextOff]}
                  disabled={!form.name.trim() || creating}
                  onPress={handleCreate}
                  activeOpacity={0.85}
                >
                  {creating
                    ? <ActivityIndicator color={T.black} size="small" />
                    : <>
                      <Text style={[s.barNextText, (!form.name.trim()) && s.barNextTextOff]}>Create Habit</Text>
                      {form.name.trim() && <Icon name="checkmark" size={15} color={T.black} style={{ marginLeft: 6 }} />}
                    </>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 12 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showLogModal} transparent animationType="slide" onRequestClose={() => setShowLogModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />

            {/* Context */}
            <View style={s.logContext}>
              <View style={s.logIconWrap}>
                <Icon name="pencil-outline" size={20} color={T.text} />
              </View>
              <View>
                <Text style={s.sheetTitle}>{selectedHabit?.name}</Text>
                <Text style={s.sheetDesc}>{selectedDay?.label}</Text>
              </View>
            </View>

            {selectedHabit?.type === 'yesno' ? (
              /* Yes / No buttons */
              <View style={s.yesNoRow}>
                <TouchableOpacity style={[s.yesNoBtn, s.yesBtn]} onPress={() => handleLog(true)} activeOpacity={0.85}>
                  <Icon name="checkmark" size={22} color={T.black} />
                  <Text style={s.yesBtnText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.yesNoBtn, s.noBtn]} onPress={() => handleLog(false)} activeOpacity={0.85}>
                  <Icon name="close" size={22} color={T.mid} />
                  <Text style={s.noBtnText}>Skipped</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Measurable input */
              <View style={s.fieldBox}>
                <Text style={s.fieldLabel}>ENTER VALUE</Text>
                <View style={s.measRow}>
                  <TextInput
                    style={[s.field, s.measInput]}
                    value={logValue}
                    onChangeText={setLogValue}
                    placeholder="0"
                    placeholderTextColor={T.dim}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <View style={s.unitBadge}>
                    <Text style={s.unitBadgeText}>{selectedHabit?.unit || 'units'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.barNext, { marginTop: 14, height: 50 }, !logValue && s.barNextOff]}
                  disabled={!logValue}
                  onPress={() => handleLog(parseFloat(logValue) || 0)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.barNextText, !logValue && s.barNextTextOff]}>Log Entry</Text>
                  {!!logValue && <Icon name="arrow-forward" size={15} color={T.black} style={{ marginLeft: 6 }} />}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.sheetCancelBtn} onPress={() => setShowLogModal(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  scroll: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.border },
  eyebrow: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  headerTitle: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.white, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  addBtnText: { color: T.black, fontSize: 13, fontWeight: '800', letterSpacing: -0.1 },

  // Table head
  tableHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  dayHeadCol: { width: 52, alignItems: 'center', gap: 4 },
  dayHeadName: { color: T.dim, fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  dayHeadNum: { width: 28, height: 28, borderRadius: 8, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  dayHeadNumText: { color: T.mid, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 20 },

  // Habit rows
  habitRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 0 },
  habitInfo: { flex: 1, paddingRight: 8 },
  habitName: { color: T.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginBottom: 5 },
  habitMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitTypePill: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  habitTypePillText: { color: T.dim, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  habitFreq: { color: T.dim, fontSize: 10, fontWeight: '500', textTransform: 'capitalize' },
  dayCell: { width: 52, alignItems: 'center' },
  rowDivider: { height: 1, backgroundColor: T.border, marginHorizontal: 20 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 72 },
  emptyRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: T.mid, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyDesc: { color: T.dim, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 32 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: T.border },
  sheetTall: { height: '90%', flexShrink: 1 },
  sheetPill: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: 'center', marginBottom: 24 },
  sheetIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  sheetTitle: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 4 },
  sheetDesc: { color: T.mid, fontSize: 13, lineHeight: 19, marginBottom:"2%" },
  sheetCancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  sheetCancelText: { color: T.mid, fontSize: 14, fontWeight: '500' },

  fieldBox: { marginBottom: 20, },
  fieldRow: { flexDirection: 'row' },
  fieldLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  field: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 12, padding: 14, color: T.text, fontSize: 15 },

  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },

  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
  barBack: { width: 48, height: 48, borderRadius: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  barNext: { width: '100%', height: 48, backgroundColor: T.white, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  barNextOff: { backgroundColor: T.raised },
  barNextText: { color: T.black, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  barNextTextOff: { color: T.dim },

  logContext: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  logIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },

  yesNoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  yesNoBtn: { flex: 1, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1 },
  yesBtn: { backgroundColor: T.white, borderColor: T.white },
  noBtn: { backgroundColor: T.raised, borderColor: T.border },
  yesBtnText: { color: T.black, fontSize: 13, fontWeight: '800' },
  noBtnText: { color: T.mid, fontSize: 13, fontWeight: '600' },

  measRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  measInput: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  unitBadge: { paddingHorizontal: 14, paddingVertical: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderRadius: 12 },
  unitBadgeText: { color: T.mid, fontSize: 13, fontWeight: '600' },
});