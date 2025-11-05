import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Servir ficheiros estáticos
app.use(express.static(join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
  console.log(`📊 App de Análise de Pagamentos Marketplace`);
  console.log(`💡 Tudo processado localmente no browser - sem backend necessário!`);
});

