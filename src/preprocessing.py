import pandas as pd

class Preprocessor:
    def __init__(self):
        pass
        
    def merge_core_data(self, patients, admissions, icustays):
        """Merges core static tables: Patients, Admissions, and ICU Stays"""
        print("Merging core datasets...")
        # Merge patients and admissions
        df = pd.merge(admissions, patients, on='subject_id', how='inner')
        # Merge with ICU stays
        df = pd.merge(df, icustays, on=['subject_id', 'hadm_id'], how='inner')
        return df
        
    def handle_missing_values(self, df):
        print("Handling missing values...")
        # Simple imputation for numeric features 
        return df.fillna(0)
