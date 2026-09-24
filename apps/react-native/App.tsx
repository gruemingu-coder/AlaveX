import React, {useState} from 'react';
import {
  Alert,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {SessionProvider, useSession} from './src/SessionContext';
import {AlaveXProtocol, connectSignaling, resolveHostAddress} from './src/alavexApi';

const Tab = createBottomTabNavigator();

const ink = {
  bg: '#12100d',
  card: '#1c1814',
  line: '#3a322c',
  text: '#f4efe8',
  muted: '#a89888',
  brand: '#c46228',
  brandPressed: '#a04e20',
  danger: '#e07060',
};

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: ink.brand,
    background: ink.bg,
    card: ink.card,
    text: ink.text,
    border: ink.line,
    notification: ink.brand,
  },
};

function play(host: string, pin: string) {
  const address = host.trim();
  if (!address || pin.trim().length < 4) return;
  if (Platform.OS !== 'android') {
    Alert.alert('플레이', '영상 스트리밍은 Android 앱에서 동작합니다.');
    return;
  }
  NativeModules.AlaveXPlayer.play(address, pin.trim(), 'desktop');
}

function clientName(): string {
  if (Platform.OS === 'android') return 'AlaveX Android';
  if (Platform.OS === 'windows') return 'AlaveX Windows';
  return 'AlaveX';
}

function Field({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
}) {
  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={ink.muted}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      keyboardType={keyboardType}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

function Action({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        secondary ? styles.buttonSecondary : styles.buttonPrimary,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}>
      <Text style={[styles.buttonLabel, secondary ? styles.buttonLabelSecondary : null]}>{label}</Text>
    </Pressable>
  );
}

