import os
import sys
import time
import random
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, MetaData, Table, Column, String, Integer, Float, DateTime, Text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.data_loader import DataLoader
from src.preprocessing import Preprocessor
from src.feature_engineering import FeatureEngineer
from src.model import MLModel
from queue_manager.priority_queue import HospitalQueue
from agent.agent_logic import AgentRuleSystem

app = Flask(__name__)
CORS(app)

hospital_queue = HospitalQueue()
agent = AgentRuleSystem()
model = MLModel()

# DB Connection (SQLite for seamless viva execution, drop-in replacement for MySQL via sqlalchemy)
DB_URL = "sqlite:///medagent.db" 
engine = create_engine(DB_URL)
metadata = MetaData()

patients_table = Table(
    'patients', metadata,
    Column('patient_id', String(50), primary_key=True),
    Column('name', String(100)),
    Column('age', Integer),
    Column('sex', String(20)),
    Column('address', String(200)),
    Column('occupation', String(100)),
    Column('education', String(100)),
    Column('symptoms', Text),
    Column('admission_date', String(50)),
    Column('examination_date', String(50)),
    Column('heart_rate', Float),
    Column('oxygen', Float),
    Column('temperature', Float),
    Column('severity', String(20)),
    Column('arrival_time', DateTime),
    Column('status', String(20)),
    Column('consultation_time', DateTime)
)

queue_table = Table(
    'queue', metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('patient_id', String(50)),
    Column('priority', Float),
    Column('waiting_time', Float)
)
metadata.create_all(engine)

def _ensure_patients_columns():
    """Minimal SQLite migration to support consulted workflow."""
    from sqlalchemy import text
    with engine.connect() as conn:
        cols = conn.execute(text("PRAGMA table_info(patients)")).fetchall()
        existing = {row[1] for row in cols}  # (cid, name, type, notnull, dflt_value, pk)

        if "status" not in existing:
            conn.execute(text("ALTER TABLE patients ADD COLUMN status VARCHAR(20)"))
        if "consultation_time" not in existing:
            conn.execute(text("ALTER TABLE patients ADD COLUMN consultation_time DATETIME"))

        # Backfill status for existing rows
        conn.execute(text("UPDATE patients SET status = 'Admitted' WHERE status IS NULL OR status = ''"))
        conn.commit()

_ensure_patients_columns()

# Train Model route removed - now happens invisibly on startup.

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    features = {
        'length_of_stay': float(data.get('length_of_stay', 1.0)),
        'vital_mean': float(data.get('vital_mean', 80)),
        'vital_max': float(data.get('vital_max', 100)),
        'vital_min': float(data.get('vital_min', 60))
    }
    severity = model.predict(features)
    return jsonify({"predicted_severity": severity})

@app.route("/add-patient", methods=["POST"])
def add_patient():
    data = request.json
    patient_id = data.get('patient_id', f"P_{int(time.time())}")
    
    features = {
        'length_of_stay': data.get('estimated_stay', 2.0),
        'vital_mean': data.get('heart_rate', 80), 
        'vital_max': data.get('heart_rate', 80) + 10,
        'vital_min': data.get('heart_rate', 80) - 10
    }
    
    # ML Pipeline
    severity = model.predict(features)
    # Agent Pipeline
    severity = str(agent.evaluate_vitals(severity, data))
    
    # Priority Queue Pipeline
    arrival_time = time.time()
    priority = hospital_queue.add_patient(patient_id, severity, arrival_time, data)
    
    # DB Pipeline
    with engine.connect() as conn:
        conn.execute(patients_table.insert().values(
            patient_id=patient_id,
            name=data.get('name', 'Unknown'),
            age=data.get('age', 30),
            sex=data.get('sex', ''),
            address=data.get('address', ''),
            occupation=data.get('occupation', ''),
            education=data.get('education', ''),
            symptoms=data.get('symptoms', ''),
            admission_date=data.get('admission_date', ''),
            examination_date=data.get('examination_date', ''),
            heart_rate=float(data.get('heart_rate', 80)),
            oxygen=float(data.get('oxygen', 98)),
            temperature=float(data.get('temperature', 98.6)),
            severity=severity,
            arrival_time=datetime.fromtimestamp(arrival_time),
            status="Admitted",
            consultation_time=None
        ))
        conn.commit()
    
    return jsonify({"message": "Patient added", "patient_id": patient_id, "severity": severity})

@app.route("/get-queue", methods=["GET"])
def get_queue():
    agent.run_agent_monitoring(hospital_queue)
    return jsonify({"queue": hospital_queue.get_queue()})

