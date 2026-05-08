import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, Animated,
} from "react-native";
import { magnetometer, SensorTypes, setUpdateIntervalForType } from "react-native-sensors";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { PerformanceEndpoints } from "../services/apis";

const T = {
  bg:      "#080808", surface: "#101010", raised: "#181818",
  border:  "#1e1e1e", hi:      "#2a2a2a",
  text:    "#efefef", mid:     "#888",    dim:    "#444",
  white:   "#ffffff", black:   "#000000",
  green:   "#7CFF9B", greenBg: "#0d1f12", greenBorder: "#1a3a22",
};

const SENSOR_INTERVAL_MS    = 80;
const MAG_FACEDOWN_Z        = 30;
const MAG_FACEUP_Z          = -30;
const CONFIRMATION_DELAY_MS = 500;

const FlipFocus = () => {
  const navigation = useNavigation();

  const [phase, setPhase]           = useState("idle");
  const [seconds, setSeconds]       = useState(0);
  const [sessions, setSessions]     = useState([]);
  const [totalPts, setTotalPts]     = useState(0);
  const [saveError, setSaveError]   = useState(false);
  const [sensorError, setSensorError] = useState(false);

  // Mascot pop-in animation on save error
  const mascotScale = useRef(new Animated.Value(0)).current;

  const isFocusedRef    = useRef(false);
  const confirmTimerRef = useRef(null);
  const magSubRef       = useRef(null);
  const magZRef         = useRef(0);
  const intervalRef     = useRef(null);
  const startTimeRef    = useRef(null);

  const popMascotIn = () => {
    mascotScale.setValue(0);
    Animated.spring(mascotScale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };


  const startSession = () => {
    if (isFocusedRef.current) return;
    isFocusedRef.current = true;
    startTimeRef.current = Date.now();
    setSeconds(0);
    setPhase("active");
    setSaveError(false);
    intervalRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopSession = async () => {
    if (!isFocusedRef.current) return;
    isFocusedRef.current = false;
    clearInterval(intervalRef.current);

    const startedAt = startTimeRef.current;
    const endedAt   = Date.now();
    const duration  = Math.floor((endedAt - startedAt) / 1000);

    setPhase("saving");

    try {
      const token = await AsyncStorage.getItem("token");
      const res   = await fetch(PerformanceEndpoints.UPDATE_REWARD, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startedAt, endedAt }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const { points, durationSecs, reason } = await res.json();

      if (reason === "too_short") {
        setPhase("idle");
        return;
      }

      setSessions(prev => [
        { id: Date.now(), duration: durationSecs ?? duration, points: points ?? 0, time: new Date() },
        ...prev.slice(0, 4),
      ]);
      setTotalPts(prev => prev + (points ?? 0));
    } catch {
      setSaveError(true);
      popMascotIn();
      setSessions(prev => [
        { id: Date.now(), duration, points: null, time: new Date() },
        ...prev.slice(0, 4),
      ]);
    } finally {
      setPhase("idle");
    }
  };

  useEffect(() => {
    try {
      setUpdateIntervalForType(SensorTypes.magnetometer, SENSOR_INTERVAL_MS);

      magSubRef.current = magnetometer.subscribe(
        ({ x: mx, y: my, z: mz }) => {
          magZRef.current = mz;

          if (!isFocusedRef.current) {
            if (mz > MAG_FACEDOWN_Z) {
              if (!confirmTimerRef.current) {
                setPhase("detecting");
                confirmTimerRef.current = setTimeout(() => {
                  confirmTimerRef.current = null;
                  if (magZRef.current > MAG_FACEDOWN_Z) startSession();
                  else setPhase("idle");
                }, CONFIRMATION_DELAY_MS);
              }
            } else if (confirmTimerRef.current) {
              clearTimeout(confirmTimerRef.current);
              confirmTimerRef.current = null;
              setPhase("idle");
            }
          } else {
            if (mz < MAG_FACEUP_Z) stopSession();
          }
        },
        (error) => {
          console.error("Magnetometer error:", error);
          setSensorError(true);
        }
      );
    } catch (err) {
      console.error("Sensor init error:", err);
      setSensorError(true);
    }

    return () => {
      magSubRef.current?.unsubscribe();
      clearInterval(intervalRef.current);
      clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const formatDuration = (s) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}m ${r}s` : `${m}m`;
  };

  const isActive    = phase === "active";
  const isDetecting = phase === "detecting";
  const isSaving    = phase === "saving";

  if (sensorError) {
    return (
      <SafeAreaView style={[s.wrap, s.centerContent]}>
        <Image
          source={require("../Images/mascotc.png")}
          style={s.mascotImage}
          resizeMode="contain"
        />
        <Text style={s.errorTitle}>Sensor unavailable</Text>
        <Text style={s.errorSubtitle}>
          FlipFocus needs your device's magnetometer.{"\n"}
          It may not be supported on this device.
        </Text>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.wrap}>

      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <Icon name="close" size={17} color={T.mid} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 14 }}>
          <Text style={s.eyebrow}>FOCUS MODE</Text>
          <Text style={s.headerTitle}>Flip phone</Text>
        </View>
        {totalPts > 0 && (
          <View style={s.ptsBadge}>
            <Icon name="flash" size={11} color={T.black} />
            <Text style={s.ptsBadgeText}>{totalPts} pts</Text>
          </View>
        )}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollPad}>

        <View style={[s.heroCard, isActive && s.heroCardActive]}>

          <View style={s.statusRow}>
            <View style={[s.statusDot, isActive && s.statusDotActive, isDetecting && s.statusDotDetecting]} />
            <Text style={[s.statusText, isActive && s.statusTextActive]}>
              {isActive    ? "Session active"    :
               isDetecting ? "Flip detected..."  :
               isSaving    ? "Saving session..." :
               "Waiting for flip"}
            </Text>
            {isSaving && <ActivityIndicator size="small" color={T.mid} style={{ marginLeft: 8 }} />}
          </View>

          {isActive ? (
            <View style={s.timerBlock}>
              <Text style={s.timerBig}>{formatTime(seconds)}</Text>
              <Text style={s.timerSub}>Keep your phone face-down</Text>
            </View>
          ) : (
            <View style={s.idleBlock}>
              <View style={s.idleIconRing}>
                <Icon name="phone-portrait-outline" size={28} color={T.mid} />
              </View>
              <Text style={s.idleTitle}>Ready to focus?</Text>
              <Text style={s.idleDesc}>Place your phone face-down on any surface to begin a session</Text>
            </View>
          )}

          {isActive && (
            <View style={s.livePtsRow}>
              <View style={s.livePtsChip}>
                <Icon name="flash-outline" size={11} color={T.green} />
                <Text style={s.livePtsText}>{Math.floor(seconds / 60) * 5} pts so far</Text>
              </View>
              <Text style={s.liveFlipHint}>Flip back to stop</Text>
            </View>
          )}
        </View>

        {!isActive && (
          <View style={s.howCard}>
            <View style={s.howTop}>
              <Icon name="information-circle-outline" size={12} color={T.mid} />
              <Text style={s.howTopLabel}>HOW IT WORKS</Text>
            </View>
            {[
              { icon: "phone-landscape-outline", text: "Flip your phone face-down to start" },
              { icon: "timer-outline",           text: "Session runs while screen faces down" },
              { icon: "flash-outline",           text: "Earn points based on focus duration" },
              { icon: "phone-portrait-outline",  text: "Flip back up to end and save" },
            ].map(({ icon, text }, i, arr) => (
              <View key={i} style={[s.howRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.howIconWrap}>
                  <Icon name={icon} size={16} color={T.mid} />
                </View>
                <Text style={s.howText}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Save error banner with mascot ── */}
        {saveError && (
          <Animated.View
            style={[s.errorBanner, { transform: [{ scale: mascotScale }] }]}
          >
            <Image
              source={require("../Images/mascotc.png")}
              style={s.mascotTiny}
              resizeMode="contain"
            />
            <Text style={s.errorText}>
              Couldn't save to server — session recorded locally
            </Text>
          </Animated.View>
        )}

        {sessions.length > 0 && (
          <View style={s.sessionsCard}>
            <View style={s.sessionsTop}>
              <Icon name="time-outline" size={12} color={T.mid} />
              <Text style={s.sessionsTopLabel}>RECENT SESSIONS</Text>
            </View>
            {sessions.map((sess, i) => (
              <View key={sess.id}
                style={[s.sessionRow, i === sessions.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.sessionLeft}>
                  <View style={s.sessionIconWrap}>
                    <Icon name="checkmark" size={13} color={T.mid} />
                  </View>
                  <View>
                    <Text style={s.sessionDur}>{formatDuration(sess.duration)}</Text>
                    <Text style={s.sessionTime}>
                      {sess.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
                <View style={s.sessionRight}>
                  {sess.points !== null ? (
                    <>
                      <Text style={s.sessionPts}>+{sess.points}</Text>
                      <Text style={s.sessionPtsLbl}>pts</Text>
                    </>
                  ) : (
                    <Text style={s.sessionPtsLbl}>–</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default FlipFocus;

const s = StyleSheet.create({
  wrap:      { flex: 1, backgroundColor: T.bg },
  scroll:    { flex: 1 },
  scrollPad: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60, gap: 12 },
  centerContent: { justifyContent: "center", alignItems: "center" },

  mascotImage: { width: 110, height: 110, marginBottom: 16 },
  mascotTiny:  { width: 30, height: 30, marginRight: 10 },

  errorTitle: {
    color: T.text, fontSize: 20, fontWeight: "700",
    textAlign: "center", marginBottom: 8,
  },
  errorSubtitle: {
    color: T.mid, fontSize: 13, textAlign: "center",
    lineHeight: 20, paddingHorizontal: 32, marginBottom: 24,
  },
  backBtn: {
    borderWidth: 1, borderColor: T.mid,
    paddingVertical: 10, paddingHorizontal: 32, borderRadius: 20,
  },
  backBtnText: { color: T.text, fontSize: 14, fontWeight: "600" },

  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  iconBtn:     { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  eyebrow:     { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 2 },
  headerTitle: { color: T.text, fontSize: 19, fontWeight: "900", letterSpacing: -0.5 },
  ptsBadge:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.white, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
  ptsBadgeText:{ color: T.black, fontSize: 12, fontWeight: "800" },

  heroCard:       { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 20, padding: 20, gap: 20 },
  heroCardActive: { borderColor: T.greenBorder, backgroundColor: T.greenBg },

  statusRow:          { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: T.hi },
  statusDotActive:    { backgroundColor: T.green },
  statusDotDetecting: { backgroundColor: "#f0c040" },
  statusText:         { color: T.dim, fontSize: 13, fontWeight: "600" },
  statusTextActive:   { color: T.green },

  timerBlock: { alignItems: "center", paddingVertical: 16, gap: 6 },
  timerBig:   { color: T.green, fontSize: 64, fontWeight: "900", letterSpacing: -3 },
  timerSub:   { color: T.greenBorder, fontSize: 13 },

  idleBlock:    { alignItems: "center", paddingVertical: 20, gap: 12 },
  idleIconRing: { width: 64, height: 64, borderRadius: 32, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  idleTitle:    { color: T.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  idleDesc:     { color: T.mid, fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 260 },

  livePtsRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  livePtsChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(124,255,155,0.08)", borderWidth: 1, borderColor: T.greenBorder, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  livePtsText: { color: T.green, fontSize: 12, fontWeight: "700" },
  liveFlipHint:{ color: T.dim, fontSize: 12 },

  howCard:     { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden" },
  howTop:      { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  howTopLabel: { color: T.mid, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  howRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  howIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.raised, alignItems: "center", justifyContent: "center" },
  howText:     { color: T.mid, fontSize: 13, flex: 1, lineHeight: 18 },

  errorBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a0a0a", borderWidth: 1, borderColor: "#3a1a1a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  errorText:   { color: "#ff6b6b", fontSize: 12, flex: 1, lineHeight: 17 },

  sessionsCard:     { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, overflow: "hidden" },
  sessionsTop:      { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  sessionsTopLabel: { color: T.mid, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  sessionRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  sessionLeft:      { flexDirection: "row", alignItems: "center", gap: 12 },
  sessionIconWrap:  { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  sessionDur:       { color: T.text, fontSize: 15, fontWeight: "700" },
  sessionTime:      { color: T.dim, fontSize: 11, marginTop: 2 },
  sessionRight:     { alignItems: "flex-end" },
  sessionPts:       { color: T.green, fontSize: 18, fontWeight: "800" },
  sessionPtsLbl:    { color: T.dim, fontSize: 11 },
});