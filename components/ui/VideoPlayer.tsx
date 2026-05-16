import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import YoutubeIframe, { PLAYER_STATES, YoutubeIframeRef } from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';

// Injected into the YouTube WebView to strip all visible YouTube branding
const HIDE_BRANDING_JS = `
(function() {
  var css = [
    '.ytp-watermark',
    '.ytp-youtube-button',
    '.ytp-pause-overlay-container',
    '.ytp-pause-overlay',
    '.ytp-endscreen-content',
    '.ytp-cards-button',
    '.ytp-share-button',
    '.ytp-watch-later-button',
    '.ytp-copylink-button',
    '.branding-img',
    '.ytp-logo',
  ].join(',') + '{display:none!important;opacity:0!important;pointer-events:none!important}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Reapply on interval — YouTube re-injects some elements dynamically
  setInterval(function() {
    var sel = '.ytp-watermark,.ytp-youtube-button,.ytp-pause-overlay-container,.ytp-endscreen-content,.ytp-share-button,.ytp-watch-later-button,.ytp-copylink-button,.branding-img,.ytp-logo';
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      els[i].style.cssText = 'display:none!important;opacity:0!important';
    }
  }, 600);
})();
true;
`;

interface VideoPlayerProps {
  videoId: string;
  thumbnailUrl?: string | null;
}

export function VideoPlayer({ videoId, thumbnailUrl }: VideoPlayerProps) {
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const playerRef = useRef<YoutubeIframeRef>(null);
  const { width } = useWindowDimensions();
  const playerHeight = Math.round(width * 9 / 16);

  const onStateChange = useCallback((state: PLAYER_STATES) => {
    if (state === PLAYER_STATES.PLAYING)  { setPlaying(true);  setBuffering(false); }
    if (state === PLAYER_STATES.PAUSED)   { setPlaying(false); setBuffering(false); }
    if (state === PLAYER_STATES.BUFFERING){ setBuffering(true); }
    if (state === PLAYER_STATES.ENDED)    { setPlaying(false); setBuffering(false); }
  }, []);

  // Thumbnail tap-to-play — no YouTube request until user explicitly plays
  if (!mounted) {
    const thumb = thumbnailUrl
      ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
      <TouchableOpacity
        style={[styles.thumbnail, { height: playerHeight }]}
        onPress={() => setMounted(true)}
        activeOpacity={0.9}
      >
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={styles.thumbnailOverlay} />
        <View style={styles.playBtn}>
          <Ionicons name="play" size={36} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.player, { height: playerHeight }]}>
      <YoutubeIframe
        ref={playerRef}
        videoId={videoId}
        height={playerHeight}
        width={width}
        play={playing}
        onChangeState={onStateChange}
        onReady={() => setPlaying(true)}
        initialPlayerParams={{
          controls: true,
          rel: false,
          iv_load_policy: 3,
          preventFullScreen: false,
        }}
        webViewProps={{
          allowsFullscreenVideo: true,
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          injectedJavaScript: HIDE_BRANDING_JS,
          javaScriptEnabled: true,
        }}
        forceAndroidAutoplay={Platform.OS === 'android'}
      />
      {buffering ? (
        <View style={styles.bufferOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  player: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
