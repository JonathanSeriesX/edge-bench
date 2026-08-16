'use client';
import { useEffect } from 'react';
import { initDashboard } from '../lib/dashboard';

// The shell is server-rendered; the vanilla chart code fills it in after mount.
export default function DashboardLoader() {
  useEffect(() => {
    initDashboard();
  }, []);
  return null;
}
