document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api/payments'
    : 'https://tu-pasarela-back.onrender.com/api/payments'; // TODO: Reemplazar por tu URL real de Render

  const STORE_FRONT_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://tu-tienda-front.vercel.app'; // TODO: Reemplazar por la URL real de tu tienda (MatiVicFront) en producción

  // Elementos del DOM - Detalles
  const amountEl = document.getElementById('amount-value');
  const orderIdEl = document.getElementById('order-id-value');
  const dateEl = document.getElementById('date-value');

  // Elementos del DOM - Vistas y Formularios
  const formView = document.getElementById('payment-form-view');
  const processingView = document.getElementById('processing-view');
  const successView = document.getElementById('success-view');
  const errorView = document.getElementById('error-view');
  const paymentForm = document.getElementById('payment-form');
  const errorBanner = document.getElementById('form-error-banner');

  // Botones
  const btnCancel = document.getElementById('btn-cancel');
  const btnSuccessRedirect = document.getElementById('btn-success-redirect');
  const btnErrorRedirect = document.getElementById('btn-error-redirect');

  // Pasos de Progreso
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');
  const step4 = document.getElementById('step-4');

  let paymentSession = null;

  // 1. Validar que exista el token
  if (!token) {
    showErrorState('Error: Token de sesión de pago no encontrado en la URL.');
    return;
  }

  // 2. Cargar detalles del pago
  fetch(`${API_BASE}/${token}`)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo cargar la información del pago.');
      return res.json();
    })
    .then(data => {
      paymentSession = data;
      
      // Mostrar datos formateados en pesos chilenos sin centavos
      const montoFormateado = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP'
      }).format(data.amount);
      
      amountEl.textContent = montoFormateado;
      orderIdEl.textContent = data.orderId;

      // Formatear Fecha según zona horaria chilena
      const date = data.createdAt ? new Date(data.createdAt) : new Date();
      const formattedDate = date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) + ' ' + date.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit'
      });
      dateEl.textContent = formattedDate;

      // Si el pago ya fue procesado previamente
      if (data.status !== 'pending') {
        showErrorState(`Esta sesión de pago ya expiró. Estado: ${data.status.toUpperCase()}`);
      }
    })
    .catch(err => {
      showErrorState(err.message || 'Error de conexión con la pasarela.');
    });

  // Mascaras y validaciones para inputs
  const cardNumberInput = document.getElementById('card-number');
  const expiryInput = document.getElementById('card-expiry');
  const cvvInput = document.getElementById('card-cvv');

  // Mascara para número de tarjeta (Agrupar en 4 dígitos)
  cardNumberInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.match(/.{1,4}/g)?.join(' ') || value;
    e.target.value = value.substring(0, 19); // 16 digitos + 3 espacios
  });

  // Mascara para Fecha de expiración (MM/AA)
  expiryInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value.substring(0, 5);
  });

  // Limitar CVV a números
  cvvInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
  });

  // Botón Cancelar
  btnCancel.addEventListener('click', () => {
    if (paymentSession && paymentSession.failureUrl) {
      window.location.href = paymentSession.failureUrl;
    } else {
      // Fallback
      alert('Pago cancelado. Redirigiendo a la tienda...');
      window.location.href = STORE_FRONT_URL;
    }
  });

  // 3. Procesar Envío del Formulario
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBanner.style.display = 'none';

    const cardHolder = document.getElementById('card-holder').value.trim();
    const cardNumber = cardNumberInput.value.replace(/\s+/g, '');
    const cardExpiry = expiryInput.value.trim();
    const cardCvv = cvvInput.value.trim();
    const cardEmail = document.getElementById('card-email').value.trim();

    // Validaciones Locales
    if (cardNumber.length < 15 || cardNumber.length > 16) {
      showFormError('El número de tarjeta debe tener entre 15 y 16 dígitos.');
      return;
    }

    const expiryParts = cardExpiry.split('/');
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
      showFormError('La fecha de expiración debe tener el formato MM/AA.');
      return;
    }

    const month = parseInt(expiryParts[0], 10);
    if (month < 1 || month > 12) {
      showFormError('Mes de expiración inválido.');
      return;
    }

    if (cardCvv.length < 3 || cardCvv.length > 4) {
      showFormError('El código CVV debe tener 3 o 4 dígitos.');
      return;
    }

    // Iniciar flujo de animación de Pasos (Visualmente Realista)
    formView.style.display = 'none';
    processingView.style.display = 'block';

    try {
      // Paso 1 completado, activamos Paso 2 (Autenticación)
      updateSteps(2);
      await sleep(1500);

      // Paso 2 completado, activamos Paso 3 (Autorización)
      updateSteps(3);
      
      const response = await fetch(`${API_BASE}/${token}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          cardHolder,
          expirationDate: cardExpiry,
          cvv: cardCvv,
          email: cardEmail
        })
      });

      const result = await response.json();
      
      // Esperamos un segundo adicional para simular retraso de autorización real
      await sleep(1500);

      // Paso 3 completado, Paso 4 finalizado
      updateSteps(4);
      processingView.style.display = 'none';

      if (result.status === 'paid') {
        // Mostrar Éxito
        successView.style.display = 'block';
        startRedirectCountdown(result.redirectUrl, 'success-countdown');
        btnSuccessRedirect.onclick = () => window.location.href = result.redirectUrl;
      } else {
        // Mostrar Fallo
        errorView.style.display = 'block';
        document.getElementById('error-reason-text').textContent = result.message || 'La tarjeta fue rechazada.';
        startRedirectCountdown(result.redirectUrl, 'error-countdown');
        btnErrorRedirect.onclick = () => window.location.href = result.redirectUrl;
      }

    } catch (err) {
      console.error(err);
      processingView.style.display = 'none';
      errorView.style.display = 'block';
      document.getElementById('error-reason-text').textContent = 'Error interno procesando la transacción.';
      updateSteps(4);
    }
  });

  // Funciones Auxiliares
  function showFormError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showErrorState(msg) {
    formView.style.display = 'none';
    errorView.style.display = 'block';
    document.getElementById('error-reason-text').textContent = msg;
    document.querySelector('.auto-redirect-info').style.display = 'none';
    btnErrorRedirect.textContent = 'Salir';
    btnErrorRedirect.onclick = () => {
      if (paymentSession && paymentSession.failureUrl) {
        window.location.href = paymentSession.failureUrl;
      } else {
        window.location.href = STORE_FRONT_URL;
      }
    };
  }

  function updateSteps(activeStepNum) {
    const steps = [step1, step2, step3, step4];
    steps.forEach((step, idx) => {
      const stepNum = idx + 1;
      if (stepNum < activeStepNum) {
        step.className = 'step-item completed';
      } else if (stepNum === activeStepNum) {
        step.className = 'step-item active';
      } else {
        step.className = 'step-item';
      }
    });
  }

  function startRedirectCountdown(url, elementId) {
    let count = 5;
    const interval = setInterval(() => {
      count--;
      document.getElementById(elementId).textContent = count;
      if (count <= 0) {
        clearInterval(interval);
        window.location.href = url;
      }
    }, 1000);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
