import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchHireApplications,
  updateHireStatus,
  fetchHireRemarks,
  addHireRemark,
  getResumeSignedUrl,
  deleteHireApplication,
} from '../../../lib/supabase/queries/hires';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Spinner } from '../../../components/ui/Spinner';
import { useAuth } from '../../../lib/auth/context';
import type { HireApplication, HireRemark } from '../../../types/database';

const { width: SCREEN_W } = Dimensions.get('window');

type StatusFilter = 'all' | 'pending' | 'reviewing' | 'shortlisted' | 'hired' | 'rejected';
type Period = 'all' | 'today' | 'week' | 'month' | '3months';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All',         value: 'all' },
  { label: 'Pending',     value: 'pending' },
  { label: 'Reviewing',   value: 'reviewing' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Hired',       value: 'hired' },
  { label: 'Rejected',    value: 'rejected' },
];

const ALL_STATUSES = ['pending', 'reviewing', 'shortlisted', 'hired', 'rejected'];

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: 'All time',   value: 'all' },
  { label: 'Today',      value: 'today' },
  { label: 'This week',  value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'Last 3 mo',  value: '3months' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:     { color: '#d97706', label: 'Pending' },
  reviewing:   { color: '#0071e3', label: 'Reviewing' },
  shortlisted: { color: '#7c3aed', label: 'Shortlisted' },
  hired:       { color: '#16a34a', label: 'Hired' },
  approved:    { color: '#16a34a', label: 'Approved' },
  rejected:    { color: '#b81c3a', label: 'Rejected' },
};

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === '3months') return new Date(now.getFullYear(), now.getMonth() - 3, 1);
  return null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return fmtDate(iso);
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

function instagramUrl(value: string): string {
  if (value.startsWith('http')) return value;
  const handle = value.replace(/^@/, '');
  return `https://www.instagram.com/${handle}/`;
}

function instagramHandle(value: string): string {
  if (!value.startsWith('http')) return value.startsWith('@') ? value : `@${value}`;
  try {
    const path = new URL(value).pathname.replace(/\/$/, '');
    const handle = path.split('/').filter(Boolean).pop() ?? value;
    return `@${handle}`;
  } catch { return value; }
}

function isUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

// ─── Period picker ────────────────────────────────────────────────────────────

