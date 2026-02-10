import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  role: 'STAFF' | 'PARTNER' | 'CUSTOMER';
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
}

export interface BinRequest {
  id: string;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  volume: string;
  createdAt: string;
}

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  interest: string;
  availability: string;
  notes: string;
  createdAt: string;
}

type Role = 'admin' | 'staff' | 'partner' | 'customer' | null;
type Theme = 'light' | 'dark';

interface StoreState {
  user: User | null;
  sessionId: string | null;
  role: Role;
  theme: Theme;
  
  setAuth: (user: User, sessionId: string) => void;
  clearAuth: () => void;
  
  login: (role: Role) => void;
  logout: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;

  contacts: Contact[];
  binRequests: BinRequest[];
  volunteers: Volunteer[];

  addContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  addBinRequest: (request: Omit<BinRequest, 'id' | 'createdAt'>) => void;
  addVolunteer: (volunteer: Omit<Volunteer, 'id' | 'createdAt'>) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      user: null,
      sessionId: null,
      role: null,
      theme: 'light' as Theme,
      
      setAuth: (user, sessionId) => {
        const role = user.role === 'STAFF' ? 'staff' : 
                     user.role === 'PARTNER' ? 'partner' : 
                     user.role === 'CUSTOMER' ? 'customer' : null;
        set({ user, sessionId, role });
      },
      
      clearAuth: () => set({ user: null, sessionId: null, role: null }),
      
      login: (role) => set({ role }),
      logout: () => set({ user: null, sessionId: null, role: null }),
      
      toggleTheme: () => set((state) => {
        const next = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', next === 'dark');
        return { theme: next };
      }),
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        return set({ theme });
      },

      contacts: [],
      binRequests: [],
      volunteers: [],

      addContact: (data) =>
        set((state) => ({
          contacts: [
            ...state.contacts,
            { ...data, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() },
          ],
        })),

      addBinRequest: (data) =>
        set((state) => ({
          binRequests: [
            ...state.binRequests,
            { ...data, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() },
          ],
        })),

      addVolunteer: (data) =>
        set((state) => ({
          volunteers: [
            ...state.volunteers,
            { ...data, id: Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() },
          ],
        })),
    }),
    {
      name: 'littr-storage',
    }
  )
);

export function getAuthHeaders(): HeadersInit {
  const state = useStore.getState();
  if (state.sessionId) {
    return { 'X-Session-Id': state.sessionId };
  }
  return {};
}

export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const state = useStore.getState();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (state.sessionId) {
    (headers as Record<string, string>)['X-Session-Id'] = state.sessionId;
  }
  
  return fetch(url, { ...options, headers });
}
