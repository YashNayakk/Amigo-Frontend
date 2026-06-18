import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
} from "react-native";
import React, { useState, useEffect } from "react";
import Carousel from "react-native-reanimated-carousel";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HabitScreen from "../component/HabitsSection";
import { PerformanceEndpoints } from "../services/apis";
import Icon from 'react-native-vector-icons/Ionicons';
import { useMemo } from 'react';
import NetInfo from "@react-native-community/netinfo";
import AuthService from "../services/authService";

const { width, height } = Dimensions.get("window");

const T = {
  bg: '#080808', surface: '#101010', raised: '#181818',
  border: '#1e1e1e', hi: '#2a2a2a',
  text: '#efefef', mid: '#888', dim: '#444',
  white: '#ffffff', black: '#000000',
};

const qoutes = [
  // Resilience
  { text: "It ain't about how hard you hit. It's about how hard you can get hit and keep moving forward.", movie: "Rocky Balboa, 2006" },
  { text: "You got a dream, you gotta protect it.", movie: "The Pursuit of Happyness, 2006" },
  { text: "What we do in life echoes in eternity.", movie: "Gladiator, 2000" },
  { text: "Do not go gentle into that good night.", movie: "Interstellar, 2014" },
  { text: "Why do we fall? So we can learn to pick ourselves up.", movie: "Batman Begins, 2005" },

  // Identity & Purpose
  { text: "Remember who you are.", movie: "The Lion King, 1994" },
  { text: "To infinity and beyond.", movie: "Toy Story, 1995" },
  { text: "Just keep swimming.", movie: "Finding Nemo, 2003" },
  { text: "The flower that blooms in adversity is the most rare and beautiful of all.", movie: "Mulan, 1998" },
  { text: "Even the smallest person can change the course of the future.", movie: "The Lord of the Rings, 2001" },

  // Courage
  { text: "You is kind, you is smart, you is important.", movie: "The Help, 2011" },
  { text: "Every passing minute is another chance to turn it all around.", movie: "Vanilla Sky, 2001" },
  { text: "Our lives are defined by opportunities, even the ones we miss.", movie: "The Curious Case of Benjamin Button, 2008" },
  { text: "It is not our abilities that show what we truly are. It is our choices.", movie: "Harry Potter and the Chamber of Secrets, 2002" },
  { text: "Nobody is gonna hit as hard as life, but it ain't about how hard you can hit.", movie: "Rocky Balboa, 2006" },

  // Legacy & Time
  { text: "All those moments will be lost in time, like tears in rain.", movie: "Blade Runner, 1982" },
  { text: "After all, tomorrow is another day.", movie: "Gone with the Wind, 1939" },
  { text: "The stuff that dreams are made of.", movie: "The Maltese Falcon, 1941" },
  { text: "You have to go on and not let the world know it got you.", movie: "Forrest Gump, 1994" },

  // Hunger & Ambition
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", movie: "Little Women, 2019" },
  { text: "The world ain't all sunshine and rainbows.", movie: "Rocky Balboa, 2006" },
];


