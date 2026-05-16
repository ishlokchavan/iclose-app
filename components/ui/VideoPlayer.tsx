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

// YouTube playerVars: controls=0 suppresses the entire YouTube UI.
// Combined with pointerEvents="none" on the WebView wrapper, users
// can't trigger any of YouTube's hover/tap overlays either.
const PLAYER_PARAMS = {
  controls: false,
  rel: false,
  iv_load_policy: 3,
  preventFullScreen: false,
} as const;

const WEBVIEW_PROPS = {
  allowsFullscreenVideo: false,
  allowsInlineMediaPlayback: true,
  mediaPlaybackRequiresUserAction: false,
} as const;

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
  onTap: () => void;
  bottomPad?: number;
}

function Controls({
  playing, buffering, currentTime, duration,
  isFullscreen, onTogglePlay, onSeek, onFullscreenToggle, onTap, bottomPad = 0,
}: ControlsProps) {
  const [trackW, setTrackW] = useState(1);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <View style={styles.controlsOverlay}>
      {/* Tap-anywhere area to toggle controls visibility */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onTap} />

      <View style={styles.dimBottom} pointerEvents="none" />

      <TouchableOpacity style={styles.centerBtn} onPress={onTogglePlay} activeOpacity={0.75}>
        {buffering
          ? <ActivityIndicator size="large" color="#fff" />
          : <Ionicons name={playing ? 'pause' : 'play'} size={44} color="#fff" />}
      </TouchableOpacity>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 10 }]}>
        <Text style={styles.timeText}>{fmt(currentTime)}</Text>
        <TouchableOpacity
          style={styles.seekTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          onPress={(e) => onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackW)))}
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

// ─── Inline player ────────────────────────────────────────────────────────
interface InlinePlayerProps {
  videoId: string;
  width: number;
  height: number;
  startSecs?: number;
  onEnterFullscreen: (currentTime: number) => void;
}

function InlinePlayer({ videoId, width, height, startSecs = 0, onEnterFullscreen }: InlinePlayerProps) {
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(startSecs);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<YoutubeIframeRef>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetHide = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    if (playing) {
      pollRef.current = setInterval(async () => {
        const t = (await playerRef.current?.getCurrentTime()) ?? 0;
        const d = (await playerRef.current?.getDuration()) ?? 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      }, 500);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [playing]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearTimeout(hideTimerRef.current);
  }, []);

  const onReady = useCallback(() => {
    setBuffering(false);
    if (startSecs > 1) playerRef.current?.seekTo(startSecs, true);
    resetHide();
  }, [startSecs, resetHide]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next) resetHide();
      else { setShowControls(true); clearTimeout(hideTimerRef.current); }
      return next;
    });
  }, [resetHide]);

  const handleSeek = useCallback((ratio: number) => {
    const t = ratio * duration;
    setCurrentTime(t);
    playerRef.current?.seekTo(t, true);
    resetHide();
  }, [duration, resetHide]);

  const handleTap = useCallback(() => {
    if (showControls) {
      setShowControls(false);
      clearTimeout(hideTimerRef.current);
    } else {
      resetHide();
    }
  }, [showControls, resetHide]);

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* YouTube iframe wrapper — pointerEvents=none blocks all touches
          so YouTube can't show its hover/tap overlays */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <YoutubeIframe
          ref={playerRef}
          videoId={videoId}
          height={height}
          width={width}
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
      </View>

      {/* Black overlay shown while loading / paused at start — hides any
          brief YouTube branding flash before the player is ready */}
      {buffering ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} />
        </View>
      ) : null}

      {showControls ? (
        <Controls
          playing={playing} buffering={buffering}
          currentTime={currentTime} duration={duration}
          isFullscreen={false}
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onFullscreenToggle={() => {
            setPlaying(false);
            onEnterFullscreen(currentTime);
          }}
          onTap={handleTap}
        />
      ) : (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleTap} />
      )}
    </View>
  );
}

// ─── Fullscreen player ────────────────────────────────────────────────────
interface FsPlayerProps {
  videoId: string;
  startSecs: number;
  onClose: (currentTime: number) => void;
}

