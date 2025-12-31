import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

// ✅ DOĞRU PATH: src/screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import IzinTalepScreen from './src/screens/IzinTalepScreen';
import IzinDetayScreen from './src/screens/IzinDetayScreen';
import GecmisIzinlerScreen from './src/screens/GecmisIzinlerScreen';
import OnayListesiScreen from './src/screens/OnayListesiScreen';
import OnayDetayScreen from './src/screens/OnayDetayScreen';
import ProfilScreen from './src/screens/ProfilScreen';
import BildirimScreen from './src/screens/BildirimScreen';
import SifreUnuttumScreen from './src/screens/SifreUnuttumScreen';
import KiyafetScreen from './src/screens/KiyafetScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar backgroundColor="#cc0000" barStyle="light-content" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: '#cc0000' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* Giriş */}
        <Stack.Screen name="Login" component={LoginScreen} />

        {/* Ana Panel */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />

        {/* İzin İşlemleri */}
        <Stack.Screen
          name="IzinTalep"
          component={IzinTalepScreen}
          options={{ headerShown: true, title: 'İzin Talebi Oluştur' }}
        />
        <Stack.Screen
          name="IzinDetay"
          component={IzinDetayScreen}
          options={{ headerShown: true, title: 'İzin Detayları' }}
        />
        <Stack.Screen
          name="GecmisIzinler"
          component={GecmisIzinlerScreen}
          options={{ headerShown: true, title: 'Geçmiş İzinlerim' }}
        />

        {/* Yönetici Onay */}
        <Stack.Screen
          name="OnayListesi"
          component={OnayListesiScreen}
          options={{ headerShown: true, title: 'Onay Bekleyenler' }}
        />
        <Stack.Screen
          name="OnayDetay"
          component={OnayDetayScreen}
          options={{ headerShown: true, title: 'Talep İncele' }}
        />

        {/* Diğer */}
        <Stack.Screen name="Profil" component={ProfilScreen} />
        <Stack.Screen
          name="Bildirimler"
          component={BildirimScreen}
          options={{ headerShown: true, title: 'Bildirimler' }}
        />
        <Stack.Screen
          name="SifreUnuttum"
          component={SifreUnuttumScreen}
          options={{ headerShown: true, title: 'Şifremi Unuttum' }}
        />

        {/* Kıyafet */}
        <Stack.Screen
          name="Kiyafet"
          component={KiyafetScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
