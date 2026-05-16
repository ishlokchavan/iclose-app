import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import YoutubeIframe, { PLAYER_STATES, YoutubeIframeRef } from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmt(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// ─── Controls overlay ─────────────────────────────────────────────────────
interface ControlsProps {
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (ratio: number) => void;
  onFullscreenToggle: () => void;
  bottomPad?: number;
}

function Controls({
  playing, buffering, currentTime, duration,
  isFullscreen, onTogglePlay, onSeek, onFullscreenToggle, bottomPad = 0,
}: ControlsProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <View style={styles.controlsOverlay} pointerEvents="box-none">
      <View style={styles.dimBottom} pointerEvents="none" />

      {/* Centre play/pause */}
      <TouchableOpacity style={styles.centerBtn} onPress={onTogglePlay} activeOpacity={0.75}>
        {buffering
          ? <ActivityIndicator size="large" color="#fff" />
          : <Ionicons name={playing ? 'pause' : 'play'} size={44} color="#fff" />}
      </TouchableOpacity>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 10 }]}>
        <Text style={styles.timeText}>{fmt(currentTime)}</Text>

        <TouchableOpacity
          style={styles.seekTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={(e) => onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth)))}
          activeOpacity={1}
        >
          <View style={styles.trackBg} />
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.trackDot, { left: `${Math.min(96, progress * 100)}%` }]} />
        </TouchableOpacity>

        <Text style={styles.timeText}>{fmt(duration)}</Text>

        <TouchableOpacity style={styles.fsBtn} onPress={onFullscreenToggle} activeOpacity={0.8}>
          <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Shared player params ─────────────────────────────────────────────────
const PLAYER_PARAMS = {
  controls: false,  // hides entire YouTube control bar + all branding
  rel: false,
  iv_load_policy: 3,
  preventFullScreen: false,
} as const;

const WEBVIEW_PROPS = {
  allowsFullscreenVideo: false,
  allowsInlineMediaPlayback: true,
  mediaPlaybackRequiresUserAction: false,
} as const;

// ─── Inline player ────────────────────────────────────────────────────────
interface InlinePlayerProps {
  videoId: string;
  height: number;
  startPlaying?: boolean;
  onTimeUpdate?: (t: number, d: number) => void;
  controlsVisible: boolean;
  onTap: () => void;
  onFullscreen: () => void;
}

