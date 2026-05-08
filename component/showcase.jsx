import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  Image,
  StatusBar,
} from "react-native";
import { DiscoveryEndpoints, WitnessEndpoints } from "../services/apis";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const T = {
  bg:      "#080808",
  surface: "#101010",
  raised:  "#181818",
  border:  "#1e1e1e",
  hi:      "#2a2a2a",
  text:    "#efefef",
  mid:     "#888",
  dim:     "#444",
  accent:  "#7CFF9B",
  blue:    "#5B9EFF",
  yellow:  "#FFD97C",
  red:     "#FF7C7C",
  white:   "#ffffff",
  black:   "#000000",
};

const CARD_W = width - 32;
const CARD_H = 240;


const momentumMeta = (m) => {
  const v = parseFloat(m) || 0;
  if (v >  0.5) return { label: "Rising",   color: T.accent  };
  if (v >  0)   return { label: "Steady",   color: T.yellow  };
  if (v < -0.5) return { label: "Dipping",  color: T.red     };
  return               { label: "Neutral",  color: T.mid     };
};

const scoreColor = (s) =>
  s >= 4   ? T.accent :
  s >= 2.5 ? T.yellow : T.blue;

const Bar = ({ fill, color = T.accent }) => (
  <View style={bar.track}>
    <View style={[bar.fill, { width: `${Math.min(fill * 100, 100)}%`, backgroundColor: color }]} />
  </View>
);
const bar = StyleSheet.create({
  track: { height: 2, backgroundColor: T.hi, borderRadius: 1, overflow: "hidden", flex: 1 },
  fill:  { height: "100%", borderRadius: 1 },
});

