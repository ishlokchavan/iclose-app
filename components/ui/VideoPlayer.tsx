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
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Safari UA ────────────────────────────────────────────────────────────
// Disguise as Safari so YouTube serves the standard embed without WebView blocks.
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ─── Injected JS ──────────────────────────────────────────────────────────
// Runs inside youtube-nocookie.com/embed/ — same origin as the player DOM.
// CSS selectors here directly target YouTube player elements (no cross-origin barrier).
const INJECT_JS = `
(function() {
  var HIDE = [
    '.ytp-watermark',
    '.ytp-youtube-button',
    '.ytp-pause-overlay-container',
    '.ytp-pause-overlay',
    '.ytp-watch-later-button',
    '.ytp-share-button',
    '.ytp-copylink-button',
    '.ytp-cards-button',
    '.ytp-endscreen-content',
    '.ytp-title',
    '.ytp-title-channel',
    '.ytp-chrome-top',
    '.branding-img',
    '.ytp-logo',
  ].join(',');

  // Inject a stylesheet — persists across dynamic DOM changes
  var style = document.createElement('style');
  style.textContent = HIDE + '{display:none!important;opacity:0!important;pointer-events:none!important}';
  document.head.appendChild(style);

  // Belt-and-suspenders: MutationObserver hides elements re-injected by YouTube
  var obs = new MutationObserver(function() {
    document.querySelectorAll(HIDE).forEach(function(el) {
      el.style.cssText = 'display:none!important;opacity:0!important';
    });
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  function post(d) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(d)); }

  // Poll for #movie_player — YouTube's internal player object
  var p = null;
  var readySent = false;
  var pollInit = setInterval(function() {
    var el = document.querySelector('#movie_player');
    if (el && typeof el.getCurrentTime === 'function') {
      clearInterval(pollInit);
      p = el;
      if (!readySent) {
        readySent = true;
        post({ t: 'ready', dur: Math.floor(p.getDuration() || 0) });
      }
      // Report progress every 500 ms
      setInterval(function() {
        post({ t: 'tick', c: Math.floor(p.getCurrentTime()), d: Math.floor(p.getDuration() || 0) });
      }, 500);
      // State changes
      p.addEventListener('onStateChange', function(state) {
        post({ t: 'state', s: state });
      });
    }
  }, 300);

  // Commands from React Native
  function onCmd(e) {
    try {
      var cmd = JSON.parse(typeof e === 'string' ? e : e.data);
      if (!p) return;
      if (cmd.t === 'play')  p.playVideo();
      if (cmd.t === 'pause') p.pauseVideo();
      if (cmd.t === 'seek')  p.seekTo(cmd.v, true);
    } catch(x) {}
  }
  document.addEventListener('message', onCmd);
  window.addEventListener('message', onCmd);
})();
true;
`;

