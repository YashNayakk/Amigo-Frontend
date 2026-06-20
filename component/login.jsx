import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  Image
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import AuthService from '../services/authService';
import BootSplash from 'react-native-bootsplash';
import SplashScreen from './splash';

const Login = () => {
  const navigation = useNavigation();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const init = async () => {
      await BootSplash.hide({ fade: true });

      await Promise.all([
        UserLoginHai(),
        await new Promise(resolve =>
          setTimeout(resolve, 3000)),
      ]);

      setCheckingAuth(false);
    }
    init();
  }, [])

  const UserLoginHai = async () => {
    try {
      const Loggedd = await AuthService.isAuthenticated();
      if (Loggedd) {
        navigation.navigate('Tabs');
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  }
  const slideAnim = useRef(new Animated.Value(0)).current;
  const toggleMode = () => {
    Animated.timing(slideAnim, {
      toValue: isLogin ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setIsLogin(!isLogin);
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const data = await AuthService.login(email, password);
        if(data.success){
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Tabs' },]
          })
        );
        }
      } else {

        const data = await AuthService.signup(name, email, password);
        
        navigation.navigate('Tabs');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error.message || `${isLogin ? 'Login' : 'Signup'} failed`
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <SplashScreen /> ;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            style={styles.Icon}
            source={require("../Images/mascoti.png")}
          />
          <Text style={styles.title}>Amigo</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </Text>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Login' : 'Sign Up'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <TouchableOpacity onPress={toggleMode} disabled={loading}>
            <Text style={styles.footerLink}>
              {isLogin ? 'Sign Up' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    marginTop: 15,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  Icon: {
    resizeMode: "contain",
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 14,
  },
  footerLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});