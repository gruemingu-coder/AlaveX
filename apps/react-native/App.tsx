import React, {useState} from 'react';
import {
  Button,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SessionProvider, useSession} from './src/SessionContext';
import {AlaveXProtocol, connectSignaling, resolveHostAddress} from './src/alavexApi';

const Tab = createBottomTabNavigator();

function clientName(): string {
  if (Platform.OS === 'android') return 'AlaveX Android';
  if (Platform.OS === 'windows') return 'AlaveX Windows';
  return 'AlaveX';
}

function platformLabel(): string {
  if (Platform.OS === 'android') return 'Android · React Native';
  if (Platform.OS === 'windows') return 'Windows · React Native';
  return 'React Native';
}

function LoginScreen() {
  const {login, error} = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>AlaveX</Text>
      <Text style={styles.caption}>{platformLabel()}</Text>
      <TextInput style={styles.input} placeholder="이메일" value={email} onChangeText={setEmail} />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={signup ? '회원가입' : '로그인'}
        onPress={() => login(email, password, signup)}
        disabled={!email || password.length < 8}
      />
      <Button title={signup ? '로그인으로' : '회원가입'} onPress={() => setSignup(s => !s)} />
    </SafeAreaView>
  );
}

function DevicesScreen() {
  const {devices, useRemote, refreshDevices} = useSession();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Button title="새로고침" onPress={refreshDevices} />
      {devices.map(d => (
        <View key={d.id} style={styles.card}>
          <Text style={styles.cardTitle}>{d.name}</Text>
          <Text style={styles.caption}>{resolveHostAddress(d, useRemote)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function PairingScreen() {
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="IP 또는 DDNS" value={address} onChangeText={setAddress} />
      <TextInput style={styles.input} placeholder="PIN" value={pin} onChangeText={setPin} />
      <Button
        title="연결 테스트"
        onPress={async () => {
          try {
            const res = await connectSignaling(address, pin, clientName());
            setStatus(`${res.hostName} · 게임 ${res.games.length}개`);
          } catch (e) {
            setStatus(e instanceof Error ? e.message : '연결 실패');
          }
        }}
      />
      {status ? <Text style={styles.caption}>{status}</Text> : null}
    </View>
  );
}

function SettingsScreen() {
  const {useRemote, setUseRemote, logout} = useSession();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text>외부(포트 포워딩) 연결</Text>
        <Switch value={useRemote} onValueChange={setUseRemote} />
      </View>
      <Text style={styles.caption}>시그널링 TCP: {AlaveXProtocol.signalingPort}</Text>
      <Text style={styles.caption}>미디어 UDP: {AlaveXProtocol.mediaPort}</Text>
      <Button title="로그아웃" onPress={logout} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Devices" component={DevicesScreen} options={{title: '내 PC'}} />
      <Tab.Screen name="Pairing" component={PairingScreen} options={{title: '페어링'}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{title: '설정'}} />
    </Tab.Navigator>
  );
}

function Root() {
  const {token} = useSession();
  if (!token) return <LoginScreen />;
  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  title: {fontSize: 28, fontWeight: '700'},
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: {color: 'crimson', fontSize: 12},
  card: {padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: 8},
  cardTitle: {fontWeight: '600'},
  caption: {fontSize: 12, color: '#666'},
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
});
