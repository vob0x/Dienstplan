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
          // "Database error saving new user" = trigger failed (profile/user_settings insert).
          // The user was likely created in auth.users despite the trigger error.
          // Strategy: sign in, then manually create profile + user_settings.
          if (error.message?.includes('Database error')) {
            console.warn('Signup trigger error — attempting recovery...', error.message)
            try {
              const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password })
              if (!signInError && signInData.user) {
                // Trigger failed, so manually ensure profile + user_settings exist
                await supabaseClient.from('profiles').upsert(
                  { id: signInData.user.id, codename, updated_at: new Date().toISOString() },
                  { onConflict: 'id' }
                )
                await supabaseClient.from('user_settings').upsert(
                  { user_id: signInData.user.id },
                  { onConflict: 'user_id' }
                ).then(() => {}, () => {}) // ignore user_settings errors
                const profile: Profile = { id: signInData.user.id, codename, created_at: signInData.user.created_at, updated_at: new Date().toISOString() }
                const session: Session = { user: profile, access_token: signInData.session?.access_token || '', refresh_token: signInData.session?.refresh_token || '' }
                localStorage.setItem('zeiterfassung_session', JSON.stringify(session))
                set({ profile, session, loading: false, isAuthenticated: true, needsPassword: false })
                return
              }
              // signIn also failed — user may not have been created at all
              if (signInError) {
                console.warn('Recovery signIn failed:', signInError.message)
                throw new Error('SIGNUP_TRIGGER_FAILED')
              }
            } catch (recoveryError) {
              if (recoveryError instanceof Error && recoveryError.message === 'SIGNUP_TRIGGER_FAILED') throw recoveryError
              console.warn('Recovery attempt failed:', recoveryError)
            }
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

          // No session = email confirmation is still enabled in Supabase.
          // Try to auto-confirm the user via RPC, then sign in.
          console.log('No session after signUp — attempting auto-confirm workaround...')

          // Attempt 1: Try auto-confirm via RPC (requires function in Supabase)
          try {
            await supabaseClient.rpc('auto_confirm_user', { user_email: codeToEmail(codename) })
            console.log('Auto-confirm RPC succeeded')
          } catch (e) {
            console.warn('auto_confirm_user RPC not available (expected):', e)
          }

          // Attempt 2: Sign in — works if auto-confirm succeeded or email already confirmed
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

          // If sign-in fails with "Email not confirmed", provide actionable error
          if (signInError) {
            console.warn('Auto-sign-in after signup failed:', signInError.message)
            if (signInError.message?.toLowerCase().includes('email not confirmed')) {
              throw new Error('EMAIL_CONFIRM_REQUIRED')
            }
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

/**
 * Verify the current user's password by re-authenticating with Supabase.
 * Returns true if the password is correct, false otherwise.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const profile = useAuthStore.getState().profile
  if (!profile || !isSupabaseAvailable() || !supabaseClient) return false

  try {
    const email = codeToEmail(profile.codename)
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
    return !error
  } catch {
    return false
  }
}
