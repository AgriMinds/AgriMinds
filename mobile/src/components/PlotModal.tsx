import { CROPS, type Crop, type Farm, type LeadMonth } from '@agriminds/api-types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFarmMutations } from '@/features/useFarmer';
import { useDeviceLocation } from '@/features/useLocation';
import { useI18n } from '@/i18n';
import { ApiError } from '@/services/api';
import { radius, spacing, useTheme } from '@/theme';

interface Props {
  visible: boolean;
  farm: Farm | null;
  lead: LeadMonth;
  onClose: () => void;
}

interface FormProps {
  farm: Farm | null;
  lead: LeadMonth;
  onClose: () => void;
}

function PlotForm({ farm, lead, onClose }: FormProps) {
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const { create, update, remove } = useFarmMutations(lead);
  const gps = useDeviceLocation();

  const [name, setName] = useState(farm?.name ?? '');
  const [latitude, setLatitude] = useState(farm ? String(farm.latitude) : '');
  const [longitude, setLongitude] = useState(farm ? String(farm.longitude) : '');
  const [area, setArea] = useState(farm ? String(farm.area_hectares) : '');
  const [crop, setCrop] = useState<Crop>((farm?.primary_crop as Crop) ?? 'tef');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gpsAcquired, setGpsAcquired] = useState(false);

  const busy = create.isPending || update.isPending || remove.isPending;

  const handleLocate = async () => {
    setError(null);
    const pos = await gps.locate();
    if (pos) {
      setLatitude(pos.latitude.toFixed(4));
      setLongitude(pos.longitude.toFixed(4));
      setGpsAcquired(true);
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return t('farmer.errors.nameRequired');
    const lat = Number(latitude);
    const lon = Number(longitude);
    const ha = Number(area);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return t('farmer.errors.latitude');
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return t('farmer.errors.longitude');
    if (!Number.isFinite(ha) || ha <= 0) return t('farmer.errors.area');
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    const payload = {
      name: name.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      area_hectares: Number(area),
      primary_crop: crop,
    };

    try {
      if (farm) {
        await update.mutateAsync({ id: farm.id, payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'invalid_location') {
          setError(t('advisory.locationOutside'));
        } else {
          setError(e.message || t('farmer.errors.generic'));
        }
      } else {
        setError(t('farmer.errors.generic'));
      }
    }
  };

  const onDelete = async () => {
    if (!farm) return;
    try {
      await remove.mutateAsync(farm.id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('farmer.errors.generic'));
    }
  };

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header handle stripe */}
      <View style={styles.handleBar} />

      {/* Modal Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            {farm ? t('farmer.editPlot') : t('farmer.registerPlot')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {farm ? farm.name : t('farmer.intro')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onClose}
          disabled={busy}
          style={[styles.closeBtn, { backgroundColor: dark ? '#222' : '#f3f4f6' }]}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Error Banner */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: dark ? '#331010' : '#fee2e2' }]}>
            <Ionicons name="alert-circle" size={18} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Plot Name Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t('farmer.plotName')} <Text style={{ color: '#dc2626' }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: dark ? '#1a1a1a' : '#f9fafb',
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={t('farmer.plotNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={120}
            editable={!busy}
            autoFocus={!farm}
          />
        </View>

        {/* GPS Auto-Fill Quick Action */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            GPS Coordinates
          </Text>
          <TouchableOpacity
            onPress={handleLocate}
            disabled={busy || gps.status === 'locating'}
            style={[
              styles.gpsBtn,
              {
                backgroundColor: gpsAcquired
                  ? dark
                    ? '#0b291b'
                    : '#e6f7ec'
                  : dark
                    ? '#14213d'
                    : '#eff6ff',
                borderColor: gpsAcquired ? colors.primary : '#3b82f6',
              },
            ]}
            accessibilityRole="button"
          >
            {gps.status === 'locating' ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : (
              <Ionicons
                name={gpsAcquired ? 'checkmark-circle' : 'locate'}
                size={18}
                color={gpsAcquired ? colors.primary : '#3b82f6'}
              />
            )}
            <Text
              style={[
                styles.gpsBtnText,
                { color: gpsAcquired ? colors.primary : '#2563eb' },
              ]}
            >
              {gps.status === 'locating'
                ? t('advisory.locating')
                : gpsAcquired
                  ? t('farmer.gpsFilled', { lat: latitude, lon: longitude })
                  : t('farmer.useCurrentGps')}
            </Text>
          </TouchableOpacity>
          {gps.status === 'denied' ? (
            <Text style={styles.fieldHint}>{t('advisory.locationDenied')}</Text>
          ) : null}
        </View>

        {/* Latitude and Longitude Grid */}
        <View style={styles.rowInputs}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('farmer.latitude')} <Text style={{ color: '#dc2626' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: dark ? '#1a1a1a' : '#f9fafb',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="10.6500"
              placeholderTextColor={colors.textMuted}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
              editable={!busy}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t('farmer.longitude')} <Text style={{ color: '#dc2626' }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: dark ? '#1a1a1a' : '#f9fafb',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="37.8500"
              placeholderTextColor={colors.textMuted}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
              editable={!busy}
            />
          </View>
        </View>

        {/* Area in Hectares */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t('farmer.area')} <Text style={{ color: '#dc2626' }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: dark ? '#1a1a1a' : '#f9fafb',
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder={t('farmer.areaPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={area}
            onChangeText={setArea}
            keyboardType="numeric"
            editable={!busy}
          />
        </View>

        {/* Target Staple Crop Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t('farmer.primaryCrop')}
          </Text>
          <View style={styles.cropList}>
            {CROPS.map((c) => {
              const isSelected = crop === c;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCrop(c)}
                  style={[
                    styles.cropCard,
                    {
                      backgroundColor: isSelected
                        ? dark
                          ? '#0f291c'
                          : '#ecfdf5'
                        : dark
                          ? '#1a1a1a'
                          : '#f9fafb',
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.cropTop}>
                    <Ionicons
                      name={c === 'tef' ? 'leaf' : c === 'wheat' ? 'nutrition' : 'grid'}
                      size={18}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.cropTitle,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {t(`crops.${c}`)}
                    </Text>
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={busy}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            {busy && !confirmDelete ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#ffffff" />
                <Text style={styles.saveBtnText}>
                  {farm ? t('farmer.saveChanges') : t('farmer.registerPlot')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            disabled={busy}
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>
              {t('farmer.cancel')}
            </Text>
          </TouchableOpacity>

          {farm ? (
            <TouchableOpacity
              onPress={confirmDelete ? onDelete : () => setConfirmDelete(true)}
              disabled={busy}
              style={[
                styles.deleteBtn,
                {
                  backgroundColor: confirmDelete ? '#dc2626' : 'transparent',
                  borderColor: confirmDelete ? '#dc2626' : '#ef4444',
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={confirmDelete ? '#ffffff' : '#ef4444'}
              />
              <Text
                style={[
                  styles.deleteBtnText,
                  { color: confirmDelete ? '#ffffff' : '#ef4444' },
                ]}
              >
                {confirmDelete ? t('farmer.confirmDelete') : t('farmer.deletePlot')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

export function PlotModal({ visible, farm, lead, onClose }: Props) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <PlotForm
          key={`${visible}-${farm?.id ?? 'new'}`}
          farm={farm}
          lead={lead}
          onClose={onClose}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  handleBar: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(150, 150, 150, 0.4)',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  gpsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 11,
    color: '#dc2626',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cropList: {
    gap: spacing.xs,
  },
  cropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  cropTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cropTitle: {
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  saveBtn: {
    height: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
