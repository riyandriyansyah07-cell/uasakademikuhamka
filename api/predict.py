import json
import numpy as np
from http.server import BaseHTTPRequestHandler
from sklearn.ensemble import RandomForestClassifier

# --- INISIALISASI MODEL AI (COLD START) ---
# Membuat model Random Forest sederhana untuk Vercel Deployment
X_dummy = np.array([
    [3.8, 95, 3.8, 15], # Pintar, rajin -> 0 (Aman)
    [3.5, 80, 3.2, 10], # Normal -> 0 (Aman)
    [2.1, 50, 2.0, 2],  # Jarang hadir, nilai kecil -> 1 (Berisiko)
    [1.5, 30, 1.0, 0]   # Kritis -> 1 (Berisiko)
])
y_dummy = np.array([0, 0, 1, 1])

rf_model = RandomForestClassifier(n_estimators=10, random_state=42)
rf_model.fit(X_dummy, y_dummy)

# --- VERCEL SERVERLESS HANDLER ---
class handler(BaseHTTPRequestHandler):
    
    # Mengizinkan koneksi dari frontend (CORS)
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "Content-type")
        self.end_headers()

    def do_POST(self):
        try:
            # 1. Terima data dari Frontend HTML
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_body = json.loads(post_data)

            # 2. Ekstrak 4 Fitur Akademik
            gpa = float(req_body.get('gpa', 0))
            attendance = float(req_body.get('attendance', 0))
            core_grade = float(req_body.get('core_grade', 0))
            study_hours = float(req_body.get('study_hours', 0))

            features = np.array([[gpa, attendance, core_grade, study_hours]])

            # 3. Prediksi menggunakan Random Forest
            prediction = rf_model.predict(features)[0]
            
            # 4. Tentukan Hasil
            hasil_prediksi = "Berisiko" if prediction == 1 else "Aman"

            # 5. Kirim kembali ke Frontend
            response_data = {
                "status": "success",
                "risk_category": hasil_prediksi
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_msg = json.dumps({"status": "error", "message": str(e)})
            self.wfile.write(error_msg.encode('utf-8'))