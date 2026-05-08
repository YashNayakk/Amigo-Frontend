import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Modal, TextInput, ActivityIndicator,
  Alert, ScrollView, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatEndpoints } from '../services/apis';
import { getSocket } from '../services/SocketService';

const T = {
  bg: '#080808', surface: '#101010', raised: '#181818',
  border: '#1e1e1e', hi: '#2a2a2a',
  text: '#efefef', mid: '#888', dim: '#444',
  white: '#ffffff', black: '#000000',
};

const SEG_LABELS = ['', 'Low', 'Fair', 'Good', 'High', 'Max'];

const SegmentBar = ({ level }) => (
  <View style={{ marginTop: 10 }}>
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <View key={n} style={{
          flex: 1, height: 4, borderRadius: 2,
          backgroundColor: n <= level ? T.white : T.hi,
        }} />
      ))}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
      <Text style={{ color: T.dim, fontSize: 10 }}>Low</Text>
      <Text style={{ color: T.mid, fontSize: 10, fontWeight: '700' }}>
        {level > 0 ? `${level} · ${SEG_LABELS[level]}` : '—'}
      </Text>
      <Text style={{ color: T.dim, fontSize: 10 }}>Max</Text>
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
            borderWidth: 0.5,
            borderColor: n <= value ? T.white : T.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{
            fontSize: 13, fontWeight: '800',
            color: n <= value ? T.black : T.dim,
          }}>{n}</Text>
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

