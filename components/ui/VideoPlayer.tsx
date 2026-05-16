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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── YouTube IFrame API page ───────────────────────────────────────────────
// controls=0 suppresses the entire YouTube control bar and all branding.
// All UI is handled by the RN overlay beneath this component.
function buildHtml(videoId: string, startSecs = 0) {
  return `<!DOCTYPE html><html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
#p{width:100%;height:100%}
</style>
</head>
<body>
<div id="p"></div>
<script>
var s=document.createElement('script');
s.src='https://www.youtube.com/iframe_api';
document.head.appendChild(s);
var pl,dur=0;
function onYouTubeIframeAPIReady(){
  pl=new YT.Player('p',{
    videoId:'${videoId}',
    playerVars:{
      autoplay:1,controls:0,rel:0,showinfo:0,
      iv_load_policy:3,playsinline:1,disablekb:1,
      fs:0,start:${Math.floor(startSecs)}
    },
    events:{
      onReady:function(e){dur=e.target.getDuration();post({t:'ready',dur:dur})},
      onStateChange:function(e){post({t:'state',s:e.data})},
      onError:function(e){post({t:'err',c:e.data})}
    }
  });
}
function post(d){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d))}
setInterval(function(){
  if(pl&&pl.getCurrentTime){
    post({t:'tick',c:Math.floor(pl.getCurrentTime()),d:Math.floor(pl.getDuration()||dur)});
  }
},500);
document.addEventListener('message',h);
window.addEventListener('message',h);
function h(e){
  try{
    var c=JSON.parse(e.data);
    if(c.t==='play') pl.playVideo();
    else if(c.t==='pause') pl.pauseVideo();
    else if(c.t==='seek') pl.seekTo(c.v,true);
  }catch(x){}
}
</script>
</body>
</html>`;
}

