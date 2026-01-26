
import pandas as pd
import json
import glob
import os

def generate_json():
    # Define paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    raw_dir = os.path.join(base_dir, 'raw')
    output_file = os.path.join(base_dir, '..', 'public', 'assets', 'palabras.json')

    # normalize path
    output_file = os.path.normpath(output_file)
    
    # Ensure output directory exists (public/assets)
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    excel_files = glob.glob(os.path.join(raw_dir, '*.xlsx'))
    
    all_words = []
    
    print(f"Found {len(excel_files)} Excel files in {raw_dir}")

    for file_path in excel_files:
        try:
            print(f"Processing {os.path.basename(file_path)}...")
            df = pd.read_excel(file_path)
            
            # Normalize column names just in case (strip separate, lower case checks if needed, but we start with exact match)
            # Expected: Categoría, Palabra, Pista1, Pista2, Pista3, Pista4, Pista5
            
            # Iterate over rows
            for _, row in df.iterrows():
                # Extract basic info
                categoria = str(row['Categoría']).strip() if pd.notna(row['Categoría']) else "General"
                palabra = str(row['Palabra']).strip() if pd.notna(row['Palabra']) else ""
                
                if not palabra:
                    continue
                
                # Extract clues (Pista1 to Pista5)
                pistas = []
                for i in range(1, 6):
                    col_name = f'Pista{i}'
                    if col_name in row and pd.notna(row[col_name]):
                        val = str(row[col_name]).strip()
                        if val:
                            pistas.append(val)
                
                # Create word object
                word_obj = {
                    "categoria": categoria,
                    "palabraSecreta": palabra,
                    "pistasImpostor": pistas
                }
                
                all_words.append(word_obj)
                
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # Write to JSON
    print(f"Total words generated: {len(all_words)}")
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_words, f, ensure_ascii=False, indent=2)
        print(f"Successfully wrote JSON to {output_file}")
    except Exception as e:
        print(f"Error writing output file: {e}")

if __name__ == "__main__":
    generate_json()
