import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, Alert, Modal, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CommitmentPodEndpoints } from '../services/apis';
import { getSocket } from '../services/SocketService';
import AuthService from '../services/authService';

const T = {
  bg: '#080808', surface: '#101010', raised: '#181818',
  border: '#1e1e1e', hi: '#2a2a2a',
  text: '#efefef', mid: '#888', dim: '#444',
  white: '#ffffff', black: '#000000',
};

const fmtDate = str => {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtShort = str => {
  if (!str) return '';
  const diff = Math.floor((Date.now() - new Date(str)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
};
const statusColor = s => ({ accepted: T.white, pending: '#666', declined: '#333' }[s] || T.dim);

const SegmentBar = ({ level, size = 'md', style }) => {
  const heights = { sm: 4, md: 6, lg: 8 };
  const labels = ['', 'Low', 'Fair', 'Good', 'High', 'Max'];
  const h = heights[size] || 6;
  return (
    <View style={[{ width: '100%' }, style]}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <View key={n} style={{
            flex: 1, height: h, borderRadius: 2,
            backgroundColor: n <= level ? T.white : T.hi,
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ color: T.dim, fontSize: 10 }}>Low</Text>
        <Text style={{ color: T.mid, fontSize: 10, fontWeight: '700' }}>
          {level > 0 ? `${level} · ${labels[level]}` : '—'}
        </Text>
        <Text style={{ color: T.dim, fontSize: 10 }}>Max</Text>
      </View>
    </View>
  );
};

const PodDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { podId, podStatus } = route.params;

  const [loading, setLoading] = useState(true);
  const [pod, setPod] = useState(null);
  const [cards, setCards] = useState([]);
  const [myStatus, setMyStatus] = useState(podStatus);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [activityName, setActivityName] = useState('');
  const [satisfactionLevel, setSatisfactionLevel] = useState(0);
  const [customMessage, setCustomMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showStreaksModal, setShowStreaksModal] = useState(false);
  const [streaks, setStreaks] = useState([]);
  const [streaksLoading, setStreaksLoading] = useState(false);
  const [removingWitnessId, setRemovingWitnessId] = useState(null); // tracks which witness is being removed

  const isAdmin = myStatus === 'admin';

  const socketRef = useRef(null);
  const podIdRef = useRef(podId);

  useEffect(() => {
    let active = true;

    const init = async () => {
      await loadPod();
      if (!active) return;

      const socket = await getSocket();
      if (!socket) return;
      socketRef.current = socket;

      socket.emit('join:pod', { podId: podIdRef.current });

      socket.on('connect', () => {
        socket.emit('join:pod', { podId: podIdRef.current });
      });

      socket.on('pod:card:received', ({ card, stats }) => {
        setCards(prev => {
          const exists = prev.some(c => (c._id || c.id) === (card._id || card.id));
          return exists ? prev : [card, ...prev];   // newest first
        });
        if (stats?.totalCardsSent !== undefined) {
          setStats(prev => prev ? { ...prev, ...stats } : stats);
        }
      });
    };

    init();

    return () => {
      active = false;
      socketRef.current?.off('connect');
      socketRef.current?.off('pod:card:received');
      socketRef.current?.emit('leave:pod', { podId: podIdRef.current });
    };
  }, []);

  const handleShareCard = async () => {
    if (!activityName.trim() || satisfactionLevel === 0) return;
    setSubmitting(true);

    const cardData = {
      podId,
      activityName: activityName.trim(),
      satisfactionLevel,
      customMessage,
    };

    const timeout = setTimeout(async () => {
      console.warn('[pod:card:send] socket timed out, falling back to HTTP');
      await shareCardViaHttp();
    }, 5000);

    if (socketRef.current?.connected) {
      socketRef.current.emit('pod:card:send', cardData, (res) => {
        clearTimeout(timeout);
        if (res?.success) {
          handleShareSuccess();
        } else {
          Alert.alert('Error', res?.message || 'Failed to share card');
          setSubmitting(false);
        }
      });
    } else {
      clearTimeout(timeout);
      await shareCardViaHttp();
    }
  };

  const shareCardViaHttp = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(CommitmentPodEndpoints.SHARE_CARDS(podId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activityName, satisfactionLevel, customMessage }),
      }).then(r => r.json());

      if (res?.success) handleShareSuccess();
      else Alert.alert('Error', res?.error || 'Failed to share');
    } catch {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareSuccess = () => {
    setShowShareModal(false);
    setActivityName('');
    setSatisfactionLevel(0);
    setCustomMessage('');
    setSubmitting(false);
    loadCards();
    loadStats();
  };

  const loadPod = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');

      const res = await AuthService.authFetch(CommitmentPodEndpoints.GET_BY_ID(podId), {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());

      if (res?.success) {
        setPod(res?.pod);
        if (podStatus !== 'admin') {
          const myEntry = res.pod?.witnesses?.find(
            w => w?.user?._id?.toString() === userId || w?.user?.id?.toString() === userId
          );
          if (myEntry?.status) setMyStatus(myEntry?.status);
        }
        const effectiveStatus = podStatus === 'admin' ? 'admin' : (() => {
          const myEntry = res.pod?.witnesses?.find(
            w => w?.user?._id?.toString() === userId || w?.user?.id?.toString() === userId
          );
          return myEntry?.status || podStatus;
        })();
        if (effectiveStatus !== 'pending') {
          loadCards(token);
          loadStats(token);
        }
      }
    } catch (err) { console.error('loadPod:', err); }
    finally { setLoading(false); }
  };

  const loadCards = async (token) => {
    try {
      const t = token || await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(CommitmentPodEndpoints.SHARE_CARDS(podId), {
        headers: { Authorization: `Bearer ${t}` },
      }).then(r => r.json());
      if (res?.success) setCards(res?.cards || []);
    } catch (err) { console.error('loadCards:', err); }
  };

  const loadStats = async (token) => {
    try {
      const t = token || await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(CommitmentPodEndpoints.CARD_STATS(podId), {
        headers: { Authorization: `Bearer ${t}` },
      }).then(r => r.json());
      if (res?.success) setStats(res?.stats);
    } catch (err) { console.error('loadStats:', err); }
  };

  const loadStreaks = async () => {
    try {
      setStreaksLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(CommitmentPodEndpoints.STREAKS(podId), {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res?.success) setStreaks(res?.streaks || []);
    } catch (err) { console.error('loadStreaks:', err); }
    finally { setStreaksLoading(false); }
  };

  const handleOpenStreaks = () => {
    setShowStreaksModal(true);
    loadStreaks();
  };

  const handleDeletePod = () => {
    Alert.alert(
      'Delete Pod',
      'This will close the pod for all witnesses. The chat history will be preserved. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Pod',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const token = await AsyncStorage.getItem('token');
              const res = await AuthService.authFetch(CommitmentPodEndpoints.DELETE_POD(podId), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              }).then(r => r.json());
              if (res?.success) navigation.goBack();
              else Alert.alert('Error', res?.error || 'Failed to delete pod');
            } catch { Alert.alert('Error', 'Something went wrong'); }
            finally { setActionLoading(false); }
          },
        },
      ]
    );
  };

  const handleRemoveWitness = (witness) => {
    const name = witness?.user?.name || 'this witness';
    Alert.alert(
      'Remove Witness',
      `Remove ${name} from this pod? They will be notified and lose access to the chat.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const witnessUserId = witness?.user?._id || witness?.user?.id;
            try {
              setRemovingWitnessId(witnessUserId);
              const token = await AsyncStorage.getItem('token');
              const res = await AuthService.authFetch(CommitmentPodEndpoints.REMOVE_WITNESS(podId, witnessUserId), {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              }).then(r => r.json());
              if (res?.success) {

                setPod(prev => ({
                  ...prev,
                  witnesses: prev?.witnesses.map(w =>
                    (w?.user?._id || w?.user?.id) === witnessUserId
                      ? { ...w, status: 'removed' }
                      : w
                  ),
                }));
              } else {
                Alert.alert('Error', res?.error || 'Failed to remove witness');
              }
            } catch { Alert.alert('Error', 'Something went wrong'); }
            finally { setRemovingWitnessId(null); }
          },
        },
      ]
    );
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await AuthService.authFetch(CommitmentPodEndpoints.JOIN_POD(podId), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      if (res?.success) { setMyStatus('accepted'); loadCards(); loadStats(); }
      else Alert.alert('Error', res?.error || 'Failed to accept invite');
    } catch { Alert.alert('Error', 'Something went wrong'); }
    finally { setActionLoading(false); }
  };

  const handleDecline = () => {
    Alert.alert('Decline Invite', 'Are you sure you want to decline?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          try {
            setActionLoading(true);
            const token = await AsyncStorage.getItem('token');
            const res = await AuthService.authFetch(CommitmentPodEndpoints.DECLINE_POD(podId), {
              method: 'POST', headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json());
            if (res?.success) navigation.goBack();
          } catch { Alert.alert('Error', 'Something went wrong'); }
          finally { setActionLoading(false); }
        }
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Pod',
      'Are you sure you want to leave this pod? You will no longer be a witness.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const token = await AsyncStorage.getItem('token');
              const res = await AuthService.authFetch(CommitmentPodEndpoints.LEAVE(podId), {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
              }).then(r => r.json());
              if (res?.success) navigation.goBack();
              else Alert.alert('Error', res?.error || 'Failed to leave pod');
            } catch { Alert.alert('Error', 'Something went wrong'); }
            finally { setActionLoading(false); }
          },
        },
      ]
    );
  };
 

  if (loading) return (
    <View style={[s.wrap, s.center]}>
      <ActivityIndicator size="large" color={T.text} />
    </View>
  );

  if (myStatus === 'pending') return (
    <View style={s.wrap}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={17} color={T.mid} />
        </TouchableOpacity>
        <Text style={s.headerTitlePlain}>Pod Invite</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.inviteScroll} showsVerticalScrollIndicator={false}>
        <View style={s.inviteHero}>
          <View style={s.inviteRing}>
            <Icon name="shield-checkmark-outline" size={28} color={T.text} />
          </View>
          <Text style={s.inviteHeadline}>You're invited</Text>
          <Text style={s.inviteSubline}>Someone wants you to witness their commitment</Text>
        </View>

        <View style={s.podNameCard}>
          <Text style={s.podNameBig}>{pod?.podName || pod?.customType}</Text>
          {pod?.podName && <Text style={s.podCat}>{pod?.customType}</Text>}
        </View>

        <View style={s.statsRow}>
          {[
            { icon: 'time-outline', val: `${pod?.TimePeriod}d`, label: 'Duration' },
            { icon: 'people-outline', val: pod?.witnesses?.length, label: 'Witnesses' },
            { icon: 'calendar-outline', val: fmtShort(pod?.createdAt), label: 'Created' },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={s.statCell}>
                <Icon name={item.icon} size={14} color={T.mid} style={{ marginBottom: 6 }} />
                <Text style={s.statVal}>{item.val}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.statDiv} />}
            </React.Fragment>
          ))}
        </View>

        {pod?.rules?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>RULES</Text>
            {pod.rules.map((rule, i) => (
              <View key={i} style={s.ruleItem}>
                <View style={s.ruleNum}>
                  <Text style={s.ruleNumText}>{String(i + 1).padStart(2, '0')}</Text>
                </View>
                <Text style={s.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>WITNESSES</Text>
          {pod?.witnesses?.map((w, i) => (
            <View key={i} style={s.witnessRow}>
              <View style={s.wAvatar}>
                <Text style={s.wInitial}>{w?.user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
              <Text style={s.wName}>{w?.user?.name || 'User'}</Text>
              <View style={[s.statusPill, { borderColor: statusColor(w.status) }]}>
                <View style={[s.statusDot, { backgroundColor: statusColor(w.status) }]} />
                <Text style={[s.statusText, { color: statusColor(w.status) }]}>{w.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.inviteActions}>
          <TouchableOpacity style={s.declineBtn} onPress={handleDecline} disabled={actionLoading}>
            <Text style={s.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={handleAccept} disabled={actionLoading}>
            {actionLoading
              ? <ActivityIndicator size="small" color={T.black} />
              : <>
                <Icon name="shield-checkmark" size={16} color={T.black} style={{ marginRight: 6 }} />
                <Text style={s.acceptText}>Accept Invite</Text>
              </>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={s.wrap}>

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={17} color={T.mid} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.podHeaderName} numberOfLines={1}>{pod?.podName || pod?.customType}</Text>
          {pod?.podName && <Text style={s.podHeaderCat}>{pod?.customType}</Text>}
        </View>
        {isAdmin ? (
          <TouchableOpacity style={[s.iconBtn, s.iconBtnDanger]} onPress={handleDeletePod} disabled={actionLoading}>
            <Icon name="trash-outline" size={17} color="#ff6b6b" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.iconBtn} onPress={handleLeave} disabled={actionLoading}>
            <Icon name="exit-outline" size={17} color={T.mid} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.banner}>
        {[
          { val: pod?.TimePeriod, label: 'Days', icon: 'time-outline' },
          { val: pod?.witnesses?.length, label: 'Witnesses', icon: 'people-outline' },
          { val: cards.length, label: 'Cards', icon: 'layers-outline' },
          { val: stats?.avgSatisfaction ? stats.avgSatisfaction.toFixed(1) : '—', label: 'Avg ★', icon: 'star-outline' },
        ].map((stat, i, arr) => (
          <React.Fragment key={stat.label}>
            <View style={s.bannerCell}>
              <Text style={s.bannerVal}>{stat.val}</Text>
              <Text style={s.bannerLabel}>{stat.label}</Text>
            </View>
            {i < arr.length - 1 && <View style={s.bannerDiv} />}
          </React.Fragment>
        ))}
      </View>

      <TouchableOpacity style={s.streaksBar} onPress={handleOpenStreaks} activeOpacity={0.75}>
        <View style={s.streaksBarLeft}>
          <Text style={s.streaksBarLabel}>Pod Streaks</Text>
        </View>
        <Icon name="chevron-forward" size={14} color={T.dim} />
      </TouchableOpacity>

      <FlatList
        data={cards}
        keyExtractor={item => item._id || String(Math.random())}
        contentContainerStyle={s.feedPad}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {pod?.rules?.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {pod.rules.map((rule, i) => (
                  <View key={i} style={s.ruleChip}>
                    <Text style={s.ruleChipText}>{rule}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={s.witnessesSectionHeader}>
              <Text style={s.sectionLabel}>WITNESSES</Text>
            </View>
            {pod?.witnesses?.map((w, i) => {
              const wId = w?.user?._id || w?.user?.id;
              const isRemoving = removingWitnessId === wId;
              const isRemoved = w.status === 'removed' || w.status === 'left' || w.status === 'declined';
              return (
                <View key={i} style={[s.witnessRow, isRemoved && s.witnessRowDim]}>
                  <View style={s.wAvatar}>
                    <Text style={s.wInitial}>{w?.user?.name?.charAt(0)?.toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={s.wName}>{w?.user?.name || 'User'}</Text>
                  <View style={[s.statusPill, { borderColor: statusColor(w.status) }]}>
                    <View style={[s.statusDot, { backgroundColor: statusColor(w.status) }]} />
                    <Text style={[s.statusText, { color: statusColor(w.status) }]}>{w.status}</Text>
                  </View>
                  {isAdmin && !isRemoved && (
                    <TouchableOpacity
                      style={s.removeWitnessBtn}
                      onPress={() => handleRemoveWitness(w)}
                      disabled={isRemoving}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      {isRemoving
                        ? <ActivityIndicator size="small" color={T.dim} />
                        : <Icon name="close-circle-outline" size={18} color="#ff6b6b" />}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            <View style={s.feedDivider} />
            <Text style={[s.sectionLabel, { marginBottom: 12 }]}>ACTIVITY CARDS</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={s.cardAvatar}>
                <Text style={s.cardAvatarText}>
                  {item?.sender?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={s.cardMeta}>
                <Text style={s.cardName}>{item?.sender?.name || 'User'}</Text>
                <Text style={s.cardDate}>{fmtShort(item?.createdAt)}</Text>
              </View>
              <SegmentBar level={item.satisfactionLevel} />
            </View>
            <View style={s.cardDivider} />
            <Text style={s.cardActivity}>{item.activityName}</Text>
            <SegmentBar level={item.satisfactionLevel} size="sm" style={{ marginTop: 10 }} />
            {!!item.customMessage && (
              <View style={[s.cardNote, { marginTop: 10 }]}>
                <Icon name="chatbubble-outline" size={11} color={T.dim} style={{ marginTop: 1 }} />
                <Text style={s.cardNoteText}>{item.customMessage}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyFeed}>
            <View style={s.emptyFeedIcon}>
              <Icon name="layers-outline" size={26} color={T.mid} />
            </View>
            <Text style={s.emptyFeedTitle}>No cards yet</Text>
            <Text style={s.emptyFeedSub}>Tap + to share your first activity</Text>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowShareModal(true)} activeOpacity={0.85}>
        <Icon name="add" size={26} color={T.black} />
      </TouchableOpacity>

      <Modal visible={showStreaksModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Pod Streaks</Text>
              <TouchableOpacity onPress={() => setShowStreaksModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name="close" size={20} color={T.mid} />
              </TouchableOpacity>
            </View>
            <Text style={s.streaksSubtitle}>Post a card every day to keep your streak alive</Text>

            {streaksLoading ? (
              <View style={s.streaksLoading}>
                <ActivityIndicator size="large" color={T.text} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {streaks
                  .sort((a, b) => b.streak - a.streak) 
                  .map((member, i) => (
                    <View key={member.user._id} style={s.streakRow}>
                      <Text style={s.streakRank}>#{i + 1}</Text>

                      <View style={[s.streakAvatar, member.activeToday && s.streakAvatarActive]}>
                        <Text style={s.streakInitial}>
                          {member.user.name?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                      </View>

                      <View style={s.streakMeta}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.streakName}>{member.user.name}</Text>
                          {member.role === 'admin' && (
                            <View style={s.adminTag}>
                              <Text style={s.adminTagText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.streakCards}>{member.totalCards} cards total</Text>
                      </View>

                      <View style={s.streakRight}>
                        <View style={s.streakCountRow}>
                          <Text style={[s.streakCount, member.streak === 0 && { color: T.dim }]}>
                            {member.streak}
                          </Text>
                          <Text style={s.streakFire}>
                            {member.streak === 0 ? '💤' :
                              member.atRisk ? '⚠️' :
                                member.activeToday ? '🔥' : '🔥'}
                          </Text>
                        </View>
                        {member?.streak > 0 && (
                          <Text style={s.streakBest}>best {member.bestStreak}</Text>
                        )}
                        {member?.atRisk && (
                          <Text style={s.streakAtRisk}>at risk</Text>
                        )}
                      </View>
                    </View>
                  ))}
                {streaks?.length === 0 && (
                  <View style={s.streaksEmpty}>
                    <Text style={s.streaksEmptyText}>No streaks yet — share a card to start one!</Text>
                  </View>
                )}
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showShareModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetPill} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Share Activity</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name="close" size={20} color={T.mid} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>ACTIVITY NAME *</Text>
              <TextInput style={s.field} value={activityName} onChangeText={setActivityName}
                placeholder="What did you do today?" placeholderTextColor={T.dim} />

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>SATISFACTION *</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setSatisfactionLevel(n)}
                      style={{
                        flex: 1, height: 40, borderRadius: 6,
                        backgroundColor: n <= satisfactionLevel ? T.white : T.raised,
                        borderWidth: 0.5,
                        borderColor: n <= satisfactionLevel ? T.white : T.border,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Text style={{
                        fontSize: 12, fontWeight: '800',
                        color: n <= satisfactionLevel ? T.black : T.dim,
                      }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {satisfactionLevel > 0 && (
                  <Text style={s.starLabel}>
                    {['', 'Low', 'Fair', 'Good', 'High', 'Max'][satisfactionLevel]}
                  </Text>
                )}
              </View>

              <Text style={[s.fieldLabel, { marginTop: 20 }]}>NOTE (optional)</Text>
              <TextInput style={[s.field, s.fieldArea]} value={customMessage}
                onChangeText={setCustomMessage} placeholder="Add a note..."
                placeholderTextColor={T.dim} multiline maxLength={200} />
              <Text style={s.charCount}>{customMessage.length}/200</Text>

              <TouchableOpacity
                style={[s.shareBtn, (!activityName.trim() || satisfactionLevel === 0) && s.shareBtnOff]}
                onPress={handleShareCard}
                disabled={!activityName.trim() || satisfactionLevel === 0 || submitting}>
                {submitting
                  ? <ActivityIndicator size="small" color={T.black} />
                  : <Text style={s.shareBtnText}>Share Card</Text>}
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PodDetailScreen;

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { borderColor: '#3a1a1a', backgroundColor: '#1a0808' },
  headerTitlePlain: { color: T.text, fontSize: 17, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  podHeaderName: { color: T.text, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  podHeaderCat: { color: T.dim, fontSize: 11, marginTop: 2, letterSpacing: 0.3 },

  
  banner: { flexDirection: 'row', backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  bannerCell: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  bannerVal: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  bannerLabel: { color: T.dim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },
  bannerDiv: { width: 1, backgroundColor: T.border, marginVertical: 14 },

  streaksBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border },
  streaksBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streaksBarEmoji: { fontSize: 16 },
  streaksBarLabel: { color: T.text, fontSize: 14, fontWeight: '700' },

  inviteScroll: { paddingHorizontal: 20, paddingBottom: 48 },
  inviteHero: { alignItems: 'center', paddingVertical: 32 },
  inviteRing: { width: 70, height: 70, borderRadius: 35, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  inviteHeadline: { color: T.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, marginBottom: 8 },
  inviteSubline: { color: T.mid, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  podNameCard: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  podNameBig: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginBottom: 4 },
  podCat: { color: T.dim, fontSize: 12 },

  statsRow: { flexDirection: 'row', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, marginBottom: 24, overflow: 'hidden' },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statVal: { color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  statLabel: { color: T.dim, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  statDiv: { width: 1, backgroundColor: T.border, marginVertical: 12 },

  section: { marginBottom: 24 },
  sectionLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 12 },

  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  ruleNum: { width: 30, height: 30, borderRadius: 8, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  ruleNumText: { color: T.dim, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  ruleText: { color: T.mid, fontSize: 14, flex: 1, lineHeight: 21 },

  witnessesSectionHeader: { marginBottom: 12 },
  witnessRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  witnessRowDim: { opacity: 0.4 },
  wAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  wInitial: { color: T.text, fontSize: 13, fontWeight: '800' },
  wName: { color: T.text, fontSize: 14, flex: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  removeWitnessBtn: { marginLeft: 4, padding: 2 },

  feedDivider: { height: 1, backgroundColor: T.border, marginVertical: 20 },

  feedPad: { padding: 16, paddingBottom: 110 },
  ruleChip: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  ruleChipText: { color: T.mid, fontSize: 11 },

  card: { backgroundColor: T.surface, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: T.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardAvatarText: { color: T.text, fontSize: 15, fontWeight: '800' },
  cardMeta: { flex: 1 },
  cardName: { color: T.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  cardDate: { color: T.dim, fontSize: 11, marginTop: 1 },
  cardDivider: { height: 1, backgroundColor: T.border, marginBottom: 12 },
  cardActivity: { color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  cardNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardNoteText: { color: T.mid, fontSize: 13, fontStyle: 'italic', flex: 1, lineHeight: 18 },

  emptyFeed: { alignItems: 'center', marginTop: 64 },
  emptyFeedIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyFeedTitle: { color: T.mid, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyFeedSub: { color: T.dim, fontSize: 13 },

  fab: {
    position: 'absolute', bottom: 30, right: 24,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: T.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#fff', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 6,
  },

  streaksSubtitle: { color: T.dim, fontSize: 13, marginBottom: 20 },
  streaksLoading: { paddingVertical: 60, alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  streakRank: { color: T.dim, fontSize: 12, fontWeight: '800', width: 20, textAlign: 'center' },
  streakAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  streakAvatarActive: { borderColor: T.white },
  streakInitial: { color: T.text, fontSize: 16, fontWeight: '800' },
  streakMeta: { flex: 1 },
  streakName: { color: T.text, fontSize: 14, fontWeight: '700' },
  streakCards: { color: T.dim, fontSize: 11, marginTop: 2 },
  adminTag: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  adminTagText: { color: T.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  streakRight: { alignItems: 'flex-end' },
  streakCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakCount: { color: T.text, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  streakFire: { fontSize: 16 },
  streakBest: { color: T.dim, fontSize: 10, marginTop: 2 },
  streakAtRisk: { color: '#f0a040', fontSize: 10, fontWeight: '700', marginTop: 2 },
  streaksEmpty: { alignItems: 'center', paddingVertical: 40 },
  streaksEmptyText: { color: T.dim, fontSize: 13, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: '90%', borderTopWidth: 1, borderColor: T.border },
  sheetPill: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  fieldLabel: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 1.8, marginBottom: 8 },
  field: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 12, padding: 13, color: T.text, fontSize: 14 },
  fieldArea: { minHeight: 80, textAlignVertical: 'top' },

  starPicker: { flexDirection: 'row', gap: 8 },
  starBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  starBtnOn: { backgroundColor: T.white, borderColor: T.white },
  starLabel: { color: T.mid, fontSize: 12, fontWeight: '600', marginTop: 8 },

  charCount: { color: T.dim, fontSize: 10, textAlign: 'right', marginTop: 4 },
  shareBtn: { backgroundColor: T.white, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  shareBtnOff: { backgroundColor: T.raised },
  shareBtnText: { color: T.black, fontSize: 15, fontWeight: '800' },

  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineBtn: { flex: 1, height: 52, borderRadius: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  declineText: { color: T.mid, fontSize: 15, fontWeight: '600' },
  acceptBtn: { flex: 2, height: 52, borderRadius: 14, backgroundColor: T.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: T.black, fontSize: 15, fontWeight: '800' },
});