function fmt(s: number) {
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function injectCmd(ref: React.RefObject<WebView | null>, cmd: object) {
  ref.current?.injectJavaScript(
    `(function(){window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(${JSON.stringify(cmd)})}))})();true;`
  );
}

// ─── Controls overlay ─────────────────────────────────────────────────────
interface ControlsProps {
  playing: boolean;
  buffering: boolean;
  currentTime: number;
  duration: number;
  showControls: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (ratio: number) => void;
  onFullscreen: () => void;
  bottomPad?: number;
}

function Controls({
  playing, buffering, currentTime, duration,
  showControls, isFullscreen,
  onTogglePlay, onSeek, onFullscreen, bottomPad = 0,
}: ControlsProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  if (!showControls) return null;

  return (
    <View style={styles.controlsOverlay} pointerEvents="box-none">
      {/* Gradient dimming */}
      <View style={styles.dimTop} pointerEvents="none" />
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

        {/* Seek bar */}
        <TouchableOpacity
          style={styles.seekTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={(e) => onSeek(e.nativeEvent.locationX / trackWidth)}
          activeOpacity={1}
        >
          <View style={styles.trackBg} />
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.trackDot, { left: `${Math.min(98, progress * 100)}%` }]} />
        </TouchableOpacity>

        <Text style={styles.timeText}>{fmt(duration)}</Text>

        <TouchableOpacity style={styles.fsBtn} onPress={onFullscreen} activeOpacity={0.8}>
          <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
interface VideoPlayerProps {
  videoId: string;
  thumbnailUrl?: string | null;
}

export function VideoPlayer({ videoId, thumbnailUrl }: VideoPlayerProps) {
  const [launched, setLaunched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const mainRef = useRef<WebView>(null);
  const fsRef   = useRef<WebView>(null);
  const timer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const playerH = Math.round(width * 9 / 16);

  const resetTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowControls(false), 3500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const activeRef = useCallback((): React.RefObject<WebView | null> => fullscreen ? fsRef : mainRef, [fullscreen]);

  const togglePlay = useCallback(() => {
    const ref = activeRef();
    if (playing) {
      injectCmd(ref, { t: 'pause' });
      setPlaying(false);
      setShowControls(true);
      clearTimeout(timer.current);
    } else {
      injectCmd(ref, { t: 'play' });
      setPlaying(true);
      resetTimer();
    }
  }, [playing, activeRef, resetTimer]);

  const handleSeek = useCallback((ratio: number) => {
    const t = Math.max(0, Math.min(duration, ratio * duration));
    setCurrentTime(t);
    injectCmd(activeRef(), { t: 'seek', v: t });
    resetTimer();
  }, [duration, activeRef, resetTimer]);

  const makeMessageHandler = useCallback((isFsPlayer: boolean) => (e: any) => {
    // Only process messages from the active player
    if (isFsPlayer !== fullscreen) return;
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.t === 'ready') {
        setBuffering(false);
        if (msg.dur > 0) setDuration(msg.dur);
        resetTimer();
      }
      if (msg.t === 'state') {
        // -1 unstarted | 0 ended | 1 playing | 2 paused | 3 buffering | 5 cued
        if (msg.s === 1) { setPlaying(true);  setBuffering(false); resetTimer(); }
        if (msg.s === 2) { setPlaying(false); setShowControls(true); clearTimeout(timer.current); }
        if (msg.s === 3) { setBuffering(true); }
        if (msg.s === 0) { setPlaying(false); setShowControls(true); clearTimeout(timer.current); }
      }
      if (msg.t === 'tick') {
        setCurrentTime(msg.c ?? 0);
        if ((msg.d ?? 0) > 0) setDuration(msg.d);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen, resetTimer]);

  const mainMsgHandler = makeMessageHandler(false);
  const fsMsgHandler   = makeMessageHandler(true);

  const enterFullscreen = useCallback(() => {
    injectCmd(mainRef, { t: 'pause' });
    setPlaying(false);
    setBuffering(true);
    setFullscreen(true);
    resetTimer();
  }, [resetTimer]);

  const exitFullscreen = useCallback(() => {
    injectCmd(fsRef, { t: 'pause' });
    setFullscreen(false);
    // Resume main player from current position
    setTimeout(() => {
      injectCmd(mainRef, { t: 'seek', v: currentTime });
      injectCmd(mainRef, { t: 'play' });
      setPlaying(true);
      resetTimer();
    }, 100);
  }, [currentTime, resetTimer]);

  const thumb = thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  // ── Thumbnail (before launch) ──────────────────────────────────────────
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

  // ── Inline player ──────────────────────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.playerWrap, { height: playerH }]}
        onPress={resetTimer}
      >
        <WebView
          ref={mainRef}
          source={{ html: buildHtml(videoId) }}
          onMessage={mainMsgHandler}
          allowsFullscreenVideo={false}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          style={styles.webview}
        />
        <Controls
          playing={playing} buffering={buffering}
          currentTime={currentTime} duration={duration}
          showControls={showControls} isFullscreen={false}
          onTogglePlay={togglePlay} onSeek={handleSeek} onFullscreen={enterFullscreen}
        />
      </TouchableOpacity>

      {/* ── Fullscreen modal ──────────────────────────────────────────── */}
      <Modal visible={fullscreen} animationType="fade" statusBarTranslucent onRequestClose={exitFullscreen}>
        <View style={styles.fsContainer}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={resetTimer}>
            <WebView
              ref={fsRef}
              source={{ html: buildHtml(videoId, currentTime) }}
              onMessage={fsMsgHandler}
              allowsFullscreenVideo={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              scrollEnabled={false}
              bounces={false}
              style={styles.webview}
            />
          </TouchableOpacity>
          <Controls
            playing={playing} buffering={buffering}
            currentTime={currentTime} duration={duration}
            showControls={showControls} isFullscreen
            onTogglePlay={togglePlay} onSeek={handleSeek} onFullscreen={exitFullscreen}
            bottomPad={insets.bottom}
          />
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  playBubble: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
    paddingLeft: 4,
  },

  playerWrap: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  webview:    { flex: 1, backgroundColor: '#000' },

  // Controls overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dimTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'transparent',
  },
  dimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  centerBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 4,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 8,
  },
  timeText: { fontSize: 12, color: '#fff', fontWeight: '500', minWidth: 36, textAlign: 'center' },
  seekTrack: {
    flex: 1, height: 20, justifyContent: 'center',
  },
  trackBg:   { height: 3, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
  trackFill: { height: 3, backgroundColor: '#fff', borderRadius: 2, position: 'absolute', left: 0 },
  trackDot: {
    position: 'absolute', top: '50%', width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#fff',
    marginTop: -6, marginLeft: -6,
  },
  fsBtn: { padding: 4 },

  // Fullscreen
  fsContainer: { flex: 1, backgroundColor: '#000' },
});
