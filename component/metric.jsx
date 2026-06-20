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
import Authservice from "../services/authService";

const { height, width } = Dimensions.get("window");

function getDefaultQuestions() {
  return [
    {
      id: "sleep",
      question: "How did you sleep last night?",
      type: "emoji",
      options: [
        { value: 0, label: "Didn't sleep", sub: "0h" },
        { value: 1, label: "Rough",        sub: "2–4h" },
        { value: 2, label: "Light",        sub: "4–6h" },
        { value: 3, label: "Decent",       sub: "6–7h" },
        { value: 4, label: "Restored",     sub: "8h+" },
      ],
      metricType: "sleep",
    },
    {
      id: "mood",
      question: "What's your energy walking into today?",
      type: "emoji",
      options: [
        { value: 0, label: "Drained",   sub: "Running on empty" },
        { value: 1, label: "Low",       sub: "Barely there" },
        { value: 2, label: "Steady",    sub: "Getting by" },
        { value: 3, label: "Charged",   sub: "Ready to go" },
        { value: 4, label: "Locked in", sub: "Peak mode" },
      ],
      metricType: "mood",
    },
    {
      id: "study",
      question: "How many hours are you committing to deep work today?",
      type: "slider",
      unit: "hrs",
      min: 0,
      max: 12,
      step: 0.5,
      metricType: "study",
    },
    {
      id: "water",
      question: "Set your hydration target for today.",
      type: "selection",
      options: [
        { value: 1, label: "1L",  sub: "Minimum" },
        { value: 2, label: "2L",  sub: "Standard" },
        { value: 3, label: "3L",  sub: "Active" },
        { value: 4, label: "4L+", sub: "Athlete" },
      ],
      unit: "liters",
      metricType: "water",
    },
    {
      id: "focus",
      question: "What's the one thing that, if done, makes today a win?",
      type: "text",
      placeholder: "Be specific — vague goals stay dreams...",
      maxLength: 150,
      metricType: "focus",
    },
  ];
}

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
  const [alreadyFinished, setAlreadyFinished] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const errorShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const init = async () => {
      const finished = await MetricHistory();
      if (!finished) {
        loadQuestions();
      } else {
        setLoading(false);
        setAlreadyFinished(true);
      }
    };
    init().catch(console.error);
  }, []);

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const MetricHistory = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await Authservice.authFetch(MetricsEndpoints.GET_ALL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await response.json();
      return json?.done === true;
    } catch (error) {
      console.error("Error fetching metric history:", error);
      return false;
    }
  };

  const loadQuestions = () => {
    setFetchError(false);
    setLoading(true);
    try {
      setQuestions(getDefaultQuestions());
    } catch (error) {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScrollEnd = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
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
      metrics.push({ metricType: "focus", value: parseInt(answers.focus?.value) || 0, unit: "" });

      const token = await AsyncStorage.getItem("token");
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const response = await Authservice.authFetch(MetricsEndpoints.CREATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date, context: "daily", metrics }),
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
          <View style={styles.optionList}>
            {question.options.map((option) => {
              const selected = currentAnswer?.value === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  onPress={() => {
                    updateAnswer(question.id, option.value, question.metricType, "");
                    setTimeout(goToNext, 280);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionDot}>
                    {selected && <View style={styles.optionDotFilled} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {option.sub ? (
                      <Text style={styles.optionSub}>{option.sub}</Text>
                    ) : null}
                  </View>
                  {selected && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case "slider":
        return (
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>
              {currentAnswer?.value ?? 0}
              <Text style={styles.sliderUnit}> {question.unit}</Text>
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={question.min || 0}
              maximumValue={question.max || 12}
              step={question.step || 0.5}
              value={currentAnswer?.value ?? 0}
              onValueChange={(value) =>
                updateAnswer(question.id, value, question.metricType, question.unit)
              }
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="#2a2a2a"
              thumbTintColor="#fff"
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>{question.min ?? 0}</Text>
              <Text style={styles.sliderLabelText}>{question.max ?? 12}</Text>
            </View>
            <TouchableOpacity
              style={[styles.continueButton, !currentAnswer && styles.continueButtonDim]}
              onPress={goToNext}
              disabled={!currentAnswer}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case "number":
        return (
          <View style={styles.numberContainer}>
            <TextInput
              placeholder="0"
              placeholderTextColor="#333"
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
            <Text style={styles.numberUnit}>{question.unit}</Text>
            {question.baseline && (
              <Text style={styles.baselineText}>Goal: {question.baseline} {question.unit}</Text>
            )}
          </View>
        );

      case "selection":
        return (
          <View style={styles.optionList}>
            {question.options.map((option) => {
              const selected = currentAnswer?.value === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  onPress={() => {
                    updateAnswer(question.id, option.value, question.metricType, question.unit);
                    setTimeout(goToNext, 280);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionDot}>
                    {selected && <View style={styles.optionDotFilled} />}
                  </View>
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {option.sub ? (
                      <Text style={styles.optionSub}>{option.sub}</Text>
                    ) : null}
                  </View>
                  {selected && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        );

      case "text":
        return (
          <View style={styles.textContainer}>
            <TextInput
              placeholder={question.placeholder || "Type here..."}
              placeholderTextColor="#444"
              value={currentAnswer?.value || ""}
              onChangeText={(text) =>
                updateAnswer(question.id, text, question.metricType, "")
              }
              multiline
              style={styles.textInput}
              maxLength={question.maxLength}
            />
            <Text style={styles.charCount}>
              {(currentAnswer?.value || "").length}/{question.maxLength || 150}
            </Text>
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
        <Image source={require("../Images/mascotc.png")} style={styles.mascotImage} resizeMode="contain" />
        <Text style={styles.errorTitle}>Couldn't load questions</Text>
        <Text style={styles.errorSubtitle}>Check your connection and try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadQuestions}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (alreadyFinished) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Image source={require("../Images/mascotc.png")} style={styles.mascotImage} resizeMode="contain" />
        <Text style={styles.errorTitle}>You're done for today</Text>
        <Text style={styles.errorSubtitle}>Come back tomorrow morning.</Text>
      </View>
    );
  }

  if (showSuccess) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Animated.View style={[styles.successContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Image source={require("../Images/mascoti.png")} style={styles.mascotImage} resizeMode="contain" />
          <Text style={styles.successTitle}>Locked in.</Text>
          <Text style={styles.successMessage}>Your intentions for today are set.</Text>
        </Animated.View>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      {/* Progress bars — top */}
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

      <FlatList
        ref={flatListRef}
        data={questions}
        pagingEnabled
        horizontal
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.questionNumber}>
              {index + 1} <Text style={styles.questionNumberTotal}>/ {questions.length}</Text>
            </Text>
            <Text style={styles.question}>{item.question}</Text>

            {renderInput(item, index)}

            {index === questions.length - 1 && submitError && (
              <Animated.View
                style={[styles.submitErrorBanner, { transform: [{ translateX: errorShake }] }]}
              >
                <Text style={styles.submitErrorText}>{submitError}</Text>
              </Animated.View>
            )}

            {index === questions.length - 1 && answers[item.id] && (
              <TouchableOpacity
                style={[styles.finishButton, submitting && styles.finishButtonDisabled]}
                onPress={handleFinish}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.finishText}>Finish</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      />
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

  progressContainer: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: "#1e1e1e",
    borderRadius: 2,
  },
  activeBar: { backgroundColor: "#3a3a3a" },
  completedBar: { backgroundColor: "#fff" },

  card: {
    width,                      // ✅ each card = screen width
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  questionNumber: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 16,
  },
  questionNumberTotal: {
    color: "#444",
    fontWeight: "400",
  },
  question: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 36,
    marginBottom: 36,
  },

  optionList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    backgroundColor: "#0d0d0d",
    gap: 14,
  },
  optionRowSelected: {
    borderColor: "#fff",
    backgroundColor: "#111",
  },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotFilled: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    color: "#666",
    fontSize: 15,
    fontWeight: "500",
  },
  optionLabelSelected: {
    color: "#fff",
  },
  optionSub: {
    color: "#3a3a3a",
    fontSize: 12,
    marginTop: 2,
  },
  optionCheck: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  sliderContainer: { marginTop: 8 },
  sliderValue: {
    color: "#fff",
    fontSize: 52,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  sliderUnit: {
    fontSize: 20,
    fontWeight: "400",
    color: "#666",
  },
  slider: { width: "100%", height: 40 },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    color: "#444",
    fontSize: 12,
  },
  continueButton: {
    marginTop: 36,
    alignSelf: "center",
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#fff",
  },
  continueButtonDim: {
    borderColor: "#333",
  },
  continueText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  numberContainer: { marginTop: 8, alignItems: "center" },
  numberInput: {
    color: "#fff",
    fontSize: 64,
    fontWeight: "700",
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingVertical: 8,
    width: "60%",
  },
  numberUnit: {
    color: "#444",
    fontSize: 14,
    marginTop: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  baselineText: { color: "#555", fontSize: 13, textAlign: "center", marginTop: 10 },

  textContainer: { marginTop: 8 },
  textInput: {
    color: "#fff",
    fontSize: 17,
    minHeight: 100,
    textAlignVertical: "top",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingVertical: 12,
    lineHeight: 28,
  },
  charCount: {
    color: "#333",
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },

  finishButton: {
    marginTop: 40,
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: 30,
    minWidth: 160,
    alignItems: "center",
  },
  finishButtonDisabled: { opacity: 0.5 },
  finishText: { color: "#000", fontSize: 17, fontWeight: "700" },

  submitErrorBanner: {
    backgroundColor: "#0f0000",
    borderWidth: 1,
    borderColor: "#2a0000",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  submitErrorText: {
    color: "#ff5555",
    fontSize: 13,
    lineHeight: 18,
  },

  mascotImage: { width: 100, height: 100, marginBottom: 20 },
  errorTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  retryButton: {
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
  },
  retryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  successContainer: { alignItems: "center" },
  successTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 10,
  },
  successMessage: { color: "#555", fontSize: 15, textAlign: "center" },
});