function PeriodPicker({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const [open, setOpen] = useState(false);
  const label = PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? 'All time';
  return (
    <>
      <TouchableOpacity style={styles.periodBtn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.periodBtnText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color="#6e6e73" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerCard}>
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value} style={styles.pickerItem}
                onPress={() => { onChange(opt.value); setOpen(false); }} activeOpacity={0.7}>
                <Text style={[styles.pickerItemText, value === opt.value && styles.pickerItemActive]}>{opt.label}</Text>
                {value === opt.value ? <Ionicons name="checkmark" size={16} color="#0071e3" /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Applicant row ────────────────────────────────────────────────────────────

function ApplicantRow({ item, onPress }: { item: HireApplication; onPress: () => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? { color: '#9a9aa5', label: item.status };
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowAvatar}>
        <Text style={styles.rowAvatarText}>{initials(item.first_name, item.last_name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {`${item.first_name} ${item.last_name}`.trim() || 'Unknown'}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.rowStatus, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.rowDot}>·</Text>
          <Text style={styles.rowDate}>{fmtDate(item.created_at)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9a9aa5" />
    </TouchableOpacity>
  );
}

// ─── Remark item ──────────────────────────────────────────────────────────────

function RemarkItem({ remark }: { remark: HireRemark }) {
  const initl = (remark.created_by_name ?? '?')[0]?.toUpperCase() ?? '?';
  return (
    <View style={styles.remarkItem}>
      <View style={styles.remarkAvatar}>
        <Text style={styles.remarkAvatarText}>{initl}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.remarkHeader}>
          <Text style={styles.remarkAuthor}>{remark.created_by_name ?? 'Unknown'}</Text>
          <Text style={styles.remarkTime}>{timeAgo(remark.created_at)}</Text>
        </View>
        <Text style={styles.remarkContent}>{remark.content}</Text>
      </View>
    </View>
  );
}

// ─── Status picker modal ──────────────────────────────────────────────────────

function StatusPickerModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current: string;
  onSelect: (s: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Update status</Text>
          {ALL_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const isCurrent = s === current;
            return (
              <TouchableOpacity key={s} style={styles.pickerItem}
                onPress={() => { onSelect(s); onClose(); }} activeOpacity={0.7} disabled={isCurrent}>
                <View style={styles.statusPickerRow}>
                  <View style={[styles.statusDot, { backgroundColor: cfg.color, width: 9, height: 9 }]} />
                  <Text style={[styles.pickerItemText, { color: isCurrent ? '#9a9aa5' : '#1d1d1f' }]}>
                    {cfg.label}
                  </Text>
                </View>
                {isCurrent ? <Text style={styles.currentLabel}>current</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Reject remark modal ──────────────────────────────────────────────────────

function RejectRemarkModal({
  visible, onConfirm, onClose,
}: {
  visible: boolean;
  onConfirm: (remark: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.pickerBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.pickerCard, { padding: 20 }]}>
          <Text style={styles.pickerTitle}>Remark required</Text>
          <Text style={styles.rejectNote}>
            A remark is required when rejecting an applicant.
          </Text>
          <TextInput
            style={styles.rejectInput}
            value={text}
            onChangeText={setText}
            placeholder="Add a remark…"
            placeholderTextColor="#9a9aa5"
            multiline
            autoFocus
          />
          <View style={styles.rejectActions}>
            <TouchableOpacity style={styles.rejectCancelBtn} onPress={() => { setText(''); onClose(); }} activeOpacity={0.7}>
              <Text style={styles.rejectCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectConfirmBtn, !text.trim() && { opacity: 0.4 }]}
              onPress={() => { if (text.trim()) { onConfirm(text.trim()); setText(''); } }}
              disabled={!text.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectConfirmText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── PDF viewer screen ────────────────────────────────────────────────────────

function PdfViewerScreen({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const [webLoading, setWebLoading] = useState(true);

  useEffect(() => {
    if (url) {
      setWebLoading(true);
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    }
  }, [url]);

  const handleClose = () => {
    Animated.timing(translateX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true })
      .start(() => onClose());
  };

  const viewerUri = url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : '';

  return (
    <Modal visible={!!url} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>Resume</Text>
          <View style={{ width: 72 }} />
        </View>

        <View style={{ flex: 1 }}>
          {webLoading ? (
            <View style={styles.pdfLoading}>
              <ActivityIndicator size="large" color="#0071e3" />
              <Text style={styles.pdfLoadingText}>Loading PDF…</Text>
            </View>
          ) : null}
          <WebView
            source={{ uri: viewerUri }}
            style={[styles.pdfWebView, webLoading && { opacity: 0 }]}
            onLoadEnd={() => setWebLoading(false)}
            onError={() => setWebLoading(false)}
            startInLoadingState={false}
            scalesPageToFit
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Detail screen ────────────────────────────────────────────────────────────

function HireDetailScreen({
  item,
  onClose,
}: {
  item: HireApplication | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;

  const [cached, setCached] = useState<HireApplication | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setCached(item);
      setRemarkText('');
      setResumeUrl(null);
      translateX.setValue(SCREEN_W);
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      if (item.resume_path) {
        setResumeLoading(true);
        getResumeSignedUrl(item.resume_path).then((url) => {
          setResumeUrl(url);
          setResumeLoading(false);
        });
      } else {
        setResumeLoading(false);
      }
    }
  }, [item?.id]);

  const handleClose = () => {
    Animated.timing(translateX, { toValue: SCREEN_W, duration: 220, useNativeDriver: true })
      .start(() => onClose());
  };

  // Remarks
  const { data: remarks = [], isLoading: remarksLoading } = useQuery({
    queryKey: ['hireRemarks', cached?.id],
    queryFn: () => fetchHireRemarks(cached!.id),
    enabled: !!cached,
    staleTime: 30000,
  });

  const addRemarkMutation = useMutation({
    mutationFn: (content: string) =>
      addHireRemark(cached!.id, content, user!.id, user?.user_metadata?.full_name ?? user?.email ?? 'Unknown'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hireRemarks', cached?.id] });
      setRemarkText('');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to add remark.'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, remark }: { status: string; remark?: string }) => {
      await updateHireStatus(cached!.id, status);
      if (remark) {
        await addHireRemark(
          cached!.id, remark,
          user!.id, user?.user_metadata?.full_name ?? user?.email ?? 'Unknown',
        );
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['hireApplications'] });
      queryClient.invalidateQueries({ queryKey: ['hireRemarks', cached?.id] });
      setCached((prev) => prev ? { ...prev, status } : prev);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to update status.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHireApplication(cached!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hireApplications'] });
      handleClose();
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to delete application.'),
  });

  const handleDelete = () => {
    const fullName = `${cached?.first_name ?? ''} ${cached?.last_name ?? ''}`.trim() || 'this applicant';
    Alert.alert(
      'Delete Application',
      `Remove ${fullName}'s application? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  const handleStatusSelect = (s: string) => {
    if (s === 'rejected') {
      setPendingStatus(s);
      setRejectModalVisible(true);
    } else {
      statusMutation.mutate({ status: s });
    }
  };

  const handleRejectConfirm = (remark: string) => {
    setRejectModalVisible(false);
    if (pendingStatus) {
      statusMutation.mutate({ status: pendingStatus, remark });
      setPendingStatus(null);
    }
  };

  const cfg = cached ? (STATUS_CONFIG[cached.status] ?? { color: '#9a9aa5', label: cached.status }) : null;
  const name = cached ? `${cached.first_name} ${cached.last_name}`.trim() || 'Unknown' : '';

  return (
    <Modal visible={!!item} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[styles.detailScreen, { transform: [{ translateX }] }]}>
        {/* Nav */}
        <View style={[styles.detailNav, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.detailNavBack} onPress={handleClose} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#0071e3" />
            <Text style={styles.detailNavBackText}>Hires</Text>
          </TouchableOpacity>
          <Text style={styles.detailNavTitle} numberOfLines={1}>{name}</Text>
          <View style={{ width: 72 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 50}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            {/* Identity */}
            <View style={styles.detailIdentity}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>
                  {cached ? initials(cached.first_name, cached.last_name) : ''}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.detailName}>{name}</Text>
                <Text style={styles.detailEmail}>{cached?.email ?? ''}</Text>
                {cfg ? (
                  <View style={[styles.statusPill, { borderColor: cfg.color }]}>
                    <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.kindTag}>
                <Text style={styles.kindTagText}>Intern</Text>
              </View>
            </View>

            {/* Contact */}
            <Text style={styles.sectionLabel}>CONTACT</Text>
            <View style={styles.card}>
              {cached?.phone ? (
                <TouchableOpacity
                  style={[styles.detailRow, styles.detailRowBorder]}
                  onPress={() => Linking.openURL(`tel:${cached.phone}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLabel}>Phone</Text>
                  <View style={styles.linkRow}>
                    <Ionicons name="call-outline" size={14} color="#0071e3" />
                    <Text style={styles.linkText}>{cached.phone}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {cached?.email ? (
                <TouchableOpacity
                  style={[styles.detailRow, cached?.instagram ? styles.detailRowBorder : undefined]}
                  onPress={() => Linking.openURL(`mailto:${cached.email}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLabel}>Email</Text>
                  <View style={styles.linkRow}>
                    <Ionicons name="mail-outline" size={14} color="#0071e3" />
                    <Text style={styles.linkText}>{cached.email}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {cached?.instagram ? (
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => Linking.openURL(instagramUrl(cached.instagram!))}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLabel}>Instagram</Text>
                  <View style={styles.linkRow}>
                    <Ionicons name="logo-instagram" size={14} color="#0071e3" />
                    <Text style={styles.linkText}>{instagramHandle(cached.instagram)}</Text>
                    <Ionicons name="open-outline" size={12} color="#0071e3" />
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Application */}
            <Text style={styles.sectionLabel}>APPLICATION</Text>
            <View style={styles.card}>
              {cached?.resume_path ? (
                <View style={[styles.detailRow, cached?.message ? styles.detailRowBorder : undefined]}>
                  <Text style={styles.detailLabel}>Resume</Text>
                  {resumeLoading ? (
                    <ActivityIndicator size="small" color="#0071e3" />
                  ) : resumeUrl ? (
                    <TouchableOpacity
                      style={styles.pdfBtn}
                      onPress={() => setPdfViewerUrl(resumeUrl)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="document-outline" size={14} color="#0071e3" />
                      <Text style={styles.pdfBtnText}>View PDF</Text>
                      <Ionicons name="open-outline" size={12} color="#0071e3" />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.detailValue, { color: '#9a9aa5' }]}>Unavailable</Text>
                  )}
                </View>
              ) : null}
              {cached?.message ? (
                <View style={styles.coverNoteWrap}>
                  <Text style={styles.coverNoteLabel}>Cover note</Text>
                  <Text style={styles.coverNoteText}>{cached.message}</Text>
                </View>
              ) : null}
            </View>

            {/* Status */}
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.statusDropdown}
                onPress={() => setStatusPickerVisible(true)}
                activeOpacity={0.8}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? (
                  <ActivityIndicator size="small" color="#6e6e73" />
                ) : (
                  <>
                    <Text style={styles.statusDropdownText}>
                      {cfg?.label ?? cached?.status ?? ''}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#6e6e73" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Remarks */}
            <View style={styles.remarksSectionHeader}>
              <Text style={styles.sectionLabel}>REMARKS</Text>
              {remarks.length > 0 ? (
                <View style={styles.remarksBadge}>
                  <Text style={styles.remarksBadgeText}>{remarks.length}</Text>
                </View>
              ) : null}
            </View>

            {/* Add remark */}
            <View style={styles.remarkInputWrap}>
              <TextInput
                style={styles.remarkInput}
                value={remarkText}
                onChangeText={setRemarkText}
                placeholder="Add a remark…"
                placeholderTextColor="#9a9aa5"
                multiline
              />
              <TouchableOpacity
                style={[styles.remarkSendBtn, !remarkText.trim() && { opacity: 0.3 }]}
                onPress={() => { if (remarkText.trim()) addRemarkMutation.mutate(remarkText.trim()); }}
                disabled={!remarkText.trim() || addRemarkMutation.isPending}
                activeOpacity={0.7}
              >
                {addRemarkMutation.isPending
                  ? <ActivityIndicator size="small" color="#0071e3" />
                  : <Ionicons name="send-outline" size={18} color="#0071e3" />}
              </TouchableOpacity>
            </View>

            {/* Remark list */}
            {remarksLoading ? (
              <ActivityIndicator color="#0071e3" style={{ marginTop: 12 }} />
            ) : remarks.length > 0 ? (
              <View style={styles.remarkList}>
                {remarks.map((r) => <RemarkItem key={r.id} remark={r} />)}
              </View>
            ) : null}

            {/* Delete */}
            <TouchableOpacity
              style={styles.deleteRow}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.7}
            >
              {deleteMutation.isPending
                ? <ActivityIndicator size="small" color="#b81c3a" />
                : <Text style={styles.deleteText}>Delete application…</Text>}
            </TouchableOpacity>

            {/* Meta */}
            <Text style={styles.sectionLabel}>META</Text>
            <View style={styles.card}>
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <Text style={styles.detailLabel}>Applied</Text>
                <Text style={styles.detailValue}>{cached ? fmtDateTime(cached.created_at) : '—'}</Text>
              </View>
              {cached?.referer && isUrl(cached.referer) ? (
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => Linking.openURL(cached.referer!)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLabel}>Source</Text>
                  <View style={[styles.linkRow, { flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }]}>
                    <Ionicons name="link-outline" size={14} color="#0071e3" />
                    <Text style={[styles.linkText, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                      {cached.referer}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Source</Text>
                  <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                    {cached?.referer ?? '—'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      <StatusPickerModal
        visible={statusPickerVisible}
        current={cached?.status ?? ''}
        onSelect={handleStatusSelect}
        onClose={() => setStatusPickerVisible(false)}
      />
      <RejectRemarkModal
        visible={rejectModalVisible}
        onConfirm={handleRejectConfirm}
        onClose={() => { setRejectModalVisible(false); setPendingStatus(null); }}
      />
      <PdfViewerScreen url={pdfViewerUrl} onClose={() => setPdfViewerUrl(null)} />
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HiresScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [period,       setPeriod]       = useState<Period>('all');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<HireApplication | null>(null);

  const { data: applications = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['hireApplications'],
    queryFn: fetchHireApplications,
  });

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of applications) {
      c.all++;
      c[a.status] = (c[a.status] ?? 0) + 1;
    }
    return c;
  }, [applications]);

  const filtered = useMemo(() => {
    const from = periodStart(period);
    const q = search.trim().toLowerCase();
    return applications
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .filter((a) => !from || new Date(a.created_at) >= from)
      .filter((a) => !q ||
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      );
  }, [applications, statusFilter, period, search]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PLATFORM</Text>
        <Text style={styles.title}>Hires</Text>
        <Text style={styles.subtitle}>Intern and specialist applications submitted through the platform.</Text>
      </View>

      {/* Search + period */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#6e6e73" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email or status…"
            placeholderTextColor="#9a9aa5"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9a9aa5" />
            </TouchableOpacity>
          ) : null}
        </View>
        <PeriodPicker value={period} onChange={setPeriod} />
      </View>

      {/* Status chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {STATUS_FILTERS.map((sf) => {
          const active = statusFilter === sf.value;
          const count  = statusCounts[sf.value] ?? 0;
          return (
            <TouchableOpacity
              key={sf.value}
              onPress={() => setStatusFilter(sf.value)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sf.label}</Text>
              {(count > 0 || sf.value === 'all') ? (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {sf.value === 'all' ? statusCounts.all : count}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isLoading ? (
        <Spinner fullScreen />
      ) : isError ? (
        <EmptyState icon="lock-closed-outline" title="Access restricted" description="You may not have permission to view hire applications." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="briefcase-outline" title="No applications" description="No applications match the current filters." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#0071e3" />}
          ListHeaderComponent={
            <View style={styles.listCardHeader}>
              <Text style={styles.listCardHeaderText}>APPLICANT</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.listCardFooter}>
              <Text style={styles.listCardFooterText}>
                {filtered.length} applicant{filtered.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ApplicantRow item={item} onPress={() => setSelected(item)} />
          )}
        />
      )}

      <HireDetailScreen item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f7' },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  eyebrow:  { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.8, marginBottom: 2 },
  title:    { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  subtitle: { fontSize: 13, color: '#6e6e73', marginTop: 3, lineHeight: 18 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 10, gap: 8,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 10, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1d1d1f', marginLeft: 6 },

  periodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  periodBtnText: { fontSize: 13, fontWeight: '500', color: '#1d1d1f' },

  pickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  pickerCard: {
    backgroundColor: '#ffffff', borderRadius: 16,
    width: '100%', maxWidth: 320, overflow: 'hidden', paddingVertical: 4,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f5',
  },
  pickerItemText:   { fontSize: 15, color: '#1d1d1f' },
  pickerItemActive: { color: '#0071e3', fontWeight: '600' },
  currentLabel: { fontSize: 11, color: '#9a9aa5' },
  statusPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 44 },
  chipsRow: { paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  chipActive:          { backgroundColor: '#1d1d1f', borderColor: '#1d1d1f' },
  chipText:            { fontSize: 13, fontWeight: '500', color: '#6e6e73' },
  chipTextActive:      { color: '#ffffff', fontWeight: '600' },
  chipBadge:           { backgroundColor: '#ebebed', borderRadius: 10, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  chipBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipBadgeText:       { fontSize: 11, fontWeight: '600', color: '#6e6e73' },
  chipBadgeTextActive: { color: '#ffffff' },

  list:           { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },
  listCardHeader: {
    backgroundColor: '#f5f5f7', paddingHorizontal: 16, paddingVertical: 8,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderBottomWidth: 0,
    marginHorizontal: 0,
  },
  listCardHeaderText: { fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.6 },
  listCardFooter: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
    backgroundColor: '#ffffff',
  },
  listCardFooterText: { fontSize: 13, color: '#9a9aa5' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7', borderTopWidth: 0,
  },
  rowAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center',
  },
  rowAvatarText: { fontSize: 14, fontWeight: '700', color: '#6e6e73' },
  rowBody:       { flex: 1, marginLeft: 12 },
  rowName:       { fontSize: 15, fontWeight: '600', color: '#1d1d1f' },
  rowMeta:       { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 5 },
  statusDot:     { width: 7, height: 7, borderRadius: 4 },
  rowStatus:     { fontSize: 12, fontWeight: '500' },
  rowDot:        { fontSize: 12, color: '#9a9aa5' },
  rowDate:       { fontSize: 12, color: '#9a9aa5' },

  // ── Detail screen ──
  detailScreen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f5f5f7' },
  detailNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    backgroundColor: '#f5f5f7',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
  },
  detailNavBack:     { flexDirection: 'row', alignItems: 'center', width: 72, paddingLeft: 4 },
  detailNavBackText: { fontSize: 17, color: '#0071e3', marginLeft: 2 },
  detailNavTitle:    { flex: 1, fontSize: 17, fontWeight: '600', color: '#1d1d1f', textAlign: 'center' },

  detailIdentity: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7',
    backgroundColor: '#ffffff',
  },
  detailAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarText: { fontSize: 18, fontWeight: '700', color: '#6e6e73' },
  detailName:       { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  detailEmail:      { fontSize: 13, color: '#6e6e73', marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start', borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10, paddingVertical: 3, marginTop: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '600' },
  kindTag:     { backgroundColor: '#e8f1fb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  kindTagText: { fontSize: 11, fontWeight: '600', color: '#0071e3' },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#9a9aa5', letterSpacing: 0.5,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 5,
  },
  card: {
    backgroundColor: '#ffffff', marginHorizontal: 16,
    borderRadius: 12, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  detailRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d2d2d7' },
  detailLabel: { fontSize: 14, color: '#6e6e73', flexShrink: 0, marginRight: 8 },
  detailValue: { fontSize: 14, color: '#1d1d1f', fontWeight: '500' },

  linkRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { fontSize: 14, color: '#0071e3', fontWeight: '500' },

  pdfBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e8f1fb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pdfBtnText: { fontSize: 13, color: '#0071e3', fontWeight: '600' },

  coverNoteWrap:  { padding: 16 },
  coverNoteLabel: { fontSize: 12, fontWeight: '600', color: '#9a9aa5', marginBottom: 6 },
  coverNoteText:  { fontSize: 14, color: '#1d1d1f', lineHeight: 21 },

  statusDropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  statusDropdownText: { fontSize: 15, fontWeight: '500', color: '#1d1d1f' },

  remarksSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remarksBadge:         { backgroundColor: '#ebebed', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  remarksBadgeText:     { fontSize: 11, fontWeight: '600', color: '#6e6e73' },

  remarkInputWrap: {
    marginHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#ffffff', borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  remarkInput:   { flex: 1, fontSize: 14, color: '#1d1d1f', maxHeight: 80 },
  remarkSendBtn: { paddingBottom: 2 },

  remarkList: { marginHorizontal: 16, marginTop: 8, gap: 1 },
  remarkItem: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#ffffff', padding: 14,
    borderRadius: 12, marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d2d2d7',
  },
  remarkAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ebebed', alignItems: 'center', justifyContent: 'center' },
  remarkAvatarText: { fontSize: 13, fontWeight: '700', color: '#6e6e73' },
  remarkHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  remarkAuthor:     { fontSize: 13, fontWeight: '600', color: '#1d1d1f' },
  remarkTime:       { fontSize: 12, color: '#9a9aa5' },
  remarkContent:    { fontSize: 14, color: '#3d3d42', lineHeight: 20 },

  deleteRow: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { fontSize: 15, color: '#b81c3a', fontWeight: '500' },

  pdfWebView:      { flex: 1 },
  pdfLoading:      { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f7' },
  pdfLoadingText:  { fontSize: 14, color: '#6e6e73', marginTop: 12 },

  rejectNote:       { fontSize: 14, color: '#6e6e73', marginBottom: 14, lineHeight: 20 },
  rejectInput:      {
    borderWidth: 1.5, borderColor: '#d2d2d7', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#1d1d1f', minHeight: 80,
    textAlignVertical: 'top', marginBottom: 16,
  },
  rejectActions:    { flexDirection: 'row', gap: 10 },
  rejectCancelBtn:  { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ebebed', alignItems: 'center' },
  rejectCancelText: { fontSize: 15, fontWeight: '500', color: '#6e6e73' },
  rejectConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#b81c3a', alignItems: 'center' },
  rejectConfirmText:{ fontSize: 15, fontWeight: '600', color: '#ffffff' },
});