@app.route("/patients", methods=["GET"])
def get_patients():
    with engine.connect() as conn:
        result = conn.execute(patients_table.select()).fetchall()
        patients = []
        
        for row in result:
            pid = getattr(row, 'patient_id', '')
            patients.append({
                "patient_id": pid,
                "name": getattr(row, 'name', ''),
                "age": getattr(row, 'age', ''),
                "sex": getattr(row, 'sex', ''),
                "address": getattr(row, 'address', ''),
                "occupation": getattr(row, 'occupation', ''),
                "education": getattr(row, 'education', ''),
                "symptoms": getattr(row, 'symptoms', ''),
                "admission_date": getattr(row, 'admission_date', ''),
                "examination_date": getattr(row, 'examination_date', ''),
                "heart_rate": round(getattr(row, 'heart_rate', 0), 1),
                "oxygen": round(getattr(row, 'oxygen', 0), 1),
                "temperature": round(getattr(row, 'temperature', 0), 1),
                "severity": getattr(row, 'severity', ''),
                "arrival_time": str(getattr(row, 'arrival_time', '')),
                "status": getattr(row, 'status', 'Admitted') or 'Admitted',
                "consultation_time": str(getattr(row, 'consultation_time', '') or '')
            })
        
        # Sort by arrival_time descending (newest first)
        patients.sort(key=lambda x: x['arrival_time'], reverse=True)
    return jsonify({"patients": patients})

@app.route("/consult_patient/<patient_id>", methods=["POST"])
def consult_patient(patient_id):
    # Remove from priority queue (do NOT delete DB record)
    hospital_queue.remove_from_queue(patient_id)

    from sqlalchemy import text
    now = datetime.now()
    with engine.connect() as conn:
        res = conn.execute(
            text("""
                UPDATE patients
                SET status = 'Completed', consultation_time = :ct
                WHERE patient_id = :pid
            """),
            {"ct": now, "pid": patient_id}
        )
        conn.commit()

        if res.rowcount == 0:
            return jsonify({"status": "error", "message": "Patient not found"}), 404

    return jsonify({"status": "success", "message": "Patient marked as consulted successfully", "patient_id": patient_id})

@app.route("/delete_patient/<patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    # Remove from priority queue
    hospital_queue.remove_from_queue(patient_id)
    
    # Remove from database
    with engine.connect() as conn:
        from sqlalchemy import text
        result = conn.execute(text("DELETE FROM patients WHERE patient_id = :pid"), {"pid": patient_id})
        conn.commit()
        
        if result.rowcount == 0:
            return jsonify({"status": "error", "message": "Patient not found"}), 404
            
    return jsonify({"status": "success", "message": "Patient deleted"})

def simulate_vitals(patient_data):
    """Simulates real-time vital changes with random variations clamped to realistic bounds."""
    patient_data['heart_rate'] = max(40.0, min(200.0, float(patient_data.get('heart_rate', 80)) + random.uniform(-5, 5)))
    patient_data['oxygen'] = max(70.0, min(100.0, float(patient_data.get('oxygen', 98)) + random.uniform(-2, 2)))
    patient_data['temperature'] = max(95.0, min(106.0, float(patient_data.get('temperature', 98.6)) + random.uniform(-0.5, 0.5)))
    
    # Recalculate severity based on new vitals
    new_severity = str(agent.evaluate_vitals(patient_data.get('severity', 'Unknown'), patient_data))
    patient_data['severity'] = new_severity
    return patient_data

def background_simulation():
    """Background loop to periodically simulate vitals for all patients."""
    while True:
        time.sleep(5)
        new_queue = []
        
        with engine.connect() as conn:
            from sqlalchemy import text
            for item in hospital_queue.queue:
                _, pid, sev, arr_time, data = item
                updated_data = simulate_vitals(data)
                new_sev = updated_data['severity']

                # Rebuild triage key: severity -> waiting time -> arrival order
                heap_key = hospital_queue.calculate_priority(new_sev, arr_time)
                new_queue.append((heap_key, pid, new_sev, arr_time, updated_data))
                
                # Update DB with new vitals and severity
                conn.execute(text("""
                    UPDATE patients 
                    SET heart_rate = :hr, oxygen = :o2, temperature = :temp, severity = :sev
                    WHERE patient_id = :pid
                """), {
                    "hr": updated_data['heart_rate'],
                    "o2": updated_data['oxygen'],
                    "temp": updated_data['temperature'],
                    "sev": new_sev,
                    "pid": pid
                })
            conn.commit()
            
        import heapq
        heapq.heapify(new_queue)
        hospital_queue.queue = new_queue

# Start background simulation thread
simulation_thread = threading.Thread(target=background_simulation, daemon=True)
simulation_thread.start()

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    
    if not username or not password:
        return jsonify({"status": "fail", "message": "Invalid user ID or password"}), 400
        
    # Accept ANY non-empty username and password as per requirements
    return jsonify({"status": "success", "message": "Logged in successfully"})

if __name__ == "__main__":
    if not os.path.exists("model/saved_model.pkl"):
        print("\n[MedAgent] Invisibly training the model in the background. Please wait...")
        try:
            loader = DataLoader()
            patients = loader.load_patients()
            admissions = loader.load_admissions()
            icustays = loader.load_icustays()
            chartevents = loader.load_chartevents(nrows=100000)
            
            preprocessor = Preprocessor()
            core_data = preprocessor.merge_core_data(patients, admissions, icustays)
            
            engineer = FeatureEngineer()
            features = engineer.generate_features({'core': core_data, 'chartevents': chartevents})
            
            model.train()
            print("[MedAgent] Background training complete! Model is ready.\n")
        except Exception as e:
            print("[MedAgent] Error during background training:", str(e))
    else:
        print("\n[MedAgent] Pre-trained model found! Ready for immediate predictions.\n")

    app.run(port=5000, debug=True)