function LoginScreen() {
  const {login, error} = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.login} keyboardShouldPersistTaps="handled">
        <View style={styles.mark}>
          <Text style={styles.markText}>A</Text>
        </View>
        <Text style={styles.title}>AlaveX</Text>
        <Text style={styles.caption}>내 PC 게임을 이 폰에서 플레이</Text>
        <Field value={email} onChangeText={setEmail} placeholder="이메일" keyboardType="email-address" />
        <Field value={password} onChangeText={setPassword} placeholder="비밀번호 (8자 이상)" secure />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Action
          label={signup ? '회원가입' : '로그인'}
          onPress={() => login(email, password, signup)}
          disabled={!email || password.length < 8}
        />
        <Action
          label={signup ? '이미 계정이 있어요' : '계정 만들기'}
          secondary
          onPress={() => setSignup(value => !value)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DevicesScreen() {
  const {devices, useRemote, refreshDevices} = useSession();
  const [pins, setPins] = useState<Record<string, string>>({});
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>내 PC</Text>
      <Text style={styles.caption}>호스트에 표시된 4자리 PIN을 입력하고 플레이하세요.</Text>
      <Action label="목록 새로고침" secondary onPress={refreshDevices} />
      {devices.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>등록된 PC가 없습니다</Text>
          <Text style={styles.caption}>게이밍 PC에서 AlaveX Host를 실행한 뒤 같은 계정으로 로그인하세요. 주소가 없으면 페어링 탭에서 IP를 직접 입력할 수 있습니다.</Text>
        </View>
      ) : null}
      {devices.map(device => {
        const address = resolveHostAddress(device, useRemote);
        const pin = pins[device.id] ?? device.pairingPin ?? '';
        return (
          <View key={device.id} style={styles.card}>
            <Text style={styles.cardTitle}>{device.name}</Text>
            <Text style={styles.caption}>{address || '주소 없음 · 페어링 탭에서 IP를 입력하세요'}</Text>
            <Field
              value={pin}
              onChangeText={value => setPins(prev => ({...prev, [device.id]: value}))}
              placeholder="호스트 PIN"
              keyboardType="number-pad"
            />
            <Action label="플레이" onPress={() => play(address, pin)} disabled={!address || pin.length < 4} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function PairingScreen() {
  const [address, setAddress] = useState('');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState('');

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>직접 연결</Text>
      <Text style={styles.caption}>호스트 창의 IP와 PIN을 입력하세요. 같은 Wi-Fi여야 합니다.</Text>
      <Field value={address} onChangeText={setAddress} placeholder="192.168.0.10" />
      <Field value={pin} onChangeText={setPin} placeholder="PIN" keyboardType="number-pad" />
      <Action label="플레이" onPress={() => play(address, pin)} disabled={!address || pin.length < 4} />
      <Action
        label="연결만 확인"
        secondary
        onPress={async () => {
          try {
            const res = await connectSignaling(address, pin, clientName());
            setStatus(`${res.hostName}에 연결됨 · 게임 ${res.games.length}개`);
          } catch (e) {
            setStatus(e instanceof Error ? e.message : '연결 실패');
          }
        }}
      />
      {status ? <Text style={styles.caption}>{status}</Text> : null}
    </ScrollView>
  );
}

function SettingsScreen() {
  const {useRemote, setUseRemote, logout, user} = useSession();
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>설정</Text>
      {user ? <Text style={styles.caption}>{user.email}</Text> : null}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>외부 주소로 연결</Text>
            <Text style={styles.caption}>같은 Wi-Fi가 아니면 호스트의 공인 주소를 사용합니다.</Text>
          </View>
          <Switch
            value={useRemote}
            onValueChange={setUseRemote}
            trackColor={{false: ink.line, true: ink.brand}}
            thumbColor={ink.text}
          />
        </View>
      </View>
      <Text style={styles.caption}>시그널링 TCP {AlaveXProtocol.signalingPort} · 영상 UDP {AlaveXProtocol.mediaPort}</Text>
      <Action label="로그아웃" secondary onPress={logout} />
    </ScrollView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: ink.bg},
        headerShadowVisible: false,
        headerTintColor: ink.text,
        headerTitleStyle: {fontWeight: '700'},
        tabBarStyle: {backgroundColor: ink.card, borderTopColor: ink.line},
        tabBarActiveTintColor: ink.brand,
        tabBarInactiveTintColor: ink.muted,
      }}>
      <Tab.Screen name="Devices" component={DevicesScreen} options={{title: '내 PC'}} />
      <Tab.Screen name="Pairing" component={PairingScreen} options={{title: '페어링'}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{title: '설정'}} />
    </Tab.Navigator>
  );
}

function Root() {
  const {token} = useSession();
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={ink.bg} />
      {token ? (
        <NavigationContainer theme={navTheme}>
          <MainTabs />
        </NavigationContainer>
      ) : (
        <LoginScreen />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: ink.bg},
  login: {padding: 24, gap: 12, flexGrow: 1, justifyContent: 'center'},
  page: {padding: 20, gap: 12},
  mark: {
    width: 56,
    height: 56,
    backgroundColor: ink.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {color: '#fff', fontSize: 28, fontWeight: '700'},
  title: {color: ink.text, fontSize: 32, fontWeight: '700'},
  heading: {color: ink.text, fontSize: 24, fontWeight: '700'},
  caption: {color: ink.muted, fontSize: 14, lineHeight: 20},
  input: {
    borderWidth: 1,
    borderColor: ink.line,
    backgroundColor: '#241f1b',
    color: ink.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {color: ink.danger, fontSize: 14},
  card: {padding: 16, borderWidth: 1, borderColor: ink.line, backgroundColor: ink.card, gap: 10},
  cardTitle: {color: ink.text, fontSize: 16, fontWeight: '700'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  rowText: {flex: 1, gap: 4},
  button: {alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16},
  buttonPrimary: {backgroundColor: ink.brand},
  buttonSecondary: {backgroundColor: 'transparent', borderWidth: 1, borderColor: ink.line},
  buttonPressed: {backgroundColor: ink.brandPressed},
  buttonDisabled: {opacity: 0.45},
  buttonLabel: {color: '#fff', fontSize: 16, fontWeight: '700'},
  buttonLabelSecondary: {color: ink.text},
});
