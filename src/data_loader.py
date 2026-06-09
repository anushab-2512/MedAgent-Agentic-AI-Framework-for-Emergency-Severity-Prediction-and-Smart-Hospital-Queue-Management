import pandas as pd
import os

class DataLoader:
    def __init__(self, data_dir="data/raw"):
        self.data_dir = data_dir

    def load_patients(self):
        print("Loading PATIENTS.csv...")
        return pd.read_csv(os.path.join(self.data_dir, "PATIENTS.csv"))

    def load_admissions(self):
        print("Loading ADMISSIONS.csv...")
        return pd.read_csv(os.path.join(self.data_dir, "ADMISSIONS.csv"))

    def load_icustays(self):
        print("Loading ICUSTAYS.csv...")
        return pd.read_csv(os.path.join(self.data_dir, "ICUSTAYS.csv"))

    def load_chartevents(self, nrows=100000):
        """Large file handling using usecols and nrows"""
        print(f"Loading CHARTEVENTS.csv (nrows={nrows})...")
        cols = ['subject_id', 'hadm_id', 'icustay_id', 'itemid', 'charttime', 'valuenum']
        return pd.read_csv(os.path.join(self.data_dir, "CHARTEVENTS.csv"), usecols=cols, nrows=nrows)

    def load_labevents(self, nrows=100000):
        """Large file handling using usecols and nrows"""
        print(f"Loading LABEVENTS.csv (nrows={nrows})...")
        cols = ['subject_id', 'hadm_id', 'itemid', 'charttime', 'valuenum', 'flag']
        return pd.read_csv(os.path.join(self.data_dir, "LABEVENTS.csv"), usecols=cols, nrows=nrows)
        
    def load_diagnoses(self):
        print("Loading DIAGNOSES_ICD.csv...")
        return pd.read_csv(os.path.join(self.data_dir, "DIAGNOSES_ICD.csv"))
