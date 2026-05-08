import {
  StyleSheet, Text, TouchableOpacity, View,
  FlatList, Image, ActivityIndicator, Alert,
} from "react-native";
import React, { useEffect, useState } from "react";
import { WitnessEndpoints } from "../services/apis";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

const Notifications = () => {
  const navigation = useNavigation();

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

      const response = await fetch(WitnessEndpoints.GET_ALL_REQUESTS, {
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

      const response = await fetch(WitnessEndpoints.SEND_RESPOND, {
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
        navigation.navigate("Impengo");
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

      const response = await fetch(WitnessEndpoints.SEND_RESPOND, {
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

  const renderRequestItem = ({ item }) => {
    const isProcessing = processingId === item._id;

    return (
      <View style={styles.card}>
        <Image
          source={{ uri: item.requester.profilePicture }}
          style={styles.avatar}
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
  // Mascot
  mascotImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  // Error state
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
  // Empty state
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
  // Cards
  card: {
    flexDirection: "row",
    backgroundColor: "#1A1A1A",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
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