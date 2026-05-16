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

// useLocalHTML ensures controls:0 is embedded directly in the YT.Player constructor.
// baseUrlOverride tells YouTube the embedding origin is lonelycpp.github.io (accepted domain).
const BASE_URL = 'https://lonelycpp.github.io/react-native-youtube-iframe/';

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
  // dragRatio: non-null while the user is dragging the seek handle
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const baseProgress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const progress = dragRatio !== null ? dragRatio : baseProgress;

  const getRatio = (locationX: number) =>
    Math.max(0, Math.min(1, locationX / trackW));

  return (
    <View style={styles.controlsOverlay}>
      {/* Tap-anywhere to toggle controls visibility — rendered first so it's below all other elements */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onTap} />

      <View style={styles.dimBottom} pointerEvents="none" />

      <TouchableOpacity style={styles.centerBtn} onPress={onTogglePlay} activeOpacity={0.75}>
        {buffering
          ? <ActivityIndicator size="large" color="#fff" />
          : <Ionicons name={playing ? 'pause' : 'play'} size={44} color="#fff" />}
      </TouchableOpacity>

      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 10 }]}>
        <Text style={styles.timeText}>{fmt(currentTime)}</Text>

        {/* Responder-based seek track supports both tap and drag */}
        <View
          style={styles.seekTrack}
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) =>
            setDragRatio(getRatio(e.nativeEvent.locationX))}
          onResponderMove={(e) =>
            setDragRatio(getRatio(e.nativeEvent.locationX))}
          onResponderRelease={(e) => {
            const r = getRatio(e.nativeEvent.locationX);
            setDragRatio(null);
            onSeek(r);
          }}
          onResponderTerminate={() => setDragRatio(null)}
        >
          <View style={styles.trackBg} />
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.trackDot, { left: `${Math.min(96, progress * 100)}%` }]} />
        </View>

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
    setPlaying(true);
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
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <YoutubeIframe
          ref={playerRef}
          videoId={videoId}
          height={height}
          width={width}
          play={playing}
          useLocalHTML
          baseUrlOverride={BASE_URL}
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
// Rendered inside a portrait Modal. We rotate the content 90° so it appears
// landscape without requiring any native orientation API.
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

  // W < H in portrait; after 90° rotation the video fills H × W (landscape)
  const { width: W, height: H } = useWindowDimensions();
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
    setPlaying(true);
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

  // The inner content is sized H × W (landscape) then rotated 90° clockwise
  // so it visually fills the portrait screen W × H.
  // The translate offsets re-center it after rotation changes its apparent position.
  const vidW = H;
  const vidH = W;
  const innerStyle = {
    width: vidW,
    height: vidH,
    transform: [
      { translateX: (W - H) / 2 },
      { translateY: (H - W) / 2 },
      { rotate: '90deg' },
    ],
  } as const;

  return (
    <View style={{ width: W, height: H, backgroundColor: '#000', overflow: 'hidden' }}>
      <View style={innerStyle}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <YoutubeIframe
            ref={playerRef}
            videoId={videoId}
            height={vidH}
            width={vidW}
            play={playing}
            useLocalHTML
            baseUrlOverride={BASE_URL}
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
  seekTrack: { flex: 1, height: 28, justifyContent: 'center' },
  trackBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
  trackFill: { height: 3, backgroundColor: '#fff', borderRadius: 2, position: 'absolute', left: 0 },
  trackDot: {
    position: 'absolute', top: '50%', width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#fff', marginTop: -7, marginLeft: -7,
  },
  fsBtn: { padding: 4 },
});
