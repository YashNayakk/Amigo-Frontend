import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Modal, TextInput, ActivityIndicator,
  Alert, ScrollView, Image, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatEndpoints } from '../services/apis';
import { getSocket } from '../services/SocketService';
import AuthService from '../services/authService';

const T = {
  bg: '#080808', surface: '#101010', raised: '#181818',
  border: '#1e1e1e', hi: '#2a2a2a',
  text: '#efefef', mid: '#888', dim: '#444',
  white: '#ffffff', black: '#000000',
};

const SEG_LABELS = ['', 'Low', 'Fair', 'Good', 'High', 'Max'];

const SegmentBar = ({ level }) => (
  <View>
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <View key={n} style={{
          flex: 1, height: 2, borderRadius: 1,
          backgroundColor: n <= level ? T.white : T.hi,
        }} />
      ))}
    </View>
  </View>
);

const SegmentPicker = ({ value, onChange }) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n)}
          style={{
            flex: 1, height: 44, borderRadius: 8,
            backgroundColor: n <= value ? T.white : T.raised,
            borderWidth: 0.5, borderColor: n <= value ? T.white : T.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: n <= value ? T.black : T.dim }}>
            {n}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    {value > 0 && (
      <Text style={{ color: T.mid, fontSize: 12, fontWeight: '600' }}>
        {SEG_LABELS[value]}
      </Text>
    )}
  </View>
);

const fmtTime = str => {
  if (!str) return '';
  return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ActivityCard = React.memo(({ item }) => {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(anim, {
      toValue: open ? 0 : 1,
      useNativeDriver: true,
      friction: 9, tension: 60,
    }).start();
    setOpen(o => !o);
  };

  const level = item.satisfactionLevel || 0;
  const label = SEG_LABELS[level] || '';

  const frontOpacity = anim.interpolate({ inputRange: [0, 0.45, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity = anim.interpolate({ inputRange: [0, 0.45, 0.5, 1], outputRange: [0, 0, 1, 1] });
  const frontRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const senderInitial = (item.sender?.name || '?').charAt(0).toUpperCase();

  return (
    <TouchableOpacity activeOpacity={0.97} onPress={toggle} style={s.cardOuter}>

      <Animated.View style={[
        s.card,
        item.isMine && s.cardMine,
        { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: frontRot }] },
      ]}>
        <View style={s.cardSender}>
          {item.sender?.profilePicture
            ? <Image source={{ uri: item.sender.profilePicture }} style={s.cardAvatar} />
            : <View style={s.cardAvatarFb}><Text style={s.cardAvatarLetter}>{senderInitial}</Text></View>
          }
          <Text style={s.cardSenderName}>{item.sender?.name || 'User'}</Text>
          <Text style={s.cardSenderTime}>{fmtTime(item.timestamp || item.createdAt)}</Text>
        </View>

        <Text style={s.cardActivity}>{item.activityName}</Text>

        <View style={s.satRow}>
          <Text style={s.satNum}>{level}</Text>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.satLabel}>{label.toUpperCase()}</Text>
            <SegmentBar level={level} />
          </View>
        </View>

        <View style={s.dotsRow}>
          <View style={[s.dot, s.dotActive]} />
          <View style={s.dot} />
        </View>
      </Animated.View>

      <Animated.View style={[
        s.card, s.cardAbs,
        item.isMine && s.cardMine,
        { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: backRot }] },
      ]}>
        <Text style={s.backEyebrow}>NOTE</Text>

        {item.customMessage ? (
          <View style={s.backNote}>
            <Icon name="chatbubble-outline" size={13} color={T.dim} style={{ marginTop: 1 }} />
            <Text style={s.backNoteText}>{item.customMessage}</Text>
          </View>
        ) : (
          <View style={s.backNote}>
            <Text style={[s.backNoteText, { color: T.dim }]}>No note added.</Text>
          </View>
        )}

        <View style={{ gap: 6, marginTop: 14 }}>
          <View style={s.barHead}>
            <Text style={s.barLbl}>Satisfaction</Text>
            <Text style={s.barVal}>{level} · {label}</Text>
          </View>
          <SegmentBar level={level} />
        </View>

        <View style={s.backMeta}>
          <Text style={s.backTime}>{fmtTime(item.timestamp || item.createdAt)}</Text>
          <View style={s.closeHint}>
            <Icon name="chevron-up-outline" size={12} color={T.dim} />
            <Text style={s.closeHintTxt}>tap to close</Text>
          </View>
        </View>

        <View style={s.dotsRow}>
          <View style={s.dot} />
          <View style={[s.dot, s.dotActive]} />
        </View>
      </Animated.View>

    </TouchableOpacity>
  );
});