function FsPlayer({ videoId, startSecs, onClose }: FsPlayerProps) {
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(startSecs);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<YoutubeIframeRef>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const resetHide = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => {
    if (playing) {
      pollRef.current = setInterval(async () => {
        const t = (await playerRef.current?.getCurrentTime()) ?? 0;
        const d = (await playerRef.current?.getDuration()) ?? 0;
        setCurrentTime(t);
        if (d > 0) setDuration(d);
      }, 500);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [playing]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
    clearTimeout(hideTimerRef.current);
  }, []);

  const onReady = useCallback(() => {
    setBuffering(false);
    if (startSecs > 1) playerRef.current?.seekTo(startSecs, true);
    resetHide();
  }, [startSecs, resetHide]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next) resetHide();
      else { setShowControls(true); clearTimeout(hideTimerRef.current); }
      return next;
    });
  }, [resetHide]);

  const handleSeek = useCallback((ratio: number) => {
    const t = ratio * duration;
    setCurrentTime(t);
    playerRef.current?.seekTo(t, true);
    resetHide();
  }, [duration, resetHide]);

  const handleTap = useCallback(() => {
    if (showControls) {
      setShowControls(false);
      clearTimeout(hideTimerRef.current);
    } else {
      resetHide();
    }
  }, [showControls, resetHide]);

  return (
    <View style={styles.fsContainer}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <YoutubeIframe
          ref={playerRef}
          videoId={videoId}
          height={height}
          width={width}
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
      </View>

      {buffering ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" style={StyleSheet.absoluteFill} />
        </View>
      ) : null}

      {showControls ? (
        <Controls
          playing={playing} buffering={buffering}
          currentTime={currentTime} duration={duration}
          isFullscreen
          onTogglePlay={togglePlay}
          onSeek={handleSeek}
          onFullscreenToggle={() => onClose(currentTime)}
          onTap={handleTap}
          bottomPad={insets.bottom}
        />
      ) : (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleTap} />
      )}
    </View>
  );
}

// ─── Public VideoPlayer ───────────────────────────────────────────────────
interface VideoPlayerProps {
  videoId: string;
  thumbnailUrl?: string | null;
}

export function VideoPlayer({ videoId, thumbnailUrl }: VideoPlayerProps) {
  const [launched, setLaunched] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsStartSecs, setFsStartSecs] = useState(0);
  const [resumeSecs, setResumeSecs] = useState(0);

  const { width } = useWindowDimensions();
  const playerH = Math.round(width * 9 / 16);
  const thumb = thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (!launched) {
    return (
      <TouchableOpacity
        style={[styles.thumbnail, { height: playerH }]}
        onPress={() => setLaunched(true)}
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
      {/* When fullscreen is active, the inline player is unmounted to free the
          single YouTube WebView instance — we remount it with resumeSecs on exit */}
      {!fullscreen ? (
        <InlinePlayer
          key={`inline-${resumeSecs}`}
          videoId={videoId}
          width={width}
          height={playerH}
          startSecs={resumeSecs}
          onEnterFullscreen={(t) => {
            setFsStartSecs(t);
            setFullscreen(true);
          }}
        />
      ) : (
        <View style={[styles.thumbnail, { height: playerH }]} />
      )}

      <Modal
        visible={fullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <FsPlayer
          videoId={videoId}
          startSecs={fsStartSecs}
          onClose={(t) => {
            setResumeSecs(t);
            setFullscreen(false);
          }}
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centerBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center', paddingLeft: 4,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8,
  },
  timeText:  { fontSize: 12, color: '#fff', fontWeight: '500', minWidth: 36, textAlign: 'center' },
  seekTrack: { flex: 1, height: 20, justifyContent: 'center' },
  trackBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
  trackFill: { height: 3, backgroundColor: '#fff', borderRadius: 2, position: 'absolute', left: 0 },
  trackDot: {
    position: 'absolute', top: '50%', width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#fff', marginTop: -6, marginLeft: -6,
  },
  fsBtn: { padding: 4 },

  fsContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
});
