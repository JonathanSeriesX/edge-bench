'use client';
import { useEffect } from 'react';
import { initDashboard } from '../lib/dashboard';

// The shell is server-rendered; the vanilla chart code fills it in after mount.
export default function DashboardLoader() {
  useEffect(() => {
    initDashboard();
    // The RUM client self-gates on import (sample rate, saveData, page load)
    // and measures the platforms from this visitor's own network.
    import('../rum/client.js');
  }, []);
  return null;
}
