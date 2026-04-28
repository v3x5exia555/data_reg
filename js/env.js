// env.js - Load configuration from Supabase table
// Fetches app credentials from app_credentials table

(function() {
  'use strict';

  const SUPABASE_URL = 'https://xvjfosmzmfitrcivsgpu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_faN2IaAJ6HGApHqzmbvVFQ_vdMleyGH';

  window.ENV = {
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
  };
  window.envLoaded = false;

  function initSupabase() {
    if (typeof window.supabase !== 'undefined') {
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }

  async function loadEnv() {
    initSupabase();
    
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/app_credentials?is_active=eq.true&select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          window.ENV.APP_EMAIL = data[0].email;
          window.ENV.APP_PASSWORD = data[0].password;
          console.log('Credentials loaded from database');
        } else {
          console.warn('No active credentials found in app_credentials table');
        }
      }
    } catch (error) {
      console.warn('Failed to load credentials:', error);
    }

    window.envLoaded = true;
    document.dispatchEvent(new Event('envReady'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEnv);
  } else {
    loadEnv();
  }

  window.getEnv = function() {
    return window.ENV;
  };
})();