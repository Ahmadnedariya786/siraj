import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siraj.app',
  appName: 'Siraj',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      fadeOutDuration: 180,
      backgroundColor: "#060911",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    LocalNotifications: {
      smallIcon: "ic_stat_noor_mosque",
      iconColor: "#D4AF37",
      sound: "beep.wav"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Geolocation: {
      requestPermissions: true
    }
  }
};

export default config;
