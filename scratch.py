import traceback

try:
    from src.data_loader import DataLoader
    from src.preprocessing import Preprocessor
    from src.feature_engineering import FeatureEngineer
    from src.model import MLModel

    loader = DataLoader()
    patients = loader.load_patients()
    admissions = loader.load_admissions()
    icustays = loader.load_icustays()
    chartevents = loader.load_chartevents(nrows=10000)
    
    preprocessor = Preprocessor()
    core_data = preprocessor.merge_core_data(patients, admissions, icustays)
    
    engineer = FeatureEngineer()
    features = engineer.generate_features({'core': core_data, 'chartevents': chartevents})
    
    model = MLModel()
    model.train()
except Exception as e:
    traceback.print_exc()
