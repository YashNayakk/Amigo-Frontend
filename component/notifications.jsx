import {
  StyleSheet, Text, TouchableOpacity, View,
  FlatList, Image, ActivityIndicator, Alert, Dimensions
} from "react-native";
import React, { useEffect, useState } from "react";
import { WitnessEndpoints } from "../services/apis";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from 'react-native-dotenv';
import AuthService from "../services/authService";

const { width } = Dimensions.get("window");

const T = {
  bg: "#080808",
  surface: "#101010",
  raised: "#181818",
  border: "#1e1e1e",
  hi: "#2a2a2a",
  text: "#efefef",
  mid: "#888",
  dim: "#444",
  white: "#ffffff",
  black: "#000000",
};

const SERVER_BASE = (BASE_URL || "")
  .replace(/\/+$/, "")       
  .replace(/\/api$/, "");    

const resolveImageUri = (path) => {
  if (!path || typeof path !== "string" || path.trim() === "") return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("file://") || path.startsWith("content://")) {
    return path;
  }

  const separator = path.startsWith("/") ? "" : "/";
  const resolved = `${SERVER_BASE}${separator}${path}`;
  return resolved;
};

const Notifications = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const token = await AsyncStorage.getItem("token");

      const response = await AuthService.authFetch(WitnessEndpoints.GET_ALL_REQUESTS, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const res = await response.json();
      if (res.success) {
        setRequests(res.data);
      } else {
        throw new Error(res.message || "Failed to load");
      }
    } catch (error) {
      console.error("Error loading requests:", error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      setProcessingId(id);
      const token = await AsyncStorage.getItem("token");

      const response = await AuthService.authFetch(WitnessEndpoints.SEND_RESPOND, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: id, action: "accept" }),
      });

      const res = await response.json();

      if (res.success) {
        setRequests((prev) => prev.filter((req) => req._id !== id));
        Alert.alert("Success", "Witness request accepted!");
      } else {
        Alert.alert("Error", res.message || "Failed to accept request");
      }
    } catch (error) {
      console.error("Error accepting request:", error);
      Alert.alert("Oops!", "Couldn't accept right now. Check your connection.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleIgnore = async (id) => {
    try {
      setProcessingId(id);
      const token = await AsyncStorage.getItem("token");

      const response = await AuthService.authFetch(WitnessEndpoints.SEND_RESPOND, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: id, action: "decline" }),
      });

      const res = await response.json();

      if (res.success) {
        setRequests((prev) => prev.filter((req) => req._id !== id));
      } else {
        Alert.alert("Error", res.message || "Failed to decline request");
      }
    } catch (error) {
      console.error("Error declining request:", error);
      Alert.alert("Oops!", "Couldn't decline right now. Check your connection.");
    } finally {
      setProcessingId(null);
    }
  };

  const Avatar = ({ uri, initial, style, initialStyle }) => {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Reset states when URI changes
    useEffect(() => {
      setHasError(false);
      setIsLoading(true);
    }, [uri]);

    if (uri && !hasError) {
      return (
        <View style={style}>
          <Image
            source={{
              uri,
              headers: { Pragma: "no-cache" },
            }}
            style={[style, { position: 'absolute', top: 0, left: 0 }]}
            resizeMode="cover"
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={(e) => {
              console.warn("[Avatar] Failed to load:", uri, e.nativeEvent?.error);
              setHasError(true);
              setIsLoading(false);
            }}
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
        <Text style={initialStyle}>{initial || "?"}</Text>
      </View>
    );
  };

  const renderRequestItem = ({ item }) => {
    const isProcessing = processingId === item._id;

    const initial = (item?.requester?.name || "?").charAt(0).toUpperCase();
    const avatarUri = resolveImageUri(item?.requester?.profilePicture);

    return (
      <View style={styles.card}>
        <Avatar
          uri={avatarUri}
          initial={initial}
          style={s.avatar}
          initialStyle={s.avatarInitial}
        />
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.requester.name}</Text>
          <Text style={styles.status}>Wants to be your witness</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.acceptBtn, isProcessing && styles.disabledBtn]}
              onPress={() => handleAccept(item?.requestId)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Text style={styles.acceptText}>Accept</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ignoreBtn, isProcessing && styles.disabledBtn]}
              onPress={() => handleIgnore(item._id)}
              disabled={isProcessing}
            >
              <Text style={styles.ignoreText}>Ignore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Image
          source={require("../Images/mascotc.png")}
          style={styles.mascotImage}
          resizeMode="contain"
        />
        <Text style={styles.errorTitle}>Couldn't load requests</Text>
        <Text style={styles.errorSubtitle}>
          Something went wrong. Check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRequests}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item._id}
        renderItem={renderRequestItem}
        contentContainerStyle={{ paddingTop: 30, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Image
              source={require("../Images/mascoti.png")}
              style={styles.mascotImage}
              resizeMode="contain"
            />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>No new witness requests</Text>
          </View>
        }
      />
    </View>
  );
};

export default Notifications;


const s = StyleSheet.create({
  avatar: { width: 70, height: 70, borderRadius: 13, borderWidth: 1.5, borderColor: T.surface },
  avatarFallback: { backgroundColor: T.raised, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 32, fontWeight: "900", color: T.mid, letterSpacing: -1 },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F0F",
    padding: 16,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  mascotImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  errorSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 20,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 13,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    gap:16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  textContainer: { flex: 1 },
  name: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  status: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  actions: { flexDirection: "row", marginTop: 10 },
  acceptBtn: {
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 70,
    alignItems: "center",
  },
  acceptText: { color: "#0F172A", fontWeight: "600" },
  ignoreBtn: {
    backgroundColor: "#27272A",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  ignoreText: { color: "#E5E7EB" },
  disabledBtn: { opacity: 0.6 },
});