const CardSharingScreen = ({ route, navigation }) => {
  const { userId, userName, userAvatar } = route.params;

  const [cards, setCards] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [stats, setStats] = useState({ daysShared: 0, totalCardsSent: 0, cardsRemainingToday: 3 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'

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
      const data = await loadChat();
      if (!active) return;
      setLoading(false);

      const socket = await getSocket();
      if (!socket) return;
      socketRef.current = socket;


      if (chatIdRef.current) {
        socket.emit('join:chat', { chatId: chatIdRef.current });
      }

      socket.on('connect', () => {
        setWsConnected(true);
        if (chatIdRef.current)
          socket.emit('join:chat', { chatId: chatIdRef.current });
      });

      socket.on('disconnect', () => setWsConnected(false));

      socket.on('card:received', ({ card, stats }) => {
        setCards(prev => {
          const exists = prev.some(c =>
            (c._id || c.id) === (card._id || card.id)
          );
          return exists ? prev : [...prev, card];
        });
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
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(ChatEndpoints.GET_WITNESS_CHAT(userId), {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());

      if (res.success) {
        chatIdRef.current = res.data.chatId;   // ← set ref immediately
        setChatId(res.data.chatId);
        setCards(res.data.cards);
        setStats(res.data.stats);
        return res.data.chatId;
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

    const currentChatId = chatIdRef.current;   // ← always use ref
    if (!currentChatId) {
      Alert.alert('Error', 'Chat not ready yet');
      return;
    }

    setSending(true);

    const cardData = {
      chatId: currentChatId,
      activityName: activityName.trim(),
      satisfactionLevel,
      customMessage: customMessage.trim(),
    };

    const timeout = setTimeout(async () => {
      console.warn('[sendCard] socket timed out, falling back to HTTP');
      await sendViaHttp(currentChatId, cardData);
    }, 5000);

    if (socketRef.current?.connected) {
      socketRef.current.emit('card:send', cardData, (res) => {
        clearTimeout(timeout);
        if (res?.success) {
          handleCardSuccess({ card: res.card, stats: res.stats });
        } else {
          Alert.alert('Error', res?.message || 'Failed to send card');
          setSending(false);
        }
      });
    } else {
      clearTimeout(timeout);
      await sendViaHttp(currentChatId, cardData);
    }
  };

  const sendViaHttp = async (currentChatId, cardData) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(ChatEndpoints.SEND_CARD(currentChatId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cardData),
      }).then(r => r.json());

      if (res.success) handleCardSuccess(res.data);
      else Alert.alert('Error', res.message || 'Failed to send card');
    } catch (err) {
      console.error('[sendCard HTTP]', err);
      Alert.alert('Error', 'Network error');
    } finally {
      setSending(false);
    }
  };

  const handleCardSuccess = ({ card, stats }) => {
    setCards(prev => {
      const exists = prev.some(c => (c._id || c.id) === (card._id || card.id));
      return exists ? prev : [...prev, card];
    });
    setStats(stats);
    setActivityName('');
    setSatisfactionLevel(0);
    setCustomMessage('');
    setShowModal(false);
    setSending(false);
  };

  const connectSocket = async (resolvedChatId) => {
    try {
      const socket = await getSocket();
      if (!socket) return;

      socketRef.current = socket;

      const onConnect = () => {
        setWsStatus('connected');
        socket.emit('join:chat', { chatId: resolvedChatId });
      };

      const onDisconnect = () => {
        setWsStatus('disconnected');
      };

      const onReconnect = () => {
        setWsStatus('connected');
        socket.emit('join:chat', { chatId: chatIdRef.current });
      };

      const onCardReceived = (data) => {
        setCards(prev => {

          const exists = prev.some(c => c._id === data.card._id || c.id === data.card.id);
          return exists ? prev : [...prev, data.card];
        });
        if (data.stats) setStats(data.stats);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      };

      const onStatsUpdated = (updatedStats) => {
        setStats(updatedStats);
      };

      // ── Register ──
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('reconnect', onReconnect);
      socket.on('card:sent', onCardReceived);
      socket.on('stats:updated', onStatsUpdated);


      if (socket.connected) {
        setWsStatus('connected');
        socket.emit('join:chat', { chatId: resolvedChatId });
      }


      socketRef._handlers = { onConnect, onDisconnect, onReconnect, onCardReceived, onStatsUpdated };

    } catch (err) {
      console.error('connectSocket:', err);
      setWsStatus('disconnected');
    }
  };

  const teardownSocket = () => {
    const socket = socketRef.current;
    if (!socket) return;

    const h = socketRef._handlers || {};
    socket.off('connect', h.onConnect);
    socket.off('disconnect', h.onDisconnect);
    socket.off('reconnect', h.onReconnect);
    socket.off('card:sent', h.onCardReceived);
    socket.off('stats:updated', h.onStatsUpdated);

    if (chatIdRef.current) {
      socket.emit('leave:chat', { chatId: chatIdRef.current });
    }
  };

  const resetForm = () => {
    setActivityName('');
    setSatisfactionLevel(0);
    setCustomMessage('');
    setShowModal(false);
  };

  const renderCard = useCallback(({ item }) => (
    <View style={[
      s.card,
      item.isMine ? s.myCard : s.theirCard,
    ]}>
      <View style={s.cardTop}>
        {item.sender?.profilePicture ? (
          <Image source={{ uri: item.sender.profilePicture }} style={s.cardAvatar} />
        ) : (
          <View style={s.cardAvatarFallback}>
            <Text style={s.cardAvatarText}>
              {item.sender?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={s.cardMeta}>
          <Text style={s.cardName}>{item.sender?.name || 'User'}</Text>
          <Text style={s.cardTime}>{fmtTime(item.timestamp || item.createdAt)}</Text>
        </View>
      </View>

      <View style={s.cardDivider} />
      <Text style={s.cardActivity}>{item.activityName}</Text>
      <SegmentBar level={item.satisfactionLevel} />

      {!!item.customMessage && (
        <View style={s.cardNote}>
          <Icon name="chatbubble-outline" size={11} color={T.dim} style={{ marginTop: 1 }} />
          <Text style={s.cardNoteText}>{item.customMessage}</Text>
        </View>
      )}
    </View>
  ), []);

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
          {userAvatar ? (
            <Image source={{ uri: userAvatar }} style={s.headerAvatar} />
          ) : (
            <View style={s.headerAvatarFallback}>
              <Text style={s.headerAvatarText}>{userName?.charAt(0)?.toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={s.headerName}>{userName}</Text>
            <Text style={s.headerSub}>{stats.daysShared} days shared</Text>
          </View>
        </View>

        <View style={s.wsIndicator}>
          <View style={[
            s.wsDot,
            wsStatus === 'connected' && s.wsDotOn,
            wsStatus === 'disconnected' && s.wsDotOff,
          ]} />
        </View>
      </View>

      <View style={s.banner}>
        <View style={s.bannerCell}>
          <Text style={s.bannerVal}>{stats.totalCardsSent}</Text>
          <Text style={s.bannerLabel}>Cards Sent</Text>
        </View>
        <View style={s.bannerDiv} />
        <View style={s.bannerCell}>
          <Text style={s.bannerVal}>{stats.cardsRemainingToday}</Text>
          <Text style={s.bannerLabel}>Left Today</Text>
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
            <Text style={s.emptySub}>Tap + to share your first activity</Text>
          </View>
        }
      />

      {stats.cardsRemainingToday > 0 && (
        <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Icon name="add" size={26} color={T.black} />
        </TouchableOpacity>
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
              <Text style={s.fieldLabel}>ACTIVITY NAME *</Text>
              <TextInput
                style={s.field}
                value={activityName}
                onChangeText={setActivityName}
                placeholder="What did you do today?"
                placeholderTextColor={T.dim}
              />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>SATISFACTION *</Text>
              <SegmentPicker value={satisfactionLevel} onChange={setSatisfactionLevel} />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>NOTE (optional)</Text>
              <TextInput
                style={[s.field, s.fieldArea]}
                value={customMessage}
                onChangeText={setCustomMessage}
                placeholder="Add a note..."
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
              <View style={{ height: 32 }} />
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
    borderBottomWidth: 1, borderBottomColor: T.border,
    backgroundColor: T.surface,
  },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: T.text, fontSize: 14, fontWeight: '800' },
  headerName: { color: T.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { color: T.dim, fontSize: 11, marginTop: 1 },

  wsIndicator: { width: 34, alignItems: 'center', justifyContent: 'center' },
  wsDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.hi },
  wsDotOn: { backgroundColor: '#3a9e6a' },
  wsDotOff: { backgroundColor: '#9e3a3a' },

  banner: { flexDirection: 'row', backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  bannerCell: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  bannerVal: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  bannerLabel: { color: T.dim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },
  bannerDiv: { width: 1, backgroundColor: T.border, marginVertical: 14 },

  feedPad: { padding: 16, paddingBottom: 110 },

  card: { backgroundColor: T.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: T.border },
  myCard: { borderColor: T.hi },
  theirCard: { borderColor: T.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  cardAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardAvatarText: { color: T.text, fontSize: 14, fontWeight: '800' },
  cardMeta: { flex: 1 },
  cardName: { color: T.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  cardTime: { color: T.dim, fontSize: 11, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: T.border, marginBottom: 12 },
  cardActivity: { color: T.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 },
  cardNoteText: { color: T.mid, fontSize: 13, fontStyle: 'italic', flex: 1, lineHeight: 18 },

  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: T.mid, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: T.dim, fontSize: 13 },

  fab: { position: 'absolute', bottom: 30, right: 24, width: 54, height: 54, borderRadius: 27, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%', borderTopWidth: 1, borderColor: T.border },
  sheetPill: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  fieldLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  field: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 12, padding: 13, color: T.text, fontSize: 14 },
  fieldArea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { color: T.dim, fontSize: 10, textAlign: 'right', marginTop: 4 },
  sendBtn: { backgroundColor: T.white, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  sendBtnOff: { backgroundColor: T.raised },
  sendBtnText: { color: T.black, fontSize: 15, fontWeight: '800' },
});