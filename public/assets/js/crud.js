import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi Database Cloud Supabase
const supabaseUrl = 'https://fpgxppzddlsvwofzylys.supabase.co'
const supabaseKey = 'sb_publishable_VPTv1VZVYmmsNKCynTtkGA_Z276pH7t' 
const supabase = createClient(supabaseUrl, supabaseKey)

// Elemen DOM
const studentTableBody = document.getElementById('studentTableBody');
const statTotal = document.getElementById('statTotal');
const statRawan = document.getElementById('statRawan');

let riskChartInstance = null; // Menyimpan instance grafik agar bisa di-update dynamic

// ==========================================
// 1. INISIALISASI & DOCKING DATA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();
});

// ==========================================
// 2. READ DATA & UPDATE AUTOMATIC ANALYTICS
// ==========================================
async function fetchStudents() {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        studentTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data server.</td></tr>`;
        return;
    }

    studentTableBody.innerHTML = '';

    if (data.length === 0) {
        studentTableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">Belum ada data mahasiswa.</td></tr>`;
        updateAnalytics(0, 0);
        return;
    }

    // Hitung counter untuk Dashboard Analytics
    let totalMahasiswa = data.length;
    let totalRawanDO = data.filter(s => s.prediction_result === 'Berisiko').length;

    updateAnalytics(totalMahasiswa, totalRawanDO);

    // Suntik data ke baris tabel HTML
    data.forEach(student => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";

        // Pengkondisian warna label status hasil prediksi AI
        let statusBadgeColor = "bg-slate-100 text-slate-600";
        if (student.prediction_result === 'Aman') statusBadgeColor = "bg-emerald-100 text-emerald-700 font-bold";
        if (student.prediction_result === 'Berisiko') statusBadgeColor = "bg-rose-100 text-rose-700 font-bold";
        
        tr.innerHTML = `
            <td class="p-4">
                <p class="font-semibold text-sm text-slate-700">${student.nim}</p>
                <p class="text-xs text-slate-400">${student.nama}</p>
            </td>
            <td class="p-4 text-sm text-slate-600 font-medium">
                ${student.gpa.toFixed(2)} / ${student.attendance}% / ${student.core_grade.toFixed(2)}
            </td>
            <td class="p-4">
                <span class="${statusBadgeColor} px-3 py-1 rounded-full text-xs">
                    ${student.prediction_result}
                </span>
            </td>
            <td class="p-4 text-center">
                <button data-id="${student.id}" data-gpa="${student.gpa}" data-attendance="${student.attendance}" data-core="${student.core_grade}" data-study="${student.study_hours}" 
                    class="predict-btn bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 px-3 py-1 rounded-lg text-xs font-semibold transition">
                    Proses AI
                </button>
            </td>
        `;
        studentTableBody.appendChild(tr);
    });

    // Pasang Event Listener klik ke seluruh tombol "Proses AI"
    document.querySelectorAll('.predict-btn').forEach(btn => {
        btn.addEventListener('click', handlePrediction);
    });
}

// ==========================================
// 3. FUNGSI UPDATE ANALYTICS & GRAPH (DONUT + CENTER TEXT)
// ==========================================
function updateAnalytics(total, rawan) {
    statTotal.innerText = total;
    statRawan.innerText = rawan;

    const aman = total - rawan;
    const ctx = document.getElementById('riskChart').getContext('2d');

    // Hancurkan chart lama jika ada
    if (riskChartInstance) {
        riskChartInstance.destroy();
    }

    // Plugin untuk menampilkan teks di tengah donut chart
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: (chart) => {
            const { ctx, width, height } = chart;
            ctx.restore();
            // Mengatur ukuran font responsif
            const fontSize = (height / 120).toFixed(2);
            ctx.font = `bold ${fontSize}em Inter, sans-serif`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#1e293b"; // Warna Slate-800
            
            // Menampilkan Total Mahasiswa di tengah
            ctx.fillText(total.toString(), width / 2, height / 2);
            ctx.save();
        }
    };

    // Gambar Donut Chart dengan Plugin
    riskChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Aman', 'Berisiko'],
            datasets: [{
                data: [total === 0 ? 1 : aman, rawan],
                backgroundColor: ['#10B981', '#F43F5E'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%', // Ukuran lubang tengah
            plugins: { 
                legend: { display: false } 
            }
        },
        plugins: [centerTextPlugin] // Daftarkan plugin di sini
    });
}

// ==========================================
// 4. JEMBATAN API AI: PANGGIL SERVERLESS PYTHON VERCEL
// ==========================================
async function handlePrediction(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    
    const originalText = btn.innerText;
    btn.innerText = "⚡ Menganalisis...";
    btn.disabled = true;

    // Siapkan payload data sesuai spesifikasi Random Forest backend kita
    const payload = {
        gpa: parseFloat(btn.getAttribute('data-gpa')),
        attendance: parseFloat(btn.getAttribute('data-attendance')),
        core_grade: parseFloat(btn.getAttribute('data-core')),
        study_hours: parseFloat(btn.getAttribute('data-study')),
        engagement: 4.0 // Nilai default konstan untuk feature ke-5 model
    };

    try {
        // Tembak endpoint API Vercel Python kita
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            // Update status hasil prediksi AI langsung ke tabel database Supabase
            await supabase
                .from('students')
                .update({ prediction_result: result.risk_category })
                .eq('id', id);
            
            // Muat ulang data agar visual dashboard berubah secara real-time
            fetchStudents();
        } else {
            alert("Model AI Error: " + result.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert("Gagal menghubungi server AI. Pastikan Vercel Dev / Serverless sudah berjalan.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// 5. MODAL LOGIKA TAMBAH DATA (CREATE)
// ==========================================
const addModal = document.getElementById('addModal');
const addStudentBtn = document.getElementById('addStudentBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const addStudentForm = document.getElementById('addStudentForm');
const saveBtn = document.getElementById('saveBtn');

addStudentBtn.addEventListener('click', () => { addModal.classList.remove('hidden'); });
const closeModal = () => { addModal.classList.add('hidden'); addStudentForm.reset(); };
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

addStudentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.innerText = "Menyimpan...";
    saveBtn.disabled = true;

    const { data, error } = await supabase
        .from('students')
        .insert([{ 
            nim: document.getElementById('nim').value, 
            nama: document.getElementById('nama').value, 
            gpa: parseFloat(document.getElementById('gpa').value), 
            attendance: parseFloat(document.getElementById('attendance').value), 
            core_grade: parseFloat(document.getElementById('core_grade').value), 
            study_hours: parseInt(document.getElementById('study_hours').value),
            status: 'Aktif'
        }]);

    if (error) {
        alert("Gagal: " + error.message);
    } else {
        closeModal();
        fetchStudents();
    }
    saveBtn.innerText = "Simpan Data";
    saveBtn.disabled = false;
});