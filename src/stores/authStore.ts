import { create } from 'zustand'
import { supabaseClient, isSupabaseAvailable } from '@/lib/supabase'
import type { Profile, Session } from '@/types'

interface AuthState {
  profile: Profile | null
  session: Session | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  needsPassword: boolean

  signIn: (codename: string, password: string) => Promise<void>
  signUp: (codename: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initializeAuth: () => Promise<void>
  setError: (error: string | null) => void
  clearError: () => void
}

function codeToEmail(codename: string): string {
  return `${codename.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}@zeiterfassung.local`
}

function localUserId(codename: string): string {
  return `local_${codename.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  session: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  needsPassword: false,

  initializeAuth: async () => {
    set({ loading: true })
    try {
      if (isSupabaseAvailable() && supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession()
        if (session?.user) {
          const { data: profileData } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          const rawCodename = session.user.user_metadata?.codename || 'User'
          let profile: Profile

          if (profileData) {
            profile = profileData
          } else {
            profile = {
              id: session.user.id,
              codename: rawCodename,
              created_at: session.user.created_at,
              updated_at: session.user.created_at,
            }
            await supabaseClient
              .from('profiles')
              .upsert({ id: session.user.id, codename: rawCodename, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          }

          set({
            session: { user: profile, access_token: session.access_token, refresh_token: session.refresh_token || '' },
            profile,
            loading: false,
            isAuthenticated: true,
            needsPassword: false,
          })
          return
        }
      }

      // Fallback: localStorage session
      const stored = localStorage.getItem('zeiterfassung_session')
      if (stored) {
        const parsed = JSON.parse(stored)
        set({ session: parsed, profile: parsed.user, loading: false, isAuthenticated: true, needsPassword: false })
        return
      }

      set({ loading: false, isAuthenticated: false })
    } catch (error) {
      console.error('Auth init failed:', error)
      set({ loading: false, isAuthenticated: false })
    }
  },

  signIn: async (codename: string, password: string) => {
    set({ loading: true, error: null })
    try {
      if (isSupabaseAvailable() && supabaseClient) {
        const email = codeToEmail(codename)
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
        if (error) throw error

        if (data.user) {
          await supabaseClient
            .from('profiles')
            .upsert({ id: data.user.id, codename, updated_at: new Date().toISOString() }, { onConflict: 'id' })

          const profile: Profile = {
            id: data.user.id,
            codename,
            created_at: data.user.created_at,
            updated_at: new Date().toISOString(),
          }
          const session: Session = {
            user: profile,
            access_token: data.session?.access_token || '',
            refresh_token: data.session?.refresh_token || '',
          }
          localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
          set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
          return
        }
      }

      // Offline fallback
      const profile: Profile = { id: localUserId(codename), codename, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      const session: Session = { user: profile, access_token: 'local', refresh_token: 'local' }
      localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
      set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Authentication failed'
      set({ error: msg, loading: false })
      throw error
    }
  },

  signUp: async (codename: string, password: string) => {
    set({ loading: true, error: null })
    try {
      if (isSupabaseAvailable() && supabaseClient) {
        const email = codeToEmail(codename)
        const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { codename } } })
        if (error) {
          if (error.message?.includes('already registered')) throw new Error('CODENAME_TAKEN')
          // "Database error saving new user" likely means a trigger (create_dp_user_settings) failed.
          // Fix: run in Supabase SQL: ALTER FUNCTION create_dp_user_settings() SECURITY DEFINER;
          if (error.message?.includes('Database error')) {
            console.warn('Signup trigger error. Trying signIn fallback...', error.message)
            // The user may have been created despite the trigger error — try signing in
            try {
              const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password })
              if (!signInError && signInData.user) {
                await supabaseClient.from('profiles').upsert({ id: signInData.user.id, codename, updated_at: new Date().toISOString() }, { onConflict: 'id' })
                const profile: Profile = { id: signInData.user.id, codename, created_at: signInData.user.created_at, updated_at: new Date().toISOString() }
                const session: Session = { user: profile, access_token: signInData.session?.access_token || '', refresh_token: signInData.session?.refresh_token || '' }
                localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
                set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
                return
              }
            } catch { /* fallthrough to throw original error */ }
          }
          throw error
        }

        if (data.user) {
          // Profile upsert — ignore errors (trigger may have already created it)
          try {
            await supabaseClient.from('profiles').upsert({ id: data.user.id, codename, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          } catch (e) { console.warn('Profile upsert warning:', e) }

          // If session exists (email confirmation disabled), use it directly
          if (data.session) {
            const profile: Profile = { id: data.user.id, codename, created_at: data.user.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }
            const session: Session = { user: profile, access_token: data.session.access_token, refresh_token: data.session.refresh_token || '' }
            localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
            set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
            return
          }

          // No session = email confirmation required. Since we use fake emails,
          // auto-sign-in immediately after successful signup.
          console.log('No session after signUp (email confirmation?). Auto-signing in...')
          const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
            email: codeToEmail(codename), password
          })
          if (!signInError && signInData.user && signInData.session) {
            const profile: Profile = { id: signInData.user.id, codename, created_at: signInData.user.created_at, updated_at: new Date().toISOString() }
            const session: Session = { user: profile, access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token || '' }
            localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
            set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
            return
          }
          // If auto-sign-in also fails, throw descriptive error
          if (signInError) {
            console.warn('Auto-sign-in after signup failed:', signInError.message)
            throw new Error(signInError.message)
          }
          return
        }
      }

      // Offline fallback
      const profile: Profile = { id: localUserId(codename), codename, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      const session: Session = { user: profile, access_token: 'local', refresh_token: 'local' }
      localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
      set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed'
      set({ error: msg, loading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      if (isSupabaseAvailable() && supabaseClient) {
        await supabaseClient.auth.signOut()
      }
    } catch (e) {
      console.warn('SignOut error:', e)
    }
    localStorage.removeItem('zeiterfassung_session')
    set({ profile: null, session: null, isAuthenticated: false, loading: false, needsPassword: false })
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
