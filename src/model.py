import pandas as pd
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

class MLModel:
    def __init__(self, model_path="model/saved_model.pkl"):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.model_path = model_path
        
    def train(self, data_path="data/processed/features.csv"):
        """Trains ML model on features CSV"""
        print("Loading processed data for training...")
        if not os.path.exists(data_path):
            raise FileNotFoundError(f"{data_path} not found. Run pipeline first.")
            
        df = pd.read_csv(data_path)
        feature_cols = ['length_of_stay', 'vital_mean', 'vital_max', 'vital_min']
        
        X = df[feature_cols]
        y = df['severity']
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        print("Training Random Forest Classifier...")
        self.model.fit(X_train, y_train)
        
        # Evaluation Process
        y_pred = self.model.predict(X_test)
        print("\n--- Model Evaluation ---")
        print(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
        print(f"Precision: {precision_score(y_test, y_pred, average='weighted', zero_division=0):.4f}")
        print(f"Recall:    {recall_score(y_test, y_pred, average='weighted', zero_division=0):.4f}")
        print(f"F1 Score:  {f1_score(y_test, y_pred, average='weighted', zero_division=0):.4f}")
        print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
        
        # Serialization
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        print(f"Model saved to {self.model_path}")
        
    def predict(self, features_dict):
        """Predicts severity based on input features"""
        if not hasattr(self.model, "classes_"):
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
            else:
                return "Unknown"
        
        df = pd.DataFrame([features_dict])
        prediction = self.model.predict(df)[0]
        return prediction
