import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Dimensions, ActivityIndicator, Image,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { PerformanceEndpoints, HabitEndpoints } from '../services/apis';
import { getSocket } from '../services/SocketService';
import AuthService from '../services/authService';


const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PAD = 24;
const CHART_WIDTH = SCREEN_WIDTH - H_PAD * 2;
const STAT_GAP = 10;
const STAT_WIDTH = Math.floor((CHART_WIDTH - STAT_GAP * 2) / 3);

const HABIT_COLORS = ['#7CFF9B', '#5B9EFF', '#FF7C7C', '#FFD97C', '#C47CFF', '#7CFFEF'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const fmt1 = (v) => Number(v || 0).toFixed(1);
const fmt2 = (v) => Number(v || 0).toFixed(2);
const hexRgba = (hex, op) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${op})`;
};

const getInsight = ({ consistency, momentum, currentStreak }) => {
    const mom = parseFloat(momentum);
    if (consistency >= 80 && mom > 0) return 'Exceptional consistency. Momentum is positive.';
    if (consistency >= 60) return 'Great progress. Keep the momentum going.';
    if (currentStreak >= 7) return 'Strong streak. Real habits are forming.';
    if (consistency >= 40) return 'On the right track. Push for more days.';
    if (consistency >= 20) return 'Small steps count. Try to show up more often.';
    return "Every day is a new start. Let's build something.";
};


const buildMetricChart = (arr, windowDays) => {
    if (!arr || arr.length < 2) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    const filtered = arr.filter(p => new Date(p.date) >= cutoff);
    if (filtered.length < 2) return null;
    const step = Math.max(1, Math.floor(filtered.length / 12));
    const sampled = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);
    return {
        labels: sampled.map(p => { const d = new Date(p.date); return `${d.getDate()}/${d.getMonth() + 1}`; }),
        datasets: [{ data: sampled.map(p => Math.max(0, parseFloat(p.value) || 0)) }],
    };
};

const buildMeasurableChart = (habit, windowDays) => {
    const logs = habit?.logs;
    if (!logs || logs.length < 2) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    const sorted = logs
        .filter(l => new Date(l.date) >= cutoff)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length < 2) return null;
    const step = Math.max(1, Math.floor(sorted.length / 12));
    const sampled = sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1);
    let values = sampled.map(l => Math.max(0, parseFloat(l.value) || 0));
    if (values.every(v => v === values[0])) values[values.length - 1] += 0.001;
    return {
        labels: sampled.map(l => { const d = new Date(l.date); return `${d.getDate()}/${d.getMonth() + 1}`; }),
        datasets: [{ data: values }],
    };
};

const buildYesNoWeeklyChart = (habit, windowDays) => {
    const logs = habit?.logs;
    if (!logs || logs.length === 0) return null;

    // Determine how many weeks to show based on windowDays
    const weeksToShow = windowDays <= 7 ? 1 : windowDays <= 30 ? 4 : 8;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const weeks = [];
    for (let w = weeksToShow - 1; w >= 0; w--) {
        const end = new Date(today);
        end.setDate(end.getDate() - w * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        weeks.push({ start, end, count: 0 });
    }

    logs.forEach(l => {
        if (!l.completed) return;
        const logDate = new Date(l.date);
        for (const week of weeks) {
            if (logDate >= week.start && logDate <= week.end) {
                week.count++;
                break;
            }
        }
    });

    if (weeks.every(w => w.count === 0)) return null;

    return {
        labels: weeks.map(w => {
            const d = w.end;
            return `${d.getDate()}/${d.getMonth() + 1}`;
        }),
        datasets: [{ data: weeks.map(w => w.count) }],
    };
};


const WeeklyBarChart = React.memo(({ data, color, height = 120 }) => {
    if (!data) {
        return (
            <View style={[mcs.empty, { height }]}>
                <Text style={mcs.title}>Not enough data yet</Text>
                <Text style={mcs.sub}>Keep logging to see your weekly trend</Text>
            </View>
        );
    }
    return (
        <BarChart
            data={data}
            width={CHART_WIDTH}
            height={height}
            fromZero
            withInnerLines={false}
            showBarTops={false}
            chartConfig={{
                backgroundColor: '#151518',
                backgroundGradientFrom: '#151518',
                backgroundGradientTo: '#151518',
                decimalPlaces: 0,
                color: (op = 1) => hexRgba(color, op),
                labelColor: (op = 1) => `rgba(74,74,94,${op})`,
                barPercentage: 0.6,
            }}
            style={{ borderRadius: 12 }}
        />
    );
});

const MiniChart = React.memo(({ data, color = '#7CFF9B', height = 130 }) => {
    if (!data) {
        return (
            <View style={[mcs.empty, { height }]}>
                <Text style={mcs.title}>Not enough data yet</Text>
                <Text style={mcs.sub}>Keep logging to see your trend</Text>
            </View>
        );
    }
    return (
        <LineChart
            data={data}
            width={CHART_WIDTH}
            height={height}
            withInnerLines={false}
            withOuterLines={false}
            withShadow={false}
            chartConfig={{
                backgroundColor: '#151518',
                backgroundGradientFrom: '#151518',
                backgroundGradientTo: '#151518',
                decimalPlaces: 1,
                color: (op = 1) => hexRgba(color, op),
                labelColor: (op = 1) => `rgba(74,74,94,${op})`,
                propsForDots: { r: '3', strokeWidth: '1.5', stroke: color, fill: '#151518' },
            }}
            bezier
            style={{ borderRadius: 12 }}
        />
    );
});

const mcs = StyleSheet.create({
    empty: { backgroundColor: '#151518', borderRadius: 12, borderWidth: 1, borderColor: '#1E1E26', alignItems: 'center', justifyContent: 'center' },
    title: { color: '#CCCCDD', fontSize: 13, fontWeight: '600', marginBottom: 4 },
    sub: { color: '#4A4A5E', fontSize: 11 },
});


const HabitGraphCard = React.memo(({ habit, color, windowDays }) => {
    const isYesNo = habit.type === 'yesno';

    const chartData = useMemo(() =>
        isYesNo
            ? buildYesNoWeeklyChart(habit, windowDays)
            : buildMeasurableChart(habit, windowDays),
        [habit, windowDays, isYesNo]
    );

    const { completedCount, totalLogged, pct } = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const recent = (habit.logs || []).filter(l => new Date(l.date) >= cutoff);
        const done = isYesNo
            ? recent.filter(l => l.completed).length
            : recent.filter(l => parseFloat(l.value) >= (habit.target || 0)).length;
        return {
            completedCount: done,
            totalLogged: recent.length,
            pct: recent.length > 0 ? Math.round((done / recent.length) * 100) : 0,
        };
    }, [habit, isYesNo]);

    return (
        <View style={hgc.card}>
            {/* Header */}
            <View style={hgc.header}>
                <View style={[hgc.bar, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                    <Text style={hgc.name}>{habit.name}</Text>
                    <Text style={hgc.meta}>
                        {habit.frequency}
                        {!isYesNo ? `  ·  target: ${habit.target} ${habit.unit}` : '  ·  yes / no'}
                    </Text>
                </View>
            </View>

            {/* Pills */}
            <View style={hgc.pillRow}>
                {habit.streak > 0 && (
                    <View style={[hgc.pill, { borderColor: color + '55' }]}>
                        <Text style={[hgc.pillTxt, { color }]}> {habit.streak}d streak</Text>
                    </View>
                )}
                <View style={[hgc.pill, { borderColor: '#1E1E26', marginLeft: habit.streak > 0 ? 8 : 0 }]}>
                    <Text style={hgc.pillTxt}>{pct}%  ·  {completedCount}/{totalLogged} this month</Text>
                </View>
            </View>

            <View style={hgc.chartWrap}>
                {isYesNo
                    ? <WeeklyBarChart data={chartData} color={color} height={120} />
                    : <MiniChart data={chartData} color={color} height={120} />
                }
            </View>

            {/* Axis hint */}
            <Text style={hgc.axisHint}>
                {isYesNo ? 'days completed per week' : habit.unit}
            </Text>
        </View>
    );
});

const hgc = StyleSheet.create({
    card: { backgroundColor: '#151518', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E26', padding: 16, marginBottom: 16 },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    bar: { width: 3, height: 38, borderRadius: 2, marginRight: 12, marginTop: 2 },
    name: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.3, marginBottom: 3 },
    meta: { color: '#4A4A5E', fontSize: 11, textTransform: 'capitalize' },
    pillRow: { flexDirection: 'row', marginBottom: 14, flexWrap: 'wrap' },
    pill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
    pillTxt: { color: '#CCCCDD', fontSize: 11, fontWeight: '600' },
    chartWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#1E1E26' },
    axisHint: { color: '#4A4A5E', fontSize: 10, marginTop: 8, textAlign: 'right' },
});



const ld = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
    txt: { color: '#4A4A5E', fontSize: 11, fontWeight: '600' },
});


const MonthCalendar = React.memo(({ calendarData, selectedMonth, onMonthChange }) => {
    const today = new Date();

    const lookup = useMemo(() => {
        const m = {};
        (calendarData || []).forEach(d => {
            const dt = new Date(d.date);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            m[key] = d;
        });
        return m;
    }, [calendarData]);

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const isCurrent = year === today.getFullYear() && month === today.getMonth();
    const cellSize = Math.floor((CHART_WIDTH - 32 - 6 * 4) / 7);

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <View>
            <View style={cal.nav}>
                <TouchableOpacity onPress={() => onMonthChange(-1)} style={cal.navBtn}>
                    <Text style={cal.arrow}>‹</Text>
                </TouchableOpacity>
                <Text style={cal.navTitle}>{MONTH_NAMES[month]} {year}</Text>
                <TouchableOpacity onPress={() => onMonthChange(1)} style={cal.navBtn} disabled={isCurrent}>
                    <Text style={[cal.arrow, isCurrent && cal.arrowDim]}>›</Text>
                </TouchableOpacity>
            </View>

            <View style={cal.headerRow}>
                {DAY_LABELS.map(l => (
                    <View key={l} style={[cal.dayHeader, { width: cellSize }]}>
                        <Text style={cal.dayHeaderTxt}>{l}</Text>
                    </View>
                ))}
            </View>

            <View style={cal.grid}>
                {cells.map((day, i) => {
                    if (!day) return <View key={`b${i}`} style={{ width: cellSize, height: cellSize, margin: 2 }} />;

                    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const entry = lookup[key];
                    const isToday = isCurrent && day === today.getDate();
                    const fillOp = entry?.completed
                        ? entry.intensity >= 0.75 ? 1
                            : entry.intensity >= 0.45 ? 0.65
                                : entry.intensity >= 0.2 ? 0.38
                                    : 0.2
                        : 0;

                    return (
                        <View key={key} style={[cal.cell, { width: cellSize, height: cellSize }, isToday && cal.cellToday]}>
                            {fillOp > 0 && (
                                <View style={[StyleSheet.absoluteFill, cal.cellFill, { opacity: fillOp }]} />
                            )}
                            <Text style={[cal.dayNum, isToday && cal.dayNumToday, entry?.completed && cal.dayNumDone]}>
                                {day}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <View style={cal.legend}>
                <Text style={cal.legendTxt}>None</Text>
                {[0.2, 0.38, 0.65, 1].map((op, i) => (
                    <View key={i} style={[cal.legendCell, { opacity: op }]} />
                ))}
                <Text style={cal.legendTxt}>High</Text>
            </View>
        </View>
    );
});

const cal = StyleSheet.create({
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    navBtn: { padding: 6 },
    arrow: { color: '#CCCCDD', fontSize: 24, fontWeight: '300', lineHeight: 28 },
    arrowDim: { color: '#2A2A35' },
    navTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    headerRow: { flexDirection: 'row', marginBottom: 4 },
    dayHeader: { alignItems: 'center', margin: 2 },
    dayHeaderTxt: { color: '#4A4A5E', fontSize: 10, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { margin: 2, borderRadius: 6, overflow: 'hidden', backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#1E1E26', alignItems: 'center', justifyContent: 'center' },
    cellFill: { backgroundColor: '#7CFF9B', borderRadius: 6 },
    cellToday: { borderColor: '#7CFF9B', borderWidth: 1.5 },
    dayNum: { color: '#4A4A5E', fontSize: 11, fontWeight: '500', zIndex: 1 },
    dayNumToday: { color: '#FFFFFF', fontWeight: '700' },
    dayNumDone: { color: '#CCCCDD' },
    legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 },
    legendTxt: { color: '#4A4A5E', fontSize: 10, marginHorizontal: 4 },
    legendCell: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#7CFF9B', marginHorizontal: 2 },
});


const Performance = () => {
    const [perf, setPerf] = useState(null);
    const [habits, setHabits] = useState([]);
    const [graphType, setGraphType] = useState('simple');
    const [windowDays, setWindowDays] = useState(30);

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date(); d.setDate(1); return d;
    });
    ///const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        //setLoading(true)
        try {
            const token = await AsyncStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [perfRes, habitsRes] = await Promise.all([
                AuthService.authFetch(PerformanceEndpoints.GET_PERFORMANCE, { headers }),
                AuthService.authFetch(HabitEndpoints.GET_ALL, { headers }),
            ]);

            const perfJson = await perfRes.json();
            const habitsJson = await habitsRes.json();

            const perfData = perfJson?.data || perfJson || null;
            const habitsRaw = habitsJson?.data || habitsJson || [];

            setPerf(perfData);

            const merged = Array.isArray(habitsRaw)
                ? habitsRaw.map(h => {
                    const fromPerf = (perfData?.habits || []).find(
                        ph => String(ph._id) === String(h._id)
                    );
                    return { ...h, logs: h.logs?.length ? h.logs : (fromPerf?.logs ?? []) };
                })
                : [];

            setHabits(merged);
        } catch (err) {
            console.error('Performance fetch error:', err);
        } finally {
            //setLoading(false)
        }

    };

    /*if (loading) {
        return (
            <View style={[s.container, s.centered]}>
                <ActivityIndicator size="large" color="#7CFF9B" />
                <Text style={s.loadingTxt}>Loading performance…</Text>
            </View>
        );
    }*/

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const stats = useMemo(() => ({
        currentStreak: perf?.currentStreak ?? 0,
        bestStreak: perf?.bestStreak ?? 0,
        reward: perf?.focus?.totalPoints ?? 0,
        habitScore: perf?.habitScore ?? 0,
        finalScore: perf?.score ?? 0,
        momentum: perf?.momentum ?? 0,
        consistency: perf?.consistency ?? 0,
    }), [perf]);

    const metricChartData = useMemo(() => {
        const arr = graphType === 'simple' ? perf?.simpleGraph : perf?.momentumGraph;
        return buildMetricChart(arr, windowDays);
    }, [perf, graphType, windowDays]);

    const calendarData = useMemo(() => {
        if (perf?.calendar?.length) return perf.calendar;
        const days = []; const t = new Date();
        for (let i = 89; i >= 0; i--) {
            const d = new Date(t); d.setDate(d.getDate() - i);
            days.push({ date: d, completed: false, intensity: 0 });
        }
        return days;
    }, [perf]);

    const handleMonthChange = useCallback((delta) => {
        setSelectedMonth(prev => {
            const d = new Date(prev);
            d.setMonth(d.getMonth() + delta);
            return d;
        });
    }, []);


    return (
        <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }>

            {/* Header */}
            <View style={s.header}>
                <View style={s.headerRow}>
                    <View>
                        <Text style={s.title}>Performance</Text>
                        <Text style={s.subtitle}>Your progress over time</Text>
                    </View>
                </View>
            </View>

            {/* Overall score */}
            <View style={s.scoreCard}>
                <Text style={s.scoreLabel}>Overall Score</Text>
                <Text style={s.scoreBig}>{fmt1(stats.finalScore)}</Text>
                
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
                {[
                    { label: 'Streak', value: `${stats.currentStreak}d` },
                    { label: 'Best Streak', value: `${stats.bestStreak}d` },
                    { label: 'Consistency', value: `${stats.consistency}%` },
                    { label: 'Momentum', value: fmt2(stats.momentum) },
                    { label: 'Reward', value: fmt1(stats.reward) },
                    { label: 'Habit Avg', value: fmt1(stats.habitScore) },
                ].map(({ label, value }) => (
                    <View key={label} style={s.statCard}>
                        <Text style={s.statValue}>{value}</Text>
                        <Text style={s.statLabel}>{label}</Text>
                    </View>
                ))}
            </View>

            {/* Metric Score Graph */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Check-in</Text>
                <Text style={s.sectionSub}>From your daily check-in's</Text>
                <View style={s.controlRow}>
                    <View style={s.segmented}>
                        {[['simple', 'Score'], ['momentum', 'Momentum']].map(([key, lbl]) => (
                            <TouchableOpacity
                                key={key}
                                style={[s.segBtn, graphType === key && s.segBtnOn]}
                                onPress={() => setGraphType(key)}
                            >
                                <Text style={[s.segTxt, graphType === key && s.segTxtOn]}>{lbl}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={s.winRow}>
                        {[[7, '1w'], [30, '1m'], [365, '1y']].map(([days, lbl]) => (
                            <TouchableOpacity
                                key={days}
                                style={[s.winBtn, windowDays === days && s.winBtnOn]}
                                onPress={() => setWindowDays(days)}
                            >
                                <Text style={[s.winTxt, windowDays === days && s.winTxtOn]}>{lbl}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={s.chartWrap}>
                    <MiniChart data={metricChartData} color="#7CFF9B" height={196} />
                </View>
            </View>

            {/* Habit Graphs */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Habits</Text>
                <Text style={s.sectionSub}>
                    {habits.length > 0
                        ? `${habits.length} active habit${habits.length > 1 ? 's' : ''}  ·  last ${windowDays}d`
                        : 'No active habits yet'}
                </Text>
                {habits.length === 0 ? (
                    <View style={s.emptyCard}>
                        <Text style={s.emptyTitle}>No habits to display</Text>
                        <Text style={s.emptySub}>Create habits and start logging them to see trends here.</Text>
                    </View>
                ) : (
                    habits.map((habit, i) => (
                        <HabitGraphCard
                            key={habit._id || i}
                            habit={habit}
                            color={HABIT_COLORS[i % HABIT_COLORS.length]}
                            windowDays={windowDays}
                        />
                    ))
                )}
            </View>

            {/* Mascot insight */}
            <View style={s.insightRow}>
                <Image source={require('../Images/mascoti.png')} style={s.mascot} resizeMode="contain" />
                <View style={s.insightBubble}>
                    <Text style={s.insightEyebrow}>Insight</Text>
                    <Text style={s.insightText}>{getInsight(stats)}</Text>
                </View>
            </View>

            {/* Monthly Calendar */}
            <View style={s.section}>
                <Text style={s.sectionTitle}>Calender</Text>
                <Text style={s.sectionSub}>Tap ‹ › to browse months</Text>
                <View style={s.calCard}>
                    <MonthCalendar
                        calendarData={calendarData}
                        selectedMonth={selectedMonth}
                        onMonthChange={handleMonthChange}
                    />
                </View>
            </View>

        </ScrollView>
    );
};

export default Performance;


const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F12' },
    centered: { justifyContent: 'center', alignItems: 'center' },
    content: { paddingTop: 60, paddingBottom: 52, paddingHorizontal: H_PAD },
    loadingTxt: { color: '#4A4A5E', fontSize: 13, marginTop: 12 },

    header: { marginBottom: 24 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
    subtitle: { color: '#4A4A5E', fontSize: 14 },

    scoreCard: { backgroundColor: '#151518', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E26', alignItems: 'center', paddingVertical: 24, marginBottom: 28 },
    scoreLabel: { color: '#4A4A5E', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    scoreBig: { color: '#7CFF9B', fontSize: 52, fontWeight: '800', letterSpacing: -2, lineHeight: 56 },
    scoreScale: { color: '#4A4A5E', fontSize: 12, marginTop: 4 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 28 },
    statCard: { width: STAT_WIDTH, backgroundColor: '#151518', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1E1E26', marginBottom: STAT_GAP },
    statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
    statLabel: { color: '#4A4A5E', fontSize: 10, fontWeight: '500', textAlign: 'center' },

    section: { marginBottom: 28 },
    sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    sectionSub: { color: '#4A4A5E', fontSize: 12, marginTop: 2, marginBottom: 14 },

    controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    segmented: { flexDirection: 'row', backgroundColor: '#151518', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#1E1E26' },
    segBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 7 },
    segBtnOn: { backgroundColor: '#FFFFFF' },
    segTxt: { color: '#4A4A5E', fontSize: 12, fontWeight: '600' },
    segTxtOn: { color: '#000000' },
    winRow: { flexDirection: 'row' },
    winBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#151518', borderWidth: 1, borderColor: '#1E1E26', marginLeft: 6 },
    winBtnOn: { borderColor: '#7CFF9B', backgroundColor: '#0D1A0F' },
    winTxt: { color: '#4A4A5E', fontSize: 12, fontWeight: '600' },
    winTxtOn: { color: '#7CFF9B' },
    chartWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1E1E26', backgroundColor: '#151518' },

    emptyCard: { backgroundColor: '#151518', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E26', padding: 36, alignItems: 'center' },
    emptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 6 },
    emptySub: { color: '#4A4A5E', fontSize: 13, textAlign: 'center', lineHeight: 18 },

    insightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
    mascot: { width: 52, height: 52, marginRight: 12 },
    insightBubble: { flex: 1, backgroundColor: '#151518', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E1E26' },
    insightEyebrow: { color: '#4A4A5E', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    insightText: { color: '#CCCCDD', fontSize: 13, lineHeight: 18 },

    calCard: { backgroundColor: '#151518', borderRadius: 16, borderWidth: 1, borderColor: '#1E1E26', padding: 16 },
});