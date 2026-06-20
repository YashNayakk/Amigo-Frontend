import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, FlatList, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WitnessEndpoints, CommitmentPodEndpoints } from '../services/apis';
import { useNavigation } from '@react-navigation/native';
import MMKV from 'react-native-mmkv';
import AuthService from '../services/authService';
import { BASE_URL } from 'react-native-dotenv';

const T = {
  bg: '#080808', surface: '#101010', raised: '#181818',
  border: '#1e1e1e', hi: '#2a2a2a',
  text: '#efefef', mid: '#888', dim: '#444',
  white: '#ffffff', black: '#000000',
};

const SERVER_BASE = (BASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

const resolveImageUri = (path) => {
  if (!path || typeof path !== 'string' || path.trim() === '') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  const separator = path.startsWith('/') ? '' : '/';
  return `${SERVER_BASE}${separator}${path}`;
};

const Avatar = ({ uri, initial, style, initialStyle }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [uri]);

  if (uri && !hasError) {
    return (
      <View style={style}>
        <Image
          source={{ uri, headers: { Pragma: 'no-cache' } }}
          style={[style, { position: 'absolute', top: 0, left: 0 }]}
          resizeMode="cover"
          onLoad={() => setIsLoading(false)}
          onError={() => { setHasError(true); setIsLoading(false); }}
        />
        {isLoading && (
          <View style={[style, s.avatarFallback, { position: 'absolute', top: 0, left: 0 }]}>
            <ActivityIndicator size="small" color={T.mid} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[style, s.avatarFallback]}>
      <Text style={initialStyle}>{initial || '?'}</Text>
    </View>
  );
};

let _storage = null;
const getStorage = () => {
  if (!_storage) { _storage = new MMKV({ id: 'chat-storage' }); }
  return _storage;
};
const CACHE_CONNECTIONS = 'chat_connections_v1';
const CACHE_PODS        = 'chat_pods_v1';

const fmtDate = dateString => {
  if (!dateString) return '';
  const diff = Math.floor((Date.now() - new Date(dateString)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d';
  if (diff < 7) return `${diff}d`;
  if (diff < 30) return `${Math.floor(diff / 7)}w`;
  return `${Math.floor(diff / 30)}month`;
};

const readCache = (key) => {
  try { const raw = getStorage().getString(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};
const writeCache = (key, value) => {
  try { getStorage().set(key, JSON.stringify(value)); } catch { /* ignore */ }
};

const ChatListScreen = () => {
  const navigation = useNavigation();

  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery]   = useState('');
  const [connections, setConnections]   = useState([]);
  const [pods, setPods]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  const FILTERS = ['All', 'Witness', 'Pods'];

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const cachedConnections = readCache(CACHE_CONNECTIONS);
    const cachedPods        = readCache(CACHE_PODS);
    if (cachedConnections) setConnections(cachedConnections);
    if (cachedPods)        setPods(cachedPods);
    if (!cachedConnections && !cachedPods) setLoading(true);
    await Promise.all([loadConnections(), loadPods()]);
    setLoading(false);
  };

  const loadConnections = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await AuthService.authFetch(WitnessEndpoints.GET_CONNECTIONS, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());

      if (res?.success) {
        const formatted = (res.data || []).map(conn => ({
          _id:      conn?.user?._id || conn?.user?.id,
          chatId:   conn?.relationId,
          name:     conn?.user?.name,
          avatar:   conn?.user?.profilePicture,   // raw path — resolved at render time
          message:  'Tap to share activities',
          time:     fmtDate(conn?.createdAt),
          unread:   0,
          type:     'witness',
          sortDate: new Date(conn?.createdAt),
        }));
        setConnections(formatted);
        writeCache(CACHE_CONNECTIONS, formatted);
      }
    } catch (err) {
      console.warn('loadConnections offline:', err.message);
    }
  };

  const loadPods = async () => {
    try {
      const token  = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');

      const [myPodsRes, witnessPodsRes] = await Promise.all([
        AuthService.authFetch(CommitmentPodEndpoints.MY_PODS,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        AuthService.authFetch(CommitmentPodEndpoints.WITNESS,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);

      const adminFormatted = (myPodsRes?.success ? myPodsRes.pods || [] : [])
        .filter(pod => pod.active !== false)
        .map(pod => ({
          id:        pod._id,
          chatId:    pod._id,
          name:      pod.podName || `${pod.customType} Pod`,
          avatar:    null,
          message:   `${pod.witnesses?.length || 0} witnesses · ${pod.TimePeriod} days`,
          time:      fmtDate(pod.updatedAt || pod.createdAt),
          unread:    0,
          type:      'pod',
          podStatus: 'admin',
          sortDate:  new Date(pod.updatedAt || pod.createdAt),
        }));

      const witnessFormatted = (witnessPodsRes?.success ? witnessPodsRes.pods || [] : [])
        .filter(pod => {
          if (pod.active === false) return false;
          const myEntry = pod.witnesses?.find(w => {
            const wId = w?.user?._id || w?.user?.id || w?.user;
            return wId?.toString() === userId?.toString();
          });
          if (!myEntry) return false;
          return myEntry.status !== 'left' && myEntry.status !== 'declined' && myEntry.status !== 'removed';
        })
        .map(pod => {
          const myEntry = pod.witnesses?.find(w => {
            const wId = w?.user?._id?.toString() || w?.user?.id?.toString() || w?.user?.toString();
            return wId === userId;
          });
          const isPending = myEntry?.status === 'pending';
          return {
            id:        pod._id,
            chatId:    pod._id,
            name:      pod.podName || `${pod.customType} Pod`,
            avatar:    null,
            message:   isPending ? 'You have a pending invite' : `${pod.witnesses?.length || 0} witnesses · ${pod.TimePeriod} days`,
            time:      fmtDate(pod.updatedAt || pod.createdAt),
            unread:    isPending ? 1 : 0,
            type:      'pod',
            podStatus: isPending ? 'pending' : 'accepted',
            sortDate:  new Date(pod.updatedAt || pod.createdAt),
          };
        });

      const seen = new Set();
      const merged = [...adminFormatted, ...witnessFormatted].filter(pod => {
        if (seen.has(pod.id)) return false;
        seen.add(pod.id);
        return true;
      });

      setPods(merged);
      writeCache(CACHE_PODS, merged);
    } catch (err) {
      console.warn('loadPods offline:', err.message);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConnections(), loadPods()]);
    setRefreshing(false);
  }, []);

  const getCombined = () => {
    let list =
      activeFilter === 'Witness' ? [...connections] :
      activeFilter === 'Pods'    ? [...pods]        :
                                   [...connections, ...pods];
    if (searchQuery)
      list = list.filter(i => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    return list.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  };

  const handlePress = item => {
    if (item.type === 'witness') {
      navigation.navigate('CardSharing', {
        userId: item._id || item.id, userName: item.name, userAvatar: item.avatar,
      });
    } else {
      navigation.navigate('podDetail', {
        podId: item._id || item.id, podStatus: item.podStatus,
      });
    }
  };

  const renderItem = ({ item }) => {
    const resolvedAvatar = resolveImageUri(item.avatar);
    const initial = item.name?.charAt(0)?.toUpperCase() || '?';

    return (
      <TouchableOpacity style={s.row} onPress={() => handlePress(item)} activeOpacity={0.75}>

        <View style={s.avatarWrap}>
          {item.type === 'pod' ? (
            <View style={[s.avatarCircle, s.podCircle]}>
              <Icon name="people" size={20} color={T.mid} />
            </View>
          ) : (
            <Avatar
              uri={resolvedAvatar}
              initial={initial}
              style={s.avatarCircle}
              initialStyle={s.avatarInitial}
            />
          )}
          {item.type === 'pod' && (
            <View style={s.podBadge}>
              <Icon name="shield-checkmark" size={8} color={T.black} />
            </View>
          )}
        </View>

        <View style={s.rowContent}>
          <View style={s.rowTop}>
            <View style={s.nameWrap}>
              <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
              {item.type === 'pod' && (
                <View style={s.podTag}>
                  <Text style={s.podTagText}>POD</Text>
                </View>
              )}
            </View>
            <Text style={s.rowTime}>{item.time}</Text>
          </View>
          <View style={s.rowBottom}>
            <Text style={[s.rowPreview, item.unread > 0 && s.rowPreviewBold]} numberOfLines={1}>
              {item.message}
            </Text>
            {item.unread > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
        </View>

      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={[s.wrap, s.center]}>
      <ActivityIndicator size="large" color={T.text} />
    </View>
  );

  return (
    <View style={s.wrap}>

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerEyebrow}>INBOX</Text>
          <Text style={s.headerTitle}>Share with Real Connections</Text>
        </View>
        <TouchableOpacity style={s.notifBtn} onPress={() => navigation.navigate('Notification')}>
          <Icon name="notifications-outline" size={19} color={T.mid} />
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Icon name="search-outline" size={16} color={T.dim} style={{ marginRight: 10 }} />
        <TextInput style={s.searchInput} placeholder="Search connections"
          placeholderTextColor={T.dim} value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={16} color={T.dim} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f}
            style={[s.filterChip, activeFilter === f && s.filterChipOn]}
            onPress={() => setActiveFilter(f)}>
            <Text style={[s.filterText, activeFilter === f && s.filterTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.countBadge}>
          <Text style={s.countBadgeText}>{getCombined().length}</Text>
        </View>
      </View>

      <View style={s.divider} />

      <FlatList
        data={getCombined()}
        keyExtractor={item => `${item.type}-${item._id || item.id}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.text} />
        }
        ItemSeparatorComponent={() => <View style={s.rowSep} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Icon name="chatbubbles-outline" size={28} color={T.mid} />
            </View>
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyDesc}>Connect with witnesses or create a Commitment Pod</Text>
          </View>
        }
      />

      <View style={s.nav}>
        <TouchableOpacity style={s.navBtn} onPress={() => navigation.navigate('CommitmentPod')}>
          <Icon name="add-circle-outline" size={22} color={T.text} />
          <Text style={s.navBtnText}>New Pod</Text>
        </TouchableOpacity>
        <View style={s.navDivider} />
        <TouchableOpacity style={s.navBtn} onPress={() => navigation.navigate('Showcase')}>
          <Icon name="people-outline" size={22} color={T.mid} />
          <Text style={[s.navBtnText, { color: T.dim }]}>Find Connections</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default ChatListScreen;

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerEyebrow: { color: T.dim, fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  headerTitle: { color: T.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  notifBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 14, color: T.text },

  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8, marginBottom: 0 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border },
  filterChipOn: { backgroundColor: T.white, borderColor: T.white },
  filterText: { fontSize: 13, fontWeight: '600', color: T.dim },
  filterTextOn: { color: T.black },
  countBadge: { marginLeft: 'auto', backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  countBadgeText: { color: T.mid, fontSize: 11, fontWeight: '700' },

  divider: { height: 1, backgroundColor: T.border, marginTop: 14 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, backgroundColor: T.bg },
  rowSep: { height: 1, backgroundColor: T.border, marginLeft: 78 },

  avatarWrap: { marginRight: 14, position: 'relative' },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarFallback: { backgroundColor: T.raised, alignItems: 'center', justifyContent: 'center' },
  podCircle: { backgroundColor: T.surface },
  avatarInitial: { fontSize: 19, fontWeight: '700', color: T.mid },
  podBadge: { position: 'absolute', bottom: -1, right: -1, width: 17, height: 17, borderRadius: 9, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: T.bg },

  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  nameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  rowName: { color: T.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  podTag: { backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  podTagText: { color: T.dim, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  rowTime: { color: T.dim, fontSize: 11 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowPreview: { color: T.dim, fontSize: 13, flex: 1 },
  rowPreviewBold: { color: T.mid, fontWeight: '600' },
  unreadBadge: { backgroundColor: T.white, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadText: { color: T.black, fontSize: 10, fontWeight: '800' },

  empty: { alignItems: 'center', marginTop: 72 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: T.mid, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptyDesc: { color: T.dim, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 40 },

  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: T.surface, borderTopWidth: 1, borderTopColor: T.border, paddingVertical: 10, paddingHorizontal: 20 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 8 },
  navBtnText: { color: T.text, fontSize: 13, fontWeight: '600' },
  navDivider: { width: 1, backgroundColor: T.border, marginVertical: 4 },
});