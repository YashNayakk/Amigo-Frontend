import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MetricsEndpoints } from "../services/apis";

const { height, width } = Dimensions.get("window");

const Metric = () => {
  const navigation = useNavigation();
  const flatListRef = useRef(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [alreadyFinished, setAlreadyFinished] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    MetricHistory();

    if(alreadyFinished){
      fetchQuestions();
      console.log("fetching")
    }else{
      setLoading(false);
      setFetchError(true)
    }
  }, []);

  const today = new Date().toISOString().split("T")[0];



  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };
  const MetricHistory =() =>{
    try{
      const token = AsyncStorage.getItem("token");
      const response = fetch(MetricsEndpoints.GET_ALL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const data = response.json();
      if(today == data.date) setAlreadyFinished(true)
        else setAlreadyFinished(false)
    } catch (error) {
      console.error("Error fetching metric history:", error);
    }
  }

  const fetchQuestions = async () => {
    setFetchError(false);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(MetricsEndpoints.GET_QUESTIONS, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`Server error ${response.status}`);
      
      const data = await response.json();
      const qs = data.questions || [];
      if (qs.length === 0) throw new Error("No questions returned");
      setQuestions(qs);
    } catch (error) {
      console.error("Error fetching questions:", error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / height);
    setActiveIndex(index);
  };

  const updateAnswer = (questionId, value, metricType, unit) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value, metricType, unit },
    }));
  };

  const goToNext = () => {
    if (activeIndex < questions.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: activeIndex + 1,
        animated: true,
      });
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const requiredMetrics = ["sleep", "mood", "study", "water", "focus"];
      const missingMetrics = requiredMetrics.filter((metric) => !answers[metric]);

      if (missingMetrics.length > 0) {
        shakeAnimation();
        setSubmitError(`Please complete: ${missingMetrics.join(", ")}`);
        setSubmitting(false);
        return;
      }

      const metrics = [];

      if (answers.sleep)
        metrics.push({ metricType: "sleep", value: parseFloat(answers.sleep.value) || 0, unit: "hours" });
      if (answers.mood)
        metrics.push({ metricType: "mood", value: parseInt(answers.mood.value) || 0, unit: "" });
      if (answers.study)
        metrics.push({ metricType: "study", value: parseFloat(answers.study.value) || 0, unit: "hours" });
      if (answers.water)
        metrics.push({ metricType: "water", value: parseFloat(answers.water.value) || 0, unit: "liters" });

      metrics.push({
        metricType: "focus",
        value: parseInt(answers.focus?.value) || 0,
        unit: "",
      });

      const token = await AsyncStorage.getItem("token");
      const today = new Date().toISOString().split("T")[0];

      const response = await fetch(MetricsEndpoints.CREATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: today, context: "daily", metrics }),
      });

      const responseData = await response.json();

      if (response.ok) {
        setShowSuccess(true);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        ]).start();
        setTimeout(() => navigation.navigate("Tabs"), 2000);
      } else {
        shakeAnimation();
        setSubmitError(responseData.message || "Something went wrong. Please try again.");
        setSubmitting(false);
      }
    } catch (error) {
      console.error("Error submitting metrics:", error);
      shakeAnimation();
      setSubmitError("No internet? Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const renderInput = (question, index) => {
    const currentAnswer = answers[question.id];

    switch (question.type) {
      case "emoji":
        return (
          <View style={styles.emojiContainer}>
            {question.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.emojiOption,
                  currentAnswer?.value === option.value && styles.emojiOptionSelected,
                ]}
                onPress={() => {
                  updateAnswer(question.id, option.value, question.metricType, "");
                  setTimeout(goToNext, 300);
                }}
              >
                <Text style={styles.emojiIcon}>{option.emoji}</Text>
                <Text style={styles.emojiLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "slider":
        return (
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>
              {currentAnswer?.value || 0} {question.unit}
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={question.min || 0}
              maximumValue={question.max || 12}
              step={0.5}
              value={currentAnswer?.value || 0}
              onValueChange={(value) =>
                updateAnswer(question.id, value, question.metricType, question.unit)
              }
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#333"
              thumbTintColor="#fff"
            />
            <TouchableOpacity
              style={styles.continueButton}
              onPress={goToNext}
              disabled={!currentAnswer}
            >
              <Text style={styles.continueText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        );

      case "number":
        return (
          <View style={styles.numberContainer}>
            <TextInput
              placeholder="Enter hours..."
              placeholderTextColor="#666"
              value={currentAnswer?.value?.toString() || ""}
              onChangeText={(text) => {
                const num = parseFloat(text) || 0;
                updateAnswer(question.id, num, question.metricType, question.unit);
              }}
              keyboardType="decimal-pad"
              style={styles.numberInput}
              returnKeyType="done"
              onSubmitEditing={goToNext}
            />
            {question.baseline && (
              <Text style={styles.baselineText}>
                Goal: {question.baseline} {question.unit}
              </Text>
            )}
          </View>
        );

      case "selection":
        return (
          <View style={styles.selectionContainer}>
            {question.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.selectionOption,
                  currentAnswer?.value === option.value && styles.selectionOptionSelected,
                ]}
                onPress={() => {
                  updateAnswer(question.id, option.value, question.metricType, question.unit);
                  setTimeout(goToNext, 300);
                }}
              >
                <Text style={styles.selectionIcon}>{option.icon}</Text>
                <Text style={styles.selectionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case "text":
        return (
          <View style={styles.textContainer}>
            <TextInput
              placeholder={question.placeholder || "Type here..."}
              placeholderTextColor="#666"
              value={currentAnswer?.value || ""}
              onChangeText={(text) =>
                updateAnswer(question.id, text, question.metricType, "")
              }
              multiline
              style={styles.textInput}
              returnKeyType="done"
            />
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#fff" />
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
        <Text style={styles.errorTitle}>Couldn't load questions</Text>
        <Text style={styles.errorSubtitle}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchQuestions}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showSuccess) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Animated.View
          style={[
            styles.successContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Image
            source={require("../Images/mascoti.png")}
            style={styles.mascotImage}
            resizeMode="contain"
          />
          <Text style={styles.successTitle}>Great job!</Text>
          <Text style={styles.successMessage}>
            Your daily metrics have been recorded
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={questions}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.questionNumber}>
              {index + 1}/{questions.length}
            </Text>
            <Text style={styles.question}>{item.question}</Text>

            {renderInput(item, index)}

            {index === questions.length - 1 && submitError && (
              <Animated.View
                style={[
                  styles.submitErrorBanner,
                  { transform: [{ translateX: errorShake }] },
                ]}
              >
                <Image
                  source={require("../Images/mascotc.png")}
                  style={styles.mascotTiny}
                  resizeMode="contain"
                />
                <Text style={styles.submitErrorText}>{submitError}</Text>
              </Animated.View>
            )}

            {index === questions.length - 1 && answers[item.id] && (
              <TouchableOpacity
                style={[
                  styles.finishButton,
                  submitting && styles.finishButtonDisabled,
                ]}
                onPress={handleFinish}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.finishText}>Finish ✓</Text>
                )}
              </TouchableOpacity>
            )}

            {index > 0 && (
              <Text style={styles.swipeHint}>↑ Swipe up to change answer</Text>
            )}
          </View>
        )}
      />

      <View style={styles.progressContainer}>
        {questions.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressBar,
              activeIndex >= index && styles.activeBar,
              answers[questions[index]?.id] && styles.completedBar,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default Metric;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    height,
    paddingHorizontal: 24,
    paddingTop: height * 0.15,
    justifyContent: "flex-start",
  },
  questionNumber: {
    color: "#666",
    fontSize: 14,
    marginBottom: 12,
    fontWeight: "500",
  },
  question: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 38,
    marginBottom: 40,
  },
  // Mascot
  mascotImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  mascotTiny: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  // Error state
  errorTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  // Submit error banner
  submitErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a0000",
    borderWidth: 1,
    borderColor: "#3a0000",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  submitErrorText: {
    color: "#ff6b6b",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  // Emoji Input
  emojiContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
  },
  emojiOption: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#222",
    minWidth: 80,
    backgroundColor: "#111",
  },
  emojiOptionSelected: {
    borderColor: "#fff",
    backgroundColor: "#1a1a1a",
  },
  emojiIcon: { fontSize: 48, marginBottom: 8 },
  emojiLabel: { color: "#ccc", fontSize: 12, fontWeight: "500" },
  // Slider
  sliderContainer: { marginTop: 20 },
  sliderValue: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 32,
  },
  slider: { width: "100%", height: 40 },
  continueButton: {
    marginTop: 40,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#fff",
  },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  // Number
  numberContainer: { marginTop: 20 },
  numberInput: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "700",
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingVertical: 16,
  },
  baselineText: { color: "#666", fontSize: 14, textAlign: "center", marginTop: 12 },
  // Selection
  selectionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
  },
  selectionOption: {
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#222",
    minWidth: 100,
    backgroundColor: "#111",
  },
  selectionOptionSelected: { borderColor: "#fff", backgroundColor: "#1a1a1a" },
  selectionIcon: { fontSize: 40, marginBottom: 8 },
  selectionLabel: { color: "#ccc", fontSize: 14, fontWeight: "600" },
  // Text
  textContainer: { marginTop: 20 },
  textInput: {
    color: "#fff",
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: "top",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingVertical: 12,
    lineHeight: 28,
  },
  // Finish
  finishButton: {
    marginTop: 40,
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    minWidth: 160,
    alignItems: "center",
  },
  finishButtonDisabled: { opacity: 0.6 },
  finishText: { color: "#000", fontSize: 18, fontWeight: "700" },
  swipeHint: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    color: "#444",
    fontSize: 12,
  },
  // Progress
  progressContainer: {
    position: "absolute",
    bottom: 60,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: "#222",
    borderRadius: 4,
    maxWidth: 60,
  },
  activeBar: { backgroundColor: "#444" },
  completedBar: { backgroundColor: "#fff" },
  // Success
  successContainer: { alignItems: "center" },
  successTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 12,
  },
  successMessage: { color: "#999", fontSize: 16, textAlign: "center" },
});