import pandas as pd
import numpy as np
import os

class FeatureEngineer:
    def __init__(self):
        pass
        
    def calculate_length_of_stay(self, df):
        """Calculates LOS in days from admission and discharge times"""
        if 'admittime' in df.columns and 'dischtime' in df.columns:
            df['admittime'] = pd.to_datetime(df['admittime'])
            df['dischtime'] = pd.to_datetime(df['dischtime'])
            df['length_of_stay'] = (df['dischtime'] - df['admittime']).dt.total_seconds() / 86400.0
        else:
            df['length_of_stay'] = np.random.uniform(1, 15, size=len(df)) # Fallback
        return df
        
    def aggregate_vitals(self, df, chartevents):
        """Aggregates timeseries vitals into statistical features per admission"""
        print("Aggregating vitals...")
        agg_vitals = chartevents.groupby('hadm_id')['valuenum'].agg(['mean', 'max', 'min']).reset_index()
        agg_vitals.rename(columns={'mean': 'vital_mean', 'max': 'vital_max', 'min': 'vital_min'}, inplace=True)
        return pd.merge(df, agg_vitals, on='hadm_id', how='left').fillna(0)

    def create_severity_label(self, df):
        """Rules-based synthetic severity logic based on LOS to train the ML model on."""
        print("Creating target severity labels for training...")
        conditions = [
            (df['length_of_stay'] > 10),
            (df['length_of_stay'] > 5),
            (df['length_of_stay'] > 2)
        ]
        choices = ['Critical', 'High', 'Medium']
        df['severity'] = np.select(conditions, choices, default='Low')
        return df

    def generate_features(self, datasets):
        """Main pipeline for feature engineering"""
        df, chartevents = datasets['core'], datasets['chartevents']
        
        df = self.calculate_length_of_stay(df)
        df = self.aggregate_vitals(df, chartevents)
        df = self.create_severity_label(df)
        
        # Select final features
        features = ['length_of_stay', 'vital_mean', 'vital_max', 'vital_min']
        final_df = df[['subject_id', 'hadm_id'] + features + ['severity']]
        
        # Save to processed folder
        os.makedirs("data/processed", exist_ok=True)
        final_file = "data/processed/features.csv"
        final_df.to_csv(final_file, index=False)
        print(f"Features saved to {final_file}")
        
        return final_df