const ScoreCircle = ({ score }) => {
  const color = scoreColor(score);
  return (
    <View style={sc.wrap}>
      <View style={[sc.ring, { borderColor: T.hi }]} />
      <View style={[sc.ring, sc.arc, {
        borderTopColor:    color,
        borderRightColor:  score > 1.25 ? color : "transparent",
        borderBottomColor: score > 2.5  ? color : "transparent",
        borderLeftColor:   score > 3.75 ? color : "transparent",
      }]} />
      <Text style={[sc.num, { color }]}>{score.toFixed(1)}</Text>
    </View>
  );
};
const sc = StyleSheet.create({
  wrap: { width: 68, height: 68, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: T.hi },
  arc:  { borderColor: "transparent", transform: [{ rotate: "-90deg" }] },
  num:  { fontSize: 18, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  cap:  { fontSize: 9, color: T.dim, fontWeight: "600", marginTop: -2 },
});

const FlipCard = ({ data, index }) => {
  const [flipped,   setFlipped]   = useState(false);
  const [requested, setRequested] = useState(false);
  const anim   = useState(new Animated.Value(0))[0];
  const fadeIn = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true,
    }).start();
  }, []);

  const flip = () => {
    Animated.spring(anim, {
      toValue: flipped ? 0 : 1, friction: 9, tension: 50, useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  };

  const onMakeWitness = async () => {
    if (requested) return;
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(WitnessEndpoints.SEND_REQUEST, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetId: data?._id }),
      });
      setRequested(true);
    } catch (e) { console.error(e); }
  };

  const fRot = anim.interpolate({ inputRange:[0,1], outputRange:["0deg","180deg"] });
  const bRot = anim.interpolate({ inputRange:[0,1], outputRange:["180deg","360deg"] });
  const fOp  = anim.interpolate({ inputRange:[0,0.49,0.5,1], outputRange:[1,1,0,0] });
  const bOp  = anim.interpolate({ inputRange:[0,0.49,0.5,1], outputRange:[0,0,1,1] });

  const perf         = data?.performance || {};
  const score        = parseFloat(perf.score        || 0);
  const consistency  = parseInt (perf.consistency   || 0);   // 0-100 %
  const streak       = parseInt (perf.currentStreak || 0);
  const bestStreak   = parseInt (perf.bestStreak    || 0);
  const habitScore   = parseFloat(perf.habitScore   || 0);   // 0-5
  const metricScore  = parseFloat(perf.metricScore  || 0);   // 0-5
  const habitCount   = parseInt (data?.habitCount   || perf.habitCount || 0);
  const focusSessions= parseInt (perf.focus?.totalSessions || data?.focusSessions || 0);
  const focusMins    = Math.round((perf.focus?.totalSecs || 0) / 60);
  const mom          = momentumMeta(perf.momentum);

  const initial   = data?.name?.charAt(0)?.toUpperCase() || "?";
  const isWitness = data?.role === "Witness";

  const focusStr = focusMins >= 60
    ? `${Math.floor(focusMins / 60)}h ${focusMins % 60}m`
    : focusMins > 0 ? `${focusMins}m` : null;

  return (
    <Animated.View style={[s.cardOuter, {
      opacity: fadeIn,
      transform: [{ translateY: fadeIn.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }],
    }]}>

      <Animated.View style={[s.card, {
        transform: [{ perspective: 1400 }, { rotateY: fRot }], opacity: fOp,
      }]}>
        <TouchableOpacity activeOpacity={1} onPress={flip} style={s.inner}>

          {/* LEFT */}
          <View style={s.left}>
            <View style={s.avatarWrap}>
              {data?.profilePicture
                ? <Image source={{ uri: data.profilePicture }} style={s.avatar} resizeMode="cover" />
                : <View style={[s.avatar, s.avatarFb]}><Text style={s.avatarLetter}>{initial}</Text></View>
              }
              {/* Consistency-driven status dot */}
              <View style={[s.dot, { backgroundColor: consistency >= 60 ? T.accent : consistency >= 30 ? T.yellow : T.red }]} />
            </View>

            <Text style={s.name} numberOfLines={1}>{data?.name || "Unknown"}</Text>
            <Text style={s.role}>{data?.role || "Member"}</Text>

            {/* Streak pill — only shown if they have one */}
            {streak > 0 && (
              <View style={s.streakPill}>
                <Text style={s.streakTxt}>{streak}d streak</Text>
              </View>
            )}

            <View style={s.flipRow}>
              <Icon name="swap-horizontal-outline" size={11} color={T.dim} />
              <Text style={s.flipTxt}>more</Text>
            </View>
          </View>

          <View style={s.vLine} />

          {/* RIGHT */}
          <View style={s.right}>

            {/* Score + momentum in one row */}
            <View style={s.topRow}>
              <ScoreCircle score={score} />
              <View style={{ flex: 1, marginLeft: "40%" }}>
                {/* Momentum badge */}
                <View style={[s.momBadge, { borderColor: mom.color + "44" }]}>
                  <View style={[s.momDot, { backgroundColor: mom.color }]} />
                  <Text style={[s.momTxt, { color: mom.color }]}>{mom.label}</Text>
                </View>
                {/* Consistency big */}
                <Text style={s.consBig}>
                  {consistency}<Text style={s.consPct}>  %</Text>
                </Text>
                <Text style={s.consCaption}>consistency</Text>
              </View>
            </View>

            <View style={s.hLine} />

          </View>

        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[s.card, s.cardAbs, {
        transform: [{ perspective: 1400 }, { rotateY: bRot }], opacity: bOp,
      }]}>
        <TouchableOpacity activeOpacity={1} onPress={flip} style={s.inner}>

          {/* LEFT */}
          <View style={s.left}>
            {[
              { val: score.toFixed(1), lbl: "score"       },
              { val: `${consistency}%`, lbl: "consistency" },
              { val: `${streak}d`,      lbl: "streak"      },
            ].map((st, i) => (
              <View key={i} style={s.backStat}>
                <Text style={s.backStatNum}>{st.val}</Text>
                <Text style={s.backStatLbl}>{st.lbl}</Text>
              </View>
            ))}
          </View>

          <View style={s.vLine} />

          {/* RIGHT */}
          <View style={[s.right, { justifyContent: "space-between" }]}>

            <View>
              {/* Habit score bar */}
              <View style={s.barBlock}>
                <View style={s.barHead}>
                  <Text style={s.barLbl}>Habit Score</Text>
                  <Text style={s.barVal}>{habitScore.toFixed(1)}</Text>
                </View>
                <Bar fill={habitScore / 5} color={T.accent} />
              </View>

              {/* Metric score bar */}
              <View style={[s.barBlock, { marginTop: 12 }]}>
                <View style={s.barHead}>
                  <Text style={s.barLbl}>Metric Score</Text>
                  <Text style={s.barVal}>{metricScore.toFixed(1)}</Text>
                </View>
                <Bar fill={metricScore / 5} color={T.blue} />
              </View>

              {/* Focus time row */}
              {focusStr && (
                <View style={[s.barBlock, { marginTop: 12 }]}>
                  <View style={s.barHead}>
                    <Icon name="timer-outline" size={10} color={T.dim} />
                    <Text style={[s.barLbl, { marginLeft: 5 }]}>{focusStr} focused</Text>
                  </View>
                </View>
              )}
            </View>

            {/* CTA */}
            {!isWitness && (
              <TouchableOpacity
                style={[s.cta, requested && s.ctaDone]}
                onPress={onMakeWitness}
                activeOpacity={0.88}
              >
                <Icon
                  name={requested ? "checkmark" : "shield-checkmark-outline"}
                  size={14}
                  color={requested ? T.mid : T.black}
                />
                <Text style={[s.ctaTxt, requested && s.ctaTxtDone]}>
                  {requested ? "Request Sent" : "Make Witness"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.closeRow} onPress={flip}>
              <Icon name="close" size={11} color={T.dim} />
              <Text style={s.closeTxt}>close</Text>
            </TouchableOpacity>

          </View>

        </TouchableOpacity>
      </Animated.View>

    </Animated.View>
  );
};

