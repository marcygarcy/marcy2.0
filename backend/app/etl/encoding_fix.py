"""Funções para corrigir problemas de encoding em texto."""
import pandas as pd
from typing import Union


def fix_encoding(text: Union[str, None]) -> Union[str, None]:
    """
    Corrige problemas comuns de encoding.
    
    Exemplos:
    - "CrÃ©dito" → "Crédito"
    - "DescriÃ§Ã£o" → "Descrição"
    - "NÃºmero" → "Número"
    - "CrÃ©dito manual" → "Crédito manual"
    """
    if not text or not isinstance(text, str):
        return text
    
    # Mapeamento de padrões comuns de encoding mal codificado
    # UTF-8 lido como ISO-8859-1 ou Windows-1252
    encoding_fixes = {
        # Caracteres acentuados minúsculos mal codificados
        'Ã©': 'é',
        'Ã­': 'í',
        'Ã³': 'ó',
        'Ãº': 'ú',
        'Ã¡': 'á',
        'Ã£': 'ã',
        'Ã§': 'ç',
        'Ãª': 'ê',
        'Ã´': 'ô',
        
        # Caracteres acentuados maiúsculos mal codificados
        'Ã€': 'À',
        'Ã‰': 'É',
        'Ã': 'Í',
        'Ã"': 'Ó',
        'Ãš': 'Ú',
        'Ã'': 'Á',
        'Ãƒ': 'Ã',
        'Ã‡': 'Ç',
        'ÃŽ': 'Ê',
        'Ã"': 'Ô',
        
        # Caracteres especiais e símbolos
        'â€™': "'",  # Apóstrofe
        'â€œ': '"',  # Aspas abertas
        'â€': '"',   # Aspas fechadas
        'â€"': '—',  # Em dash
        'â€"': '–',  # En dash
        
        # Casos específicos comuns encontrados
        'NÃº': 'Nº',
        'nÃº': 'nº',
    }
    
    # Aplicar correções
    fixed_text = text
    for wrong, correct in encoding_fixes.items():
        fixed_text = fixed_text.replace(wrong, correct)
    
    return fixed_text


def fix_dataframe_encoding(df: pd.DataFrame) -> pd.DataFrame:
    """
    Corrige problemas de encoding em todo o DataFrame.
    OTIMIZADO: Apenas processa se necessário e usa operações vetorizadas.
    
    Args:
        df: DataFrame com possível encoding incorreto
        
    Returns:
        DataFrame com encoding corrigido
    """
    if df.empty:
        return df
    
    # Verificar se há necessidade de correção (verificar nomes de colunas primeiro)
    needs_fix = False
    problematic_cols = []
    
    # Verificar nomes de colunas
    for col in df.columns:
        if isinstance(col, str) and any(char in col for char in ['Ã©', 'Ã­', 'Ã³', 'Ãº', 'Ã¡', 'Ã§', 'Ã£', 'Ãª', 'Ã´']):
            needs_fix = True
            problematic_cols.append(col)
            break
    
    # Se não há problemas óbvios nas colunas, verificar amostra de dados
    if not needs_fix:
        sample_size = min(100, len(df))  # Verificar apenas primeiras 100 linhas
        if sample_size > 0:
            for col in df.columns:
                if df[col].dtype == 'object':  # Apenas colunas de texto
                    try:
                        sample = df[col].head(sample_size).dropna()
                        if len(sample) > 0:
                            # Verificar se há caracteres mal codificados na amostra
                            sample_str = ' '.join([str(x) for x in sample if isinstance(x, str)])
                            if any(char in sample_str for char in ['Ã©', 'Ã­', 'Ã³', 'Ãº', 'Ã¡', 'Ã§', 'Ã£', 'Ãª', 'Ã´']):
                                needs_fix = True
                                problematic_cols.append(col)
                                break
                    except:
                        continue
    
    # Se não há necessidade de correção, retornar sem cópia
    if not needs_fix:
        return df
    
    # Criar cópia apenas se necessário
    df = df.copy()
    
    # 1. Corrigir nomes de colunas (sempre necessário se houver problemas)
    df.columns = [fix_encoding(col) for col in df.columns]
    
    # 2. Corrigir valores em colunas de texto - OTIMIZADO
    # Usar operações vetorizadas quando possível
    for col in df.columns:
        if df[col].dtype == 'object':  # Colunas de texto
            try:
                # Verificar se a coluna realmente precisa de correção
                non_null_mask = df[col].notna()
                if non_null_mask.any():
                    # Converter para string e verificar se há caracteres problemáticos
                    col_str = df[col].astype(str)
                    # Verificar se há caracteres mal codificados (apenas processar se necessário)
                    has_problems = col_str.str.contains('Ã©|Ã­|Ã³|Ãº|Ã¡|Ã§|Ã£|Ãª|Ã´', na=False, regex=True)
                    
                    if has_problems.any():
                        # Aplicar correção apenas onde há problemas
                        df.loc[has_problems, col] = df.loc[has_problems, col].apply(
                            lambda x: fix_encoding(x) if isinstance(x, str) else x
                        )
            except Exception as e:
                # Se houver erro, continuar sem essa coluna
                print(f"Aviso: Erro ao corrigir encoding na coluna {col}: {e}")
                continue
    
    return df


# Mapeamento específico para casos conhecidos (para referência)
ENCODING_MAPPINGS = {
    # Padrões comuns encontrados em ficheiros
    'CrÃ©dito': 'Crédito',
    'DÃ©bito': 'Débito',
    'DescriÃ§Ã£o': 'Descrição',
    'NÃºmero': 'Número',
    'NÃº': 'Nº',
    'RÃ³tulo': 'Rótulo',
    'CriaÃ§Ã£o': 'Criação',
    'TransaÃ§Ã£o': 'Transação',
    'CrÃ©dito manual': 'Crédito manual',
    'DÃ©bito manual': 'Débito manual',
    'CriaÃ§': 'Criaç',
}

