import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
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

type Role = 'admin' | 'staff' | 'partner' | null;

interface StoreState {
  // Auth
  role: Role;
  login: (role: Role) => void;
  logout: () => void;

  // Data
  contacts: Contact[];
  binRequests: BinRequest[];
  volunteers: Volunteer[];

  // Actions
  addContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  addBinRequest: (request: Omit<BinRequest, 'id' | 'createdAt'>) => void;
  addVolunteer: (volunteer: Omit<Volunteer, 'id' | 'createdAt'>) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      role: null,
      login: (role) => set({ role }),
      logout: () => set({ role: null }),

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
