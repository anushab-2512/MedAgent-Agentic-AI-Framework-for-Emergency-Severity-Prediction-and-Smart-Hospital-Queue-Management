import sqlite3
import pandas as pd

# Connect to the SQLite database
conn = sqlite3.connect('medagent.db')

# Ask user if they want to search for someone specific
search_name = input("Enter patient name to search (or press Enter to see everyone): ").strip()

print("\n=== PATIENTS TABLE ===")
if search_name:
    # Use parameterized query to prevent SQL injection
    query = "SELECT * FROM patients WHERE name LIKE ?"
    patients_df = pd.read_sql_query(query, conn, params=('%' + search_name + '%',))
else:
    query = "SELECT * FROM patients"
    patients_df = pd.read_sql_query(query, conn)

print(patients_df.to_string(index=False) if not patients_df.empty else f"No patients found matching '{search_name}'.")
print("\n" + "="*50 + "\n")

conn.close()
