import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Dimensions, Modal, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WitnessEndpoints, CommitmentPodEndpoints } from '../services/apis';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const T = {
  bg:      '#080808', surface: '#101010', raised: '#181818',
  border:  '#1e1e1e', hi:      '#2a2a2a',
  text:    '#efefef', mid:     '#888',    dim:    '#444',
  white:   '#ffffff', black:   '#000000',
};

const TYPES = [
  { id: 'fitness',      label: 'Fitness',      sub: '& Health',    icon: 'barbell-outline'       },
  { id: 'learning',     label: 'Learning',     sub: '& Study',     icon: 'book-outline'          },
  { id: 'productivity', label: 'Focus',        sub: 'Deep Work',   icon: 'flash-outline'         },
  { id: 'habits',       label: 'Habits',       sub: 'Daily',       icon: 'repeat-outline'        },
  { id: 'creative',     label: 'Creative',     sub: 'Projects',    icon: 'brush-outline'         },
  { id: 'custom',       label: 'Custom',       sub: 'Your own',    icon: 'add-circle-outline'    },
];

const PERIODS = [
  { id: '7',      num: '7',  unit: 'DAYS', tag: 'One Week'          },
  { id: '14',     num: '14', unit: 'DAYS', tag: 'Two Weeks'         },
  { id: '21',     num: '21', unit: 'DAYS', tag: 'Habit Loop'        },
  { id: '30',     num: '30', unit: 'DAYS', tag: 'One Month'         },
  { id: '90',     num: '90', unit: 'DAYS', tag: 'Quarter'           },
  { id: 'custom', num: '∞',  unit: 'DAYS', tag: 'Custom'            },
];

const STEPS = ['Type', 'Duration', 'Witnesses', 'Rules'];

