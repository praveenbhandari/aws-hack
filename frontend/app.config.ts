import type { ConfigContext, ExpoConfig } from 'expo/config';

const GOOGLE_MAPS_MOBILE_KEY = process.env.GOOGLE_MAPS_MOBILE_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Guardian',
  slug: 'guardian',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'guardian',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.praveenbhandari.guardian',
    config: {
      googleMapsApiKey: GOOGLE_MAPS_MOBILE_KEY,
    },
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Guardian needs your microphone so you can talk to your safety companion.',
    },
  },
  android: {
    package: 'com.guardian.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: GOOGLE_MAPS_MOBILE_KEY,
      },
    },
    permissions: ['RECORD_AUDIO'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'react-native-maps',
      {
        iosGoogleMapsApiKey: GOOGLE_MAPS_MOBILE_KEY,
        androidGoogleMapsApiKey: GOOGLE_MAPS_MOBILE_KEY,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Guardian needs your location to show nearby crime hotspots and find safe routes.',
      },
    ],
  ],
});
