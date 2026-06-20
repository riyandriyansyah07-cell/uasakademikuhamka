import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Kredensial ini aman ditaruh di frontend karena data dilindungi RLS (Row Level Security)
const supabaseUrl = 'https://fpgxppzddlsvwofzylys.supabase.co'
const supabaseKey = 'sb_publishable_VPTv1VZVYmmsNKCynTtkGA_Z276pH7t' 
const supabase = createClient(supabaseUrl, supabaseKey)

// Enterprise Auth Flow
export async function loginAdmin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) throw new Error(error.message);
    
    // Redirect ke Dashboard dengan Session aktif
    window.location.href = '/dashboard';
}

// Proteksi Route (Dijalankan otomatis di dashboard.html)
export async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/'; // Tendang kembali ke halaman login
    }
    return session;
}