const CommitmentPod = () => {
  const navigation = useNavigation();

  const [step, setStep]                                   = useState(1);
  const [commitmentType, setCommitmentType]               = useState('');
  const [customType, setCustomType]                       = useState('');
  const [timePeriod, setTimePeriod]                       = useState('');
  const [customDays, setCustomDays]                       = useState('');
  const [availableWitnesses, setAvailableWitnesses]       = useState([]);
  const [selectedWitnesses, setSelectedWitnesses]         = useState([]);
  const [rules, setRules]                                 = useState(['']);
  const [showNameModal, setShowNameModal]                 = useState(false);
  const [podName, setPodName]                             = useState('');
  const [creating, setCreating]                           = useState(false);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(WitnessEndpoints.GET_CONNECTIONS, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res?.success) {
        setAvailableWitnesses((res.data || []).map(conn => ({
          _id:    conn?.user?._id || conn?.user?.id,
          name:   conn?.user?.name,
          avatar: conn?.user?.profilePicture,
        })));
      }
    } catch (err) { console.error('loadConnections:', err); }
  };

  const createPod = async () => {
    if (!podName.trim()) return;
    setCreating(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(CommitmentPodEndpoints.CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          podName:    podName.trim(),
          customType: commitmentType === 'custom' ? customType.trim() : commitmentType,
          TimePeriod: timePeriod === 'custom' ? customDays : timePeriod,
          witnesses:  selectedWitnesses.map(w => w._id || w.id),
          rules:      rules.filter(r => r.trim()),
        }),
      }).then(r => r.json());
      if (res?.success) { setShowNameModal(false); navigation.goBack(); }
      else console.error('createPod error:', res);
    } catch (err) { console.error('createPod:', err); }
    finally { setCreating(false); }
  };

  const toggleWitness = (w) => {
    const id = w._id || w.id;
    if (selectedWitnesses.find(x => (x._id || x.id) === id))
      setSelectedWitnesses(selectedWitnesses.filter(x => (x._id || x.id) !== id));
    else if (selectedWitnesses.length < 6)
      setSelectedWitnesses([...selectedWitnesses, w]);
  };
  const isSelected = id => !!selectedWitnesses.find(x => (x._id || x.id) === id);

  const addRule    = () => rules.length < 10 && setRules([...rules, '']);
  const updateRule = (i, v) => { const r = [...rules]; r[i] = v; setRules(r); };
  const removeRule = i => rules.length > 1 && setRules(rules.filter((_, idx) => idx !== i));

  const canProceed = () => {
    if (step === 1) return commitmentType && (commitmentType !== 'custom' || customType.trim());
    if (step === 2) return timePeriod && (timePeriod !== 'custom' || (customDays && parseInt(customDays) > 0));
    if (step === 3) return selectedWitnesses.length >= 2;
    if (step === 4) return rules.filter(r => r.trim()).length >= 1;
    return true;
  };

  const commitLabel = () => commitmentType === 'custom' ? customType
    : TYPES.find(t => t.id === commitmentType)?.label || '';
  const periodLabel = () => {
    if (timePeriod === 'custom') return `${customDays} Days`;
    const p = PERIODS.find(p => p.id === timePeriod);
    return p ? `${p.num} ${p.unit}` : '';
  };

  return (
    <SafeAreaView style={s.wrap}>

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={17} color={T.mid} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          <Text style={s.eyebrow}>COMMITMENT POD</Text>
          <Text style={s.headerTitle}>Create New</Text>
        </View>
        {/* Capsule progress */}
        <View style={s.capsuleWrap}>
          {[1,2,3,4].map(n => (
            <View key={n} style={[s.capsuleSeg, n < step && s.capsuleDone, n === step && s.capsuleActive]} />
          ))}
        </View>
      </View>

      <View style={s.tabRow}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done   = n < step;
          return (
            <View key={label} style={[s.tab, active && s.tabActive]}>
              <View style={[s.tabCircle, active && s.tabCircleActive, done && s.tabCircleDone]}>
                {done
                  ? <Icon name="checkmark" size={9} color={T.black} />
                  : <Text style={[s.tabNum, active && s.tabNumActive]}>{n}</Text>}
              </View>
              <Text style={[s.tabLabel, active && s.tabLabelActive, done && s.tabLabelDone]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollPad}>

        {step === 1 && (
          <View>
            <Text style={s.bigTitle}>What are you{'\n'}committing to?</Text>
            <Text style={s.desc}>Choose the category that best fits your goal</Text>
            <View style={s.typeGrid}>
              {TYPES.map(type => {
                const on = commitmentType === type.id;
                return (
                  <TouchableOpacity key={type.id} activeOpacity={0.75}
                    style={[s.typeCard, on && s.typeCardOn]}
                    onPress={() => setCommitmentType(type.id)}>
                    <View style={[s.typeIcon, on && s.typeIconOn]}>
                      <Icon name={type.icon} size={20} color={on ? T.black : T.mid} />
                    </View>
                    <Text style={[s.typeName, on && s.typeNameOn]}>{type.label}</Text>
                    <Text style={[s.typeSub, on && s.typeSubOn]}>{type.sub}</Text>
                    {on && <View style={s.typeCorner}><Icon name="checkmark" size={9} color={T.black} /></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
            {commitmentType === 'custom' && (
              <View style={s.fieldBox}>
                <Text style={s.fieldLabel}>YOUR COMMITMENT</Text>
                <TextInput style={s.field} value={customType} onChangeText={setCustomType}
                  placeholder="e.g. Read 20 pages daily..." placeholderTextColor={T.dim} autoFocus />
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={s.bigTitle}>Set your{'\n'}challenge window</Text>
            <Text style={s.desc}>Pick a duration that stretches you</Text>
            <View style={s.periodGrid}>
              {PERIODS.map(p => {
                const on = timePeriod === p.id;
                return (
                  <TouchableOpacity key={p.id} activeOpacity={0.75}
                    style={[s.periodCard, on && s.periodCardOn]}
                    onPress={() => setTimePeriod(p.id)}>
                    {on && <View style={s.periodActiveDot} />}
                    <Text style={[s.periodNum, on && s.periodNumOn]}>{p.num}</Text>
                    <Text style={[s.periodUnit, on && s.periodUnitOn]}>{p.unit}</Text>
                    <View style={[s.periodChip, on && s.periodChipOn]}>
                      <Text style={[s.periodChipText, on && s.periodChipTextOn]}>{p.tag}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {timePeriod === 'custom' && (
              <View style={s.fieldBox}>
                <Text style={s.fieldLabel}>NUMBER OF DAYS</Text>
                <TextInput style={s.field} value={customDays} onChangeText={setCustomDays}
                  placeholder="e.g. 45" placeholderTextColor={T.dim} keyboardType="numeric" autoFocus />
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={s.bigTitle}>Who holds{'\n'}you accountable?</Text>
            <Text style={s.desc}>Select witnesses from your connections</Text>

            <View style={s.wCounterRow}>
              <View style={s.wCounterLeft}>
                <Text style={s.wCounterBig}>{selectedWitnesses.length}</Text>
              </View>
              <View style={[s.wMinPill, selectedWitnesses.length >= 2 && s.wMinPillOn]}>
                <Icon name={selectedWitnesses.length >= 2 ? 'shield-checkmark' : 'shield-outline'}
                  size={11} color={selectedWitnesses.length >= 2 ? T.black : T.mid} />
                <Text style={[s.wMinText, selectedWitnesses.length >= 2 && s.wMinTextOn]}>
                  {selectedWitnesses.length >= 2 ? 'Minimum met' : 'Min. 2 required'}
                </Text>
              </View>
            </View>

            {selectedWitnesses.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.selStrip}>
                {selectedWitnesses.map((w, i) => (
                  <TouchableOpacity key={w._id || w.id} style={s.selChip} onPress={() => toggleWitness(w)}>
                    <View style={s.selChipAvatar}>
                      <Text style={s.selChipInitial}>{w.name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <Text style={s.selChipName} numberOfLines={1}>{w.name?.split(' ')[0]}</Text>
                    <Icon name="close-circle" size={14} color={T.dim} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {availableWitnesses.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyRing}>
                  <Icon name="people-outline" size={26} color={T.mid} />
                </View>
                <Text style={s.emptyTitle}>No connections yet</Text>
                <Text style={s.emptyDesc}>Connect with people first to add them as witnesses</Text>
              </View>
            ) : availableWitnesses.map(w => {
              const wid = w._id || w.id;
              const sel = isSelected(wid);
              const dis = !sel && selectedWitnesses.length >= 6;
              return (
                <TouchableOpacity key={wid} activeOpacity={0.8}
                  style={[s.wRow, sel && s.wRowOn, dis && s.wRowDis]}
                  onPress={() => toggleWitness(w)} disabled={dis}>
                  <View style={[s.wAvatar, sel && s.wAvatarOn]}>
                    <Text style={[s.wInitial, sel && s.wInitialOn]}>
                      {w.name?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={s.wMeta}>
                    <Text style={[s.wName, sel && s.wNameOn]}>{w.name}</Text>
                    <Text style={s.wRole}>Connection</Text>
                  </View>
                  <View style={[s.wToggle, sel && s.wToggleOn]}>
                    <Icon name={sel ? 'checkmark' : 'add'} size={14}
                      color={sel ? T.black : T.mid} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={s.bigTitle}>Set the ground{'\n'}rules</Text>
            <Text style={s.desc}>Define what staying committed looks like</Text>

            {rules.map((rule, i) => (
              <View key={i} style={s.ruleRow}>
                <View style={s.ruleIdx}>
                  <Text style={s.ruleIdxText}>{String(i+1).padStart(2,'0')}</Text>
                </View>
                <TextInput style={s.ruleField} value={rule}
                  onChangeText={t => updateRule(i, t)}
                  placeholder={`Rule ${i + 1}...`} placeholderTextColor={T.dim}
                  multiline />
                {rules.length > 1 && (
                  <TouchableOpacity style={s.ruleTrash} onPress={() => removeRule(i)}>
                    <Icon name="trash-outline" size={14} color={T.dim} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {rules.length < 10 && (
              <TouchableOpacity style={s.addRule} onPress={addRule}>
                <Icon name="add" size={15} color={T.mid} />
                <Text style={s.addRuleText}>Add rule</Text>
              </TouchableOpacity>
            )}

            <View style={s.summaryCard}>
              <View style={s.summaryTop}>
                <Icon name="document-text-outline" size={12} color={T.mid} />
                <Text style={s.summaryTopLabel}>SUMMARY</Text>
              </View>
              {[
                ['Commitment', commitLabel()],
                ['Duration',   periodLabel()],
                ['Witnesses',  `${selectedWitnesses.length} people`],
                ['Rules',      `${rules.filter(r=>r.trim()).length} rules`],
              ].map(([lbl, val], i, arr) => (
                <View key={lbl} style={[s.summaryRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.summaryLbl}>{lbl}</Text>
                  <Text style={s.summaryVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      <View style={s.bar}>
        {step > 1
          ? <TouchableOpacity style={s.barBack} onPress={() => setStep(step - 1)}>
              <Icon name="arrow-back" size={17} color={T.mid} />
            </TouchableOpacity>
          : <View/>}
        <TouchableOpacity
          style={[s.barNext, !canProceed() && s.barNextOff]}
          disabled={!canProceed()}
          onPress={() => step === 4 ? setShowNameModal(true) : setStep(step + 1)}
          activeOpacity={0.85}>
          <Text style={[s.barNextText, !canProceed() && s.barNextTextOff]}>
            {step === 4 ? 'Create Pod' : 'Continue'}
          </Text>
          {canProceed() && (
            <Icon name={step === 4 ? 'rocket-outline' : 'arrow-forward'} size={15}
              color={T.black} style={{ marginLeft: 6 }} />
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showNameModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />
            <View style={s.sheetIcon}>
              <Icon name="rocket-outline" size={24} color={T.text} />
            </View>
            <Text style={s.sheetTitle}>Name your pod</Text>
            <Text style={s.sheetDesc}>Something your witnesses will instantly recognise</Text>
            <View style={s.fieldBox}>
              <Text style={s.fieldLabel}>POD NAME</Text>
              <TextInput style={s.field} value={podName} onChangeText={setPodName}
                placeholder="e.g. Morning Run Squad..." placeholderTextColor={T.dim} autoFocus />
            </View>
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.sheetCancel} onPress={() => setShowNameModal(false)}>
                <Text style={s.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sheetLaunch, (!podName.trim() || creating) && s.sheetLaunchOff]}
                onPress={createPod} disabled={!podName.trim() || creating}>
                {creating
                  ? <ActivityIndicator color={T.black} size="small" />
                  : <Text style={s.sheetLaunchText}>Create Pod</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ height: 28 }} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default CommitmentPod;

const CARD = (width - 48 - 10) / 2;
const PCOL = (width - 48 - 20) / 3;

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  iconBtn:     { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  eyebrow:     { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  headerTitle: { color: T.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.5 },
  capsuleWrap: { flexDirection: 'row', gap: 4 },
  capsuleSeg:  { width: 18, height: 4, borderRadius: 2, backgroundColor: T.border },
  capsuleActive:{ backgroundColor: T.white, width: 28 },
  capsuleDone: { backgroundColor: T.mid },

  tabRow:   { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border, gap: 0 },
  tab:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabActive:{ },
  tabCircle:     { width: 20, height: 20, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  tabCircleActive:{ backgroundColor: T.white, borderColor: T.white },
  tabCircleDone: { backgroundColor: T.white, borderColor: T.white },
  tabNum:        { color: T.dim, fontSize: 9, fontWeight: '800' },
  tabNumActive:  { color: T.black },
  tabLabel:      { color: T.dim, fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  tabLabelActive:{ color: T.text },
  tabLabelDone:  { color: T.mid },

  scroll:    { flex: 1 },
  scrollPad: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 140 },
  bigTitle:  { color: T.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, lineHeight: 36, marginBottom: 8 },
  desc:      { color: T.mid, fontSize: 13, lineHeight: 19, marginBottom: 28 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: CARD, borderRadius: 16, padding: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, position: 'relative' },
  typeCardOn: { backgroundColor: T.white, borderColor: T.white },
  typeIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: T.raised, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  typeIconOn: { backgroundColor: 'rgba(0,0,0,0.1)' },
  typeName:   { color: T.text, fontSize: 14, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  typeNameOn: { color: T.black },
  typeSub:    { color: T.mid, fontSize: 11 },
  typeSubOn:  { color: 'rgba(0,0,0,0.45)' },
  typeCorner: { position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 9, backgroundColor: T.black, alignItems: 'center', justifyContent: 'center' },

  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  periodCard: { width: PCOL, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  periodCardOn: { backgroundColor: T.white, borderColor: T.white },
  periodActiveDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: T.black },
  periodNum:  { color: T.text, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  periodNumOn:{ color: T.black },
  periodUnit: { color: T.dim, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  periodUnitOn:{ color: 'rgba(0,0,0,0.35)' },
  periodChip: { marginTop: 10, backgroundColor: T.raised, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  periodChipOn:{ backgroundColor: 'rgba(0,0,0,0.1)' },
  periodChipText:{ color: T.mid, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  periodChipTextOn:{ color: 'rgba(0,0,0,0.45)' },

  fieldBox:   { marginTop: 18 },
  fieldLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  field:      { backgroundColor: T.surface, borderWidth: 1, borderColor: T.hi, borderRadius: 12, padding: 14, color: T.text, fontSize: 15 },

  wCounterRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  wCounterLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  wCounterBig:  { color: T.text, fontSize: 40, fontWeight: '900', letterSpacing: -2 },
  wCounterOf:   { color: T.dim, fontSize: 20, fontWeight: '700' },
  wMinPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  wMinPillOn:   { backgroundColor: T.white, borderColor: T.white },
  wMinText:     { color: T.mid, fontSize: 11, fontWeight: '600' },
  wMinTextOn:   { color: T.black },

  selStrip: { marginBottom: 16 },
  selChip:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, marginRight: 8 },
  selChipAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.hi, alignItems: 'center', justifyContent: 'center' },
  selChipInitial:{ color: T.text, fontSize: 10, fontWeight: '800' },
  selChipName:   { color: T.text, fontSize: 12, fontWeight: '600', maxWidth: 60 },

  wRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, marginBottom: 8 },
  wRowOn:   { backgroundColor: T.white, borderColor: T.white },
  wRowDis:  { opacity: 0.28 },
  wAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: T.raised, alignItems: 'center', justifyContent: 'center' },
  wAvatarOn:{ backgroundColor: 'rgba(0,0,0,0.1)' },
  wInitial: { color: T.mid, fontSize: 18, fontWeight: '800' },
  wInitialOn:{ color: T.black },
  wMeta:    { flex: 1 },
  wName:    { color: T.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  wNameOn:  { color: T.black },
  wRole:    { color: T.dim, fontSize: 11, marginTop: 2 },
  wToggle:  { width: 30, height: 30, borderRadius: 15, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  wToggleOn:{ backgroundColor: T.black, borderColor: T.black },

  emptyState: { alignItems: 'center', paddingVertical: 56 },
  emptyRing:  { width: 70, height: 70, borderRadius: 35, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: T.mid, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyDesc:  { color: T.dim, fontSize: 13, textAlign: 'center', lineHeight: 18 },

  ruleRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  ruleIdx:   { width: 32, height: 32, borderRadius: 8, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  ruleIdxText:{ color: T.dim, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  ruleField: { flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, color: T.text, fontSize: 14, minHeight: 50, textAlignVertical: 'top' },
  ruleTrash: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  addRule:   { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: T.hi, borderRadius: 12, marginTop: 4 },
  addRuleText:{ color: T.mid, fontSize: 13, fontWeight: '500' },

  summaryCard: { marginTop: 28, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: 'hidden' },
  summaryTop:  { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  summaryTopLabel: { color: T.mid, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: T.border },
  summaryLbl:  { color: T.mid, fontSize: 13 },
  summaryVal:  { color: T.text, fontSize: 13, fontWeight: '700' },

  bar:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg },
  barBack:     { width: 48, height: 48, borderRadius: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  barNext:     { flex: 1, height: 48, backgroundColor: T.white, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  barNextOff:  { backgroundColor: T.raised },
  barNextText: { color: T.black, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  barNextTextOff:{ color: T.dim },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1, borderColor: T.border },
  sheetPill:   { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: 'center', marginBottom: 24 },
  sheetIcon:   { width: 56, height: 56, borderRadius: 28, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  sheetTitle:  { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center', marginBottom: 6 },
  sheetDesc:   { color: T.mid, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  sheetActions:{ flexDirection: 'row', gap: 10, marginTop: 8 },
  sheetCancel: { flex: 1, height: 50, backgroundColor: T.raised, borderRadius: 14, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText:{ color: T.mid, fontSize: 14, fontWeight: '600' },
  sheetLaunch: { flex: 2, height: 50, backgroundColor: T.white, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sheetLaunchOff:{ backgroundColor: T.raised },
  sheetLaunchText:{ color: T.black, fontSize: 15, fontWeight: '800' },
});