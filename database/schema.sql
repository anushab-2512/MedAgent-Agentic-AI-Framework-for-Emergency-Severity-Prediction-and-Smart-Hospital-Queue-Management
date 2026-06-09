CREATE DATABASE IF NOT EXISTS medagent_db;
USE medagent_db;

CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    age INT,
    sex VARCHAR(20),
    address VARCHAR(200),
    occupation VARCHAR(100),
    education VARCHAR(100),
    symptoms TEXT,
    admission_date VARCHAR(50),
    examination_date VARCHAR(50),
    heart_rate FLOAT,
    oxygen FLOAT,
    temperature FLOAT,
    severity VARCHAR(20),
    arrival_time DATETIME
);

CREATE TABLE IF NOT EXISTS queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50),
    priority FLOAT,
    waiting_time FLOAT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);
