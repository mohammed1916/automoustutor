import { LearnerState, Message, CurriculumWeek } from '../types';
import { INITIAL_LEARNER_STATE } from '../constants';
import { jwtDecode } from "jwt-decode";

// --- Types ---
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: number;
}

interface StoredData {
  learnerState: LearnerState;
  messages: Message[];
  lastUpdated: number;
}

// --- Constants ---
const USERS_KEY = 'math_agent_users';
const DATA_PREFIX = 'math_agent_data_';
const SESSION_KEY = 'math_agent_session';

// --- Auth Methods ---

export const getSession = (): UserProfile | null => {
  const sessionJson = localStorage.getItem(SESSION_KEY);
  return sessionJson ? JSON.parse(sessionJson) : null;
};

export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const register = (email: string, name: string, password: string): UserProfile | { error: string } => {
  const usersJson = localStorage.getItem(USERS_KEY);
  const users: Record<string, any> = usersJson ? JSON.parse(usersJson) : {};

  if (users[email]) {
    return { error: 'User already exists' };
  }

  const newUser: UserProfile = {
    id: 'user_' + Date.now().toString(36),
    email,
    name,
    createdAt: Date.now()
  };

  // In a real app, never store passwords in plain text. 
  // This is a client-side simulation, so we store a simple object.
  users[email] = { ...newUser, password };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));

  return newUser;
};

export const login = (email: string, password: string): UserProfile | { error: string } => {
  const usersJson = localStorage.getItem(USERS_KEY);
  const users: Record<string, any> = usersJson ? JSON.parse(usersJson) : {};

  const user = users[email];

  if (!user || user.password !== password) {
    return { error: 'Invalid credentials' };
  }

  const { password: _, ...safeProfile } = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeProfile));
  return safeProfile;
};

export const googleLogin = (credential: string): UserProfile => {
  const decoded: any = jwtDecode(credential);
  
  const email = decoded.email;
  const name = decoded.name;
  const googleId = decoded.sub;

  const usersJson = localStorage.getItem(USERS_KEY);
  const users: Record<string, any> = usersJson ? JSON.parse(usersJson) : {};

  let user = users[email];

  if (!user) {
    // Create new user if they don't exist
    const newUser: UserProfile = {
      id: 'user_g_' + googleId,
      email,
      name,
      createdAt: Date.now()
    };
    // Save without a password field since it's oauth
    users[email] = { ...newUser, googleId };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    user = newUser;
  }

  // Sanitize and set session
  const { password: _, ...safeProfile } = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeProfile));
  
  return safeProfile;
};

// --- Data Persistence Methods ---

export const saveProgress = (userId: string, state: LearnerState, messages: Message[]) => {
  const data: StoredData = {
    learnerState: state,
    messages: messages.slice(-50), // Keep last 50 messages to save space
    lastUpdated: Date.now()
  };
  localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(data));
};

export const loadProgress = (userId: string): { state: LearnerState, messages: Message[] } | null => {
  const dataJson = localStorage.getItem(DATA_PREFIX + userId);
  if (!dataJson) return null;
  
  try {
    const data: StoredData = JSON.parse(dataJson);
    return {
      state: data.learnerState,
      messages: data.messages
    };
  } catch (e) {
    return null;
  }
};