function InlinePlayer({
  videoId, height, startPlaying = true,
  onTimeUpdate, controlsVisible, onTap, onFullscreen,
}: InlinePlayerProps) {
  const [playing, setPlaying] = useState(startPlaying);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const ref = useRef<YoutubeIframeRef>(null);
  const poll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (playing) {
      poll.current = setInterval(async () => {
        const t = (await ref.current?.getCurrentTime()) ?? 0;
        const d = (await ref.current?.getDuration()) ?? 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
        onTimeUpdate?.(t, d);
      }, 500);
    } else {
      clearInterval(poll.current);
    }
    return () => clearInterval(poll.current);
  }, [playing, onTimeUpdate]);

  return (
    <TouchableOpacity activeOpacity={1} style={{ height }} onPress={onTap}>
      <YoutubeIframe
        ref={ref}
        videoId={videoId}
        height={height}
        play={playing}
        initialPlayerParams={PLAYER_PARAMS}
        onChangeState={(s: PLAYER_STATES) => {
          if (s === PLAYER_STATES.PLAYING)   { setPlaying(true);  setBuffering(false); }
          if (s === PLAYER_STATES.PAUSED)    { setPlaying(false); }
          if (s === PLAYER_STATES.BUFFERING) { setBuffering(true); }
          if (s === PLAYER_STATES.ENDED)     { setPlaying(false); }
        }}
        onReady={() => setBuffering(false)}
        webViewProps={WEBVIEW_PROPS}
        forceAndroidAutoplay={Platform.OS === 'android'}
      />
      {controlsVisible ? (
        <Controls
          playing={playing} buffering={buffering}
          currentTime={currentTime} duration={duration}
          isFullscreen={false}
          onTogglePlay={() => setPlaying((p) => !p)}
          onSeek={(r) => {
            const t = r * duration;
            setCurrentTime(t);
            ref.current?.seekTo(t, true);
          }}
          onFullscreenToggle={onFullscreen}
        />
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Fullscreen player ────────────────────────────────────────────────────
interface FsPlayerProps {
  videoId: string;
  startTime: number;
  onClose: () => void;
}

function FsPlayer({ videoId, startTime, onClose }: FsPlayerProps) {
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const ref = useRef<YoutubeIframeRef>(null);
  const poll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const playerH = Math.min(width, height);

  useEffect(() => {
    if (playing) {
      poll.current = setInterval(async () => {
        const t = (await ref.current?.getCurrentTime()) ?? 0;
        const d = (await ref.current?.getDuration()) ?? 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      }, 500);
    } else {
      clearInterval(poll.current);
    }
    return () => clearInterval(poll.current);
  }, [playing]);

  const tapHandler = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  // Seek to startTime once ready
  const onReady = useCallback(() => {
    setBuffering(false);
    if (startTime > 1) ref.current?.seekTo(startTime, true);
    tapHandler();
  }, [startTime, tapHandler]);

  useEffect(() => () => { clearInterval(poll.current); clearTimeout(hideTimer.current); }, []);

  return (
    <View style={styles.fsContainer}>
      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={tapHandler}>
        <YoutubeIframe
          ref={ref}
          videoId={videoId}
          height={playerH}
          play={playing}
          initialPlayerParams={PLAYER_PARAMS}
          onChangeState={(s: PLAYER_STATES) => {
            if (s === PLAYER_STATES.PLAYING)   { setPlaying(true);  setBuffering(false); }
            if (s === PLAYER_STATES.PAUSED)    setPlaying(false);
            if (s === PLAYER_STATES.BUFFERING) setBuffering(true);
            if (s === PLAYER_STATES.ENDED)     setPlaying(false);
          }}
          onReady={onReady}
          webViewProps={WEBVIEW_PROPS}
          forceAndroidAutoplay={Platform.OS === 'android'}
        />
      </TouchableOpacity>

      {showControls ? (
        <Controls
          playing={playing} buffering={buffering}
          currentTime={currentTime} duration={duration}
          isFullscreen
          onTogglePlay={() => setPlaying((p) => !p)}
          onSeek={(r) => {
            const t = r * duration;
            setCurrentTime(t);
            ref.current?.seekTo(t, true);
          }}
          onFullscreenToggle={onClose}
          bottomPad={insets.bottom}
        />
      ) : null}
    </View>
  );
}

// ─── Public component ─────────────────────────────────────────────────────
interface VideoPlayerProps {
  videoId: string;
  thumbnailUrl?: string | null;
}

export function VideoPlayer({ videoId, thumbnailUrl }: VideoPlayerProps) {
  const [launched, setLaunched] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [syncTime, setSyncTime] = useState(0);

  const { width } = useWindowDimensions();
  const playerH = Math.round(width * 9 / 16);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleTap = useCallback(() => {
    setShowControls((v) => {
      if (!v) {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 3500);
        return true;
      }
      return false;
    });
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const thumb = thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (!launched) {
    return (
      <TouchableOpacity
        style={[styles.thumbnail, { height: playerH }]}
        onPress={() => { setLaunched(true); setShowControls(true); }}
        activeOpacity={0.9}
      >
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.thumbDim} />
        <View style={styles.playBubble}>
          <Ionicons name="play" size={36} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <InlinePlayer
        videoId={videoId}
        height={playerH}
        startPlaying
        controlsVisible={showControls}
        onTap={handleTap}
        onTimeUpdate={(t) => setSyncTime(t)}
        onFullscreen={() => setFullscreen(true)}
      />

      <Modal
        visible={fullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <FsPlayer
          videoId={videoId}
          startTime={syncTime}
          onClose={() => setFullscreen(false)}
        />
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  thumbnail: {
    width: '100%', backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbDim:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.22)' },
  playBubble: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    paddingLeft: 4,
  },

  controlsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  dimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centerBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 4,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  timeText: { fontSize: 12, color: '#fff', fontWeight: '500', minWidth: 36, textAlign: 'center' },
  seekTrack: { flex: 1, height: 20, justifyContent: 'center' },
  trackBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
  trackFill: { height: 3, backgroundColor: '#fff', borderRadius: 2, position: 'absolute', left: 0 },
  trackDot:  {
    position: 'absolute', top: '50%', width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#fff', marginTop: -6, marginLeft: -6,
  },
  fsBtn: { padding: 4 },

  fsContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
});
