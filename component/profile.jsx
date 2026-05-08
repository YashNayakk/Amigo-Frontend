import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Image, Alert, Modal, TextInput,
  ActivityIndicator, Platform, PermissionsAndroid, Linking,
  KeyboardAvoidingView, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import AuthService from "../services/authService";
import { UserEndpoints, BASE_URL } from "../services/apis";
import Icon from "react-native-vector-icons/Ionicons";
import { launchImageLibrary } from "react-native-image-picker";

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
  white:   "#ffffff",
  black:   "#000000",
};

const resolveImageUri = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${BASE_URL}${path}`;
};

const ROLES = [
  { value: "student",      label: "Student"      },
  { value: "developer",    label: "Developer"    },
  { value: "designer",     label: "Designer"     },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "professional", label: "Professional" },
  { value: "other",        label: "Other"        },
];

const getRoleLabel = (v) => ROLES.find((r) => r.value === v)?.label || "Other";

const formatDate = (str) => {
  if (!str) return "N/A";
  return new Date(str).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
};


const SectionLabel = ({ children }) => (
  <View style={sl.wrap}>
    <Text style={sl.text}>{children}</Text>
    <View style={sl.line} />
  </View>
);
const sl = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 28 },
  text: { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  line: { flex: 1, height: 1, backgroundColor: T.border },
});

const ActionRow = ({ icon, label, onPress, danger, last }) => (
  <TouchableOpacity
    style={[ar.row, !last && ar.rowBorder]}
    onPress={onPress} activeOpacity={0.7}
  >
    <View style={[ar.iconBox, danger && ar.iconBoxDanger]}>
      <Icon name={icon} size={15} color={danger ? "#ff6b6b" : T.mid} />
    </View>
    <Text style={[ar.label, danger && ar.labelDanger]}>{label}</Text>
    <Icon name="chevron-forward" size={13} color={danger ? "#ff4444" : T.dim} style={{ marginLeft: "auto" }} />
  </TouchableOpacity>
);
const ar = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: T.border },
  iconBox:      { width: 32, height: 32, borderRadius: 9, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  iconBoxDanger:{ borderColor: "#2a1010" },
  label:        { color: T.text, fontSize: 14, fontWeight: "600" },
  labelDanger:  { color: "#ff6b6b" },
});

const StatCol = ({ value, label, divider }) => (
  <View style={sc.outer}>
    <View style={sc.inner}>
      <Text style={sc.val}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
    {divider && <View style={sc.div} />}
  </View>
);
const sc = StyleSheet.create({
  outer: { flexDirection: "row", flex: 1 },
  inner: { flex: 1, flexDirection:"row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap:24 },
  val:   { color: T.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.8, marginBottom: 4 },
  label: { color: T.dim, fontSize: 8, fontWeight: "700", letterSpacing: 1.8 },
  div:   { width: 1, backgroundColor: T.border, alignSelf: "stretch", marginVertical: 12 },
});

const Profile = () => {
  const navigation = useNavigation();

  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [modalVisible, setModalVisible]   = useState(false);
  const [editName, setEditName]           = useState("");
  const [editUserName, setEditUserName]   = useState("");
  const [editBio, setEditBio]             = useState("");
  const [editRole, setEditRole]           = useState("other");
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res   = await fetch(UserEndpoints.GET_PROFILE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Non-JSON response");
      const json = await res.json();
      if (res.ok && json.success) { applyUser(json.data); }
      else throw new Error(json.message || "Failed");
    } catch (err) {
      console.error("loadProfile:", err);
      const cached = await AsyncStorage.getItem("user");
      if (cached) applyUser(JSON.parse(cached));
    } finally { setLoading(false); }
  };
  
  const applyUser = (u) => {
    setUser(u);
    setEditName(u.name || "");
    setEditUserName(u.userName || "");
    setEditBio(u.bio || "");
    setEditRole(u.role || "other");
   
  };

  const requestPermission = async () => {
    if (Platform.OS !== "android") return true;
    const perm = Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const result = await PermissionsAndroid.request(perm, {
      title: "Photo Library Permission",
      message: "App needs access to your photos to set a profile picture.",
      buttonNeutral: "Ask Me Later", buttonNegative: "Cancel", buttonPositive: "OK",
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const pickImage = async () => {
    const ok = await requestPermission();
    if (!ok) {
      Alert.alert("Permission Denied", "Enable photo access in Settings.",
        [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]);
      return;
    }
    const result = await launchImageLibrary({ mediaType: "photo", quality: 0.8, maxWidth: 1000, maxHeight: 1000 });
    if (result.assets?.length) setSelectedImage(result.assets[0].uri);
  };

  const uploadImage = async (uri) => {
    const token  = await AsyncStorage.getItem("token");
    const userId = user._id || user.id;
    const form   = new FormData();
    form.append("profilePicture", { uri, type: "image/jpeg", name: "profile.jpg" });
    const res  = await fetch(UserEndpoints.UPDATE(userId), {
      method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Non-JSON upload response");
    const json = await res.json();
    return (res.ok && json.success) ? json.data.profilePicture : null;
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      const token  = await AsyncStorage.getItem("token");
      const userId = user._id || user.id;
      let profilePicture = user.profilePicture;
      if (selectedImage) {
        const uploaded = await uploadImage(selectedImage);
        if (uploaded) profilePicture = uploaded;
        else Alert.alert("Warning", "Image upload failed. Other changes will still be saved.");
      }
      const res = await fetch(UserEndpoints.UPDATE(userId), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, userName: editUserName, bio: editBio, role: editRole, ...(profilePicture && { profilePicture }) }),
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Non-JSON response");
      const json = await res.json();
      if (res.ok && json.success) {
        await AsyncStorage.setItem("user", JSON.stringify(json.data));
        applyUser(json.data);
        setModalVisible(false);
        setSelectedImage(null);
      } else { Alert.alert("Error", json.message || "Failed to update profile"); }
    } catch (err) { Alert.alert("Error", err.message || "Failed to update profile"); }
    finally { setUploading(false); }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => {
        await AuthService.logout();
        navigation.replace("Login");
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={T.white} />
        <Text style={s.loadingText}>Loading…</Text>
      </View>
    );
  }

  const avatarUri = resolveImageUri(user?.profilePicture);
  const initial   = (user?.name || "?").charAt(0).toUpperCase();
  const joinYear  = user?.createdAt ? new Date(user.createdAt).getFullYear() : "—";

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <StatusBar barStyle="light-content" />
 
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero block ── */}
        <View style={s.hero}>

          {/* Avatar + ring */}
          <View style={s.avatarSection}>
            <TouchableOpacity
              style={s.avatarOuter}
              onPress={() => { setSelectedImage(null); setModalVisible(true); }}
              activeOpacity={0.85}
            >
              {/* Outer decorative ring */}
              <View style={s.avatarRingOuter} />
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatar} resizeMode="cover" />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{initial}</Text>
                </View>
              )}
              
            </TouchableOpacity>

            {/* Stats to the right of avatar — Instagram DNA */}
            <View style={s.heroStats}>
              <StatCol value={user?.WitnessCount || 0}    label="WITNESSES" divider />
            </View>
          </View>

          {/* Name + role pill */}
          <View style={s.nameBlock}>
            <Text style={s.heroName}>{user?.name || "User"}</Text>
            <View style={s.rolePill}>
              <View style={s.roleDot} />
              <Text style={s.rolePillText}>{getRoleLabel(user?.role).toUpperCase()}</Text>
            </View>
          </View>

          {/* Bio */}
          {user?.bio ? (
            <Text style={s.heroBio}>{user.bio}</Text>
          ) : (
            <TouchableOpacity
              onPress={() => { setSelectedImage(null); setModalVisible(true); }}
              activeOpacity={0.7}
            >
              <Text style={s.heroBioEmpty}>+ Add a bio</Text>
            </TouchableOpacity>
          )}

          {/* Joined row */}
          <View style={s.joinedRow}>
            <Icon name="calendar-outline" size={12} color={T.dim} />
            <Text style={s.joinedText}>Member since {formatDate(user?.createdAt)}</Text>
          </View>

          {/* Edit button — full width, below bio */}
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => { setSelectedImage(null); setModalVisible(true); }}
            activeOpacity={0.85}
          >
            <Icon name="create-outline" size={14} color={T.text} />
            <Text style={s.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

        </View>

        {/* ── Divider ── */}
        <View style={s.sectionDivider} />

        {/* ── Info tiles ── */}
        <View style={s.tilesSection}>
          <Text style={s.tilesSectionLabel}>OVERVIEW</Text>
          <View style={s.tilesGrid}>
            {[
              { icon: "mail-outline",       label: "Email",   value: user?.email || "—",                          wide: true  },
              { icon: "people-outline",     label: "Witnesses", value: `${user?.WitnessCount || 0}`,              wide: false },
              { icon: "shield-outline",     label: "Role",    value: getRoleLabel(user?.role),                    wide: false },
              { icon: "time-outline",       label: "Joined",  value: formatDate(user?.createdAt),                 wide: true  },
            ].map((tile, i) => (
              <View key={i} style={[s.tile, tile.wide && s.tileWide]}>
                <View style={s.tileIcon}>
                  <Icon name={tile.icon} size={14} color={T.mid} />
                </View>
                <Text style={s.tileLabel}>{tile.label}</Text>
                <Text style={s.tileValue} numberOfLines={1}>{tile.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Settings ── */}
        <View style={s.sections}>
          <SectionLabel>ACCOUNT</SectionLabel>
          <View style={s.card}>
            <ActionRow icon="help-circle-outline" label="Help & Support"
              onPress={() => Alert.alert("Help", "Contact support@app.com")} />
            <ActionRow icon="log-out-outline" label="Log Out"
              onPress={handleLogout} danger last />
          </View>
        </View>

      </ScrollView>

      {/* ══════════ EDIT MODAL ══════════ */}
      <Modal visible={modalVisible} animationType="slide" transparent
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={s.sheetPill} />

              {/* Header */}
              <View style={s.sheetHeader}>
                <View>
                  <Text style={s.eyebrow}>PROFILE</Text>
                  <Text style={s.sheetTitle}>Edit Profile</Text>
                </View>
                <TouchableOpacity style={s.iconBtn} onPress={() => setModalVisible(false)}>
                  <Icon name="close" size={16} color={T.mid} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {/* Avatar picker */}
                <View style={s.pickerRow}>
                  <TouchableOpacity style={s.pickerWrap} onPress={pickImage} activeOpacity={0.8}>
                    {selectedImage || avatarUri ? (
                      <Image source={{ uri: selectedImage || avatarUri }} style={s.pickerImg} />
                    ) : (
                      <View style={[s.pickerImg, s.pickerFallback]}>
                        <Text style={s.pickerInitial}>{initial}</Text>
                      </View>
                    )}
                    <View style={s.pickerBadge}>
                      <Icon name="camera" size={12} color={T.black} />
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pickerLabel}>PROFILE PHOTO</Text>
                    <Text style={s.pickerHint}>Tap to change your photo</Text>
                  </View>
                </View>

                <View style={s.fieldDivider} />

                {/* Name */}
                <View style={s.fieldBox}>
                  <Text style={s.fieldLabel}>DISPLAY NAME</Text>
                  <TextInput
                    style={s.field}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Your name"
                    placeholderTextColor={T.dim}
                  />
                </View>

                {/* Username */}
                <View style={s.fieldBox}>
                  <Text style={s.fieldLabel}>USERNAME</Text>
                  <View style={s.fieldRow}>
                    <Text style={s.fieldPrefix}>@</Text>
                    <TextInput
                      style={[s.field, s.fieldFlex]}
                      value={editUserName}
                      onChangeText={setEditUserName}
                      placeholder="username"
                      placeholderTextColor={T.dim}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Bio */}
                <View style={s.fieldBox}>
                  <Text style={s.fieldLabel}>BIO <Text style={{ color: T.dim }}>— {editBio.length}/200</Text></Text>
                  <TextInput
                    style={[s.field, { height: 80, textAlignVertical: "top", paddingTop: 14 }]}
                    value={editBio}
                    onChangeText={setEditBio}
                    placeholder="Tell us about yourself"
                    placeholderTextColor={T.dim}
                    multiline
                    maxLength={200}
                  />
                </View>

                {/* Role */}
                <View style={s.fieldBox}>
                  <Text style={s.fieldLabel}>ROLE</Text>
                  <View style={s.roleGrid}>
                    {ROLES.map((r) => {
                      const on = editRole === r.value;
                      return (
                        <TouchableOpacity
                          key={r.value}
                          style={[s.roleChip, on && s.roleChipOn]}
                          onPress={() => setEditRole(r.value)}
                          activeOpacity={0.75}
                        >
                          {on && <View style={s.roleChipDot} />}
                          <Text style={[s.roleChipText, on && s.roleChipTextOn]}>
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

              </ScrollView>

              {/* Bottom bar */}
              <View style={s.bar}>
                <TouchableOpacity style={s.barBack} onPress={() => setModalVisible(false)}>
                  <Icon name="arrow-back" size={17} color={T.mid} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.barNext, uploading && s.barNextOff]}
                  onPress={handleSave}
                  disabled={uploading}
                  activeOpacity={0.85}
                >
                  {uploading
                    ? <ActivityIndicator color={T.black} size="small" />
                    : <>
                        <Text style={s.barNextText}>Save Changes</Text>
                        <Icon name="checkmark" size={15} color={T.black} style={{ marginLeft: 6 }} />
                      </>}
                </TouchableOpacity>
              </View>
              <View style={{ height: 12 }} />

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

export default Profile;

// ─── Styles ───────────────────────────────────────────────────────────────────
const TILE = (width - 40 - 10) / 2; // two-col tile width

const s = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: T.bg },
  scroll:      { paddingBottom: 80 },
  loadingWrap: { flex: 1, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: T.mid, fontSize: 13 },

  // ── Top bar ──
  topBar: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: 20,
    paddingTop:       8,
    paddingBottom:    12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  topHandle: { color: T.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  iconBtn:   { width: 34, height: 34, borderRadius: 10, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    paddingTop:        40,
    paddingBottom:     24,
  },

  // Avatar row (avatar left, stats right)
  avatarSection: {
    flexDirection: "row",
    alignItems:    "center",
    marginBottom:  16,
  },

  avatarOuter: {
    position: "relative",
    marginRight: 20,
  },
  avatarRingOuter: {
    position:     "absolute",
    top:          -4,
    left:         -4,
    right:        -4,
    bottom:       -4,
    borderRadius: 50,
    borderWidth:  1,
    borderColor:  T.hi,
  },
  avatar:        { width: 86, height: 86, borderRadius: 43, borderWidth: 1.5, borderColor: T.surface },
  avatarFallback:{ backgroundColor: T.raised, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 32, fontWeight: "900", color: T.mid, letterSpacing: -1 },
  cameraBadge:   { position: "absolute", bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: T.white, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.bg },

  heroStats: {
    flex:           1,
    flexDirection:  "row",
    backgroundColor: T.surface,
    borderWidth:    1,
    borderColor:    T.border,
    borderRadius:   14,
    overflow:       "hidden",
  },

  // Name block
  nameBlock: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            10,
    marginBottom:   8,
  },
  heroName:     { color: T.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  rolePill:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  roleDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: T.mid },
  rolePillText: { color: T.dim, fontSize: 8, fontWeight: "700", letterSpacing: 1.5 },

  heroBio:      { color: T.mid, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  heroBioEmpty: { color: T.dim, fontSize: 13, marginBottom: 10, fontStyle: "italic" },

  joinedRow:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  joinedText: { color: T.dim, fontSize: 11, fontWeight: "500" },

  editBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, paddingVertical: 10, borderRadius: 12 },
  editBtnText: { color: T.text, fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },

  // ── Section divider ──
  sectionDivider: { height: 1, backgroundColor: T.border },

  // ── Tiles ──
  tilesSection:      { paddingHorizontal: 20, paddingTop: 24 },
  tilesSectionLabel: { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 12 },
  tilesGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  tile: {
    width:           TILE,
    backgroundColor: T.surface,
    borderWidth:     1,
    borderColor:     T.border,
    borderRadius:    14,
    padding:         16,
  },
  tileWide: { width: "100%" },
  tileIcon:  { width: 30, height: 30, borderRadius: 9, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileLabel: { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  tileValue: { color: T.text, fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },

  // ── Sections ──
  sections: { paddingHorizontal: 20 },
  card:     { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 14, overflow: "hidden" },

  // ── Modal ──
  eyebrow:     { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 2, marginBottom: 2 },
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, maxHeight: "92%", borderTopWidth: 1, borderColor: T.border, flexShrink: 1 },
  sheetPill:   { width: 36, height: 4, borderRadius: 2, backgroundColor: T.hi, alignSelf: "center", marginBottom: 24 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 },
  sheetTitle:  { color: T.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },

  pickerRow:     { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24 },
  pickerWrap:    { position: "relative" },
  pickerImg:     { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: T.hi },
  pickerFallback:{ backgroundColor: T.raised, alignItems: "center", justifyContent: "center" },
  pickerInitial: { fontSize: 24, fontWeight: "900", color: T.mid },
  pickerBadge:   { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: T.white, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.surface },
  pickerLabel:   { color: T.text, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  pickerHint:    { color: T.mid, fontSize: 11 },

  fieldDivider: { height: 1, backgroundColor: T.border, marginBottom: 22 },
  fieldBox:     { marginBottom: 18 },
  fieldLabel:   { color: T.dim, fontSize: 9, fontWeight: "700", letterSpacing: 1.8, marginBottom: 8 },
  field:        { backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 12, padding: 14, color: T.text, fontSize: 15 },
  fieldRow:     { flexDirection: "row", alignItems: "center", backgroundColor: T.raised, borderWidth: 1, borderColor: T.hi, borderRadius: 12, paddingLeft: 14 },
  fieldPrefix:  { color: T.mid, fontSize: 15, fontWeight: "600" },
  fieldFlex:    { flex: 1, borderWidth: 0, paddingLeft: 6 },

  roleGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip:       { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderRadius: 10 },
  roleChipOn:     { backgroundColor: T.white, borderColor: T.white },
  roleChipDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: T.black },
  roleChipText:   { color: T.mid, fontSize: 13, fontWeight: "600" },
  roleChipTextOn: { color: T.black },

  bar:          { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border },
  barBack:      { width: 48, height: 48, borderRadius: 14, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  barNext:      { flex: 1, height: 48, backgroundColor: T.white, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  barNextOff:   { backgroundColor: T.raised },
  barNextText:  { color: T.black, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
});