const Home = ({ navigation }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userName, setUserName] = useState("Friend");
  const [currentDate, setCurrentDate] = useState("");
  const [greeting, setGreeting] = useState("Good Evening");
  const [stats, setStats] = useState({
    streak: 0,
    reward: 0,
    score: 0,
    momentum: 0,
  });
  const [state, setState] = useState(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setState(state);
    });
    NetInfo.fetch().then(setState);
    return()=> unsubscribe();
  }, [])

  useEffect(() => {
    loadUserData();
    updateGreeting();
    formatDate();
    loadPerformanceData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await AsyncStorage.getItem("user");
      if (user) {
        const userData = JSON.parse(user);
        setUserName(userData.name || "Friend");
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadPerformanceData = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      // Fetch performance data
      const perfResponse = await AuthService.authFetch(PerformanceEndpoints.GET_PERFORMANCE, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
      });
      const perfData = await perfResponse.json();
      console.log("perfd", perfData)

      setStats({
        streak: perfData?.data?.currentStreak,
        reward: perfData?.data?.focus?.totalPoints,
        score: perfData?.data?.score,
        momentum: perfData?.data?.momentum,
      })
    } catch (error) {
      console.error("Error loading performance:", error);
    } finally {
      console.log("hii")
    }
  };

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  };

  const formatDate = () => {
    const date = new Date();
    const options = { day: "numeric", month: "short" };
    setCurrentDate(date.toLocaleDateString("en-US", options));
  };

  const QuoteCard = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.bigQuote}>"</Text>
      <Text style={styles.quoteText}>{item.text}</Text>
      <Text style={styles.movieText}>— {item.movie}</Text>
    </View>
  );

  const getDailyQuotes = () => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    const seededRandom = (s) => {
      let x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    const indices = Array.from({ length: qoutes.length }, (_, i) => i);

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seed + i) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    return [indices[0], indices[1], indices[2]].map(i => qoutes[i]);
  };
  const dailyQuotes = useMemo(() => getDailyQuotes(), []);


  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {userName}</Text>
            <Text style={styles.date}>{currentDate}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate("Showcase")}
          >
            <Icon name="people-outline" size={22} color={T.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.carouselContainer}>
          <Carousel
            width={width - 32}
            height={140}
            autoPlay
            autoPlayInterval={4000}
            data={dailyQuotes}
            scrollAnimationDuration={1000}
            onSnapToItem={(index) => setActiveIndex(index)}
            renderItem={({ item }) => (
              <View style={{
                flex: 1,
                marginHorizontal: 6,
              }}>
                <QuoteCard item={item} />
              </View>)}
          />
          <View style={styles.dotsContainer}>
            {dailyQuotes.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, activeIndex === index && styles.activeDot]}
              />
            ))}
          </View>
        </View>

        <View style={styles.dashboard}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.reward}</Text>
              <Text style={styles.statLabel}>Reward</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.score}</Text>
              <Text style={styles.statLabel}>Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.momentum}</Text>
              <Text style={styles.statLabel}>Momentum</Text>
            </View>
          </View>
        </View>

        {state?.isConnected ?
          <View style={styles.mascotSection}>
            <Image
              style={styles.mascot}
              source={require("../Images/mascoti.png")}
            />
            <View style={styles.speechBubble}>
              <Text style={styles.mascotText}>
                How's the day going?</Text>
            </View>
          </View> :
          <View style={styles.mascotSection}>
            <Image
              style={styles.mascot}
              source={require("../Images/mascotc.png")}
            />
            <View style={styles.speechBubble}>
              <Text style={styles.mascotTextError}>
                No internet connection</Text>
            </View>
          </View>

        }

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("Metrics")}
          >
            <Text style={styles.actionButtonText}>Check-in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate("FlipPhone")}
          >
            <Text style={styles.actionButtonText}>Flip Phone</Text>
          </TouchableOpacity>
        </View>

        <HabitScreen />
      </ScrollView>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContent: {
    paddingBottom: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 20,
  },
  greeting: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  date: {
    color: "#999",
    fontSize: 14,
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.black,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: T.border,
  },
  profileIcon: {
    fontSize: 20,
  },

  card: {
    flex: 1,
    //width: width - 32,
    height: 140,
    backgroundColor: T.surface,       // #101010
    borderWidth: 0.5,
    borderColor: T.border,             // #1e1e1e
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bigQuote: {
    position: 'absolute',
    top: -8,
    left: 12,
    fontSize: 80,
    color: T.hi,                       // #2a2a2a
    fontFamily: 'serif',
    lineHeight: 90,
  },
  quoteText: {
    fontSize: 16,
    color: T.text,                     // #efefef
    fontStyle: 'italic',
    fontFamily: 'serif',               // or your custom serif font
    lineHeight: 20,
    marginBottom: 10,
    zIndex: 1,
  },
  movieText: {
    fontSize: 12,
    color: T.dim,                      // #444
    fontFamily: 'sans-serif',
    zIndex: 1,
  },

  // CAROUSEL
  carouselContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  sliderImage: {
    width: width - 32,
    height: 140,
    borderRadius: 20,
    marginHorizontal: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
    marginHorizontal: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: "#fff",
  },

  // DASHBOARD STATS
  dashboard: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: T.border,
  },
  statValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    color: "#ecdcdc",
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // MASCOT SECTION
  mascotSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 16,
  },
  mascot: {
    width: 80,
    height: 80,
    resizeMode: "contain",
  },
  speechBubble: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    position: "relative",
  },
  mascotText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  mascotTextError: {
    color: "#ff4d4d",
    fontSize: 16,
    fontWeight: "500",
  },

  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: T.white,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: T.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  actionButtonText: {
    color: T.dim,
    fontSize: 16,
    fontWeight: "700",
  },

  habitsSection: {
    paddingHorizontal: 20,
  },
  habitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  habitTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#000",
    fontSize: 24,
    fontWeight: "600",
  },

  // HABIT TABLE
  habitTable: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  tableHeader: {
    flexDirection: "row",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    marginBottom: 12,
  },
  tableHeaderText: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flex: 1,
    textTransform: "uppercase",
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  habitNameContainer: {
    flex: 2,
  },
  habitName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  habitTarget: {
    color: "#666",
    fontSize: 11,
  },
  dayCell: {
    flex: 1,
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  menuButton: {
    flex: 1,
    alignItems: "center",
  },
  menuIcon: {
    color: "#999",
    fontSize: 20,
    fontWeight: "700",
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width - 40,
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    color: "#999",
    fontSize: 28,
    fontWeight: "300",
  },
  modalInput: {
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "700",
  },
});