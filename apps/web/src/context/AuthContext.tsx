'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Business, Branch } from '@padupos/types';
import { api } from '@/api/client';

export interface UserProfile {
  id: string;
  email?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  businesses: Business[];
  activeBusiness: Business | null;
  branches: Branch[];
  activeBranch: Branch | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  setActiveBusiness: (business: Business) => void;
  setActiveBranch: (branch: Branch) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusiness, setActiveBusinessState] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  const logout = useCallback(() => {
    localStorage.removeItem('padupos_auth_token');
    localStorage.removeItem('padupos_business_id');
    localStorage.removeItem('padupos_branch_id');
    setToken(null);
    setUser(null);
    setBusinesses([]);
    setActiveBusinessState(null);
    setBranches([]);
    setActiveBranchState(null);
    setStatus('unauthenticated');
  }, []);

  const loadBranches = useCallback(async (businessId: string) => {
    const res = await api.get<{ branches: Branch[] }>('/branches', {
      headers: { 'x-business-id': businessId },
    });

    if (res.data?.branches && res.data.branches.length > 0) {
      setBranches(res.data.branches);
      const savedBranchId = localStorage.getItem('padupos_branch_id');
      const found = res.data.branches.find((b) => b.id === savedBranchId) || res.data.branches[0];
      setActiveBranchState(found);
      localStorage.setItem('padupos_branch_id', found.id);
    } else {
      setBranches([]);
      setActiveBranchState(null);
      localStorage.removeItem('padupos_branch_id');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const storedToken = localStorage.getItem('padupos_auth_token');
    if (!storedToken) {
      setStatus('unauthenticated');
      return;
    }

    setToken(storedToken);

    const res = await api.get<{ user: UserProfile; businesses: Business[] }>('/auth/me');

    if (res.error || !res.data) {
      logout();
      return;
    }

    setUser(res.data.user);
    setBusinesses(res.data.businesses);

    if (res.data.businesses.length > 0) {
      const savedBizId = localStorage.getItem('padupos_business_id');
      const currentBiz =
        res.data.businesses.find((b) => b.id === savedBizId) || res.data.businesses[0];

      setActiveBusinessState(currentBiz);
      localStorage.setItem('padupos_business_id', currentBiz.id);
      await loadBranches(currentBiz.id);
    } else {
      setActiveBusinessState(null);
      setBranches([]);
      setActiveBranchState(null);
    }

    setStatus('authenticated');
  }, [logout, loadBranches]);

  useEffect(() => {
    api.setConfig({
      onUnauthorized: logout,
    });
    refreshProfile();
  }, [refreshProfile, logout]);

  const login = async (newToken: string): Promise<boolean> => {
    localStorage.setItem('padupos_auth_token', newToken);
    setToken(newToken);
    setStatus('loading');

    const res = await api.get<{ user: UserProfile; businesses: Business[] }>('/auth/me');
    if (res.error || !res.data) {
      logout();
      return false;
    }

    setUser(res.data.user);
    setBusinesses(res.data.businesses);

    if (res.data.businesses.length > 0) {
      const firstBiz = res.data.businesses[0];
      setActiveBusinessState(firstBiz);
      localStorage.setItem('padupos_business_id', firstBiz.id);
      await loadBranches(firstBiz.id);
    }

    setStatus('authenticated');
    return true;
  };

  const setActiveBusiness = (business: Business) => {
    setActiveBusinessState(business);
    localStorage.setItem('padupos_business_id', business.id);
    loadBranches(business.id);
  };

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch);
    localStorage.setItem('padupos_branch_id', branch.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        businesses,
        activeBusiness,
        branches,
        activeBranch,
        status,
        login,
        logout,
        setActiveBusiness,
        setActiveBranch,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