const ShowcaseScreen = () => {
  const navigation          = useNavigation();
  const [data,    setData]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res   = await fetch(DiscoveryEndpoints.GET_ALL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      console.log("json",json)
      setData(Array.isArray(json) ? json : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={17} color={T.mid} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          <Text style={s.eyebrow}>CONNECTIONS</Text>
          <Text style={s.headerTitle}>Find Your Witness</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loadWrap}>
          <View style={s.dots}>
            {[0,1,2].map(i => <View key={i} style={[s.dotPulse, { opacity: 0.3 + i * 0.25 }]} />)}
          </View>
          <Text style={s.loadTxt}>Loading profiles…</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item._id || i.toString()}
          renderItem={({ item, index }) => <FlipCard data={item} index={index} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Icon name="people-outline" size={28} color={T.mid} />
              </View>
              <Text style={s.emptyTitle}>No profiles yet</Text>
              <Text style={s.emptyDesc}>Check back soon as the community grows</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default ShowcaseScreen;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },

  header:      { flexDirection:"row", alignItems:"center", paddingHorizontal:20, paddingTop:52, paddingBottom:16, borderBottomWidth:1, borderBottomColor:T.border },
  iconBtn:     { width:34, height:34, borderRadius:10, backgroundColor:T.raised, borderWidth:1, borderColor:T.border, alignItems:"center", justifyContent:"center" },
  eyebrow:     { color:T.dim, fontSize:9, fontWeight:"700", letterSpacing:2, marginBottom:2 },
  headerTitle: { color:T.text, fontSize:22, fontWeight:"900", letterSpacing:-0.5 },
  countChip:   { backgroundColor:T.raised, borderWidth:1, borderColor:T.border, paddingHorizontal:12, paddingVertical:6, borderRadius:20 },
  countTxt:    { color:T.mid, fontSize:12, fontWeight:"700" },

  list: { paddingHorizontal:16, paddingTop:20, paddingBottom:80 },

  // ── Card ──
  cardOuter: { height: CARD_H, marginBottom: 20 },
  card: {
    position:"absolute", width:CARD_W, height:CARD_H,
    backgroundColor:T.surface, borderRadius:20,
    borderWidth:1, borderColor:T.border,
    backfaceVisibility:"hidden", overflow:"hidden",
    shadowColor:"#000", shadowOffset:{ width:0, height:8 },
    shadowOpacity:0.5, shadowRadius:20, elevation:12,
  },
  cardAbs: {},
  inner: { flex:1, flexDirection:"row" },

  // ── Left ──
  left: {
    width:130, paddingVertical:18, paddingHorizontal:14,
    alignItems:"center", justifyContent:"center",
    backgroundColor:T.raised, borderRightWidth:1, borderRightColor:T.border,
  },
  avatarWrap:   { position:"relative", marginBottom:10 },
  avatar:       { width:58, height:58, borderRadius:29, overflow:"hidden" },
  avatarFb:     { backgroundColor:T.hi, alignItems:"center", justifyContent:"center" },
  avatarLetter: { color:T.mid, fontSize:22, fontWeight:"900" },
  dot:          { position:"absolute", bottom:1, right:1, width:11, height:11, borderRadius:5.5, borderWidth:2, borderColor:T.raised },

  name:       { color:T.text, fontSize:13, fontWeight:"800", letterSpacing:-0.2, textAlign:"center", marginBottom:3 },
  role:       { color:T.dim, fontSize:9, fontWeight:"600", letterSpacing:1.2, textTransform:"uppercase", marginBottom:8 },
  streakPill: { backgroundColor:T.hi, borderRadius:20, paddingHorizontal:9, paddingVertical:4, marginBottom:10 },
  streakTxt:  { color:T.text, fontSize:11, fontWeight:"700" },
  flipRow:    { flexDirection:"row", alignItems:"center", gap:4, marginTop:"auto" },
  flipTxt:    { color:T.dim, fontSize:9, fontWeight:"500" },

  // ── Dividers ──
  vLine: { width:1, backgroundColor:T.border },
  hLine: { height:1, backgroundColor:T.border, marginVertical:11, width:"100%" },

  // ── Right ──
  right: { flex:1, paddingVertical:16, paddingHorizontal:16, justifyContent:"center" },

  topRow:      { flexDirection:"row", alignItems:"center" },
  momBadge:    { flexDirection:"row", alignItems:"center", gap:5, alignSelf:"flex-start", borderWidth:1, borderRadius:6, paddingHorizontal:7, paddingVertical:3, marginBottom:6 },
  momDot:      { width:5, height:5, borderRadius:2.5 },
  momTxt:      { fontSize:10, fontWeight:"700" },
  consBig:     { color:T.text, fontSize:26, fontWeight:"900", letterSpacing:-1, lineHeight:30 },
  consPct:     { fontSize:13, fontWeight:"700", color:T.mid },
  consCaption: { color:T.dim, fontSize:9, fontWeight:"600", letterSpacing:1, textTransform:"uppercase" },

  statRow:  { flexDirection:"row", alignItems:"center" },
  statCell: { flex:1, alignItems:"center" },
  statSep:  { width:1, height:22, backgroundColor:T.border },
  statNum:  { color:T.text, fontSize:14, fontWeight:"800", letterSpacing:-0.3, marginBottom:2 },
  statLbl:  { color:T.dim, fontSize:8, fontWeight:"600", letterSpacing:0.8, textTransform:"uppercase" },

  // ── Back left ──
  backThumb:    { width:46, height:46, borderRadius:23, overflow:"hidden", marginBottom:8 },
  backLetter:   { color:T.mid, fontSize:16, fontWeight:"900" },
  backName:     { color:T.text, fontSize:12, fontWeight:"800", textAlign:"center", letterSpacing:-0.2 },
  backStat:     { alignItems:"center", marginBottom:8 },
  backStatNum:  { color:T.text, fontSize:16, fontWeight:"900", letterSpacing:-0.5 },
  backStatLbl:  { color:T.dim, fontSize:8, fontWeight:"600", letterSpacing:1, textTransform:"uppercase", marginTop:1 },

  // ── Back right bars ──
  barBlock: {},
  barHead:  { flexDirection:"row", alignItems:"center", marginBottom:5 },
  barLbl:   { color:T.mid, fontSize:10, fontWeight:"500", flex:1 },
  barVal:   { color:T.text, fontSize:11, fontWeight:"700" },

  // ── CTA ──
  cta:       { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:7, paddingVertical:11, backgroundColor:T.white, borderRadius:12 },
  ctaDone:   { backgroundColor:T.raised, borderWidth:1, borderColor:T.border },
  ctaTxt:    { color:T.black, fontSize:12, fontWeight:"800" },
  ctaTxtDone:{ color:T.mid },

  closeRow: { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4 },
  closeTxt: { color:T.dim, fontSize:9, fontWeight:"500" },

  // ── Loading ──
  loadWrap: { flex:1, alignItems:"center", justifyContent:"center", gap:12 },
  dots:     { flexDirection:"row", gap:6 },
  dotPulse: { width:6, height:6, borderRadius:3, backgroundColor:T.text },
  loadTxt:  { color:T.dim, fontSize:12, fontWeight:"500" },

  // ── Empty ──
  empty:      { alignItems:"center", marginTop:80 },
  emptyIcon:  { width:68, height:68, borderRadius:34, backgroundColor:T.raised, borderWidth:1, borderColor:T.border, alignItems:"center", justifyContent:"center", marginBottom:16 },
  emptyTitle: { color:T.mid, fontSize:17, fontWeight:"700", marginBottom:6 },
  emptyDesc:  { color:T.dim, fontSize:13, textAlign:"center", lineHeight:18, paddingHorizontal:40 },
});