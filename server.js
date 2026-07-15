const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4001;

// Servir archivos estáticos desde la raíz de este proyecto front
app.use(express.static(__dirname));

// Redirigir cualquier ruta desconocida a checkout.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Pasarela de Pagos Frontend ejecutándose en puerto ${PORT}`);
  console.log(` URL de acceso: http://localhost:${PORT}/checkout.html?token=TU_TOKEN`);
  console.log(`====================================================`);
});
