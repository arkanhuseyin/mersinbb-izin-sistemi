import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

// Mevcut Ekranlar
import LoginScreen from './LoginScreen';
import DashboardScreen from './DashboardScreen';
import IzinTalepScreen from './IzinTalepScreen';
import IzinDetayScreen from './IzinDetayScreen';
import GecmisIzinlerScreen from './GecmisIzinlerScreen';
import OnayListesiScreen from './OnayListesiScreen';
import OnayDetayScreen from './OnayDetayScreen';
import ProfilScreen from './ProfilScreen';
import BildirimScreen from './BildirimScreen';
import SifreUnuttumScreen from './SifreUnuttumScreen';

// ✅ YENİ EKLENEN: KIYAFET EKRANI
import KiyafetScreen from './KiyafetScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar backgroundColor="#cc0000" barStyle="light-content" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false, // Varsayılan olarak header gizli
          headerStyle: { backgroundColor: '#cc0000' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {/* Giriş Ekranı */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />

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

        {/* Yönetici Onay İşlemleri */}
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

        {/* Diğer Ekranlar */}
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

        {/* ✅ YENİ EKLENEN: KIYAFET/BEDEN EKRANI */}
        <Stack.Screen 
            name="Kiyafet" 
            component={KiyafetScreen} 
            options={{ headerShown: false }} // Kendi header'ı var
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}