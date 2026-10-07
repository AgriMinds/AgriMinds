import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  fetchMobileAdvisory,
  fetchMobileDroughtMap,
  fetchMobileEnsoOutlook,
  getOfflineFallbackAdvisory,
  getOfflineFallbackDroughtMap,
  MobileAdvisoryResponse,
  MobileDroughtMapResponse,
  MobileEnsoResponse,
} from './src/services/api';
import { MobileLanguage, mobileTranslations } from './src/translations';

const { width } = Dimensions.get('window');

export default function App() {
  const [lang, setLang] = useState<MobileLanguage>('en');
  const [activeTab, setActiveTab] = useState<'advisory' | 'grid' | 'enso'>('advisory');

  const [selectedCrop, setSelectedCrop] = useState<'tef' | 'wheat' | 'maize'>('tef');
  const [leadMonth, setLeadMonth] = useState<number>(1);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 4, col: 4 });
  const [iekAgrees, setIekAgrees] = useState<boolean | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const [advisory, setAdvisory] = useState<MobileAdvisoryResponse | null>(null);
  const [mapData, setMapData] = useState<MobileDroughtMapResponse | null>(null);
  const [ensoData, setEnsoData] = useState<MobileEnsoResponse | null>(null);

  const t = mobileTranslations[lang];

  // Load advisory data
  const loadAdvisory = useCallback(async () => {
    try {
      const data = await fetchMobileAdvisory({
        crop: selectedCrop,
        lead_month: leadMonth,
        row: selectedCell.row,
        col: selectedCell.col,
        iek_agrees: iekAgrees,
      });
      setAdvisory(data);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      setAdvisory(getOfflineFallbackAdvisory(selectedCrop, leadMonth, iekAgrees));
    }
  }, [selectedCrop, leadMonth, selectedCell, iekAgrees]);

  // Load drought grid map
  const loadMap = useCallback(async () => {
    try {
      const data = await fetchMobileDroughtMap(leadMonth);
      setMapData(data);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      setMapData(getOfflineFallbackDroughtMap(leadMonth));
    }
  }, [leadMonth]);

  // Load ENSO teleconnection
  const loadEnso = useCallback(async () => {
    try {
      const data = await fetchMobileEnsoOutlook();
      setEnsoData(data);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
      setEnsoData({
        current_nino34: -0.47,
        current_state: 'Neutral',
        forecast_horizon_months: 6,
        historical_series: [],
        forecast_series: [
          { date: '2026-07', nino34: -0.74, is_forecast: true },
          { date: '2026-08', nino34: -0.75, is_forecast: true },
          { date: '2026-09', nino34: -0.67, is_forecast: true },
          { date: '2026-10', nino34: -0.55, is_forecast: true },
          { date: '2026-11', nino34: -0.42, is_forecast: true },
          { date: '2026-12', nino34: -0.38, is_forecast: true },
        ],
        teleconnection_summary:
          'Equatorial Pacific Niño 3.4 is in a Neutral / borderline La Niña transition. Typically supports stable moisture in Choke highlands.',
      });
    }
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([loadAdvisory(), loadMap(), loadEnso()]);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAdvisory(), loadMap(), loadEnso()]).finally(() => setLoading(false));
  }, [loadAdvisory, loadMap, loadEnso]);

  // Grid cell navigation
  const moveCell = (dRow: number, dCol: number) => {
    const nextRow = Math.min(Math.max(0, selectedCell.row + dRow), 7);
    const nextCol = Math.min(Math.max(0, selectedCell.col + dCol), 7);
    setSelectedCell({ row: nextRow, col: nextCol });
  };

  const getCellBg = (prob: number) => {
    if (prob < 0.25) return '#059669';
    if (prob < 0.45) return '#f59e0b';
    if (prob < 0.65) return '#f97316';
    return '#dc2626';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t.appName}</Text>
            <Text style={styles.headerSubtitle}>{t.subTitle}</Text>
          </View>

          {/* Language Switcher */}
          <View style={styles.langPill}>
            {(['en', 'am', 'or'] as MobileLanguage[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                onPress={() => setLang(l)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {l === 'en' ? 'EN' : l === 'am' ? 'አማ' : 'ORO'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Online/Offline status indicator */}
        <View style={styles.statusBanner}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.statusText}>{isOnline ? t.onlineMode : t.offlineMode}</Text>
        </View>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'advisory' && styles.tabItemActive]}
          onPress={() => setActiveTab('advisory')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'advisory' && styles.tabTextActive]}>
            {t.tabAdvisory}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'grid' && styles.tabItemActive]}
          onPress={() => setActiveTab('grid')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'grid' && styles.tabTextActive]}>
            {t.tabGrid}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'enso' && styles.tabItemActive]}
          onPress={() => setActiveTab('enso')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === 'enso' && styles.tabTextActive]}>
            {t.tabEnso}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} colors={['#059669']} />}
      >
        {/* ================= TAB 1: AGRO-ADVISORY ================= */}
        {activeTab === 'advisory' && (
          <View>
            {/* Staple Crop Selection */}
            <Text style={styles.sectionLabel}>{t.cropLabel}</Text>
            <View style={styles.buttonRow}>
              {[
                { id: 'tef', label: 'Tef (ጤፍ)', sub: 'Short cycle' },
                { id: 'wheat', label: 'Wheat (ስንዴ)', sub: 'Tillering' },
                { id: 'maize', label: 'Maize (በቆሎ)', sub: 'High water' },
              ].map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.cropChip, selectedCrop === c.id && styles.cropChipActive]}
                  onPress={() => setSelectedCrop(c.id as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cropTitle, selectedCrop === c.id && styles.cropTitleActive]}>
                    {c.label}
                  </Text>
                  <Text style={styles.cropSub}>{c.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lead Horizon */}
            <Text style={styles.sectionLabel}>{t.leadLabel}</Text>
            <View style={styles.buttonRow}>
              {[
                { lead: 1, label: '1 Mo (Near)' },
                { lead: 2, label: '2 Mo (Mid)' },
                { lead: 3, label: '3 Mo (Seasonal)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.lead}
                  style={[styles.leadChip, leadMonth === item.lead && styles.leadChipActive]}
                  onPress={() => setLeadMonth(item.lead)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.leadText, leadMonth === item.lead && styles.leadTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* IEK Traditional Indicators */}
            <Text style={styles.sectionLabel}>{t.iekLabel}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.iekChip, iekAgrees === true && styles.iekAgreeActive]}
                onPress={() => setIekAgrees(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.iekText, iekAgrees === true && styles.iekTextActive]}>
                  {t.iekAgree}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iekChip, iekAgrees === false && styles.iekDisagreeActive]}
                onPress={() => setIekAgrees(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.iekText, iekAgrees === false && styles.iekTextActive]}>
                  {t.iekDisagree}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iekChip, iekAgrees === null && styles.iekNeutralActive]}
                onPress={() => setIekAgrees(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.iekText, iekAgrees === null && styles.iekTextActive]}>
                  {t.iekUncertain}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Advisory Card */}
            {loading ? (
              <ActivityIndicator size="large" color="#059669" style={{ marginTop: 24 }} />
            ) : advisory ? (
              <View style={styles.advisoryCard}>
                {/* Card Top */}
                <View style={styles.advisoryHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.advisoryCrop}>{advisory.crop.toUpperCase()}</Text>
                    <Text style={styles.advisoryRisk}>
                      Risk: <Text style={{ fontWeight: 'bold' }}>{advisory.risk_level}</Text>
                    </Text>
                    <Text style={styles.advisorySeason}>
                      {advisory.season} · ENSO: {advisory.enso_state}
                    </Text>
                  </View>
                  <View style={styles.advisoryProbBadge}>
                    <Text style={styles.probNumber}>
                      {(advisory.adjusted_probability * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.probLabel}>Adjusted</Text>
                  </View>
                </View>

                {/* Directives */}
                <View style={styles.directiveBox}>
                  <Text style={styles.directiveTitle}>🌾 {t.strategy}</Text>
                  <Text style={styles.directiveContent}>{advisory.crop_recommendation}</Text>
                </View>

                <View style={styles.directiveBox}>
                  <Text style={styles.directiveTitle}>📅 {t.planting}</Text>
                  <Text style={styles.directiveContent}>{advisory.planting_window}</Text>
                </View>

                <View style={styles.directiveBox}>
                  <Text style={styles.directiveTitle}>💧 {t.water}</Text>
                  <Text style={styles.directiveContent}>{advisory.water_management}</Text>
                </View>

                <View style={styles.directiveBox}>
                  <Text style={styles.directiveTitle}>⚠️ {t.preparedness}</Text>
                  <Text style={styles.directiveContent}>{advisory.preparedness_action}</Text>
                </View>

                {/* IEK Footer */}
                <View style={styles.iekBanner}>
                  <Text style={styles.iekTextSmall}>✨ {advisory.iek_assessment}</Text>
                  <Text style={styles.confidenceText}>
                    {t.confidence}: {advisory.confidence_level}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* ================= TAB 2: DROUGHT GRID MAP ================= */}
        {activeTab === 'grid' && (
          <View>
            <Text style={styles.sectionLabel}>{t.gridTitle}</Text>
            <Text style={styles.subHint}>
              Target: {mapData?.target_date || 'July 2026'} · Lead: {leadMonth} Mo
            </Text>

            {/* 8x8 Visual Raster Grid */}
            <View style={styles.gridContainer}>
              {mapData?.probabilities.map((row, r) => (
                <View key={`row-${r}`} style={styles.gridRow}>
                  {row.map((prob, c) => {
                    const isSelected = selectedCell.row === r && selectedCell.col === c;
                    return (
                      <TouchableOpacity
                        key={`cell-${r}-${c}`}
                        style={[
                          styles.gridCell,
                          { backgroundColor: getCellBg(prob) },
                          isSelected && styles.gridCellSelected,
                        ]}
                        onPress={() => setSelectedCell({ row: r, col: c })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.gridCellText}>{(prob * 100).toFixed(0)}%</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Selected Cell Box with Nudge Arrows */}
            <View style={styles.cellTelemetryBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.telemetryTitle}>
                  {t.selectedCell}: Row {selectedCell.row}, Col {selectedCell.col}
                </Text>
                <Text style={styles.telemetrySub}>
                  Choke BBox (10.4°N-11.2°N, 37.6°E-38.4°E)
                </Text>
              </View>

              {/* Thumb Nudge Pad */}
              <View style={styles.nudgePad}>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => moveCell(0, -1)}
                  disabled={selectedCell.col === 0}
                >
                  <Text style={styles.nudgeBtnText}>◀</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => moveCell(-1, 0)}
                  disabled={selectedCell.row === 0}
                >
                  <Text style={styles.nudgeBtnText}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => moveCell(1, 0)}
                  disabled={selectedCell.row === 7}
                >
                  <Text style={styles.nudgeBtnText}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.nudgeBtn}
                  onPress={() => moveCell(0, 1)}
                  disabled={selectedCell.col === 7}
                >
                  <Text style={styles.nudgeBtnText}>▶</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Jump to Advisory Button */}
            <TouchableOpacity
              style={styles.jumpBtn}
              onPress={() => setActiveTab('advisory')}
              activeOpacity={0.8}
            >
              <Text style={styles.jumpBtnText}>
                🌾 Evaluate Advisory for Cell ({selectedCell.row}, {selectedCell.col})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= TAB 3: ENSO TELECONNECTION ================= */}
        {activeTab === 'enso' && ensoData && (
          <View>
            <Text style={styles.sectionLabel}>{t.ensoTitle}</Text>

            {/* Current Phase Card */}
            <View style={styles.ensoStatusCard}>
              <Text style={styles.ensoStatusLabel}>Current Equatorial Pacific State</Text>
              <Text style={styles.ensoStatusVal}>
                {ensoData.current_state} ({ensoData.current_nino34 > 0 ? `+${ensoData.current_nino34}` : ensoData.current_nino34}°C)
              </Text>
              <Text style={styles.ensoSummaryText}>{ensoData.teleconnection_summary}</Text>
            </View>

            {/* 6-Month Timeline */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{t.outlookTitle}</Text>
            <View style={styles.forecastGrid}>
              {ensoData.forecast_series.map((pt, idx) => {
                const isEl = pt.nino34 >= 0.5;
                const isLa = pt.nino34 <= -0.5;
                return (
                  <View key={pt.date} style={styles.forecastCard}>
                    <Text style={styles.fcMonth}>Month +{idx + 1}</Text>
                    <Text style={styles.fcDate}>{pt.date}</Text>
                    <Text
                      style={[
                        styles.fcTemp,
                        { color: isEl ? '#dc2626' : isLa ? '#2563eb' : '#059669' },
                      ]}
                    >
                      {pt.nino34 > 0 ? `+${pt.nino34.toFixed(2)}` : pt.nino34.toFixed(2)}°C
                    </Text>
                    <Text style={styles.fcTag}>{isEl ? 'El Niño' : isLa ? 'La Niña' : 'Neutral'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#a7f3d0',
    marginTop: 2,
  },
  langPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 2,
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: '#ffffff',
  },
  langText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  langTextActive: {
    color: '#064e3b',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#d1fae5',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#059669',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#064e3b',
  },
  scroll: {
    padding: 14,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  subHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cropChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  cropChipActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  cropTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  cropTitleActive: {
    color: '#064e3b',
  },
  cropSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  leadChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  leadChipActive: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  leadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  leadTextActive: {
    color: '#ffffff',
  },
  iekChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  iekAgreeActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  iekDisagreeActive: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  iekNeutralActive: {
    borderColor: '#475569',
    backgroundColor: '#f1f5f9',
  },
  iekText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  iekTextActive: {
    fontWeight: '800',
    color: '#0f172a',
  },
  advisoryCard: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  advisoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  advisoryCrop: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  advisoryRisk: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  advisorySeason: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  advisoryProbBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  probNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064e3b',
  },
  probLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  directiveBox: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  directiveTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  directiveContent: {
    fontSize: 12,
    lineHeight: 17,
    color: '#334155',
    marginTop: 3,
  },
  iekBanner: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  iekTextSmall: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#92400e',
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    marginTop: 4,
  },
  gridContainer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 2,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellSelected: {
    borderWidth: 3,
    borderColor: '#0f172a',
    transform: [{ scale: 1.08 }],
  },
  gridCellText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  cellTelemetryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  telemetryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  telemetrySub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  nudgePad: {
    flexDirection: 'row',
    gap: 4,
  },
  nudgeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  nudgeBtnText: {
    fontSize: 11,
    color: '#1e293b',
  },
  jumpBtn: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  jumpBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  ensoStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ensoStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  ensoStatusVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  ensoSummaryText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
    marginTop: 8,
  },
  forecastGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  forecastCard: {
    width: (width - 44) / 3,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fcMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  fcDate: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
  },
  fcTemp: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  fcTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
