import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi Database Cloud Supabase
const supabaseUrl = 'https://fpgxppzddlsvwofzylys.supabase.co'
const supabaseKey = 'sb_publishable_VPTv1VZVYmmsNKCynTtkGA_Z276pH7t' 
const supabase = createClient(supabaseUrl, supabaseKey)

// Elemen DOM
const studentTableBody = document.getElementById('studentTableBody');
const statTotal = document.getElementById('statTotal');
const statRawan = document.getElementById('statRawan');

let riskChartInstance = null;

// ==========================================
// 1. INISIALISASI
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
        studentTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data.</td></tr>`;
        return;
    }

    studentTableBody.innerHTML = '';
    if (data.length === 0) {
        studentTableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400">Belum ada data mahasiswa.</td></tr>`;
        updateAnalytics(0, 0);
        return;
    }

    let totalMahasiswa = data.length;
    let totalRawanDO = data.filter(s => s.prediction_result === 'Berisiko').length;
    updateAnalytics(totalMahasiswa, totalRawanDO);

    data.forEach(student => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        let statusBadgeColor = student.prediction_result === 'Aman' ? "bg-emerald-100 text-emerald-700 font-bold" : (student.prediction_result === 'Berisiko' ? "bg-rose-100 text-rose-700 font-bold" : "bg-slate-100 text-slate-600");
        
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
                    ${student.prediction_result || 'Belum Diprediksi'}
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
}

// Event Delegation (Tombol AI)
studentTableBody.onclick = (e) => {
    if (e.target.classList.contains('predict-btn')) handlePrediction(e);
};

// ==========================================
// 3. FUNGSI UPDATE ANALYTICS & GRAPH
// ==========================================
function updateAnalytics(total, rawan) {
    statTotal.innerText = total;
    statRawan.innerText = rawan;
    const aman = total - rawan;
    const ctx = document.getElementById('riskChart').getContext('2d');
    
    if (riskChartInstance) riskChartInstance.destroy();

    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: (chart) => {
            const { ctx, width, height } = chart;
            ctx.restore();
            const fontSize = (height / 120).toFixed(2);
            ctx.font = `bold ${fontSize}em Inter, sans-serif`;
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#1e293b";
            ctx.fillText(total.toString(), width / 2, height / 2);
            ctx.save();
        }
    };

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
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } },
        plugins: [centerTextPlugin]
    });
}

// ==========================================
// 4. JEMBATAN API AI
// ==========================================
async function handlePrediction(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    btn.innerText = "⚡ Menganalisis...";
    btn.disabled = true;

    const payload = {
        gpa: parseFloat(btn.getAttribute('data-gpa')),
        attendance: parseFloat(btn.getAttribute('data-attendance')),
        core_grade: parseFloat(btn.getAttribute('data-core')),
        study_hours: parseFloat(btn.getAttribute('data-study')),
        engagement: 4.0
    };

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status === "success") {
            await supabase.from('students').update({ prediction_result: result.risk_category }).eq('id', id);
            fetchStudents();
        } else {
            alert("Model AI Error: " + result.message);
        }
    } catch (err) {
        alert("Gagal menghubungi server AI.");
    } finally {
        btn.innerText = "Proses AI";
        btn.disabled = false;
    }
}

// ==========================================
// 5. MODAL LOGIKA TAMBAH DATA
// ==========================================
const addModal = document.getElementById('addModal');
document.getElementById('addStudentBtn').onclick = () => addModal.classList.remove('hidden');
document.getElementById('closeModalBtn').onclick = () => addModal.classList.add('hidden');
document.getElementById('cancelBtn').onclick = () => addModal.classList.add('hidden');

document.getElementById('addStudentForm').onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.innerText = "Menyimpan...";
    
    const { error } = await supabase.from('students').insert([{ 
        nim: document.getElementById('nim').value, 
        nama: document.getElementById('nama').value, 
        gpa: parseFloat(document.getElementById('gpa').value), 
        attendance: parseFloat(document.getElementById('attendance').value), 
        core_grade: parseFloat(document.getElementById('core_grade').value), 
        study_hours: parseInt(document.getElementById('study_hours').value),
        status: 'Aktif'
    }]);

    if (error) alert("Gagal: " + error.message);
    else { addModal.classList.add('hidden'); fetchStudents(); }
    saveBtn.innerText = "Simpan Data";
};

// ==========================================
// 6. AUTO-SEEDER (Fungsi Inject 1000 Data)
// ==========================================
window.seedDatabase = async function() {
    console.log("Memulai injeksi data...");
    const firstNames = ["Budi", "Siti", "Agus", "Dewi", "Andi", "Rina", "Fajar", "Indah", "Riyan", "Putri"];
    const lastNames = ["Santoso", "Pratama", "Hidayat", "Putri", "Wijaya", "Lestari", "Ramadhan"];
    
    const totalData = 1000;
    const batchSize = 100;
    
    for (let i = 0; i < totalData / batchSize; i++) {
        let batch = [];
        for (let j = 0; j < batchSize; j++) {
            batch.push({
                nim: "2026" + Math.floor(10000 + Math.random() * 90000),
                nama: `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
                gpa: parseFloat((2.0 + Math.random() * 2.0).toFixed(2)),
                attendance: Math.floor(60 + Math.random() * 40),
                core_grade: parseFloat((2.0 + Math.random() * 2.0).toFixed(2)),
                study_hours: Math.floor(5 + Math.random() * 20),
                prediction_result: Math.random() > 0.8 ? 'Berisiko' : 'Aman',
                status: 'Aktif'
            });
        }
        const { error } = await supabase.from('students').insert(batch);
        if (error) console.error("Gagal Batch " + i, error);
        else console.log(`Batch ${i+1} sukses.`);
    }
    fetchStudents();
    alert("Injeksi 1000 data selesai!");
};