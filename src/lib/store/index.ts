import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TransactionRecord, CreditBalance, UserMembership, AISession, AIMode, Agent } from '@/types';

export interface PendingFinancialAction {
  action: 'transfer' | 'swap' | 'bridge';
  amount: string;
  fromToken?: string;
  toToken?: string;
  recipient?: string;
  sourceChain?: string;
  sourceChainId?: number;
  destinationChain?: string;
  destinationChainId?: number;
  missing?: 'amount' | 'recipient' | 'toToken' | 'sourceChain' | 'destinationChain' | 'full';
  error?: string;
  createdAt: number;
}

export interface AppState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  aiEnabled: boolean;
  setAiEnabled: (v: boolean) => void;
  toggleSidebar: () => void;
  transactions: TransactionRecord[];
  addTransaction: (tx: TransactionRecord) => void;
  updateTransaction: (id: string, updates: Partial<TransactionRecord>) => void;
  clearTransactions: () => void;
  creditBalance: CreditBalance | null;
  setCreditBalance: (b: CreditBalance) => void;
  membership: UserMembership | null;
  setMembership: (m: UserMembership | null) => void;
  aiSessions: AISession[];
  currentSession: AISession | null;
  addAISession: (s: AISession) => void;
  setCurrentSession: (s: AISession | null) => void;
  updateCurrentSession: (updates: Partial<AISession>) => void;
  aiMode: AIMode;
  setAIMode: (m: AIMode) => void;
  aiModel: string;
  setAIModel: (m: string) => void;
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  upsertAgent: (agent: Agent) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  pendingAction: PendingFinancialAction | null;
  setPendingAction: (a: PendingFinancialAction | null) => void;
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      aiEnabled: true,
      setAiEnabled: (v) => set({ aiEnabled: v }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      transactions: [],
      addTransaction: (tx) => set((s) => ({ transactions: [tx, ...s.transactions].slice(0, 200) })),
      updateTransaction: (id, updates) => set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? { ...t, ...updates } : t) })),
      clearTransactions: () => set({ transactions: [] }),
      creditBalance: null,
      setCreditBalance: (b) => set({ creditBalance: b }),
      membership: null,
      setMembership: (m) => set({ membership: m }),
      aiSessions: [],
      currentSession: null,
      addAISession: (s) => set((st) => ({ aiSessions: [s, ...st.aiSessions].slice(0, 50) })),
      setCurrentSession: (s) => set({ currentSession: s }),
      updateCurrentSession: (updates) => set((s) => ({ currentSession: s.currentSession ? { ...s.currentSession, ...updates } : null })),
      aiMode: 'build',
      setAIMode: (m) => set({ aiMode: m }),
      aiModel: '',
      setAIModel: (m) => set({ aiModel: m }),
      agents: [],
      setAgents: (agents) => set({ agents }),
      upsertAgent: (agent) => set((s) => ({ agents: s.agents.find((a) => a.id === agent.id) ? s.agents.map((a) => a.id === agent.id ? agent : a) : [agent, ...s.agents] })),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      pendingAction: null,
      setPendingAction: (a) => set({ pendingAction: a }),
      onboardingComplete: false,
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
    }),
    {
      name: 'arctis-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        transactions: s.transactions,
        aiSessions: s.aiSessions,
        aiMode: s.aiMode,
        aiModel: s.aiModel,
        onboardingComplete: s.onboardingComplete,
      }),
    }
  )
);
