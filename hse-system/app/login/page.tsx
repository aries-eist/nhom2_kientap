'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      alert('Sai tài khoản hoặc mật khẩu!')
    } else {
      // Refresh để Middleware nhận diện session mới và redirect
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main style={styles.container}>
      <form onSubmit={handleLogin} style={styles.form}>
        <h2 style={{color: '#333'}}>HSE SYSTEM LOGIN</h2>
        <input 
          type="email" 
          placeholder="Email" 
          onChange={(e) => setEmail(e.target.value)} 
          style={styles.input} 
        />
        <input 
          type="password" 
          placeholder="Mật khẩu" 
          onChange={(e) => setPassword(e.target.value)} 
          style={styles.input} 
        />
        <button type="submit" style={styles.button}>Đăng nhập</button>
      </form>
    </main>
  )
}

const styles = {
  container: { display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },
  form: { padding: '40px', background: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' as const, gap: '15px', width: '350px' },
  input: { padding: '12px', borderRadius: '4px', border: '1px solid #ddd', color: 'black' },
  button: { padding: '12px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
}