const CardSharingScreen = ({ route, navigation }) => {
  const { userId, userName, userAvatar } = route.params;

  const [cards, setCards] = useState([]);
  //const [chatId, setChatId] = useState(null);
  const [stats, setStats] = useState({ daysShared: 0, totalCardsSent: 0, cardsRemainingToday: 3 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting');

  const [activityName, setActivityName] = useState('');
  const [satisfactionLevel, setSatisfactionLevel] = useState(0);
  const [customMessage, setCustomMessage] = useState('');

  const socketRef = useRef(null);
  const chatIdRef = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      setLoading(true);
      await loadChat();
      if (!active) return;
      setLoading(false);

      const socket = await getSocket();
      if (!socket) return;
      socketRef.current = socket;

      if (chatIdRef.current) socket.emit('join:chat', { chatId: chatIdRef.current });

      socket.on('connect', () => {
        setWsStatus('connected');
        if (chatIdRef.current) socket.emit('join:chat', { chatId: chatIdRef.current });
      });
      socket.on('disconnect', () => setWsStatus('disconnected'));
      socket.on('card:received', ({ card, stats }) => {
        setCards(prev => prev.some(c => (c._id || c.id) === (card._id || card.id)) ? prev : [...prev, card]);
        if (stats) setStats(stats);
      });
      socket.on('stats:updated', ({ stats }) => setStats(stats));
    };

    init();
    return () => {
      active = false;
      socketRef.current?.off('connect');
      socketRef.current?.off('disconnect');
      socketRef.current?.off('card:received');
      socketRef.current?.off('stats:updated');
      if (chatIdRef.current)
        socketRef.current?.emit('leave:chat', { chatId: chatIdRef.current });
    };
  }, []);

  const loadChat = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(ChatEndpoints.GET_WITNESS_CHAT(userId), {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());

      if (res.success) {
        chatIdRef.current = res.data.chatId;
        setChatId(res.data.chatId);
        setCards(res.data.cards);
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('[loadChat]', err);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCard = async () => {
    if (!activityName.trim() || satisfactionLevel === 0) return;
    const currentChatId = chatIdRef.current;
    if (!currentChatId) { Alert.alert('Error', 'Chat not ready yet'); return; }

    setSending(true);
    const cardData = { chatId: currentChatId, activityName: activityName.trim(), satisfactionLevel, customMessage: customMessage.trim() };

    const timeout = setTimeout(async () => {
      console.warn('[sendCard] socket timeout, falling back to HTTP');
      await sendViaHttp(currentChatId, cardData);
    }, 5000);

    if (socketRef.current?.connected) {
      socketRef.current.emit('card:send', cardData, (res) => {
        clearTimeout(timeout);
        if (res?.success) handleCardSuccess({ card: res.card, stats: res.stats });
        else { Alert.alert('Error', res?.message || 'Failed'); setSending(false); }
      });
    } else {
      clearTimeout(timeout);
      await sendViaHttp(currentChatId, cardData);
    }
  };

  const sendViaHttp = async (currentChatId, cardData) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(ChatEndpoints.SEND_CARD(currentChatId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cardData),
      }).then(r => r.json());
      if (res.success) handleCardSuccess(res.data);
      else Alert.alert('Error', res.message || 'Failed');
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally { setSending(false); }
  };

  const handleCardSuccess = ({ card, stats }) => {
    setCards(prev => prev.some(c => (c._id || c.id) === (card._id || card.id)) ? prev : [...prev, card]);
    setStats(stats);
    setActivityName('');
    setSatisfactionLevel(0);
    setCustomMessage('');
    setShowModal(false);
    setSending(false);
  };

  const renderCard = useCallback(({ item }) => <ActivityCard item={item} />, []);

  if (loading) return (
    <View style={[s.wrap, s.center]}>
      <ActivityIndicator size="large" color={T.text} />
    </View>
  );

  return (
    <View style={s.wrap}>

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={17} color={T.mid} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          {userAvatar
            ? <Image source={{ uri: userAvatar }} style={s.headerAvatar} />
            : <View style={s.headerAvatarFb}><Text style={s.headerAvatarTxt}>{userName?.charAt(0)?.toUpperCase()}</Text></View>
          }
          <View>
            <Text style={s.headerName}>{userName}</Text>
            <Text style={s.headerSub}>{stats.daysShared} days shared</Text>
          </View>
        </View>
        <View style={[s.wsDot, wsStatus === 'connected' && s.wsDotOn, wsStatus === 'disconnected' && s.wsDotOff]} />
      </View>

      <View style={s.banner}>
        <View style={s.bannerCell}>
          <Text style={s.bannerVal}>{stats.totalCardsSent}</Text>
          <Text style={s.bannerLabel}>CARDS SENT</Text>
        </View>
        <View style={s.bannerDiv} />
        <View style={s.bannerCell}>
          <Text style={s.bannerVal}>{stats.cardsRemainingToday}</Text>
          <Text style={s.bannerLabel}>LEFT TODAY</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={cards}
        keyExtractor={item => item._id || item.id || String(Math.random())}
        renderItem={renderCard}
        contentContainerStyle={s.feedPad}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Icon name="layers-outline" size={26} color={T.mid} />
            </View>
            <Text style={s.emptyTitle}>No cards yet</Text>
            <Text style={s.emptySub}>Share your first activity below</Text>
          </View>
        }
      />

      {stats.cardsRemainingToday > 0 && (
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
            <Icon name="add" size={20} color={T.black} />
            <Text style={s.fabLabel}>Share Activity</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Share Activity</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name="close" size={20} color={T.mid} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>ACTIVITY</Text>
              <TextInput
                style={s.field}
                value={activityName}
                onChangeText={setActivityName}
                placeholder="What did you do?"
                placeholderTextColor={T.dim}
              />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>SATISFACTION</Text>
              <SegmentPicker value={satisfactionLevel} onChange={setSatisfactionLevel} />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>NOTE <Text style={{ color: T.dim }}>— optional</Text></Text>
              <TextInput
                style={[s.field, s.fieldArea]}
                value={customMessage}
                onChangeText={setCustomMessage}
                placeholder="Add context..."
                placeholderTextColor={T.dim}
                multiline
                maxLength={200}
              />
              <Text style={s.charCount}>{customMessage.length}/200</Text>

              <TouchableOpacity
                style={[s.sendBtn, (!activityName.trim() || satisfactionLevel === 0) && s.sendBtnOff]}
                onPress={handleSendCard}
                disabled={!activityName.trim() || satisfactionLevel === 0 || sending}>
                {sending
                  ? <ActivityIndicator size="small" color={T.black} />
                  : <Text style={s.sendBtnText}>Share Card</Text>}
              </TouchableOpacity>
              <View style={{ height: 36 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CardSharingScreen;

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: T.border, backgroundColor: T.surface,
  },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarFb: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.raised, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { color: T.text, fontSize: 13, fontWeight: '800' },
  headerName: { color: T.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { color: T.dim, fontSize: 11, marginTop: 1 },
  wsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.hi },
  wsDotOn: { backgroundColor: '#3a9e6a' },
  wsDotOff: { backgroundColor: '#9e3a3a' },

  banner: { flexDirection: 'row', backgroundColor: T.surface, borderBottomWidth: 0.5, borderBottomColor: T.border },
  bannerCell: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  bannerVal: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  bannerLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  bannerDiv: { width: 0.5, backgroundColor: T.border, marginVertical: 12 },

  feedPad: { padding: 14, paddingBottom: 100 },

  cardOuter: { marginBottom: 12, height: 180 },   // fixed height so back sits on top cleanly

  card: {
    position: 'absolute', width: '100%', height: 180,
    backgroundColor: T.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: T.border,
    padding: 16, backfaceVisibility: 'hidden',
  },
  cardAbs: {},
  cardMine: { borderLeftWidth: 2, borderLeftColor: T.hi },

  cardSender: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardAvatar: { width: 28, height: 28, borderRadius: 14 },
  cardAvatarFb: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.raised, borderWidth: 0.5, borderColor: T.hi, alignItems: 'center', justifyContent: 'center' },
  cardAvatarLetter: { color: T.mid, fontSize: 11, fontWeight: '800' },
  cardSenderName: { color: T.mid, fontSize: 12, fontWeight: '600' },
  cardSenderTime: { color: T.dim, fontSize: 11, marginLeft: 'auto' },

  cardActivity: { color: T.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.4, lineHeight: 24, marginBottom: 14, flex: 1 },

  satRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  satNum: { color: T.text, fontSize: 40, fontWeight: '900', letterSpacing: -2, lineHeight: 44 },
  satLabel: { color: T.mid, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },

  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 'auto', paddingTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.hi },
  dotActive: { backgroundColor: T.text, width: 14 },

  backEyebrow: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  backNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: T.raised, borderRadius: 10, padding: 11, marginBottom: 2 },
  backNoteText: { color: T.mid, fontSize: 13, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLbl: { color: T.mid, fontSize: 11 },
  barVal: { color: T.text, fontSize: 11, fontWeight: '700' },
  backMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  backTime: { color: T.dim, fontSize: 11 },
  closeHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  closeHintTxt: { color: T.dim, fontSize: 11 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.raised, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: T.mid, fontSize: 16, fontWeight: '700', marginBottom: 5 },
  emptySub: { color: T.dim, fontSize: 13 },

  fabWrap: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 16,
    backgroundColor: T.bg,
    borderTopWidth: 0.5, borderTopColor: T.border,
  },
  fab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.white, borderRadius: 30, paddingVertical: 14,
  },
  fabLabel: { color: T.black, fontSize: 14, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%', borderTopWidth: 0.5, borderColor: T.border },
  sheetPill: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  fieldLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  field: { backgroundColor: T.raised, borderWidth: 0.5, borderColor: T.hi, borderRadius: 12, padding: 13, color: T.text, fontSize: 14 },
  fieldArea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { color: T.dim, fontSize: 10, textAlign: 'right', marginTop: 4 },
  sendBtn: { backgroundColor: T.white, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  sendBtnOff: { backgroundColor: T.raised },
  sendBtnText: { color: T.black, fontSize: 15, fontWeight: '800' },
});