// ─── URL builder ──────────────────────────────────────────────────────────
function embedUrl(videoId: string, startSecs = 0) {
  const p = new URLSearchParams({
    controls:       '0',
    rel:            '0',
    showinfo:       '0',
    iv_load_policy: '3',
    playsinline:    '1',
    autoplay:       '1',
    modestbranding: '1',
    start:          String(Math.floor(startSecs)),
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${p.toString()}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmt(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function injectCmd(ref: React.RefObject<WebView | null>, cmd: object) {
  const js = `(function(){var e=new MessageEvent('message',{data:JSON.stringify(${JSON.stringify(cmd)})});window.dispatchEvent(e);})();true;`;
  ref.current?.injectJavaScript(js);
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

function Controls({ playing, buffering, currentTime, duration,
  isFullscreen, onTogglePlay, onSeek, onFullscreenToggle, bottomPad = 0 }: ControlsProps) {
  const [trackW, setTrackW] = useState(1);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <View style={styles.controlsOverlay} pointerEvents="box-none">
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

// ─── Shared WebView player ────────────────────────────────────────────────
interface PlayerViewProps {
  videoId: string;
  startSecs?: number;
  height: number;
  onMessage: (e: any) => void;
  wvRef: React.RefObject<WebView | null>;
}

function PlayerView({ videoId, startSecs = 0, height, onMessage, wvRef }: PlayerViewProps) {
  return (
    <WebView
      ref={wvRef}
      source={{ uri: embedUrl(videoId, startSecs) }}
      userAgent={SAFARI_UA}
      injectedJavaScript={INJECT_JS}
      onMessage={onMessage}
      allowsFullscreenVideo={false}
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      originWhitelist={['*']}
      scrollEnabled={false}
      bounces={false}
      style={[styles.webview, { height }]}
    />
  );
}

// ─── Public VideoPlayer ───────────────────────────────────────────────────
interface VideoPlayerProps {
  videoId: string;
  thumbnailUrl?: string | null;
}

export function VideoPlayer({ videoId, thumbnailUrl }: VideoPlayerProps) {
  const [launched, setLaunched]         = useState(false);
  const [playing, setPlaying]           = useState(false);
  const [buffering, setBuffering]       = useState(true);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen]     = useState(false);

  const mainRef  = useRef<WebView | null>(null);
  const fsRef    = useRef<WebView | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { width, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playerH = Math.round(width * 9 / 16);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const handleMessage = useCallback((e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.t === 'ready') {
        setBuffering(false);
        if (msg.dur > 0) setDuration(msg.dur);
        resetHideTimer();
      }
      if (msg.t === 'state') {
        // -1 unstarted | 0 ended | 1 playing | 2 paused | 3 buffering | 5 cued
        if (msg.s === 1) { setPlaying(true);  setBuffering(false); resetHideTimer(); }
        if (msg.s === 2) { setPlaying(false); setShowControls(true); clearTimeout(hideTimer.current); }
        if (msg.s === 3) { setBuffering(true); }
        if (msg.s === 0) { setPlaying(false); setShowControls(true); clearTimeout(hideTimer.current); }
      }
      if (msg.t === 'tick') {
        setCurrentTime(msg.c ?? 0);
        if ((msg.d ?? 0) > 0) setDuration(msg.d);
      }
    } catch {}
  }, [resetHideTimer]);

  const activeRef = useCallback(() => fullscreen ? fsRef : mainRef, [fullscreen]);

  const togglePlay = useCallback(() => {
    if (playing) {
      injectCmd(activeRef(), { t: 'pause' });
      setPlaying(false);
      setShowControls(true);
      clearTimeout(hideTimer.current);
    } else {
      injectCmd(activeRef(), { t: 'play' });
      setPlaying(true);
      resetHideTimer();
    }
  }, [playing, activeRef, resetHideTimer]);

  const handleSeek = useCallback((ratio: number) => {
    const t = Math.max(0, Math.min(duration, ratio * duration));
    setCurrentTime(t);
    injectCmd(activeRef(), { t: 'seek', v: t });
    resetHideTimer();
  }, [duration, activeRef, resetHideTimer]);

  const enterFullscreen = useCallback(() => {
    injectCmd(mainRef, { t: 'pause' });
    setPlaying(false);
    setBuffering(true);
    setFullscreen(true);
    resetHideTimer();
  }, [resetHideTimer]);

  const exitFullscreen = useCallback(() => {
    injectCmd(fsRef, { t: 'pause' });
    setFullscreen(false);
    setTimeout(() => {
      injectCmd(mainRef, { t: 'seek', v: currentTime });
      injectCmd(mainRef, { t: 'play' });
      setPlaying(true);
      resetHideTimer();
    }, 150);
  }, [currentTime, resetHideTimer]);

  const thumb = thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  // ── Thumbnail ────────────────────────────────────────────────────────────
  if (!launched) {
    return (
      <TouchableOpacity
        style={[styles.thumbnail, { height: playerH }]}
        onPress={() => { setLaunched(true); setBuffering(true); }}
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

  // ── Inline player ─────────────────────────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.playerWrap, { height: playerH }]}
        onPress={resetHideTimer}
      >
        <PlayerView
          videoId={videoId}
          height={playerH}
          onMessage={handleMessage}
          wvRef={mainRef}
        />
        {showControls ? (
          <Controls
            playing={playing} buffering={buffering}
            currentTime={currentTime} duration={duration}
            isFullscreen={false}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onFullscreenToggle={enterFullscreen}
          />
        ) : null}
      </TouchableOpacity>

      {/* ── Fullscreen modal ─────────────────────────────────────────────── */}
      <Modal
        visible={fullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={exitFullscreen}
      >
        <View style={styles.fsContainer}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={resetHideTimer}>
            <PlayerView
              videoId={videoId}
              startSecs={currentTime}
              height={screenHeight}
              onMessage={handleMessage}
              wvRef={fsRef}
            />
          </TouchableOpacity>
          {showControls ? (
            <Controls
              playing={playing} buffering={buffering}
              currentTime={currentTime} duration={duration}
              isFullscreen
              onTogglePlay={togglePlay}
              onSeek={handleSeek}
              onFullscreenToggle={exitFullscreen}
              bottomPad={insets.bottom}
            />
          ) : null}
        </View>
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

  playerWrap: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  webview:    { backgroundColor: '#000' },

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
